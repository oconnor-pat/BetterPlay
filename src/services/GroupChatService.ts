// API client for the group chat feature. Mirrors the message routes
// mounted under /groups/:id in BetterPlay-BE/routes/groups.ts. Follows
// the same Bearer-token pattern as GroupsService.

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_BASE_URL} from '../config/api';
import {GroupMessage} from '../types/group';

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

export const sendGroupMessage = async (
  groupId: string,
  text: string,
): Promise<GroupMessage> => {
  const headers = await authHeaders();
  const res = await axios.post(
    `${API_BASE_URL}/groups/${groupId}/messages`,
    {text},
    {headers},
  );
  return res.data?.message as GroupMessage;
};

export const markGroupRead = async (groupId: string): Promise<void> => {
  const headers = await authHeaders();
  await axios.post(
    `${API_BASE_URL}/groups/${groupId}/read`,
    {},
    {headers},
  );
};
