import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assignmentDate,sortAssignedWork,type AssignedTask} from '../src/assigned-work';
import {taskActivity} from '../domain/task-schema';
import {Store} from '../domain/store';
import {Workspace} from '../domain/workspace';
import {AgentTasks} from '../domain/agent-tasks';

const row=(id:string,name:string,date?:string,assignedAt?:string):AssignedTask=>({
  project:{id:'project-'+id,name} as AssignedTask['project'],kind:'steps',
  item:{id,text:id,notes:'',date,assignee:'kai',activity:assignedAt?[{at:assignedAt,actor:'me',summary:'Assigned to Kai'}]:[]},
});
const ids=(rows:AssignedTask[])=>rows.map(row=>row.item.id);

test('date sorts cross project boundaries, distinguish action/assignment dates, and leave unknown dates last',()=>{
  const rows=[row('late','Alpha','2026-11-20','2026-11-01T12:00:00Z'),row('early','Zulu','2026-11-10','2026-11-03T12:00:00Z'),row('unknown','Beta')];
  assert.deepEqual(ids(sortAssignedWork(rows,'act-asc')),['early','late','unknown']);
  assert.deepEqual(ids(sortAssignedWork(rows,'act-desc')),['late','early','unknown']);
  assert.deepEqual(ids(sortAssignedWork(rows,'assigned-asc')),['late','early','unknown']);
  assert.deepEqual(ids(sortAssignedWork(rows,'assigned-desc')),['early','late','unknown']);
  assert.deepEqual(ids(sortAssignedWork(rows,'project')),['late','unknown','early']);
  assert.deepEqual(ids(rows),['late','early','unknown']);
  assert.deepEqual(ids(sortAssignedWork(rows.filter(row=>row.item.id!=='late'),'act-asc')),['early','unknown']);
});

test('editing notes preserves the assignment date; reassignment records a new date without inventing legacy dates',()=>{
  const previous=row('task','Research',undefined,'2020-01-01T12:00:00Z').item;
  const edited=taskActivity(previous,{...previous,notes:'New notes'},'me','Updated task');
  assert.equal(assignmentDate(edited),'2020-01-01T12:00:00Z');
  const reassigned=taskActivity(edited,{...edited,assignee:'codex'},'me','Updated task');
  assert.notEqual(assignmentDate(reassigned),assignmentDate(edited));
  assert.equal(reassigned.activity?.at(-1)?.summary,'Assigned to Codex');
  assert.equal(assignmentDate({...previous,activity:[{at:'2020-01-01T12:00:00Z',actor:'me',summary:'Created task'}]}),undefined);
  assert.equal(assignmentDate({...previous,assignee:'codex'}),undefined);
});

test('both manual and agent task creation record assignment dates; unchanged saves do not reset them',()=>{
  const store=new Store(),workspace=new Workspace(store),project=workspace.save({name:'Research',purpose:''});
  workspace.items(project.id,project.revision,'steps',[{id:'manual',text:'Manual task',notes:''}]);
  let current=workspace.get(project.id);
  const assigned=assignmentDate(current.steps[0]);assert.ok(assigned);
  workspace.items(project.id,current.revision,'steps',current.steps);
  current=workspace.get(project.id);assert.equal(assignmentDate(current.steps[0]),assigned);
  const agent=new AgentTasks(store);
  const result=agent.execute({version:1,action:'create',actor:'kai',projectId:project.id,revision:current.revision,kind:'followUps',requestId:'assignment-date-test',patch:{text:'Agent task'}});
  assert.ok(assignmentDate(result.task));
  assert.equal(result.task.activity.at(-1).summary,'Assigned to Kai');
});
