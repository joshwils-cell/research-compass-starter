import {useEffect,useRef,useState} from 'react';
import type {LocalProject,CodexProjectOption,ProjectChatPage,ContextSelection,CodexLink} from './compass-types';
import {call} from './bridge';
import {Modal} from './components/Modal';
const api=()=>window.compass;
const message=(e:unknown)=>e instanceof Error?e.message:String(e);
function ProjectGroup({project,selection,toggle,disabled}:{project:CodexProjectOption|null;selection:ContextSelection;toggle:(kind:'projectIds'|'chatIds',id:string)=>void;disabled:boolean}){
  const [expanded,setExpanded]=useState(false),[archived,setArchived]=useState(false),[page,setPage]=useState<ProjectChatPage>(),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const cache=useRef<Record<string,ProjectChatPage>>({}),epoch=useRef(0),key=String(archived);
  async function load(more=false,refresh=false){
    if(!more&&!refresh&&cache.current[key]){setPage(cache.current[key]);setError('');setLoading(false);return;}
    const current=++epoch.current;setLoading(true);setError('');if(!more)setPage(undefined);
    try{const result=await api().projectChats(project?.id||null,more?page?.nextCursor:undefined,archived);if(current===epoch.current){const next={...result,chats:more?[...(page?.chats||[]),...result.chats.filter(c=>!page?.chats.some(old=>old.id===c.id))]:result.chats};cache.current[key]=next;setPage(next);}}
    catch(e){if(current===epoch.current)setError(message(e));}finally{if(current===epoch.current)setLoading(false);}
  }
  useEffect(()=>{if(expanded)void load();return()=>{epoch.current++;};},[expanded,archived]);
  return <details className="codex-group" onToggle={e=>setExpanded(e.currentTarget.open)}><summary>{project?<label onClick={e=>e.stopPropagation()}><input type="checkbox" aria-label={`Select project ${project.title}`} disabled={disabled} checked={selection.projectIds.includes(project.id)} onChange={()=>toggle('projectIds',project.id)}/><span>{project.title}<small>{project.roots.join(' · ')}</small></span></label>:<span>Chats without a project</span>}<span className="expand-hint">{expanded?'Hide chats':'Show chats'}</span></summary>
    <div className="chat-choices"><label className="choice"><input type="checkbox" checked={archived} disabled={loading||disabled} onChange={e=>setArchived(e.target.checked)}/>Show archived chats</label>
      {loading&&<p role="status">Loading chats…</p>}{error&&<div role="alert" className="error">Could not load chats: {error} <button disabled={loading} onClick={()=>void load(false,true)}>Retry chats</button></div>}
      {!loading&&!error&&page&&!page.chats.length&&<p className="muted">No {archived?'archived ':''}chats in this project.</p>}
      {page?.chats.map(chat=><label className="choice chat-choice" key={chat.id}><input type="checkbox" aria-label={`Select chat ${chat.title}`} disabled={disabled} checked={selection.chatIds.includes(chat.id)} onChange={()=>toggle('chatIds',chat.id)}/><span>{chat.title}<small>Updated {new Date(chat.updatedAt).toLocaleString('en-US',{timeZone:'America/New_York'})}</small></span></label>)}
      {page?.nextCursor&&<button disabled={loading||disabled} onClick={()=>void load(true)}>Load more chats</button>}
    </div>
  </details>;
}
export function LinkDialog({project,close,done,createManually}:{project?:LocalProject;close:()=>void;done:(id?:string)=>Promise<void>;createManually?:()=>void}){
  const [projects,setProjects]=useState<CodexProjectOption[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false),[query,setQuery]=useState(''),[title,setTitle]=useState(''),[url,setUrl]=useState(''),[generation,setGeneration]=useState(0),[syncedAt,setSyncedAt]=useState('');
  const [selection,setSelection]=useState<ContextSelection>({projectIds:[],chatIds:[]}),request=useRef(0),baseRevision=useRef(project?.revision);
  const [refreshRun,setRefreshRun]=useState<{id:string;startedAt:number}|null>(null),[requesting,setRequesting]=useState(false),[refreshMessage,setRefreshMessage]=useState('');
  async function refresh(preserve=false){const current=++request.current;setLoading(true);setError('');try{const {projects:list,chats,syncedAt}=await call('catalog');if(current===request.current){setProjects(list);setSyncedAt(syncedAt||'');setGeneration(v=>v+1);setSelection(previous=>preserve?{projectIds:previous.projectIds.filter(id=>list.some((p:CodexProjectOption)=>p.id===id)),chatIds:previous.chatIds.filter(id=>chats.some((chat:{id:string})=>chat.id===id))}:{projectIds:[],chatIds:[]});return true;}return false;}catch(e){if(current===request.current)setError(message(e));return false;}finally{if(current===request.current)setLoading(false);}}
  useEffect(()=>{void refresh();return()=>{request.current++;};},[]);
  async function refreshFromCodex(){setRequesting(true);setError('');setRefreshMessage('Requesting a fresh list from Codex…');try{const job=await call('requestCatalogRefresh');setRefreshRun({id:job.id,startedAt:Date.now()});}catch(e){setError(message(e));setRefreshMessage('');}finally{setRequesting(false);}}
  useEffect(()=>{
    if(!refreshRun)return;let active=true,timer:ReturnType<typeof setTimeout>;
    async function check(){
      try{
        const status=await call('catalogRefreshStatus',refreshRun!.id);if(!active)return;
        if(status.status==='completed'){const loaded=await refresh(true);if(active){setRefreshMessage(loaded?'Updated from Codex. The latest projects and conversations are now shown.':'Codex refreshed, but this view could not reload. Close and reopen this window to try again.');setRefreshRun(null);}return;}
        if(['failed','expired','superseded'].includes(status.status)){setError(status.error||'This refresh did not complete. Turn on your computer and try again.');setRefreshMessage('');setRefreshRun(null);return;}
        if(Date.now()-refreshRun!.startedAt>90_000){setRefreshMessage(status.status==='working'?'Codex is still refreshing. You can close and reopen this window shortly to see the updated list.':'The refresh is still queued. Keep your computer on and signed in, then try again shortly. Your saved list is still available.');setRefreshRun(null);return;}
        setRefreshMessage(status.status==='working'?'Refreshing projects and conversations from Codex…':status.runnerOnline?'Refresh requested. Waiting for Codex…':'Waiting for your computer to connect. It must be on and signed in to refresh from Codex.');
      }catch(e){if(!active)return;setError(`Could not check the refresh: ${message(e)}`);setRefreshMessage('Your saved list is still available.');setRefreshRun(null);return;}
      if(active)timer=setTimeout(()=>void check(),2000);
    }
    void check();return()=>{active=false;clearTimeout(timer);};
  },[refreshRun]);
  const toggle=(kind:'projectIds'|'chatIds',id:string)=>setSelection(s=>({...s,[kind]:s[kind].includes(id)?s[kind].filter(v=>v!==id):[...s[kind],id]}));
  async function run(fn:()=>Promise<void>){setBusy(true);setError('');try{await fn();}catch(e){setError(message(e));}finally{setBusy(false);}}
  return <Modal title={project?'Link Codex context':createManually?'New project':'Import or link Codex context'} close={close}>
    {createManually?<><p>Select a saved Codex project below, or create one manually.</p><button type="button" disabled={busy} onClick={createManually}>Create a project manually</button></>:<p>Select a project, expand it to choose associated chats, or select both. Project selection does not select its chats automatically.</p>}
    <div className="section-heading"><h3>Available Codex projects</h3><button disabled={loading||busy||requesting||!!refreshRun} onClick={()=>void refreshFromCodex()}>{requesting||refreshRun?'Refresh requested…':'Refresh from Codex'}</button></div>
    {refreshMessage&&<p className="muted" role="status">{refreshMessage}</p>}
    <p className="muted">{syncedAt?`Last synced ${new Date(syncedAt).toLocaleString('en-US',{timeZone:'America/New_York'})} Eastern. Saved list works while your computer is off; updates sync when it is on.`:'No catalog has synced yet. The desktop sync helper will populate it.'}</p><label>Find a Codex project<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search project names"/></label>
    {loading&&<p role="status">Loading Codex projects…</p>}{error&&<p role="alert" className="error">{error}</p>}
    <div className="project-tree" aria-label="Codex projects and chats">{projects.filter(p=>p.title.toLowerCase().includes(query.toLowerCase())).map(p=><ProjectGroup key={`${generation}-${p.id}`} project={p} selection={selection} toggle={toggle} disabled={busy||loading}/>)}{!query&&!createManually&&<ProjectGroup key={`unassigned-${generation}`} project={null} selection={selection} toggle={toggle} disabled={busy||loading}/>}</div>
    {!loading&&!projects.filter(p=>p.title.toLowerCase().includes(query.toLowerCase())).length&&<p className="muted">{query?'No matching projects.':createManually?'No saved Codex projects yet. You can create a project manually.':'No projects found. You can still check unassigned chats or save a URL.'}</p>}
    <p className="muted">Selected: {selection.projectIds.length} projects · {selection.chatIds.length} chats. {createManually?'Expand a project to choose chats. Existing projects reopen with their saved work. Saves references only; files and chat messages stay in Codex.':'Only project names, chat titles, dates, and references are saved. Files and chat messages are not transferred.'}</p>
    <footer className="context-footer"><button type="button" onClick={close}>Cancel</button><button className="primary" disabled={busy||loading||!selection.projectIds.length&&!selection.chatIds.length} onClick={()=>void run(async()=>{const ids=await api().selectContext(selection,project?.id,baseRevision.current);await done(ids[0]);close();})}>{busy?'Saving…':project?'Link selected context':createManually?'Add selected projects':'Import selected context'}</button></footer>
    {!createManually&&<details><summary>Use a project URL instead</summary><form onSubmit={e=>{e.preventDefault();void run(async()=>{if(project){await api().link(project.id,baseRevision.current!,{title,url,kind:'project'});await done(project.id);}else await done(await api().importProject(title,url));close();});}}><label>Codex project name<input required maxLength={160} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Project URL<input required type="url" placeholder="https://…" value={url} onChange={e=>setUrl(e.target.value)}/></label><button disabled={busy}>Save project link</button></form></details>}
  </Modal>;
}
export function SavedContext({links,unlink}:{links:CodexLink[];unlink:(id:string)=>void}){
  const groups=new Map<string,{title:string;links:CodexLink[]}>(),other:CodexLink[]=[];
  for(const link of links){const key=link.kind==='project'?link.projectId:link.parentProjectId;if(!key){other.push(link);continue;}if(!groups.has(key))groups.set(key,{title:link.kind==='project'?link.title:link.parentProjectTitle||'Codex project',links:[]});const g=groups.get(key)!;if(link.kind==='project')g.title=link.title;g.links.push(link);}
  const row=(link:CodexLink)=><li key={link.id}><div><strong>{link.title}</strong><small>{link.kind==='project'?'Project reference':'Chat reference'}</small>{link.roots?.map(root=><small key={root}>{root}</small>)}{link.url&&<button className="text-link" onClick={()=>void api().openLink(link.url!).catch(e=>window.alert(message(e)))}>{link.url} ↗</button>}</div><button onClick={()=>unlink(link.id)}>Unlink</button></li>;
  return <>{[...groups].map(([key,g])=><details className="saved-context-group" key={key}><summary>{g.title} <small>({g.links.filter(l=>l.kind==='conversation').length} selected chats)</small></summary><ul className="links">{g.links.map(row)}</ul></details>)}{!!other.length&&<details open><summary>Other saved references</summary><ul className="links">{other.map(row)}</ul></details>}</>;
}
