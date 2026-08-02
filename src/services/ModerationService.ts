// API client for blocking and reporting. Mirrors BetterPlay-BE
// routes/blocks.ts and routes/reports.ts, and follows the same
// Bearer-token pattern as the other services.

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_BASE_URL} from '../config/api';
import {
  AdminReport,
  BlockedUser,
  ReportInput,
  ReportStatus,
} from '../types/moderation';

const authHeaders = async () => {
  const token = await AsyncStorage.getItem('userToken');
  return token ? {Authorization: `Bearer ${token}`} : {};
};

export const blockUser = async (userId: string): Promise<void> => {
  const headers = await authHeaders();
  await axios.post(`${API_BASE_URL}/users/${userId}/block`, {}, {headers});
};

export const unblockUser = async (userId: string): Promise<void> => {
  const headers = await authHeaders();
  await axios.delete(`${API_BASE_URL}/users/${userId}/block`, {headers});
};

export const fetchBlockedUsers = async (): Promise<BlockedUser[]> => {
  const headers = await authHeaders();
  const res = await axios.get(`${API_BASE_URL}/users/me/blocked`, {headers});
  return (res.data?.blocked || []) as BlockedUser[];
};

// Whether *I* have blocked them. Deliberately says nothing about the
// other direction; see the route for why.
export const fetchBlockStatus = async (userId: string): Promise<boolean> => {
  const headers = await authHeaders();
  const res = await axios.get(`${API_BASE_URL}/users/${userId}/block-status`, {
    headers,
  });
  return !!res.data?.blocked;
};

export const submitReport = async (input: ReportInput): Promise<void> => {
  const headers = await authHeaders();
  await axios.post(`${API_BASE_URL}/reports`, input, {headers});
};

export const fetchAdminReports = async (
  status: ReportStatus | 'all' = 'open',
): Promise<{reports: AdminReport[]; openCount: number}> => {
  const headers = await authHeaders();
  const res = await axios.get(`${API_BASE_URL}/admin/reports`, {
    headers,
    params: {status},
  });
  return {
    reports: (res.data?.reports || []) as AdminReport[],
    openCount: res.data?.openCount || 0,
  };
};

export const updateReportStatus = async (
  reportId: string,
  status: ReportStatus,
  moderatorNote?: string,
): Promise<void> => {
  const headers = await authHeaders();
  await axios.patch(
    `${API_BASE_URL}/admin/reports/${reportId}`,
    {status, moderatorNote},
    {headers},
  );
};
