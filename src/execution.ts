import type {WorkItem} from './compass-types';

export interface GitHubRepository {url:string;fullName:string;id?:string}
export interface TaskExecution {route:'auto'|'local'|'cloud';repository?:GitHubRepository;environmentId?:string}
export const executionLabels={auto:'Auto',local:'Codex Local · This computer',cloud:'Codex Cloud · GitHub'} as const;

// Manual input is a reference, never proof of access or a launch permission.
export function repositoryFromUrl(input:string):GitHubRepository|undefined {
  const text=input.trim();if(!text)return undefined;
  const match=/^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9_.-]{1,100})\/?$/.exec(text);
  if(!match||['.','..'].includes(match[2]))throw Error('Use a GitHub repository URL such as https://github.com/owner/repository, without credentials, query parameters, or a file path.');
  const name=match[2].replace(/\.git$/,'');if(!name||['.','..'].includes(name))throw Error('Enter a repository name.');
  const fullName=`${match[1]}/${name}`;return {url:`https://github.com/${fullName}`,fullName};
}

export interface EnvironmentMatch {id:string;name:string}
export type EnvironmentLookup={status:'unavailable'}|{status:'confirmed';matches:EnvironmentMatch[]};
// A confirmed lookup must be scoped to this exact repository by its caller.
// This Site has no supported discovery interface, so runtime views use unavailable.
export function cloudTarget(repository:GitHubRepository|undefined,environmentId?:string,lookup:EnvironmentLookup={status:'unavailable'}) {
  if(!repository)return {state:'missing_repository',label:'Repository needed',resolved:false} as const;
  if(lookup.status==='unavailable')return {state:'not_verified',label:'Not verified',resolved:false} as const;
  const matches=[...new Map(lookup.matches.map(match=>[match.id,match])).values()];
  if(!matches.length)return {state:'needs_cloud_setup',label:'Needs cloud setup',resolved:false} as const;
  const chosen=matches.find(match=>match.id===environmentId);
  if(environmentId&&!chosen)return {state:'selection_not_matched',label:'Choose a matching environment',resolved:false} as const;
  if(matches.length>1&&!chosen)return {state:'environment_choice_required',label:'Choose a cloud environment',resolved:false} as const;
  return {state:'matched',label:'Verified match',resolved:true,environment:chosen||matches[0]} as const;
}

export function executionView(task:WorkItem) {
  const selection=task.execution,applicable=task.assignee==='kai',route=selection?.route||'auto';
  return {applicable,route,source:selection?'saved' as const:'legacy' as const,
    repository:selection?.repository,environmentId:selection?.environmentId,
    cloudTarget:applicable&&route==='cloud'?cloudTarget(selection?.repository,selection?.environmentId):undefined,
    guidance:!applicable?'Execution preference is inactive: this task is not assigned to Kai.':[
      selection?'Read the saved execution preference alongside the latest owner response and task text.':'No execution preference was saved. Treat as Auto while honoring explicit routing in older task text.',
      route==='local'?'Use the connected computer and existing project. If unavailable, ask for input; never fall back to cloud.':route==='cloud'?'Before launch, verify repository identity and access and look up matching saved Codex cloud environments. Missing repository or unavailable lookup remains unresolved. No match needs cloud setup; multiple matches require an explicit choice. Reverify any saved environment ID against this repository.':'Kai can handle ordinary work directly without opening Codex.',
      'If the latest owner intent conflicts or is unclear, flag the conflict and ask before launch. Saving a route is not authorization to launch Codex, push, open a PR, deploy, send email, or change ownership, scheduling, or claims.'
    ].join(' ')};
}
