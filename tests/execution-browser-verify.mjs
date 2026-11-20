// Read-only persistence assertions after the browser steps in EXECUTION-ROUTING.md.
import assert from 'node:assert/strict';
const url=new URL(process.argv[2]||'http://127.0.0.1:5174');
assert.ok(url.protocol==='http:'&&url.hostname==='127.0.0.1'&&!url.username&&!url.password,'Only isolated loopback is allowed.');
const headers={'Content-Type':'application/json',Cookie:'__sites_local_auth=1'};
const response=await fetch(new URL('/api/compass',url),{method:'POST',headers,redirect:'error',body:JSON.stringify({method:'state',args:[]})});
assert.equal(response.status,200);const {result}=await response.json();
assert.equal(result.projects.length,1);const p=result.projects[0];assert.equal(p.name,'Execution synthetic project');
const queued=p.steps.find(t=>t.id==='queued-review');assert.equal(queued.execution.route,'local');assert.equal(queued.workStatus,undefined);assert.equal(queued.claim.id,'fixture-retained-claim');assert.equal(queued.claim.effectState,'uncertain');assert.equal(queued.pendingReviewId,'fixture-review');assert.equal(queued.reviews[0].result.artifacts[0].draftId,'fixture-prior-draft');
assert.equal(p.steps.find(t=>t.id==='legacy').execution,undefined);
assert.equal(p.defaultCloudRepository.fullName,'example/changed-default');assert.equal(p.steps.find(t=>t.id==='default').execution.repository.fullName,'example/research');
assert.equal(p.steps.find(t=>t.text==='Browser cloud default').execution.repository.fullName,'example/mobile-override');
assert.deepEqual(p.steps.find(t=>t.text==='Browser unconfigured cloud').execution,{route:'cloud'});
assert.equal(p.steps.find(t=>t.id==='non-kai').assignee,'me');assert.equal(p.steps.find(t=>t.id==='scheduled').date,'2099-01-01');assert.equal(p.steps.find(t=>t.id==='scheduled').time,'09:30');
assert.equal(p.followUps[0].result.artifacts[0].draftId,'fixture-unsent');
const mcp=await fetch(new URL('/mcp',url),{method:'POST',headers,redirect:'error',body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'research_compass_tasks',arguments:{version:1,actor:'kai',action:'get',projectId:p.id,taskId:'queued-review'}}})});
const body=await mcp.json();assert.ok(!body.result.isError);const view=JSON.parse(body.result.content[0].text);assert.equal(view.execution.route,'local');assert.equal(view.status,'Ready');assert.equal(view.task.claim.id,queued.claim.id);assert.equal(view.userResponse.id,'fixture-review');
console.log('PASS: browser saves persisted; legacy absence, project/default isolation, mobile override, unresolved cloud, inactive non-Kai, schedule, draft and queued-review claim/history preserved; MCP reflects browser route.');
