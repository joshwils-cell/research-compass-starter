import type {Store} from './store';
const jobKey='catalog-refresh',presenceKey='catalog-sync-presence';
const lifetime=15*60_000;
export interface RefreshJob {
  id:string;requestedAt:string;status:'requested'|'working'|'completed'|'failed';
  startedAt?:string;completedAt?:string;error?:string;
  result?:{projects:number;chats:number;syncedAt:string};
}
export const activeRefresh=(job:RefreshJob|undefined,now=new Date())=>!!job&&['requested','working'].includes(job.status)&&now.getTime()-Date.parse(job.requestedAt)<lifetime;
export class CatalogRefresh {
  constructor(private store:Store){}
  get(){return this.store.setting<RefreshJob>(jobKey);}
  request(now=new Date()){
    const old=this.get();if(activeRefresh(old,now))return old!;
    const job:RefreshJob={id:crypto.randomUUID(),requestedAt:now.toISOString(),status:'requested'};
    this.store.setSetting(jobKey,job);return job;
  }
  require(id:unknown,now=new Date()){
    const job=this.get();if(typeof id!=='string'||job?.id!==id||!activeRefresh(job,now))throw Error('This refresh request is no longer active. Request a new refresh.');
    return job;
  }
  begin(id:unknown,now=new Date()){
    const job=this.require(id,now),next:RefreshJob={...job,status:'working',startedAt:now.toISOString()};
    this.store.setSetting(jobKey,next);return next;
  }
  complete(result:NonNullable<RefreshJob['result']>,id?:string,now=new Date()){
    const job=id?this.require(id,now):this.get();
    if(!job||!activeRefresh(job,now)||!id&&result.syncedAt<job.requestedAt)return;
    this.store.setSetting(jobKey,{...job,status:'completed',completedAt:now.toISOString(),result});
  }
  fail(id:unknown,now=new Date()){
    const job=this.require(id,now),next:RefreshJob={...job,status:'failed',completedAt:now.toISOString(),error:'Codex could not refresh the list. Check that your computer is on and signed in, then try again.'};
    this.store.setSetting(jobKey,next);return next;
  }
}
async function readControl(db:D1Database){
  const rows=await db.prepare('SELECT key,data FROM records WHERE key IN (?,?)').bind('setting:'+jobKey,'setting:'+presenceKey).all<{key:string;data:string}>();
  const data=new Map(rows.results.map(row=>[row.key,JSON.parse(row.data)]));
  return {job:data.get('setting:'+jobKey) as RefreshJob|undefined,presence:data.get('setting:'+presenceKey) as {lastSeenAt:string}|undefined};
}
export async function catalogRefreshStatus(db:D1Database,id?:unknown,now=new Date()){
  const {job,presence}=await readControl(db);
  const runnerOnline=!!presence&&now.getTime()-Date.parse(presence.lastSeenAt)<45_000;
  if(!job)return {status:'idle',runnerOnline};
  if(id&&id!==job.id)return {status:'superseded',runnerOnline};
  const status=['requested','working'].includes(job.status)&&!activeRefresh(job,now)?'expired':job.status;
  return {...job,status,runnerOnline};
}
export async function pollCatalogRefresh(db:D1Database,now=new Date()){
  const {job,presence}=await readControl(db);
  if(!presence||now.getTime()-Date.parse(presence.lastSeenAt)>20_000){
    await db.prepare('INSERT INTO records(key,data) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data').bind('setting:'+presenceKey,JSON.stringify({lastSeenAt:now.toISOString()})).run();
  }
  const eligible=activeRefresh(job,now)&&(job!.status==='requested'||now.getTime()-Date.parse(job!.startedAt||job!.requestedAt)>90_000);
  return {request:eligible?job:null};
}
