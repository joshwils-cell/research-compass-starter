import type {Project} from '../src/types';
export class Store {
  projects=new Map<string,Project>(); settings=new Map<string,unknown>(); historyRows:any[]=[]; requestRows:any[]=[];
  list(){return [...this.projects.values()];}
  get(id:string){const p=this.projects.get(id);if(!p)throw Error('Project not found.');return structuredClone(p);}
  put(p:Project){this.projects.set(p.id,structuredClone(p));}
  setting<T>(key:string):T|undefined{return this.settings.get(key) as T|undefined;}
  setSetting(key:string,value:unknown){this.settings.set(key,value);}
  transaction<T>(fn:()=>T):T{return fn();}
}
