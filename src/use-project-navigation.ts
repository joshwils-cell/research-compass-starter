'use client';
import {useEffect,useState} from 'react';

type View='projects'|'archived'|'project'|'assigned'|'calendar'|'activity'|'settings';
type Route={view:View;projectId?:string};
const key='researchCompassNavigation';
const projects:Route={view:'projects'};
const views:View[]=['projects','archived','project','assigned','calendar','activity','settings'];

function readRoute():Route{
  const route=window.history.state?.[key];
  if(!route||!views.includes(route.view)||(route.view==='project'&&typeof route.projectId!=='string'))return projects;
  return route;
}
function writeRoute(route:Route,replace=false){
  // Keep the framework's history fields; navigation changes no saved app data.
  const state={...window.history.state,[key]:route};
  if(replace)window.history.replaceState(state,'');
  else window.history.pushState(state,'');
}

export function useProjectNavigation(){
  const [route,setRoute]=useState<Route>(projects);
  useEffect(()=>{
    const initial=readRoute();
    writeRoute(initial,true); // Reuse the arrival entry so Back can leave the list.
    setRoute(initial);
    const restore=()=>setRoute(readRoute());
    window.addEventListener('popstate',restore);
    return()=>window.removeEventListener('popstate',restore);
  },[]);
  function navigate(view:Exclude<View,'project'>){
    const current=readRoute();
    if(view==='projects'&&current.view==='project'){
      window.history.back();
      return;
    }
    if(current.view===view)return;
    const next:Route={view};
    writeRoute(next);
    setRoute(next);
  }
  function openProject(projectId:string){
    const current=readRoute();
    if(current.view==='project'&&current.projectId===projectId)return;
    // Every project has the list immediately behind it, including opens from
    // Calendar/Assigned work. Switching projects reuses that detail entry.
    if(current.view!=='project')writeRoute(projects,true);
    const next:Route={view:'project',projectId};
    writeRoute(next,current.view==='project');
    setRoute(next);
  }
  return {route,navigate,openProject};
}
