/**
 * NotificationSettings.tsx
 *
 * Component for managing notification preferences
 */

import React, {useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {useNotifications} from '../../Context/NotificationContext';
import {useTheme} from '../ThemeContext/ThemeContext';
import {AuthorizationStatus} from '@notifee/react-native';
import notificationService from '../../services/NotificationService';
import {FirebaseMessagingTypes} from '@react-native-firebase/messaging';

interface NotificationSettingsProps {
  onClose?: () => void;
}

const NotificationSettings: React.FC<NotificationSettingsProps> = () => {
  const {
    permissionStatus,
    hasPermission,
    settings,
    updateSettings,
    requestPermission,
  } = useNotifications();
  const {colors} = useTheme();
  const [isLoading, setIsLoading] = useState(false);

  const handleRequestPermission = async () => {
    setIsLoading(true);
    try {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert(
          'Permission Required',
          'To receive notifications, please enable them in your device settings.',
          [
            {text: 'Cancel', style: 'cancel'},
            {
              text: 'Open Settings',
              onPress: () => notificationService.promptEnableNotifications(),
            },
          ],
        );
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSetting = async (
    key: keyof typeof settings,
    value: boolean,
  ) => {
    try {
      await updateSettings({[key]: value});
    } catch (error) {
      console.error('Error updating setting:', error);
    }
  };

  const getPermissionStatusText = (): string => {
    switch (permissionStatus) {
      case AuthorizationStatus.AUTHORIZED:
        return 'Enabled';
      case AuthorizationStatus.PROVISIONAL:
        return 'Provisional';
      case AuthorizationStatus.DENIED:
        return 'Disabled';
      case AuthorizationStatus.NOT_DETERMINED:
        return 'Not requested';
      default:
        return 'Unknown';
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          paddingBottom: 24,
        },
        // ── Sections ──
        section: {
          paddingTop: 16,
          paddingBottom: 4,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        sectionHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 16,
          marginBottom: 8,
        },
        sectionTitle: {
          fontSize: 12,
          fontWeight: '700',
          color: colors.secondaryText,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        },
        statusText: {
          fontSize: 12,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        },
        description: {
          fontSize: 13,
          color: colors.secondaryText,
          lineHeight: 19,
          paddingHorizontal: 16,
          paddingBottom: 14,
        },
        // ── Buttons (pill) ──
        primaryButton: {
          marginHorizontal: 16,
          marginBottom: 14,
          backgroundColor: colors.primary,
          borderRadius: 24,
          paddingVertical: 12,
          alignItems: 'center',
        },
        primaryButtonText: {
          color: '#fff',
          fontSize: 14,
          fontWeight: '700',
        },
        secondaryButton: {
          marginHorizontal: 16,
          marginBottom: 14,
          backgroundColor: 'transparent',
          borderRadius: 24,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          paddingVertical: 12,
          alignItems: 'center',
        },
        secondaryButtonText: {
          color: colors.secondaryText,
          fontSize: 14,
          fontWeight: '700',
        },
        // ── Setting rows ──
        settingRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        settingInfo: {
          flex: 1,
          marginRight: 12,
        },
        settingLabel: {
          fontSize: 15,
          fontWeight: '600',
          color: colors.text,
          marginBottom: 2,
        },
        settingDescription: {
          fontSize: 12,
          color: colors.secondaryText,
        },
      }),
    [colors],
  );

  const statusColor = hasPermission ? '#4CAF50' : colors.error;

  return (
    <View style={styles.container}>
      {/* Permission Status */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>System Permission</Text>
          <Text style={[styles.statusText, {color: statusColor}]}>
            {getPermissionStatusText()}
          </Text>
        </View>

        {!hasPermission ? (
          <>
            <Text style={styles.description}>
              Enable notifications to receive updates about events, friend
              requests, and more.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleRequestPermission}
              disabled={isLoading}>
              <Text style={styles.primaryButtonText}>
                {isLoading ? 'Requesting...' : 'Enable Notifications'}
              </Text>
            </TouchableOpacity>

            {permissionStatus === AuthorizationStatus.DENIED && (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => notificationService.promptEnableNotifications()}>
                <Text style={styles.secondaryButtonText}>
                  Open Device Settings
                </Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <Text style={styles.description}>
            You will receive notifications about events, friends, and updates.
          </Text>
        )}
      </View>

      {/* Notification Preferences */}
      {hasPermission && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Notification Preferences</Text>
          </View>

          {/* Master Toggle */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>All Notifications</Text>
              <Text style={styles.settingDescription}>
                Master switch for all notifications
              </Text>
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={value => handleToggleSetting('enabled', value)}
              trackColor={{false: colors.border, true: colors.primary}}
              thumbColor={Platform.OS === 'ios' ? undefined : '#fff'}
            />
          </View>

          {/* Friend Requests */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Friend Requests</Text>
              <Text style={styles.settingDescription}>
                New friend requests and acceptances
              </Text>
            </View>
            <Switch
              value={settings.friendRequests && settings.enabled}
              onValueChange={value =>
                handleToggleSetting('friendRequests', value)
              }
              disabled={!settings.enabled}
              trackColor={{false: colors.border, true: colors.primary}}
              thumbColor={Platform.OS === 'ios' ? undefined : '#fff'}
            />
          </View>

          {/* Event Updates */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Event Updates</Text>
              <Text style={styles.settingDescription}>
                Changes to events you're attending
              </Text>
            </View>
            <Switch
              value={settings.eventUpdates && settings.enabled}
              onValueChange={value =>
                handleToggleSetting('eventUpdates', value)
              }
              disabled={!settings.enabled}
              trackColor={{false: colors.border, true: colors.primary}}
              thumbColor={Platform.OS === 'ios' ? undefined : '#fff'}
            />
          </View>

          {/* Event Reminders */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Event Reminders</Text>
              <Text style={styles.settingDescription}>
                Reminders before your events start
              </Text>
            </View>
            <Switch
              value={settings.eventReminders && settings.enabled}
              onValueChange={value =>
                handleToggleSetting('eventReminders', value)
              }
              disabled={!settings.enabled}
              trackColor={{false: colors.border, true: colors.primary}}
              thumbColor={Platform.OS === 'ios' ? undefined : '#fff'}
            />
          </View>

          {/* Event Activity */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Event Activity</Text>
              <Text style={styles.settingDescription}>
                Likes, joins, leaves, and comments on events you created
              </Text>
            </View>
            <Switch
              value={settings.eventActivity && settings.enabled}
              onValueChange={value =>
                handleToggleSetting('eventActivity', value)
              }
              disabled={!settings.enabled}
              trackColor={{false: colors.border, true: colors.primary}}
              thumbColor={Platform.OS === 'ios' ? undefined : '#fff'}
            />
          </View>

          {/* Watched Events (Master) */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Watched Events</Text>
              <Text style={styles.settingDescription}>
                Enable alerts for events you choose to watch
              </Text>
            </View>
            <Switch
              value={settings.watchedEvents && settings.enabled}
              onValueChange={value =>
                handleToggleSetting('watchedEvents', value)
              }
              disabled={!settings.enabled}
              trackColor={{false: colors.border, true: colors.primary}}
              thumbColor={Platform.OS === 'ios' ? undefined : '#fff'}
            />
          </View>

          {/* Watched Event Spot Alerts */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Spots Opened Alerts</Text>
              <Text style={styles.settingDescription}>
                Notify when a full watched event has an opening
              </Text>
            </View>
            <Switch
              value={
                settings.watchedEventSpotsAvailable &&
                settings.watchedEvents &&
                settings.enabled
              }
              onValueChange={value =>
                handleToggleSetting('watchedEventSpotsAvailable', value)
              }
              disabled={!settings.enabled || !settings.watchedEvents}
              trackColor={{false: colors.border, true: colors.primary}}
              thumbColor={Platform.OS === 'ios' ? undefined : '#fff'}
            />
          </View>

          {/* Watched Event General Updates */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Watched Event Updates</Text>
              <Text style={styles.settingDescription}>
                General updates on watched events
              </Text>
            </View>
            <Switch
              value={
                settings.watchedEventGeneralUpdates &&
                settings.watchedEvents &&
                settings.enabled
              }
              onValueChange={value =>
                handleToggleSetting('watchedEventGeneralUpdates', value)
              }
              disabled={!settings.enabled || !settings.watchedEvents}
              trackColor={{false: colors.border, true: colors.primary}}
              thumbColor={Platform.OS === 'ios' ? undefined : '#fff'}
            />
          </View>

          {/* Watched Event Roster Updates */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Watched Roster Changes</Text>
              <Text style={styles.settingDescription}>
                Changes to roster size for watched events
              </Text>
            </View>
            <Switch
              value={
                settings.watchedEventRosterChanges &&
                settings.watchedEvents &&
                settings.enabled
              }
              onValueChange={value =>
                handleToggleSetting('watchedEventRosterChanges', value)
              }
              disabled={!settings.enabled || !settings.watchedEvents}
              trackColor={{false: colors.border, true: colors.primary}}
              thumbColor={Platform.OS === 'ios' ? undefined : '#fff'}
            />
          </View>

          {/* Community Notes */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Community Notes</Text>
              <Text style={styles.settingDescription}>
                Updates on community discussions
              </Text>
            </View>
            <Switch
              value={settings.communityNotes && settings.enabled}
              onValueChange={value =>
                handleToggleSetting('communityNotes', value)
              }
              disabled={!settings.enabled}
              trackColor={{false: colors.border, true: colors.primary}}
              thumbColor={Platform.OS === 'ios' ? undefined : '#fff'}
            />
          </View>
        </View>
      )}

      {/* Debug: Copy FCM Token (for testing) */}
      {hasPermission && __DEV__ && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Developer Tools</Text>
          </View>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={async () => {
              try {
                const token = await notificationService.getDeviceToken();
                if (token) {
                  Clipboard.setString(token);
                  Alert.alert(
                    'Token Copied',
                    'FCM token copied to clipboard. Use it in Firebase Console to send a test notification.\n\nToken: ' +
                      token.substring(0, 30) +
                      '...',
                  );
                  console.log('FCM Token:', token);
                } else {
                  Alert.alert('Error', 'Could not get FCM token');
                }
              } catch (error) {
                Alert.alert('Error', 'Failed to get token: ' + error);
              }
            }}>
            <Text style={styles.secondaryButtonText}>Copy FCM Token</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={async () => {
              try {
                await notificationService.displayNotification({
                  notification: {
                    title: 'Test Notification',
                    body: 'This is a local test notification!',
                  },
                  data: {type: 'test'},
                  fcmOptions: {},
                } as FirebaseMessagingTypes.RemoteMessage);
              } catch (error) {
                Alert.alert('Error', 'Failed to show notification: ' + error);
              }
            }}>
            <Text style={styles.secondaryButtonText}>Send Local Test</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default NotificationSettings;
