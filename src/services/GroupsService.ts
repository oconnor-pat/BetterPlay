// API client for the Groups feature. Mirrors the backend routes mounted
// at /groups in BetterPlay-BE/app.ts.

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_BASE_URL} from '../config/api';
import {CreateGroupPayload, Group, GroupRole} from '../types/group';

const authHeaders = async () => {
  const token = await AsyncStorage.getItem('userToken');
  return token ? {Authorization: `Bearer ${token}`} : {};
};

export const listMyGroups = async (): Promise<Group[]> => {
  const headers = await authHeaders();
  const res = await axios.get(`${API_BASE_URL}/groups/mine`, {headers});
  return (res.data?.groups || []) as Group[];
};

export const getGroup = async (groupId: string): Promise<Group> => {
  const headers = await authHeaders();
  const res = await axios.get(`${API_BASE_URL}/groups/${groupId}`, {headers});
  return res.data?.group as Group;
};

export const createGroup = async (
  payload: CreateGroupPayload,
): Promise<Group> => {
  const headers = await authHeaders();
  const res = await axios.post(`${API_BASE_URL}/groups`, payload, {headers});
  return res.data?.group as Group;
};

export const deleteGroup = async (groupId: string): Promise<void> => {
  const headers = await authHeaders();
  await axios.delete(`${API_BASE_URL}/groups/${groupId}`, {headers});
};

export interface UpdateGroupPayload {
  name?: string;
  privacy?: 'private' | 'public';
}

export const updateGroup = async (
  groupId: string,
  payload: UpdateGroupPayload,
): Promise<Group> => {
  const headers = await authHeaders();
  const res = await axios.patch(`${API_BASE_URL}/groups/${groupId}`, payload, {
    headers,
  });
  return res.data?.group as Group;
};

export const addGroupMember = async (
  groupId: string,
  userId: string,
): Promise<Group> => {
  const headers = await authHeaders();
  const res = await axios.post(
    `${API_BASE_URL}/groups/${groupId}/members`,
    {userId},
    {headers},
  );
  return res.data?.group as Group;
};

export const removeGroupMember = async (
  groupId: string,
  userId: string,
): Promise<Group> => {
  const headers = await authHeaders();
  const res = await axios.delete(
    `${API_BASE_URL}/groups/${groupId}/members/${userId}`,
    {headers},
  );
  return res.data?.group as Group;
};

export const setGroupMemberRole = async (
  groupId: string,
  userId: string,
  role: GroupRole,
): Promise<Group> => {
  const headers = await authHeaders();
  const res = await axios.patch(
    `${API_BASE_URL}/groups/${groupId}/members/${userId}`,
    {role},
    {headers},
  );
  return res.data?.group as Group;
};

export const transferGroupOwnership = async (
  groupId: string,
  successorId: string,
): Promise<Group> => {
  const headers = await authHeaders();
  const res = await axios.post(
    `${API_BASE_URL}/groups/${groupId}/transfer`,
    {userId: successorId},
    {headers},
  );
  return res.data?.group as Group;
};
