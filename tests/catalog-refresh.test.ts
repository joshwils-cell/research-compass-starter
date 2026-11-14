import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CatalogRefresh,activeRefresh} from '../domain/catalog-refresh';
import {Store} from '../domain/store';
import {pollAndRefresh} from '../scripts/local-sync/refresh-listener.mjs';
const now=new Date('2026-11-10T12:00:00Z');
test('repeated clicks coalesce; expired jobs can be replaced and stale completions are rejected',()=>{
 const store=new Store(),refresh=new CatalogRefresh(store),job=refresh.request(now);
 assert.equal(refresh.request(new Date(now.getTime()+1000)).id,job.id);
 assert.ok(activeRefresh(job,now));assert.equal(activeRefresh(job,new Date(now.getTime()+16*60_000)),false);
 const replacement=refresh.request(new Date(now.getTime()+16*60_000));assert.notEqual(replacement.id,job.id);
 assert.throws(()=>refresh.complete({projects:1,chats:2,syncedAt:now.toISOString()},job.id,new Date(now.getTime()+16*60_000)));
});
test('a matching completion records its receipt; failure does not remove the saved catalog',()=>{
 const store=new Store(),refresh=new CatalogRefresh(store);store.setSetting('codex-catalog',{projects:['retained']});
 const job=refresh.request(now);refresh.begin(job.id,now);refresh.fail(job.id,now);
 assert.equal(refresh.get()?.status,'failed');assert.deepEqual(store.setting('codex-catalog'),{projects:['retained']});
 const next=refresh.request(now);refresh.begin(next.id,now);refresh.complete({projects:3,chats:4,syncedAt:now.toISOString()},next.id,now);
 assert.equal(refresh.get()?.status,'completed');assert.equal(refresh.get()?.result?.projects,3);
});
test('the listener reads fresh metadata only for a queued request and acknowledges the same request',async()=>{
 const calls:any[]=[],catalog={version:1,projects:[{id:'p',title:'Fresh project',roots:[]}],chats:[],syncedAt:now.toISOString()};
 const fetcher=async(_url:unknown,options?:any)=>{const body=JSON.parse(options.body);calls.push(body);return Response.json({result:body.action==='poll'?{request:{id:'job'}}:body.action==='complete'?{projects:1,chats:0,syncedAt:catalog.syncedAt}:{}});};
 let reads=0;const result=await pollAndRefresh({service:'fixture',secret:'fixture'},{fetcher,read:async()=>{reads++;return catalog;}});
 assert.equal(reads,1);assert.deepEqual(calls.map(c=>c.action),['poll','begin','complete']);assert.equal(calls[2].requestId,'job');assert.equal(result.ok,true);
 calls.length=0;const idle=await pollAndRefresh({service:'fixture',secret:'fixture'},{fetcher:async()=>Response.json({result:{request:null}}),read:async()=>{throw Error('Must not read without request');}});
 assert.equal(idle.idle,true);
});
test('read failures report failure rather than completing with old metadata',async()=>{
 const actions:string[]=[];
 const fetcher=async(_url:unknown,options?:any)=>{const body=JSON.parse(options.body);actions.push(body.action);return Response.json({result:body.action==='poll'?{request:{id:'job'}}:{}});};
 await assert.rejects(()=>pollAndRefresh({service:'fixture',secret:'fixture'},{fetcher,read:async()=>{throw Error('Codex unavailable');}}));
 assert.deepEqual(actions,['poll','begin','fail']);
});
