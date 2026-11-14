import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Store } from './store';
import {workItem,taskActivity} from './task-schema';
import {actionLabel} from '../src/task-status';
import {nextSteps,nextStepKey} from '../src/next-steps';
import type { LocalProject, HandoffInput, CodexLink, CodexProjectOption, WorkItem } from '../src/compass-types';

export const linkInput = z.object({ id:z.string().max(200).optional(), title:z.string().trim().min(1).max(500), kind:z.enum(['project','conversation']), url:z.string().url().refine(s=>new URL(s).protocol==='https:','Use an HTTPS link.').optional(),projectId:z.string().min(1).max(200).optional(),parentProjectId:z.string().max(200).optional(),parentProjectTitle:z.string().max(500).optional(),roots:z.array(z.string().max(4000)).max(100).optional() });
export const handoffInput = z.object({stepIds:z.array(z.string()).max(1000),followUpIds:z.array(z.string()).max(1000),linkIds:z.array(z.string()).max(100),references:z.array(z.string().trim().min(1).max(4000)).max(100),outcome:z.string().trim().min(1).max(20000),instructions:z.string().max(50000),target:z.enum(['kai','codex']).optional()}).refine(v=>v.stepIds.length+v.followUpIds.length>0,'Choose a next step.');
const migrationKey = 'local-workspace-v1';

