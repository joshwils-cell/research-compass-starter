import {getChatGPTUser} from '../../chatgpt-auth';
import {operate} from '../../../domain/cloud';
export async function POST(req:Request){
 if(!await getChatGPTUser())return Response.json({error:'Sign in required.'},{status:401});
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return Response.json({error:'Origin rejected.'},{status:403});
 try{const body=await req.text();if(body.length>12000000)throw Error('Request too large.');const {method,args}=JSON.parse(body);if(method==='agent')throw Error('Use the agent connection.');const result=await operate(method,args||[]);return Response.json({result},{headers:{'Cache-Control':'no-store'}});}catch(e){return Response.json({error:e instanceof Error?e.message:String(e)},{status:400,headers:{'Cache-Control':'no-store'}});}
}
