import type { Project, ThreadOption } from './types';

export interface WorkItem {
  id: string;
  text: string;
  notes: string;
  date?: string;
  time?: string;
  dueDate?: string;
  dueTime?: string;
  completedAt?: string;
  archivedAt?: string;
  assignee?: Assignee;
  execution?: import('./execution').TaskExecution;
  workStatus?: 'working'|'awaiting_review'|'needs_input';
  actionKind?: 'task'|'email';
  emailAccount?: string;
  result?: TaskResult;
  reviews?: TaskReview[];
  pendingReviewId?: string;
  claim?: {id:string;actor:'kai'|'codex';startedAt:string;effectState:'not_started'|'started'|'uncertain'};
  activity?: {at:string;actor:Assignee;summary:string}[];
}
export type Assignee='me'|'kai'|'codex';
export interface TaskResult {summary:string;artifacts:{label:string;url?:string;draftId?:string;emailAccount?:string}[]}
export type ReviewAction='request_changes'|'approve_continue'|'approve_finish';
export interface TaskReview {id:string;at:string;action:ReviewAction;text:string;result?:TaskResult;previousClaim?:WorkItem['claim']}
export interface ReviewInput {requestId:string;kind:'steps'|'followUps';taskId:string;action:ReviewAction;text:string}
export interface ProjectChat {id:string;title:string;updatedAt:string;projectId:string|null}
export interface ProjectChatPage {chats:ProjectChat[];nextCursor?:string}
export interface ContextSelection {projectIds:string[];chatIds:string[]}
export interface CodexProjectOption { id:string; title:string; roots:string[] }
export interface CodexLink { id: string; title: string; kind: 'project' | 'conversation'; url?: string; projectId?:string; parentProjectId?:string; parentProjectTitle?:string; roots?:string[] }
export interface LocalProject extends Project {
  defaultCloudRepository?: import('./execution').GitHubRepository;
  localVersion: 1;
  steps: WorkItem[];
  followUps: WorkItem[];
  nextStepOrder?: string[];
  codexLinks: CodexLink[];
  sourceCodexProjectId?:string;
}
export interface HandoffInput {
  stepIds: string[];
  followUpIds: string[];
  linkIds: string[];
  references: string[];
  outcome: string;
  instructions: string;
  target?:'kai'|'codex';
}
export interface LocalState { projects: LocalProject[]; backupPath?: string; calendar?: import('./calendar').CalendarState }
export interface CompassBridge {
  installSkill():Promise<string>;
  state(): Promise<LocalState>;
  calendar(revision:number,entry:import('./calendar').CalendarEntry):Promise<void>;
  save(input: { id?: string; revision?: number; name: string; purpose: string; defaultCloudRepository?: import('./execution').GitHubRepository|null }): Promise<LocalProject>;
  items(id: string, revision: number, kind: 'steps'|'followUps', items: WorkItem[]): Promise<void>;
  work(id: string, revision: number, items: import('./next-steps').NextStep[]): Promise<void>;
  review(id: string, revision: number, input: ReviewInput): Promise<void>;
  archive(id: string, revision: number, archived: boolean): Promise<void>;
  candidates(): Promise<ThreadOption[]>;
  projects(): Promise<CodexProjectOption[]>;
  projectChats(projectId:string|null,cursor?:string,archived?:boolean):Promise<ProjectChatPage>;
  selectContext(selection:ContextSelection,localId?:string,revision?:number):Promise<string[]>;
  chooseProject(projectId:string,localId?:string,revision?:number):Promise<string>;
  importConversation(threadId: string): Promise<string>;
  importProject(title: string, url: string): Promise<string>;
  link(id: string, revision: number, link: Omit<CodexLink,'id'> & { id?: string }): Promise<void>;
  unlink(id: string, revision: number, linkId: string): Promise<void>;
  prepare(id: string, input: HandoffInput): Promise<string>;
  copy(text: string): Promise<void>;
  exportMarkdown(name: string, text: string): Promise<string|null>;
  exportHistory(id: string): Promise<string|null>;
  history(id: string): Promise<string>;
  openLink(url: string): Promise<void>;
}
declare global { interface Window { compass: CompassBridge } }
