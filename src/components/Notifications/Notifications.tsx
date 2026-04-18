import React, {useState, useEffect, useCallback, useMemo, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Image,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Swipeable, RectButton} from 'react-native-gesture-handler';
import {FlatList} from 'react-native-gesture-handler';
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
  faComments,
  faHeart,
  faUsers,
  faCheck,
  faCheckDouble,
  faTrash,
  faEllipsisV,
  faClock,
  faEye,
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
    | 'event_like'
    | 'event_comment'
    | 'event_join'
    | 'event_leave'
    | 'event_watch_update'
    | 'event_spot_opened'
    | 'event_spot_available'
    | 'event_waitlist_join'
    | 'event_roster_change'
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
  const {setBadgeCount, refreshBadgeCount} = useNotifications();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedNotifications, setSelectedNotifications] = useState<
    Set<string>
  >(new Set());
  const [selectMode, setSelectMode] = useState(false);

  // Track open swipeable rows so we can close the previous one when a new opens
  const swipeableRefs = useRef<Map<string, Swipeable | null>>(new Map());
  const openSwipeableId = useRef<string | null>(null);

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

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      refreshBadgeCount();
    });
    return () => unsubscribe();
  }, [navigation, refreshBadgeCount]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, [fetchNotifications]);

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

  const deleteNotification = useCallback(
    async (notificationId: string) => {
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
        swipeableRefs.current.delete(notificationId);
        if (openSwipeableId.current === notificationId) {
          openSwipeableId.current = null;
        }
      } catch (error) {
        console.error('Error deleting notification:', error);
      }
    },
    [setBadgeCount],
  );

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

  const handleNotificationPress = (notification: AppNotification) => {
    if (selectMode) {
      const newSelected = new Set(selectedNotifications);
      if (newSelected.has(notification._id)) {
        newSelected.delete(notification._id);
      } else {
        newSelected.add(notification._id);
      }
      setSelectedNotifications(newSelected);
      return;
    }

    // Close any open swipe row before navigating
    if (openSwipeableId.current) {
      swipeableRefs.current.get(openSwipeableId.current)?.close();
      openSwipeableId.current = null;
    }

    if (!notification.read) {
      markAsRead(notification._id);
    }

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
      case 'event_join':
      case 'event_leave':
      case 'event_watch_update':
      case 'event_spot_opened':
      case 'event_spot_available':
      case 'event_waitlist_join':
      case 'event_roster_change':
        if (notification.data?.eventId) {
          navigation.navigate('Events', {
            screen: 'EventRoster',
            params: {eventId: notification.data.eventId},
          });
        }
        break;
      case 'event_like':
      case 'event_comment':
      case 'community_note': {
        const targetId =
          notification.data?.eventId || notification.data?.postEventId;
        if (targetId) {
          navigation.navigate('Events', {
            screen: 'EventList',
            params: {
              highlightEventId: targetId,
              expandComments: notification.type !== 'event_like',
            },
          });
        } else {
          navigation.navigate('Events', {
            screen: 'EventList',
          });
        }
        break;
      }
      default:
        break;
    }
  };

  const getNotificationIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'friend_request':
        return faUserPlus;
      case 'friend_accepted':
        return faUserCheck;
      case 'event_update':
      case 'event_watch_update':
        return faCalendarCheck;
      case 'event_reminder':
        return faClock;
      case 'event_invitation':
        return faEnvelope;
      case 'event_roster':
      case 'event_roster_change':
        return faCalendarPlus;
      case 'event_like':
        return faHeart;
      case 'event_comment':
      case 'community_note':
        return faComments;
      case 'event_join':
      case 'event_leave':
        return faUsers;
      case 'event_spot_opened':
      case 'event_spot_available':
        return faEye;
      case 'event_waitlist_join':
        return faUsers;
      default:
        return faBell;
    }
  };

  const getNotificationColor = (type: AppNotification['type']) => {
    switch (type) {
      case 'friend_request':
        return '#FF9800';
      case 'friend_accepted':
        return '#4CAF50';
      case 'event_update':
      case 'event_watch_update':
        return '#2196F3';
      case 'event_reminder':
        return '#9C27B0';
      case 'event_invitation':
      case 'event_roster':
      case 'event_roster_change':
      case 'event_join':
      case 'event_leave':
      case 'event_waitlist_join':
        return colors.primary;
      case 'event_like':
        return '#e74c3c';
      case 'event_comment':
      case 'community_note':
        return '#00BCD4';
      case 'event_spot_opened':
      case 'event_spot_available':
        return '#FF9800';
      default:
        return colors.text;
    }
  };

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
        // ── Header ──
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          backgroundColor: colors.background,
        },
        headerLeft: {
          flexDirection: 'row',
          alignItems: 'center',
          flex: 1,
        },
        backButton: {
          padding: 8,
          marginRight: 4,
        },
        headerTitle: {
          fontSize: 16,
          fontWeight: '700',
          color: colors.text,
        },
        unreadBadge: {
          backgroundColor: colors.primary,
          borderRadius: 10,
          paddingHorizontal: 7,
          paddingVertical: 2,
          marginLeft: 8,
          minWidth: 18,
          alignItems: 'center',
        },
        unreadBadgeText: {
          color: '#fff',
          fontSize: 11,
          fontWeight: '700',
        },
        headerRight: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        },
        headerButton: {
          padding: 8,
        },
        // ── Select mode bar (flat, hairline, no card) ──
        selectModeBar: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          backgroundColor: colors.background,
        },
        selectAllText: {
          fontSize: 13,
          color: colors.primary,
          fontWeight: '700',
        },
        selectModeActions: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        },
        deleteButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        },
        deleteButtonText: {
          color: colors.error,
          fontWeight: '700',
          fontSize: 13,
        },
        cancelButtonText: {
          color: colors.primary,
          fontWeight: '700',
          fontSize: 13,
        },
        // ── List ──
        list: {
          flex: 1,
        },
        listContent: {
          paddingTop: 0,
          paddingBottom: 16,
        },
        // ── Notification row ──
        notificationRowWrapper: {
          backgroundColor: colors.background,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        notificationRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: colors.background,
        },
        notificationRowUnread: {
          backgroundColor: colors.primary + '0A',
        },
        notificationRowSelected: {
          backgroundColor: colors.primary + '14',
        },
        iconContainer: {
          width: 40,
          height: 40,
          borderRadius: 20,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 12,
        },
        notificationContent: {
          flex: 1,
          paddingRight: 8,
        },
        notificationTitle: {
          fontSize: 14,
          fontWeight: '700',
          color: colors.text,
          marginBottom: 2,
        },
        notificationBody: {
          fontSize: 13,
          color: colors.secondaryText,
          lineHeight: 18,
          marginBottom: 4,
        },
        notificationTime: {
          fontSize: 11,
          color: colors.secondaryText,
        },
        notificationActions: {
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
        },
        unreadDot: {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.primary,
        },
        selectbox: {
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'transparent',
        },
        selectboxSelected: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
        profilePic: {
          width: 40,
          height: 40,
          borderRadius: 20,
          marginRight: 12,
        },
        // ── Swipe action ──
        swipeAction: {
          backgroundColor: colors.error,
          justifyContent: 'center',
          alignItems: 'center',
          width: 88,
        },
        swipeActionInner: {
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          paddingHorizontal: 12,
        },
        swipeActionLabel: {
          color: '#fff',
          fontSize: 12,
          fontWeight: '700',
        },
        // ── Empty state ──
        emptyContainer: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 32,
          paddingVertical: 64,
        },
        emptyIcon: {
          marginBottom: 14,
          opacity: 0.4,
        },
        emptyText: {
          fontSize: 16,
          fontWeight: '700',
          color: colors.text,
          marginBottom: 6,
          textAlign: 'center',
        },
        emptySubtext: {
          fontSize: 13,
          color: colors.secondaryText,
          textAlign: 'center',
          lineHeight: 19,
        },
        loadingContainer: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        },
      }),
    [colors],
  );

  // Render swipe-right delete action
  const renderRightActions = useCallback(
    (
      progress: Animated.AnimatedInterpolation<number>,
      _dragX: Animated.AnimatedInterpolation<number>,
      notificationId: string,
    ) => {
      const scale = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0.6, 1],
        extrapolate: 'clamp',
      });

      return (
        <RectButton
          style={themedStyles.swipeAction}
          onPress={() => {
            swipeableRefs.current.get(notificationId)?.close();
            deleteNotification(notificationId);
          }}>
          <Animated.View
            style={[themedStyles.swipeActionInner, {transform: [{scale}]}]}>
            <FontAwesomeIcon icon={faTrash} size={18} color="#fff" />
            <Text style={themedStyles.swipeActionLabel}>
              {t('common.delete') || 'Delete'}
            </Text>
          </Animated.View>
        </RectButton>
      );
    },
    [themedStyles, deleteNotification, t],
  );

  const renderNotification = ({item}: {item: AppNotification}) => {
    const iconColor = getNotificationColor(item.type);
    const isSelected = selectedNotifications.has(item._id);

    const rowContent = (
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
              {backgroundColor: iconColor + '1A'},
            ]}>
            <FontAwesomeIcon
              icon={getNotificationIcon(item.type)}
              size={16}
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
                <FontAwesomeIcon icon={faCheck} size={12} color="#fff" />
              )}
            </View>
          ) : !item.read ? (
            <View style={themedStyles.unreadDot} />
          ) : null}
        </View>
      </TouchableOpacity>
    );

    // Disable swipe-to-delete while in select mode
    if (selectMode) {
      return <View style={themedStyles.notificationRowWrapper}>{rowContent}</View>;
    }

    return (
      <View style={themedStyles.notificationRowWrapper}>
        <Swipeable
          ref={ref => {
            if (ref) {
              swipeableRefs.current.set(item._id, ref);
            } else {
              swipeableRefs.current.delete(item._id);
            }
          }}
          friction={2}
          rightThreshold={40}
          overshootRight={false}
          renderRightActions={(progress, dragX) =>
            renderRightActions(progress, dragX, item._id)
          }
          onSwipeableWillOpen={() => {
            if (
              openSwipeableId.current &&
              openSwipeableId.current !== item._id
            ) {
              swipeableRefs.current.get(openSwipeableId.current)?.close();
            }
            openSwipeableId.current = item._id;
          }}
          onSwipeableClose={() => {
            if (openSwipeableId.current === item._id) {
              openSwipeableId.current = null;
            }
          }}>
          {rowContent}
        </Swipeable>
      </View>
    );
  };

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
                size={18}
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
            <FontAwesomeIcon icon={faArrowLeft} size={18} color={colors.text} />
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
                size={16}
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
                size={16}
                color={colors.secondaryText}
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
                <FontAwesomeIcon
                  icon={faTrash}
                  size={14}
                  color={colors.error}
                />
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
            size={42}
            color={colors.secondaryText}
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
