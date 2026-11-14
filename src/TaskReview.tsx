import {useRef,useState} from 'react';
import type {WorkItem,ReviewAction,ReviewInput} from './compass-types';
import {reviewLabels} from './task-review';

export function ReviewForm({item,kind,save}:{item:WorkItem;kind:'steps'|'followUps';save:(input:ReviewInput)=>Promise<void>}){
  const [text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const attempt=useRef<{signature:string;requestId:string}|null>(null);
  async function submit(action:ReviewAction){
    const signature=JSON.stringify({action,text});
    if(attempt.current?.signature!==signature)attempt.current={signature,requestId:crypto.randomUUID()};
    setBusy(true);setError('');
    try{await save({requestId:attempt.current.requestId,kind,taskId:item.id,action,text});setText('');attempt.current=null;}
    catch(e){setError(e instanceof Error?e.message:String(e));}finally{setBusy(false);}
  }
  return <fieldset className="task-review" disabled={busy}>
    <legend>Respond to {item.assignee==='codex'?'Codex':'Kai'}</legend>
    <label>Your reply<textarea aria-label={`Your reply for ${item.text}`} rows={3} maxLength={10000} value={text} onChange={e=>setText(e.target.value)} placeholder="Give feedback, answer a question, or describe what to do next."/></label>
    <p className="muted">Request changes or approve and continue queues this task for the agent’s next check. Describe what to change or do next. Approve and finish completes the task; a reply is optional.</p>
    {item.actionKind==='email'&&<p className="muted">These actions do not send email. Revisions use the recorded draft.</p>}
    <div className="review-actions">{(['request_changes','approve_continue','approve_finish'] as const).map(action=><button key={action} type="button" disabled={busy||action!=='approve_finish'&&!text.trim()} onClick={()=>void submit(action)}>{reviewLabels[action]}</button>)}</div>
    {error&&<p role="alert" className="error">{error}</p>}
  </fieldset>;
}
