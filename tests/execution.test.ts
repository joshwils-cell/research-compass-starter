import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Store} from '../domain/store';
import {Workspace,handoff} from '../domain/workspace';
import {AgentTasks} from '../domain/agent-tasks';
import {nextSteps} from '../src/next-steps';
import {cloudTarget,executionView,repositoryFromUrl} from '../src/execution';
import {taskExecution,githubRepository} from '../domain/execution-schema';
import {TaskDetails} from '../src/TaskUI';
import type {WorkItem} from '../src/compass-types';

const repo=repositoryFromUrl('https://github.com/example/research')!,other=repositoryFromUrl('https://github.com/example/other')!;
function fixture(){const store=new Store(),w=new Workspace(store),p=w.save({name:'Synthetic execution project',purpose:'Fixtures only',defaultCloudRepository:repo});return {store,w,p,agent:new AgentTasks(store)};}
test('manual repositories reject credentials and non-repository URLs; stored references are canonical',()=>{
  assert.deepEqual(repositoryFromUrl(' https://github.com/example/research.git/ '),repo);
  for(const url of ['http://github.com/example/research','https://github.com.evil.test/example/research','https://user:secret@github.com/example/research','https://github.com/example/research?token=secret','https://github.com/example/research#branch','https://github.com/example/research/tree/main','https://github.com/example/..'])assert.throws(()=>repositoryFromUrl(url));
  assert.equal(githubRepository.safeParse({...repo,fullName:'different/repo'}).success,false);
  assert.equal(githubRepository.safeParse({...repo,url:repo.url+'/'}).success,false);
  assert.equal(githubRepository.safeParse({...repo,id:'12345'}).success,true);
  assert.equal(taskExecution.safeParse({route:'cloud',environmentId:'env_one'}).success,false);
  assert.equal(taskExecution.safeParse({route:'cloud',repository:repo,environmentId:'provider:environment/opaque.id'}).success,true);
});
test('legacy, Auto, Local, configured and unresolved Cloud have consistent all/ready/detail plugin views',()=>{
  const {w,p,agent}=fixture();
  const tasks:WorkItem[]=[{id:'legacy',text:'Use Codex Local per existing instructions',notes:'',assignee:'kai'},...(['auto','local','cloud'] as const).map(route=>({id:route,text:route,notes:'',assignee:'kai' as const,execution:{route}})),{id:'target',text:'Cloud selected',notes:'',assignee:'kai',execution:{route:'cloud',repository:{...repo,id:'123'},environmentId:'env_saved'}}];
  w.items(p.id,p.revision,'steps',tasks);
  const all=agent.execute({version:1,actor:'kai',action:'list',assignee:'all',readiness:'all'}).tasks;
  const ready=agent.execute({version:1,actor:'kai',action:'list'}).tasks;
  assert.equal(all.length,tasks.length);assert.deepEqual(ready,all);
  for(const row of all){const detail=agent.execute({version:1,actor:'kai',action:'get',projectId:p.id,taskId:row.task.id});assert.deepEqual(detail,row);}
  assert.equal(all[0].execution.source,'legacy');assert.equal(all[0].execution.route,'auto');assert.equal(all[0].task.execution,undefined);
  assert.match(all[0].execution.guidance,/honoring explicit routing/);assert.match(all[2].execution.guidance,/never fall back to cloud/);
  assert.equal(all[3].execution.cloudTarget.state,'missing_repository');assert.equal(all[4].execution.cloudTarget.state,'not_verified');assert.equal(all[4].task.execution.repository.id,'123');
  const copy=handoff(w.get(p.id),{stepIds:['target'],followUpIds:[],linkIds:[],references:[],outcome:'Review',instructions:''});assert.match(copy,/env_saved/);assert.match(copy,/not_verified/);
});
test('project defaults survive old callers; changes never retarget tasks, explicit null clears',()=>{
  const {w,p,agent}=fixture();const t:WorkItem={id:'new-cloud',text:'Cloud snapshot',notes:'',assignee:'kai',execution:{route:'cloud',repository:p.defaultCloudRepository}};
  w.work(p.id,p.revision,[{kind:'steps',item:t}]);let current=w.get(p.id);
  w.save({id:p.id,revision:current.revision,name:p.name,purpose:'Old client'});current=w.get(p.id);assert.deepEqual(current.defaultCloudRepository,repo);
  w.save({id:p.id,revision:current.revision,name:p.name,purpose:'New default',defaultCloudRepository:other});current=w.get(p.id);assert.deepEqual(current.steps[0].execution?.repository,repo);
  const prior=current.revision;w.save({id:p.id,revision:current.revision,name:p.name,purpose:'Clear',defaultCloudRepository:null});current=w.get(p.id);assert.equal(current.defaultCloudRepository,undefined);assert.deepEqual(current.steps[0].execution?.repository,repo);
  assert.throws(()=>w.save({id:p.id,revision:prior,name:'Stale',purpose:''}),/changed/);
  w.work(p.id,current.revision,[{kind:'steps',item:{...current.steps[0],execution:{route:'cloud',repository:other}}}]);
  assert.deepEqual(agent.execute({version:1,actor:'kai',action:'get',projectId:p.id,taskId:t.id}).execution.repository,other);
});
test('route changes preserve claims, reviews, drafts, dates, legacy arrays and stale-write protection',()=>{
  const {store,w,p}=fixture();
  const task:WorkItem={id:'legacy-follow',text:'Revise draft',notes:'Owner intent',assignee:'kai',date:'2026-12-01',time:'10:00',dueDate:'2026-12-03',workStatus:'needs_input',claim:{id:'claim',actor:'kai',startedAt:'2026-11-01T12:00:00Z',effectState:'uncertain'},result:{summary:'Draft',artifacts:[{label:'Unsent',draftId:'draft-keep'}]},reviews:[{id:'review',at:'2026-11-02T12:00:00Z',action:'request_changes',text:'Revise'}],pendingReviewId:'review'};
  const withFollowUp={...p,followUps:[task]};store.put(withFollowUp);const before=structuredClone(w.get(p.id));
  w.work(p.id,p.revision,[{kind:'followUps',item:{...task,execution:{route:'local'}}}]);const after=w.get(p.id);
  for(const field of ['claim','reviews','result','date','time','dueDate','pendingReviewId','workStatus','assignee'] as const)assert.deepEqual(after.followUps[0][field],before.followUps[0][field]);
  assert.equal(after.steps.length,0);assert.match(after.followUps[0].activity!.at(-1)!.summary,/Execution preference changed/);
  assert.throws(()=>w.work(p.id,p.revision,nextSteps(after)),/changed/);
  // JSON storage round trip, including opaque saved IDs and reviewed history.
  const reloaded=new Store();reloaded.put(JSON.parse(JSON.stringify(after)));assert.deepEqual(new Workspace(reloaded).get(p.id),JSON.parse(JSON.stringify(after)));
});
test('repository edits clear stale environment references; inactive non-Kai routing is retained',()=>{
  const {w,p}=fixture();const t:WorkItem={id:'target',text:'Task',notes:'',assignee:'kai',execution:{route:'cloud',repository:repo,environmentId:'env_old'}};
  w.items(p.id,p.revision,'steps',[t]);let current=w.get(p.id);
  w.work(p.id,current.revision,[{kind:'steps',item:{...current.steps[0],execution:{...t.execution!,repository:other}}}]);current=w.get(p.id);assert.equal(current.steps[0].execution?.environmentId,undefined);
  w.work(p.id,current.revision,[{kind:'steps',item:{...current.steps[0],assignee:'me'}}]);const saved=w.get(p.id).steps[0];assert.ok(saved.execution);assert.equal(executionView(saved).applicable,false);assert.equal(executionView(saved).cloudTarget,undefined);
  const html=renderToStaticMarkup(createElement(TaskDetails,{item:saved}));assert.ok(!html.includes('Execution:'));
  const legacy={...saved,assignee:'kai' as const,execution:undefined};const legacyHtml=renderToStaticMarkup(createElement(TaskDetails,{item:legacy}));assert.ok(legacyHtml.includes('Execution: Auto'));assert.ok(!legacyHtml.includes('GitHub repository URL'));
});
test('lookup fixtures distinguish unavailable, zero, one, multiple and stale selections without launching',()=>{
  assert.equal(cloudTarget(repo).state,'not_verified');
  assert.equal(cloudTarget(repo,undefined,{status:'confirmed',matches:[]}).state,'needs_cloud_setup');
  const matches=[{id:'env_a',name:'A'},{id:'env_b',name:'B'}];
  assert.equal(cloudTarget(repo,undefined,{status:'confirmed',matches:matches.slice(0,1)}).state,'matched');
  assert.equal(cloudTarget(repo,undefined,{status:'confirmed',matches}).state,'environment_choice_required');
  assert.equal(cloudTarget(repo,'env_b',{status:'confirmed',matches}).state,'matched');
  assert.equal(cloudTarget(repo,'env_stale',{status:'confirmed',matches}).state,'selection_not_matched');
  assert.equal(cloudTarget(repo,'env_b').resolved,false);
});
