import {useEffect,useState} from 'react';
import {ArrowUp,ArrowDown,Plus} from 'lucide-react';
import type {Assignee,LocalProject,WorkItem,ReviewInput} from './compass-types';
import {taskStatus,assigneeName,actionLabel} from './task-status';
import {isWorkSort,sortAssignedWork,workSortOptions,type WorkSort} from './assigned-work';
import {Modal} from './components/Modal';
import {nextSteps,nextStepKey,type NextStep} from './next-steps';
import {canReview,pendingReview,reviewLabels} from './task-review';
import {ReviewForm} from './TaskReview';
const message=(e:unknown)=>e instanceof Error?e.message:String(e);
function ResultDetails({result,item}:{result:NonNullable<WorkItem['result']>;item:WorkItem}){
  return <><p>{result.summary}</p>{result.artifacts.map((a,n)=><div key={n}>{a.url?<button className="text-link" onClick={()=>void window.compass.openLink(a.url!).catch(e=>window.alert(message(e)))}>{a.label} ↗</button>:<span>{a.label}</span>}{a.draftId&&<small>Draft ID: {a.draftId} · {a.emailAccount||item.emailAccount||'you@example.com'}</small>}</div>)}</>;
}
export function TaskDetails({item}:{item:WorkItem}){
  const response=pendingReview(item);
  return <>{item.result&&<div className="task-result"><strong>Latest result</strong><ResultDetails result={item.result} item={item}/></div>}
    {response&&<p className="response-queued" role="status">{item.workStatus==='working'?'The agent is working from your response.':!item.workStatus?'Your response is queued for the agent’s next check.':`Your response: ${reviewLabels[response.action]}.`}</p>}
    {!!item.reviews?.length&&<details className="task-response-history"><summary>Responses and reviewed results ({item.reviews.length})</summary><ol>{item.reviews.map(review=><li key={review.id}><strong>You · {reviewLabels[review.action]}</strong><small>{new Date(review.at).toLocaleString('en-US',{timeZone:'America/New_York'})} Eastern</small>{review.text&&<p className="review-text">{review.text}</p>}{review.result&&<details><summary>Result you reviewed</summary><ResultDetails result={review.result} item={item}/></details>}</li>)}</ol></details>}
    {!!item.activity?.length&&<details className="task-activity"><summary>Activity ({item.activity.length})</summary><ul>{item.activity.slice(-10).reverse().map((a,n)=><li key={n}><strong>{assigneeName(a.actor)}</strong> · {new Date(a.at).toLocaleString('en-US',{timeZone:'America/New_York'})}<br/>{a.summary}</li>)}</ul></details>}
  </>;
}
function ItemForm({item,close,save}:{item?:WorkItem;close:()=>void;save:(item:WorkItem)=>Promise<void>}){
  const [text,setText]=useState(item?.text||''),[notes,setNotes]=useState(item?.notes||''),[date,setDate]=useState(item?.date||''),[time,setTime]=useState(item?.time||''),[dueDate,setDueDate]=useState(item?.dueDate||''),[dueTime,setDueTime]=useState(item?.dueTime||''),[assignee,setAssignee]=useState<Assignee>(item?.assignee||'me'),[email,setEmail]=useState(item?.actionKind==='email'),[account,setAccount]=useState(item?.emailAccount||'you@example.com'),[status,setStatus]=useState(item?.workStatus||'ready'),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  return <Modal title={`${item?'Edit':'Add'} next step`} close={close}><form onSubmit={async e=>{e.preventDefault();setBusy(true);try{
    if(item?.claim&&status==='ready')throw new Error('This task has an agent attempt. Ask the agent to reconcile its result before resetting it.');
    await save({...item,id:item?.id||crypto.randomUUID(),text,notes,date:date||undefined,time:date?time||undefined:undefined,dueDate:dueDate||undefined,dueTime:dueDate?dueTime||undefined:undefined,assignee,actionKind:email?'email':'task',emailAccount:email?account:undefined,workStatus:status==='ready'?undefined:status as WorkItem['workStatus']});close();
  }catch(e){setError(message(e));}finally{setBusy(false);}}}>
    <label>Next step<textarea aria-label="Next step" autoFocus required rows={3} maxLength={20000} value={text} onChange={e=>setText(e.target.value)}/></label>
    <label>Notes (optional)<textarea aria-label="Notes (optional)" rows={3} maxLength={50000} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
    <div className="form-columns"><label>For<select aria-label="For" value={assignee} onChange={e=>setAssignee(e.target.value as Assignee)}><option value="me">Me</option><option value="kai">Kai</option><option value="codex">Codex</option></select></label><label>Act on (optional)<input type="date" value={date} onChange={e=>{setDate(e.target.value);if(!e.target.value)setTime('');}}/></label><label>Time (Eastern, optional)<input type="time" step={60} disabled={!date} value={time} onChange={e=>setTime(e.target.value)}/></label></div>
    <div className="form-columns"><label>Due date (optional)<input type="date" value={dueDate} onChange={e=>{setDueDate(e.target.value);if(!e.target.value)setDueTime('');}}/></label><label>Due time (Eastern, optional)<input type="time" step={60} disabled={!dueDate} value={dueTime} onChange={e=>setDueTime(e.target.value)}/></label></div><p className="muted">Due dates are deadlines and do not change readiness.</p>
    <p className="muted">Dates and times use Eastern time. During the repeated fall hour, the first occurrence is used. Assigned work starts only when you ask Kai or Codex.</p>
    <label className="choice"><input type="checkbox" checked={email} onChange={e=>setEmail(e.target.checked)}/>Email task — prepare an unsent draft for review</label>
    {email&&<label>Gmail account<input type="email" required value={account} onChange={e=>setAccount(e.target.value)} list="gmail-accounts"/><datalist id="gmail-accounts"><option value="you@example.com"/><option value="you+alternate@example.com"/></datalist></label>}
    {item&&!item.completedAt&&<label>Work status<select aria-label="Work status" value={status} onChange={e=>setStatus(e.target.value)}><option value="ready">Ready / scheduled by date and time</option>{item.workStatus==='working'&&<option value="working">Working</option>}<option value="awaiting_review">Awaiting review</option><option value="needs_input">Needs input</option></select></label>}
    {error&&<p role="alert" className="error">{error}</p>}<footer><button type="button" onClick={close}>Cancel</button><button className="primary" disabled={busy||!text.trim()}>Save step</button></footer>
  </form></Modal>;
}
export function WorkList({project,save,review,back}:{project:LocalProject;save:(items:NextStep[],revision:number)=>Promise<void>;review?:(input:ReviewInput)=>Promise<void>;back?:()=>void}){
  const [editor,setEditor]=useState<{entry?:NextStep;items:NextStep[];revision:number}|null>(null),[error,setError]=useState('');
  const items=nextSteps(project),active=items.filter(e=>!e.item.completedAt&&!e.item.archivedAt),completed=items.filter(e=>e.item.completedAt&&!e.item.archivedAt),archived=items.filter(e=>e.item.archivedAt);
  const persist=async(value:NextStep[])=>{setError('');try{await save(value,project.revision);}catch(e){setError(message(e));}};
  const update=(entry:NextStep,item:WorkItem)=>persist(items.map(e=>nextStepKey(e)===nextStepKey(entry)?{...e,item}:e));
  function move(entry:NextStep,offset:number){const n=active.findIndex(e=>nextStepKey(e)===nextStepKey(entry)),other=active[n+offset];if(!other)return;const result=[...items],a=result.findIndex(e=>nextStepKey(e)===nextStepKey(entry)),b=result.findIndex(e=>nextStepKey(e)===nextStepKey(other));[result[a],result[b]]=[result[b],result[a]];void persist(result);}
  const edit=(entry?:NextStep)=>setEditor({entry,items,revision:project.revision});
  function row(entry:NextStep,index:number,state:'active'|'completed'|'archived'){
    const {item}=entry;
    return <li key={nextStepKey(entry)} className={`work-item ${state}`}><div className="work-main">
      {state!=='archived'&&<input type="checkbox" aria-label={`${item.completedAt?'Reopen':'Complete'} ${item.text}`} checked={!!item.completedAt} disabled={!!project.archivedAt} onChange={()=>void update(entry,{...item,completedAt:item.completedAt?undefined:new Date().toISOString(),claim:undefined,workStatus:undefined})}/>}
      <div className="work-copy"><p>{item.text}</p>{item.notes&&<p className="notes">{item.notes}</p>}<div className="task-meta"><span className={`task-status status-${taskStatus(item).toLowerCase().replaceAll(' ','-')}`}>{taskStatus(item)}</span>{item.date&&<span className="date">Act on: {actionLabel(item)}</span>}{item.dueDate&&<span className="date">Due: {actionLabel({date:item.dueDate,time:item.dueTime})}</span>}{item.actionKind==='email'&&<span className="date">Email draft · {item.emailAccount||'you@example.com'}</span>}{item.completedAt&&<span className="date">Completed {new Date(item.completedAt).toLocaleDateString()}</span>}</div><TaskDetails item={item}/>{!project.archivedAt&&review&&canReview(item)&&<ReviewForm item={item} kind={entry.kind} save={review}/>}</div>
      {state==='active'&&<label className="select-task">For<select aria-label={`For ${item.text}`} value={item.assignee||'me'} disabled={!!project.archivedAt||!!item.claim} onChange={e=>void update(entry,{...item,assignee:e.target.value as Assignee})}><option value="me">Me</option><option value="kai">Kai</option><option value="codex">Codex</option></select></label>}
    </div><div className="item-actions">{!project.archivedAt&&<>
      {state==='active'&&<><button title="Move up" aria-label={`Move up ${item.text}`} disabled={index===0} onClick={()=>move(entry,-1)}><ArrowUp size={14}/></button><button title="Move down" aria-label={`Move down ${item.text}`} disabled={index===active.length-1} onClick={()=>move(entry,1)}><ArrowDown size={14}/></button></>}
      {state!=='archived'&&<button onClick={()=>edit(entry)}>Edit</button>}
      {state!=='archived'&&<button onClick={()=>void update(entry,{...item,archivedAt:new Date().toISOString()})}>Archive</button>}
      {state==='archived'&&<button onClick={()=>void update(entry,{...item,archivedAt:undefined})}>Unarchive</button>}
    </>}</div></li>;
  }
  return <section className="panel"><div className="section-heading"><div><h2>Next steps</h2><p className="muted">Your priorities, in your words.</p></div>{!project.archivedAt&&<button onClick={()=>edit()}><Plus size={16}/>Add step</button>}</div>
    {error&&<p role="alert" className="error">{error} <button onClick={()=>window.dispatchEvent(new Event('focus'))}>Refresh</button></p>}
    {active.length?<ol className="work-list">{active.map((i,n)=>row(i,n,'active'))}</ol>:<p className="empty-line">Add a step to give this project a starting point.</p>}
    <details><summary>Completed work ({completed.length})</summary><ol className="work-list">{completed.map((i,n)=>row(i,n,'completed'))}</ol></details>
    {!!archived.length&&<details><summary>Archived steps ({archived.length})</summary><ol className="work-list">{archived.map((i,n)=>row(i,n,'archived'))}</ol></details>}
    {back&&<div className="task-list-footer"><button onClick={back}>← Back to projects list</button></div>}
    {editor&&<ItemForm item={editor.entry?.item} close={()=>setEditor(null)} save={item=>save(editor.entry?editor.items.map(e=>nextStepKey(e)===nextStepKey(editor.entry!)?{...e,item}:e):[...editor.items,{kind:'steps',item}],editor.revision)}/>}
  </section>;
}
export function AssignedWork({projects,open,review}:{projects:LocalProject[];open:(id:string)=>void;review?:(project:LocalProject,input:ReviewInput)=>Promise<void>}){
  const [assignee,setAssignee]=useState('all'),[status,setStatus]=useState('all'),[sort,setSort]=useState<WorkSort>('act-asc');
  useEffect(()=>{try{const saved=localStorage.getItem('research-compass.assigned-work-sort');if(isWorkSort(saved))setSort(saved);}catch{}},[]);
  function chooseSort(value:string){if(!isWorkSort(value))return;setSort(value);try{localStorage.setItem('research-compass.assigned-work-sort',value);}catch{}}
  const tasks=projects.filter(p=>!p.archivedAt).flatMap(project=>(['steps','followUps'] as const).flatMap(kind=>project[kind].filter(i=>!i.archivedAt&&!i.completedAt).map(item=>({project,kind,item})))).filter(({item})=>(assignee==='all'||(item.assignee||'me')===assignee)&&(status==='all'||taskStatus(item)===status));
  const sortedTasks=sortAssignedWork(tasks,sort);
  return <><header className="page-heading"><div><p className="eyebrow">YOUR WORKSPACE</p><h1>Assigned work</h1><p className="muted">Ask Kai or Codex to check Research Compass when you want work to begin.</p></div></header><div className="queue-filters assigned-work-filters"><label>Assigned to<select aria-label="Assigned to" value={assignee} onChange={e=>setAssignee(e.target.value)}><option value="all">Everyone</option><option value="me">Me</option><option value="kai">Kai</option><option value="codex">Codex</option></select></label><label>Readiness<select aria-label="Readiness" value={status} onChange={e=>setStatus(e.target.value)}>{['All','Ready','Scheduled','Working','Awaiting review','Needs input'].map(s=><option key={s} value={s==='All'?'all':s}>{s}</option>)}</select></label><label>Sort by<select aria-label="Sort by" value={sort} onChange={e=>chooseSort(e.target.value)}>{workSortOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div><p className="muted">{sort.startsWith('assigned-')?'Tasks without a recorded assignment date appear last. Older tasks may not have this date.':sort.startsWith('act-')?'Tasks without an Act on date appear last.':null} Dates and times use Eastern time.</p><section className="panel">{!tasks.length&&<p className="muted">No tasks match these filters.</p>}<ul className="work-list">{sortedTasks.map(({project,kind,item,assignedAt})=><li className="queue-item" key={`${project.id}-${kind}-${item.id}`}><div><small>{project.name} · Next step</small><h2>{item.text}</h2><p className="task-meta"><span className="task-status">{taskStatus(item)}</span><span>For {assigneeName(item.assignee)}</span>{item.date?<span>Act on: {actionLabel(item)}</span>:sort.startsWith('act-')&&<span>No Act on date</span>}{item.dueDate&&<span>Due: {actionLabel({date:item.dueDate,time:item.dueTime})}</span>}{assignedAt?<span>Assigned: {new Date(assignedAt).toLocaleString('en-US',{timeZone:'America/New_York'})}</span>:sort.startsWith('assigned-')&&<span>Assignment date unavailable</span>}</p><TaskDetails item={item}/>{review&&canReview(item)&&<ReviewForm item={item} kind={kind} save={input=>review(project,input)}/>}</div><button onClick={()=>open(project.id)}>Open project</button></li>)}</ul></section></>;
}
