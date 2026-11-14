import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Store} from '../domain/store';
import {Workspace,handoff} from '../domain/workspace';
import {AgentTasks} from '../domain/agent-tasks';
import {nextSteps,nextStepKey} from '../src/next-steps';
import {WorkList} from '../src/TaskUI';
import type {WorkItem} from '../src/compass-types';

function fixture(){
  const store=new Store(),w=new Workspace(store),p=w.save({name:'Combined project',purpose:'Preserve every detail'});
  const activity:WorkItem['activity']=[{at:'2026-11-10T12:00:00Z',actor:'kai',summary:'Assigned to Kai'}];
  const followUps:WorkItem[]=[
    {id:'same-id',text:'Existing follow-up',notes:'Original notes\nSecond line',date:'2026-12-01',time:'14:30',assignee:'kai',actionKind:'email',emailAccount:'you@example.com',workStatus:'awaiting_review',result:{summary:'Draft ready',artifacts:[{label:'Draft',draftId:'keep-draft',emailAccount:'you@example.com'},{label:'Document',url:'https://example.org/doc'}]},activity},
    {id:'claimed',text:'In progress',notes:'Keep attempt',assignee:'kai',workStatus:'needs_input',claim:{id:'claim',actor:'kai',startedAt:'2026-11-10T12:00:00Z',effectState:'uncertain'},activity},
    {id:'done',text:'Completed follow-up',notes:'Keep completion',completedAt:'2026-11-10T12:00:00Z'},
    {id:'archived',text:'Archived follow-up',notes:'Keep archive',archivedAt:'2026-11-10T12:00:00Z'},
    {id:'both',text:'Archived completed follow-up',notes:'Keep both',archivedAt:'2026-11-11T12:00:00Z',completedAt:'2026-11-10T12:00:00Z'},
  ];
  const project={...p,steps:[{id:'same-id',text:'Existing step',notes:''}],followUps};store.put(project);
  return {store,w,project};
}
test('one list displays both sources without changing any existing records, results, or states',()=>{
  const {w,project}=fixture(),before=structuredClone(w.get(project.id));
  const rows=nextSteps(project);
  assert.equal(rows.length,6);assert.equal(new Set(rows.map(nextStepKey)).size,6);
  const html=renderToStaticMarkup(createElement(WorkList,{project,save:async()=>{}}));
  assert.equal((html.match(/<h2>Next steps<\/h2>/g)||[]).length,1);assert.ok(!html.includes('Follow-ups'));
  for(const e of rows)assert.ok(html.includes(e.item.text));
  assert.ok(html.includes('Draft ready'));assert.ok(html.includes('keep-draft'));
  assert.ok(html.includes('Completed work (1)'));assert.ok(html.includes('Archived steps (2)'));
  assert.deepEqual(w.get(project.id),before);
});
test('mixed ordering and saving preserve all original details and agent task references',()=>{
  const {w,project,store}=fixture(),entries=nextSteps(project),before=structuredClone(project);
  [entries[0],entries[1]]=[entries[1],entries[0]];
  w.work(project.id,project.revision,entries);
  let current=w.get(project.id);
  assert.deepEqual(current.steps,before.steps);assert.deepEqual(current.followUps,before.followUps);
  assert.deepEqual(nextSteps(current).map(nextStepKey),entries.map(nextStepKey));
  const agent=new AgentTasks(store),view=agent.execute({version:1,action:'get',actor:'kai',projectId:project.id,taskId:'claimed'});
  assert.equal(view.kind,'followUps');assert.deepEqual(view.task.claim,before.followUps[1].claim);
  const handoffText=handoff(current,{stepIds:['same-id'],followUpIds:['same-id'],linkIds:[],references:[],outcome:'Review',instructions:''});
  assert.ok(handoffText.indexOf('Existing follow-up')<handoffText.indexOf('Existing step'));
  assert.ok(handoffText.includes('(followUps)'));assert.ok(!handoffText.includes('follow-up context'));
  assert.ok(handoffText.includes('Second line'));assert.ok(handoffText.includes('2:30 PM Eastern'));
  const updated=nextSteps(current).map(e=>e.kind==='followUps'&&e.item.id==='same-id'?{...e,item:{...e.item,notes:'Updated notes'}}:e);
  w.work(project.id,current.revision,updated);current=w.get(project.id);
  assert.equal(current.followUps[0].notes,'Updated notes');assert.deepEqual(current.followUps[0].result,before.followUps[0].result);
  assert.deepEqual(current.followUps[1],before.followUps[1]);assert.deepEqual(current.steps,before.steps);
  assert.throws(()=>w.work(project.id,project.revision,entries),/changed/);
});
test('new steps and legacy agent-created follow-ups join the list; archive and completion remain reversible',()=>{
  const {w,project,store}=fixture();let rows=nextSteps(project);
  rows.push({kind:'steps',item:{id:'new',text:'New step',notes:'',assignee:'me'}});w.work(project.id,project.revision,rows);
  let current=w.get(project.id);
  const agent=new AgentTasks(store);agent.execute({version:1,action:'create',actor:'kai',projectId:project.id,revision:current.revision,kind:'followUps',requestId:'legacy-create',patch:{text:'Legacy agent item'}});
  current=w.get(project.id);assert.equal(nextSteps(current).at(-1)?.item.text,'Legacy agent item');
  rows=nextSteps(current).map(e=>e.item.id==='both'?{...e,item:{...e.item,archivedAt:undefined}}:e);w.work(project.id,current.revision,rows);
  current=w.get(project.id);assert.ok(current.followUps.find(i=>i.id==='both')?.completedAt);
  rows=nextSteps(current).map(e=>e.item.id==='both'?{...e,item:{...e.item,completedAt:undefined}}:e);w.work(project.id,current.revision,rows);
  current=w.get(project.id);assert.equal(current.followUps.find(i=>i.id==='both')?.completedAt,undefined);
  assert.throws(()=>w.work(project.id,current.revision,[...nextSteps(current),nextSteps(current)[0]]),/Duplicate/);
  assert.throws(()=>w.work(project.id,current.revision,nextSteps(current).slice(1)),/missing/);
  assert.throws(()=>w.work(project.id,current.revision,[...nextSteps(current),{kind:'steps',item:{id:'bad',text:'Invalid time',notes:'',time:'10:00'}}]),/Invalid/);
  w.archive(project.id,current.revision,true);assert.throws(()=>w.work(project.id,w.get(project.id).revision,nextSteps(current)),/Restore/);
});
test('unrecognized existing metadata is retained on unchanged tasks and nested results',()=>{
  const {w,store,project}=fixture();
  const extended={...project,followUps:project.followUps.map(item=>({...item,retainedField:{original:true},result:item.result?{...item.result,retainedResult:'Keep'}:undefined}))};
  store.put(extended);w.work(project.id,extended.revision,nextSteps(extended));
  assert.deepEqual(w.get(project.id).followUps,extended.followUps);
});
