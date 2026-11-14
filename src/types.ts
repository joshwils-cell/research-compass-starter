import type {SetupPreview,SetupChoice,SetupOutcome} from './setup-types';
export type ReviewMode = 'incremental' | 'reconcile' | 'full';
export type EvidenceKind = 'observed' | 'interpretation' | 'user-confirmed';
export type FindingSection = 'summary'|'progress'|'decisions'|'proposed'|'questions'|'nextActions';
export type Resolution = 'open'|'partial'|'resolved';
export interface TrackedItem { id:string; text:string; section:FindingSection; firstSeenAt:string; sourceIds:string[] }
export interface UserUpdate { id:string; entryId:string; itemId:string; text:string; originalText:string; at:string; resolution:Resolution; withdrawn:boolean }
export interface Knowledge { items:TrackedItem[]; updates:UserUpdate[]; revision:number; appliedRevision?:number }
export interface UpdateInput { itemId?:string; section:FindingSection; targetText:string; text:string; resolution:Resolution; updateId?:string; expectedEntryId?:string; withdrawn?:boolean }
export interface Reconsideration { itemId:string; text:string; sourceIds:string[] }
export interface Finding { itemId?:string; text: string; sourceIds: string[]; kind: EvidenceKind }
export interface Source {
  id: string; kind: 'file' | 'codex' | 'import' | 'user'; label: string; path?: string;
  fingerprint: string; modifiedAt: string; content?: string; change: 'added' | 'changed' | 'unchanged' | 'removed';
  excerpted?: boolean; fileSize?: number; fileMtime?: number; fileCtime?: number; historyUpdatedAt?: string; latestTurnId?: string;
}
export interface Pin { id: string; section: 'decisions' | 'nextActions'; text: string; completedAt?: string }
export interface Briefing {
  id: string; createdAt: string; requestId: string; summary: Finding[];
  progress: Finding[]; decisions: Finding[]; proposed: Finding[];
  questions: Finding[]; nextActions: Finding[]; conflicts: string[];
  sources: Source[]; gaps: string[]; reconsiderations?:Reconsideration[];
  mode?: 'ai' | 'activity-only'; fallbackReason?: string;
}
export interface ImportedChat { id: string; title: string; text: string; updatedAt: string }
export interface Project {
  id: string; setupOriginId?: string; name: string; purpose: string; folders: string[];
  extensions: string[]; exclusions: string[]; threads: { id: string; title: string }[];
  knowledge?:Knowledge; imports: ImportedChat[]; pins: Pin[]; revision: number; createdAt: string;
  lastAttempt?: string; lastError?: string; pendingId?: string; archivedAt?: string;
  briefing?: Briefing; snapshots: Source[];
  fileInventory?: Record<string,string>;
  lastCheckedAt?: string; lastReconciledAt?: string; checkedRevision?: number;
  checkedInventoryHash?: string; checkedCoverageHash?: string; checkedInventoryStamp?: string;
  reviewStatus?: {state:'running'|'retrying'|'ready'|'activity-only'|'failed';stage:string;updatedAt:string;attempt?:number};
}
export interface ReviewRequest {
  version: 1; id: string; projectId: string; projectRevision: number;
  preparedAt: string; projectName: string; purpose: string;
  inputHash: string; sources: Source[]; gaps: string[]; pins: Pin[];
  knowledge?:Knowledge; previousBriefing?: Briefing;
  pipelineVersion?: 2 | 3; reviewMode?: ReviewMode; inventoryStamp?: string;
  inventoryHash?: string; coverageHash?: string;
}
export interface ReviewResult {
  version: 1; requestId: string; projectId: string; inputHash: string;
  reviewedAt: string; reviewedSourceIds: string[]; reconsiderations?:Reconsideration[];
  summary: Finding[]; progress: Finding[]; decisions: Finding[];
  proposed: Finding[]; questions: Finding[]; nextActions: Finding[]; conflicts: string[];
}
export interface ThreadOption { id: string; title: string; cwd: string; updatedAt: string }
export interface AppState { projects: Project[]; dataDir: string; schedule: { configured: boolean; id?: string; label: string; verifiedAt?: string }; }
export interface ReviewStatus { stage: string; projectId: string; done?:boolean }
export interface Bridge {
  state(): Promise<AppState>;
  exportSetup(ids:string[],includeConversationText:boolean):Promise<string|null>;
  openSetup():Promise<SetupPreview|null>;
  applySetup(token:string,choices:SetupChoice[],includeConversationText:boolean):Promise<SetupOutcome>;
  saveProject(project: Partial<Project> & {name:string; purpose:string; folders:string[]; extensions:string[]; exclusions:string[]}): Promise<Project>;
  removeProject(id: string): Promise<void>;
  setArchived(id: string, archived: boolean): Promise<void>;
  pickFolders(): Promise<string[]>;
  candidates(folders: string[]): Promise<{threads:ThreadOption[]; error?:string}>;
  saveUpdate(id:string,input:UpdateInput):Promise<void>;
  updatePins(id: string, pins: Pin[]): Promise<void>;
  importChat(id: string, title: string, text: string): Promise<void>;
  unlinkChat(id: string, chatId: string): Promise<void>;
  refresh(id: string, mode?: ReviewMode): Promise<{message:string}>;
  prepare(id:string): Promise<{requestPath:string; resultPath:string}>;
  apply(id:string): Promise<void>;
  markdown(id: string): Promise<string>;
  copy(text:string): Promise<void>;
  exportPrompt(id: string): Promise<string | null>;
  history(id: string): Promise<Briefing[]>;
  openSource(projectId:string, sourceId:string): Promise<void>;
  openFolder(projectId:string): Promise<void>;
  onStatus(callback:(status:ReviewStatus)=>void): ()=>void;
}
declare global { interface Window { research: Bridge } }
