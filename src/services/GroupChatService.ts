// API client for the group chat feature. Mirrors the message routes
// mounted under /groups/:id in BetterPlay-BE/routes/groups.ts. Follows
// the same Bearer-token pattern as GroupsService.

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_BASE_URL, IMAGE_UPLOAD_URL} from '../config/api';
import {GroupMessage, GroupMessageReaction} from '../types/group';

const authHeaders = async () => {
  const token = await AsyncStorage.getItem('userToken');
  return token ? {Authorization: `Bearer ${token}`} : {};
};

export interface FetchMessagesResult {
  messages: GroupMessage[];
  hasMore: boolean;
}

// Newest-first page. Pass `before` (an ISO createdAt) to page backwards
// into older history.
export const fetchGroupMessages = async (
  groupId: string,
  opts?: {before?: string; limit?: number},
): Promise<FetchMessagesResult> => {
  const headers = await authHeaders();
  const res = await axios.get(`${API_BASE_URL}/groups/${groupId}/messages`, {
    headers,
    params: {
      before: opts?.before,
      limit: opts?.limit ?? 30,
    },
  });
  return {
    messages: (res.data?.messages || []) as GroupMessage[],
    hasMore: !!res.data?.hasMore,
  };
};

export interface SendMessageOptions {
  text?: string;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
}

// A message needs text, an image, or both. Images are uploaded to the
// image Lambda first (see uploadChatImage) and only the resulting URL is
// sent here, matching how profile pictures already work.
export const sendGroupMessage = async (
  groupId: string,
  opts: SendMessageOptions,
): Promise<GroupMessage> => {
  const headers = await authHeaders();
  const res = await axios.post(
    `${API_BASE_URL}/groups/${groupId}/messages`,
    {
      text: opts.text ?? '',
      imageUrl: opts.imageUrl,
      imageWidth: opts.imageWidth,
      imageHeight: opts.imageHeight,
    },
    {headers},
  );
  return res.data?.message as GroupMessage;
};

export const deleteGroupMessage = async (
  groupId: string,
  messageId: string,
): Promise<void> => {
  const headers = await authHeaders();
  await axios.delete(
    `${API_BASE_URL}/groups/${groupId}/messages/${messageId}`,
    {headers},
  );
};

export interface MessageReactor {
  userId: string;
  emoji: string;
  username?: string;
  name?: string;
  profilePicUrl?: string;
}

// Who reacted to a message, and with what. Resolved server-side so we
// don't have to pull the user list to turn ids into names.
export const fetchMessageReactions = async (
  groupId: string,
  messageId: string,
): Promise<MessageReactor[]> => {
  const headers = await authHeaders();
  const res = await axios.get(
    `${API_BASE_URL}/groups/${groupId}/messages/${messageId}/reactions`,
    {headers},
  );
  return (res.data?.reactions || []) as MessageReactor[];
};

// Toggles one (me, emoji) pair and returns the message's full reaction
// list as the server now sees it.
export const reactToGroupMessage = async (
  groupId: string,
  messageId: string,
  emoji: string,
): Promise<GroupMessageReaction[]> => {
  const headers = await authHeaders();
  const res = await axios.post(
    `${API_BASE_URL}/groups/${groupId}/messages/${messageId}/react`,
    {emoji},
    {headers},
  );
  return (res.data?.reactions || []) as GroupMessageReaction[];
};

// Push a base64 image through the same upload Lambda that profile
// pictures use and hand back the hosted URL. Deliberately unauthenticated
// (the Lambda is), so only the returned URL ever reaches our backend.
export const uploadChatImage = async (
  base64: string,
  fileName?: string,
): Promise<string> => {
  const res = await axios.post(IMAGE_UPLOAD_URL, {
    image: base64,
    fileName: fileName || 'chat-photo.jpg',
  });
  const url = res.data?.url;
  if (!url) {
    throw new Error('Image upload did not return a URL');
  }
  return String(url);
};

export const markGroupRead = async (groupId: string): Promise<void> => {
  const headers = await authHeaders();
  await axios.post(`${API_BASE_URL}/groups/${groupId}/read`, {}, {headers});
};
