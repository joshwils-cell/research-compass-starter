import type {WorkItem} from './compass-types';
const easternClock=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function easternActionInstant(date:string,time='00:00'):number|undefined{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return;
  const wall=Date.parse(`${date}T${time}:00Z`);if(!Number.isFinite(wall))return;
  // The first occurrence is used when the fall-back hour repeats.
  for(const offset of [4,5]){
    const instant=wall+offset*3600000,parts=easternClock.formatToParts(instant);
    const get=(type:string)=>parts.find(part=>part.type===type)?.value;
    if(`${get('year')}-${get('month')}-${get('day')}`===date&&`${get('hour')}:${get('minute')}`===time)return instant;
  }
}
export const actionInstant=(item:Pick<WorkItem,'date'|'time'>)=>item.date?easternActionInstant(item.date,item.time):undefined;
export function actionLabel(item:Pick<WorkItem,'date'|'time'>){
  if(!item.date)return '';
  if(!item.time)return item.date;
  const [hours,minutes]=item.time.split(':').map(Number);
  return `${item.date} at ${hours%12||12}:${String(minutes).padStart(2,'0')} ${hours<12?'AM':'PM'} Eastern`;
}
export function easternDate(now=new Date()):string{
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part=(type:string)=>parts.find(p=>p.type===type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function taskStatus(item:WorkItem,now=new Date()){
  if(item.completedAt)return 'Done';
  if(item.workStatus==='working')return 'Working';
  if(item.workStatus==='awaiting_review')return 'Awaiting review';
  if(item.workStatus==='needs_input')return 'Needs input';
  if(item.pendingReviewId&&item.reviews?.some(r=>r.id===item.pendingReviewId&&r.action!=='approve_finish'))return 'Ready';
  const scheduled=actionInstant(item);
  return scheduled!==undefined&&scheduled>now.getTime()?'Scheduled':'Ready';
}
export const assigneeName=(value?:string)=>value==='kai'?'Kai':value==='codex'?'Codex':'Me';
