import {z} from 'zod';
import {actionDate,actionTime} from './task-schema';
import {easternActionInstant} from '../src/task-status';
import {emptyCalendar,type CalendarState} from '../src/calendar';
import type {Store} from './store';
const key='calendar-v1';
export const calendarEntry=z.object({id:z.string().uuid(),text:z.string().trim().min(1).max(20000),notes:z.string().max(50000),kind:z.enum(['action','due']),date:actionDate,time:actionTime.optional(),deletedAt:z.string().datetime().optional()}).refine(e=>!e.time||easternActionInstant(e.date,e.time)!==undefined,'Choose a valid Eastern time. This time may not exist during the spring daylight-saving change.');
export const calendarSnapshot=z.object({revision:z.number().int().nonnegative(),entries:z.array(calendarEntry).max(5000)}).refine(c=>new Set(c.entries.map(e=>e.id)).size===c.entries.length,'Duplicate calendar IDs.');
export function readCalendar(store:Store):CalendarState{return structuredClone(store.setting<CalendarState>(key)||emptyCalendar());}
export function changeCalendar(store:Store,value:unknown){
  const parsed=z.object({revision:z.number().int().nonnegative(),entry:calendarEntry}).safeParse(value);
  if(!parsed.success)throw Error(parsed.error.issues[0]?.message||'Invalid calendar entry.');
  const input=parsed.data,current=readCalendar(store);
  if(input.revision!==current.revision)throw Error('Calendar changed in another window. Refresh before saving.');
  const exists=current.entries.some(e=>e.id===input.entry.id);
  if(!exists&&input.entry.deletedAt)throw Error('Calendar entry not found.');
  if(!exists&&current.entries.length>=5000)throw Error('Calendar entry limit reached.');
  const next={revision:current.revision+1,entries:exists?current.entries.map(e=>e.id===input.entry.id?input.entry:e):[...current.entries,input.entry]};
  store.setSetting(key,next);return next;
}
