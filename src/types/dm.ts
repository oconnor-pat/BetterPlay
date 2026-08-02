// Type definitions for direct messaging — 1-to-1 threads between users.
//
// Anyone can message anyone (the public-event "LFG" flow depends on being
// able to reach a stranger), so a thread opened by a non-friend starts as
// a *request* and lands in a separate Requests inbox until the recipient
// accepts it. Threads between friends skip that step.
//
// Keep this file in sync with `BetterPlay-BE/models/conversation.ts` and
// `BetterPlay-BE/models/directMessage.ts`.

export type ConversationStatus = 'pending' | 'accepted' | 'declined';

// The far side of a thread. Resolved server-side so the client never has
// to work out which participant isn't them.
export interface ConversationUser {
  userId: string;
  username?: string;
  name?: string;
  profilePicUrl?: string;
}

// Compact preview for the inbox row.
export interface ConversationLastMessage {
  text: string;
  senderId: string;
  // `text` is empty for a photo-only or deleted message; these say which,
  // so the preview can be localized on the client.
  hasImage?: boolean;
  deleted?: boolean;
  createdAt: string;
}

export interface Conversation {
  _id: string;
  status: ConversationStatus;
  requestedBy: string;
  // True when this is a request waiting on *my* decision, as opposed to
  // one I sent that's waiting on theirs.
  isIncomingRequest: boolean;
  // True when I sent the request and it hasn't been answered yet.
  isOutgoingRequest: boolean;
  // True when I'm the one who was declined: the thread is readable but
  // closed to me, and the composer is replaced by a notice.
  isClosedToMe: boolean;
  otherUser: ConversationUser;
  lastMessage: ConversationLastMessage | null;
  lastMessageAt?: string;
  unreadCount: number;
  createdAt: string;
}

export interface DirectMessageReaction {
  userId: string;
  emoji: string;
}

export interface DirectMessage {
  _id: string;
  conversationId: string;
  senderId: string;
  username?: string;
  profilePicUrl?: string;
  text: string;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  reactions?: DirectMessageReaction[];
  // Soft-deleted messages keep their slot in the thread but arrive with
  // their content stripped; the FE renders a placeholder.
  deletedAt?: string;
  createdAt: string;
}

// Payload of the `dm:activity` socket event — enough to update an inbox
// row in place without refetching the list.
export interface DmActivity {
  conversationId: string;
  senderId: string;
  status: ConversationStatus;
  lastMessage: ConversationLastMessage;
}

export interface DmUnreadCounts {
  unread: number;
  unreadThreads: number;
  requests: number;
}
