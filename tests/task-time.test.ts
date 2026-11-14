import {test} from 'node:test';
import assert from 'node:assert/strict';
import {taskStatus,easternActionInstant,actionLabel} from '../src/task-status';
import {workItem} from '../domain/task-schema';
import {Store} from '../domain/store';
import {Workspace} from '../domain/workspace';
import {AgentTasks} from '../domain/agent-tasks';
import {sortAssignedWork,type AssignedTask} from '../src/assigned-work';
const item={id:'timed',text:'Timed task',notes:'',date:'2026-11-10',time:'14:30'};
test('time controls Eastern readiness to the minute while date-only tasks retain midnight behavior',()=>{
 assert.equal(taskStatus(item,new Date('2026-11-10T19:29:59Z')),'Scheduled');
 assert.equal(taskStatus(item,new Date('2026-11-10T19:30:00Z')),'Ready');
 assert.equal(taskStatus({...item,time:undefined},new Date('2026-11-10T05:00:00Z')),'Ready');
 assert.equal(actionLabel(item),'2026-11-10 at 2:30 PM Eastern');
 assert.equal(actionLabel({...item,time:'00:00'}),'2026-11-10 at 12:00 AM Eastern');
});
test('Eastern scheduling handles summer/winter offsets, the skipped spring hour, and the first repeated fall hour',()=>{
 assert.equal(easternActionInstant('2026-07-01','09:00'),Date.parse('2026-07-01T13:00:00Z'));
 assert.equal(easternActionInstant('2026-12-01','09:00'),Date.parse('2026-12-01T14:00:00Z'));
 assert.equal(easternActionInstant('2027-03-14','02:30'),undefined);
 assert.equal(easternActionInstant('2026-11-01','01:30'),Date.parse('2026-11-01T05:30:00Z'));
 assert.throws(()=>workItem.parse({...item,date:'2027-03-14',time:'02:30'}));
 assert.throws(()=>workItem.parse({...item,date:undefined}));
 assert.throws(()=>workItem.parse({...item,time:'24:00'}));
});
test('Act on sorting uses times within each day and keeps undated tasks last',()=>{
 const row=(id:string,time?:string,date:string|undefined='2026-11-10'):AssignedTask=>({project:{id,name:id} as AssignedTask['project'],kind:'steps',item:{...item,id,date,time}});
 const rows=[row('afternoon','14:30'),row('morning','09:00'),row('all-day'),row('undated',undefined,undefined)];
 rows[3].item.date=undefined;
 assert.deepEqual(sortAssignedWork(rows,'act-asc').map(r=>r.item.id),['all-day','morning','afternoon','undated']);
 assert.deepEqual(sortAssignedWork(rows,'act-desc').map(r=>r.item.id),['afternoon','morning','all-day','undated']);
});
test('manual/agent saves preserve times, and clearing the date through the agent also clears its time',()=>{
 const store=new Store(),workspace=new Workspace(store),project=workspace.save({name:'Times',purpose:''});
 workspace.items(project.id,project.revision,'steps',[item]);
 const current=workspace.get(project.id);assert.equal(current.steps[0].time,'14:30');
 const agent=new AgentTasks(store);
 const result=agent.execute({version:1,action:'update',actor:'kai',projectId:project.id,taskId:item.id,revision:current.revision,requestId:'clear-time',patch:{date:null}});
 assert.equal(result.task.date,undefined);assert.equal(result.task.time,undefined);
 const created=agent.execute({version:1,action:'create',actor:'kai',projectId:project.id,revision:result.revision,kind:'steps',requestId:'create-time',patch:{text:'Timed agent task',date:'2026-12-01',time:'09:00'}});
 assert.equal(created.task.time,'09:00');
});
test('handoffs retain the Eastern time for both next steps and follow-ups',()=>{
 const store=new Store(),workspace=new Workspace(store),project=workspace.save({name:'Times',purpose:''});
 workspace.items(project.id,project.revision,'steps',[item]);
 workspace.items(project.id,workspace.get(project.id).revision,'followUps',[{...item,id:'follow',text:'Follow-up',time:'15:15'}]);
 const markdown=workspace.prepare(project.id,{target:'kai',stepIds:[item.id],followUpIds:['follow'],linkIds:[],references:[],outcome:'Review',instructions:''});
 assert.match(markdown,/2:30 PM Eastern/);assert.match(markdown,/3:15 PM Eastern/);
});
