// Read-only, consistent export. Private output must remain outside source control.
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
const out=process.argv[2];if(!out)throw Error('Supply an absolute private output directory.');if(!path.isAbsolute(out))throw Error('Output must be absolute.');
const binding=JSON.parse(fs.readFileSync(path.join(os.homedir(),'.research-compass','registry-location.json'),'utf8'));const file=path.join(binding.directory,'research-resume.sqlite');const st=fs.statSync(file,{bigint:true});if(`${st.dev}:${st.ino}`!==binding.identity)throw Error('Registry identity mismatch.');
const db=new DatabaseSync(file,{readOnly:true});db.exec('BEGIN');let tables;try{tables=db.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(t=>({...t,rows:db.prepare(`SELECT * FROM "${t.name.replaceAll('"','""')}"`).all()}));}finally{db.exec('ROLLBACK');db.close();}
const table=n=>tables.find(t=>t.name===n)?.rows||[];const records=[];let claims=0,tasks=0;
for(const r of table('projects')){const p=JSON.parse(r.data);if(p.localVersion!==1)throw Error('Update desktop migration before exporting.');for(const t of [...p.steps,...p.followUps]){tasks++;if(t.claim)claims++;}records.push({key:`project:${r.id}`,data:r.data});}
for(const r of table('settings'))records.push({key:`setting:${r.key}`,data:r.data});
records.push({key:'history',data:JSON.stringify(table('history'))},{key:'requests',data:JSON.stringify(table('requests'))});
const createdAt=new Date().toISOString(),stamp=createdAt.replaceAll(':','-');fs.mkdirSync(out,{recursive:true});
const backup=path.join(out,`desktop-full-${stamp}.json`),snapshot=path.join(out,`site-import-${stamp}.json`);
fs.writeFileSync(backup,JSON.stringify({version:1,createdAt,tables}),{flag:'wx'});
const content=JSON.stringify({version:1,createdAt,records,events:[]});fs.writeFileSync(snapshot,content,{flag:'wx'});const sha256=createHash('sha256').update(content).digest('hex');fs.writeFileSync(snapshot+'.sha256',sha256,{flag:'wx'});
console.log(JSON.stringify({backup,snapshot,sha256,projects:table('projects').length,tasks,activeClaims:claims,history:table('history').length,readyForImport:claims===0}));
