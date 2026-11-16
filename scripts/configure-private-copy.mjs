import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i+=2){
  if(!['--site-id','--site-url','--email'].includes(args[i])||!args[i+1]||options[args[i]])throw Error('Usage: node scripts/configure-private-copy.mjs --site-id <new ID> --site-url <new HTTPS URL> --email <your email>');
  options[args[i]]=args[i+1];
}
const id=options['--site-id'],email=options['--email'];
if(!id||/\s/.test(id)||id==='UNREGISTERED_PRIVATE_COPY')throw Error('Copy the new Site ID exactly from your own hosting account.');
const url=new URL(options['--site-url']);
if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/'||url.hostname.endsWith('.example')||url.hostname==='example.com')throw Error('Use the new private Site HTTPS origin, without paths, credentials, query, or fragment.');
if(!email||!/^\S+@\S+\.\S+$/.test(email)||email.endsWith('@example.com'))throw Error('Provide your own email address, not the example address.');
const manifestPath=path.join(root,'.openai','hosting.json');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
if(manifest.project_id)throw Error('This is already bound to a Site. Use an untouched neutral starter for a new private copy.');
const replacements=[['https://your-private-compass.example',url.origin],['you+alternate@example.com',email],['you@example.com',email]];
const ignored=new Set(['.git','node_modules','outputs','dist','.next','.vinext','.wrangler','.sites-runtime','.test-data','coverage']);
function visit(directory){
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    if(ignored.has(entry.name)||entry.name.startsWith('.env')||entry.name.startsWith('.dev.vars'))continue;
    const file=path.join(directory,entry.name);
    if(entry.isDirectory())visit(file);
    else if(entry.isFile()&&/\.(md|mjs|cjs|ts|tsx|js|json|ps1|txt)$/.test(entry.name)&&file!==manifestPath&&entry.name!=='private-copy-setup.test.mjs'){
      const old=fs.readFileSync(file,'utf8');let text=old;
      for(const [before,after]of replacements)text=text.replaceAll(before,after);
      if(text!==old)fs.writeFileSync(file,text);
    }
  }
}
visit(root);
fs.writeFileSync(manifestPath,JSON.stringify({...manifest,project_id:id},null,2)+'\n');
console.log('Configured this source copy for your new Site. No service was deployed, no data was imported, and no account credentials were copied.');
