import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Store} from '../domain/store';
import {Workspace} from '../domain/workspace';
import {AgentTasks} from '../domain/agent-tasks';
import {changeCalendar,readCalendar,calendarSnapshot} from '../domain/calendar';
import {calendarEvents,calendarDays,shiftDate,shiftMonth,emptyCalendar} from '../src/calendar';
import {WorkList} from '../src/TaskUI';
import {CalendarView} from '../src/CalendarView';
import {nextSteps} from '../src/next-steps';
import {workItem} from '../domain/task-schema';
import {taskStatus,easternActionInstant,easternDate} from '../src/task-status';
const entry={id:'00000000-0000-4000-8000-000000000001',kind:'due' as const,text:'Independent deadline',notes:'Synthetic',date:'2026-11-17'};
function fixture(){const store=new Store(),w=new Workspace(store),p=w.save({name:'Synthetic calendar project',purpose:''});w.items(p.id,p.revision,'steps',[{id:'same',text:'Step',notes:'Keep notes',date:'2026-11-17',time:'09:00',dueDate:'2026-11-18',dueTime:'17:00',workStatus:'needs_input',claim:{id:'attempt',actor:'kai',startedAt:'2026-11-10T12:00:00Z',effectState:'uncertain'},result:{summary:'Keep result',artifacts:[{label:'Keep draft',draftId:'synthetic-draft'}]},reviews:[{id:'review',at:'2026-11-10T12:00:00Z',action:'request_changes',text:'Keep reply'}]}]);w.items(p.id,w.get(p.id).revision,'followUps',[{id:'same',text:'Follow-up',notes:'Legacy',date:'2026-11-17'}]);return {store,w,id:p.id};}
test('task events use composite identity and distinguish Act on from Due without a second stored task',()=>{
 const {store,w,id}=fixture(),p=w.get(id),before=structuredClone(p),calendar=emptyCalendar();
 const events=calendarEvents([p],calendar);assert.equal(events.length,3);assert.equal(new Set(events.map(e=>e.key)).size,3);assert.deepEqual(events.map(e=>e.kind),['action','action','due']);assert.deepEqual(w.get(id),before);assert.equal(store.settings.size,0);
});
test('rescheduling, removing dates, archiving, completion and restoration leave no stale/duplicate events and preserve history',()=>{
 const {w,id}=fixture(),before=w.get(id);let p=before;
 const save=(fn:(t:typeof p.steps[number])=>typeof p.steps[number])=>{w.work(id,p.revision,nextSteps(p).map(e=>e.kind==='steps'?{...e,item:fn(e.item)}:e));p=w.get(id);};
 save(t=>({...t,date:'2026-12-01',time:'14:30'}));let events=calendarEvents([p],emptyCalendar());assert.ok(!events.some(e=>e.task?.text==='Step'&&e.date==='2026-11-17'));assert.equal(events.filter(e=>e.date==='2026-12-01').length,1);assert.ok(p.steps[0].activity?.some(a=>a.summary==='Scheduled action changed from 2026-11-17 at 9:00 AM Eastern to 2026-12-01 at 2:30 PM Eastern'));
 for(const key of ['claim','reviews','result'] as const)assert.deepEqual(p.steps[0][key],before.steps[0][key]);assert.deepEqual(p.followUps,before.followUps);assert.equal(p.steps[0].id,'same');assert.ok(p.steps[0].activity!.length>before.steps[0].activity!.length);
 assert.throws(()=>w.work(id,before.revision,nextSteps(before)),/changed/);
 save(t=>({...t,dueDate:undefined,dueTime:undefined}));assert.equal(calendarEvents([p],emptyCalendar()).length,2);
 save(t=>({...t,archivedAt:new Date().toISOString()}));assert.equal(calendarEvents([p],emptyCalendar()).length,1);
 save(t=>({...t,archivedAt:undefined,completedAt:new Date().toISOString()}));assert.equal(calendarEvents([p],emptyCalendar()).length,1);
 save(t=>({...t,completedAt:undefined}));assert.equal(calendarEvents([p],emptyCalendar()).length,2);
 w.archive(id,p.revision,true);assert.equal(calendarEvents([w.get(id)],emptyCalendar()).length,0);
 w.archive(id,w.get(id).revision,false);assert.equal(calendarEvents([w.get(id)],emptyCalendar()).length,2);
});
test('independent entries persist with guarded revisions; deleting/restoring retains the ID and is included in backups',()=>{
 const store=new Store();changeCalendar(store,{revision:0,entry});const first=readCalendar(store);assert.equal(first.entries.length,1);assert.equal(store.list().length,0);
 assert.throws(()=>changeCalendar(store,{revision:0,entry:{...entry,text:'Stale'}}),/changed/);assert.deepEqual(readCalendar(store),first);
 changeCalendar(store,{revision:1,entry:{...entry,date:'2026-12-01',time:'16:00'}});assert.equal(calendarEvents([],readCalendar(store)).length,1);
 changeCalendar(store,{revision:2,entry:{...entry,deletedAt:'2026-11-17T12:00:00Z'}});assert.equal(calendarEvents([],readCalendar(store)).length,0);
 changeCalendar(store,{revision:3,entry});assert.equal(calendarEvents([],readCalendar(store)).length,1);assert.equal(readCalendar(store).entries[0].id,entry.id);
 const restored=new Store();for(const [key,value] of JSON.parse(JSON.stringify([...store.settings])))restored.setSetting(key,value);assert.deepEqual(readCalendar(restored),readCalendar(store));
 assert.throws(()=>calendarSnapshot.parse({revision:1,entries:[entry,entry]}),/Duplicate/);
 assert.throws(()=>changeCalendar(store,{revision:4,entry:{...entry,id:'bad'}}));
});
test('civil month/week/day navigation handles leap years, month ends, and both DST boundaries in any browser timezone',()=>{
 assert.equal(shiftMonth('2028-01-31',1),'2028-02-29');assert.equal(shiftMonth('2026-12-31',1),'2027-01-31');assert.equal(shiftMonth('2026-03-31',-1),'2026-02-28');
 assert.equal(shiftDate('2027-03-14',1),'2027-03-15');assert.equal(shiftDate('2026-11-01',1),'2026-11-02');
 assert.deepEqual(calendarDays('2026-11-17','day'),['2026-11-17']);assert.deepEqual(calendarDays('2026-11-17','week'),Array.from({length:7},(_,i)=>`2026-11-${15+i}`));
 for(const date of ['2026-02-01','2026-08-31','2028-02-29','2026-12-31']){const days=calendarDays(date,'month');assert.equal(days.length%7,0);assert.equal(new Set(days).size,days.length);assert.ok(days.includes(date));}
 assert.equal(easternDate(new Date('2026-11-18T02:00:00Z')),'2026-11-17');
});
test('due dates validate Eastern time independently and never change readiness; agent updates preserve them',()=>{
 const {store,w,id}=fixture();const task={id:'due',text:'Deadline only',notes:'',dueDate:'2099-12-01',dueTime:'17:00'};assert.equal(taskStatus(task,new Date('2026-11-17T12:00:00Z')),'Ready');
 workItem.parse(task);assert.throws(()=>workItem.parse({...task,dueDate:undefined}));assert.throws(()=>workItem.parse({...task,dueDate:'2027-03-14',dueTime:'02:30'}));assert.throws(()=>workItem.parse({...task,dueDate:'2026-02-30'}));
 assert.equal(easternActionInstant('2026-11-01','01:30'),Date.parse('2026-11-01T05:30:00Z'));
 assert.equal(easternActionInstant('2027-03-14','03:00'),Date.parse('2027-03-14T07:00:00Z'));
 assert.throws(()=>changeCalendar(store,{revision:0,entry:{...entry,date:'2027-03-14',time:'02:30'}}));
 changeCalendar(store,{revision:0,entry:{...entry,date:'2026-11-01',time:'01:30'}});
 const result=new AgentTasks(store).execute({version:1,action:'update',actor:'kai',projectId:id,taskId:'same',kind:'steps',revision:w.get(id).revision,requestId:'preserve-due',claimId:'attempt',patch:{notes:'Agent note'}});assert.equal(result.task.dueDate,'2026-11-18');assert.equal(result.task.dueTime,'17:00');
});
test('calendar and bottom navigation expose named controls and distinct textual event labels',()=>{
 const {w,id}=fixture(),p=w.get(id);const html=renderToStaticMarkup(createElement(CalendarView,{state:{projects:[p],calendar:{revision:1,entries:[entry]}},commit:async()=>{},openProject:()=>{}}));
 assert.match(html,/Calendar view/);for(const label of ['Month','Week','Day','Go to date','New entry','Due date','Scheduled action','Independent entry'])assert.ok(html.includes(label),label);
 assert.match(html,/role="region"/);assert.match(html,/tabindex="0"/);assert.match(html,/aria-pressed="true"/);
 const list=renderToStaticMarkup(createElement(WorkList,{project:p,save:async()=>{},back:()=>{}}));assert.match(list,/Back to projects list/);assert.ok(list.indexOf('Back to projects list')>list.indexOf('Completed work'));assert.match(list,/Due: 2026-11-18 at 5:00 PM Eastern/);
});
