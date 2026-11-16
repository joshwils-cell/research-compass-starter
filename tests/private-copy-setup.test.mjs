import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

function fixture(run){
  const parent=fs.realpathSync(os.tmpdir()),root=fs.mkdtempSync(path.join(parent,'compass-private-copy-'));
  try{
    fs.mkdirSync(path.join(root,'scripts'));fs.mkdirSync(path.join(root,'.openai'));fs.mkdirSync(path.join(root,'src'));
    fs.copyFileSync(new URL('../scripts/configure-private-copy.mjs',import.meta.url),path.join(root,'scripts','configure-private-copy.mjs'));
    fs.writeFileSync(path.join(root,'.openai','hosting.json'),JSON.stringify({project_id:null,d1:'DB',capabilities:['mcp']}));
    fs.writeFileSync(path.join(root,'src','settings.mjs'),"export const url='https://your-private-compass.example'; export const email='you@example.com';");
    run(root);
  }finally{
    if(!path.resolve(root).startsWith(parent+path.sep)||!path.basename(root).startsWith('compass-private-copy-'))throw Error('Unexpected temporary test path.');
    fs.rmSync(root,{recursive:true,force:true});
  }
}
const configure=(root,...extra)=>spawnSync(process.execPath,[path.join(root,'scripts','configure-private-copy.mjs'),'--site-id','synthetic-new-site-id','--site-url','https://independent-compass.test','--email','owner@independent.test',...extra],{encoding:'utf8'});

test('private-copy setup binds only a neutral copy and rewrites defaults without touching runtime data',()=>fixture(root=>{
  fs.mkdirSync(path.join(root,'node_modules'));fs.writeFileSync(path.join(root,'node_modules','settings.mjs'),'you@example.com');
  fs.writeFileSync(path.join(root,'.env.local'),'DO_NOT_CHANGE=you@example.com');
  const result=configure(root);assert.equal(result.status,0,result.stderr);
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'.openai','hosting.json'),'utf8'));
  assert.deepEqual(manifest,{project_id:'synthetic-new-site-id',d1:'DB',capabilities:['mcp']});
  const settings=fs.readFileSync(path.join(root,'src','settings.mjs'),'utf8');assert.ok(settings.includes('https://independent-compass.test'));assert.ok(settings.includes('owner@independent.test'));
  assert.equal(fs.readFileSync(path.join(root,'node_modules','settings.mjs'),'utf8'),'you@example.com');assert.equal(fs.readFileSync(path.join(root,'.env.local'),'utf8'),'DO_NOT_CHANGE=you@example.com');
  assert.notEqual(configure(root).status,0);assert.equal(fs.readFileSync(path.join(root,'src','settings.mjs'),'utf8'),settings);
}));
test('configuration rejects missing/invalid arguments and existing Site identities without writes',()=>fixture(root=>{
  const settingsFile=path.join(root,'src','settings.mjs'),original=fs.readFileSync(settingsFile,'utf8');
  assert.notEqual(configure(root,'--email','duplicate@independent.test').status,0);
  assert.notEqual(spawnSync(process.execPath,[path.join(root,'scripts','configure-private-copy.mjs')]).status,0);
  fs.writeFileSync(path.join(root,'.openai','hosting.json'),JSON.stringify({project_id:'already-owned-id',d1:'DB'}));
  assert.notEqual(configure(root).status,0);assert.equal(fs.readFileSync(settingsFile,'utf8'),original);
}));

test('configuration rewrites the shipped app defaults and both optional sync endpoints',()=>fixture(root=>{
  const shipped=['src/InstallApp.tsx','src/TaskUI.tsx','domain/workspace.ts','domain/agent-tasks.ts','scripts/local-sync/sync-client.mjs','scripts/local-sync/refresh-listener.mjs'];
  for(const relative of shipped){
    const target=path.join(root,relative);fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.copyFileSync(new URL('../'+relative,import.meta.url),target);
  }
  const result=configure(root);assert.equal(result.status,0,result.stderr);
  for(const relative of shipped){
    const contents=fs.readFileSync(path.join(root,relative),'utf8');
    assert.ok(!contents.includes('your-private-compass.example'),relative);
    assert.ok(!contents.includes('you@example.com'),relative);
    assert.ok(!contents.includes('you+alternate@example.com'),relative);
    assert.ok(contents.includes(relative.includes('InstallApp')||relative.includes('local-sync')?'https://independent-compass.test':'owner@independent.test'),relative);
  }
}));

test('invalid origins and email defaults leave neutral source untouched',()=>{
  for(const [option,value] of [['--site-url','http://independent.test'],['--site-url','https://user:password@independent.test'],['--site-url','https://independent.test/path'],['--site-url','https://your-private-compass.example'],['--email','you@example.com']]){
    fixture(root=>{
      const args=['--site-id','synthetic-new-site-id','--site-url','https://independent-compass.test','--email','owner@independent.test'];
      args[args.indexOf(option)+1]=value;
      const result=spawnSync(process.execPath,[path.join(root,'scripts','configure-private-copy.mjs'),...args],{encoding:'utf8'});
      assert.notEqual(result.status,0);
      assert.equal(JSON.parse(fs.readFileSync(path.join(root,'.openai','hosting.json'),'utf8')).project_id,null);
      assert.ok(fs.readFileSync(path.join(root,'src','settings.mjs'),'utf8').includes('you@example.com'));
    });
  }
});
