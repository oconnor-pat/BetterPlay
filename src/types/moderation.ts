// Shapes for blocking and reporting. Mirrors BetterPlay-BE/models/block.ts
// and models/report.ts.

export interface BlockedUser {
  userId: string;
  username: string;
  name?: string;
  profilePicUrl?: string;
  blockedAt: string;
}

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate_speech'
  | 'sexual_content'
  | 'violence'
  | 'impersonation'
  | 'other';

export const REPORT_REASONS: ReportReason[] = [
  'harassment',
  'spam',
  'hate_speech',
  'sexual_content',
  'violence',
  'impersonation',
  'other',
];

export type ReportTarget =
  | 'user'
  | 'direct_message'
  | 'group_message'
  | 'event'
  | 'community_note';

export type ReportStatus = 'open' | 'reviewed' | 'actioned' | 'dismissed';

export interface ReportInput {
  reportedUserId: string;
  target: ReportTarget;
  contentId?: string;
  reason: ReportReason;
  details?: string;
}

interface ReportParty {
  _id: string;
  username: string;
  name?: string;
  profilePicUrl?: string;
}

export interface AdminReport {
  _id: string;
  target: ReportTarget;
  contentId?: string;
  contentSnapshot?: string;
  reason: ReportReason;
  details?: string;
  status: ReportStatus;
  createdAt: string;
  reviewedAt?: string;
  moderatorNote?: string;
  reporter: ReportParty | null;
  reportedUser: ReportParty | null;
  reportedUserId: string;
}
