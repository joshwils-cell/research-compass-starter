import {randomUUID,createHash} from 'node:crypto';
import {z} from 'zod';
import type {WorkItem,TaskReview} from '../src/compass-types';
import {canReview,reviewLabels} from '../src/task-review';
import {Store} from './store';
import {Workspace} from './workspace';
import {taskActivity} from './task-schema';

const input=z.object({requestId:z.string().min(1).max(200),kind:z.enum(['steps','followUps']),taskId:z.string().min(1).max(200),action:z.enum(['request_changes','approve_continue','approve_finish']),text:z.string().trim().max(10000)}).strict();
export class TaskReviews {
  constructor(public store:Store){}
  execute(projectId:string,revision:number,value:unknown,now=new Date()){
    const r=input.parse(value),hash=createHash('sha256').update(JSON.stringify({projectId,revision,...r})).digest('hex'),key=`task-review-request:${r.requestId}`;
    const old=this.store.setting<{hash:string}>(key);
    if(old){if(old.hash!==hash)throw Error('This response request was already used. Refresh before sending another response.');return;}
    if(!r.text&&r.action!=='approve_finish')throw Error('Write your feedback or the next action before sending.');
    const workspace=new Workspace(this.store);
    workspace.change(projectId,revision,p=>{
      if(p.archivedAt)throw Error('Restore this project before responding.');
      const item=p[r.kind].find(t=>t.id===r.taskId);
      if(!item||!canReview(item))throw Error('This task is no longer awaiting your response. Refresh and check its latest update.');
      if((item.reviews?.length||0)>=500)throw Error('This task has reached its response history limit. Create a new next step to continue.');
      const review:TaskReview={id:randomUUID(),at:now.toISOString(),action:r.action,text:r.text,result:structuredClone(item.result),previousClaim:structuredClone(item.claim)};
      const finish=r.action==='approve_finish';
      const next:WorkItem={...item,reviews:[...(item.reviews||[]),review],pendingReviewId:finish?undefined:review.id,completedAt:finish?now.toISOString():undefined,workStatus:undefined,claim:finish?undefined:item.claim};
      // Keep unresolved attempts when queuing a response. The agent must reconcile
      // any prior external action rather than blindly starting it again.
      const updated=taskActivity(item,next,'me',`${reviewLabels[r.action]}${r.text?`: ${r.text}`:''}`.slice(0,2000));
      return {...p,[r.kind]:p[r.kind].map(t=>t.id===r.taskId?updated:t)};
    });
    this.store.setSetting(key,{hash});
  }
}
