import {z} from 'zod';
import type {WorkItem,Assignee} from '../src/compass-types';
import {assigneeName,easternActionInstant,actionLabel} from '../src/task-status';
export const actionDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s);
export const actionTime=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const taskResult=z.object({summary:z.string().trim().min(1).max(50000),artifacts:z.array(z.object({label:z.string().min(1).max(500),url:z.string().url().refine(s=>new URL(s).protocol==='https:').optional(),draftId:z.string().min(1).max(500).optional(),emailAccount:z.string().email().optional()})).max(100)});
const taskClaim=z.object({id:z.string(),actor:z.enum(['kai','codex']),startedAt:z.string().datetime(),effectState:z.enum(['not_started','started','uncertain'])});
const taskReview=z.object({id:z.string(),at:z.string().datetime(),action:z.enum(['request_changes','approve_continue','approve_finish']),text:z.string().max(10000),result:taskResult.optional(),previousClaim:taskClaim.optional()});
export const workItem=z.object({id:z.string().min(1).max(200),text:z.string().trim().min(1).max(20000),notes:z.string().max(50000),date:actionDate.optional(),time:actionTime.optional(),dueDate:actionDate.optional(),dueTime:actionTime.optional(),completedAt:z.string().datetime().optional(),archivedAt:z.string().datetime().optional(),assignee:z.enum(['me','kai','codex']).optional(),workStatus:z.enum(['working','awaiting_review','needs_input']).optional(),actionKind:z.enum(['task','email']).optional(),emailAccount:z.string().email().optional(),result:taskResult.optional(),reviews:z.array(taskReview).max(500).optional(),pendingReviewId:z.string().optional(),claim:taskClaim.optional(),activity:z.array(z.object({at:z.string().datetime(),actor:z.enum(['me','kai','codex']),summary:z.string().max(2000)})).max(2000).optional()}).refine(item=>!item.time||!!item.date&&easternActionInstant(item.date,item.time)!==undefined,{message:'Choose a date and a valid Eastern time. This time may not exist during the spring daylight-saving change.',path:['time']}).refine(item=>!item.dueTime||!!item.dueDate&&easternActionInstant(item.dueDate,item.dueTime)!==undefined,{message:'Choose a due date and a valid Eastern time.',path:['dueTime']});
export function taskActivity(before:WorkItem|undefined,after:WorkItem,actor:Assignee,summary:string):WorkItem{
  const at=new Date().toISOString(),events=[{at,actor,summary}];
  if(before)for(const kind of ['action','due'] as const){
    const prior=kind==='action'?{date:before.date,time:before.time}:{date:before.dueDate,time:before.dueTime};
    const next=kind==='action'?{date:after.date,time:after.time}:{date:after.dueDate,time:after.dueTime};
    if(prior.date!==next.date||prior.time!==next.time)events.push({at,actor,summary:`${kind==='action'?'Scheduled action':'Due date'} changed from ${actionLabel(prior)||'no date'} to ${actionLabel(next)||'no date'}`});
  }
  if(!before||(before.assignee||'me')!==(after.assignee||'me'))events.push({at,actor,summary:`Assigned to ${assigneeName(after.assignee)}`});
  return {...after,activity:[...(before?.activity||[]),...events].slice(-2000)};
}
