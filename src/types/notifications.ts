/**
 * Notification Types
 *
 * TypeScript type definitions for push notification system
 */

// Device registration types
export interface DeviceRegistration {
  deviceToken: string;
  platform: 'ios' | 'android';
  deviceType: 'apns' | 'fcm';
  userId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Notification payload types
export interface NotificationPayload {
  title: string;
  body: string;
  data?: NotificationData;
  badge?: number;
  sound?: string;
}

// Notification data that can be sent with push
export interface NotificationData {
  type: NotificationType;
  id?: string;
  screen?: string;
  eventId?: string;
  userId?: string;
  venueId?: string;
  spaceId?: string;
  // Backend-specific fields
  senderId?: string;
  senderUsername?: string;
  accepterId?: string;
  accepterUsername?: string;
  postId?: string;
  eventName?: string;
  commenterUsername?: string;
  [key: string]: string | undefined;
}

// Types of notifications supported
export type NotificationType =
  | 'friend_request'
  | 'friend_accepted'
  | 'event_update'
  | 'event_reminder'
  | 'event_invitation'
  | 'event_roster'
  | 'community_note'
  | 'venue_update'
  | 'space_update'
  | 'general';

// User notification preferences (stored in MongoDB)
export interface NotificationPreferences {
  userId: string;
  enabled: boolean;
  friendRequests: boolean;
  eventUpdates: boolean;
  eventReminders: boolean;
  communityNotes: boolean;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string; // e.g., "22:00"
  quietHoursEnd?: string; // e.g., "07:00"
}

// API request/response types
export interface RegisterDeviceRequest {
  deviceToken: string;
  platform: 'ios' | 'android';
  deviceType: 'apns' | 'fcm';
}

export interface RegisterDeviceResponse {
  success: boolean;
  message: string;
}

export interface UnregisterDeviceRequest {
  deviceToken: string;
  platform: 'ios' | 'android';
}

export interface UnregisterDeviceResponse {
  success: boolean;
  message: string;
}

export interface UpdatePreferencesRequest {
  enabled?: boolean;
  friendRequests?: boolean;
  eventUpdates?: boolean;
  eventReminders?: boolean;
  communityNotes?: boolean;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

export interface GetPreferencesResponse {
  success: boolean;
  preferences: NotificationPreferences;
}

// Push notification send request (for backend)
export interface SendNotificationRequest {
  userId: string;
  notification: NotificationPayload;
}

export interface SendBulkNotificationRequest {
  userIds: string[];
  notification: NotificationPayload;
}

// Notification history (stored in MongoDB)
export interface NotificationRecord {
  _id?: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: NotificationData;
  read: boolean;
  createdAt: Date;
  readAt?: Date;
}

// In-app notification list response
export interface NotificationListResponse {
  success: boolean;
  notifications: NotificationRecord[];
  unreadCount: number;
  hasMore: boolean;
}

// Mark notification as read
export interface MarkReadRequest {
  notificationIds: string[];
}

export interface MarkReadResponse {
  success: boolean;
  updatedCount: number;
}
