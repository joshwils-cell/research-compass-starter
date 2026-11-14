import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Store} from '../domain/store';
import {Workspace} from '../domain/workspace';
import {TaskReviews} from '../domain/task-reviews';
import {AgentTasks} from '../domain/agent-tasks';
import {taskStatus} from '../src/task-status';
import {nextSteps} from '../src/next-steps';
import {TaskDetails,WorkList} from '../src/TaskUI';
import type {WorkItem,ReviewInput} from '../src/compass-types';

function fixture(kind:'steps'|'followUps'='steps',override:Partial<WorkItem>={}){
  const store=new Store(),w=new Workspace(store),p=w.save({name:'Review test',purpose:'Synthetic task'});
  const task:WorkItem={id:'task',text:'Revise the summary',notes:'Original instructions',assignee:'kai',workStatus:'awaiting_review',date:'2099-01-01',time:'14:30',result:{summary:'Original result',artifacts:[{label:'Document',url:'https://example.org/document'}]},activity:[{at:'2026-11-10T12:00:00Z',actor:'kai',summary:'Updated task: Original result'}],...override};
  store.put({...p,[kind]:[task]});
  return {store,w,p,kind,task,reviews:new TaskReviews(store),agent:new AgentTasks(store)};
}
const request=(kind:'steps'|'followUps',action:ReviewInput['action'],text='Use the newer analysis.',requestId='review-1'):ReviewInput=>({kind,taskId:'task',action,text,requestId});
test('request changes queues the same task with feedback and a preserved reviewed result',()=>{
  const {w,p,kind,task,reviews,agent}=fixture();const input=request(kind,'request_changes');
  reviews.execute(p.id,p.revision,input);let current=w.get(p.id),item=current.steps[0];
  assert.equal(item.id,task.id);assert.equal(taskStatus(item),'Ready');assert.equal(item.date,task.date);assert.equal(item.time,task.time);
  assert.deepEqual(item.result,task.result);assert.deepEqual(item.reviews?.[0].result,task.result);assert.equal(item.reviews?.[0].text,input.text);
  assert.equal(item.activity?.at(-1)?.actor,'me');assert.equal(item.assignee,'kai');
  const listed=agent.execute({version:1,action:'list',actor:'kai'}).tasks;
  assert.equal(listed.length,1);assert.equal(listed[0].userResponse.text,input.text);assert.match(listed[0].executionGuidance,/owner response/);
  const claimed=agent.execute({version:1,action:'claim',actor:'kai',projectId:p.id,taskId:'task',revision:current.revision,requestId:'claim'});
  assert.equal(claimed.status,'Working');assert.equal(claimed.userResponse.action,'request_changes');
  const updated=agent.execute({version:1,action:'update',actor:'kai',projectId:p.id,taskId:'task',revision:claimed.revision,requestId:'result',claimId:claimed.task.claim.id,patch:{status:'awaiting_review',result:{summary:'Revised result',artifacts:[]}}});
  assert.equal(updated.task.result.summary,'Revised result');assert.equal(updated.task.pendingReviewId,undefined);assert.equal(updated.task.reviews[0].result.summary,'Original result');
  assert.equal(agent.execute({version:1,action:'list',actor:'kai'}).tasks.length,0);
  current=w.get(p.id);reviews.execute(p.id,current.revision,request(kind,'approve_continue','Now write the discussion.','review-2'));
  assert.equal(w.get(p.id).steps[0].reviews?.[1].result?.summary,'Revised result');
});
test('approve and continue works for legacy follow-ups and survives ordinary edits',()=>{
  const {w,p,kind,reviews,agent}=fixture('followUps');reviews.execute(p.id,p.revision,request(kind,'approve_continue','Continue to the next section.'));
  let current=w.get(p.id);const item=current.followUps[0];
  w.work(p.id,current.revision,nextSteps(current));current=w.get(p.id);
  w.items(p.id,current.revision,kind,current.followUps.map(t=>({...t,notes:'More context'})));
  current=w.get(p.id);assert.deepEqual(current.followUps[0].reviews,item.reviews);assert.equal(current.followUps[0].pendingReviewId,item.pendingReviewId);
  const view=agent.execute({version:1,action:'get',actor:'kai',projectId:p.id,taskId:'task'});assert.equal(view.kind,'followUps');assert.equal(view.userResponse.text,'Continue to the next section.');
});
test('approve and finish completes tracking and preserves unsent draft references without agent work',()=>{
  const {w,p,kind,reviews,agent,task}=fixture('steps',{actionKind:'email',emailAccount:'you@example.com',result:{summary:'Draft ready',artifacts:[{label:'Unsent draft',draftId:'original-draft',emailAccount:'you@example.com'}]}});
  reviews.execute(p.id,p.revision,request(kind,'approve_finish',''));const item=w.get(p.id).steps[0];
  assert.equal(taskStatus(item),'Done');assert.equal(item.pendingReviewId,undefined);assert.deepEqual(item.result,task.result);assert.deepEqual(item.reviews?.[0].result,task.result);
  assert.equal(agent.execute({version:1,action:'list',actor:'kai'}).tasks.length,0);
});
test('explicit draft revision allows one agent claim while retaining the original draft and send guard',()=>{
  const {w,p,kind,reviews,agent}=fixture('steps',{actionKind:'email',result:{summary:'Draft ready',artifacts:[{label:'Draft',draftId:'keep-existing-draft'}]}});
  assert.throws(()=>agent.execute({version:1,action:'claim',actor:'kai',projectId:p.id,taskId:'task',revision:p.revision,requestId:'before-review'}),/existing draft/);
  reviews.execute(p.id,p.revision,request(kind,'request_changes','Shorten the existing draft.'));
  const claimed=agent.execute({version:1,action:'claim',actor:'kai',projectId:p.id,taskId:'task',revision:w.get(p.id).revision,requestId:'after-review'});
  assert.equal(claimed.task.result.artifacts[0].draftId,'keep-existing-draft');assert.match(claimed.executionGuidance,/rather than duplicating or sending/);
  assert.throws(()=>agent.execute({version:1,action:'claim',actor:'kai',projectId:p.id,taskId:'task',revision:claimed.revision,requestId:'claim-twice'}),/not ready/);
  assert.throws(()=>agent.execute({version:1,action:'update',actor:'kai',projectId:p.id,taskId:'task',revision:claimed.revision,claimId:claimed.task.claim.id,requestId:'done',patch:{status:'done'}}),/draft is awaiting review/);
});
test('a response to needs-input retains uncertain attempts and requires reconciliation',()=>{
  const claim={id:'prior-claim',actor:'kai' as const,startedAt:'2026-11-10T12:00:00Z',effectState:'uncertain' as const};
  const {w,p,kind,reviews,agent}=fixture('steps',{workStatus:'needs_input',claim});reviews.execute(p.id,p.revision,request(kind,'approve_continue','Check what happened, then continue.'));
  assert.deepEqual(w.get(p.id).steps[0].claim,claim);
  const claimed=agent.execute({version:1,action:'claim',actor:'kai',projectId:p.id,taskId:'task',revision:w.get(p.id).revision,requestId:'resume'});
  assert.deepEqual(claimed.task.claim,claim);assert.deepEqual(claimed.task.reviews[0].previousClaim,claim);
  assert.throws(()=>agent.execute({version:1,action:'begin',actor:'kai',projectId:p.id,taskId:'task',revision:claimed.revision,requestId:'repeat',claimId:claim.id}),/already/);
});
test('stale, repeated, invalid and ineligible responses cannot duplicate or restart work',()=>{
  const {w,p,kind,reviews}=fixture();const input=request(kind,'request_changes');
  assert.throws(()=>reviews.execute(p.id,p.revision,request(kind,'request_changes','  ')),/Write/);
  assert.throws(()=>reviews.execute(p.id,p.revision,{...input,action:'send_email'}));
  reviews.execute(p.id,p.revision,input);const saved=w.get(p.id);reviews.execute(p.id,p.revision,input);
  assert.deepEqual(w.get(p.id),saved);
  assert.throws(()=>reviews.execute(p.id,p.revision,{...input,text:'Changed'}),/already used/);
  assert.throws(()=>reviews.execute(p.id,p.revision,{...input,requestId:'stale'}),/changed/);
  assert.throws(()=>reviews.execute(p.id,saved.revision,{...input,requestId:'again'}),/no longer/);
  for(const override of [{completedAt:'2026-11-10T12:00:00Z'},{archivedAt:'2026-11-10T12:00:00Z'},{workStatus:'working' as const},{assignee:'me' as const}]){
    const f=fixture('steps',override);assert.throws(()=>f.reviews.execute(f.p.id,f.p.revision,request('steps','approve_finish','')),/no longer/);
  }
  const archived=fixture();archived.w.archive(archived.p.id,archived.p.revision,true);assert.throws(()=>archived.reviews.execute(archived.p.id,archived.w.get(archived.p.id).revision,input),/Restore/);
});
test('review UI exposes three actions, stores prior result details and hides controls after queuing',()=>{
  const {w,p,kind,reviews}=fixture();let project=w.get(p.id);
  let html=renderToStaticMarkup(createElement(WorkList,{project,save:async()=>{},review:async()=>{}}));
  for(const label of ['Your reply','Request changes','Approve and continue','Approve and finish'])assert.ok(html.includes(label));
  reviews.execute(p.id,p.revision,request(kind,'request_changes','Please revise.'));project=w.get(p.id);
  html=renderToStaticMarkup(createElement(WorkList,{project,save:async()=>{},review:async()=>{}}));assert.ok(!html.includes('<legend>Respond to Kai</legend>'));assert.ok(html.includes('queued for the agent'));
  const details=renderToStaticMarkup(createElement(TaskDetails,{item:project.steps[0]}));assert.ok(details.includes('Please revise.'));assert.ok(details.includes('Result you reviewed'));assert.ok(details.includes('Original result'));
});
