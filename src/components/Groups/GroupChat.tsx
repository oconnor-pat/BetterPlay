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
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
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
  faComments,
  faImage,
  faPaperPlane,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import Clipboard from '@react-native-clipboard/clipboard';
import * as ImagePicker from 'react-native-image-picker';
import EmojiPicker, {type EmojiType} from 'rn-emoji-keyboard';
import {useNavigation} from '@react-navigation/native';
import {useBottomTabBarHeight} from '@react-navigation/bottom-tabs';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../ThemeContext/ThemeContext';
import {useSocket} from '../../Context/SocketContext';
import UserContext, {UserContextType} from '../UserContext';
import ReportSheet from '../Moderation/ReportSheet';
import MentionText from '../Mentions/MentionText';
import MentionSuggestions from '../Mentions/MentionSuggestions';
import {GroupMember, GroupMessage, GroupMessageReaction} from '../../types/group';
import {
  applyMention,
  filterMentionCandidates,
  getActiveMention,
  MentionCandidate,
} from '../../utils/mentions';
import {
  deleteGroupMessage,
  fetchGroupMessages,
  fetchMessageReactions,
  markGroupRead,
  type MessageReactor,
  reactToGroupMessage,
  sendGroupMessage,
  uploadChatImage,
} from '../../services/GroupChatService';

interface GroupChatProps {
  groupId: string;
  members?: GroupMember[];
  // Set when arriving from a reaction notification: the thread scrolls to
  // this message and flashes it. The nonce lets a repeat notification for
  // the same message re-run the effect.
  highlightMessageId?: string;
  highlightNonce?: number;
}

interface MessageAction {
  label: string;
  destructive?: boolean;
  onPress: () => void;
}

// A photo staged in the composer but not yet sent. Held locally (the
// upload only happens on send) so backing out costs nothing.
interface PendingImage {
  uri: string;
  base64: string;
  fileName?: string;
  width?: number;
  height?: number;
}

