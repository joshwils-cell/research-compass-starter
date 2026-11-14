import {env} from 'cloudflare:workers';
import {operate} from '../../../domain/cloud';
import {pollCatalogRefresh} from '../../../domain/catalog-refresh';
export async function POST(req:Request){
 const expected=(env as Cloudflare.Env & {CODEX_SYNC_SECRET?:string}).CODEX_SYNC_SECRET;
 if(!expected||req.headers.get('X-Compass-Sync')!==expected)return Response.json({error:'Sync authorization required.'},{status:403});
 try{
  const body=await req.text();if(body.length>5000000)throw Error('Catalog exceeds supported size.');const input=JSON.parse(body);let result;
  if(input.action==='poll'){if(!env.DB)throw Error('Database unavailable.');result=await pollCatalogRefresh(env.DB);}
  else if(input.action==='begin')result=await operate('catalogRefreshBegin',[input.requestId]);
  else if(input.action==='fail')result=await operate('catalogRefreshFail',[input.requestId]);
  else if(input.action==='complete'){if(typeof input.requestId!=='string')throw Error('Refresh request ID required.');result=await operate('catalogSync',[input.catalog,input.requestId]);}
  else if(!input.action&&input.version===1)result=await operate('catalogSync',[input]);
  else throw Error('Unsupported sync operation.');
  return Response.json({result},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof Error?e.message:String(e)},{status:400,headers:{'Cache-Control':'no-store'}});}
}
