import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {useTheme} from '../ThemeContext/ThemeContext';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faArrowLeft,
  faBell,
  faUserPlus,
  faUserCheck,
  faCalendarCheck,
  faCalendarPlus,
  faEnvelope,
  faComment,
  faCheck,
  faCheckDouble,
  faTrash,
  faEllipsisV,
  faClock,
} from '@fortawesome/free-solid-svg-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_BASE_URL} from '../../config/api';
import {useTranslation} from 'react-i18next';
import {useNotifications} from '../../Context/NotificationContext';

// Notification type definitions
export interface AppNotification {
  _id: string;
  type:
    | 'friend_request'
    | 'friend_accepted'
    | 'event_update'
    | 'event_reminder'
    | 'event_invitation'
    | 'event_roster'
    | 'community_note'
    | 'general';
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  data?: {
    userId?: string;
    username?: string;
    eventId?: string;
    eventName?: string;
    profilePicUrl?: string;
    [key: string]: string | undefined;
  };
}

const Notifications: React.FC = () => {
  const navigation = useNavigation<any>();
  const {colors} = useTheme();
  const {t} = useTranslation();
  const {setBadgeCount} = useNotifications();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedNotifications, setSelectedNotifications] = useState<
    Set<string>
  >(new Set());
  const [selectMode, setSelectMode] = useState(false);

  // Fetch notifications from backend
  const fetchNotifications = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/notifications`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const fetched = data.notifications || [];
        setNotifications(fetched);
        // Sync badge count with actual unread count
        const unread = fetched.filter((n: AppNotification) => !n.read).length;
        setBadgeCount(unread);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setBadgeCount]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, [fetchNotifications]);

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        return;
      }

      await fetch(`${API_BASE_URL}/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setNotifications(prev => {
        const updated = prev.map(n =>
          n._id === notificationId ? {...n, read: true} : n,
        );
        setBadgeCount(updated.filter(n => !n.read).length);
        return updated;
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        return;
      }

      await fetch(`${API_BASE_URL}/api/notifications/mark-all-read`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setNotifications(prev => prev.map(n => ({...n, read: true})));
      setBadgeCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  // Delete notification (for future swipe-to-delete feature)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const deleteNotification = async (notificationId: string) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        return;
      }

      await fetch(`${API_BASE_URL}/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setNotifications(prev => {
        const updated = prev.filter(n => n._id !== notificationId);
        setBadgeCount(updated.filter(n => !n.read).length);
        return updated;
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  // Delete selected notifications
  const deleteSelected = async () => {
    if (selectedNotifications.size === 0) {
      return;
    }

    Alert.alert(
      t('notifications.deleteSelected') || 'Delete Selected',
      t('notifications.deleteSelectedMessage') ||
        `Delete ${selectedNotifications.size} notification(s)?`,
      [
        {text: t('common.cancel') || 'Cancel', style: 'cancel'},
        {
          text: t('common.delete') || 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('userToken');
              if (!token) {
                return;
              }

              // Delete all selected notifications
              await Promise.all(
                Array.from(selectedNotifications).map(id =>
                  fetch(`${API_BASE_URL}/api/notifications/${id}`, {
                    method: 'DELETE',
                    headers: {Authorization: `Bearer ${token}`},
                  }),
                ),
              );

              setNotifications(prev => {
                const updated = prev.filter(
                  n => !selectedNotifications.has(n._id),
                );
                setBadgeCount(updated.filter(n => !n.read).length);
                return updated;
              });
              setSelectedNotifications(new Set());
              setSelectMode(false);
            } catch (error) {
              console.error('Error deleting notifications:', error);
            }
          },
        },
      ],
    );
  };

  // Handle notification press
  const handleNotificationPress = (notification: AppNotification) => {
    if (selectMode) {
      // Toggle selection
      const newSelected = new Set(selectedNotifications);
      if (newSelected.has(notification._id)) {
        newSelected.delete(notification._id);
      } else {
        newSelected.add(notification._id);
      }
      setSelectedNotifications(newSelected);
      return;
    }

    // Mark as read
    if (!notification.read) {
      markAsRead(notification._id);
    }

    // Navigate based on notification type
    switch (notification.type) {
      case 'friend_request':
        navigation.navigate('Profile', {
          screen: 'FriendRequests',
        });
        break;
      case 'friend_accepted':
        if (notification.data?.userId) {
          navigation.navigate('Profile', {
            screen: 'PublicProfile',
            params: {
              userId: notification.data.userId,
              username: notification.data.username,
            },
          });
        }
        break;
      case 'event_update':
      case 'event_reminder':
      case 'event_invitation':
      case 'event_roster':
        if (notification.data?.eventId) {
          navigation.navigate('Events', {
            screen: 'EventRoster',
            params: {eventId: notification.data.eventId},
          });
        }
        break;
      case 'community_note':
        navigation.navigate('Events', {
          screen: 'CommunityNotes',
        });
        break;
      default:
        break;
    }
  };

  // Get icon for notification type
  const getNotificationIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'friend_request':
        return faUserPlus;
      case 'friend_accepted':
        return faUserCheck;
      case 'event_update':
        return faCalendarCheck;
      case 'event_reminder':
        return faClock;
      case 'event_invitation':
        return faEnvelope;
      case 'event_roster':
        return faCalendarPlus;
      case 'community_note':
        return faComment;
      default:
        return faBell;
    }
  };

  // Get color for notification type
  const getNotificationColor = (type: AppNotification['type']) => {
    switch (type) {
      case 'friend_request':
        return '#FF9800';
      case 'friend_accepted':
        return '#4CAF50';
      case 'event_update':
        return '#2196F3';
      case 'event_reminder':
        return '#9C27B0';
      case 'event_invitation':
        return colors.primary;
      case 'event_roster':
        return colors.primary;
      case 'community_note':
        return '#00BCD4';
      default:
        return colors.text;
    }
  };

  // Format relative time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return t('notifications.justNow') || 'Just now';
    }
    if (diffMins < 60) {
      return `${diffMins}${t('notifications.minutesAgo') || 'm ago'}`;
    }
    if (diffHours < 24) {
      return `${diffHours}${t('notifications.hoursAgo') || 'h ago'}`;
    }
    if (diffDays < 7) {
      return `${diffDays}${t('notifications.daysAgo') || 'd ago'}`;
    }
    return date.toLocaleDateString();
  };

  // Unread count
  const unreadCount = useMemo(
    () => notifications.filter(n => !n.read).length,
    [notifications],
  );

  // Themed styles
  const themedStyles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        headerLeft: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        backButton: {
          padding: 8,
          marginRight: 8,
        },
        headerTitle: {
          fontSize: 20,
          fontWeight: 'bold',
          color: colors.text,
        },
        headerRight: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        headerButton: {
          padding: 8,
        },
        unreadBadge: {
          backgroundColor: colors.primary,
          borderRadius: 12,
          paddingHorizontal: 8,
          paddingVertical: 2,
          marginLeft: 8,
        },
        unreadBadgeText: {
          color: '#fff',
          fontSize: 12,
          fontWeight: 'bold',
        },
        loadingContainer: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        },
        emptyContainer: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 32,
        },
        emptyIcon: {
          marginBottom: 16,
          opacity: 0.5,
        },
        emptyText: {
          fontSize: 18,
          fontWeight: '600',
          color: colors.text,
          marginBottom: 8,
        },
        emptySubtext: {
          fontSize: 14,
          color: colors.placeholder,
          textAlign: 'center',
        },
        list: {
          flex: 1,
        },
        listContent: {
          paddingVertical: 8,
        },
        notificationRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        notificationRowUnread: {
          backgroundColor: colors.primary + '10',
        },
        notificationRowSelected: {
          backgroundColor: colors.primary + '20',
        },
        iconContainer: {
          width: 44,
          height: 44,
          borderRadius: 22,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 12,
        },
        notificationContent: {
          flex: 1,
        },
        notificationTitle: {
          fontSize: 15,
          fontWeight: '600',
          color: colors.text,
          marginBottom: 2,
        },
        notificationBody: {
          fontSize: 14,
          color: colors.placeholder,
          marginBottom: 4,
        },
        notificationTime: {
          fontSize: 12,
          color: colors.placeholder,
        },
        notificationActions: {
          alignItems: 'center',
          justifyContent: 'center',
        },
        unreadDot: {
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: colors.primary,
        },
        selectbox: {
          width: 24,
          height: 24,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: colors.border,
          justifyContent: 'center',
          alignItems: 'center',
        },
        selectboxSelected: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
        selectModeBar: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 8,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        selectModeText: {
          fontSize: 14,
          color: colors.text,
        },
        selectAllText: {
          fontSize: 14,
          color: colors.primary,
          fontWeight: '600',
        },
        selectModeActions: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
        },
        cancelButtonText: {
          color: colors.primary,
          fontWeight: '600',
        },
        deleteButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        },
        deleteButtonText: {
          color: '#F44336',
          fontWeight: '600',
        },
        sectionHeader: {
          paddingHorizontal: 16,
          paddingVertical: 8,
          backgroundColor: colors.card,
        },
        sectionHeaderText: {
          fontSize: 13,
          fontWeight: '600',
          color: colors.placeholder,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
        profilePic: {
          width: 44,
          height: 44,
          borderRadius: 22,
          marginRight: 12,
        },
        profilePicPlaceholder: {
          width: 44,
          height: 44,
          borderRadius: 22,
          marginRight: 12,
          justifyContent: 'center',
          alignItems: 'center',
        },
        profilePicText: {
          color: '#fff',
          fontSize: 16,
          fontWeight: 'bold',
        },
      }),
    [colors],
  );

  // Render notification item
  const renderNotification = ({item}: {item: AppNotification}) => {
    const iconColor = getNotificationColor(item.type);
    const isSelected = selectedNotifications.has(item._id);

    return (
      <TouchableOpacity
        style={[
          themedStyles.notificationRow,
          !item.read && themedStyles.notificationRowUnread,
          isSelected && themedStyles.notificationRowSelected,
        ]}
        onPress={() => handleNotificationPress(item)}
        onLongPress={() => {
          if (!selectMode) {
            setSelectMode(true);
            setSelectedNotifications(new Set([item._id]));
          }
        }}
        activeOpacity={0.7}>
        {/* Icon or Profile Pic */}
        {item.data?.profilePicUrl ? (
          <Image
            source={{uri: item.data.profilePicUrl}}
            style={themedStyles.profilePic}
          />
        ) : (
          <View
            style={[
              themedStyles.iconContainer,
              {backgroundColor: iconColor + '20'},
            ]}>
            <FontAwesomeIcon
              icon={getNotificationIcon(item.type)}
              size={20}
              color={iconColor}
            />
          </View>
        )}

        {/* Content */}
        <View style={themedStyles.notificationContent}>
          <Text style={themedStyles.notificationTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={themedStyles.notificationBody} numberOfLines={2}>
            {item.body}
          </Text>
          <Text style={themedStyles.notificationTime}>
            {formatTime(item.createdAt)}
          </Text>
        </View>

        {/* Actions */}
        <View style={themedStyles.notificationActions}>
          {selectMode ? (
            <View
              style={[
                themedStyles.selectbox,
                isSelected && themedStyles.selectboxSelected,
              ]}>
              {isSelected && (
                <FontAwesomeIcon icon={faCheck} size={14} color="#fff" />
              )}
            </View>
          ) : !item.read ? (
            <View style={themedStyles.unreadDot} />
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  // Group notifications by date (for future SectionList implementation)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const groupedNotifications = useMemo(() => {
    const groups: {title: string; data: AppNotification[]}[] = [];
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayStr = today.toDateString();
    const yesterdayStr = yesterday.toDateString();

    const todayNotifs: AppNotification[] = [];
    const yesterdayNotifs: AppNotification[] = [];
    const earlierNotifs: AppNotification[] = [];

    notifications.forEach(n => {
      const notifDate = new Date(n.createdAt).toDateString();
      if (notifDate === todayStr) {
        todayNotifs.push(n);
      } else if (notifDate === yesterdayStr) {
        yesterdayNotifs.push(n);
      } else {
        earlierNotifs.push(n);
      }
    });

    if (todayNotifs.length > 0) {
      groups.push({
        title: t('notifications.today') || 'Today',
        data: todayNotifs,
      });
    }
    if (yesterdayNotifs.length > 0) {
      groups.push({
        title: t('notifications.yesterday') || 'Yesterday',
        data: yesterdayNotifs,
      });
    }
    if (earlierNotifs.length > 0) {
      groups.push({
        title: t('notifications.earlier') || 'Earlier',
        data: earlierNotifs,
      });
    }

    return groups;
  }, [notifications, t]);

  // Render loading state
  if (loading) {
    return (
      <SafeAreaView style={themedStyles.container}>
        <View style={themedStyles.header}>
          <View style={themedStyles.headerLeft}>
            <TouchableOpacity
              style={themedStyles.backButton}
              onPress={() => navigation.goBack()}>
              <FontAwesomeIcon
                icon={faArrowLeft}
                size={20}
                color={colors.text}
              />
            </TouchableOpacity>
            <Text style={themedStyles.headerTitle}>
              {t('notifications.title') || 'Notifications'}
            </Text>
          </View>
        </View>
        <View style={themedStyles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={themedStyles.container}>
      {/* Header */}
      <View style={themedStyles.header}>
        <View style={themedStyles.headerLeft}>
          <TouchableOpacity
            style={themedStyles.backButton}
            onPress={() => {
              if (selectMode) {
                setSelectMode(false);
                setSelectedNotifications(new Set());
              } else {
                navigation.goBack();
              }
            }}>
            <FontAwesomeIcon icon={faArrowLeft} size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={themedStyles.headerTitle}>
            {t('notifications.title') || 'Notifications'}
          </Text>
          {unreadCount > 0 && !selectMode && (
            <View style={themedStyles.unreadBadge}>
              <Text style={themedStyles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <View style={themedStyles.headerRight}>
          {!selectMode && unreadCount > 0 && (
            <TouchableOpacity
              style={themedStyles.headerButton}
              onPress={markAllAsRead}>
              <FontAwesomeIcon
                icon={faCheckDouble}
                size={18}
                color={colors.primary}
              />
            </TouchableOpacity>
          )}
          {!selectMode && (
            <TouchableOpacity
              style={themedStyles.headerButton}
              onPress={() => setSelectMode(true)}>
              <FontAwesomeIcon
                icon={faEllipsisV}
                size={18}
                color={colors.text}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Select Mode Bar */}
      {selectMode && (
        <View style={themedStyles.selectModeBar}>
          <TouchableOpacity
            onPress={() => {
              if (selectedNotifications.size === notifications.length) {
                setSelectedNotifications(new Set());
              } else {
                setSelectedNotifications(
                  new Set(notifications.map(n => n._id)),
                );
              }
            }}>
            <Text style={themedStyles.selectAllText}>
              {selectedNotifications.size === notifications.length
                ? t('notifications.deselectAll') || 'Deselect All'
                : t('notifications.selectAll') || 'Select All'}
            </Text>
          </TouchableOpacity>
          <View style={themedStyles.selectModeActions}>
            {selectedNotifications.size > 0 && (
              <TouchableOpacity
                style={themedStyles.deleteButton}
                onPress={deleteSelected}>
                <FontAwesomeIcon icon={faTrash} size={16} color="#F44336" />
                <Text style={themedStyles.deleteButtonText}>
                  {t('common.delete') || 'Delete'}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => {
                setSelectMode(false);
                setSelectedNotifications(new Set());
              }}>
              <Text style={themedStyles.cancelButtonText}>
                {t('common.cancel') || 'Cancel'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <View style={themedStyles.emptyContainer}>
          <FontAwesomeIcon
            icon={faBell}
            size={64}
            color={colors.placeholder}
            style={themedStyles.emptyIcon}
          />
          <Text style={themedStyles.emptyText}>
            {t('notifications.noNotifications') || 'No notifications yet'}
          </Text>
          <Text style={themedStyles.emptySubtext}>
            {t('notifications.noNotificationsMessage') ||
              "When you receive notifications, they'll appear here"}
          </Text>
        </View>
      ) : (
        <FlatList
          style={themedStyles.list}
          contentContainerStyle={themedStyles.listContent}
          data={notifications}
          keyExtractor={item => item._id}
          renderItem={renderNotification}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

export default Notifications;
