"use client";
import {useState,useSyncExternalStore} from 'react';
import {Download,Check} from 'lucide-react';
interface InstallPrompt extends Event {prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>}
type State={prompt:InstallPrompt|null;installed:boolean;android:boolean};
const serverState:State={prompt:null,installed:false,android:false};
let state:State=serverState;
const subscribers=new Set<()=>void>();
const emit=(patch:Partial<State>)=>{state={...state,...patch};for(const fn of subscribers)fn();};
// Imported with the main app, so a prompt is retained even before Settings opens.
if(typeof window!=='undefined'){
 const display=window.matchMedia('(display-mode: standalone)');
 state={prompt:null,installed:display.matches,android:/Android/i.test(navigator.userAgent)};
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();emit({prompt:e as InstallPrompt});});
 window.addEventListener('appinstalled',()=>emit({prompt:null,installed:true}));
 display.addEventListener('change',e=>{if(e.matches)emit({installed:true,prompt:null});});
}
function subscribe(fn:()=>void){subscribers.add(fn);return()=>{subscribers.delete(fn);};}
export function AndroidInstall(){
 const {prompt,installed,android}=useSyncExternalStore(subscribe,()=>state,()=>serverState);
 const [busy,setBusy]=useState(false),[help,setHelp]=useState(false),[message,setMessage]=useState('');
 async function install(){
  if(!prompt){setHelp(true);setMessage(android?'Chrome has not offered an install prompt yet. You can use the steps below, or leave this page open briefly and try again.':'To add the icon to your Android phone, open this Site in Chrome on that phone. Installing here adds it to this device.');return;}
  setBusy(true);setHelp(false);setMessage('');emit({prompt:null});
  try{await prompt.prompt();const choice=await prompt.userChoice;setMessage(choice.outcome==='accepted'?'Chrome accepted the installation. Finish any device confirmation, then look for Research Compass in your apps or on your home screen.':'Installation was canceled. You can still add the icon from Chrome’s menu.');if(choice.outcome==='dismissed')setHelp(true);}
  catch{setMessage('Chrome could not open the installation prompt. You can use the steps below.');setHelp(true);}
  finally{setBusy(false);}
 }
 return <section className="panel install-panel"><h2>Android home-screen icon</h2><p>Open Research Compass directly from an icon on your phone. Tap the button, then confirm Chrome’s installation prompt.</p>
 <button className="primary" onClick={()=>void install()} disabled={busy||installed}>{installed?<Check size={18}/>:<Download size={18}/>} {installed?'Installed on this device':busy?'Opening install prompt…':'Add Research Compass to home screen'}</button>
 {installed?<p role="status">Research Compass is installed or running as an app on this device.</p>:<p className="muted">Use this button in Chrome on your Android phone. Your browser must ask you to confirm; the Site cannot place an icon without that confirmation.</p>}
 {message&&<p role="status">{message}</p>}
 <details open={help} onToggle={e=>setHelp(e.currentTarget.open)}><summary>Install button not opening a prompt?</summary><ol><li>On your phone, open <a href="https://your-private-compass.example/" target="_blank" rel="noreferrer">Research Compass</a> in regular Chrome, rather than an in-app or Incognito browser.</li><li>Sign in, tap somewhere on the page, and keep it open for about 30 seconds. Then try the button again.</li><li>Alternatively, tap Chrome’s <strong>⋮</strong> menu at the top right and choose <strong>Add to home screen</strong> or <strong>Install app</strong>. Choose <strong>Install</strong> or <strong>Add</strong> to confirm.</li><li>If the icon was already added, look for <strong>Research Compass</strong> or <strong>Compass</strong> on your home screen or in your apps.</li></ol></details>
 <p>Your phone and laptop use the same private records. Internet access is required.</p>
 </section>;
}
export function SignInHelp(){return <section className="panel"><h2>Staying signed in</h2><p>Closing Research Compass does not sign you out. To reuse your saved session, open it in the same regular Chrome profile and keep its cookies and site data. Avoid Incognito mode and browser settings that clear site data when you close Chrome.</p><p>ChatGPT Sites controls how long sign-in lasts. Research Compass cannot extend that session; you may need to sign in again when it expires. Adding the home-screen icon does not make sign-in permanent.</p></section>;}
