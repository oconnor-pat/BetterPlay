// Group chat thread. Rendered inside GroupDetail under the "Chat" tab.
// Rounds out the Groups feature so a crew's conversation lives next to
// its roster and the events it schedules — event creation drops a
// tappable system message in here (see BE postGroupEventSystemMessage).
//
// Real-time via the `group:{id}` socket room: on mount we join the room,
// mark the thread read, and prepend any `group:message:new` events. The
// list is an inverted FlatList (newest at the bottom, like every chat
// app); messages are held newest-first so index 0 sits at the bottom.

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
  FlatList,
  Image,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faCalendarDay,
  faChevronRight,
  faPaperPlane,
} from '@fortawesome/free-solid-svg-icons';
import {useNavigation} from '@react-navigation/native';
import {useBottomTabBarHeight} from '@react-navigation/bottom-tabs';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../ThemeContext/ThemeContext';
import {useSocket} from '../../Context/SocketContext';
import UserContext, {UserContextType} from '../UserContext';
import {GroupMessage} from '../../types/group';
import {
  fetchGroupMessages,
  markGroupRead,
  sendGroupMessage,
} from '../../services/GroupChatService';

interface GroupChatProps {
  groupId: string;
}

// Short relative timestamp for message metadata ("now", "5m", "3h",
// "2d"), falling back to a date once it's a week old.
const relativeTime = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(iso).toLocaleDateString();
};

