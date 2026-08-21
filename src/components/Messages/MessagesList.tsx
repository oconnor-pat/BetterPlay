// Messages tab home screen. Two surfaces behind one segmented control:
//
//   Inbox    — accepted threads, most recently active first.
//   Requests — threads opened by someone you aren't friends with, held
//              back until you accept them. Kept separate on purpose: the
//              point of letting anyone message you (needed for public
//              events / LFG) is that strangers don't land in the same
//              list as the people you actually talk to.
//
// Live via the user's own socket room: `dm:activity` bumps a row's unread
// count and floats it to the top, `dm:read` clears a badge when the
// thread is opened on another device, and `dm:conversation:updated` moves
// a thread between the two segments when a request is answered.

import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Swipeable, RectButton} from 'react-native-gesture-handler';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faBan,
  faChevronRight,
  faCommentDots,
  faPlus,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../ThemeContext/ThemeContext';
import {useSocket} from '../../Context/SocketContext';
import UserContext, {UserContextType} from '../UserContext';
import {Conversation, ConversationStatus, DmActivity} from '../../types/dm';
import {
  declineConversation,
  deleteConversation,
  fetchConversations,
  fetchMessageRequests,
} from '../../services/DirectMessageService';

type Segment = 'inbox' | 'requests';

// Short relative timestamp for the row's right edge.
const relativeTime = (iso?: string): string => {
  if (!iso) {
    return '';
  }
  const then = new Date(iso).getTime();
  if (isNaN(then)) {
    return '';
  }
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) {
    return 'now';
  }
  if (min < 60) {
    return `${min}m`;
  }
  const hr = Math.floor(min / 60);
  if (hr < 24) {
    return `${hr}h`;
  }
  const day = Math.floor(hr / 24);
  if (day < 7) {
    return `${day}d`;
  }
  return new Date(iso).toLocaleDateString();
};