// Full logical snapshot is written while holding the SQLite write lock, before
// any migration mutation. It includes raw JSON, history, requests and settings.
export function migrateWorkspace(store:Store) {}
export class Workspace {
  constructor(public store:Store){migrateWorkspace(store);}
  state(){return {projects:this.store.list() as LocalProject[],backupPath:this.store.setting<{backupPath:string}>(migrationKey)?.backupPath};}
  get(id:string){return this.store.get(id) as LocalProject;}
  change(id:string,revision:number,fn:(p:LocalProject)=>LocalProject){
    this.store.transaction(()=>{const p=this.get(id);if(p.revision!==revision)throw new Error('This project changed in another window. Reopen it before saving.');this.store.put({...fn(p),revision:p.revision+1,pendingId:undefined});});
  }
  save(value:unknown){
    const input=z.object({id:z.string().uuid().optional(),revision:z.number().int().optional(),name:z.string().trim().min(1).max(160),purpose:z.string().max(50000)}).parse(value);
    if(input.id){if(input.revision===undefined)throw new Error('Project revision required.');this.change(input.id,input.revision,p=>({...p,name:input.name,purpose:input.purpose}));return this.get(input.id);}
    const p:LocalProject={id:randomUUID(),name:input.name,purpose:input.purpose,createdAt:new Date().toISOString(),revision:1,localVersion:1,steps:[],followUps:[],codexLinks:[],folders:[],extensions:[],exclusions:[],threads:[],imports:[],pins:[],snapshots:[]};
    this.store.put(p);return p;
  }
  items(id:string,revision:number,kind:'steps'|'followUps',value:unknown){
    const items=z.array(workItem).max(2000).parse(value);if(new Set(items.map(i=>i.id)).size!==items.length)throw new Error('Duplicate item IDs.');
    this.change(id,revision,p=>{if(p.archivedAt)throw new Error('Restore this project before editing work.');return {...p,[kind]:items.map(item=>{const previous=p[kind].find(i=>i.id===item.id);return JSON.stringify(previous)===JSON.stringify(item)?item:taskActivity(previous,item,'me',previous?'Updated task':'Created task');})};});
  }
  archive(id:string,revision:number,archived:boolean){this.change(id,revision,p=>({...p,archivedAt:archived?new Date().toISOString():undefined}));}
  work(id:string,revision:number,value:unknown){
    // Validate without stripping existing metadata, including nested result details.
    const preservedItem=z.custom<WorkItem>(item=>workItem.safeParse(item).success,'Invalid next step.');
    const entries=z.array(z.object({kind:z.enum(['steps','followUps']),item:preservedItem})).max(4000).parse(value);
    if(new Set(entries.map(nextStepKey)).size!==entries.length)throw Error('Duplicate item IDs.');
    if(['steps','followUps'].some(kind=>entries.filter(e=>e.kind===kind).length>2000))throw Error('This project already has 2000 items in this list.');
    this.change(id,revision,p=>{
      if(p.archivedAt)throw Error('Restore this project before editing work.');
      const keys=new Set(entries.map(nextStepKey));
      if(nextSteps(p).some(e=>!keys.has(nextStepKey(e))))throw Error('A saved next step is missing. Refresh before saving; archive items to hide them.');
      const lists={steps:[] as LocalProject['steps'],followUps:[] as LocalProject['followUps']};
      for(const {kind,item} of entries){
        const previous=p[kind].find(i=>i.id===item.id);
        lists[kind].push(JSON.stringify(previous)===JSON.stringify(item)?item:taskActivity(previous,item,'me',previous?'Updated task':'Created task'));
      }
      return {...p,...lists,nextStepOrder:entries.map(nextStepKey)};
    });
  }
  link(id:string,revision:number,value:unknown){const link=linkInput.parse(value);if(link.kind==='project'&&!link.url&&!link.projectId)throw new Error('Choose a Codex project or provide a URL.');if(link.kind==='conversation'&&!link.id)throw new Error('Choose a conversation.');this.change(id,revision,p=>{const next:CodexLink={...link,id:link.projectId?`codex-project:${link.projectId}`:link.id||link.url!};const duplicate=p.codexLinks.some(l=>l.id===next.id||next.url&&l.url===next.url);return duplicate?p:{...p,codexLinks:[...p.codexLinks,next]};});}
  importCodexProject(project:CodexProjectOption){
    const link=linkInput.parse({id:`codex-project:${project.id}`,projectId:project.id,title:project.title,roots:project.roots,kind:'project'});
    return this.store.transaction(()=>{
      const existing=this.state().projects.find(p=>p.codexLinks.some(l=>l.projectId===project.id));
      if(existing)return existing.id;
      const p=this.save({name:link.title.slice(0,160),purpose:''});
      this.store.put({...p,codexLinks:[{...link,id:link.id!}]} as LocalProject);return p.id;
    });
  }
  unlink(id:string,revision:number,linkId:string){this.change(id,revision,p=>({...p,codexLinks:p.codexLinks.filter(l=>l.id!==linkId)}));}
  importConversation(thread:{id:string;title:string}){
    const existing=this.state().projects.find(p=>p.codexLinks.some(l=>l.kind==='conversation'&&l.id===thread.id)||p.threads.some(t=>t.id===thread.id));
    if(existing)return existing.id;
    // A single transaction prevents duplicate entries across concurrent imports.
    return this.store.transaction(()=>{const p=this.save({name:thread.title.slice(0,160)||'Codex conversation',purpose:''});const next:LocalProject={...p,codexLinks:[{...thread,kind:'conversation'}]};this.store.put(next);return p.id;});
  }
  importProject(title:string,url:string){
    const link=linkInput.parse({title,url,kind:'project'});
    return this.store.transaction(()=>{
      const existing=this.state().projects.find(p=>p.codexLinks.some(l=>l.url===link.url));
      if(existing)return existing.id;
      const p=this.save({name:link.title.slice(0,160),purpose:''});const next:LocalProject={...p,codexLinks:[{id:link.url!,title:link.title,kind:'project',url:link.url}]};this.store.put(next);return p.id;
    });
  }
  selectContext(groups:{project?:CodexProjectOption;links:CodexLink[]}[],localId?:string,revision?:number){
    const parsed=groups.map(g=>({...g,links:g.links.map(l=>({...linkInput.parse(l),id:l.id}))}));
    const merge=(a:CodexLink[],b:CodexLink[])=>[...a,...b.filter(l=>!a.some(old=>old.id===l.id))];
    if(localId){if(revision===undefined)throw new Error('Project revision required.');this.change(localId,revision,p=>({...p,codexLinks:merge(p.codexLinks,parsed.flatMap(g=>g.links))}));return [localId];}
    return this.store.transaction(()=>parsed.map(group=>{
      const source=group.project?.id;
      const entries=this.state().projects;
      const old=source?(entries.find(p=>p.sourceCodexProjectId===source)||entries.find(p=>p.codexLinks.some(l=>l.projectId===source))):entries.find(p=>group.links.some(l=>p.codexLinks.some(old=>old.id===l.id)));
      const p=old||this.save({name:(group.project?.title||group.links[0]?.title||'Codex context').slice(0,160),purpose:''});
      this.store.put({...p,sourceCodexProjectId:source||p.sourceCodexProjectId,codexLinks:merge(p.codexLinks,group.links),revision:p.revision+1} as LocalProject);return p.id;
    }));
  }
  history(id:string){
    const p=this.get(id);const rows=this.store.historyRows.filter(r=>r.project_id===id).reverse();
    // Original fields are retained, including all corrections, conversations,
    // snapshots and completed pins. No generated action becomes a local task.
    const {steps,followUps,codexLinks,localVersion,...legacy}=p;
    return JSON.stringify({project:legacy,briefingHistory:rows.map(r=>JSON.parse(r.data as string))},null,2);
  }
  prepare(id:string,value:unknown){return handoff(this.get(id),handoffInput.parse(value));}
}
export function handoff(p:LocalProject,input:HandoffInput){
  const choose=<T extends {id:string}>(items:T[],ids:string[])=>[...new Set(ids)].map(id=>{const item=items.find(i=>i.id===id);if(!item)throw new Error('A selected item is no longer available. Reopen the handoff.');return item;});
  const steps=choose(p.steps,input.stepIds),followUps=choose(p.followUps,input.followUpIds),links=choose(p.codexLinks,input.linkIds);
  if([...steps,...followUps].some(s=>s.archivedAt||s.completedAt))throw new Error('Choose current next steps.');
  const lines=[`# Task for ${input.target==='kai'?'Kai':'Codex'}: ${p.name}`,'',`Project ID: ${p.id}`,'','## Project description',p.purpose||'(No description provided.)','','## Intended destination'];
  lines.push(...(links.length?links.map(l=>`- ${l.kind==='project'?'Project':'Conversation'}: ${l.title}${l.url?` — ${l.url}`:` (reference ID: ${l.projectId||l.id})`}${l.roots?.length?`\n  Project location: ${l.roots.join('; ')}`:''}`):['No linked destination selected. Choose the destination in Codex.']));
  const selected=nextSteps(p).filter(e=>(e.kind==='steps'?input.stepIds:input.followUpIds).includes(e.item.id));
  lines.push('','## Selected next steps',...selected.flatMap(({kind,item:s},i)=>[`${i+1}. ${s.text}`,`   Task ID: ${s.id} (${kind}); For: ${s.assignee||'me'}${s.date?`; Act on: ${actionLabel(s)} (America/New_York)`:''}${s.actionKind==='email'?`; Gmail draft account: ${s.emailAccount||'you@example.com'}`:''}`,...(s.notes?[`   Notes: ${s.notes.replaceAll('\n','\n   ')}`]:[])]));
  lines.push('','## File references (no files attached)','These are references only. No file bytes are included. A path, URL or linked project does not establish file access. Ask for any files you cannot access.');
  lines.push(...(input.references.length?input.references.map(r=>`- ${r}`):['No file references selected.']));
  lines.push('','## Execution guidance','Work only when asked. Email tasks produce unsent drafts for review. Default Gmail account: you@example.com. Record results through the Research Compass task interface; preparing this handoff does not change task status.','','## Requested outcome',input.outcome);
  if(input.instructions.trim())lines.push('','## Additional instructions',input.instructions);
  lines.push('','Preparing or exporting this handoff does not complete the local tasks.');return lines.join('\n')+'\n';
}