// Short relative timestamp for message metadata ("now", "5m", "3h",
// "2d"), falling back to a date once it's a week old.
const relativeTime = (iso: string): string => {
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

// Collapse the raw (user, emoji) rows into one pill per distinct emoji,
// kept in first-reacted order so pills don't reshuffle as counts change.
const summarizeReactions = (
  reactions: GroupMessageReaction[] | undefined,
  userId?: string,
): {emoji: string; count: number; mine: boolean}[] => {
  const order: string[] = [];
  const counts = new Map<string, number>();
  const mine = new Set<string>();

  (reactions || []).forEach(r => {
    if (!counts.has(r.emoji)) {
      order.push(r.emoji);
    }
    counts.set(r.emoji, (counts.get(r.emoji) || 0) + 1);
    if (userId && r.userId === userId) {
      mine.add(r.emoji);
    }
  });

  return order.map(emoji => ({
    emoji,
    count: counts.get(emoji) as number,
    mine: mine.has(emoji),
  }));
};

// Widest an attached image renders in the thread.
const IMAGE_MAX_WIDTH = 230;

// Reserve the right space before the image loads so the thread doesn't
// jump. Very tall images are clamped so a screenshot can't take over the
// whole view; falls back to 4:3 when the sender's client sent no size.
const imageDisplaySize = (
  width?: number,
  height?: number,
): {width: number; height: number} => {
  if (!width || !height || width <= 0 || height <= 0) {
    return {width: IMAGE_MAX_WIDTH, height: (IMAGE_MAX_WIDTH * 3) / 4};
  }
  const ratio = height / width;
  return {
    width: IMAGE_MAX_WIDTH,
    height: Math.round(IMAGE_MAX_WIDTH * Math.min(ratio, 1.6)),
  };
};

const GroupChat: React.FC<GroupChatProps> = ({
  groupId,
  members = [],
  highlightMessageId,
  highlightNonce,
}) => {
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
  const [inputCursor, setInputCursor] = useState(0);
  const [sending, setSending] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  // Message the emoji picker is currently reacting to.
  const [reactionTarget, setReactionTarget] = useState<GroupMessage | null>(
    null,
  );
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  // Android-only: message whose action sheet is open (see openMessageActions).
  const [actionTarget, setActionTarget] = useState<GroupMessage | null>(null);
  // Non-null while the "who reacted" sheet is open.
  const [reactedBy, setReactedBy] = useState<MessageReactor[] | null>(null);
  const [loadingReactedBy, setLoadingReactedBy] = useState(false);
  const [reportTarget, setReportTarget] = useState<GroupMessage | null>(null);
  // Message currently flashing after arriving from a notification.
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const highlightAnim = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList<GroupMessage>>(null);

  // Deterministic keyboard handling. KeyboardAvoidingView mis-measures
  // its own position inside the nested tab→stack navigator, so instead we
  // read the keyboard height directly and lift the composer by exactly
  // (keyboardHeight − tabBarHeight): the tab bar sits below this view and
  // is covered by the keyboard, so only the remainder needs padding.
  // iOS only — Android resizes the window natively (adjustResize).
  useEffect(() => {
    if (Platform.OS !== 'ios') {
      return;
    }
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
        if (cancelled) {
          return;
        }
        setMessages(res.messages);
        setHasMore(res.hasMore);
      } catch {
        if (!cancelled) {
          setMessages([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
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
      if (!msg || msg.groupId !== groupId) {
        return;
      }
      prependMessage(msg);
      // We're looking at the thread, so keep it marked read.
      markGroupRead(groupId).catch(() => {});
    });
    return unsub;
  }, [groupId, subscribe, prependMessage]);

  // Someone retracted a message. Keep the row but strip it, matching what
  // the server now serves, so the thread doesn't shift under the reader.
  useEffect(() => {
    const unsub = subscribe(
      'group:message:deleted',
      (data: {groupId: string; messageId: string}) => {
        if (!data || data.groupId !== groupId) {
          return;
        }
        setMessages(prev =>
          prev.map(m =>
            m._id === data.messageId
              ? {
                  ...m,
                  text: '',
                  imageUrl: undefined,
                  reactions: [],
                  deletedAt: new Date().toISOString(),
                }
              : m,
          ),
        );
        // If it was open in the viewer, there's nothing left to look at.
        setViewerImage(null);
      },
    );
    return unsub;
  }, [groupId, subscribe]);

  useEffect(() => {
    const unsub = subscribe(
      'group:message:reacted',
      (data: {
        groupId: string;
        messageId: string;
        reactions: GroupMessageReaction[];
      }) => {
        if (!data || data.groupId !== groupId) {
          return;
        }
        setMessages(prev =>
          prev.map(m =>
            m._id === data.messageId
              ? {...m, reactions: data.reactions || []}
              : m,
          ),
        );
      },
    );
    return unsub;
  }, [groupId, subscribe]);

  const loadOlder = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) {
      return;
    }
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

  // Stage a photo in the composer. Nothing is uploaded or sent yet — that
  // waits for the send button, so the photo can be captioned or dropped.
  const handlePickImage = useCallback(async () => {
    if (sending) {
      return;
    }

    const result = await ImagePicker.launchImageLibrary({
      mediaType: 'photo',
      includeBase64: true,
      maxWidth: 1280,
      maxHeight: 1280,
      quality: 0.7,
    });
    if (result.didCancel) {
      return;
    }

    const asset = result.assets?.[0];
    if (!asset?.base64 || !asset.uri) {
      Alert.alert(
        t('groupChat.imageFailed') || 'Could not attach photo',
        t('groupChat.imageFailedMessage') || 'Please try another photo.',
      );
      return;
    }

    setPendingImage({
      uri: asset.uri,
      base64: asset.base64,
      fileName: asset.fileName,
      width: asset.width,
      height: asset.height,
    });
  }, [sending, t]);

  // Sends text, a staged photo, or a photo with the text as its caption.
  // The upload happens here rather than at pick time so a photo the user
  // backs out of never costs a round trip.
  // Arriving from a reaction notification: bring the reacted-to message
  // into view and flash it. It may be older than the first page, so page
  // backwards a bounded number of times looking for it — bounded because
  // the message could also have been deleted, and we don't want to walk
  // the entire history to discover that.
  useEffect(() => {
    if (!highlightMessageId || loading) {
      return;
    }

    let cancelled = false;

    const flash = (index: number) => {
      listRef.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.5,
      });
      setHighlightedId(highlightMessageId);
      highlightAnim.setValue(0);
      Animated.sequence([
        Animated.timing(highlightAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.delay(1300),
        Animated.timing(highlightAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start(({finished}) => {
        if (finished && !cancelled) {
          setHighlightedId(null);
        }
      });
    };

    const locate = async () => {
      let pool = messages;
      for (let attempt = 0; attempt < 5; attempt++) {
        if (cancelled) {
          return;
        }
        const index = pool.findIndex(m => m._id === highlightMessageId);
        if (index >= 0) {
          flash(index);
          return;
        }
        const oldest = pool[pool.length - 1];
        if (!oldest) {
          return;
        }
        let page;
        try {
          page = await fetchGroupMessages(groupId, {
            before: oldest.createdAt,
            limit: 30,
          });
        } catch {
          return;
        }
        if (cancelled || page.messages.length === 0) {
          return;
        }
        const seen = new Set(pool.map(m => m._id));
        pool = [...pool, ...page.messages.filter(m => !seen.has(m._id))];
        setMessages(pool);
        setHasMore(page.hasMore);
        if (!page.hasMore) {
          const finalIndex = pool.findIndex(m => m._id === highlightMessageId);
          if (finalIndex >= 0) {
            flash(finalIndex);
          }
          return;
        }
      }
    };

    locate();
    return () => {
      cancelled = true;
    };
    // `messages` is deliberately excluded: this should run when a
    // notification points us at a message, not on every new message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightMessageId, highlightNonce, loading, groupId, highlightAnim]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    const image = pendingImage;
    if ((!text && !image) || sending) {
      return;
    }

    setInput('');
    setPendingImage(null);
    setSending(true);
    try {
      const imageUrl = image
        ? await uploadChatImage(image.base64, image.fileName)
        : undefined;
      const msg = await sendGroupMessage(groupId, {
        text,
        imageUrl,
        imageWidth: image?.width,
        imageHeight: image?.height,
      });
      prependMessage(msg);
    } catch {
      // Put the draft back so nothing is lost to a failed send.
      setInput(text);
      setPendingImage(image);
      if (image) {
        Alert.alert(
          t('groupChat.imageFailed') || 'Could not attach photo',
          t('groupChat.imageFailedMessage') || 'Please try another photo.',
        );
      }
    } finally {
      setSending(false);
    }
  }, [groupId, input, pendingImage, sending, prependMessage, t]);

  // Optimistic toggle: flip the pill immediately, then reconcile with the
  // server's authoritative list (the socket echo also lands for everyone
  // else in the room). On failure we restore the previous list.
  const handleReact = useCallback(
    async (message: GroupMessage, emoji: string) => {
      const previous = message.reactions || [];
      const alreadyMine = previous.some(
        r => r.userId === currentUserId && r.emoji === emoji,
      );
      const optimistic = alreadyMine
        ? previous.filter(
            r => !(r.userId === currentUserId && r.emoji === emoji),
          )
        : [...previous, {userId: currentUserId as string, emoji}];

      setMessages(prev =>
        prev.map(m =>
          m._id === message._id ? {...m, reactions: optimistic} : m,
        ),
      );

      try {
        const reactions = await reactToGroupMessage(
          groupId,
          message._id,
          emoji,
        );
        setMessages(prev =>
          prev.map(m => (m._id === message._id ? {...m, reactions} : m)),
        );
      } catch {
        setMessages(prev =>
          prev.map(m =>
            m._id === message._id ? {...m, reactions: previous} : m,
          ),
        );
      }
    },
    [groupId, currentUserId],
  );

  // Long-pressing a pill answers "who reacted?" — the same affordance the
  // event cards use for their reaction pills.
  const showReactedBy = useCallback(
    async (message: GroupMessage) => {
      setReactedBy([]);
      setLoadingReactedBy(true);
      try {
        setReactedBy(await fetchMessageReactions(groupId, message._id));
      } catch {
        setReactedBy([]);
      } finally {
        setLoadingReactedBy(false);
      }
    },
    [groupId],
  );

  const openReactorProfile = useCallback(
    (reactor: MessageReactor) => {
      setReactedBy(null);
      // PublicProfile isn't registered in the Groups stack, so this has to
      // hop to the Profile tab's copy of it.
      navigation.navigate('Profile', {
        screen: 'PublicProfile',
        params: {
          userId: reactor.userId,
          username: reactor.username,
          profilePicUrl: reactor.profilePicUrl,
        },
      });
    },
    [navigation],
  );

  const openMentionProfile = useCallback(
    (username: string) => {
      const member = members.find(
        m => m.username?.toLowerCase() === username.toLowerCase(),
      );
      navigation.navigate('Profile', {
        screen: 'PublicProfile',
        params: {
          userId: member?.userId,
          username: member?.username || username,
          profilePicUrl: member?.profilePicUrl,
        },
      });
    },
    [members, navigation],
  );

  const mentionCandidates = useMemo(() => {
    const active = getActiveMention(input, inputCursor);
    if (!active) {
      return [] as MentionCandidate[];
    }
    const pool: MentionCandidate[] = members.map(m => ({
      userId: m.userId,
      username: m.username || '',
      name: m.name,
      profilePicUrl: m.profilePicUrl,
    }));
    return filterMentionCandidates(pool, active.query, currentUserId);
  }, [members, input, inputCursor, currentUserId]);

  const handleSelectMention = useCallback(
    (candidate: MentionCandidate) => {
      const active = getActiveMention(input, inputCursor);
      if (!active) {
        return;
      }
      const next = applyMention(input, active, candidate.username);
      setInput(next.text);
      setInputCursor(next.cursor);
    },
    [input, inputCursor],
  );

  const handleDelete = useCallback(
    (message: GroupMessage) => {
      Alert.alert(
        t('groupChat.deleteTitle') || 'Delete message?',
        t('groupChat.deleteMessage') ||
          'This removes it for everyone in the group.',
        [
          {text: t('common.cancel') || 'Cancel', style: 'cancel'},
          {
            text: t('common.delete') || 'Delete',
            style: 'destructive',
            onPress: async () => {
              const snapshot = message;
              // Optimistic tombstone; the socket echo confirms it.
              setMessages(prev =>
                prev.map(m =>
                  m._id === message._id
                    ? {
                        ...m,
                        text: '',
                        imageUrl: undefined,
                        reactions: [],
                        deletedAt: new Date().toISOString(),
                      }
                    : m,
                ),
              );
              try {
                await deleteGroupMessage(groupId, message._id);
              } catch {
                setMessages(prev =>
                  prev.map(m => (m._id === snapshot._id ? snapshot : m)),
                );
                Alert.alert(
                  t('groupChat.deleteFailed') || 'Could not delete message',
                  t('common.tryAgain') || 'Please try again',
                );
              }
            },
          },
        ],
      );
    },
    [groupId, t],
  );

  // Actions offered on long-press, in menu order.
  const buildActions = useCallback(
    (message: GroupMessage): MessageAction[] => {
      const actions: MessageAction[] = [
        {
          label: t('groupChat.react') || 'React',
          onPress: () => setReactionTarget(message),
        },
      ];
      if (message.text) {
        actions.push({
          label: t('groupChat.copy') || 'Copy text',
          onPress: () => Clipboard.setString(message.text),
        });
      }
      if (message.userId === currentUserId) {
        actions.push({
          label: t('common.delete') || 'Delete',
          destructive: true,
          onPress: () => handleDelete(message),
        });
      } else {
        // Reporting your own message would be meaningless, so this is
        // the one action that's offered only on someone else's.
        actions.push({
          label: t('moderation.report'),
          destructive: true,
          onPress: () => setReportTarget(message),
        });
      }
      return actions;
    },
    [currentUserId, handleDelete, t],
  );

  // iOS gets the native sheet, matching GroupDetail's member menu. Android
  // can't: its Alert is backed by AlertDialog, which supports at most three
  // buttons, and this menu can reach four with the cancel row — so it gets
  // a themed sheet of its own instead.
  const openMessageActions = useCallback(
    (message: GroupMessage) => {
      // Nothing on the menu applies to a blocked sender's message: it
      // has no content to copy or react to, and reporting someone you've
      // already blocked adds nothing.
      if (message.kind === 'system' || message.deletedAt || message.blocked) {
        return;
      }

      if (Platform.OS !== 'ios') {
        setActionTarget(message);
        return;
      }

      const actions = buildActions(message);
      const labels = [
        ...actions.map(a => a.label),
        t('common.cancel') || 'Cancel',
      ];
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: labels,
          cancelButtonIndex: labels.length - 1,
          destructiveButtonIndex: actions.findIndex(a => a.destructive),
        },
        idx => actions[idx]?.onPress?.(),
      );
    },
    [buildActions, t],
  );

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
          fontSize: 17,
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
        },
        // ── Chat bubbles ──
        rowMine: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          marginBottom: 12,
        },
        rowTheirs: {
          flexDirection: 'row',
          justifyContent: 'flex-start',
          marginBottom: 12,
        },
        avatar: {
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: darkMode
            ? 'rgba(255,255,255,0.08)'
            : 'rgba(0,0,0,0.06)',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          marginRight: 8,
          alignSelf: 'flex-end',
          borderWidth: 1.5,
          borderColor: colors.primary + '33',
        },
        avatarImage: {width: 32, height: 32},
        avatarInitials: {color: colors.text, fontWeight: '700', fontSize: 11},
        bubbleWrap: {maxWidth: '78%'},
        // Sits behind the bubble and fades out, so a message arrived at
        // from a notification is obvious without shifting the layout.
        highlightOverlay: {
          position: 'absolute',
          top: -6,
          bottom: -6,
          left: -8,
          right: -8,
          borderRadius: 20,
          backgroundColor: colors.primary + '40',
        },
        senderName: {
          fontSize: 11,
          fontWeight: '700',
          color: colors.secondaryText,
          marginBottom: 4,
          marginLeft: 6,
        },
        bubbleMine: {
          backgroundColor: colors.primary,
          borderRadius: 20,
          borderBottomRightRadius: 6,
          paddingHorizontal: 14,
          paddingVertical: 10,
        },
        bubbleTheirs: {
          backgroundColor: darkMode
            ? 'rgba(255,255,255,0.08)'
            : colors.card,
          borderRadius: 20,
          borderBottomLeftRadius: 6,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        bubbleTextMine: {color: '#FFFFFF', fontSize: 15, lineHeight: 21},
        bubbleTextTheirs: {color: colors.text, fontSize: 15, lineHeight: 21},
        // A retracted message keeps its slot so the thread doesn't shift,
        // but reads as clearly absent rather than empty.
        bubbleDeleted: {
          backgroundColor: 'transparent',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          borderRadius: 16,
          paddingHorizontal: 13,
          paddingVertical: 9,
        },
        bubbleTextDeleted: {
          color: colors.secondaryText,
          fontSize: 14,
          fontStyle: 'italic',
        },
        // ── Image attachments ──
        // The photo is its own block with no bubble behind it, so nothing
        // frames or overlaps it; the caption is a separate bubble sitting
        // below, matched to the photo's width.
        imageStack: {gap: 4},
        imageBubble: {
          borderRadius: 16,
          overflow: 'hidden',
          backgroundColor: darkMode
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(0,0,0,0.05)',
        },
        // Matched to the photo's width; the corner radii (including the
        // tail) come from the normal bubble styles so a caption looks like
        // any other message in the thread.
        captionBubble: {alignSelf: 'stretch'},
        // ── Reaction pills ──
        reactionRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 4,
          marginTop: 4,
        },
        reactionRowMine: {justifyContent: 'flex-end'},
        reactionPill: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 3,
          paddingHorizontal: 7,
          paddingVertical: 3,
          borderRadius: 11,
          backgroundColor: colors.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        reactionPillMine: {
          backgroundColor: colors.primary + '22',
          borderColor: colors.primary,
        },
        reactionEmoji: {fontSize: 12},
        reactionCount: {
          fontSize: 11,
          fontWeight: '700',
          color: colors.secondaryText,
        },
        reactionCountMine: {color: colors.primary},
        // ── Full-screen image viewer ──
        viewerBackdrop: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.94)',
          alignItems: 'center',
          justifyContent: 'center',
        },
        viewerImage: {width: '100%', height: '80%'},
        viewerClose: {
          position: 'absolute',
          top: 50,
          right: 20,
          width: 38,
          height: 38,
          borderRadius: 19,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.15)',
        },
        // ── Android long-press sheet ──
        sheetBackdrop: {
          flex: 1,
          backgroundColor: '#00000066',
          justifyContent: 'flex-end',
        },
        sheet: {
          backgroundColor: colors.card,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          paddingTop: 8,
          paddingBottom: 24,
        },
        sheetHandle: {
          alignSelf: 'center',
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
          marginBottom: 6,
        },
        sheetRow: {paddingVertical: 15, paddingHorizontal: 22},
        sheetLabel: {fontSize: 16, color: colors.text, fontWeight: '600'},
        sheetLabelDestructive: {color: '#E5484D'},
        sheetTitle: {
          fontSize: 15,
          fontWeight: '700',
          color: colors.text,
          paddingHorizontal: 22,
          paddingTop: 6,
          paddingBottom: 10,
        },
        sheetLoading: {paddingVertical: 22},
        sheetEmpty: {
          fontSize: 14,
          color: colors.secondaryText,
          paddingHorizontal: 22,
          paddingVertical: 18,
        },
        reactorRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 22,
          paddingVertical: 9,
        },
        reactorName: {
          flex: 1,
          fontSize: 15,
          color: colors.text,
          fontWeight: '600',
        },
        reactorEmoji: {fontSize: 18},
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
        // The border and background live on the wrapper so a staged photo
        // reads as part of the composer rather than floating above it.
        composerWrap: {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          backgroundColor: colors.background,
          paddingBottom: 2,
        },
        composer: {
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
        },
        pendingRow: {
          flexDirection: 'row',
          paddingHorizontal: 12,
          paddingTop: 10,
        },
        pendingImage: {
          width: 62,
          height: 62,
          borderRadius: 10,
          backgroundColor: darkMode
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(0,0,0,0.05)',
        },
        pendingRemove: {
          position: 'absolute',
          top: -6,
          right: -6,
          width: 20,
          height: 20,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000000CC',
          borderWidth: 1,
          borderColor: colors.card,
        },
        textInput: {
          flex: 1,
          minHeight: 42,
          maxHeight: 120,
          borderRadius: 22,
          paddingHorizontal: 16,
          paddingTop: Platform.OS === 'ios' ? 11 : 8,
          paddingBottom: Platform.OS === 'ios' ? 11 : 8,
          fontSize: 15,
          color: colors.text,
          backgroundColor: colors.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        sendBtn: {
          width: 42,
          height: 42,
          borderRadius: 21,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary,
        },
        sendBtnDisabled: {opacity: 0.4},
        attachBtn: {
          width: 42,
          height: 42,
          borderRadius: 21,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
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
                  {item.eventRef.eventName ||
                    t('groupChat.viewEvent') ||
                    'View event'}
                </Text>
                {item.eventRef.eventDate ? (
                  <Text style={styles.eventDate}>
                    {item.eventRef.eventDate}
                  </Text>
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
    const isDeleted = !!item.deletedAt;
    // The server strips content from blocked senders' messages but keeps
    // the row, so the thread doesn't develop unexplained gaps where
    // replies point at nothing.
    const isBlocked = !!item.blocked;
    const pills = summarizeReactions(item.reactions, currentUserId);

    // The bubble's interior: an image, text, or an image with a caption.
    const body = isBlocked ? (
      <View style={styles.bubbleDeleted}>
        <Text style={styles.bubbleTextDeleted}>
          {t('moderation.blockedMessage')}
        </Text>
      </View>
    ) : isDeleted ? (
      <View style={styles.bubbleDeleted}>
        <Text style={styles.bubbleTextDeleted}>
          {t('groupChat.messageDeleted') || 'This message was deleted'}
        </Text>
      </View>
    ) : item.imageUrl ? (
      // Photo and caption are separate stacked blocks, so the caption
      // reads as sitting under a complete photo rather than covering the
      // bottom of one.
      <View style={styles.imageStack}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setViewerImage(item.imageUrl as string)}
          onLongPress={() => openMessageActions(item)}>
          <Image
            source={{uri: item.imageUrl}}
            style={[
              styles.imageBubble,
              imageDisplaySize(item.imageWidth, item.imageHeight),
            ]}
            resizeMode="cover"
          />
        </TouchableOpacity>
        {item.text ? (
          <View
            style={[
              isMine ? styles.bubbleMine : styles.bubbleTheirs,
              styles.captionBubble,
            ]}>
            <MentionText
              text={item.text}
              style={isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs}
              onAccent={isMine}
              onPressMention={openMentionProfile}
            />
          </View>
        ) : null}
      </View>
    ) : (
      <View style={isMine ? styles.bubbleMine : styles.bubbleTheirs}>
        <MentionText
          text={item.text}
          style={isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs}
          onAccent={isMine}
          onPressMention={openMentionProfile}
        />
      </View>
    );

    const reactionRow =
      pills.length > 0 ? (
        <View style={[styles.reactionRow, isMine && styles.reactionRowMine]}>
          {pills.map(pill => (
            <TouchableOpacity
              key={pill.emoji}
              style={[
                styles.reactionPill,
                pill.mine && styles.reactionPillMine,
              ]}
              activeOpacity={0.7}
              onPress={() => handleReact(item, pill.emoji)}
              onLongPress={() => showReactedBy(item)}
              delayLongPress={300}
              hitSlop={{top: 6, bottom: 6, left: 2, right: 2}}>
              <Text style={styles.reactionEmoji}>{pill.emoji}</Text>
              <Text
                style={[
                  styles.reactionCount,
                  pill.mine && styles.reactionCountMine,
                ]}>
                {pill.count}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null;

    const highlight =
      highlightedId === item._id ? (
        <Animated.View
          style={[styles.highlightOverlay, {opacity: highlightAnim}]}
          pointerEvents="none"
        />
      ) : null;

    if (isMine) {
      return (
        <View style={styles.rowMine}>
          <View style={styles.bubbleWrap}>
            {highlight}
            <Pressable
              onLongPress={() => openMessageActions(item)}
              delayLongPress={300}>
              {body}
            </Pressable>
            {reactionRow}
            <Text style={styles.metaMine}>{relativeTime(item.createdAt)}</Text>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.rowTheirs}>
        <View style={styles.avatar}>
          {item.profilePicUrl ? (
            <Image
              source={{uri: item.profilePicUrl}}
              style={styles.avatarImage}
            />
          ) : (
            <Text style={styles.avatarInitials}>
              {(item.username || '?').slice(0, 2).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={styles.bubbleWrap}>
          {highlight}
          <Text style={styles.senderName}>{item.username || 'Member'}</Text>
          <Pressable
            onLongPress={() => openMessageActions(item)}
            delayLongPress={300}>
            {body}
          </Pressable>
          {reactionRow}
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
        ref={listRef}
        style={styles.flex}
        data={messages}
        inverted={messages.length > 0}
        keyExtractor={m => m._id}
        renderItem={renderItem}
        // Rows are variable height, so a far-off index may not be measured
        // yet. Nudge the list toward it and retry once it has been.
        onScrollToIndexFailed={info => {
          listRef.current?.scrollToOffset({
            offset: info.averageItemLength * info.index,
            animated: true,
          });
          setTimeout(() => {
            if (messages.length > info.index) {
              listRef.current?.scrollToIndex({
                index: info.index,
                animated: true,
                viewPosition: 0.5,
              });
            }
          }, 350);
        }}
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
            <View style={styles.emptyIcon}>
              <FontAwesomeIcon
                icon={faComments}
                size={26}
                color={colors.primary}
              />
            </View>
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
      <View style={styles.composerWrap}>
        {pendingImage ? (
          <View style={styles.pendingRow}>
            <View>
              <Image
                source={{uri: pendingImage.uri}}
                style={styles.pendingImage}
              />
              <TouchableOpacity
                style={styles.pendingRemove}
                onPress={() => setPendingImage(null)}
                disabled={sending}
                accessibilityLabel={t('common.cancel') || 'Cancel'}>
                <FontAwesomeIcon icon={faXmark} size={10} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
        <MentionSuggestions
          candidates={mentionCandidates}
          onSelect={handleSelectMention}
        />
        <View style={styles.composer}>
          <TouchableOpacity
            style={[styles.attachBtn, sending && styles.sendBtnDisabled]}
            onPress={handlePickImage}
            disabled={sending}
            accessibilityLabel={t('groupChat.attachPhoto') || 'Attach photo'}>
            <FontAwesomeIcon
              icon={faImage}
              size={17}
              color={colors.secondaryText}
            />
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={text => {
              setInput(text);
              setInputCursor(text.length);
            }}
            onSelectionChange={e => {
              setInputCursor(e.nativeEvent.selection.end);
            }}
            placeholder={
              pendingImage
                ? t('groupChat.caption') || 'Add a caption'
                : t('groupChat.placeholder') || 'Message the group'
            }
            placeholderTextColor={colors.secondaryText}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              ((!input.trim() && !pendingImage) || sending) &&
                styles.sendBtnDisabled,
            ]}
            onPress={handleSend}
            disabled={(!input.trim() && !pendingImage) || sending}>
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <FontAwesomeIcon icon={faPaperPlane} size={16} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <EmojiPicker
        open={!!reactionTarget}
        onClose={() => setReactionTarget(null)}
        onEmojiSelected={(picked: EmojiType) => {
          const target = reactionTarget;
          setReactionTarget(null);
          if (target && picked?.emoji) {
            handleReact(target, picked.emoji);
          }
        }}
        enableSearchBar
        enableRecentlyUsed
        // Must not be "top": that flips the sheet with column-reverse and
        // pushes the search field under the keyboard.
        categoryPosition="bottom"
        // Stops the first keystroke animating a scroll across every
        // category to reach the search results page.
        enableCategoryChangeAnimation={false}
        enableSearchAnimation={false}
        theme={{
          backdrop: '#00000066',
          knob: colors.primary,
          container: colors.card,
          header: colors.text,
          category: {
            icon: colors.secondaryText,
            iconActive: '#FFFFFF',
            container: darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
            containerActive: colors.primary,
          },
          search: {
            text: colors.text,
            placeholder: colors.secondaryText,
            icon: colors.secondaryText,
            background: darkMode
              ? 'rgba(255,255,255,0.07)'
              : 'rgba(0,0,0,0.05)',
          },
        }}
      />

      <Modal
        visible={!!actionTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setActionTarget(null)}>
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setActionTarget(null)}>
          <Pressable style={styles.sheet}>
            <View style={styles.sheetHandle} />
            {(actionTarget ? buildActions(actionTarget) : []).map(action => (
              <TouchableOpacity
                key={action.label}
                style={styles.sheetRow}
                onPress={() => {
                  setActionTarget(null);
                  // "React" opens the emoji picker, itself a Modal —
                  // mounting it in the same frame this sheet unmounts can
                  // leave Android with neither showing. Let the dismiss
                  // land first.
                  setTimeout(() => action.onPress(), 150);
                }}>
                <Text
                  style={[
                    styles.sheetLabel,
                    action.destructive && styles.sheetLabelDestructive,
                  ]}>
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={reactedBy !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setReactedBy(null)}>
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setReactedBy(null)}>
          <Pressable style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              {t('groupChat.reactions') || 'Reactions'}
            </Text>
            {loadingReactedBy ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={styles.sheetLoading}
              />
            ) : reactedBy && reactedBy.length > 0 ? (
              reactedBy.map((reactor, index) => (
                <TouchableOpacity
                  key={`${reactor.userId}-${reactor.emoji}-${index}`}
                  style={styles.reactorRow}
                  onPress={() => openReactorProfile(reactor)}>
                  <View style={styles.avatar}>
                    {reactor.profilePicUrl ? (
                      <Image
                        source={{uri: reactor.profilePicUrl}}
                        style={styles.avatarImage}
                      />
                    ) : (
                      <Text style={styles.avatarInitials}>
                        {(reactor.username || reactor.name || '?')
                          .slice(0, 2)
                          .toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.reactorName} numberOfLines={1}>
                    {reactor.name || reactor.username || 'Member'}
                  </Text>
                  <Text style={styles.reactorEmoji}>{reactor.emoji}</Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.sheetEmpty}>
                {t('groupChat.noReactionsYet') || 'No reactions yet'}
              </Text>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!viewerImage}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerImage(null)}>
        <Pressable
          style={styles.viewerBackdrop}
          onPress={() => setViewerImage(null)}>
          {viewerImage ? (
            <Image
              source={{uri: viewerImage}}
              style={styles.viewerImage}
              resizeMode="contain"
            />
          ) : null}
          <TouchableOpacity
            style={styles.viewerClose}
            onPress={() => setViewerImage(null)}>
            <FontAwesomeIcon icon={faXmark} size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </Pressable>
      </Modal>

      <ReportSheet
        visible={reportTarget !== null}
        onClose={() => setReportTarget(null)}
        reportedUserId={reportTarget?.userId || ''}
        username={reportTarget?.username}
        target="group_message"
        contentId={reportTarget?._id}
      />
    </View>
  );
};

export default GroupChat;
