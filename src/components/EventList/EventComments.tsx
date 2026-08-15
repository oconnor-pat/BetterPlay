import React, {
  useState,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faTrash,
  faReply,
  faEdit,
  faCheck,
  faTimes,
  faHeart,
  faPaperPlane,
  faChevronUp,
  faChevronRight,
  faPlus,
} from '@fortawesome/free-solid-svg-icons';
import EmojiPicker, {type EmojiType} from 'rn-emoji-keyboard';
import UserContext, {UserContextType} from '../UserContext';
import axios from 'axios';
import {useTheme} from '../ThemeContext/ThemeContext';
import {API_BASE_URL} from '../../config/api';
import {useTranslation} from 'react-i18next';
import {useNavigation, CommonActions} from '@react-navigation/native';
import {useSocket} from '../../Context/SocketContext';

interface CommentReaction {
  userId: string;
  emoji: string;
}

interface Reply {
  _id?: string;
  text: string;
  username: string;
  userId: string;
  profilePicUrl?: string;
  createdAt?: string;
  likes?: string[];
  reactions?: CommentReaction[];
  replyToUsername?: string | null;
  replyToReplyId?: string | null;
}

interface LikedByUser {
  _id: string;
  username: string;
  profilePicUrl?: string;
}

interface Comment {
  _id?: string;
  text: string;
  username: string;
  userId: string;
  profilePicUrl?: string;
  replies?: Reply[];
  likes?: string[];
  likedByUsernames?: string[];
  likedByUsers?: LikedByUser[];
  reactions?: CommentReaction[];
  createdAt?: string;
  // true = nests under the discussion opener; false/absent = own top-level thread
  replyToPost?: boolean;
}

interface Post {
  _id: string;
  text: string;
  userId: string;
  username: string;
  profilePicUrl?: string;
  comments: Comment[];
  likes?: string[];
  likedByUsernames?: string[];
  likedByUsers?: LikedByUser[];
  reactions?: CommentReaction[];
  createdAt?: string;
  eventId?: string;
  eventName?: string;
  eventType?: string;
}

interface EventCommentsProps {
  eventId: string;
  eventName: string;
  eventType: string;
  onClose: () => void;
  onCommentCountChange?: (eventId: string, count: number) => void;
}

const LIKE_EMOJI = '❤️';

