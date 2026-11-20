import {z} from 'zod';
import {repositoryFromUrl} from '../src/execution';

export const githubRepository=z.object({url:z.string().max(250),fullName:z.string().max(140),id:z.string().regex(/^[1-9]\d{0,29}$/).optional()}).strict().refine(value=>{
  try{const canonical=repositoryFromUrl(value.url);return canonical?.url===value.url&&canonical.fullName===value.fullName;}catch{return false;}
},'Use a canonical GitHub repository URL and matching owner/repository name.');
export const taskExecution=z.object({route:z.enum(['auto','local','cloud']),repository:githubRepository.optional(),environmentId:z.string().min(1).max(200).refine(value=>value.trim()===value,'Use the exact saved environment ID.').optional()}).strict().refine(value=>!value.environmentId||!!value.repository,'An environment reference requires a repository.');
