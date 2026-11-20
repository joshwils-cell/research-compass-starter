// Opt-in fixture checks against a NEW isolated local D1 database only.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const url=new URL(process.argv[2]||'http://127.0.0.1:5174');
assert.ok(url.protocol==='http:'&&url.hostname==='127.0.0.1'&&!url.username&&!url.password,'Only isolated loopback is allowed.');
const headers={'Content-Type':'application/json',Cookie:'__sites_local_auth=1'};
async function call(method,...args){const r=await fetch(new URL('/api/compass',url),{method:'POST',headers,redirect:'error',body:JSON.stringify({method,args})});const body=await r.json();assert.equal(r.status,200,body.error);return body.result;}
async function agent(args){const r=await fetch(new URL('/mcp',url),{method:'POST',headers,redirect:'error',body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'research_compass_tasks',arguments:{version:1,actor:'kai',...args}}})});assert.equal(r.status,200);const body=await r.json();assert.ok(!body.result.isError,JSON.stringify(body));return JSON.parse(body.result.content[0].text);}
const start=await call('state');assert.equal(start.projects.length,0,'Use a NEW empty isolated database.');
const backup=await call('export');mkdirSync('.test-data',{recursive:true});writeFileSync('.test-data/execution-before-fixture.json',JSON.stringify(backup));assert.equal(backup.records.length,0);
const repo={url:'https://github.com/example/research',fullName:'example/research'},other={url:'https://github.com/example/override',fullName:'example/override'};
let p=await call('save',{name:'Execution synthetic project',purpose:'Isolated execution routing checks',defaultCloudRepository:repo});
const tasks=[{id:'legacy',text:'Legacy task with task-text routing',notes:'Use local Codex',assignee:'kai'},...['auto','local','cloud'].map(route=>({id:route,text:`Synthetic ${route}`,notes:'',assignee:'kai',execution:{route}})),{id:'default',text:'Cloud default snapshot',notes:'',assignee:'kai',execution:{route:'cloud',repository:repo}},{id:'override',text:'Cloud override',notes:'',assignee:'kai',execution:{route:'cloud',repository:{...other,id:'123'},environmentId:'env_saved'}},{id:'non-kai',text:'Me task',notes:'',assignee:'me',execution:{route:'cloud',repository:repo}},{id:'scheduled',text:'Scheduled task',notes:'',assignee:'kai',date:'2099-01-01',time:'09:30',execution:{route:'local'}}];
await call('work',p.id,p.revision,tasks.map(item=>({kind:'steps',item})));
p=(await call('state')).projects[0];assert.deepEqual(p.steps.map(t=>t.execution),tasks.map(t=>t.execution));
const all=(await agent({action:'list',assignee:'all',readiness:'all'})).tasks,ready=(await agent({action:'list'})).tasks;
assert.equal(all.length,8);assert.equal(ready.length,6);assert.ok(!ready.some(t=>['non-kai','scheduled'].includes(t.task.id)));
for(const row of all){assert.deepEqual((await agent({action:'get',projectId:p.id,taskId:row.task.id})).execution,row.execution);}
assert.equal(all.find(t=>t.task.id==='legacy').execution.source,'legacy');assert.equal(all.find(t=>t.task.id==='cloud').execution.cloudTarget.state,'missing_repository');assert.equal(all.find(t=>t.task.id==='override').execution.cloudTarget.state,'not_verified');assert.equal(all.find(t=>t.task.id==='non-kai').execution.applicable,false);
await call('save',{id:p.id,revision:p.revision,name:p.name,purpose:p.purpose,defaultCloudRepository:other});p=(await call('state')).projects[0];assert.deepEqual(p.steps.find(t=>t.id==='default').execution.repository,repo);
// Route changes must not start work, alter readiness, or clear an existing claim.
let claimed=await agent({action:'claim',projectId:p.id,revision:p.revision,taskId:'local',requestId:'execution-claim'});
assert.equal(claimed.task.claim.effectState,'not_started');p=(await call('state')).projects[0];
await call('work',p.id,p.revision,p.steps.map(item=>({kind:'steps',item:item.id==='local'?{...item,execution:{route:'cloud',repository:repo}}:item})));
p=(await call('state')).projects[0];assert.deepEqual(p.steps.find(t=>t.id==='local').claim,claimed.task.claim);
let begun=await agent({action:'begin',projectId:p.id,revision:p.revision,taskId:'local',claimId:claimed.task.claim.id,requestId:'execution-begin'});assert.equal(begun.task.claim.effectState,'started');
// Synthetic email result only: no Gmail call and no external action occurs.
let created=await agent({action:'create',projectId:p.id,revision:begun.revision,kind:'followUps',requestId:'execution-email',patch:{text:'Synthetic draft task',actionKind:'email'}});
claimed=await agent({action:'claim',projectId:p.id,revision:created.revision,taskId:created.task.id,requestId:'execution-email-claim'});
const result=await agent({action:'update',projectId:p.id,revision:claimed.revision,taskId:created.task.id,claimId:claimed.task.claim.id,requestId:'execution-email-result',patch:{status:'awaiting_review',result:{summary:'Synthetic unsent draft',artifacts:[{label:'Fixture draft',draftId:'fixture-unsent'}]}}});assert.equal(result.status,'Awaiting review');
const snapshot=await call('export'),stored=JSON.parse(snapshot.records.find(r=>r.key===`project:${p.id}`).data);assert.deepEqual(stored,(await call('state')).projects[0]);assert.equal(stored.followUps[0].result.artifacts[0].draftId,'fixture-unsent');
// Browser regression fixture: an owner response queues Ready while keeping the
// uncertain claim and reviewed result. Editing only the route must preserve them.
p=(await call('state')).projects[0];
const queued={id:'queued-review',text:'Queued review with retained claim',notes:'Change only execution in the browser',assignee:'kai',claim:{id:'fixture-retained-claim',actor:'kai',startedAt:'2026-11-01T12:00:00Z',effectState:'uncertain'},reviews:[{id:'fixture-review',at:'2026-11-02T12:00:00Z',action:'request_changes',text:'Revise the existing work',result:{summary:'Prior reviewed result',artifacts:[{label:'Unsent draft reference',draftId:'fixture-prior-draft'}]}}],pendingReviewId:'fixture-review'};
await call('work',p.id,p.revision,[...p.steps.map(item=>({kind:'steps',item})),...p.followUps.map(item=>({kind:'followUps',item})),{kind:'steps',item:queued}]);
console.log('PASS: isolated D1 save/reload and backup; legacy/Auto/Local/Cloud/default/override/non-Kai/scheduling; MCP all/ready/detail parity; claim/begin and unsent-draft behavior. No external jobs or email actions.');
