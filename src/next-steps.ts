import type {LocalProject,WorkItem} from './compass-types';

// Keep the original list and ID for existing agent references and history.
export interface NextStep {kind:'steps'|'followUps';item:WorkItem}
export const nextStepKey=({kind,item}:NextStep)=>`${kind}:${item.id}`;
export function nextSteps(project:LocalProject):NextStep[]{
  const entries=(['steps','followUps'] as const).flatMap(kind=>project[kind].map(item=>({kind,item})));
  const order=new Map((project.nextStepOrder||[]).map((key,index)=>[key,index]));
  return entries.sort((a,b)=>(order.get(nextStepKey(a))??order.size)-(order.get(nextStepKey(b))??order.size));
}
