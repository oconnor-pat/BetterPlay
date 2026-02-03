/**
 * NotificationSettings.tsx
 *
 * Component for managing notification preferences
 */

import React, {useState} from 'react';
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
  const {colors, darkMode} = useTheme();
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

  const themedStyles = {
    container: {
      // Remove background color - let parent modal handle it
    },
    text: {
      color: darkMode ? '#fff' : '#000',
    },
    secondaryText: {
      color: darkMode ? '#aaa' : '#666',
    },
    separator: {
      backgroundColor: darkMode ? '#333' : '#e0e0e0',
    },
    card: {
      backgroundColor: darkMode ? '#2a2a2a' : '#f5f5f5',
    },
    statusText: {
      color: hasPermission ? '#4CAF50' : '#FF5722',
    },
  };

  return (
    <View style={[styles.container, themedStyles.container]}>
      {/* Permission Status */}
      <View style={[styles.section, themedStyles.card]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, themedStyles.text]}>
            System Permission
          </Text>
          <Text style={[styles.statusText, themedStyles.statusText]}>
            {getPermissionStatusText()}
          </Text>
        </View>

        {!hasPermission ? (
          <>
            <Text style={[styles.description, themedStyles.secondaryText]}>
              Enable notifications to receive updates about events, friend
              requests, and more.
            </Text>
            <TouchableOpacity
              style={[
                styles.enableButton,
                {backgroundColor: colors?.primary || '#007AFF'},
              ]}
              onPress={handleRequestPermission}
              disabled={isLoading}>
              <Text style={styles.enableButtonText}>
                {isLoading ? 'Requesting...' : 'Enable Notifications'}
              </Text>
            </TouchableOpacity>

            {permissionStatus === AuthorizationStatus.DENIED && (
              <TouchableOpacity
                style={[styles.enableButton, styles.debugButton]}
                onPress={() => notificationService.promptEnableNotifications()}>
                <Text style={styles.enableButtonText}>Open iOS Settings</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <Text style={[styles.description, themedStyles.secondaryText]}>
            You will receive notifications about events, friends, and updates.
          </Text>
        )}
      </View>

      {/* Notification Preferences */}
      {hasPermission && (
        <View style={[styles.section, themedStyles.card]}>
          <Text style={[styles.sectionTitle, themedStyles.text]}>
            Notification Preferences
          </Text>

          {/* Master Toggle */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, themedStyles.text]}>
                All Notifications
              </Text>
              <Text
                style={[styles.settingDescription, themedStyles.secondaryText]}>
                Master switch for all notifications
              </Text>
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={value => handleToggleSetting('enabled', value)}
              trackColor={{
                false: '#767577',
                true: colors?.primary || '#007AFF',
              }}
              thumbColor={Platform.OS === 'ios' ? undefined : '#fff'}
            />
          </View>

          <View style={[styles.separator, themedStyles.separator]} />

          {/* Friend Requests */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, themedStyles.text]}>
                Friend Requests
              </Text>
              <Text
                style={[styles.settingDescription, themedStyles.secondaryText]}>
                New friend requests and acceptances
              </Text>
            </View>
            <Switch
              value={settings.friendRequests && settings.enabled}
              onValueChange={value =>
                handleToggleSetting('friendRequests', value)
              }
              disabled={!settings.enabled}
              trackColor={{
                false: '#767577',
                true: colors?.primary || '#007AFF',
              }}
              thumbColor={Platform.OS === 'ios' ? undefined : '#fff'}
            />
          </View>

          <View style={[styles.separator, themedStyles.separator]} />

          {/* Event Updates */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, themedStyles.text]}>
                Event Updates
              </Text>
              <Text
                style={[styles.settingDescription, themedStyles.secondaryText]}>
                Changes to events you're attending
              </Text>
            </View>
            <Switch
              value={settings.eventUpdates && settings.enabled}
              onValueChange={value =>
                handleToggleSetting('eventUpdates', value)
              }
              disabled={!settings.enabled}
              trackColor={{
                false: '#767577',
                true: colors?.primary || '#007AFF',
              }}
              thumbColor={Platform.OS === 'ios' ? undefined : '#fff'}
            />
          </View>

          <View style={[styles.separator, themedStyles.separator]} />

          {/* Event Reminders */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, themedStyles.text]}>
                Event Reminders
              </Text>
              <Text
                style={[styles.settingDescription, themedStyles.secondaryText]}>
                Reminders before your events start
              </Text>
            </View>
            <Switch
              value={settings.eventReminders && settings.enabled}
              onValueChange={value =>
                handleToggleSetting('eventReminders', value)
              }
              disabled={!settings.enabled}
              trackColor={{
                false: '#767577',
                true: colors?.primary || '#007AFF',
              }}
              thumbColor={Platform.OS === 'ios' ? undefined : '#fff'}
            />
          </View>

          <View style={[styles.separator, themedStyles.separator]} />

          {/* Community Notes */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, themedStyles.text]}>
                Community Notes
              </Text>
              <Text
                style={[styles.settingDescription, themedStyles.secondaryText]}>
                Updates on community discussions
              </Text>
            </View>
            <Switch
              value={settings.communityNotes && settings.enabled}
              onValueChange={value =>
                handleToggleSetting('communityNotes', value)
              }
              disabled={!settings.enabled}
              trackColor={{
                false: '#767577',
                true: colors?.primary || '#007AFF',
              }}
              thumbColor={Platform.OS === 'ios' ? undefined : '#fff'}
            />
          </View>
        </View>
      )}

      {/* Debug: Copy FCM Token (for testing) */}
      {hasPermission && __DEV__ && (
        <View style={[styles.section, themedStyles.card]}>
          <Text style={[styles.sectionTitle, themedStyles.text]}>
            Developer Tools
          </Text>
          <TouchableOpacity
            style={[styles.enableButton, styles.debugButton]}
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
            <Text style={styles.enableButtonText}>Copy FCM Token</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.enableButton, styles.testButton]}
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
            <Text style={styles.enableButtonText}>Send Local Test</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  enableButton: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 12,
  },
  enableButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  separator: {
    height: 1,
  },
  debugButton: {
    backgroundColor: '#666',
    marginTop: 8,
  },
  testButton: {
    backgroundColor: '#4CAF50',
    marginTop: 8,
  },
});

export default NotificationSettings;
