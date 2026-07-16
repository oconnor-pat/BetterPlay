// Type definitions for the Groups feature. A Group is a named, persistent
// roster of people the user plans with regularly — used as a one-tap
// invite affordance in event creation and (for recurring events) as a
// live audience.
//
// Keep this file in sync with `BetterPlay-BE/models/group.ts`.

export type GroupRole = 'admin' | 'member';

export type GroupPrivacy = 'private' | 'public';

// Member as returned by the backend after hydration. The base record on
// the Group document is just {userId, role, joinedAt}; the BE hydrates
// it with the user's display fields (username, name, profilePicUrl) at
// read time so renamed/repictured users always look right.
export interface GroupMember {
  userId: string;
  role: GroupRole;
  joinedAt: string;
  username?: string;
  name?: string;
  profilePicUrl?: string;
}

// Compact preview of the most recent chat message, returned on the
// Groups list so each row can show a one-line preview + unread badge.
export interface GroupLastMessage {
  text: string;
  kind: 'text' | 'system';
  username?: string;
  senderId: string;
  createdAt: string;
}

// Minimal event shape surfaced on GroupDetail's "upcoming" strip.
export interface GroupUpcomingEvent {
  _id: string;
  name: string;
  date: string;
  time?: string;
  location?: string;
  eventType?: string;
  rosterSpotsFilled?: number;
  totalSpots?: number;
}

export interface Group {
  _id: string;
  name: string;
  createdBy: string;
  privacy: GroupPrivacy;
  members: GroupMember[];
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  // Chat enrichment (present on GET /groups/mine).
  unreadCount?: number;
  lastMessage?: GroupLastMessage | null;
  // Hub enrichment (present on GET /groups/:id).
  upcomingEvents?: GroupUpcomingEvent[];
}

export interface GroupMessageEventRef {
  eventId: string;
  eventName?: string;
  eventDate?: string;
}

export interface GroupMessage {
  _id: string;
  groupId: string;
  userId: string;
  username?: string;
  profilePicUrl?: string;
  text: string;
  kind: 'text' | 'system';
  eventRef?: GroupMessageEventRef;
  createdAt: string;
}

export interface CreateGroupPayload {
  name: string;
  privacy?: GroupPrivacy;
  memberIds?: string[];
}
