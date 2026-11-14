import type {LocalProject,WorkItem} from './compass-types';
import {assigneeName,actionInstant} from './task-status';

export const workSortOptions=[
  {value:'act-asc',label:'Act on date/time — earliest first'},
  {value:'act-desc',label:'Act on date/time — latest first'},
  {value:'assigned-asc',label:'Date assigned — oldest first'},
  {value:'assigned-desc',label:'Date assigned — newest first'},
  {value:'project',label:'Project name — A to Z'},
] as const;
export type WorkSort=typeof workSortOptions[number]['value'];
export const isWorkSort=(value:unknown):value is WorkSort=>workSortOptions.some(option=>option.value===value);
export interface AssignedTask {project:LocalProject;kind:'steps'|'followUps';item:WorkItem}
export interface SortedAssignedTask extends AssignedTask {assignedAt?:string}

// Older activity did not distinguish assignment changes from other edits.
// Only explicit assignment events establish the date for the current assignee.
export function assignmentDate(item:WorkItem):string|undefined{
  const event=item.activity?.findLast(event=>['Assigned to Me','Assigned to Kai','Assigned to Codex'].includes(event.summary));
  return event?.summary===`Assigned to ${assigneeName(item.assignee)}`&&Number.isFinite(Date.parse(event.at))?event.at:undefined;
}

export function sortAssignedWork(tasks:AssignedTask[],sort:WorkSort):SortedAssignedTask[]{
  const rows=tasks.map(task=>{const assignedAt=assignmentDate(task.item);return {...task,assignedAt,sortDate:sort.startsWith('assigned-')?(assignedAt?Date.parse(assignedAt):undefined):actionInstant(task.item)};});
  return rows.sort((a,b)=>{
    if(sort!=='project'){
      if(a.sortDate===undefined&&b.sortDate!==undefined)return 1;
      if(a.sortDate!==undefined&&b.sortDate===undefined)return -1;
      if(a.sortDate!==undefined&&b.sortDate!==undefined){
        const difference=a.sortDate-b.sortDate;
        if(difference)return sort.endsWith('-desc')?-difference:difference;
      }
    }
    return a.project.name.localeCompare(b.project.name)||a.item.text.localeCompare(b.item.text)||a.project.id.localeCompare(b.project.id)||a.kind.localeCompare(b.kind)||a.item.id.localeCompare(b.item.id);
  });
}
