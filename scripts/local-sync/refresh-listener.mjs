import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {readCatalog} from './catalog-reader.mjs';
const endpoint='https://your-private-compass.example/api/catalog-sync';
export async function pollAndRefresh(conf,{read=readCatalog,fetcher=fetch}={}){
  async function send(body){
    const response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json','OAI-Sites-Authorization':'Bearer '+conf.service,'X-Compass-Sync':conf.secret},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(90_000)});
    if(!response.ok)throw Error('Catalog refresh connection refused ('+response.status+').');
    const value=await response.json();return value.result;
  }
  const pending=await send({action:'poll'}),job=pending.request;
  if(!job)return {ok:true,idle:true,at:new Date().toISOString()};
  try{
    await send({action:'begin',requestId:job.id});
    const catalog=await read();
    const result=await send({action:'complete',requestId:job.id,catalog});
    return {ok:true,requestId:job.id,at:new Date().toISOString(),...result};
  }catch(error){
    try{await send({action:'fail',requestId:job.id});}catch{}
    throw error;
  }
}
export async function listen(conf){
  const statusFile=path.join(conf.stateDirectory,'refresh-listener-status.json');
  fs.mkdirSync(conf.stateDirectory,{recursive:true});let failures=0;
  while(true){
    let status;
    try{status=await pollAndRefresh(conf);failures=0;}catch{failures++;status={ok:false,at:new Date().toISOString(),error:'Catalog refresh connection failed. Check the existing sync connection.'};}
    const temporary=statusFile+'.tmp';fs.writeFileSync(temporary,JSON.stringify(status,null,2));fs.renameSync(temporary,statusFile);
    await new Promise(resolve=>setTimeout(resolve,Math.min(60_000,5000*Math.max(1,failures))));
  }
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  let input='';for await(const chunk of process.stdin)input+=chunk;
  const conf=JSON.parse(input);input='';await listen(conf);
}
