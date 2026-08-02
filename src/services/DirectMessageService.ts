// API client for direct messaging. Mirrors the routes mounted under /dm
// in BetterPlay-BE/routes/dm.ts, and follows the same Bearer-token
// pattern as GroupChatService.

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_BASE_URL, IMAGE_UPLOAD_URL} from '../config/api';
import {
  Conversation,
  DirectMessage,
  DirectMessageReaction,
  DmUnreadCounts,
} from '../types/dm';
import {MessageReactor} from './GroupChatService';

const authHeaders = async () => {
  const token = await AsyncStorage.getItem('userToken');
  return token ? {Authorization: `Bearer ${token}`} : {};
};

// Find-or-create the thread with someone. Safe to call every time the
// user taps "Message": the backend keys on the participant pair, so this
// resolves to the same thread no matter which side opens it.
export const openConversation = async (
  userId: string,
): Promise<Conversation> => {
  const headers = await authHeaders();
  const res = await axios.post(
    `${API_BASE_URL}/dm/conversations`,
    {userId},
    {headers},
  );
  return res.data?.conversation as Conversation;
};

// Accepted threads with at least one message, most recent first.
export const fetchConversations = async (): Promise<Conversation[]> => {
  const headers = await authHeaders();
  const res = await axios.get(`${API_BASE_URL}/dm/conversations`, {headers});
  return (res.data?.conversations || []) as Conversation[];
};

// Pending threads a non-friend opened with me, awaiting my decision.
export const fetchMessageRequests = async (): Promise<Conversation[]> => {
  const headers = await authHeaders();
  const res = await axios.get(`${API_BASE_URL}/dm/requests`, {headers});
  return (res.data?.requests || []) as Conversation[];
};

export const fetchDmUnreadCounts = async (): Promise<DmUnreadCounts> => {
  const headers = await authHeaders();
  const res = await axios.get(`${API_BASE_URL}/dm/unread-count`, {headers});
  return {
    unread: res.data?.unread || 0,
    unreadThreads: res.data?.unreadThreads || 0,
    requests: res.data?.requests || 0,
  };
};

export const fetchConversation = async (
  conversationId: string,
): Promise<Conversation> => {
  const headers = await authHeaders();
  const res = await axios.get(
    `${API_BASE_URL}/dm/conversations/${conversationId}`,
    {headers},
  );
  return res.data?.conversation as Conversation;
};

export interface FetchDirectMessagesResult {
  messages: DirectMessage[];
  hasMore: boolean;
}

// Newest-first page. Pass `before` (an ISO createdAt) to page backwards
// into older history.
export const fetchDirectMessages = async (
  conversationId: string,
  opts?: {before?: string; limit?: number},
): Promise<FetchDirectMessagesResult> => {
  const headers = await authHeaders();
  const res = await axios.get(
    `${API_BASE_URL}/dm/conversations/${conversationId}/messages`,
    {
      headers,
      params: {
        before: opts?.before,
        limit: opts?.limit ?? 30,
      },
    },
  );
  return {
    messages: (res.data?.messages || []) as DirectMessage[],
    hasMore: !!res.data?.hasMore,
  };
};

export interface SendDirectMessageOptions {
  text?: string;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
}

export const sendDirectMessage = async (
  conversationId: string,
  opts: SendDirectMessageOptions,
): Promise<DirectMessage> => {
  const headers = await authHeaders();
  const res = await axios.post(
    `${API_BASE_URL}/dm/conversations/${conversationId}/messages`,
    {
      text: opts.text ?? '',
      imageUrl: opts.imageUrl,
      imageWidth: opts.imageWidth,
      imageHeight: opts.imageHeight,
    },
    {headers},
  );
  return res.data?.message as DirectMessage;
};

export const markConversationRead = async (
  conversationId: string,
): Promise<void> => {
  const headers = await authHeaders();
  await axios.post(
    `${API_BASE_URL}/dm/conversations/${conversationId}/read`,
    {},
    {headers},
  );
};

// Retracts one of my own messages. Soft delete server-side, so the
// tombstone stays in both people's threads.
export const deleteDirectMessage = async (
  conversationId: string,
  messageId: string,
): Promise<void> => {
  const headers = await authHeaders();
  await axios.delete(
    `${API_BASE_URL}/dm/conversations/${conversationId}/messages/${messageId}`,
    {headers},
  );
};

// Who reacted to a message, and with what. Resolved server-side so we
// don't have to turn ids into names on the client.
export const fetchDmMessageReactions = async (
  conversationId: string,
  messageId: string,
): Promise<MessageReactor[]> => {
  const headers = await authHeaders();
  const res = await axios.get(
    `${API_BASE_URL}/dm/conversations/${conversationId}/messages/${messageId}/reactions`,
    {headers},
  );
  return (res.data?.reactions || []) as MessageReactor[];
};

// Toggles one (me, emoji) pair and returns the message's full reaction
// list as the server now sees it.
export const reactToDirectMessage = async (
  conversationId: string,
  messageId: string,
  emoji: string,
): Promise<DirectMessageReaction[]> => {
  const headers = await authHeaders();
  const res = await axios.post(
    `${API_BASE_URL}/dm/conversations/${conversationId}/messages/${messageId}/react`,
    {emoji},
    {headers},
  );
  return (res.data?.reactions || []) as DirectMessageReaction[];
};

// Removes the thread from my inbox only — the other person keeps theirs.
// If they write again it comes back, showing just the new messages.
export const deleteConversation = async (
  conversationId: string,
): Promise<void> => {
  const headers = await authHeaders();
  await axios.delete(`${API_BASE_URL}/dm/conversations/${conversationId}`, {
    headers,
  });
};

// Requests I turned down. They're absent from both the inbox and the
// Requests tab, so this is the only way to find them again — it backs
// the "declined" half of the blocked-and-declined settings screen.
export const fetchDeclinedConversations = async (): Promise<Conversation[]> => {
  const headers = await authHeaders();
  const res = await axios.get(`${API_BASE_URL}/dm/declined`, {headers});
  return (res.data?.declined || []) as Conversation[];
};

// The recipient's verdict on a message request. Accepting moves it into
// the real inbox; declining hides it and stops the sender writing again.
// Accepting also doubles as the undo for a decline — the backend allows
// it on an already-declined thread.
export const acceptConversation = async (
  conversationId: string,
): Promise<void> => {
  const headers = await authHeaders();
  await axios.post(
    `${API_BASE_URL}/dm/conversations/${conversationId}/accept`,
    {},
    {headers},
  );
};

export const declineConversation = async (
  conversationId: string,
): Promise<void> => {
  const headers = await authHeaders();
  await axios.post(
    `${API_BASE_URL}/dm/conversations/${conversationId}/decline`,
    {},
    {headers},
  );
};

// Same upload Lambda the group chat and profile pictures use; only the
// resulting hosted URL is ever sent to our backend.
export const uploadDmImage = async (
  base64: string,
  fileName?: string,
): Promise<string> => {
  const res = await axios.post(IMAGE_UPLOAD_URL, {
    image: base64,
    fileName: fileName || 'dm-photo.jpg',
  });
  const url = res.data?.url;
  if (!url) {
    throw new Error('Image upload did not return a URL');
  }
  return String(url);
};
