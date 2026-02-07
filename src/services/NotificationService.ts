/**
 * NotificationService.ts
 *
 * Centralized push notification handling for iOS (and future Android support)
 * Uses @notifee/react-native for local notifications and
 * @react-native-firebase/messaging for APNs/FCM integration
 */

import messaging, {
  FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import notifee, {
  AndroidImportance,
  AuthorizationStatus,
  EventType,
  Event,
} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Platform, Alert} from 'react-native';
import {API_BASE_URL} from '../config/api';

// Storage keys
const DEVICE_TOKEN_KEY = 'pushNotificationDeviceToken';
const NOTIFICATION_PERMISSION_KEY = 'notificationPermissionStatus';

// Notification channel ID for Android (will be used later)
const ANDROID_CHANNEL_ID = 'betterplay-default';

// Types
export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface NotificationSettings {
  enabled: boolean;
  friendRequests: boolean;
  eventUpdates: boolean;
  eventReminders: boolean;
  communityNotes: boolean;
}

export type NotificationNavigationCallback = (
  screen: string,
  params?: Record<string, unknown>,
) => void;

// Default notification settings
const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  friendRequests: true,
  eventUpdates: true,
  eventReminders: true,
  communityNotes: true,
};

class NotificationService {
  private navigationCallback: NotificationNavigationCallback | null = null;
  private isInitialized = false;
  private pendingNotificationData: Record<string, string> | null = null;

