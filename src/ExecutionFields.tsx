import {cloudTarget,type GitHubRepository} from './execution';

export function RepositoryField({value,onChange,label='GitHub repository URL (optional)'}:{value:string;onChange:(value:string)=>void;label?:string}) {
  return <><label>{label}<input type="url" value={value} maxLength={250} onChange={e=>onChange(e.target.value)} placeholder="https://github.com/owner/repository"/></label><p className="muted">Repository discovery is unavailable here. Paste a URL; Kai will verify access and cloud setup before launch.</p></>;
}
export function CloudTargetStatus({repository,environmentId}:{repository?:GitHubRepository;environmentId?:string}) {
  const target=cloudTarget(repository,environmentId);
  return <p className="execution-status"><strong>{target.label}.</strong> {repository?'The saved repository and environment still need runtime verification.':'You can save now and choose a repository later.'}</p>;
}
