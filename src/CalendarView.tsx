import {useMemo,useState,type FormEvent} from 'react';
import type {LocalState,WorkItem} from './compass-types';
import {calendarDays,calendarEvents,calendarKindLabel,civilLabel,emptyCalendar,shiftDate,shiftMonth,type CalendarEntry,type CalendarEvent,type CalendarKind,type CalendarView as View} from './calendar';
import {easternDate,actionLabel} from './task-status';
import {nextSteps,nextStepKey} from './next-steps';
import {Modal} from './components/Modal';
import {TaskDetails} from './TaskUI';
const message=(e:unknown)=>e instanceof Error?e.message:String(e);
type Editor={event?:CalendarEvent;date:string;time?:string;revision:number};
function CalendarEditor({editor,close,save,openProject}:{editor:Editor;close:()=>void;save:(entry:CalendarEntry|WorkItem)=>Promise<void>;openProject:(id:string)=>void}){
  const event=editor.event,task=event?.task,entry=event?.entry;
  const [id]=useState(()=>entry?.id||crypto.randomUUID()),[text,setText]=useState(event?.text||''),[notes,setNotes]=useState(event?.notes||''),[kind,setKind]=useState<CalendarKind>(event?.kind||'due'),[date,setDate]=useState(editor.date),[time,setTime]=useState(editor.time||''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function persist(value:CalendarEntry|WorkItem){setError('');setBusy(true);try{await save(value);close();}catch(e){setError(message(e));}finally{setBusy(false);}}
  function taskValue(remove=false):WorkItem{return {...task!,...(kind==='due'?{dueDate:remove?undefined:date,dueTime:remove?undefined:time||undefined}:{date:remove?undefined:date,time:remove?undefined:time||undefined})};}
  function submit(e:FormEvent){e.preventDefault();void persist(task?taskValue():{...entry,id,text,notes,kind,date,time:time||undefined});}
  return <Modal title={task?'Task calendar entry':entry?'Edit calendar entry':'New calendar entry'} close={close}><form onSubmit={submit}>
    {task?<><h3>{task.text}</h3><p>{event.project?.name}</p><TaskDetails item={task}/></>:<><label>Title<input autoFocus required maxLength={20000} value={text} onChange={e=>setText(e.target.value)}/></label><label>Notes<textarea rows={3} maxLength={50000} value={notes} onChange={e=>setNotes(e.target.value)}/></label></>}
    <label>Entry type<select value={kind} disabled={!!task} onChange={e=>setKind(e.target.value as CalendarKind)}><option value="action">Scheduled action</option><option value="due">Due date</option></select></label>
    <div className="form-columns"><label>{kind==='due'?'Due date':'Act on'}<input type="date" required min="0001-01-01" max="9999-12-31" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Time (Eastern, optional)<input type="time" step={60} value={time} onChange={e=>setTime(e.target.value)}/></label></div>
    <p className="muted">{task?'Changes update the original task.':'Independent entry · no project required.'} Due dates do not change task readiness. All times use America/New_York. The first occurrence is used during the repeated fall hour. Entries without a time appear in All day.</p>
    {error&&<p role="alert" className="error">{error} <button type="button" onClick={()=>window.dispatchEvent(new Event('focus'))}>Refresh</button></p>}
    <fieldset disabled={busy} className="calendar-editor-actions"><button type="button" onClick={close}>Cancel</button>{task&&<button type="button" onClick={()=>{close();openProject(event.project!.id);}}>Open project</button>}
    {event&&<button type="button" onClick={()=>{if(window.confirm(task?'Remove this date from the task? The task and its history will remain.':'Delete this calendar entry? You can restore it from Deleted entries.'))void persist(task?taskValue(true):{...entry!,deletedAt:new Date().toISOString()});}}>{task?'Remove this date':'Delete entry'}</button>}
    {task&&<button type="button" onClick={()=>{if(window.confirm('Archive this task? Both its scheduled action and due date will leave the calendar. You can unarchive it in its project.'))void persist({...task,archivedAt:new Date().toISOString()});}}>Archive task</button>}
    <button className="primary" disabled={busy||!date||!task&&!text.trim()}>Save calendar entry</button></fieldset>
  </form></Modal>;
}
export function CalendarView({state,commit,openProject}:{state:LocalState;commit:(fn:()=>Promise<unknown>)=>Promise<void>;openProject:(id:string)=>void}){
  const [view,setView]=useState<View>('month'),[date,setDate]=useState(easternDate),[editor,setEditor]=useState<Editor|null>(null),[error,setError]=useState('');
  const calendar=state.calendar||emptyCalendar(),today=easternDate(),days=calendarDays(date,view),events=useMemo(()=>calendarEvents(state.projects,state.calendar||emptyCalendar()),[state.projects,state.calendar]);
  const byDay=new Map<string,CalendarEvent[]>();for(const event of events){const list=byDay.get(event.date)||[];list.push(event);byDay.set(event.date,list);}
  const title=view==='month'?civilLabel(date,{month:'long',year:'numeric'}):view==='day'?civilLabel(date):`${civilLabel(days[0])} – ${civilLabel(days[6])}`;
  function edit(event:CalendarEvent){setEditor({event,date:event.date,time:event.time,revision:event.project?.revision??calendar.revision});}
  function add(day=date,time?:string){setEditor({date:day,time,revision:calendar.revision});}
  function eventButton(event:CalendarEvent){return <button className={`calendar-event calendar-${event.kind}`} key={event.key} onClick={()=>edit(event)} aria-label={`${calendarKindLabel(event.kind)}: ${event.text}, ${actionLabel(event)}${event.project?', '+event.project.name:', independent entry'}`}><span>{calendarKindLabel(event.kind)}{event.time?` · ${event.time}`:''}</span><strong>{event.text}</strong><small>{event.project?.name||'Independent entry'}</small></button>;}
  async function save(value:CalendarEntry|WorkItem){
    if(!editor)return;const event=editor.event;
    if(event?.project&&event.task){const key=nextStepKey({kind:event.storageKind!,item:event.task});await commit(()=>window.compass.work(event.project!.id,editor.revision,nextSteps(event.project!).map(e=>nextStepKey(e)===key?{...e,item:value as WorkItem}:e)));}
    else await commit(()=>window.compass.calendar(editor.revision,value as CalendarEntry));
  }
  return <section className="calendar-view" aria-label="Calendar"><header className="page-heading"><div><p className="eyebrow">YOUR WORKSPACE</p><h1>Calendar</h1><p className="muted">Scheduled actions and due dates · Eastern time</p></div><button className="primary" onClick={()=>add()}>New entry</button></header>
    <div className="calendar-toolbar"><div className="button-row"><button onClick={()=>setDate(today)}>Today</button><button aria-label={`Previous ${view}`} onClick={()=>setDate(view==='month'?shiftMonth(date,-1):shiftDate(date,view==='week'?-7:-1))}>←</button><button aria-label={`Next ${view}`} onClick={()=>setDate(view==='month'?shiftMonth(date,1):shiftDate(date,view==='week'?7:1))}>→</button></div><h2 aria-live="polite">{title}</h2><div className="button-row" role="group" aria-label="Calendar view">{(['month','week','day'] as const).map(v=><button key={v} aria-pressed={v===view} onClick={()=>setView(v)}>{v[0].toUpperCase()+v.slice(1)}</button>)}</div><label>Go to date<input type="date" value={date} onChange={e=>{if(/^\d{4}-\d{2}-\d{2}$/.test(e.target.value))setDate(e.target.value);}}/></label></div>
    <p className="calendar-legend"><span className="calendar-action">Scheduled action · Act on</span><span className="calendar-due">Due date · deadline</span></p><p className="muted">Select an entry to change its date or time. Completed and archived tasks stay in their projects. Dates do not start agents or create reminders.</p>
    <div className="calendar-scroll" role="region" aria-label={`${view} calendar, Eastern time`} tabIndex={0}>
    {view==='month'?<table className="calendar-month"><caption className="sr-only">{title}</caption><thead><tr>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=><th scope="col" key={d}>{d}</th>)}</tr></thead><tbody>{Array.from({length:days.length/7},(_,week)=><tr key={week}>{days.slice(week*7,week*7+7).map(day=><td key={day} className={`${day.slice(0,7)!==date.slice(0,7)?'outside-month':''} ${day===today?'calendar-today':''}`}><button className="calendar-date" aria-label={`View ${civilLabel(day)}`} aria-current={day===today?'date':undefined} onClick={()=>{setDate(day);setView('day');}}>{Number(day.slice(8))}</button>{(byDay.get(day)||[]).map(eventButton)}</td>)}</tr>)}</tbody></table>:
    <table className={`calendar-time calendar-${view}`}><caption className="sr-only">{title}, times in Eastern time. Entries are start times, without a duration.</caption><thead><tr><th scope="col">Eastern</th>{days.map(day=><th scope="col" key={day} className={day===today?'calendar-today':''}><button onClick={()=>{setDate(day);setView('day');}}>{civilLabel(day,{weekday:'short',month:'short',day:'numeric'})}</button></th>)}</tr></thead><tbody><tr><th scope="row">All day</th>{days.map(day=><td key={day}>{(byDay.get(day)||[]).filter(e=>!e.time).map(eventButton)}<button className="calendar-add" aria-label={`Add entry on ${day}`} onClick={()=>add(day)}>+ Add</button></td>)}</tr>{Array.from({length:24},(_,hour)=><tr key={hour}><th scope="row">{hour%12||12} {hour<12?'AM':'PM'}</th>{days.map(day=><td key={day}>{(byDay.get(day)||[]).filter(e=>e.time&&Number(e.time.slice(0,2))===hour).map(eventButton)}<button className="calendar-add" aria-label={`Add entry on ${day} at ${hour}:00 Eastern`} onClick={()=>add(day,`${String(hour).padStart(2,'0')}:00`)}>+</button></td>)}</tr>)}</tbody></table>}
    </div>
    {!events.some(e=>days.includes(e.date))&&<p role="status" className="muted">No entries in this {view}.</p>}
    <details className="calendar-deleted"><summary>Deleted independent entries ({calendar.entries.filter(e=>e.deletedAt).length})</summary>{error&&<p role="alert">{error}</p>}<ul>{calendar.entries.filter(e=>e.deletedAt).map(entry=><li key={entry.id}>{entry.text} · {calendarKindLabel(entry.kind)} · {actionLabel(entry)} <button onClick={()=>void commit(()=>window.compass.calendar(calendar.revision,{...entry,deletedAt:undefined})).catch(e=>setError(message(e)))}>Restore {entry.text}</button></li>)}</ul></details>
    {editor&&<CalendarEditor editor={editor} close={()=>setEditor(null)} save={save} openProject={openProject}/>}
  </section>;
}
