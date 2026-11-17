// Opt-in integration check. Refuse hosted URLs and any nonempty workspace.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const url=new URL(process.argv[2]||'http://127.0.0.1:5173');
assert.ok(url.protocol==='http:'&&url.hostname==='127.0.0.1'&&!url.username&&!url.password,'Only an isolated loopback preview is allowed.');
async function request(method,args=[],headers={Cookie:'__sites_local_auth=1'}){
 const send=()=>fetch(new URL('/api/compass',url),{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify({method,args})});
 let response=await send();
 // Windows Miniflare can restart after an early 401. Only repeat reads; never retry a write.
 if(response.status===503&&['state','export'].includes(method)){await response.text();console.log('Local Worker restarted; repeating one read-only request.');response=await send();}
 const text=await response.text();let body;try{body=JSON.parse(text);}catch{body={error:text};}return {status:response.status,...body};
}
async function call(method,...args){const r=await request(method,args);assert.equal(r.status,200,r.error);return r.result;}
const start=await call('state');assert.equal(start.projects.length,0,'Use a NEW isolated local database.');assert.equal(start.calendar.entries.length,0);
assert.equal((await request('state',[],{})).status,401);
assert.equal((await request('state',[],{'oai-authenticated-user-id':'spoof','oai-authenticated-user-email':'spoof@example.org'})).status,401);
await call('state');
assert.equal((await request('calendar',[{revision:0,entry:{}}],{})).status,401);
await call('state');
assert.equal((await request('calendar',[{revision:0,entry:{}}],{Cookie:'__sites_local_auth=1',Origin:'https://untrusted.example'})).status,403);
const p=await call('save',{name:'Calendar synthetic project',purpose:'Local tests only'}),task={id:'same-id',text:'Synthetic scheduled task',notes:'Preserve this',date:'2026-11-17',time:'09:00',dueDate:'2026-11-18',dueTime:'17:00'};
await call('items',p.id,p.revision,'steps',[task]);let state=await call('state'),current=state.projects[0];
await call('items',p.id,current.revision,'followUps',[{...task,text:'Synthetic legacy follow-up',date:'2026-11-17',time:'15:00',dueDate:undefined,dueTime:undefined}]);
const entry={id:randomUUID(),text:'Synthetic independent deadline',notes:'No project',kind:'due',date:'2026-11-17'};
await call('calendar',{revision:0,entry});
const competing=await Promise.all([request('calendar',[{revision:1,entry:{...entry,time:'10:00'}}]),request('calendar',[{revision:1,entry:{...entry,time:'11:00'}}])]);assert.equal(competing.filter(r=>r.status===200).length,1);assert.equal(competing.filter(r=>r.status===400).length,1);
state=await call('state');assert.equal(state.calendar.entries.length,1);assert.equal(state.calendar.revision,2);
assert.equal((await request('calendar',[{revision:0,entry}])).status,400);
assert.equal((await request('calendar',[{revision:2,entry:{...entry,date:'2027-03-14',time:'02:30'}}])).status,400);
await call('calendar',{revision:2,entry:{...entry,deletedAt:'2026-11-17T12:00:00Z'}});assert.ok((await call('state')).calendar.entries[0].deletedAt);
await call('calendar',{revision:3,entry});
current=(await call('state')).projects[0];const old=current.revision;const priorActivity=(await call('export')).events.length;
await call('work',p.id,current.revision,[{kind:'steps',item:{...current.steps[0],date:'2026-11-19',time:'14:30'}},{kind:'followUps',item:current.followUps[0]}]);
assert.equal((await call('export')).events.length,priorActivity+2,'One task update and its date-history event must not repeat legacy-array activity with a colliding task ID.');
assert.equal((await request('work',[p.id,old,[{kind:'steps',item:task}]] )).status,400);
current=(await call('state')).projects[0];assert.equal(current.steps[0].date,'2026-11-19');assert.equal(current.steps[0].dueDate,'2026-11-18');assert.equal(current.followUps[0].date,'2026-11-17');
await call('work',p.id,current.revision,[{kind:'steps',item:{...current.steps[0],archivedAt:'2026-11-17T12:00:00Z'}},{kind:'followUps',item:current.followUps[0]}]);
current=(await call('state')).projects[0];assert.ok(current.steps[0].archivedAt);
await call('work',p.id,current.revision,[{kind:'steps',item:{...current.steps[0],archivedAt:undefined}},{kind:'followUps',item:current.followUps[0]}]);
const snapshot=await call('export'),savedCalendar=snapshot.records.find(r=>r.key==='setting:calendar-v1');assert.ok(savedCalendar);assert.equal(JSON.parse(savedCalendar.data).entries[0].id,entry.id);assert.ok(snapshot.events.some(e=>e.summary==='Deleted calendar entry'));
assert.deepEqual((await call('state')).calendar,JSON.parse(savedCalendar.data));
console.log('PASS: isolated D1 persistence; both task arrays; due dates; stale/concurrent writes; DST rejection; archive/delete/restore; backup inclusion; anonymous/spoofed/cross-origin rejection. Synthetic records retained for browser checks.');
