import {readCalendar,changeCalendar,calendarSnapshot} from './calendar';
import {validateCatalog,selectionGroups,emptyCatalog,type Catalog} from './catalog';
import {env} from 'cloudflare:workers';
import {Store} from './store';
import {Workspace,linkInput} from './workspace';
import {AgentTasks} from './agent-tasks';
import {taskStatus,easternDate} from '../src/task-status';
import {workItem} from './task-schema';
import {CatalogRefresh,catalogRefreshStatus} from './catalog-refresh';
import {TaskReviews} from './task-reviews';
const db=()=>{if(!env.DB)throw Error('Database unavailable.');return env.DB;};
export async function operate(method:string,args:any[],actor='me'){
 const d=db();
 if(method==='catalogRefreshStatus')return catalogRefreshStatus(d,args[0]);
 const [recordRows,versionRows]=await d.batch([d.prepare('SELECT key,data FROM records'),d.prepare('SELECT revision FROM versions WHERE id=1')]);
 const raw=new Map((recordRows.results as any[]).map(r=>[r.key,r.data]));
 recordRows.results=(recordRows.results as any[]).filter(r=>!r.key.includes('::chunk:')).map(r=>({...r,data:r.data.startsWith('@chunks:')?Array.from({length:Number(r.data.slice(8))},(_,i)=>raw.get(`${r.key}::chunk:${i}`)).join(''):r.data}));
 const revision=Number((versionRows.results[0] as any)?.revision||0),store=new Store();
 for(const row of recordRows.results as any[]){const value=JSON.parse(row.data);if(row.key.startsWith('project:'))store.projects.set(row.key.slice(8),value);else if(row.key.startsWith('setting:'))store.settings.set(row.key.slice(8),value);else if(row.key==='history')store.historyRows=value;else if(row.key==='requests')store.requestRows=value;}
 const original=new Map((recordRows.results as any[]).map(r=>[r.key,r.data]));const w=new Workspace(store);let result:any;
 const catalog=store.setting<Catalog>('codex-catalog')||emptyCatalog();
 if(method==='catalog')return {...catalog,syncedAt:catalog.projects.length?catalog.syncedAt:null};
 if(method==='projectChats'){const [projectId,cursor,archived=false]=args;const offset=cursor?Number(cursor):0;if(!Number.isInteger(offset)||offset<0)throw Error('Invalid chat cursor.');const chats=catalog.chats.filter(c=>c.projectId===projectId&&c.archived===archived).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id));return {chats:chats.slice(offset,offset+50),nextCursor:offset+50<chats.length?String(offset+50):undefined};}
 if(method==='state'){const state=w.state();return {...state,calendar:readCalendar(store),projects:state.projects.map(p=>({...p,codexLinks:p.codexLinks.map(l=>{if(l.kind!=='conversation'||l.parentProjectId)return l;const t=catalog.chats.find(t=>t.id===l.id);const parent=catalog.projects.find(p=>p.id===t?.projectId);return parent?{...l,parentProjectId:parent.id,parentProjectTitle:parent.title}:l;})}))};}
 if(method==='history')return w.history(args[0]);
 if(method==='prepare')return w.prepare(args[0],args[1]);
 if(method==='export')return {version:1,createdAt:new Date().toISOString(),records:[...original].map(([key,data])=>({key,data})),events:(await d.prepare('SELECT * FROM events ORDER BY at,id').all()).results};
 if(method==='activity'){
  const f=args[0]||{};let since=f.since||null;if(since&&/^\d{4}-\d{2}-\d{2}$/.test(since)){let date=new Date(since+'T04:00:00Z');if(easternDate(date)!==since)date=new Date(since+'T05:00:00Z');since=date.toISOString();}const rows=await d.prepare('SELECT * FROM events WHERE (? IS NULL OR project_id=?) AND (? IS NULL OR actor=?) AND (? IS NULL OR at>=?) AND (? IS NULL OR task_id=?) AND (? IS NULL OR json_extract(data,"$.status")=?) ORDER BY at DESC,id DESC LIMIT 51 OFFSET ?').bind(f.projectId||null,f.projectId||null,f.actor||null,f.actor||null,since,since,f.taskId||null,f.taskId||null,f.status||null,f.status||null,Math.max(0,Number(f.offset)||0)).all();return {events:rows.results.slice(0,50),more:rows.results.length>50};
 }
 let importedEvents:any[]=[];let preservedTest=false;
 if(method==='restore'){
  const snap=args[0];const bytes=new TextEncoder().encode(JSON.stringify(snap));const checksum=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');const prior=store.setting<any>('cloud-import');if(prior?.checksum===checksum)return prior.result;if(original.size){const testId=store.setting<string>('connection-test');if(!testId||store.list().length!==1||store.list()[0].id!==testId||store.historyRows.length||store.requestRows.length)throw Error('Restore requires an empty workspace.');const test=store.get(testId) as any;if([...test.steps,...test.followUps].some((t:any)=>t.claim))throw Error('Finish the connection test before importing.');test.archivedAt=new Date().toISOString();store.projects.clear();store.put(test);store.settings.clear();preservedTest=true;}if(snap.version!==1||!Array.isArray(snap.records)||snap.records.length>10000)throw Error('Invalid snapshot.');
  for(const r of snap.records){if(typeof r.key!=='string'||typeof r.data!=='string')throw Error('Invalid record.');const value=JSON.parse(r.data);if(r.key.startsWith('project:')){if(value.localVersion!==1||r.key!==`project:${value.id}`||!Number.isInteger(value.revision))throw Error('Unsupported project.');for(const kind of ['steps','followUps']){if(!Array.isArray(value[kind]))throw Error('Invalid tasks.');for(const t of value[kind]){workItem.parse(t);if(t.claim)throw Error('Reconcile active agent attempts before migration.');}}for(const l of value.codexLinks)linkInput.parse(l);store.projects.set(value.id,value);}else if(r.key.startsWith('setting:'))store.settings.set(r.key.slice(8),r.key==='setting:calendar-v1'?calendarSnapshot.parse(value):value);else if(r.key==='history')store.historyRows=value;else if(r.key==='requests')store.requestRows=value;else throw Error('Unknown record type.');}
  importedEvents=snap.events||[];result={projects:store.projects.size-(preservedTest?1:0),restored:true};store.setSetting('cloud-import',{checksum,result,at:new Date().toISOString()});
 }else if(method==='connectionTest'){if(store.list().length||store.historyRows.length)throw Error('Connection test setup requires an empty workspace.');const p=w.save({name:'Kai cloud connection test',purpose:'Synthetic test workspace. Complete this test before importing your real projects.'});w.items(p.id,p.revision,'followUps',[{id:crypto.randomUUID(),text:'Verify cloud access and save a test result',notes:'Claim this task, record a synthetic result, then set Awaiting review. Do not send messages or create external artifacts.',assignee:'kai'}]);store.setSetting('connection-test',p.id);result={projectId:p.id};}else if(method==='agent'){result=new AgentTasks(store).execute(args[0]);actor=args[0].actor;}
 else if(method==='requestCatalogRefresh')result=new CatalogRefresh(store).request();
 else if(method==='catalogRefreshBegin')result=new CatalogRefresh(store).begin(args[0]);
 else if(method==='catalogRefreshFail')result=new CatalogRefresh(store).fail(args[0]);
 else if(method==='catalogSync'){const incoming=validateCatalog(args[0]),refresh=new CatalogRefresh(store);if(args[1])refresh.require(args[1]);if(incoming.syncedAt<catalog.syncedAt)throw Error('A newer catalog is already saved.');store.setSetting('codex-catalog',incoming);result={projects:incoming.projects.length,chats:incoming.chats.length,syncedAt:incoming.syncedAt};refresh.complete(result,args[1]);}
 else if(method==='selectContext'){result=w.selectContext(selectionGroups(catalog,args[0]),args[1],args[2]);}
 else if(method==='save')result=w.save(args[0]);
 else if(method==='items'){if(!['steps','followUps'].includes(args[2]))throw Error('Invalid list.');result=w.items(args[0],args[1],args[2],args[3]);}
 else if(method==='calendar')result=changeCalendar(store,args[0]);
 else if(method==='work')result=w.work(args[0],args[1],args[2]);
 else if(method==='review')result=new TaskReviews(store).execute(args[0],args[1],args[2]);
 else if(method==='archive')result=w.archive(args[0],args[1],args[2]);
 else if(method==='link')result=w.link(args[0],args[1],args[2]);
 else if(method==='unlink')result=w.unlink(args[0],args[1],args[2]);
 else if(method==='importProject')result=w.importProject(args[0],args[1]);
 else throw Error('Unknown operation.');
 const next=new Map<string,string>();for(const p of store.list())next.set(`project:${p.id}`,JSON.stringify(p));for(const [k,v]of store.settings)next.set(`setting:${k}`,JSON.stringify(v));if(store.historyRows.length)next.set('history',JSON.stringify(store.historyRows));if(store.requestRows.length)next.set('requests',JSON.stringify(store.requestRows));
 const changed=[...next].filter(([k,v])=>original.get(k)!==v);if(!changed.length)return result??null;
 const guard=crypto.randomUUID();
 const statements=[d.prepare('INSERT INTO guards(id,valid) SELECT ?,CASE WHEN COALESCE((SELECT revision FROM versions WHERE id=1),0)=? THEN 1 ELSE 0 END').bind(guard,revision),d.prepare('INSERT INTO versions(id,revision) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision').bind(revision+1)];
 for(const key of original.keys())if(!next.has(key)){for(const rawKey of raw.keys())if(rawKey===key||rawKey.startsWith(key+'::chunk:'))statements.push(d.prepare('DELETE FROM records WHERE key=?').bind(rawKey));}if(method==='restore'&&!preservedTest&&store.setting('cloud-import'))statements.push(d.prepare('DELETE FROM events'));
 for(const [key,data]of changed){const parts=data.length>200000?data.match(/[\s\S]{1,200000}/g)!:[];const oldCount=String(raw.get(key)||'').startsWith('@chunks:')?Number(String(raw.get(key)).slice(8)):0;for(let i=0;i<oldCount;i++)statements.push(d.prepare('DELETE FROM records WHERE key=?').bind(`${key}::chunk:${i}`));statements.push(d.prepare('INSERT INTO records(key,data) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data').bind(key,parts.length?'@chunks:'+parts.length:data));for(let i=0;i<parts.length;i++)statements.push(d.prepare('INSERT INTO records(key,data) VALUES(?,?)').bind(`${key}::chunk:${i}`,parts[i]));}
 const addEvent=(e:any)=>statements.push(d.prepare('INSERT INTO events(id,at,project_id,task_id,actor,summary,data) VALUES(?,?,?,?,?,?,?)').bind(e.id,e.at,e.project_id||null,e.task_id||null,e.actor,e.summary,typeof e.data==='string'?e.data:JSON.stringify(e.data||{})));
 for(const e of importedEvents)addEvent(e);
 for(const [key,data]of changed.filter(([k])=>k.startsWith('project:')&&!(method==='restore'&&importedEvents.length))){const p=JSON.parse(data),old=original.has(key)?JSON.parse(original.get(key)!):null;
  let logged=false;for(const kind of ['steps','followUps'])for(const t of p[kind]){const prev=old?.[kind]?.find((v:any)=>v.id===t.id);for(const a of (t.activity||[]).filter((a:any)=>!(prev?.activity||[]).some((b:any)=>JSON.stringify(a)===JSON.stringify(b)))){addEvent({id:crypto.randomUUID(),at:a.at,project_id:p.id,task_id:t.id,actor:a.actor,summary:a.summary,data:{projectName:p.name,taskText:t.text,result:t.result,status:taskStatus(t),imported:method==='restore'}});logged=true;}}
  if(!logged)addEvent({id:crypto.randomUUID(),at:new Date().toISOString(),project_id:p.id,actor,summary:method==='restore'?'Imported project':`${method==='agent'?args[0].action:method} project`,data:{projectName:p.name}});
 }
 if(method==='calendar')addEvent({id:crypto.randomUUID(),at:new Date().toISOString(),actor,summary:args[0].entry.deletedAt?'Deleted calendar entry':'Saved calendar entry',data:{calendarEntryId:args[0].entry.id}});
 statements.push(d.prepare('DELETE FROM guards WHERE id=?').bind(guard));
 try{await d.batch(statements);}catch(e){if(String(e).includes('valid_revision'))throw Error('Workspace changed. Refresh and retry with its current revision.');throw e;}
 return result??null;
}
