import type {ReviewAction,WorkItem} from './compass-types';
export const reviewLabels:Record<ReviewAction,string>={request_changes:'Request changes',approve_continue:'Approve and continue',approve_finish:'Approve and finish'};
export const pendingReview=(item:WorkItem)=>item.reviews?.find(r=>r.id===item.pendingReviewId);
export const canReview=(item:WorkItem)=>!item.archivedAt&&!item.completedAt&&(item.assignee==='kai'||item.assignee==='codex')&&(item.workStatus==='awaiting_review'||item.workStatus==='needs_input');
