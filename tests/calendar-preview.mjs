// Test-only loopback gateway for the built Worker. Mirrors the dev mock identity.
// Run Wrangler locally on 8787 with a NEW isolated --persist-to directory first.
import http from 'node:http';
const port=5174,origin=`http://127.0.0.1:${port}`;
http.createServer(async(req,res)=>{
 try{
  if(!req.url?.startsWith('/')||req.url.startsWith('//')||req.headers.host!==`127.0.0.1:${port}`||req.headers.origin&&req.headers.origin!==origin){res.writeHead(403);res.end('Forbidden');return;}
  if(req.url?.startsWith('/signin-with-chatgpt')){res.writeHead(302,{'Set-Cookie':'__sites_local_auth=1; Path=/; HttpOnly; SameSite=Lax',Location:'/'});res.end();return;}
  if(req.url?.startsWith('/signout-with-chatgpt')){res.writeHead(302,{'Set-Cookie':'__sites_local_auth=; Path=/; Max-Age=0',Location:'/'});res.end();return;}
  const headers=new Headers();for(const [key,value] of Object.entries(req.headers)){if(value&&!key.startsWith('oai-authenticated-')&&!['host','origin','connection','content-length','accept-encoding'].includes(key))headers.set(key,Array.isArray(value)?value.join(','):value);}
  if((req.headers.cookie||'').split(';').map(v=>v.trim()).includes('__sites_local_auth=1')){headers.set('oai-authenticated-user-id','local_synthetic');headers.set('oai-authenticated-user-email','synthetic@local.test');}
  headers.set('Connection','close');
  let body=Buffer.alloc(0);for await(const chunk of req)body=Buffer.concat([body,chunk]);
  const response=await fetch(new URL(req.url,'http://127.0.0.1:8787'),{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:body,redirect:'manual'});
  const output=Buffer.from(await response.arrayBuffer());res.writeHead(response.status,Object.fromEntries([...response.headers].filter(([key])=>!['content-encoding','content-length','transfer-encoding','connection'].includes(key))));res.end(output);
 }catch{res.writeHead(502);res.end('Local Worker unavailable.');}
}).listen(port,'127.0.0.1',()=>console.log(`Synthetic test gateway: ${origin}. Local mock sign-in only; never deploy this test script.`));
