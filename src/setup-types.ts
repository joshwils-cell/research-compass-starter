import type {Pin,ImportedChat,Knowledge} from './types';
export interface SetupProject {originId:string;name:string;purpose:string;folders:string[];extensions:string[];exclusions:string[];pins:Pin[];threads:{id:string;title:string}[];imports:ImportedChat[];archived:boolean;knowledge?:Knowledge}
export interface SetupBundle {format:'research-resume-project-setup';version:1|2;exportedAt:string;projects:SetupProject[]}
export interface SetupPreview {token:string;fileName:string;projects:(SetupProject&{existingProjectId?:string;existingFolders?:string[]})[]}
export interface SetupChoice {originId:string;action:'add'|'update';folders:string[];threadIds:string[]}
export interface SetupOutcome {added:number;updated:number;warnings:string[]}
