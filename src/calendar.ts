import type {LocalProject,WorkItem} from './compass-types';
import {nextSteps} from './next-steps';
export type CalendarKind='action'|'due';
export interface CalendarEntry {id:string;text:string;notes:string;kind:CalendarKind;date:string;time?:string;deletedAt?:string}
export interface CalendarState {revision:number;entries:CalendarEntry[]}
export interface CalendarEvent {key:string;text:string;notes:string;kind:CalendarKind;date:string;time?:string;entry?:CalendarEntry;project?:LocalProject;task?:WorkItem;storageKind?:'steps'|'followUps'}
export const emptyCalendar=():CalendarState=>({revision:0,entries:[]});
// Derive task events every render. There is no second copy to become stale.
export function calendarEvents(projects:LocalProject[],calendar:CalendarState):CalendarEvent[]{
  const events:CalendarEvent[]=calendar.entries.filter(e=>!e.deletedAt).map(entry=>({...entry,key:`entry:${entry.id}`,entry}));
  for(const project of projects.filter(p=>!p.archivedAt))for(const {kind:storageKind,item:task} of nextSteps(project)){
    if(task.archivedAt||task.completedAt)continue;
    for(const kind of ['action','due'] as const){const date=kind==='action'?task.date:task.dueDate,time=kind==='action'?task.time:task.dueTime;
      if(date)events.push({key:JSON.stringify([project.id,storageKind,task.id,kind]),kind,date,time,text:task.text,notes:task.notes,project,task,storageKind});
    }
  }
  return events.sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'').localeCompare(b.time||'')||a.kind.localeCompare(b.kind)||a.text.localeCompare(b.text)||a.key.localeCompare(b.key));
}
// Calendar arithmetic uses UTC civil dates, independent of browser timezone/DST.
export function shiftDate(date:string,days:number){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function shiftMonth(date:string,months:number){const d=new Date(date+'T12:00:00Z'),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+months);const end=new Date(d);end.setUTCMonth(end.getUTCMonth()+1,0);d.setUTCDate(Math.min(day,end.getUTCDate()));return d.toISOString().slice(0,10);}
export type CalendarView='month'|'week'|'day';
export function calendarDays(date:string,view:CalendarView){
  if(view==='day')return [date];
  const start=view==='month'?date.slice(0,7)+'-01':date;
  const sunday=shiftDate(start,-new Date(start+'T12:00:00Z').getUTCDay());
  const count=view==='week'?7:Math.ceil((new Date(start+'T12:00:00Z').getUTCDay()+new Date(Number(date.slice(0,4)),Number(date.slice(5,7)),0).getDate())/7)*7;
  return Array.from({length:count},(_,i)=>shiftDate(sunday,i));
}
export const civilLabel=(date:string,options:Intl.DateTimeFormatOptions={month:'long',day:'numeric',year:'numeric'})=>new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{...options,timeZone:'UTC'});
export const calendarKindLabel=(kind:CalendarKind)=>kind==='due'?'Due date':'Scheduled action';