  /**
   * Initialize the notification service
   * Should be called early in app lifecycle (App.tsx)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Create Android notification channel (no-op on iOS)
      await this.createNotificationChannel();

      // Set up message handlers
      this.setupMessageHandlers();

      // Set up notifee foreground event handler
      this.setupNotifeeHandlers();

      // Check if permission already granted and register token
      // This ensures token is registered on app launch (not just when requesting permission)
      const status = await this.checkPermissionStatus();
      if (
        status === AuthorizationStatus.AUTHORIZED ||
        status === AuthorizationStatus.PROVISIONAL
      ) {
        await this.getAndRegisterToken();
      }

      this.isInitialized = true;
      console.log('NotificationService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize NotificationService:', error);
    }
  }

  /**
   * Request notification permissions from the user
   * Returns true if permission was granted
   */
  async requestPermission(): Promise<boolean> {
    try {
      // Request permission from Firebase Messaging (handles APNs on iOS)
      const authStatus = await messaging().requestPermission();

      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      // Store permission status
      await AsyncStorage.setItem(
        NOTIFICATION_PERMISSION_KEY,
        enabled ? 'granted' : 'denied',
      );

      if (enabled) {
        console.log('Notification permission granted');
        // Get and register the device token
        await this.getAndRegisterToken();
      } else {
        console.log('Notification permission denied');
      }

      return enabled;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  /**
   * Check current notification permission status
   */
  async checkPermissionStatus(): Promise<AuthorizationStatus> {
    try {
      const settings = await notifee.getNotificationSettings();
      return settings.authorizationStatus;
    } catch (error) {
      console.error('Error checking permission status:', error);
      return AuthorizationStatus.DENIED;
    }
  }

  /**
   * Get the FCM/APNs device token
   */
  async getDeviceToken(): Promise<string | null> {
    try {
      // For iOS, check if we have APNs token (auto-registered by Firebase)
      if (Platform.OS === 'ios') {
        // Get APNs token - Firebase auto-registers for remote messages
        const apnsToken = await messaging().getAPNSToken();
        if (!apnsToken) {
          console.warn('APNs token not yet available');
          // Token might not be ready yet, continue to try FCM token
        }
      }

      // Get FCM token (works for both platforms)
      const fcmToken = await messaging().getToken();
      return fcmToken;
    } catch (error) {
      console.error('Error getting device token:', error);
      return null;
    }
  }

  /**
   * Get token and register with backend
   */
  async getAndRegisterToken(): Promise<string | null> {
    try {
      const token = await this.getDeviceToken();

      if (token) {
        // Cache token locally
        await AsyncStorage.setItem(DEVICE_TOKEN_KEY, token);

        // Register with backend
        await this.registerTokenWithBackend(token);

        return token;
      }

      return null;
    } catch (error) {
      console.error('Error getting and registering token:', error);
      return null;
    }
  }

  /**
   * Ensure device token is registered with backend
   * Call this after login/registration to ensure token is registered
   * even if permission was granted before user was authenticated
   */
  async ensureTokenRegistered(): Promise<void> {
    try {
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        console.log('No user token, cannot register device');
        return;
      }

      // Check if we already have a cached device token
      const cachedDeviceToken = await AsyncStorage.getItem(DEVICE_TOKEN_KEY);
      if (cachedDeviceToken) {
        // Re-register the cached token with backend
        console.log('Re-registering cached device token with backend');
        await this.registerTokenWithBackend(cachedDeviceToken);
      } else {
        // No cached token, try to get a new one
        const status = await this.checkPermissionStatus();
        if (
          status === AuthorizationStatus.AUTHORIZED ||
          status === AuthorizationStatus.PROVISIONAL
        ) {
          console.log('Getting and registering new device token');
          await this.getAndRegisterToken();
        } else {
          console.log(
            'Notification permission not granted, skipping token registration',
          );
        }
      }
    } catch (error) {
      console.error('Error ensuring token registration:', error);
    }
  }

  /**
   * Register device token with backend
   */
  async registerTokenWithBackend(deviceToken: string): Promise<boolean> {
    try {
      const userToken = await AsyncStorage.getItem('userToken');

      if (!userToken) {
        console.log('No user token found, skipping backend registration');
        return false;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/notifications/register-device`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${userToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            deviceToken,
            platform: Platform.OS,
            deviceType: Platform.OS === 'ios' ? 'apns' : 'fcm',
          }),
        },
      );

      if (response.ok) {
        console.log('Device token registered with backend successfully');
        return true;
      } else {
        console.error('Failed to register device token with backend');
        return false;
      }
    } catch (error) {
      console.error('Error registering token with backend:', error);
      return false;
    }
  }

  /**
   * Unregister device token from backend (call on logout)
   */
  async unregisterDevice(): Promise<void> {
    try {
      const deviceToken = await AsyncStorage.getItem(DEVICE_TOKEN_KEY);
      const userToken = await AsyncStorage.getItem('userToken');

      if (deviceToken && userToken) {
        await fetch(`${API_BASE_URL}/api/notifications/unregister-device`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${userToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            deviceToken,
            platform: Platform.OS,
          }),
        });
      }

      // Clear local token
      await AsyncStorage.removeItem(DEVICE_TOKEN_KEY);
      console.log('Device unregistered from notifications');
    } catch (error) {
      console.error('Error unregistering device:', error);
    }
  }

  /**
   * Set navigation callback for handling notification taps
   * Also processes any pending notifications that arrived before navigation was ready
   */
  setNavigationCallback(callback: NotificationNavigationCallback): void {
    this.navigationCallback = callback;

    // Process any pending notification that arrived before navigation was ready
    if (this.pendingNotificationData) {
      console.log(
        'Processing pending notification:',
        this.pendingNotificationData,
      );
      this.handleNotificationData(this.pendingNotificationData);
      this.pendingNotificationData = null;
    }
  }

  /**
   * Create Android notification channel
   */
  private async createNotificationChannel(): Promise<void> {
    if (Platform.OS === 'android') {
      await notifee.createChannel({
        id: ANDROID_CHANNEL_ID,
        name: 'BetterPlay Notifications',
        importance: AndroidImportance.HIGH,
        vibration: true,
      });
    }
  }

  /**
   * Set up Firebase message handlers
   */
  private setupMessageHandlers(): void {
    // Handle messages received while app is in foreground
    messaging().onMessage(async remoteMessage => {
      console.log('Foreground message received:', remoteMessage);
      await this.displayNotification(remoteMessage);
    });

    // Handle notification opened from background state
    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('Notification opened app from background:', remoteMessage);
      this.handleNotificationNavigation(remoteMessage);
    });

    // Handle token refresh
    messaging().onTokenRefresh(async token => {
      console.log('FCM token refreshed');
      await AsyncStorage.setItem(DEVICE_TOKEN_KEY, token);
      await this.registerTokenWithBackend(token);
    });

    // Check if app was opened from a notification (killed state)
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log(
            'App opened from killed state via notification:',
            remoteMessage,
          );
          this.handleNotificationNavigation(remoteMessage);
        }
      });
  }

  /**
   * Set up Notifee event handlers
   */
  private setupNotifeeHandlers(): void {
    // Handle foreground notification events
    notifee.onForegroundEvent(({type, detail}: Event) => {
      switch (type) {
        case EventType.PRESS:
          console.log('Notification pressed:', detail.notification);
          if (detail.notification?.data) {
            this.handleNotificationData(
              detail.notification.data as Record<string, string>,
            );
          }
          break;
        case EventType.DISMISSED:
          console.log('Notification dismissed');
          break;
      }
    });
  }

  /**
   * Display a local notification (for foreground messages)
   */
  async displayNotification(
    remoteMessage: FirebaseMessagingTypes.RemoteMessage,
  ): Promise<void> {
    try {
      const {notification, data} = remoteMessage;

      if (!notification) {
        return;
      }

      await notifee.displayNotification({
        title: notification.title || 'BetterPlay',
        body: notification.body || '',
        data: data as Record<string, string>,
        ios: {
          foregroundPresentationOptions: {
            alert: true,
            badge: true,
            sound: true,
          },
        },
        android: {
          channelId: ANDROID_CHANNEL_ID,
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default',
          },
        },
      });
    } catch (error) {
      console.error('Error displaying notification:', error);
    }
  }

  /**
   * Display a custom local notification
   */
  async displayLocalNotification(payload: NotificationPayload): Promise<void> {
    try {
      await notifee.displayNotification({
        title: payload.title,
        body: payload.body,
        data: payload.data,
        ios: {
          foregroundPresentationOptions: {
            alert: true,
            badge: true,
            sound: true,
          },
        },
        android: {
          channelId: ANDROID_CHANNEL_ID,
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default',
          },
        },
      });
    } catch (error) {
      console.error('Error displaying local notification:', error);
    }
  }

  /**
   * Handle navigation based on notification data
   */
  private handleNotificationNavigation(
    remoteMessage: FirebaseMessagingTypes.RemoteMessage,
  ): void {
    const {data} = remoteMessage;

    if (data) {
      this.handleNotificationData(data as Record<string, string>);
    }
  }

  /**
   * Process notification data and navigate accordingly
   * Note: Navigation uses nested structure - first navigate to tab, then to screen within stack
   *
   * Navigation Structure:
   * - Tab.Navigator: Local, Venues, CommunityNotes, Profile
   *   - LocalEventsStack: EventList, EventRoster, PublicProfile, UserSearch
   *   - VenueStack: VenueList, VenueDetail, SpaceDetail
   *   - CommunityNotesStack: CommunityNotesList, PublicProfile
   *   - ProfileStack: ProfileMain, UserSearch, PublicProfile, FriendsList, FriendRequests
   *
   * Backend notification types and their data fields:
   * - friend_request: { senderId, senderUsername }
   * - friend_accepted: { accepterId, accepterUsername }
   * - event_update: { eventId, eventName }
   * - event_roster: { eventId, eventName } - when added to event roster
   * - event_reminder: { eventId, eventName }
   * - community_note: { postId, eventId?, commenterUsername? }
   */
  private handleNotificationData(data: Record<string, string>): void {
    if (!this.navigationCallback) {
      console.log(
        'Navigation callback not set, queueing notification for later',
      );
      this.pendingNotificationData = data;
      return;
    }

    // Extract all possible data fields from backend
    const {
      type,
      id,
      screen,
      eventId,
      userId,
      venueId,
      spaceId,
      // Backend-specific fields
      senderId,
      accepterId,
      postId,
    } = data;

    // Handle different notification types
    switch (type) {
      // Friend-related notifications -> Profile tab
      case 'friend_request':
        this.navigationCallback('Profile', {
          screen: 'FriendRequests',
          initial: false,
        });
        break;

      case 'friend_accepted':
        // Navigate to the friend's profile using accepterId (backend field) or userId
        const friendUserId = accepterId || userId;
        if (friendUserId) {
          this.navigationCallback('Profile', {
            screen: 'PublicProfile',
            params: {userId: friendUserId},
            initial: false,
          });
        } else {
          this.navigationCallback('Profile', {
            screen: 'FriendsList',
            initial: false,
          });
        }
        break;

      // Event-related notifications -> Local tab
      case 'event_update':
      case 'event_reminder':
      case 'event_invitation':
      case 'event_roster': // When user is added to an event roster
        // Use eventId from data, or fallback to generic id
        const targetEventId = eventId || id;
        if (targetEventId) {
          this.navigationCallback('Local', {
            screen: 'EventRoster',
            params: {eventId: targetEventId},
            initial: false,
          });
        } else {
          // No event ID, just go to event list
          this.navigationCallback('Local', {
            screen: 'EventList',
            initial: false,
          });
        }
        break;

      // Community note notifications -> CommunityNotes tab
      case 'community_note':
        // Backend sends postId, use it or fallback to id
        const noteId = postId || id;
        this.navigationCallback('CommunityNotes', {
          screen: 'CommunityNotesList',
          params: noteId ? {noteId} : undefined,
          initial: false,
        });
        break;

      // Venue-related notifications (if added in future)
      case 'venue_update':
        if (venueId) {
          this.navigationCallback('Venues', {
            screen: 'VenueDetail',
            params: {venueId},
            initial: false,
          });
        } else {
          this.navigationCallback('Venues', {
            screen: 'VenueList',
            initial: false,
          });
        }
        break;

      case 'space_update':
        if (spaceId && venueId) {
          this.navigationCallback('Venues', {
            screen: 'SpaceDetail',
            params: {spaceId, venueId},
            initial: false,
          });
        } else if (venueId) {
          this.navigationCallback('Venues', {
            screen: 'VenueDetail',
            params: {venueId},
            initial: false,
          });
        }
        break;

      // General notifications - just go to main screen or specified screen
      case 'general':
      default:
        // If a specific screen is specified in the data, navigate to it
        if (screen) {
          // Check if it's a nested screen path (e.g., "Profile/FriendRequests")
          const screenParts = screen.split('/');
          if (screenParts.length === 2) {
            this.navigationCallback(screenParts[0], {
              screen: screenParts[1],
              params: data,
              initial: false,
            });
          } else {
            // Try to navigate directly
            this.navigationCallback(screen, data);
          }
        }
        // If no screen specified for general/unknown, do nothing (app stays on current screen)
        break;
    }
  }

  /**
   * Get notification settings from storage
   */
  async getNotificationSettings(): Promise<NotificationSettings> {
    try {
      const settings = await AsyncStorage.getItem('notificationSettings');
      if (settings) {
        return {...DEFAULT_SETTINGS, ...JSON.parse(settings)};
      }
      return DEFAULT_SETTINGS;
    } catch (error) {
      console.error('Error getting notification settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * Update notification settings
   */
  async updateNotificationSettings(
    settings: Partial<NotificationSettings>,
  ): Promise<void> {
    try {
      const currentSettings = await this.getNotificationSettings();
      const newSettings = {...currentSettings, ...settings};
      await AsyncStorage.setItem(
        'notificationSettings',
        JSON.stringify(newSettings),
      );

      // Update backend with new preferences
      await this.syncSettingsWithBackend(newSettings);
    } catch (error) {
      console.error('Error updating notification settings:', error);
    }
  }

  /**
   * Sync notification preferences with backend
   */
  private async syncSettingsWithBackend(
    settings: NotificationSettings,
  ): Promise<void> {
    try {
      const userToken = await AsyncStorage.getItem('userToken');

      if (!userToken) {
        return;
      }

      await fetch(`${API_BASE_URL}/api/notifications/preferences`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
    } catch (error) {
      console.error('Error syncing settings with backend:', error);
    }
  }

  /**
   * Get badge count
   */
  async getBadgeCount(): Promise<number> {
    try {
      return await notifee.getBadgeCount();
    } catch (error) {
      console.error('Error getting badge count:', error);
      return 0;
    }
  }

  /**
   * Set badge count
   */
  async setBadgeCount(count: number): Promise<void> {
    try {
      await notifee.setBadgeCount(count);
    } catch (error) {
      console.error('Error setting badge count:', error);
    }
  }

  /**
   * Clear badge count
   */
  async clearBadgeCount(): Promise<void> {
    try {
      await notifee.setBadgeCount(0);
    } catch (error) {
      console.error('Error clearing badge count:', error);
    }
  }

  /**
   * Cancel all notifications
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      await notifee.cancelAllNotifications();
    } catch (error) {
      console.error('Error cancelling notifications:', error);
    }
  }

  /**
   * Prompt user to enable notifications in settings
   */
  promptEnableNotifications(): void {
    Alert.alert(
      'Enable Notifications',
      'To receive notifications about friend requests, events, and updates, please enable notifications in your device settings.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Open Settings',
          onPress: () => {
            if (Platform.OS === 'ios') {
              notifee.openNotificationSettings();
            }
          },
        },
      ],
    );
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
export default notificationService;
