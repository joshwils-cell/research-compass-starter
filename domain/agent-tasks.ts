import {randomUUID,createHash} from 'node:crypto';
import {z} from 'zod';
import {Workspace} from './workspace';
import {Store} from './store';
import {actionDate,actionTime,taskResult,workItem,taskActivity} from './task-schema';
import {taskStatus} from '../src/task-status';
import {pendingReview} from '../src/task-review';
import type {WorkItem,LocalProject} from '../src/compass-types';

const request=z.object({
  version:z.literal(1),action:z.enum(['list','get','create','claim','begin','update']),actor:z.enum(['kai','codex']),
  requestId:z.string().min(1).max(200).optional(),projectId:z.string().uuid().optional(),taskId:z.string().max(200).optional(),kind:z.enum(['steps','followUps']).optional(),
  revision:z.number().int().nonnegative().optional(),claimId:z.string().max(200).optional(),reconciled:z.boolean().optional(),
  assignee:z.enum(['me','kai','codex','all']).optional(),readiness:z.enum(['ready','all']).optional(),
  patch:z.object({text:z.string().trim().min(1).max(20000).optional(),notes:z.string().max(50000).optional(),date:actionDate.nullable().optional(),time:actionTime.nullable().optional(),assignee:z.enum(['me','kai','codex']).optional(),actionKind:z.enum(['task','email']).optional(),emailAccount:z.string().email().optional(),status:z.enum(['ready','working','awaiting_review','needs_input','done']).optional(),result:taskResult.optional()}).strict().optional()
}).strict();
export class AgentTasks {
  workspace:Workspace;
  constructor(public store:Store){this.workspace=new Workspace(store);}
  execute(value:unknown,now=new Date()):any{
    const r=request.parse(value);
    const all=()=>this.workspace.state().projects.filter(p=>!p.archivedAt).flatMap(p=>(['steps','followUps'] as const).flatMap(kind=>p[kind].filter(t=>!t.archivedAt&&!t.completedAt).map(t=>this.view(p,kind,t,now))));
    if(r.action==='list')return {version:1,tasks:all().filter(t=>(!r.projectId||t.projectId===r.projectId)&&(r.assignee==='all'||t.task.assignee===(r.assignee||r.actor))&&(r.readiness==='all'||t.status==='Ready'))};
    if(r.action==='get'){
      if(!r.projectId||!r.taskId)throw new Error('projectId and taskId are required.');
      const p=this.workspace.get(r.projectId);if(p.archivedAt)throw new Error('Project is archived.');
      const kind=(['steps','followUps'] as const).find(k=>p[k].some(t=>t.id===r.taskId));if(!kind)throw new Error('Task not found.');
      return this.view(p,kind,p[kind].find(t=>t.id===r.taskId)!,now);
    }
    if(!r.requestId||!r.projectId||r.revision===undefined)throw new Error('Writes require requestId, projectId, and revision.');
    const hash=createHash('sha256').update(JSON.stringify(r)).digest('hex'),key=`agent-request:${r.requestId}`;
    return this.store.transaction(()=>{
      const old=this.store.setting<{hash:string;response:any}>(key);
      if(old){if(old.hash!==hash)throw new Error('requestId was already used for a different request.');return old.response;}
      const p=this.workspace.get(r.projectId!);if(p.archivedAt)throw new Error('Project is archived.');
      if(p.revision!==r.revision)throw new Error('Project changed. Read it again and use its current revision.');
      let kind=r.kind||(['steps','followUps'] as const).find(k=>p[k].some(t=>t.id===r.taskId));
      if(!kind)throw new Error('Specify kind for creation or a valid taskId.');
      let previous=p[kind].find(t=>t.id===r.taskId),next:WorkItem;
      if(r.action==='create'){
        if(p[kind].length>=2000)throw new Error('This project already has 2000 items in this list.');
        if(!r.patch?.text)throw new Error('Task text is required.');
        if(r.patch.status||r.patch.result)throw new Error('Create a ready task, then claim it before recording work.');
        next=workItem.parse({id:randomUUID(),notes:'',...r.patch,date:r.patch.date||undefined,time:r.patch.time||undefined,assignee:r.patch.assignee||r.actor});
      }else{
        if(!previous||previous.archivedAt||previous.completedAt)throw new Error('Choose an active task.');
        next={...previous};
        if(r.action==='claim'){
          if((next.assignee||'me')!==r.actor)throw new Error('This task is assigned to someone else.');
          const response=pendingReview(next);
          if(next.result?.artifacts.some(a=>a.draftId)&&!response)throw new Error('An existing draft is recorded. Review or reconcile it instead of drafting again.');
          if(taskStatus(next,now)!=='Ready'||next.claim&&!response)throw new Error('Task is not ready or is already claimed. Inspect its existing attempt.');
          if(next.claim&&next.claim.actor!==r.actor)throw new Error('The existing attempt belongs to another agent. Reconcile it before continuing.');
          next.workStatus='working';next.claim=next.claim||{id:randomUUID(),actor:r.actor,startedAt:now.toISOString(),effectState:'not_started'};
        }else if(r.action==='begin'){
          this.checkClaim(next,r.actor,r.claimId);if(next.claim!.effectState!=='not_started')throw new Error('External action may already have started. Reconcile its outcome before retrying.');
          next.claim={...next.claim!,effectState:'started'};
        }else{
          const patch=r.patch;if(!patch)throw new Error('Update patch required.');
          if(next.claim)this.checkClaim(next,r.actor,r.claimId);
          if(patch.result&&!next.claim)throw new Error('Claim the task before recording an execution result.');
          if(patch.status==='working')throw new Error('Use claim to start work.');
          if(patch.status==='ready'&&next.claim?.effectState!=='not_started'&&next.claim&&!r.reconciled)throw new Error('Reconcile the previous external action before resetting this task.');
          const {status,...fields}=patch;next=workItem.parse({...next,...fields,date:fields.date===null?undefined:fields.date===undefined?next.date:fields.date,time:fields.date===null||fields.time===null?undefined:fields.time===undefined?next.time:fields.time});
          if(status==='done'){
            if(next.actionKind==='email'&&next.result?.artifacts.some(a=>a.draftId))throw new Error('A draft is awaiting review. Complete email-sending tasks in the app after sending.');
            next.completedAt=now.toISOString();next.workStatus=undefined;next.claim=undefined;
          }else if(status){
            next.workStatus=status==='ready'?undefined:status;
            if(status==='ready'||status==='awaiting_review')next.claim=undefined;
            else if(status==='needs_input'&&next.claim?.effectState==='started')next.claim={...next.claim,effectState:'uncertain'};
          }
          if(patch.result?.artifacts.some(a=>a.draftId)&&status!=='awaiting_review')throw new Error('A recorded Gmail draft must be awaiting_review.');
          if(patch.result||status==='awaiting_review'||status==='needs_input'||status==='done')next.pendingReviewId=undefined;
        }
      }
      next=taskActivity(previous,next,r.actor,`${r.action==='create'?'Created':r.action==='claim'?'Claimed':r.action==='begin'?'Started external action for':'Updated'} task${r.patch?.result?': '+r.patch.result.summary.slice(0,1000):''}`);
      const items=previous?p[kind].map(t=>t.id===next.id?next:t):[...p[kind],next];
      const updated={...p,[kind]:items,revision:p.revision+1};this.store.put(updated);
      const response=this.view(updated,kind,next,now);this.store.setSetting(key,{hash,response});return response;
    });
  }
  checkClaim(task:WorkItem,actor:string,claimId?:string){if(!task.claim||task.claim.actor!==actor||task.claim.id!==claimId)throw new Error('A current claimId owned by this agent is required.');}
  view(p:LocalProject,kind:'steps'|'followUps',task:WorkItem,now:Date){return {version:1,projectId:p.id,projectName:p.name,description:p.purpose,revision:p.revision,kind,status:taskStatus(task,now),task:{...task,assignee:task.assignee||'me',emailAccount:task.emailAccount||'you@example.com'},context:p.codexLinks,userResponse:pendingReview(task),executionGuidance:pendingReview(task)?'Read the owner response and its saved prior result before continuing. Request changes means revise the previous work; approve and continue means follow the owner instructions. Existing draft IDs refer to unsent drafts: inspect and update/reuse them rather than duplicating or sending. A started or uncertain existing claim must be reconciled before any new external action. Record the new result and await review.':undefined,timeZone:'America/New_York'};}
}
