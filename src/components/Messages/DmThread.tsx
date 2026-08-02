// A 1-to-1 direct message thread. Mirrors GroupChat's mechanics — an
// inverted FlatList holding messages newest-first, a createdAt cursor for
// paging backwards, and a live socket room — but stands alone as a full
// screen with its own header instead of living inside a tab.
//
// Two things are specific to DMs. First, a thread opened by someone who
// isn't your friend arrives as a *request*: until you accept it, a bar
// above the composer offers Accept / Decline, and simply writing back
// counts as accepting. Second, a declined thread stays readable but its
// composer is closed, since the whole point of declining is that the
// sender can't reach you again.
//
// Can be entered two ways: with a conversationId (from the inbox or a
// notification) or with just a userId (from someone's profile), in which
// case the thread is opened — or found, if it already exists — on mount.

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
import {SafeAreaView} from 'react-native-safe-area-context';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faChevronLeft,
  faImage,
  faPaperPlane,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import Clipboard from '@react-native-clipboard/clipboard';
import EmojiPicker, {type EmojiType} from 'rn-emoji-keyboard';
import * as ImagePicker from 'react-native-image-picker';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useBottomTabBarHeight} from '@react-navigation/bottom-tabs';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../ThemeContext/ThemeContext';
import {useSocket} from '../../Context/SocketContext';
import UserContext, {UserContextType} from '../UserContext';
import {
  Conversation,
  DirectMessage,
  DirectMessageReaction,
} from '../../types/dm';
import {MessageReactor} from '../../services/GroupChatService';
import ReportSheet from '../Moderation/ReportSheet';
import {
  acceptConversation,
  declineConversation,
  deleteDirectMessage,
  fetchConversation,
  fetchDirectMessages,
  fetchDmMessageReactions,
  markConversationRead,
  openConversation,
  reactToDirectMessage,
  sendDirectMessage,
  uploadDmImage,
} from '../../services/DirectMessageService';

interface PendingImage {
  uri: string;
  base64: string;
  fileName?: string;
  width?: number;
  height?: number;
}

interface MessageAction {
  label: string;
  destructive?: boolean;
  onPress: () => void;
}