const MessagesList: React.FC = () => {
  const {colors, darkMode} = useTheme();
  const {t} = useTranslation();
  const navigation = useNavigation<any>();
  const {subscribe} = useSocket();
  const {userData} = useContext(UserContext) as UserContextType;
  const currentUserId = userData?._id;

  const [segment, setSegment] = useState<Segment>('inbox');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [requests, setRequests] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  // Which threads we already have rows for. Held in a ref so the socket
  // subscriptions below don't have to list the lists as dependencies —
  // otherwise every incoming message would tear down and rebuild the
  // listeners, with a window where events could slip through.
  const knownIdsRef = useRef<Set<string>>(new Set());
  // Track open swipe rows so opening one closes the previous, matching
  // the notifications list.
  const swipeableRefs = useRef<Map<string, Swipeable | null>>(new Map());
  const openSwipeableId = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [inbox, pending] = await Promise.all([
        fetchConversations(),
        fetchMessageRequests(),
      ]);
      setConversations(inbox);
      setRequests(pending);
    } catch {
      setConversations([]);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload on focus so a thread read (or a request answered) elsewhere is
  // reflected when the user comes back to the list.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    knownIdsRef.current = new Set([
      ...conversations.map(c => c._id),
      ...requests.map(c => c._id),
    ]);
  }, [conversations, requests]);

  useEffect(() => {
    const unsubActivity = subscribe('dm:activity', (payload: DmActivity) => {
      if (!payload?.conversationId) {
        return;
      }
      const fromMe = payload.senderId === currentUserId;
      const bump = (list: Conversation[]): Conversation[] => {
        const idx = list.findIndex(c => c._id === payload.conversationId);
        if (idx === -1) {
          return list;
        }
        const updated: Conversation = {
          ...list[idx],
          status: payload.status,
          lastMessage: payload.lastMessage,
          lastMessageAt: payload.lastMessage.createdAt,
          unreadCount: fromMe
            ? list[idx].unreadCount
            : list[idx].unreadCount + 1,
        };
        return [updated, ...list.filter(c => c._id !== payload.conversationId)];
      };

      // A thread we've never seen — someone just opened one with us, or
      // we started one from a profile. Refetch rather than invent a row,
      // since we don't have the other person's details here.
      if (!knownIdsRef.current.has(payload.conversationId)) {
        load();
        return;
      }
      setConversations(prev => bump(prev));
      setRequests(prev => bump(prev));
    });

    const unsubRead = subscribe(
      'dm:read',
      (payload: {conversationId: string}) => {
        if (!payload?.conversationId) {
          return;
        }
        const clear = (list: Conversation[]) =>
          list.map(c =>
            c._id === payload.conversationId ? {...c, unreadCount: 0} : c,
          );
        setConversations(prev => clear(prev));
        setRequests(prev => clear(prev));
      },
    );

    // A request was answered (possibly on another device): accepted ones
    // graduate into the inbox, declined ones disappear.
    const unsubUpdated = subscribe(
      'dm:conversation:updated',
      (payload: {conversationId: string; status: ConversationStatus}) => {
        if (!payload?.conversationId) {
          return;
        }
        setRequests(prev => {
          const match = prev.find(c => c._id === payload.conversationId);
          if (match && payload.status === 'accepted') {
            const graduated: Conversation = {
              ...match,
              status: 'accepted',
              isIncomingRequest: false,
            };
            setConversations(inbox =>
              inbox.some(c => c._id === graduated._id)
                ? inbox
                : [graduated, ...inbox],
            );
          }
          return prev.filter(c => c._id !== payload.conversationId);
        });
      },
    );

    // Deleted on another device — drop the row here too.
    const unsubCleared = subscribe(
      'dm:conversation:cleared',
      (payload: {conversationId: string}) => {
        if (!payload?.conversationId) {
          return;
        }
        knownIdsRef.current.delete(payload.conversationId);
        setConversations(prev =>
          prev.filter(c => c._id !== payload.conversationId),
        );
        setRequests(prev => prev.filter(c => c._id !== payload.conversationId));
      },
    );

    return () => {
      unsubActivity();
      unsubRead();
      unsubUpdated();
      unsubCleared();
    };
  }, [subscribe, currentUserId, load]);

  // Optimistically clear the badge on the way in — the thread marks
  // itself read on mount and `dm:read` will confirm; this just avoids a
  // stale badge flash.
  const openThread = useCallback(
    (conv: Conversation) => {
      // Close any open swipe row before navigating away.
      if (openSwipeableId.current) {
        swipeableRefs.current.get(openSwipeableId.current)?.close();
        openSwipeableId.current = null;
      }
      const clear = (list: Conversation[]) =>
        list.map(c => (c._id === conv._id ? {...c, unreadCount: 0} : c));
      setConversations(prev => clear(prev));
      setRequests(prev => clear(prev));
      navigation.navigate('DmThread', {
        conversationId: conv._id,
        username: conv.otherUser.username,
        name: conv.otherUser.name,
        profilePicUrl: conv.otherUser.profilePicUrl,
      });
    },
    [navigation],
  );

  const closeSwipe = useCallback((id: string) => {
    swipeableRefs.current.get(id)?.close();
    if (openSwipeableId.current === id) {
      openSwipeableId.current = null;
    }
  }, []);

  // Removes the thread from this user's inbox only. Optimistic, with the
  // row restored if the server refuses.
  const handleDeleteThread = useCallback(
    (conv: Conversation) => {
      closeSwipe(conv._id);
      // Forget it so a later message from them is treated as a new
      // thread and pulls a fresh list, bringing the row back.
      knownIdsRef.current.delete(conv._id);
      setConversations(prev => prev.filter(c => c._id !== conv._id));
      deleteConversation(conv._id).catch(() => {
        setConversations(prev =>
          prev.some(c => c._id === conv._id)
            ? prev
            : [conv, ...prev].sort((a, b) =>
                (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''),
              ),
        );
        Alert.alert(
          t('common.error') || 'Error',
          t('messages.deleteFailed') ||
            "That conversation couldn't be deleted.",
        );
      });
    },
    [closeSwipe, t],
  );

  // Swiping a *request* declines it rather than merely hiding it —
  // hiding would leave it pending server-side, so the stranger could
  // keep writing into a thread the user thinks they got rid of.
  const handleDeclineRequest = useCallback(
    (conv: Conversation) => {
      closeSwipe(conv._id);
      Alert.alert(
        t('messages.declineTitle') || 'Decline message request?',
        t('messages.declineMessage') ||
          "They won't be able to message you again, and they aren't told you declined.",
        [
          {text: t('common.cancel') || 'Cancel', style: 'cancel'},
          {
            text: t('messages.decline') || 'Decline',
            style: 'destructive',
            onPress: () => {
              knownIdsRef.current.delete(conv._id);
              setRequests(prev => prev.filter(c => c._id !== conv._id));
              declineConversation(conv._id).catch(() => {
                setRequests(prev =>
                  prev.some(c => c._id === conv._id) ? prev : [conv, ...prev],
                );
                Alert.alert(
                  t('common.error') || 'Error',
                  t('messages.requestFailed') ||
                    "That request couldn't be updated.",
                );
              });
            },
          },
        ],
      );
    },
    [closeSwipe, t],
  );

  const previewText = useCallback(
    (conv: Conversation): string => {
      const lm = conv.lastMessage;
      if (!lm) {
        return t('messages.noMessagesYet') || 'No messages yet';
      }
      const body = lm.deleted
        ? t('groupChat.messageDeleted') || 'This message was deleted'
        : lm.text || (lm.hasImage ? t('groupChat.photo') || '📷 Photo' : '');
      return lm.senderId === currentUserId ? `You: ${body}` : body;
    },
    [currentUserId, t],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: 14,
        },
        headerCopy: {
          flex: 1,
          paddingRight: 12,
        },
        title: {
          fontSize: 28,
          fontWeight: '800',
          color: colors.text,
          letterSpacing: -0.4,
        },
        subtitle: {
          marginTop: 4,
          fontSize: 13,
          fontWeight: '600',
          color: colors.secondaryText,
        },
        newButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: colors.primary,
          borderRadius: 22,
          paddingVertical: 10,
          paddingHorizontal: 14,
        },
        newButtonText: {
          color: '#FFFFFF',
          fontSize: 14,
          fontWeight: '700',
        },
        segments: {
          flexDirection: 'row',
          gap: 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
        },
        segment: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 18,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.card,
        },
        segmentActive: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
        segmentText: {
          fontSize: 13,
          fontWeight: '700',
          color: colors.secondaryText,
        },
        segmentTextActive: {color: '#FFFFFF'},
        segmentCount: {
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          paddingHorizontal: 5,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#FF3B30',
        },
        segmentCountActive: {backgroundColor: 'rgba(255,255,255,0.28)'},
        segmentCountText: {
          color: '#FFFFFF',
          fontSize: 10,
          fontWeight: '800',
        },
        listContent: {
          paddingHorizontal: 16,
          paddingBottom: 24,
        },
        loadingWrap: {
          paddingVertical: 48,
          alignItems: 'center',
        },
        rowWrapper: {
          marginBottom: 10,
          borderRadius: 16,
          overflow: 'hidden',
          backgroundColor: colors.card,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 14,
          paddingHorizontal: 14,
          borderRadius: 16,
          backgroundColor: colors.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        rowUnread: {
          borderColor: colors.primary + '55',
          backgroundColor: darkMode
            ? colors.primary + '14'
            : colors.primary + '10',
        },
        avatar: {
          width: 44,
          height: 44,
          borderRadius: 22,
          marginRight: 12,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          backgroundColor: darkMode
            ? 'rgba(255,255,255,0.08)'
            : 'rgba(0,0,0,0.06)',
        },
        avatarImage: {width: 44, height: 44},
        avatarInitials: {color: colors.text, fontWeight: '700', fontSize: 15},
        rowContent: {flex: 1, minWidth: 0},
        rowTopLine: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        },
        rowTitle: {
          flex: 1,
          fontSize: 16,
          fontWeight: '700',
          color: colors.text,
        },
        rowTitleUnread: {
          fontWeight: '800',
        },
        rowTime: {fontSize: 11, fontWeight: '600', color: colors.secondaryText},
        rowTimeUnread: {color: colors.primary, fontWeight: '700'},
        rowPreview: {
          fontSize: 13,
          color: colors.secondaryText,
          marginTop: 3,
        },
        rowPreviewUnread: {color: colors.text, fontWeight: '700'},
        rowStatus: {
          fontSize: 11,
          color: colors.secondaryText,
          fontStyle: 'italic',
          marginTop: 2,
        },
        rowTrail: {
          alignItems: 'flex-end',
          justifyContent: 'center',
          marginLeft: 8,
          gap: 8,
        },
        unreadBadge: {
          minWidth: 22,
          height: 22,
          borderRadius: 11,
          paddingHorizontal: 7,
          backgroundColor: '#FF3B30',
          alignItems: 'center',
          justifyContent: 'center',
        },
        unreadBadgeText: {
          color: '#FFFFFF',
          fontSize: 12,
          fontWeight: '800',
        },
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
        emptyCard: {
          marginTop: 24,
          padding: 24,
          borderRadius: 18,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.card,
          alignItems: 'center',
          overflow: 'hidden',
        },
        emptyGlow: {
          position: 'absolute',
          width: 140,
          height: 140,
          borderRadius: 70,
          top: -50,
          right: -40,
          backgroundColor: colors.primary + '20',
        },
        emptyIcon: {
          width: 64,
          height: 64,
          borderRadius: 32,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary + '18',
          marginBottom: 16,
        },
        emptyTitle: {
          fontSize: 18,
          fontWeight: '800',
          color: colors.text,
          marginBottom: 6,
          textAlign: 'center',
        },
        emptySubtitle: {
          fontSize: 13,
          color: colors.secondaryText,
          textAlign: 'center',
          lineHeight: 19,
          marginBottom: 18,
        },
        emptyCta: {
          backgroundColor: colors.primary,
          borderRadius: 22,
          paddingVertical: 12,
          paddingHorizontal: 22,
        },
        emptyCtaText: {
          color: '#FFFFFF',
          fontSize: 14,
          fontWeight: '700',
        },
      }),
    [colors, darkMode],
  );

  const data = segment === 'inbox' ? conversations : requests;

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    item: Conversation,
  ) => {
    const scale = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0.6, 1],
      extrapolate: 'clamp',
    });
    const isRequest = segment === 'requests';

    return (
      <RectButton
        style={styles.swipeAction}
        onPress={() =>
          isRequest ? handleDeclineRequest(item) : handleDeleteThread(item)
        }>
        <Animated.View
          style={[styles.swipeActionInner, {transform: [{scale}]}]}>
          <FontAwesomeIcon
            icon={isRequest ? faBan : faTrash}
            size={18}
            color="#fff"
          />
          <Text style={styles.swipeActionLabel}>
            {isRequest
              ? t('messages.decline') || 'Decline'
              : t('common.delete') || 'Delete'}
          </Text>
        </Animated.View>
      </RectButton>
    );
  };

  const renderRow = ({item}: {item: Conversation}) => {
    const unread = item.unreadCount || 0;
    const displayName =
      item.otherUser.name || item.otherUser.username || 'Someone';
    const rowContent = (
      <TouchableOpacity
        style={[styles.row, unread > 0 && styles.rowUnread]}
        activeOpacity={0.75}
        onPress={() => openThread(item)}>
        <View style={styles.avatar}>
          {item.otherUser.profilePicUrl ? (
            <Image
              source={{uri: item.otherUser.profilePicUrl}}
              style={styles.avatarImage}
            />
          ) : (
            <Text style={styles.avatarInitials}>
              {displayName.slice(0, 2).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={styles.rowContent}>
          <View style={styles.rowTopLine}>
            <Text
              style={[styles.rowTitle, unread > 0 && styles.rowTitleUnread]}
              numberOfLines={1}>
              {displayName}
            </Text>
            <Text
              style={[styles.rowTime, unread > 0 && styles.rowTimeUnread]}>
              {relativeTime(item.lastMessageAt)}
            </Text>
          </View>
          <Text
            style={[styles.rowPreview, unread > 0 && styles.rowPreviewUnread]}
            numberOfLines={1}>
            {previewText(item)}
          </Text>
          {item.isClosedToMe ? (
            <Text style={styles.rowStatus}>
              {t('messages.notAccepting') || 'No longer accepting messages'}
            </Text>
          ) : item.isOutgoingRequest ? (
            <Text style={styles.rowStatus}>
              {t('messages.requestSent') || 'Request sent'}
            </Text>
          ) : null}
        </View>
        <View style={styles.rowTrail}>
          {unread > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {unread > 99 ? '99+' : unread}
              </Text>
            </View>
          ) : (
            <FontAwesomeIcon
              icon={faChevronRight}
              size={12}
              color={colors.secondaryText}
            />
          )}
        </View>
      </TouchableOpacity>
    );

    return (
      <View style={styles.rowWrapper}>
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
          renderRightActions={progress => renderRightActions(progress, item)}
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

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      );
    }
    const isRequests = segment === 'requests';
    return (
      <View style={styles.emptyCard}>
        <View style={styles.emptyGlow} pointerEvents="none" />
        <View style={styles.emptyIcon}>
          <FontAwesomeIcon
            icon={faCommentDots}
            size={24}
            color={colors.primary}
          />
        </View>
        <Text style={styles.emptyTitle}>
          {isRequests
            ? t('messages.noRequestsTitle') || 'No message requests'
            : t('messages.emptyTitle') || 'No messages yet'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {isRequests
            ? t('messages.noRequestsSubtitle') ||
              "Messages from people you aren't friends with land here first."
            : t('messages.emptySubtitle') ||
              'Start a conversation from someone\u2019s profile.'}
        </Text>
        {!isRequests ? (
          <TouchableOpacity
            style={styles.emptyCta}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('UserSearch')}>
            <Text style={styles.emptyCtaText}>
              {t('messages.newMessage') || 'New message'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  const renderSegment = (key: Segment, label: string, count: number) => {
    const active = segment === key;
    return (
      <TouchableOpacity
        style={[styles.segment, active && styles.segmentActive]}
        activeOpacity={0.8}
        onPress={() => setSegment(key)}>
        <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
          {label}
        </Text>
        {count > 0 ? (
          <View
            style={[styles.segmentCount, active && styles.segmentCountActive]}>
            <Text style={styles.segmentCountText}>
              {count > 99 ? '99+' : count}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  const unreadThreads = conversations.filter(c => c.unreadCount > 0).length;
  const subtitle =
    segment === 'requests'
      ? requests.length === 1
        ? t('messages.oneRequest') || '1 request'
        : t('messages.requestCount', {count: requests.length}) ||
          `${requests.length} requests`
      : conversations.length === 1
        ? t('messages.oneConversation') || '1 conversation'
        : t('messages.conversationCount', {count: conversations.length}) ||
          `${conversations.length} conversations`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>
            {t('navigation.messages') || 'Messages'}
          </Text>
          {!loading && data.length > 0 ? (
            <Text style={styles.subtitle}>{subtitle}</Text>
          ) : (
            <Text style={styles.subtitle}>
              {t('messages.subtitle') || 'Inbox and requests'}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.newButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('UserSearch')}
          accessibilityLabel={t('messages.newMessage') || 'New message'}>
          <FontAwesomeIcon icon={faPlus} size={12} color="#FFFFFF" />
          <Text style={styles.newButtonText}>
            {t('messages.newShort') || 'New'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.segments}>
        {renderSegment('inbox', t('messages.inbox') || 'Inbox', unreadThreads)}
        {renderSegment(
          'requests',
          t('messages.requests') || 'Requests',
          requests.length,
        )}
      </View>

      <FlatList
        data={data}
        keyExtractor={c => c._id}
        renderItem={renderRow}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={[
          styles.listContent,
          data.length === 0 ? {flexGrow: 1} : null,
        ]}
      />
    </SafeAreaView>
  );
};

export default MessagesList;
