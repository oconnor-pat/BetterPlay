/**
 * NotificationContext.tsx
 *
 * React Context for managing notification state throughout the app
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import notificationService, {
  NotificationSettings,
} from '../services/NotificationService';
import {AuthorizationStatus} from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_BASE_URL} from '../config/api';

// Navigation reference type
type NavigationRef = {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
};

// Types
interface NotificationContextType {
  // Permission state
  permissionStatus: AuthorizationStatus;
  hasPermission: boolean;

  // Settings
  settings: NotificationSettings;
  updateSettings: (settings: Partial<NotificationSettings>) => Promise<void>;

  // Actions
  requestPermission: () => Promise<boolean>;
  checkPermission: () => Promise<void>;

  // Badge
  badgeCount: number;
  setBadgeCount: (count: number) => void;
  clearBadge: () => Promise<void>;

  // Initialization
  isInitialized: boolean;

  // Navigation setter (to be called from within NavigationContainer)
  setNavigationRef: (ref: NavigationRef | null) => void;
}

interface NotificationProviderProps {
  children: ReactNode;
}

// Create context
const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

// Default settings
const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: true,
  friendRequests: true,
  eventUpdates: true,
  eventReminders: true,
  communityNotes: true,
};

/**
 * NotificationProvider component
 */
export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
}) => {
  const navigationRef = useRef<NavigationRef | null>(null);

  const [permissionStatus, setPermissionStatus] = useState<AuthorizationStatus>(
    AuthorizationStatus.NOT_DETERMINED,
  );
  const [settings, setSettings] =
    useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [badgeCount, setBadgeCount] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  // Computed permission state
  const hasPermission =
    permissionStatus === AuthorizationStatus.AUTHORIZED ||
    permissionStatus === AuthorizationStatus.PROVISIONAL;

  /**
   * Set navigation reference (called from within NavigationContainer)
   */
  const setNavigationRef = useCallback((ref: NavigationRef | null) => {
    navigationRef.current = ref;

    // Set up navigation callback when ref is available
    if (ref) {
      notificationService.setNavigationCallback((screen, params) => {
        try {
          ref.navigate(screen, params);
        } catch (error) {
          console.error('Navigation error:', error);
        }
      });
    }
  }, []);

  /**
   * Initialize notifications
   */
  const initializeNotifications = useCallback(async () => {
    try {
      // Initialize the notification service
      await notificationService.initialize();

      // Check current permission status
      const status = await notificationService.checkPermissionStatus();
      setPermissionStatus(status);

      // Load saved settings
      const savedSettings = await notificationService.getNotificationSettings();
      setSettings(savedSettings);

      // Get unread count from backend (source of truth)
      try {
        const token = await AsyncStorage.getItem('userToken');
        if (token) {
          const response = await fetch(
            `${API_BASE_URL}/api/notifications/unread-count`,
            {
              headers: {Authorization: `Bearer ${token}`},
            },
          );
          if (response.ok) {
            const data = await response.json();
            setBadgeCount(data.count || 0);
          } else {
            setBadgeCount(0);
          }
        } else {
          setBadgeCount(0);
        }
      } catch {
        // Fallback to OS badge count if backend is unreachable
        const count = await notificationService.getBadgeCount();
        setBadgeCount(count);
      }

      setIsInitialized(true);
    } catch (error) {
      console.error('Error initializing notifications:', error);
      setIsInitialized(true); // Set to true even on error to prevent infinite loading
    }
  }, []);

  /**
   * Request notification permission
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const granted = await notificationService.requestPermission();

      // Update permission status
      const status = await notificationService.checkPermissionStatus();
      setPermissionStatus(status);

      return granted;
    } catch (error) {
      console.error('Error requesting permission:', error);
      return false;
    }
  }, []);

  /**
   * Check current permission status
   */
  const checkPermission = useCallback(async (): Promise<void> => {
    try {
      const status = await notificationService.checkPermissionStatus();
      setPermissionStatus(status);
    } catch (error) {
      console.error('Error checking permission:', error);
    }
  }, []);

  /**
   * Update notification settings
   */
  const updateSettings = useCallback(
    async (newSettings: Partial<NotificationSettings>): Promise<void> => {
      try {
        await notificationService.updateNotificationSettings(newSettings);
        setSettings(prev => ({...prev, ...newSettings}));
      } catch (error) {
        console.error('Error updating settings:', error);
      }
    },
    [],
  );

  /**
   * Clear badge count
   */
  const clearBadge = useCallback(async (): Promise<void> => {
    try {
      await notificationService.clearBadgeCount();
      setBadgeCount(0);
    } catch (error) {
      console.error('Error clearing badge:', error);
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    initializeNotifications();
  }, [initializeNotifications]);

  // Context value
  const contextValue: NotificationContextType = {
    permissionStatus,
    hasPermission,
    settings,
    updateSettings,
    requestPermission,
    checkPermission,
    badgeCount,
    setBadgeCount,
    clearBadge,
    isInitialized,
    setNavigationRef,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};

/**
 * Hook to use notification context
 */
export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);

  if (context === undefined) {
    throw new Error(
      'useNotifications must be used within a NotificationProvider',
    );
  }

  return context;
};

export default NotificationContext;