// Collapse the raw (user, emoji) rows into one pill per distinct emoji,
// kept in first-reacted order so pills don't reshuffle as counts change.
const summarizeReactions = (
  reactions: DirectMessageReaction[] | undefined,
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

const DmThread: React.FC = () => {
  const {colors, darkMode} = useTheme();
  const {t} = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const tabBarHeight = useBottomTabBarHeight();
  const {joinConversation, leaveConversation, subscribe} = useSocket();
  const {userData} = useContext(UserContext) as UserContextType;
  const currentUserId = userData?._id;

  const routeConversationId: string | undefined = route.params?.conversationId;
  const routeUserId: string | undefined = route.params?.userId;
  // Set when arriving from a reaction notification: the thread scrolls to
  // that message and flashes it. The nonce lets a repeat tap re-run the
  // flash even though the id hasn't changed.
  const highlightMessageId: string | undefined =
    route.params?.highlightMessageId;
  const highlightNonce: number | undefined = route.params?.highlightNonce;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>(
    routeConversationId,
  );
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  // Message whose emoji picker is open.
  const [reactionTarget, setReactionTarget] = useState<DirectMessage | null>(
    null,
  );
  // Android-only: message whose action sheet is open (see openMessageActions).
  const [actionTarget, setActionTarget] = useState<DirectMessage | null>(null);
  const [reactedBy, setReactedBy] = useState<MessageReactor[] | null>(null);
  const [loadingReactedBy, setLoadingReactedBy] = useState(false);
  const [reportTarget, setReportTarget] = useState<DirectMessage | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const highlightAnim = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList<DirectMessage>>(null);

  // Header details can come in on the route so the screen has something
  // to show while the thread itself is still loading.
  const headerName =
    conversation?.otherUser.name ||
    conversation?.otherUser.username ||
    route.params?.name ||
    route.params?.username ||
    '';
  const headerAvatar =
    conversation?.otherUser.profilePicUrl || route.params?.profilePicUrl;
  const otherUserId = conversation?.otherUser.userId || routeUserId;

  // Same deterministic keyboard handling as group chat:
  // KeyboardAvoidingView mis-measures inside the nested tab→stack
  // navigator, so lift the composer by exactly (keyboard − tab bar).
  // iOS only; Android resizes the window natively.
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
  const prependMessage = useCallback((msg: DirectMessage) => {
    setMessages(prev =>
      prev.some(m => m._id === msg._id) ? prev : [msg, ...prev],
    );
  }, []);

  // Resolve the thread, then load its first page. Arriving with only a
  // userId (from a profile) opens or finds the thread first.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const conv = routeConversationId
          ? await fetchConversation(routeConversationId)
          : routeUserId
          ? await openConversation(routeUserId)
          : null;
        if (cancelled || !conv) {
          if (!cancelled) {
            setLoading(false);
          }
          return;
        }
        setConversation(conv);
        setConversationId(conv._id);

        const res = await fetchDirectMessages(conv._id, {limit: 30});
        if (cancelled) {
          return;
        }
        setMessages(res.messages);
        setHasMore(res.hasMore);
        markConversationRead(conv._id).catch(() => {});
      } catch {
        // Without a resolved thread there's nothing to send to, so flag
        // it rather than leaving a composer that would silently no-op.
        if (!cancelled) {
          setMessages([]);
          setLoadFailed(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routeConversationId, routeUserId]);

  // Join the thread's room once we know its id. Being in the room also
  // tells the server not to push us messages we're already watching.
  useEffect(() => {
    if (!conversationId) {
      return;
    }
    joinConversation(conversationId);
    return () => leaveConversation(conversationId);
  }, [conversationId, joinConversation, leaveConversation]);

  useEffect(() => {
    const unsub = subscribe('dm:message:new', (msg: DirectMessage) => {
      if (!msg || !conversationId || msg.conversationId !== conversationId) {
        return;
      }
      prependMessage(msg);
      // We're looking at the thread, so keep it marked read.
      markConversationRead(conversationId).catch(() => {});
    });
    return unsub;
  }, [conversationId, subscribe, prependMessage]);

  // Someone retracted a message. Keep the row but strip it, matching what
  // the server now serves, so the thread doesn't shift under the reader.
  useEffect(() => {
    const unsub = subscribe(
      'dm:message:deleted',
      (data: {conversationId: string; messageId: string}) => {
        if (!data || data.conversationId !== conversationId) {
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
  }, [conversationId, subscribe]);

  useEffect(() => {
    const unsub = subscribe(
      'dm:message:reacted',
      (data: {
        conversationId: string;
        messageId: string;
        reactions: DirectMessageReaction[];
      }) => {
        if (!data || data.conversationId !== conversationId) {
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
  }, [conversationId, subscribe]);

  // The other side accepted or declined while we had the thread open.
  useEffect(() => {
    const unsub = subscribe(
      'dm:conversation:updated',
      (data: {conversationId: string; status: Conversation['status']}) => {
        if (!data || data.conversationId !== conversationId) {
          return;
        }
        setConversation(prev =>
          prev
            ? {
                ...prev,
                status: data.status,
                isIncomingRequest: false,
                isOutgoingRequest: false,
                // Declined while we had the thread open: swap the
                // composer for the notice without needing a reload.
                isClosedToMe:
                  data.status === 'declined' &&
                  prev.requestedBy === currentUserId,
              }
            : prev,
        );
      },
    );
    return unsub;
  }, [conversationId, currentUserId, subscribe]);

  const loadOlder = useCallback(async () => {
    if (loadingMore || !hasMore || !conversationId || messages.length === 0) {
      return;
    }
    setLoadingMore(true);
    try {
      const oldest = messages[messages.length - 1];
      const res = await fetchDirectMessages(conversationId, {
        before: oldest.createdAt,
        limit: 30,
      });
      setMessages(prev => {
        const seen = new Set(prev.map(m => m._id));
        return [...prev, ...res.messages.filter(m => !seen.has(m._id))];
      });
      setHasMore(res.hasMore);
    } catch {
      // Non-fatal — leave what we have.
    } finally {
      setLoadingMore(false);
    }
  }, [conversationId, hasMore, loadingMore, messages]);

  // Arriving from a reaction notification: bring the reacted-to message
  // into view and flash it. It may be older than the first page, so page
  // backwards a bounded number of times looking for it — bounded because
  // the message could also have been deleted, and we don't want to walk
  // the entire history to discover that.
  useEffect(() => {
    if (!highlightMessageId || loading || !conversationId) {
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
          page = await fetchDirectMessages(conversationId, {
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
  }, [
    highlightMessageId,
    highlightNonce,
    loading,
    conversationId,
    highlightAnim,
  ]);

  // Stage a photo in the composer. Nothing is uploaded or sent yet — that
  // waits for the send button, so the photo can be captioned or dropped.
  const handlePickImage = useCallback(async () => {
    if (sending) {
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibrary({
        mediaType: 'photo',
        includeBase64: true,
        quality: 0.7,
        maxWidth: 1600,
        maxHeight: 1600,
      });
      const asset = result.assets?.[0];
      if (!asset?.base64 || !asset.uri) {
        return;
      }
      setPendingImage({
        uri: asset.uri,
        base64: asset.base64,
        fileName: asset.fileName,
        width: asset.width,
        height: asset.height,
      });
    } catch {
      Alert.alert(
        t('groupChat.imageFailed') || 'Photo failed',
        t('groupChat.imageFailedMessage') || "That photo couldn't be attached.",
      );
    }
  }, [sending, t]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    const image = pendingImage;
    if ((!text && !image) || sending || !conversationId) {
      return;
    }

    setSending(true);
    setInput('');
    setPendingImage(null);
    try {
      let imageUrl: string | undefined;
      if (image) {
        imageUrl = await uploadDmImage(image.base64, image.fileName);
      }
      const msg = await sendDirectMessage(conversationId, {
        text,
        imageUrl,
        imageWidth: image?.width,
        imageHeight: image?.height,
      });
      prependMessage(msg);
      // Writing back to a request accepts it server-side; reflect that so
      // the Accept/Decline bar drops away immediately.
      setConversation(prev =>
        prev && prev.isIncomingRequest
          ? {
              ...prev,
              status: 'accepted',
              isIncomingRequest: false,
              isOutgoingRequest: false,
            }
          : prev,
      );
    } catch {
      // Put the draft back so nothing is silently lost.
      setInput(text);
      setPendingImage(image);
      Alert.alert(
        t('common.error') || 'Error',
        t('messages.sendFailed') || "That message couldn't be sent.",
      );
    } finally {
      setSending(false);
    }
  }, [conversationId, input, pendingImage, prependMessage, sending, t]);

  const handleAccept = useCallback(async () => {
    if (!conversationId || deciding) {
      return;
    }
    setDeciding(true);
    try {
      await acceptConversation(conversationId);
      setConversation(prev =>
        prev
          ? {
              ...prev,
              status: 'accepted',
              isIncomingRequest: false,
              isOutgoingRequest: false,
            }
          : prev,
      );
    } catch {
      Alert.alert(
        t('common.error') || 'Error',
        t('messages.requestFailed') || "That request couldn't be updated.",
      );
    } finally {
      setDeciding(false);
    }
  }, [conversationId, deciding, t]);

  const handleDecline = useCallback(() => {
    if (!conversationId || deciding) {
      return;
    }
    Alert.alert(
      t('messages.declineTitle') || 'Decline message request?',
      t('messages.declineMessage') ||
        "They won't be able to message you again, and they aren't told you declined.",
      [
        {text: t('common.cancel') || 'Cancel', style: 'cancel'},
        {
          text: t('messages.decline') || 'Decline',
          style: 'destructive',
          onPress: async () => {
            setDeciding(true);
            try {
              await declineConversation(conversationId);
              navigation.goBack();
            } catch {
              Alert.alert(
                t('common.error') || 'Error',
                t('messages.requestFailed') ||
                  "That request couldn't be updated.",
              );
            } finally {
              setDeciding(false);
            }
          },
        },
      ],
    );
  }, [conversationId, deciding, navigation, t]);

  // Optimistic toggle: flip the pill immediately, then reconcile with the
  // server's authoritative list (the socket echo also lands for the other
  // side). On failure we restore the previous list.
  const handleReact = useCallback(
    async (message: DirectMessage, emoji: string) => {
      if (!conversationId) {
        return;
      }
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
        const reactions = await reactToDirectMessage(
          conversationId,
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
    [conversationId, currentUserId],
  );

  // Long-pressing a pill answers "who reacted?" — the same affordance
  // group chat and the event cards use.
  const showReactedBy = useCallback(
    async (message: DirectMessage) => {
      if (!conversationId) {
        return;
      }
      setReactedBy([]);
      setLoadingReactedBy(true);
      try {
        setReactedBy(
          await fetchDmMessageReactions(conversationId, message._id),
        );
      } catch {
        setReactedBy([]);
      } finally {
        setLoadingReactedBy(false);
      }
    },
    [conversationId],
  );

  const openReactorProfile = useCallback(
    (reactor: MessageReactor) => {
      setReactedBy(null);
      // PublicProfile isn't registered in this stack, so hop to the
      // Profile tab's copy of it.
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

  const handleDeleteMessage = useCallback(
    (message: DirectMessage) => {
      if (!conversationId) {
        return;
      }
      Alert.alert(
        t('groupChat.deleteTitle') || 'Delete message?',
        t('messages.deleteMessageBody') || 'This removes it for both of you.',
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
                await deleteDirectMessage(conversationId, message._id);
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
    [conversationId, t],
  );

  // The composer is closed only for the person who was declined. The
  // thread stays readable so they can see what they sent — they just
  // can't add to it.
  const composerClosed = !!conversation?.isClosedToMe;

  // Actions offered on long-press, in menu order.
  const buildActions = useCallback(
    (message: DirectMessage): MessageAction[] => {
      const actions: MessageAction[] = [];
      // A thread that won't take messages won't take reactions either —
      // the server refuses them, so don't offer the option.
      if (!composerClosed) {
        actions.push({
          label: t('groupChat.react') || 'React',
          onPress: () => setReactionTarget(message),
        });
      }
      if (message.text) {
        actions.push({
          label: t('groupChat.copy') || 'Copy text',
          onPress: () => Clipboard.setString(message.text),
        });
      }
      if (message.senderId === currentUserId) {
        actions.push({
          label: t('common.delete') || 'Delete',
          destructive: true,
          onPress: () => handleDeleteMessage(message),
        });
      } else {
        // Reporting your own message would be meaningless, so this is
        // the one action that's offered only on the other side's.
        actions.push({
          label: t('moderation.report'),
          destructive: true,
          onPress: () => setReportTarget(message),
        });
      }
      return actions;
    },
    [composerClosed, currentUserId, handleDeleteMessage, t],
  );

  // iOS gets the native sheet. Android can't: its Alert is backed by
  // AlertDialog, which supports at most three buttons, and this menu can
  // reach four with the cancel row — so it gets a themed sheet instead.
  const openMessageActions = useCallback(
    (message: DirectMessage) => {
      if (message.deletedAt) {
        return;
      }
      const actions = buildActions(message);
      if (actions.length === 0) {
        return;
      }

      if (Platform.OS !== 'ios') {
        setActionTarget(message);
        return;
      }

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

  const openProfile = useCallback(() => {
    if (!otherUserId) {
      return;
    }
    // PublicProfile lives in the Events and Profile stacks, not this one.
    navigation.navigate('Profile', {
      screen: 'PublicProfile',
      params: {
        userId: otherUserId,
        username: conversation?.otherUser.username || route.params?.username,
        profilePicUrl: headerAvatar,
      },
    });
  }, [conversation, headerAvatar, navigation, otherUserId, route.params]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {flex: 1, backgroundColor: colors.background},
        flex: {flex: 1},
        loadingWrap: {flex: 1, alignItems: 'center', justifyContent: 'center'},
        // ── Header ──
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        backBtn: {
          width: 34,
          height: 34,
          alignItems: 'center',
          justifyContent: 'center',
        },
        headerUser: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        },
        headerAvatar: {
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: darkMode
            ? 'rgba(255,255,255,0.08)'
            : 'rgba(0,0,0,0.06)',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        headerAvatarImage: {width: 34, height: 34},
        headerInitials: {color: colors.text, fontWeight: '700', fontSize: 12},
        headerName: {fontSize: 16, fontWeight: '700', color: colors.text},
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
        // Sits behind the bubble and fades out, so a message arrived at
        // from a notification is obvious without shifting the layout.
        highlightOverlay: {
          position: 'absolute',
          top: -6,
          bottom: -6,
          left: -8,
          right: -8,
          borderRadius: 16,
          backgroundColor: colors.primary + '40',
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
          backgroundColor: darkMode
            ? 'rgba(255,255,255,0.08)'
            : 'rgba(0,0,0,0.06)',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'transparent',
        },
        reactionPillMine: {
          borderColor: colors.primary,
          backgroundColor: darkMode
            ? 'rgba(255,255,255,0.12)'
            : 'rgba(0,0,0,0.04)',
        },
        reactionEmoji: {fontSize: 12},
        reactionCount: {
          fontSize: 11,
          fontWeight: '700',
          color: colors.secondaryText,
        },
        reactionCountMine: {color: colors.primary},
        // ── Bottom sheets (Android action menu, reactors list) ──
        sheetBackdrop: {
          flex: 1,
          backgroundColor: '#00000088',
          justifyContent: 'flex-end',
        },
        sheet: {
          backgroundColor: colors.card,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          paddingTop: 8,
          paddingBottom: 28,
          paddingHorizontal: 8,
        },
        sheetHandle: {
          alignSelf: 'center',
          width: 38,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
          marginBottom: 8,
        },
        sheetRow: {paddingVertical: 14, paddingHorizontal: 16},
        sheetLabel: {fontSize: 16, color: colors.text},
        sheetLabelDestructive: {color: colors.error},
        sheetTitle: {
          fontSize: 15,
          fontWeight: '700',
          color: colors.text,
          paddingHorizontal: 16,
          paddingBottom: 8,
        },
        sheetLoading: {marginVertical: 20},
        sheetEmpty: {
          fontSize: 13,
          color: colors.secondaryText,
          paddingHorizontal: 16,
          paddingVertical: 18,
          textAlign: 'center',
        },
        reactorRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 9,
          paddingHorizontal: 16,
        },
        reactorName: {flex: 1, fontSize: 15, color: colors.text},
        reactorEmoji: {fontSize: 18},
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
        captionBubble: {alignSelf: 'stretch'},
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
        // ── Request bar ──
        requestBar: {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          backgroundColor: colors.card,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 10,
        },
        requestText: {
          fontSize: 13,
          color: colors.secondaryText,
          lineHeight: 19,
          marginBottom: 10,
          textAlign: 'center',
        },
        requestActions: {flexDirection: 'row', gap: 10},
        requestBtn: {
          flex: 1,
          borderRadius: 20,
          paddingVertical: 10,
          alignItems: 'center',
        },
        requestAccept: {backgroundColor: colors.primary},
        requestAcceptText: {
          color: '#FFFFFF',
          fontSize: 14,
          fontWeight: '700',
        },
        requestDecline: {
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        requestDeclineText: {
          color: colors.secondaryText,
          fontSize: 14,
          fontWeight: '700',
        },
        closedNotice: {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          backgroundColor: colors.card,
          paddingHorizontal: 24,
          paddingVertical: 16,
        },
        closedText: {
          fontSize: 13,
          color: colors.secondaryText,
          textAlign: 'center',
          lineHeight: 19,
        },
        // ── Composer ──
        composerWrap: {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          backgroundColor: colors.card,
        },
        composer: {
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 8,
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
        attachBtn: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: darkMode
            ? 'rgba(255,255,255,0.07)'
            : 'rgba(0,0,0,0.05)',
        },
      }),
    [colors, darkMode],
  );

  const renderItem = ({item}: {item: DirectMessage}) => {
    const isMine = item.senderId === currentUserId;
    const isDeleted = !!item.deletedAt;
    const pills = summarizeReactions(item.reactions, currentUserId);

    const body = isDeleted ? (
      <View style={styles.bubbleDeleted}>
        <Text style={styles.bubbleTextDeleted}>
          {t('groupChat.messageDeleted') || 'This message was deleted'}
        </Text>
      </View>
    ) : item.imageUrl ? (
      <View style={styles.imageStack}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setViewerImage(item.imageUrl as string)}
          onLongPress={() => openMessageActions(item)}
          delayLongPress={300}>
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
            <Text
              style={isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>
              {item.text}
            </Text>
          </View>
        ) : null}
      </View>
    ) : (
      <View style={isMine ? styles.bubbleMine : styles.bubbleTheirs}>
        <Text style={isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>
          {item.text}
        </Text>
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
              {(item.username || headerName || '?').slice(0, 2).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={styles.bubbleWrap}>
          {highlight}
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

  const header = (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
        accessibilityLabel={t('common.back') || 'Back'}>
        <FontAwesomeIcon icon={faChevronLeft} size={18} color={colors.text} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.headerUser}
        activeOpacity={0.7}
        onPress={openProfile}>
        <View style={styles.headerAvatar}>
          {headerAvatar ? (
            <Image
              source={{uri: headerAvatar}}
              style={styles.headerAvatarImage}
            />
          ) : (
            <Text style={styles.headerInitials}>
              {(headerName || '?').slice(0, 2).toUpperCase()}
            </Text>
          )}
        </View>
        <Text style={styles.headerName} numberOfLines={1}>
          {headerName}
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {header}
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.flex, {paddingBottom: bottomInset}]}>
        {header}
        <FlatList
          ref={listRef}
          style={styles.flex}
          data={messages}
          inverted={messages.length > 0}
          keyExtractor={m => m._id}
          renderItem={renderItem}
          // Rows are variable height, so a far-off index may not be
          // measured yet. Nudge the list toward it and retry once it has.
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
              <Text style={styles.emptyTitle}>
                {t('messages.threadEmptyTitle') || 'No messages yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {t('messages.threadEmptySubtitle') ||
                  'Say hi and get something on the calendar.'}
              </Text>
            </View>
          }
        />

        {conversation?.isIncomingRequest ? (
          <View style={styles.requestBar}>
            <Text style={styles.requestText}>
              {t('messages.requestPrompt') ||
                "You aren't connected yet. Accept to let them message you."}
            </Text>
            <View style={styles.requestActions}>
              <TouchableOpacity
                style={[styles.requestBtn, styles.requestDecline]}
                activeOpacity={0.8}
                disabled={deciding}
                onPress={handleDecline}>
                <Text style={styles.requestDeclineText}>
                  {t('messages.decline') || 'Decline'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.requestBtn, styles.requestAccept]}
                activeOpacity={0.85}
                disabled={deciding}
                onPress={handleAccept}>
                <Text style={styles.requestAcceptText}>
                  {t('messages.accept') || 'Accept'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {composerClosed || loadFailed ? (
          <View style={styles.closedNotice}>
            <Text style={styles.closedText}>
              {composerClosed
                ? t('messages.closedNotice') ||
                  'This person is no longer accepting messages.'
                : t('messages.threadUnavailable') ||
                  "This conversation couldn't be loaded."}
            </Text>
          </View>
        ) : (
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
            <View style={styles.composer}>
              <TouchableOpacity
                style={[styles.attachBtn, sending && styles.sendBtnDisabled]}
                onPress={handlePickImage}
                disabled={sending}
                accessibilityLabel={
                  t('groupChat.attachPhoto') || 'Attach photo'
                }>
                <FontAwesomeIcon
                  icon={faImage}
                  size={17}
                  color={colors.secondaryText}
                />
              </TouchableOpacity>
              <TextInput
                style={styles.textInput}
                value={input}
                onChangeText={setInput}
                placeholder={
                  pendingImage
                    ? t('groupChat.caption') || 'Add a caption'
                    : t('messages.placeholder') || 'Message'
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
                  <FontAwesomeIcon
                    icon={faPaperPlane}
                    size={16}
                    color="#FFFFFF"
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
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
                    {reactor.name || reactor.username || 'Someone'}
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
        <View style={styles.viewerBackdrop}>
          {viewerImage ? (
            <Image
              source={{uri: viewerImage}}
              style={styles.viewerImage}
              resizeMode="contain"
            />
          ) : null}
          <TouchableOpacity
            style={styles.viewerClose}
            onPress={() => setViewerImage(null)}
            accessibilityLabel={t('common.close') || 'Close'}>
            <FontAwesomeIcon icon={faXmark} size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </Modal>

      <ReportSheet
        visible={reportTarget !== null}
        onClose={() => setReportTarget(null)}
        reportedUserId={reportTarget?.senderId || ''}
        username={conversation?.otherUser.username}
        target="direct_message"
        contentId={reportTarget?._id}
      />
    </SafeAreaView>
  );
};

export default DmThread;