const summarizeReactions = (
  reactions: CommentReaction[] | undefined,
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

const normalizeReply = (reply: Reply): Reply => ({
  ...reply,
  reactions:
    reply.reactions && reply.reactions.length > 0
      ? reply.reactions
      : (reply.likes || []).map(userId => ({userId, emoji: LIKE_EMOJI})),
});

const normalizeComment = (comment: Comment): Comment => ({
  ...comment,
  replyToPost: !!comment.replyToPost,
  reactions:
    comment.reactions && comment.reactions.length > 0
      ? comment.reactions
      : (comment.likes || []).map(userId => ({userId, emoji: LIKE_EMOJI})),
  replies: (comment.replies || []).map(normalizeReply),
});

const normalizePost = (post: Post): Post => ({
  ...post,
  reactions:
    post.reactions && post.reactions.length > 0
      ? post.reactions
      : (post.likes || []).map(userId => ({userId, emoji: LIKE_EMOJI})),
  comments: (post.comments || []).map(normalizeComment),
});

// Badge count: opener + independent top-level comments. Nested replies
// (and replies-to-the-opener) are not included.
const countTopLevelComments = (post: Post | null): number => {
  if (!post) {
    return 0;
  }
  const opener = post.text?.trim() ? 1 : 0;
  const roots = (post.comments || []).filter(c => !c.replyToPost).length;
  return opener + roots;
};

// Helper to get user initials for avatar
const getInitials = (name: string): string => {
  if (!name) {
    return '?';
  }
  const parts = name.trim().split(' ');
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

// Helper to format relative timestamp
const formatRelativeTime = (dateString?: string): string => {
  if (!dateString) {
    return '';
  }

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSeconds < 60) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else if (diffWeeks < 4) {
    return `${diffWeeks}w ago`;
  } else if (diffMonths < 12) {
    return `${diffMonths}mo ago`;
  } else {
    return `${diffYears}y ago`;
  }
};

const EventComments: React.FC<EventCommentsProps> = ({
  eventId,
  eventName,
  eventType,
  onClose,
  onCommentCountChange,
}) => {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [newPostText, setNewPostText] = useState('');
  const [commentText, setCommentText] = useState<{[postId: string]: string}>(
    {},
  );
  const [replyText, setReplyText] = useState<{[commentId: string]: string}>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  // When replying to a nested reply, keep who we're continuing so the
  // new reply can show "Replying to X" context on the server/FE.
  const [replyingToReply, setReplyingToReply] = useState<{
    replyId: string;
    username: string;
  } | null>(null);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [likesModalVisible, setLikesModalVisible] = useState(false);
  const [likesModalData, setLikesModalData] = useState<{
    title: string;
    users: LikedByUser[];
    anonymousCount: number;
  }>({title: '', users: [], anonymousCount: 0});
  const [reactionTarget, setReactionTarget] = useState<
    | {kind: 'post'}
    | {kind: 'comment'; commentId: string}
    | {kind: 'reply'; commentId: string; replyId: string}
    | null
  >(null);

  // Edit state
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostText, setEditingPostText] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editingReplyText, setEditingReplyText] = useState('');
  const [editingReplyParent, setEditingReplyParent] = useState<{
    postId: string;
    commentId: string;
  } | null>(null);
  const [postingContent, setPostingContent] = useState(false);

  const {userData} = useContext(UserContext) as UserContextType;
  const {colors, darkMode} = useTheme();
  const {t} = useTranslation();
  const navigation = useNavigation();
  const {subscribe: socketSubscribe, joinEvent, leaveEvent} = useSocket();

  const replyInputRefs = useRef<{[key: string]: TextInput | null}>({});
  const composerInputRef = useRef<TextInput | null>(null);

  // Autofocus reply input
  useEffect(() => {
    if (!replyingTo) {
      return;
    }
    const key = replyingTo === 'post' ? 'post' : replyingTo;
    replyInputRefs.current[key]?.focus();
  }, [replyingTo]);

  // Fetch or create post for this event
  const fetchOrCreatePost = useCallback(async () => {
    setLoading(true);
    try {
      // First try to get existing post for this event
      const response = await axios.get(
        `${API_BASE_URL}/community-notes/event/${eventId}`,
      );

      if (response.data && response.data._id) {
        setPost(normalizePost(response.data));
        // Initialize liked states
        if (userData) {
          if (response.data.likes?.includes(userData._id)) {
            setLikedPosts(new Set([response.data._id]));
          }
        }
      } else {
        setPost(null);
      }
    } catch {
      // No post exists for this event yet
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [eventId, userData]);

  useEffect(() => {
    fetchOrCreatePost();
  }, [fetchOrCreatePost]);

  // Join event room and listen for real-time comment updates
  useEffect(() => {
    joinEvent(eventId);

    const unsub = socketSubscribe(
      'comments:updated',
      (data: {
        eventId: string;
        comments: Comment[];
        likes?: string[];
        likedByUsernames?: string[];
      }) => {
        if (data.eventId === eventId) {
          setPost(prev => {
            if (!prev) return prev;
            const updates: Partial<Post> = {
              comments: (data.comments || []).map(normalizeComment),
            };
            if (data.likes) updates.likes = data.likes;
            if (data.likedByUsernames)
              updates.likedByUsernames = data.likedByUsernames;
            if ((data as any).reactions) {
              updates.reactions = (data as any).reactions;
            }
            return normalizePost({...prev, ...updates});
          });
        }
      },
    );

    return () => {
      leaveEvent(eventId);
      unsub();
    };
  }, [eventId, joinEvent, leaveEvent, socketSubscribe]);

  const onCommentCountChangeRef = useRef(onCommentCountChange);
  onCommentCountChangeRef.current = onCommentCountChange;

  useEffect(() => {
    if (onCommentCountChangeRef.current) {
      onCommentCountChangeRef.current(eventId, countTopLevelComments(post));
    }
  }, [post, eventId]);

  // Navigate to user's public profile
  const navigateToProfile = useCallback(
    (userId: string, username: string, profilePicUrl?: string) => {
      if (userData && userId === userData._id) {
        return;
      }
      navigation.dispatch(
        CommonActions.navigate({
          name: 'PublicProfile',
          params: {userId, username, profilePicUrl},
        }),
      );
    },
    [navigation, userData],
  );

  // Fetch user details by usernames
  const fetchUsersByUsernames = async (
    usernames: string[],
  ): Promise<LikedByUser[]> => {
    if (usernames.length === 0) {
      return [];
    }
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await axios.get(`${API_BASE_URL}/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const allUsers = response.data?.users || response.data || [];
      // Filter to only users whose username is in our list
      const matchedUsers = allUsers.filter((user: LikedByUser) =>
        usernames.includes(user.username),
      );
      return matchedUsers.map((user: LikedByUser) => ({
        _id: user._id,
        username: user.username,
        profilePicUrl: user.profilePicUrl,
      }));
    } catch {
      // Return empty on error - will fall back to usernames only
      return [];
    }
  };

  // Show who liked
  const showLikedBy = async (
    title: string,
    users: LikedByUser[],
    usernames: string[],
    totalLikes: number,
  ) => {
    if (totalLikes === 0) {
      return;
    }
    // Use likedByUsers if available
    let likeUsers: LikedByUser[] = users || [];

    // If no user objects, try to fetch user details by usernames
    if (likeUsers.length === 0 && usernames.length > 0) {
      likeUsers = await fetchUsersByUsernames(usernames);
      // If fetch failed, fall back to usernames without IDs
      if (likeUsers.length === 0) {
        likeUsers = usernames.map(username => ({
          _id: '',
          username,
          profilePicUrl: undefined,
        }));
      }
    }
    // Calculate how many likes don't have user info attached
    const anonymousCount = Math.max(0, totalLikes - likeUsers.length);
    setLikesModalData({title, users: likeUsers, anonymousCount});
    setLikesModalVisible(true);
  };

  // Toggle Discord-style reaction on the discussion post
  const togglePostReaction = async (postId: string, emoji: string) => {
    if (!userData || !post) {
      return;
    }

    const myUid = userData._id;
    const hadIt = (post.reactions || []).some(
      r => r.userId === myUid && r.emoji === emoji,
    );

    const withPair = (target: Post, shouldHave: boolean): Post => {
      const others = (target.reactions || []).filter(
        r => !(r.userId === myUid && r.emoji === emoji),
      );
      const reactions = shouldHave
        ? [...others, {userId: myUid, emoji}]
        : others;
      return {
        ...target,
        reactions,
        likes: reactions
          .filter(r => r.emoji === LIKE_EMOJI)
          .map(r => r.userId),
      };
    };

    setPost(prev => (prev ? withPair(prev, !hadIt) : prev));

    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await axios.post(
        `${API_BASE_URL}/community-notes/${postId}/react`,
        {emoji, userId: myUid},
        {headers: token ? {Authorization: `Bearer ${token}`} : undefined},
      );
      setPost(prev =>
        prev
          ? {
              ...prev,
              reactions: response.data.reactions || prev.reactions,
              likes: response.data.likes || prev.likes,
            }
          : prev,
      );
    } catch {
      setPost(prev => (prev ? withPair(prev, hadIt) : prev));
    }
  };

  // Toggle Discord-style reaction on a comment
  const toggleCommentReaction = async (
    postId: string,
    commentId: string,
    emoji: string,
  ) => {
    if (!userData || !post) {
      return;
    }

    const myUid = userData._id;
    const comment = post.comments.find(c => c._id === commentId);
    const hadIt = (comment?.reactions || []).some(
      r => r.userId === myUid && r.emoji === emoji,
    );

    const withPair = (target: Comment, shouldHave: boolean): Comment => {
      const others = (target.reactions || []).filter(
        r => !(r.userId === myUid && r.emoji === emoji),
      );
      const reactions = shouldHave
        ? [...others, {userId: myUid, emoji}]
        : others;
      return {
        ...target,
        reactions,
        likes: reactions
          .filter(r => r.emoji === LIKE_EMOJI)
          .map(r => r.userId),
      };
    };

    setPost(prev =>
      prev
        ? {
            ...prev,
            comments: prev.comments.map(c =>
              c._id === commentId ? withPair(c, !hadIt) : c,
            ),
          }
        : prev,
    );

    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await axios.post(
        `${API_BASE_URL}/community-notes/${postId}/comments/${commentId}/react`,
        {emoji, userId: myUid},
        {headers: token ? {Authorization: `Bearer ${token}`} : undefined},
      );
      setPost(prev =>
        prev
          ? {
              ...prev,
              comments: prev.comments.map(c =>
                c._id === commentId
                  ? {
                      ...c,
                      reactions: response.data.reactions || c.reactions,
                      likes: response.data.likes || c.likes,
                    }
                  : c,
              ),
            }
          : prev,
      );
    } catch {
      setPost(prev =>
        prev
          ? {
              ...prev,
              comments: prev.comments.map(c =>
                c._id === commentId ? withPair(c, hadIt) : c,
              ),
            }
          : prev,
      );
    }
  };

  const toggleReplyReaction = async (
    postId: string,
    commentId: string,
    replyId: string,
    emoji: string,
  ) => {
    if (!userData || !post) {
      return;
    }

    const myUid = userData._id;
    const reply = post.comments
      .find(c => c._id === commentId)
      ?.replies?.find(r => r._id === replyId);
    const hadIt = (reply?.reactions || []).some(
      r => r.userId === myUid && r.emoji === emoji,
    );

    const withPair = (target: Reply, shouldHave: boolean): Reply => {
      const others = (target.reactions || []).filter(
        r => !(r.userId === myUid && r.emoji === emoji),
      );
      const reactions = shouldHave
        ? [...others, {userId: myUid, emoji}]
        : others;
      return {
        ...target,
        reactions,
        likes: reactions
          .filter(r => r.emoji === LIKE_EMOJI)
          .map(r => r.userId),
      };
    };

    setPost(prev =>
      prev
        ? {
            ...prev,
            comments: prev.comments.map(c =>
              c._id === commentId
                ? {
                    ...c,
                    replies: (c.replies || []).map(r =>
                      r._id === replyId ? withPair(r, !hadIt) : r,
                    ),
                  }
                : c,
            ),
          }
        : prev,
    );

    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await axios.post(
        `${API_BASE_URL}/community-notes/${postId}/comments/${commentId}/replies/${replyId}/react`,
        {emoji, userId: myUid},
        {headers: token ? {Authorization: `Bearer ${token}`} : undefined},
      );
      setPost(prev =>
        prev
          ? {
              ...prev,
              comments: prev.comments.map(c =>
                c._id === commentId
                  ? {
                      ...c,
                      replies: (c.replies || []).map(r =>
                        r._id === replyId
                          ? {
                              ...r,
                              reactions: response.data.reactions || r.reactions,
                              likes: response.data.likes || r.likes,
                            }
                          : r,
                      ),
                    }
                  : c,
              ),
            }
          : prev,
      );
    } catch {
      setPost(prev =>
        prev
          ? {
              ...prev,
              comments: prev.comments.map(c =>
                c._id === commentId
                  ? {
                      ...c,
                      replies: (c.replies || []).map(r =>
                        r._id === replyId ? withPair(r, hadIt) : r,
                      ),
                    }
                  : c,
              ),
            }
          : prev,
      );
    }
  };

  // Create a new post for this event
  const createPost = async () => {
    if (newPostText.trim() === '' || !userData) {
      return;
    }

    setPostingContent(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/community-notes`, {
        text: newPostText,
        userId: userData._id,
        username: userData.username,
        profilePicUrl: userData.profilePicUrl || '',
        eventId,
        eventName,
        eventType,
      });
      setPost(response.data);
      setNewPostText('');
    } catch {
      Alert.alert(t('common.error'), t('communityNotes.postError'));
    } finally {
      setPostingContent(false);
    }
  };

  // Edit post
  const startEditPost = (p: Post) => {
    setEditingPostId(p._id);
    setEditingPostText(p.text);
  };

  const cancelEditPost = () => {
    setEditingPostId(null);
    setEditingPostText('');
  };

  const saveEditPost = async (postId: string) => {
    if (editingPostText.trim() === '') {
      return;
    }
    try {
      const response = await axios.put(
        `${API_BASE_URL}/community-notes/${postId}`,
        {text: editingPostText},
      );
      setPost(prev => (prev ? {...prev, text: response.data.text} : prev));
      setEditingPostId(null);
      setEditingPostText('');
    } catch {
      Alert.alert(t('common.error'), t('communityNotes.editPostError'));
    }
  };

  // Add a top-level comment thread, or a nested reply to the opener
  const addComment = async (postId: string, replyToPost: boolean = false) => {
    const text = commentText[postId]?.trim();
    if (!text || !userData) {
      return;
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}/community-notes/${postId}/comments`,
        {
          text,
          username: userData.username,
          userId: userData._id,
          profilePicUrl: userData.profilePicUrl || '',
          replyToPost,
        },
      );
      setPost(prev =>
        prev
          ? normalizePost({...prev, comments: response.data.comments})
          : prev,
      );
      setCommentText(prev => ({...prev, [postId]: ''}));
      setReplyingTo(null);
      setReplyingToReply(null);
    } catch {
      Alert.alert(t('common.error'), t('communityNotes.commentError'));
    }
  };

  // Edit comment
  const startEditComment = (comment: Comment) => {
    setEditingCommentId(comment._id!);
    setEditingCommentText(comment.text);
  };

  const cancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const saveEditComment = async (postId: string, commentId: string) => {
    if (editingCommentText.trim() === '') {
      return;
    }
    try {
      const response = await axios.put(
        `${API_BASE_URL}/community-notes/${postId}/comments/${commentId}`,
        {text: editingCommentText},
      );
      setPost(prev =>
        prev
          ? {
              ...prev,
              comments: prev.comments.map(comment =>
                comment._id === commentId
                  ? {...comment, text: response.data.text}
                  : comment,
              ),
            }
          : prev,
      );
      setEditingCommentId(null);
      setEditingCommentText('');
    } catch {
      Alert.alert(t('common.error'), t('communityNotes.editCommentError'));
    }
  };

  // Delete comment
  const deleteComment = async (postId: string, commentId: string) => {
    try {
      const response = await axios.delete(
        `${API_BASE_URL}/community-notes/${postId}/comments/${commentId}`,
      );
      setPost(prev =>
        prev ? {...prev, comments: response.data.comments} : prev,
      );
    } catch {
      Alert.alert(t('common.error'), t('communityNotes.deleteCommentError'));
    }
  };

  // Add reply
  const addReply = async (postId: string, commentId: string) => {
    const text = replyText[commentId]?.trim();
    if (!text || !userData) {
      return;
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}/community-notes/${postId}/comments/${commentId}/replies`,
        {
          text,
          username: userData.username,
          userId: userData._id,
          profilePicUrl: userData.profilePicUrl || '',
          replyToUsername: replyingToReply?.username || null,
          replyToReplyId: replyingToReply?.replyId || null,
        },
      );
      setPost(prev =>
        prev
          ? {
              ...prev,
              comments: prev.comments.map(comment =>
                comment._id === commentId
                  ? {
                      ...comment,
                      replies: (response.data.replies || []).map(
                        normalizeReply,
                      ),
                    }
                  : comment,
              ),
            }
          : prev,
      );
      setReplyText(prev => ({...prev, [commentId]: ''}));
      setReplyingTo(null);
      setReplyingToReply(null);
    } catch {
      Alert.alert(t('common.error'), t('communityNotes.replyError'));
    }
  };

  const startReplyToComment = (commentId: string) => {
    setReplyingTo(commentId);
    setReplyingToReply(null);
  };

  const startReplyToReply = (
    commentId: string,
    reply: { _id?: string; username: string },
  ) => {
    setReplyingTo(commentId);
    setReplyingToReply(
      reply._id
        ? {replyId: reply._id, username: reply.username}
        : {replyId: '', username: reply.username},
    );
  };

  // Edit reply
  const startEditReply = (postId: string, commentId: string, reply: Reply) => {
    setEditingReplyId(reply._id!);
    setEditingReplyText(reply.text);
    setEditingReplyParent({postId, commentId});
  };

  const cancelEditReply = () => {
    setEditingReplyId(null);
    setEditingReplyText('');
    setEditingReplyParent(null);
  };

  const saveEditReply = async () => {
    if (!editingReplyId || !editingReplyParent) {
      return;
    }
    if (editingReplyText.trim() === '') {
      return;
    }

    const {postId, commentId} = editingReplyParent;
    try {
      const response = await axios.put(
        `${API_BASE_URL}/community-notes/${postId}/comments/${commentId}/replies/${editingReplyId}`,
        {text: editingReplyText},
      );
      setPost(prev =>
        prev
          ? {
              ...prev,
              comments: prev.comments.map(comment =>
                comment._id === commentId
                  ? {
                      ...comment,
                      replies: comment.replies?.map(reply =>
                        reply._id === editingReplyId
                          ? {...reply, text: response.data.text}
                          : reply,
                      ),
                    }
                  : comment,
              ),
            }
          : prev,
      );
      cancelEditReply();
    } catch {
      Alert.alert(t('common.error'), t('communityNotes.editReplyError'));
    }
  };

  // Delete reply
  const deleteReply = async (
    postId: string,
    commentId: string,
    replyId: string,
  ) => {
    try {
      const response = await axios.delete(
        `${API_BASE_URL}/community-notes/${postId}/comments/${commentId}/replies/${replyId}`,
      );
      setPost(prev =>
        prev
          ? {
              ...prev,
              comments: prev.comments.map(comment =>
                comment._id === commentId
                  ? {...comment, replies: response.data.replies}
                  : comment,
              ),
            }
          : prev,
      );
    } catch {
      Alert.alert(t('common.error'), t('communityNotes.deleteReplyError'));
    }
  };

  // Delete the entire post
  const deletePost = async (postId: string) => {
    try {
      await axios.delete(`${API_BASE_URL}/community-notes/${postId}`);
      setPost(null);
    } catch {
      Alert.alert(t('common.error'), t('communityNotes.deletePostError'));
    }
  };

  // Memoized styles
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          marginTop: 12,
          marginHorizontal: -16,
          paddingTop: 12,
          paddingHorizontal: 16,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        },
        headerTitle: {
          fontSize: 12,
          fontWeight: '700',
          color: colors.secondaryText,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        },
        closeButton: {
          padding: 4,
        },
        loadingContainer: {
          paddingVertical: 24,
          alignItems: 'center',
        },
        // Composer (when no post yet) — flat row, no card wrapper
        composerCard: {
          paddingVertical: 4,
        },
        composerRow: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        composerAvatar: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: colors.primary + '14',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 10,
        },
        composerAvatarImage: {
          width: 36,
          height: 36,
          borderRadius: 18,
          marginRight: 10,
        },
        composerAvatarText: {
          fontSize: 14,
          fontWeight: '700',
          color: colors.primary,
        },
        composerInput: {
          flex: 1,
          height: 40,
          borderColor: colors.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: 20,
          paddingHorizontal: 14,
          color: colors.text,
          backgroundColor: colors.inputBackground || colors.background,
          fontSize: 14,
          marginRight: 10,
        },
        sendButton: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        },
        sendButtonText: {
          color: '#fff',
          fontWeight: '600',
          fontSize: 14,
        },
        disabledButton: {
          opacity: 0.5,
        },
        // Post / thread list
        postContainer: {
          paddingTop: 4,
          paddingBottom: 4,
          gap: 10,
        },
        postHeaderRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          marginBottom: 2,
        },
        postAvatar: {
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: colors.primary + '14',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 10,
        },
        postAvatarImage: {
          width: 32,
          height: 32,
          borderRadius: 16,
          marginRight: 10,
        },
        postAvatarText: {
          fontSize: 11,
          fontWeight: '700',
          color: colors.primary,
        },
        postHeaderContent: {
          flex: 1,
        },
        postUsernameRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        postUsername: {
          color: colors.text,
          fontSize: 14,
          fontWeight: '700',
        },
        timestamp: {
          color: colors.secondaryText,
          fontSize: 12,
          fontWeight: '400',
          marginLeft: 6,
        },
        timestampSmall: {
          color: colors.secondaryText,
          fontSize: 11,
          fontWeight: '400',
          marginLeft: 6,
        },
        timestampTiny: {
          color: colors.secondaryText,
          fontSize: 10,
          fontWeight: '400',
          marginLeft: 5,
        },
        usernameWithTimestamp: {
          flexDirection: 'row',
          alignItems: 'center',
          flex: 1,
        },
        postActionsRow: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        postEditIcon: {
          marginLeft: 8,
          padding: 4,
        },
        postTrashIcon: {
          marginLeft: 4,
          padding: 4,
        },
        postText: {
          fontSize: 14,
          color: colors.text,
          lineHeight: 19,
          marginTop: 2,
          marginBottom: 0,
          marginLeft: 0,
        },
        // Reaction row under a thread root
        socialActionsRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 6,
          paddingTop: 6,
          paddingBottom: 2,
          marginLeft: 0,
        },
        // Comment composer — under the thread list
        commentInputRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 4,
          paddingTop: 12,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        commentInputAvatar: {
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: colors.primary + '14',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 10,
        },
        commentInputAvatarImage: {
          width: 30,
          height: 30,
          borderRadius: 15,
          marginRight: 10,
        },
        commentInputAvatarText: {
          fontSize: 11,
          fontWeight: '700',
          color: colors.primary,
        },
        commentInput: {
          flex: 1,
          height: 38,
          borderColor: colors.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: 19,
          paddingHorizontal: 14,
          color: colors.text,
          backgroundColor: colors.inputBackground || colors.background,
          marginRight: 10,
          fontSize: 13,
        },
        commentSendButton: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        },
        // One card per top-level thread (opener is the root; replies nest inside)
        commentThread: {
          borderRadius: 12,
          backgroundColor: colors.secondaryText + '0C',
          borderLeftWidth: 3,
          borderLeftColor: colors.primary + '66',
          paddingVertical: 10,
          paddingHorizontal: 10,
        },
        commentContainer: {
          paddingVertical: 0,
          borderBottomWidth: 0,
        },
        // Direct replies to a thread root
        threadChildren: {
          marginTop: 10,
          marginLeft: 6,
          paddingLeft: 12,
          borderLeftWidth: 2,
          borderLeftColor: colors.primary + '40',
          gap: 8,
        },
        threadChildCard: {
          backgroundColor: colors.background,
          borderRadius: 10,
          paddingVertical: 8,
          paddingHorizontal: 10,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        commentRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
        },
        commentLeftCol: {
          width: 32,
          alignItems: 'center',
          marginRight: 10,
        },
        threadSpine: {
          width: 2,
          backgroundColor: colors.border,
          flex: 1,
          marginTop: 4,
          minHeight: 8,
          borderRadius: 1,
        },
        commentHeaderRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
        },
        commentAvatar: {
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: colors.primary + '14',
          alignItems: 'center',
          justifyContent: 'center',
        },
        commentAvatarImage: {
          width: 32,
          height: 32,
          borderRadius: 16,
        },
        commentAvatarText: {
          fontSize: 11,
          fontWeight: '700',
          color: colors.primary,
        },
        commentContent: {
          flex: 1,
        },
        commentUsername: {
          color: colors.text,
          fontSize: 14,
          fontWeight: '700',
        },
        commentActionsRow: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        commentText: {
          color: colors.text,
          fontSize: 14,
          marginTop: 2,
          lineHeight: 19,
        },
        replyButton: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 2,
          paddingHorizontal: 0,
          marginRight: 6,
          gap: 4,
        },
        replyButtonText: {
          color: colors.primary,
          fontSize: 12,
          fontWeight: '600',
        },
        commentReactionRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 6,
          marginTop: 6,
        },
        commentReactionPill: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 8,
          height: 24,
          borderRadius: 12,
          backgroundColor: colors.secondaryText + '14',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'transparent',
        },
        commentReactionPillMine: {
          backgroundColor: colors.primary + '1F',
          borderColor: colors.primary,
        },
        commentReactionPillEmoji: {
          fontSize: 12,
        },
        commentReactionPillCount: {
          fontSize: 11,
          fontWeight: '600',
          color: colors.secondaryText,
        },
        commentReactionPillCountMine: {
          color: colors.primary,
        },
        commentReactionAddButton: {
          width: 26,
          height: 24,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.secondaryText + '14',
        },
        // Reply input — sits inside comment content column, indented to align with reply avatars
        replyInputRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 10,
          paddingTop: 2,
        },
        replyInput: {
          flex: 1,
          height: 34,
          borderColor: colors.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: 17,
          paddingHorizontal: 12,
          color: colors.text,
          backgroundColor: colors.inputBackground || colors.background,
          marginRight: 8,
          fontSize: 13,
        },
        replySendButton: {
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        },
        // Deeper replies under a comment within a thread
        repliesContainer: {
          marginTop: 10,
          marginLeft: 4,
          paddingLeft: 10,
          borderLeftWidth: 2,
          borderLeftColor: colors.primary + '33',
          gap: 6,
        },
        replyContainer: {
          paddingTop: 0,
          paddingBottom: 0,
        },
        replyBubble: {
          backgroundColor: colors.secondaryText + '0A',
          borderRadius: 10,
          paddingVertical: 8,
          paddingHorizontal: 10,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        replyRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
        },
        replyLeftCol: {
          width: 24,
          alignItems: 'center',
          marginRight: 8,
        },
        replyThreadSpineTop: {
          width: 0,
          height: 0,
        },
        replyThreadSpineBottom: {
          width: 0,
          height: 0,
        },
        replyHeaderRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
        },
        replyAvatar: {
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: colors.primary + '14',
          alignItems: 'center',
          justifyContent: 'center',
        },
        replyAvatarImage: {
          width: 24,
          height: 24,
          borderRadius: 12,
        },
        replyAvatarText: {
          fontSize: 9,
          fontWeight: '700',
          color: colors.primary,
        },
        replyContent: {
          flex: 1,
        },
        replyUsername: {
          color: colors.text,
          fontSize: 13,
          fontWeight: '700',
        },
        replyActionsRow: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        replyText: {
          color: colors.text,
          fontSize: 13,
          marginTop: 2,
          lineHeight: 18,
        },
        // Edit
        rowCenter: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        editInput: {
          flex: 1,
          minHeight: 36,
          borderColor: colors.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 8,
          color: colors.text,
          backgroundColor: colors.inputBackground || colors.background,
          fontSize: 14,
          marginRight: 6,
        },
        editActionIcon: {
          marginLeft: 4,
          padding: 4,
        },
        // Empty state
        emptyState: {
          alignItems: 'center',
          paddingVertical: 14,
        },
        emptyStateText: {
          fontSize: 13,
          color: colors.secondaryText,
          textAlign: 'center',
          marginBottom: 8,
        },
        // Likes modal — bottom-sheet
        likesModalOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          justifyContent: 'flex-end',
        },
        likesModalContent: {
          backgroundColor: colors.background,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          paddingTop: 8,
          paddingBottom: 16,
          maxHeight: '70%',
        },
        modalHandle: {
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
          alignSelf: 'center',
          marginBottom: 8,
        },
        likesModalHeaderBlock: {
          paddingHorizontal: 16,
          paddingBottom: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        likesModalTitleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        },
        likesModalTitle: {
          fontSize: 17,
          fontWeight: '700',
          color: colors.text,
          textAlign: 'center',
        },
        likesModalCount: {
          fontSize: 12,
          fontWeight: '500',
          color: colors.secondaryText,
          textAlign: 'center',
          marginTop: 4,
        },
        likesModalScroll: {
          paddingHorizontal: 16,
          maxHeight: 360,
        },
        likesModalUserRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        likesModalChevron: {
          marginLeft: 8,
        },
        likesModalAvatar: {
          width: 36,
          height: 36,
          borderRadius: 18,
          marginRight: 12,
        },
        likesModalAvatarPlaceholder: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: colors.primary + '14',
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 12,
        },
        likesModalAvatarText: {
          color: colors.primary,
          fontSize: 13,
          fontWeight: '700',
        },
        likesModalUsername: {
          fontSize: 14,
          color: colors.text,
          flex: 1,
          fontWeight: '500',
        },
        likesModalUsernameClickable: {
          color: colors.primary,
          fontWeight: '600',
        },
        likesModalAnonymous: {
          fontSize: 13,
          color: colors.secondaryText,
          fontStyle: 'italic',
          paddingVertical: 12,
          textAlign: 'center',
        },
        likesModalEmpty: {
          textAlign: 'center',
          color: colors.secondaryText,
          fontSize: 13,
          paddingVertical: 20,
        },
        likesModalClose: {
          marginHorizontal: 16,
          marginTop: 14,
          height: 44,
          borderRadius: 22,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        },
        likesModalCloseText: {
          color: colors.secondaryText,
          fontWeight: '700',
          fontSize: 14,
        },
      }),
    [colors],
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {t('events.discussion') || 'Discussion'}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <FontAwesomeIcon icon={faChevronUp} size={18} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  // No post exists yet - show composer to create one
  if (!post) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {t('events.discussion') || 'Discussion'}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <FontAwesomeIcon icon={faChevronUp} size={18} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            {t('events.noDiscussion') ||
              'No discussion yet. Start the conversation!'}
          </Text>
        </View>
        <View style={styles.composerCard}>
          <View style={styles.composerRow}>
            {userData?.profilePicUrl ? (
              <Image
                source={{uri: userData.profilePicUrl}}
                style={styles.composerAvatarImage}
              />
            ) : (
              <View style={styles.composerAvatar}>
                <Text style={styles.composerAvatarText}>
                  {userData ? getInitials(userData.username) : '?'}
                </Text>
              </View>
            )}
            <TextInput
              ref={composerInputRef}
              style={styles.composerInput}
              placeholder={t('events.writeDiscussion') || 'Write something...'}
              placeholderTextColor={colors.border}
              value={newPostText}
              onChangeText={setNewPostText}
              multiline={false}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (newPostText.trim() === '' || postingContent) &&
                  styles.disabledButton,
              ]}
              onPress={createPost}
              disabled={newPostText.trim() === '' || postingContent}>
              {postingContent ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <FontAwesomeIcon icon={faPaperPlane} size={16} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Post exists - show full discussion
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {t('events.discussion') || 'Discussion'}
        </Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <FontAwesomeIcon icon={faChevronUp} size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Thread: opener is the root; comments nest under it */}
      <View style={styles.postContainer}>
        <View style={styles.commentThread}>
          <View style={styles.commentRow}>
            <View style={styles.commentLeftCol}>
              <TouchableOpacity
                onPress={() =>
                  navigateToProfile(
                    post.userId,
                    post.username,
                    post.profilePicUrl,
                  )
                }
                disabled={!!(userData && post.userId === userData._id)}>
                {post.profilePicUrl ? (
                  <Image
                    source={{uri: post.profilePicUrl}}
                    style={styles.commentAvatarImage}
                  />
                ) : (
                  <View style={styles.commentAvatar}>
                    <Text style={styles.commentAvatarText}>
                      {getInitials(post.username)}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              {((post.comments || []).some(c => c.replyToPost) ||
                replyingTo === 'post') && <View style={styles.threadSpine} />}
            </View>
            <View style={styles.commentContent}>
              <View style={styles.postUsernameRow}>
                <View style={styles.usernameWithTimestamp}>
                  <Text style={styles.commentUsername}>{post.username}</Text>
                  {post.createdAt && (
                    <Text style={styles.timestampSmall}>
                      {formatRelativeTime(post.createdAt)}
                    </Text>
                  )}
                </View>
                <View style={styles.commentActionsRow}>
                  <TouchableOpacity
                    style={styles.replyButton}
                    onPress={() => {
                      setReplyingTo('post');
                      setReplyingToReply(null);
                    }}>
                    <FontAwesomeIcon
                      icon={faReply}
                      size={11}
                      color={colors.primary}
                    />
                    <Text style={styles.replyButtonText}>
                      {t('communityNotes.reply') || 'Reply'}
                    </Text>
                  </TouchableOpacity>
                  {userData && post.userId === userData._id && (
                    <>
                      <TouchableOpacity
                        style={styles.editActionIcon}
                        onPress={() => startEditPost(post)}>
                        <FontAwesomeIcon
                          icon={faEdit}
                          size={12}
                          color={colors.primary}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.editActionIcon}
                        onPress={() => deletePost(post._id)}>
                        <FontAwesomeIcon
                          icon={faTrash}
                          size={12}
                          color={colors.text}
                        />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>

              {editingPostId === post._id ? (
                <View style={styles.rowCenter}>
                  <TextInput
                    style={styles.editInput}
                    value={editingPostText}
                    onChangeText={setEditingPostText}
                    autoFocus
                    multiline
                  />
                  <TouchableOpacity
                    style={styles.editActionIcon}
                    onPress={() => saveEditPost(post._id)}>
                    <FontAwesomeIcon
                      icon={faCheck}
                      size={12}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.editActionIcon}
                    onPress={cancelEditPost}>
                    <FontAwesomeIcon
                      icon={faTimes}
                      size={12}
                      color={colors.text}
                    />
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.postText}>{post.text}</Text>
              )}

              <View style={styles.socialActionsRow}>
                {summarizeReactions(post.reactions, userData?._id).map(pill => (
                  <TouchableOpacity
                    key={pill.emoji}
                    style={[
                      styles.commentReactionPill,
                      pill.mine && styles.commentReactionPillMine,
                    ]}
                    onPress={() => togglePostReaction(post._id, pill.emoji)}
                    hitSlop={{top: 4, bottom: 4, left: 2, right: 2}}>
                    <Text style={styles.commentReactionPillEmoji}>
                      {pill.emoji}
                    </Text>
                    <Text
                      style={[
                        styles.commentReactionPillCount,
                        pill.mine && styles.commentReactionPillCountMine,
                      ]}>
                      {pill.count}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.commentReactionAddButton}
                  onPress={() => setReactionTarget({kind: 'post'})}
                  hitSlop={{top: 4, bottom: 4, left: 4, right: 4}}>
                  <FontAwesomeIcon
                    icon={faPlus}
                    size={10}
                    color={colors.secondaryText}
                  />
                </TouchableOpacity>
              </View>

              {replyingTo === 'post' && (
                <View style={styles.replyInputRow}>
                  <TextInput
                    ref={ref => {
                      if (ref) {
                        replyInputRefs.current.post = ref;
                      }
                    }}
                    style={styles.replyInput}
                    placeholder={
                      t('communityNotes.writeReply') || 'Write a reply...'
                    }
                    placeholderTextColor={colors.border}
                    value={replyText.post || ''}
                    onChangeText={text =>
                      setReplyText(prev => ({...prev, post: text}))
                    }
                  />
                  <TouchableOpacity
                    style={styles.replySendButton}
                    onPress={async () => {
                      const text = replyText.post?.trim();
                      if (!text || !userData) {
                        return;
                      }
                      setReplyText(prev => ({...prev, post: ''}));
                      try {
                        const response = await axios.post(
                          `${API_BASE_URL}/community-notes/${post._id}/comments`,
                          {
                            text,
                            username: userData.username,
                            userId: userData._id,
                            profilePicUrl: userData.profilePicUrl || '',
                            replyToPost: true,
                          },
                        );
                        setPost(prev =>
                          prev
                            ? normalizePost({
                                ...prev,
                                comments: response.data.comments,
                              })
                            : prev,
                        );
                        setReplyingTo(null);
                        setReplyingToReply(null);
                      } catch {
                        Alert.alert(
                          t('common.error'),
                          t('communityNotes.commentError'),
                        );
                      }
                    }}>
                    <FontAwesomeIcon
                      icon={faPaperPlane}
                      size={12}
                      color="#fff"
                    />
                  </TouchableOpacity>
                </View>
              )}

              {/* Replies that specifically continue the opener's thread */}
              {(post.comments || []).filter(c => c.replyToPost).length > 0 && (
                <View style={styles.threadChildren}>
                  {(post.comments || [])
                    .filter(c => c.replyToPost)
                    .map(comment => (
                    <View
                      key={comment._id || comment.text}
                      style={styles.threadChildCard}>
                      <View style={styles.replyRow}>
                        <View style={styles.replyLeftCol}>
                          <TouchableOpacity
                            onPress={() =>
                              navigateToProfile(
                                comment.userId,
                                comment.username,
                                comment.profilePicUrl,
                              )
                            }
                            disabled={
                              !!(userData && comment.userId === userData._id)
                            }>
                            {comment.profilePicUrl ? (
                              <Image
                                source={{uri: comment.profilePicUrl}}
                                style={styles.replyAvatarImage}
                              />
                            ) : (
                              <View style={styles.replyAvatar}>
                                <Text style={styles.replyAvatarText}>
                                  {getInitials(comment.username)}
                                </Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        </View>
                        <View style={styles.replyContent}>
                          <View style={styles.postUsernameRow}>
                            <View style={styles.usernameWithTimestamp}>
                              <Text style={styles.replyUsername}>
                                {comment.username}
                              </Text>
                              {comment.createdAt && (
                                <Text style={styles.timestampTiny}>
                                  {formatRelativeTime(comment.createdAt)}
                                </Text>
                              )}
                            </View>
                            <View style={styles.commentActionsRow}>
                              <TouchableOpacity
                                style={styles.replyButton}
                                onPress={() =>
                                  startReplyToComment(comment._id!)
                                }>
                                <FontAwesomeIcon
                                  icon={faReply}
                                  size={11}
                                  color={colors.primary}
                                />
                                <Text style={styles.replyButtonText}>
                                  {t('communityNotes.reply') || 'Reply'}
                                </Text>
                              </TouchableOpacity>
                              {userData &&
                                comment.userId === userData._id &&
                                comment._id && (
                                  <>
                                    <TouchableOpacity
                                      style={styles.editActionIcon}
                                      onPress={() => startEditComment(comment)}>
                                      <FontAwesomeIcon
                                        icon={faEdit}
                                        size={12}
                                        color={colors.primary}
                                      />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      style={styles.editActionIcon}
                                      onPress={() =>
                                        deleteComment(post._id, comment._id!)
                                      }>
                                      <FontAwesomeIcon
                                        icon={faTrash}
                                        size={12}
                                        color={colors.text}
                                      />
                                    </TouchableOpacity>
                                  </>
                                )}
                            </View>
                          </View>
                          {editingCommentId === comment._id ? (
                            <View style={styles.rowCenter}>
                              <TextInput
                                style={styles.editInput}
                                value={editingCommentText}
                                onChangeText={setEditingCommentText}
                                autoFocus
                              />
                              <TouchableOpacity
                                style={styles.editActionIcon}
                                onPress={() =>
                                  saveEditComment(post._id, comment._id!)
                                }>
                                <FontAwesomeIcon
                                  icon={faCheck}
                                  size={12}
                                  color={colors.primary}
                                />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.editActionIcon}
                                onPress={cancelEditComment}>
                                <FontAwesomeIcon
                                  icon={faTimes}
                                  size={12}
                                  color={colors.text}
                                />
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <>
                              <Text style={styles.replyText}>
                                {comment.text}
                              </Text>
                              <View style={styles.commentReactionRow}>
                                {summarizeReactions(
                                  comment.reactions,
                                  userData?._id,
                                ).map(pill => (
                                  <TouchableOpacity
                                    key={pill.emoji}
                                    style={[
                                      styles.commentReactionPill,
                                      pill.mine &&
                                        styles.commentReactionPillMine,
                                    ]}
                                    onPress={() =>
                                      toggleCommentReaction(
                                        post._id,
                                        comment._id!,
                                        pill.emoji,
                                      )
                                    }
                                    hitSlop={{
                                      top: 4,
                                      bottom: 4,
                                      left: 2,
                                      right: 2,
                                    }}>
                                    <Text
                                      style={styles.commentReactionPillEmoji}>
                                      {pill.emoji}
                                    </Text>
                                    <Text
                                      style={[
                                        styles.commentReactionPillCount,
                                        pill.mine &&
                                          styles.commentReactionPillCountMine,
                                      ]}>
                                      {pill.count}
                                    </Text>
                                  </TouchableOpacity>
                                ))}
                                <TouchableOpacity
                                  style={styles.commentReactionAddButton}
                                  onPress={() =>
                                    setReactionTarget({
                                      kind: 'comment',
                                      commentId: comment._id!,
                                    })
                                  }
                                  hitSlop={{
                                    top: 4,
                                    bottom: 4,
                                    left: 4,
                                    right: 4,
                                  }}>
                                  <FontAwesomeIcon
                                    icon={faPlus}
                                    size={10}
                                    color={colors.secondaryText}
                                  />
                                </TouchableOpacity>
                              </View>
                            </>
                          )}

                          {replyingTo === comment._id && (
                            <View style={styles.replyInputRow}>
                              <TextInput
                                ref={ref => {
                                  if (ref) {
                                    replyInputRefs.current[comment._id!] = ref;
                                  }
                                }}
                                style={styles.replyInput}
                                placeholder={
                                  replyingToReply?.username
                                    ? `${t('communityNotes.reply') || 'Reply'} @${replyingToReply.username}...`
                                    : t('communityNotes.writeReply') ||
                                      'Write a reply...'
                                }
                                placeholderTextColor={colors.border}
                                value={replyText[comment._id!] || ''}
                                onChangeText={text =>
                                  setReplyText(prev => ({
                                    ...prev,
                                    [comment._id!]: text,
                                  }))
                                }
                              />
                              <TouchableOpacity
                                style={styles.replySendButton}
                                onPress={() => {
                                  addReply(post._id, comment._id!);
                                }}>
                                <FontAwesomeIcon
                                  icon={faPaperPlane}
                                  size={12}
                                  color="#fff"
                                />
                              </TouchableOpacity>
                            </View>
                          )}

                          {comment.replies && comment.replies.length > 0 && (
                            <View style={styles.repliesContainer}>
                              {comment.replies.map(reply => (
                                <View
                                  key={reply._id || reply.text}
                                  style={styles.replyContainer}>
                                  <View style={styles.replyBubble}>
                                    <View style={styles.replyRow}>
                                      <View style={styles.replyLeftCol}>
                                        <TouchableOpacity
                                          onPress={() =>
                                            navigateToProfile(
                                              reply.userId,
                                              reply.username,
                                              reply.profilePicUrl,
                                            )
                                          }
                                          disabled={
                                            !!(
                                              userData &&
                                              reply.userId === userData._id
                                            )
                                          }>
                                          {reply.profilePicUrl ? (
                                            <Image
                                              source={{
                                                uri: reply.profilePicUrl,
                                              }}
                                              style={styles.replyAvatarImage}
                                            />
                                          ) : (
                                            <View style={styles.replyAvatar}>
                                              <Text
                                                style={styles.replyAvatarText}>
                                                {getInitials(reply.username)}
                                              </Text>
                                            </View>
                                          )}
                                        </TouchableOpacity>
                                      </View>
                                      <View style={styles.replyContent}>
                                        <View style={styles.postUsernameRow}>
                                          <View
                                            style={styles.usernameWithTimestamp}>
                                            <Text style={styles.replyUsername}>
                                              {reply.username}
                                            </Text>
                                            {reply.createdAt && (
                                              <Text
                                                style={styles.timestampTiny}>
                                                {formatRelativeTime(
                                                  reply.createdAt,
                                                )}
                                              </Text>
                                            )}
                                          </View>
                                          <View style={styles.replyActionsRow}>
                                            <TouchableOpacity
                                              style={styles.replyButton}
                                              onPress={() =>
                                                startReplyToReply(
                                                  comment._id!,
                                                  reply,
                                                )
                                              }>
                                              <FontAwesomeIcon
                                                icon={faReply}
                                                size={10}
                                                color={colors.primary}
                                              />
                                              <Text
                                                style={styles.replyButtonText}>
                                                {t('communityNotes.reply') ||
                                                  'Reply'}
                                              </Text>
                                            </TouchableOpacity>
                                            {userData &&
                                              reply.userId === userData._id &&
                                              reply._id && (
                                                <>
                                                  <TouchableOpacity
                                                    style={
                                                      styles.editActionIcon
                                                    }
                                                    onPress={() =>
                                                      startEditReply(
                                                        post._id,
                                                        comment._id!,
                                                        reply,
                                                      )
                                                    }>
                                                    <FontAwesomeIcon
                                                      icon={faEdit}
                                                      size={10}
                                                      color={colors.primary}
                                                    />
                                                  </TouchableOpacity>
                                                  <TouchableOpacity
                                                    style={
                                                      styles.editActionIcon
                                                    }
                                                    onPress={() =>
                                                      deleteReply(
                                                        post._id,
                                                        comment._id!,
                                                        reply._id!,
                                                      )
                                                    }>
                                                    <FontAwesomeIcon
                                                      icon={faTrash}
                                                      size={10}
                                                      color={colors.text}
                                                    />
                                                  </TouchableOpacity>
                                                </>
                                              )}
                                          </View>
                                        </View>
                                        {reply.replyToUsername ? (
                                          <Text
                                            style={[
                                              styles.timestampTiny,
                                              {marginLeft: 0, marginTop: 2},
                                            ]}>
                                            {`↳ @${reply.replyToUsername}`}
                                          </Text>
                                        ) : null}
                                        {editingReplyId === reply._id ? (
                                          <View style={styles.rowCenter}>
                                            <TextInput
                                              style={styles.editInput}
                                              value={editingReplyText}
                                              onChangeText={setEditingReplyText}
                                              autoFocus
                                            />
                                            <TouchableOpacity
                                              style={styles.editActionIcon}
                                              onPress={saveEditReply}>
                                              <FontAwesomeIcon
                                                icon={faCheck}
                                                size={10}
                                                color={colors.primary}
                                              />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                              style={styles.editActionIcon}
                                              onPress={cancelEditReply}>
                                              <FontAwesomeIcon
                                                icon={faTimes}
                                                size={10}
                                                color={colors.text}
                                              />
                                            </TouchableOpacity>
                                          </View>
                                        ) : (
                                          <>
                                            <Text style={styles.replyText}>
                                              {reply.text}
                                            </Text>
                                            <View
                                              style={styles.commentReactionRow}>
                                              {summarizeReactions(
                                                reply.reactions,
                                                userData?._id,
                                              ).map(pill => (
                                                <TouchableOpacity
                                                  key={pill.emoji}
                                                  style={[
                                                    styles.commentReactionPill,
                                                    pill.mine &&
                                                      styles.commentReactionPillMine,
                                                  ]}
                                                  onPress={() =>
                                                    toggleReplyReaction(
                                                      post._id,
                                                      comment._id!,
                                                      reply._id!,
                                                      pill.emoji,
                                                    )
                                                  }
                                                  hitSlop={{
                                                    top: 4,
                                                    bottom: 4,
                                                    left: 2,
                                                    right: 2,
                                                  }}>
                                                  <Text
                                                    style={
                                                      styles.commentReactionPillEmoji
                                                    }>
                                                    {pill.emoji}
                                                  </Text>
                                                  <Text
                                                    style={[
                                                      styles.commentReactionPillCount,
                                                      pill.mine &&
                                                        styles.commentReactionPillCountMine,
                                                    ]}>
                                                    {pill.count}
                                                  </Text>
                                                </TouchableOpacity>
                                              ))}
                                              {reply._id ? (
                                                <TouchableOpacity
                                                  style={
                                                    styles.commentReactionAddButton
                                                  }
                                                  onPress={() =>
                                                    setReactionTarget({
                                                      kind: 'reply',
                                                      commentId: comment._id!,
                                                      replyId: reply._id!,
                                                    })
                                                  }
                                                  hitSlop={{
                                                    top: 4,
                                                    bottom: 4,
                                                    left: 4,
                                                    right: 4,
                                                  }}>
                                                  <FontAwesomeIcon
                                                    icon={faPlus}
                                                    size={10}
                                                    color={colors.secondaryText}
                                                  />
                                                </TouchableOpacity>
                                              ) : null}
                                            </View>
                                          </>
                                        )}
                                      </View>
                                    </View>
                                  </View>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Independent top-level comment threads (not replies to the opener) */}
        {(post.comments || [])
          .filter(c => !c.replyToPost)
          .map(comment => (
            <View
              key={comment._id || comment.text}
              style={styles.commentThread}>
              <View style={styles.commentRow}>
                <View style={styles.commentLeftCol}>
                  <TouchableOpacity
                    onPress={() =>
                      navigateToProfile(
                        comment.userId,
                        comment.username,
                        comment.profilePicUrl,
                      )
                    }
                    disabled={
                      !!(userData && comment.userId === userData._id)
                    }>
                    {comment.profilePicUrl ? (
                      <Image
                        source={{uri: comment.profilePicUrl}}
                        style={styles.commentAvatarImage}
                      />
                    ) : (
                      <View style={styles.commentAvatar}>
                        <Text style={styles.commentAvatarText}>
                          {getInitials(comment.username)}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  {((comment.replies && comment.replies.length > 0) ||
                    replyingTo === comment._id) && (
                    <View style={styles.threadSpine} />
                  )}
                </View>
                <View style={styles.commentContent}>
                  <View style={styles.postUsernameRow}>
                    <View style={styles.usernameWithTimestamp}>
                      <Text style={styles.commentUsername}>
                        {comment.username}
                      </Text>
                      {comment.createdAt && (
                        <Text style={styles.timestampSmall}>
                          {formatRelativeTime(comment.createdAt)}
                        </Text>
                      )}
                    </View>
                    <View style={styles.commentActionsRow}>
                      <TouchableOpacity
                        style={styles.replyButton}
                        onPress={() => startReplyToComment(comment._id!)}>
                        <FontAwesomeIcon
                          icon={faReply}
                          size={11}
                          color={colors.primary}
                        />
                        <Text style={styles.replyButtonText}>
                          {t('communityNotes.reply') || 'Reply'}
                        </Text>
                      </TouchableOpacity>
                      {userData &&
                        comment.userId === userData._id &&
                        comment._id && (
                          <>
                            <TouchableOpacity
                              style={styles.editActionIcon}
                              onPress={() => startEditComment(comment)}>
                              <FontAwesomeIcon
                                icon={faEdit}
                                size={12}
                                color={colors.primary}
                              />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.editActionIcon}
                              onPress={() =>
                                deleteComment(post._id, comment._id!)
                              }>
                              <FontAwesomeIcon
                                icon={faTrash}
                                size={12}
                                color={colors.text}
                              />
                            </TouchableOpacity>
                          </>
                        )}
                    </View>
                  </View>
                  {editingCommentId === comment._id ? (
                    <View style={styles.rowCenter}>
                      <TextInput
                        style={styles.editInput}
                        value={editingCommentText}
                        onChangeText={setEditingCommentText}
                        autoFocus
                      />
                      <TouchableOpacity
                        style={styles.editActionIcon}
                        onPress={() =>
                          saveEditComment(post._id, comment._id!)
                        }>
                        <FontAwesomeIcon
                          icon={faCheck}
                          size={12}
                          color={colors.primary}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.editActionIcon}
                        onPress={cancelEditComment}>
                        <FontAwesomeIcon
                          icon={faTimes}
                          size={12}
                          color={colors.text}
                        />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.commentText}>{comment.text}</Text>
                      <View style={styles.commentReactionRow}>
                        {summarizeReactions(
                          comment.reactions,
                          userData?._id,
                        ).map(pill => (
                          <TouchableOpacity
                            key={pill.emoji}
                            style={[
                              styles.commentReactionPill,
                              pill.mine && styles.commentReactionPillMine,
                            ]}
                            onPress={() =>
                              toggleCommentReaction(
                                post._id,
                                comment._id!,
                                pill.emoji,
                              )
                            }
                            hitSlop={{top: 4, bottom: 4, left: 2, right: 2}}>
                            <Text style={styles.commentReactionPillEmoji}>
                              {pill.emoji}
                            </Text>
                            <Text
                              style={[
                                styles.commentReactionPillCount,
                                pill.mine &&
                                  styles.commentReactionPillCountMine,
                              ]}>
                              {pill.count}
                            </Text>
                          </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                          style={styles.commentReactionAddButton}
                          onPress={() =>
                            setReactionTarget({
                              kind: 'comment',
                              commentId: comment._id!,
                            })
                          }
                          hitSlop={{top: 4, bottom: 4, left: 4, right: 4}}>
                          <FontAwesomeIcon
                            icon={faPlus}
                            size={10}
                            color={colors.secondaryText}
                          />
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  {replyingTo === comment._id && (
                    <View style={styles.replyInputRow}>
                      <TextInput
                        ref={ref => {
                          if (ref) {
                            replyInputRefs.current[comment._id!] = ref;
                          }
                        }}
                        style={styles.replyInput}
                        placeholder={
                          replyingToReply?.username
                            ? `${t('communityNotes.reply') || 'Reply'} @${replyingToReply.username}...`
                            : t('communityNotes.writeReply') ||
                              'Write a reply...'
                        }
                        placeholderTextColor={colors.border}
                        value={replyText[comment._id!] || ''}
                        onChangeText={text =>
                          setReplyText(prev => ({
                            ...prev,
                            [comment._id!]: text,
                          }))
                        }
                      />
                      <TouchableOpacity
                        style={styles.replySendButton}
                        onPress={() => addReply(post._id, comment._id!)}>
                        <FontAwesomeIcon
                          icon={faPaperPlane}
                          size={12}
                          color="#fff"
                        />
                      </TouchableOpacity>
                    </View>
                  )}

                  {comment.replies && comment.replies.length > 0 && (
                    <View style={styles.repliesContainer}>
                      {comment.replies.map(reply => (
                        <View
                          key={reply._id || reply.text}
                          style={styles.replyContainer}>
                          <View style={styles.replyBubble}>
                            <View style={styles.replyRow}>
                              <View style={styles.replyLeftCol}>
                                <TouchableOpacity
                                  onPress={() =>
                                    navigateToProfile(
                                      reply.userId,
                                      reply.username,
                                      reply.profilePicUrl,
                                    )
                                  }
                                  disabled={
                                    !!(
                                      userData &&
                                      reply.userId === userData._id
                                    )
                                  }>
                                  {reply.profilePicUrl ? (
                                    <Image
                                      source={{uri: reply.profilePicUrl}}
                                      style={styles.replyAvatarImage}
                                    />
                                  ) : (
                                    <View style={styles.replyAvatar}>
                                      <Text style={styles.replyAvatarText}>
                                        {getInitials(reply.username)}
                                      </Text>
                                    </View>
                                  )}
                                </TouchableOpacity>
                              </View>
                              <View style={styles.replyContent}>
                                <View style={styles.postUsernameRow}>
                                  <View style={styles.usernameWithTimestamp}>
                                    <Text style={styles.replyUsername}>
                                      {reply.username}
                                    </Text>
                                    {reply.createdAt && (
                                      <Text style={styles.timestampTiny}>
                                        {formatRelativeTime(reply.createdAt)}
                                      </Text>
                                    )}
                                  </View>
                                  <View style={styles.replyActionsRow}>
                                    <TouchableOpacity
                                      style={styles.replyButton}
                                      onPress={() =>
                                        startReplyToReply(comment._id!, reply)
                                      }>
                                      <FontAwesomeIcon
                                        icon={faReply}
                                        size={10}
                                        color={colors.primary}
                                      />
                                      <Text style={styles.replyButtonText}>
                                        {t('communityNotes.reply') || 'Reply'}
                                      </Text>
                                    </TouchableOpacity>
                                    {userData &&
                                      reply.userId === userData._id &&
                                      reply._id && (
                                        <>
                                          <TouchableOpacity
                                            style={styles.editActionIcon}
                                            onPress={() =>
                                              startEditReply(
                                                post._id,
                                                comment._id!,
                                                reply,
                                              )
                                            }>
                                            <FontAwesomeIcon
                                              icon={faEdit}
                                              size={10}
                                              color={colors.primary}
                                            />
                                          </TouchableOpacity>
                                          <TouchableOpacity
                                            style={styles.editActionIcon}
                                            onPress={() =>
                                              deleteReply(
                                                post._id,
                                                comment._id!,
                                                reply._id!,
                                              )
                                            }>
                                            <FontAwesomeIcon
                                              icon={faTrash}
                                              size={10}
                                              color={colors.text}
                                            />
                                          </TouchableOpacity>
                                        </>
                                      )}
                                  </View>
                                </View>
                                {reply.replyToUsername ? (
                                  <Text
                                    style={[
                                      styles.timestampTiny,
                                      {marginLeft: 0, marginTop: 2},
                                    ]}>
                                    {`↳ @${reply.replyToUsername}`}
                                  </Text>
                                ) : null}
                                {editingReplyId === reply._id ? (
                                  <View style={styles.rowCenter}>
                                    <TextInput
                                      style={styles.editInput}
                                      value={editingReplyText}
                                      onChangeText={setEditingReplyText}
                                      autoFocus
                                    />
                                    <TouchableOpacity
                                      style={styles.editActionIcon}
                                      onPress={saveEditReply}>
                                      <FontAwesomeIcon
                                        icon={faCheck}
                                        size={10}
                                        color={colors.primary}
                                      />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      style={styles.editActionIcon}
                                      onPress={cancelEditReply}>
                                      <FontAwesomeIcon
                                        icon={faTimes}
                                        size={10}
                                        color={colors.text}
                                      />
                                    </TouchableOpacity>
                                  </View>
                                ) : (
                                  <>
                                    <Text style={styles.replyText}>
                                      {reply.text}
                                    </Text>
                                    <View style={styles.commentReactionRow}>
                                      {summarizeReactions(
                                        reply.reactions,
                                        userData?._id,
                                      ).map(pill => (
                                        <TouchableOpacity
                                          key={pill.emoji}
                                          style={[
                                            styles.commentReactionPill,
                                            pill.mine &&
                                              styles.commentReactionPillMine,
                                          ]}
                                          onPress={() =>
                                            toggleReplyReaction(
                                              post._id,
                                              comment._id!,
                                              reply._id!,
                                              pill.emoji,
                                            )
                                          }
                                          hitSlop={{
                                            top: 4,
                                            bottom: 4,
                                            left: 2,
                                            right: 2,
                                          }}>
                                          <Text
                                            style={
                                              styles.commentReactionPillEmoji
                                            }>
                                            {pill.emoji}
                                          </Text>
                                          <Text
                                            style={[
                                              styles.commentReactionPillCount,
                                              pill.mine &&
                                                styles.commentReactionPillCountMine,
                                            ]}>
                                            {pill.count}
                                          </Text>
                                        </TouchableOpacity>
                                      ))}
                                      {reply._id ? (
                                        <TouchableOpacity
                                          style={
                                            styles.commentReactionAddButton
                                          }
                                          onPress={() =>
                                            setReactionTarget({
                                              kind: 'reply',
                                              commentId: comment._id!,
                                              replyId: reply._id!,
                                            })
                                          }
                                          hitSlop={{
                                            top: 4,
                                            bottom: 4,
                                            left: 4,
                                            right: 4,
                                          }}>
                                          <FontAwesomeIcon
                                            icon={faPlus}
                                            size={10}
                                            color={colors.secondaryText}
                                          />
                                        </TouchableOpacity>
                                      ) : null}
                                    </View>
                                  </>
                                )}
                              </View>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            </View>
          ))}

        {/* New independent comment (starts its own thread) */}
        <View style={styles.commentInputRow}>
          {userData?.profilePicUrl ? (
            <Image
              source={{uri: userData.profilePicUrl}}
              style={styles.commentInputAvatarImage}
            />
          ) : (
            <View style={styles.commentInputAvatar}>
              <Text style={styles.commentInputAvatarText}>
                {userData ? getInitials(userData.username) : '?'}
              </Text>
            </View>
          )}
          <TextInput
            style={styles.commentInput}
            placeholder={
              t('communityNotes.writeComment') || 'Write a comment...'
            }
            placeholderTextColor={colors.border}
            value={commentText[post._id] || ''}
            onChangeText={text =>
              setCommentText(prev => ({...prev, [post._id]: text}))
            }
          />
          <TouchableOpacity
            style={styles.commentSendButton}
            onPress={() => addComment(post._id, false)}>
            <FontAwesomeIcon icon={faPaperPlane} size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <EmojiPicker
        open={!!reactionTarget}
        onClose={() => setReactionTarget(null)}
        onEmojiSelected={(picked: EmojiType) => {
          const target = reactionTarget;
          setReactionTarget(null);
          if (!target || !post || !picked?.emoji) {
            return;
          }
          if (target.kind === 'post') {
            togglePostReaction(post._id, picked.emoji);
          } else if (target.kind === 'comment') {
            toggleCommentReaction(post._id, target.commentId, picked.emoji);
          } else {
            toggleReplyReaction(
              post._id,
              target.commentId,
              target.replyId,
              picked.emoji,
            );
          }
        }}
        enableSearchBar
        enableRecentlyUsed
        categoryPosition="bottom"
        enableCategoryChangeAnimation={false}
        enableSearchAnimation={false}
        theme={{
          backdrop: '#00000066',
          knob: colors.primary,
          container: colors.card || colors.background,
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

      {/* Likes Modal */}
      <Modal
        visible={likesModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLikesModalVisible(false)}>
        <TouchableOpacity
          style={styles.likesModalOverlay}
          activeOpacity={1}
          onPress={() => setLikesModalVisible(false)}>
          <TouchableOpacity
            style={styles.likesModalContent}
            activeOpacity={1}
            onPress={() => {}}>
            <View style={styles.modalHandle} />
            <View style={styles.likesModalHeaderBlock}>
              <View style={styles.likesModalTitleRow}>
                <FontAwesomeIcon
                  icon={faHeart}
                  size={14}
                  color={'#e74c3c'}
                />
                <Text style={styles.likesModalTitle}>
                  {likesModalData.title}
                </Text>
              </View>
              {likesModalData.users.length + likesModalData.anonymousCount >
                0 && (
                <Text style={styles.likesModalCount}>
                  {`${
                    likesModalData.users.length +
                    likesModalData.anonymousCount
                  } ${
                    likesModalData.users.length +
                      likesModalData.anonymousCount ===
                    1
                      ? 'person'
                      : 'people'
                  }`}
                </Text>
              )}
            </View>
            <ScrollView style={styles.likesModalScroll}>
              {likesModalData.users.length > 0 ? (
                <>
                  {likesModalData.users.map((user, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.likesModalUserRow}
                      onPress={() => {
                        if (user._id) {
                          setLikesModalVisible(false);
                          navigateToProfile(
                            user._id,
                            user.username,
                            user.profilePicUrl,
                          );
                        }
                      }}
                      disabled={!user._id}
                      activeOpacity={user._id ? 0.7 : 1}>
                      {user.profilePicUrl ? (
                        <Image
                          source={{uri: user.profilePicUrl}}
                          style={styles.likesModalAvatar}
                        />
                      ) : (
                        <View style={styles.likesModalAvatarPlaceholder}>
                          <Text style={styles.likesModalAvatarText}>
                            {getInitials(user.username)}
                          </Text>
                        </View>
                      )}
                      <Text
                        style={[
                          styles.likesModalUsername,
                          !!user._id && styles.likesModalUsernameClickable,
                        ]}>
                        {user.username}
                      </Text>
                      {!!user._id && (
                        <FontAwesomeIcon
                          icon={faChevronRight}
                          size={12}
                          color={colors.secondaryText}
                          style={styles.likesModalChevron}
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                  {likesModalData.anonymousCount > 0 && (
                    <Text style={styles.likesModalAnonymous}>
                      {`and ${likesModalData.anonymousCount} other${
                        likesModalData.anonymousCount === 1 ? '' : 's'
                      }`}
                    </Text>
                  )}
                </>
              ) : likesModalData.anonymousCount > 0 ? (
                <Text style={styles.likesModalAnonymous}>
                  {`${likesModalData.anonymousCount} ${
                    likesModalData.anonymousCount === 1 ? 'person' : 'people'
                  } liked this`}
                </Text>
              ) : (
                <Text style={styles.likesModalEmpty}>
                  {t('communityNotes.noLikesYet') || 'No likes yet'}
                </Text>
              )}
            </ScrollView>
            <TouchableOpacity
              style={styles.likesModalClose}
              onPress={() => setLikesModalVisible(false)}>
              <Text style={styles.likesModalCloseText}>
                {t('common.close') || 'Close'}
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default EventComments;
