import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {Store} from '../domain/store';
import {Workspace} from '../domain/workspace';
import {AgentTasks} from '../domain/agent-tasks';
import {taskStatus,easternDate} from '../src/task-status';
fs.mkdirSync(path.resolve('.test-data'),{recursive:true});
const fixture=()=>{const store=new Store(),w=new Workspace(store),p=w.save({name:'Research',purpose:'Compare models'});return {store,w,p,agent:new AgentTasks(store)};};
test('Eastern action dates handle midnight and DST; explicit statuses take priority',()=>{
  assert.equal(easternDate(new Date('2026-11-08T04:30:00Z')),'2026-11-07');
  assert.equal(easternDate(new Date('2026-11-08T05:30:00Z')),'2026-11-08');
  assert.equal(taskStatus({id:'a',text:'A',notes:'',date:'2026-11-08'},new Date('2026-11-08T04:30:00Z')),'Scheduled');
  assert.equal(taskStatus({id:'a',text:'A',notes:'',date:'2026-11-08'},new Date('2026-11-08T05:30:00Z')),'Ready');
  assert.equal(taskStatus({id:'a',text:'A',notes:'',date:'2099-01-01',workStatus:'awaiting_review'}),'Awaiting review');
});
test('agent lists only ready assigned active work, supports follow-ups, and creates/reschedules tasks',()=>{
  const {store,w,p,agent}=fixture();try{
    w.items(p.id,p.revision,'followUps',[{id:'old',text:'Mine',notes:''},{id:'due',text:'Draft email',notes:'Keep wording',assignee:'kai',actionKind:'email'},{id:'later',text:'Later',notes:'',assignee:'kai',date:'2099-01-01'},{id:'completed',text:'Done',notes:'',assignee:'kai',completedAt:new Date().toISOString()},{id:'archived',text:'Archived',notes:'',assignee:'kai',archivedAt:new Date().toISOString()}]);
    assert.deepEqual(agent.execute({version:1,actor:'kai',action:'list'}).tasks.map((t:any)=>t.task.id),['due']);
    const created=agent.execute({version:1,actor:'kai',action:'create',projectId:p.id,revision:w.get(p.id).revision,requestId:'create',kind:'followUps',patch:{text:'Contact team',date:'2099-01-02',assignee:'kai'}});
    assert.equal(created.status,'Scheduled');assert.equal(created.task.activity[0].actor,'kai');
    const updated=agent.execute({version:1,actor:'kai',action:'update',projectId:p.id,revision:created.revision,requestId:'reschedule',taskId:created.task.id,patch:{date:null}});
    assert.equal(updated.status,'Ready');assert.equal(updated.task.date,undefined);
    w.archive(p.id,updated.revision,true);assert.equal(agent.execute({version:1,actor:'kai',action:'list'}).tasks.length,0);
    assert.throws(()=>agent.execute({version:1,actor:'kai',action:'get',projectId:p.id,taskId:'due'}),/archived/);
  }finally{}
});
test('write replays are idempotent, stale updates rejected, and simultaneous claims cannot both succeed',()=>{
  const {store,w,p,agent}=fixture();try{
    const request={version:1,actor:'kai',action:'create',requestId:'stable-create',projectId:p.id,revision:p.revision,kind:'followUps',patch:{text:'Draft',actionKind:'email'}};
    const created=agent.execute(request);assert.equal(JSON.stringify(agent.execute(request)),JSON.stringify(created));assert.equal(w.get(p.id).followUps.length,1);
    assert.throws(()=>agent.execute({...request,patch:{text:'Different'}}),/different request/);
    assert.throws(()=>agent.execute({...request,requestId:'new-create'}),/changed/);
    const claimed=agent.execute({version:1,actor:'kai',action:'claim',requestId:'claim1',projectId:p.id,revision:created.revision,taskId:created.task.id});
    assert.throws(()=>agent.execute({version:1,actor:'codex',action:'claim',requestId:'claim2',projectId:p.id,revision:claimed.revision,taskId:created.task.id}),/someone else/);
    assert.throws(()=>agent.execute({version:1,actor:'kai',action:'claim',requestId:'claim3',projectId:p.id,revision:claimed.revision,taskId:created.task.id}),/not ready/);
    assert.throws(()=>agent.execute({version:1,actor:'kai',action:'begin',requestId:'wrong-token',projectId:p.id,revision:claimed.revision,taskId:created.task.id,claimId:'wrong'}),/claimId/);
  }finally{}
});
test('interrupted external actions require reconciliation, drafts await review, and preserve recorded results',()=>{
  const {store,w,p,agent}=fixture();
  let last:any;
  try{
    last=agent.execute({version:1,actor:'kai',action:'create',requestId:'create',projectId:p.id,revision:p.revision,kind:'followUps',patch:{text:'Email team',actionKind:'email'}});
    last=agent.execute({version:1,actor:'kai',action:'claim',requestId:'claim',projectId:p.id,revision:last.revision,taskId:last.task.id});
    const id=last.task.id,claimId=last.task.claim.id;
    last=agent.execute({version:1,actor:'kai',action:'begin',requestId:'begin',projectId:p.id,revision:last.revision,taskId:id,claimId});
    assert.throws(()=>agent.execute({version:1,actor:'kai',action:'begin',requestId:'begin-again',projectId:p.id,revision:last.revision,taskId:id,claimId}),/already/);
    assert.throws(()=>agent.execute({version:1,actor:'kai',action:'update',requestId:'unsafe-reset',projectId:p.id,revision:last.revision,taskId:id,claimId,patch:{status:'ready'}}),/Reconcile/);
    last=agent.execute({version:1,actor:'kai',action:'update',requestId:'uncertain',projectId:p.id,revision:last.revision,taskId:id,claimId,patch:{status:'needs_input',result:{summary:'Draft outcome uncertain',artifacts:[]}}});assert.equal(last.task.claim.effectState,'uncertain');
    last=agent.execute({version:1,actor:'kai',action:'update',requestId:'reconciled',projectId:p.id,revision:last.revision,taskId:id,claimId,patch:{status:'awaiting_review',result:{summary:'Found the existing unsent draft',artifacts:[{label:'Draft',draftId:'real-draft-id',emailAccount:'you@example.com'}]}}});
    assert.equal(last.task.completedAt,undefined);assert.equal(last.status,'Awaiting review');assert.equal(last.task.claim,undefined);
    assert.equal(agent.execute({version:1,actor:'kai',action:'list'}).tasks.length,0);
    assert.throws(()=>agent.execute({version:1,actor:'kai',action:'claim',requestId:'duplicate-draft',projectId:p.id,revision:last.revision,taskId:id}),/existing draft/);
    assert.throws(()=>agent.execute({version:1,actor:'kai',action:'update',requestId:'mark-sent',projectId:p.id,revision:last.revision,taskId:id,patch:{status:'done'}}),/draft is awaiting review/);
  }finally{}
});
test('invalid dates, results without claims, unsafe URLs, and completed tasks are rejected',()=>{
  const {store,w,p,agent}=fixture();try{
    const create={version:1,actor:'kai',action:'create',requestId:'new',projectId:p.id,revision:p.revision,kind:'steps',patch:{text:'Task'}};
    assert.throws(()=>agent.execute({...create,patch:{text:'Task',date:'2026-02-30'}}));
    const created=agent.execute(create);
    assert.throws(()=>agent.execute({version:1,actor:'kai',action:'update',requestId:'result',projectId:p.id,revision:created.revision,taskId:created.task.id,patch:{result:{summary:'Pretend',artifacts:[]}}}),/Claim/);
    assert.throws(()=>agent.execute({version:1,actor:'kai',action:'update',requestId:'unsafe',projectId:p.id,revision:created.revision,taskId:created.task.id,patch:{result:{summary:'Unsafe',artifacts:[{label:'Bad',url:'javascript:alert(1)'}]}}}));
    w.items(p.id,created.revision,'steps',w.get(p.id).steps.map(t=>({...t,completedAt:new Date().toISOString()})));
    assert.throws(()=>agent.execute({version:1,actor:'kai',action:'claim',requestId:'done',projectId:p.id,revision:w.get(p.id).revision,taskId:created.task.id}),/active/);
  }finally{}
});