const GroupChat: React.FC<GroupChatProps> = ({groupId}) => {
  const {colors, darkMode} = useTheme();
  const {t} = useTranslation();
  const navigation = useNavigation<any>();
  // GroupDetail always lives under the bottom tab navigator (Groups and
  // Profile stacks both register it), so the keyboard needs to clear the
  // tab bar height — otherwise the composer floats above the keyboard by
  // exactly that gap.
  const tabBarHeight = useBottomTabBarHeight();
  const {joinGroup, leaveGroup, subscribe} = useSocket();
  const {userData} = useContext(UserContext) as UserContextType;
  const currentUserId = userData?._id;

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Deterministic keyboard handling. KeyboardAvoidingView mis-measures
  // its own position inside the nested tab→stack navigator, so instead we
  // read the keyboard height directly and lift the composer by exactly
  // (keyboardHeight − tabBarHeight): the tab bar sits below this view and
  // is covered by the keyboard, so only the remainder needs padding.
  // iOS only — Android resizes the window natively (adjustResize).
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const showSub = Keyboard.addListener('keyboardWillChangeFrame', e => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const bottomInset =
    Platform.OS === 'ios' ? Math.max(0, keyboardHeight - tabBarHeight) : 0;

  // Dedupe-aware prepend so the socket echo of our own sent message
  // doesn't double up with the POST response (both carry the same _id).
  const prependMessage = useCallback((msg: GroupMessage) => {
    setMessages(prev =>
      prev.some(m => m._id === msg._id) ? prev : [msg, ...prev],
    );
  }, []);

  const openEvent = useCallback(
    (eventId: string) => {
      // Cross-tab jump into the Events stack's roster screen.
      navigation.navigate('Events', {
        screen: 'EventRoster',
        params: {eventId},
      });
    },
    [navigation],
  );

  // Initial load + room join + mark read.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetchGroupMessages(groupId, {limit: 30});
        if (cancelled) return;
        setMessages(res.messages);
        setHasMore(res.hasMore);
      } catch {
        if (!cancelled) setMessages([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
      markGroupRead(groupId).catch(() => {});
    })();

    joinGroup(groupId);
    return () => {
      cancelled = true;
      leaveGroup(groupId);
    };
  }, [groupId, joinGroup, leaveGroup]);

  // Live incoming messages for this group.
  useEffect(() => {
    const unsub = subscribe('group:message:new', (msg: GroupMessage) => {
      if (!msg || msg.groupId !== groupId) return;
      prependMessage(msg);
      // We're looking at the thread, so keep it marked read.
      markGroupRead(groupId).catch(() => {});
    });
    return unsub;
  }, [groupId, subscribe, prependMessage]);

  const loadOlder = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = messages[messages.length - 1];
      const res = await fetchGroupMessages(groupId, {
        before: oldest.createdAt,
        limit: 30,
      });
      setMessages(prev => {
        const seen = new Set(prev.map(m => m._id));
        const older = res.messages.filter(m => !seen.has(m._id));
        return [...prev, ...older];
      });
      setHasMore(res.hasMore);
    } catch {
      // Non-fatal — leave what we have.
    } finally {
      setLoadingMore(false);
    }
  }, [groupId, hasMore, loadingMore, messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);
    try {
      const msg = await sendGroupMessage(groupId, text);
      prependMessage(msg);
    } catch {
      // Restore the draft so the user doesn't lose their text.
      setInput(text);
    } finally {
      setSending(false);
    }
  }, [groupId, input, sending, prependMessage]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        flex: {flex: 1},
        loadingWrap: {flex: 1, alignItems: 'center', justifyContent: 'center'},
        listContent: {paddingVertical: 12, paddingHorizontal: 12},
        emptyWrap: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 40,
        },
        emptyTitle: {
          fontSize: 16,
          fontWeight: '700',
          color: colors.text,
          marginBottom: 6,
          textAlign: 'center',
        },
        emptySubtitle: {
          fontSize: 13,
          color: colors.secondaryText,
          textAlign: 'center',
          lineHeight: 19,
        },
        // ── Chat bubbles ──
        rowMine: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          marginBottom: 10,
        },
        rowTheirs: {
          flexDirection: 'row',
          justifyContent: 'flex-start',
          marginBottom: 10,
        },
        avatar: {
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: darkMode
            ? 'rgba(255,255,255,0.08)'
            : 'rgba(0,0,0,0.06)',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          marginRight: 8,
          alignSelf: 'flex-end',
        },
        avatarImage: {width: 30, height: 30},
        avatarInitials: {color: colors.text, fontWeight: '700', fontSize: 11},
        bubbleWrap: {maxWidth: '78%'},
        senderName: {
          fontSize: 11,
          fontWeight: '700',
          color: colors.secondaryText,
          marginBottom: 3,
          marginLeft: 4,
        },
        bubbleMine: {
          backgroundColor: colors.primary,
          borderRadius: 16,
          borderBottomRightRadius: 4,
          paddingHorizontal: 13,
          paddingVertical: 9,
        },
        bubbleTheirs: {
          backgroundColor: colors.card,
          borderRadius: 16,
          borderBottomLeftRadius: 4,
          paddingHorizontal: 13,
          paddingVertical: 9,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        bubbleTextMine: {color: '#FFFFFF', fontSize: 15, lineHeight: 20},
        bubbleTextTheirs: {color: colors.text, fontSize: 15, lineHeight: 20},
        metaMine: {
          fontSize: 10,
          color: colors.secondaryText,
          alignSelf: 'flex-end',
          marginTop: 3,
          marginRight: 4,
        },
        metaTheirs: {
          fontSize: 10,
          color: colors.secondaryText,
          alignSelf: 'flex-start',
          marginTop: 3,
          marginLeft: 4,
        },
        // ── System messages ──
        systemWrap: {alignItems: 'center', marginVertical: 10},
        systemText: {
          fontSize: 12,
          color: colors.secondaryText,
          textAlign: 'center',
          marginBottom: 6,
          fontWeight: '600',
        },
        eventCard: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: colors.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          borderRadius: 12,
          paddingVertical: 10,
          paddingHorizontal: 12,
          maxWidth: '90%',
        },
        eventIcon: {
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: colors.primary + '18',
          alignItems: 'center',
          justifyContent: 'center',
        },
        eventBody: {flexShrink: 1},
        eventName: {fontSize: 14, fontWeight: '700', color: colors.text},
        eventDate: {fontSize: 12, color: colors.secondaryText, marginTop: 1},
        // ── Composer ──
        composer: {
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          backgroundColor: colors.card,
        },
        textInput: {
          flex: 1,
          minHeight: 40,
          maxHeight: 120,
          borderRadius: 20,
          paddingHorizontal: 15,
          paddingTop: Platform.OS === 'ios' ? 10 : 6,
          paddingBottom: Platform.OS === 'ios' ? 10 : 6,
          fontSize: 15,
          color: colors.text,
          backgroundColor: darkMode
            ? 'rgba(255,255,255,0.07)'
            : 'rgba(0,0,0,0.05)',
        },
        sendBtn: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary,
        },
        sendBtnDisabled: {opacity: 0.4},
      }),
    [colors, darkMode],
  );

  const renderItem = ({item}: {item: GroupMessage}) => {
    if (item.kind === 'system') {
      return (
        <View style={styles.systemWrap}>
          <Text style={styles.systemText}>{item.text}</Text>
          {item.eventRef?.eventId ? (
            <TouchableOpacity
              style={styles.eventCard}
              activeOpacity={0.8}
              onPress={() => openEvent(item.eventRef!.eventId)}>
              <View style={styles.eventIcon}>
                <FontAwesomeIcon
                  icon={faCalendarDay}
                  size={15}
                  color={colors.primary}
                />
              </View>
              <View style={styles.eventBody}>
                <Text style={styles.eventName} numberOfLines={1}>
                  {item.eventRef.eventName || t('groupChat.viewEvent') || 'View event'}
                </Text>
                {item.eventRef.eventDate ? (
                  <Text style={styles.eventDate}>{item.eventRef.eventDate}</Text>
                ) : null}
              </View>
              <FontAwesomeIcon
                icon={faChevronRight}
                size={13}
                color={colors.secondaryText}
              />
            </TouchableOpacity>
          ) : null}
        </View>
      );
    }

    const isMine = item.userId === currentUserId;
    if (isMine) {
      return (
        <View style={styles.rowMine}>
          <View style={styles.bubbleWrap}>
            <View style={styles.bubbleMine}>
              <Text style={styles.bubbleTextMine}>{item.text}</Text>
            </View>
            <Text style={styles.metaMine}>{relativeTime(item.createdAt)}</Text>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.rowTheirs}>
        <View style={styles.avatar}>
          {item.profilePicUrl ? (
            <Image source={{uri: item.profilePicUrl}} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarInitials}>
              {(item.username || '?').slice(0, 2).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={styles.bubbleWrap}>
          <Text style={styles.senderName}>{item.username || 'Member'}</Text>
          <View style={styles.bubbleTheirs}>
            <Text style={styles.bubbleTextTheirs}>{item.text}</Text>
          </View>
          <Text style={styles.metaTheirs}>{relativeTime(item.createdAt)}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.flex, {paddingBottom: bottomInset}]}>
      <FlatList
        style={styles.flex}
        data={messages}
        inverted={messages.length > 0}
        keyExtractor={m => m._id}
        renderItem={renderItem}
        contentContainerStyle={
          messages.length === 0 ? styles.flex : styles.listContent
        }
        onEndReached={loadOlder}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={{marginVertical: 12}}
            />
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>
              {t('groupChat.emptyTitle') || 'No messages yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {t('groupChat.emptySubtitle') ||
                'Say hi, share a plan, or lock in the next meetup.'}
            </Text>
          </View>
        }
      />
      <View style={styles.composer}>
        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder={t('groupChat.placeholder') || 'Message the group'}
          placeholderTextColor={colors.secondaryText}
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || sending}>
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <FontAwesomeIcon icon={faPaperPlane} size={16} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default GroupChat;
