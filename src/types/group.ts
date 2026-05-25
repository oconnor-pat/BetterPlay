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

export interface Group {
  _id: string;
  name: string;
  createdBy: string;
  privacy: GroupPrivacy;
  members: GroupMember[];
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGroupPayload {
  name: string;
  privacy?: GroupPrivacy;
  memberIds?: string[];
}
