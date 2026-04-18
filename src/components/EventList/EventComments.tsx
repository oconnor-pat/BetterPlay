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
  faComments,
  faPaperPlane,
  faChevronUp,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import UserContext, {UserContextType} from '../UserContext';
import axios from 'axios';
import {useTheme} from '../ThemeContext/ThemeContext';
import {API_BASE_URL} from '../../config/api';
import {useTranslation} from 'react-i18next';
import {useNavigation, CommonActions} from '@react-navigation/native';
import {useSocket} from '../../Context/SocketContext';

interface Reply {
  _id?: string;
  text: string;
  username: string;
  userId: string;
  profilePicUrl?: string;
  createdAt?: string;
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
  createdAt?: string;
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
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const [likesModalVisible, setLikesModalVisible] = useState(false);
  const [likesModalData, setLikesModalData] = useState<{
    title: string;
    users: LikedByUser[];
    anonymousCount: number;
  }>({title: '', users: [], anonymousCount: 0});

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
  const {colors} = useTheme();
  const {t} = useTranslation();
  const navigation = useNavigation();
  const {subscribe: socketSubscribe, joinEvent, leaveEvent} = useSocket();

  const replyInputRefs = useRef<{[key: string]: TextInput | null}>({});
  const composerInputRef = useRef<TextInput | null>(null);

  // Autofocus reply input
  useEffect(() => {
    if (replyingTo && replyInputRefs.current[replyingTo]) {
      replyInputRefs.current[replyingTo]?.focus();
    }
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
        setPost(response.data);
        // Initialize liked states
        if (userData) {
          if (response.data.likes?.includes(userData._id)) {
            setLikedPosts(new Set([response.data._id]));
          }
          const likedCommentsSet = new Set<string>();
          response.data.comments?.forEach((comment: Comment) => {
            if (comment.likes?.includes(userData._id) && comment._id) {
              likedCommentsSet.add(comment._id);
            }
          });
          setLikedComments(likedCommentsSet);
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
            const updates: Partial<Post> = {comments: data.comments};
            if (data.likes) updates.likes = data.likes;
            if (data.likedByUsernames)
              updates.likedByUsernames = data.likedByUsernames;
            return {...prev, ...updates};
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
      const count = post?.comments?.length || 0;
      onCommentCountChangeRef.current(eventId, count);
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

  // Toggle like on post
  const toggleLike = async (postId: string) => {
    if (!userData || !post) {
      return;
    }

    const isLiked = likedPosts.has(postId);

    // Optimistic update
    setLikedPosts(prev => {
      const newSet = new Set(prev);
      if (isLiked) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });

    setPost(prev =>
      prev
        ? {
            ...prev,
            likes: isLiked
              ? (prev.likes || []).filter(id => id !== userData._id)
              : [...(prev.likes || []), userData._id],
            likedByUsernames: isLiked
              ? (prev.likedByUsernames || []).filter(
                  name => name !== userData.username,
                )
              : [...(prev.likedByUsernames || []), userData.username],
          }
        : prev,
    );

    try {
      const response = await axios.post(
        `${API_BASE_URL}/community-notes/${postId}/like`,
        {userId: userData._id},
      );
      setPost(prev =>
        prev
          ? {
              ...prev,
              likes: response.data.likes,
              likedByUsernames:
                response.data.likedByUsernames || prev.likedByUsernames,
            }
          : prev,
      );
    } catch {
      // Revert on error
      setLikedPosts(prev => {
        const newSet = new Set(prev);
        if (isLiked) {
          newSet.add(postId);
        } else {
          newSet.delete(postId);
        }
        return newSet;
      });
      setPost(prev =>
        prev
          ? {
              ...prev,
              likes: isLiked
                ? [...(prev.likes || []), userData._id]
                : (prev.likes || []).filter(id => id !== userData._id),
              likedByUsernames: isLiked
                ? [...(prev.likedByUsernames || []), userData.username]
                : (prev.likedByUsernames || []).filter(
                    name => name !== userData.username,
                  ),
            }
          : prev,
      );
    }
  };

  // Toggle like on comment
  const toggleCommentLike = async (postId: string, commentId: string) => {
    if (!userData || !post) {
      return;
    }

    const isLiked = likedComments.has(commentId);

    // Optimistic update
    setLikedComments(prev => {
      const newSet = new Set(prev);
      if (isLiked) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });

    setPost(prev =>
      prev
        ? {
            ...prev,
            comments: prev.comments.map(comment =>
              comment._id === commentId
                ? {
                    ...comment,
                    likes: isLiked
                      ? (comment.likes || []).filter(id => id !== userData._id)
                      : [...(comment.likes || []), userData._id],
                    likedByUsernames: isLiked
                      ? (comment.likedByUsernames || []).filter(
                          name => name !== userData.username,
                        )
                      : [
                          ...(comment.likedByUsernames || []),
                          userData.username,
                        ],
                  }
                : comment,
            ),
          }
        : prev,
    );

    try {
      const response = await axios.post(
        `${API_BASE_URL}/community-notes/${postId}/comments/${commentId}/like`,
        {userId: userData._id},
      );
      setPost(prev =>
        prev
          ? {
              ...prev,
              comments: prev.comments.map(comment =>
                comment._id === commentId
                  ? {
                      ...comment,
                      likes: response.data.likes,
                      likedByUsernames:
                        response.data.likedByUsernames ||
                        comment.likedByUsernames,
                    }
                  : comment,
              ),
            }
          : prev,
      );
    } catch {
      // Revert on error
      setLikedComments(prev => {
        const newSet = new Set(prev);
        if (isLiked) {
          newSet.add(commentId);
        } else {
          newSet.delete(commentId);
        }
        return newSet;
      });
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

  // Add comment
  const addComment = async (postId: string) => {
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
        },
      );
      setPost(prev =>
        prev ? {...prev, comments: response.data.comments} : prev,
      );
      setCommentText(prev => ({...prev, [postId]: ''}));
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
        },
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
      setReplyText(prev => ({...prev, [commentId]: ''}));
      setReplyingTo(null);
    } catch {
      Alert.alert(t('common.error'), t('communityNotes.replyError'));
    }
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
        // Post
        postContainer: {
          paddingTop: 4,
          paddingBottom: 4,
        },
        postHeaderRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          marginBottom: 6,
        },
        postAvatar: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.primary + '14',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 10,
        },
        postAvatarImage: {
          width: 40,
          height: 40,
          borderRadius: 20,
          marginRight: 10,
        },
        postAvatarText: {
          fontSize: 15,
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
          fontSize: 15,
          color: colors.text,
          lineHeight: 21,
          marginTop: 2,
          marginBottom: 6,
          marginLeft: 50,
        },
        // Social actions — Bluesky-style ghost icon+count clusters
        socialActionsRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: 4,
          paddingBottom: 2,
          gap: 28,
          marginLeft: 50,
        },
        socialPill: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 4,
          gap: 6,
        },
        socialPillText: {
          fontSize: 13,
          color: colors.secondaryText,
          fontWeight: '500',
        },
        socialPillTextActive: {
          color: '#e74c3c',
        },
        // Comment input — flat row above comments
        commentInputRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 12,
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
        // Comments section
        commentsSection: {
          marginTop: 4,
        },
        commentContainer: {
          paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
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
          width: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
          flex: 1,
          marginTop: 4,
          minHeight: 8,
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
        commentLikeRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 6,
        },
        commentLikePill: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 2,
          paddingHorizontal: 0,
          gap: 5,
        },
        commentLikePillText: {
          fontSize: 12,
          color: colors.secondaryText,
          fontWeight: '600',
        },
        commentLikePillTextActive: {
          color: '#e74c3c',
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
        // Replies — nested inside comment content column with their own threading spine
        repliesContainer: {
          marginTop: 6,
        },
        replyContainer: {
          paddingTop: 8,
          paddingBottom: 4,
        },
        replyRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
        },
        replyLeftCol: {
          width: 26,
          alignItems: 'center',
          marginRight: 8,
        },
        replyThreadSpineTop: {
          width: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
          height: 12,
          marginBottom: 0,
        },
        replyThreadSpineBottom: {
          width: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
          flex: 1,
          marginTop: 4,
          minHeight: 8,
        },
        replyHeaderRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
        },
        replyAvatar: {
          width: 26,
          height: 26,
          borderRadius: 13,
          backgroundColor: colors.primary + '14',
          alignItems: 'center',
          justifyContent: 'center',
        },
        replyAvatarImage: {
          width: 26,
          height: 26,
          borderRadius: 13,
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

      {/* Post */}
      <View style={styles.postContainer}>
        <View style={styles.postHeaderRow}>
          <TouchableOpacity
            onPress={() =>
              navigateToProfile(post.userId, post.username, post.profilePicUrl)
            }
            disabled={!!(userData && post.userId === userData._id)}>
            {post.profilePicUrl ? (
              <Image
                source={{uri: post.profilePicUrl}}
                style={styles.postAvatarImage}
              />
            ) : (
              <View style={styles.postAvatar}>
                <Text style={styles.postAvatarText}>
                  {getInitials(post.username)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.postHeaderContent}>
            <View style={styles.postUsernameRow}>
              <View style={styles.usernameWithTimestamp}>
                <Text style={styles.postUsername}>{post.username}</Text>
                {post.createdAt && (
                  <Text style={styles.timestamp}>
                    {formatRelativeTime(post.createdAt)}
                  </Text>
                )}
              </View>
              {userData && post.userId === userData._id && (
                <View style={styles.postActionsRow}>
                  <TouchableOpacity
                    style={styles.postEditIcon}
                    onPress={() => startEditPost(post)}>
                    <FontAwesomeIcon
                      icon={faEdit}
                      size={14}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.postTrashIcon}
                    onPress={() => deletePost(post._id)}>
                    <FontAwesomeIcon
                      icon={faTrash}
                      size={14}
                      color={colors.text}
                    />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Post Content */}
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
                size={16}
                color={colors.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.editActionIcon}
              onPress={cancelEditPost}>
              <FontAwesomeIcon icon={faTimes} size={16} color={colors.text} />
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.postText}>{post.text}</Text>
        )}

        {/* Social Actions */}
        <View style={styles.socialActionsRow}>
          <TouchableOpacity
            style={styles.socialPill}
            onPress={() => toggleLike(post._id)}
            onLongPress={() =>
              (post.likes?.length || 0) > 0 &&
              showLikedBy(
                t('communityNotes.likedBy') || 'Liked by',
                post.likedByUsers || [],
                post.likedByUsernames || [],
                post.likes?.length || 0,
              )
            }>
            <FontAwesomeIcon
              icon={faHeart}
              size={14}
              color={likedPosts.has(post._id) ? '#e74c3c' : colors.secondaryText}
            />
            <Text
              style={[
                styles.socialPillText,
                likedPosts.has(post._id) && styles.socialPillTextActive,
              ]}>
              {post.likes?.length || 0}
            </Text>
          </TouchableOpacity>
          <View style={styles.socialPill}>
            <FontAwesomeIcon
              icon={faComments}
              size={14}
              color={colors.secondaryText}
            />
            <Text style={styles.socialPillText}>
              {post.comments?.length || 0}
            </Text>
          </View>
        </View>

        {/* Add Comment */}
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
            onPress={() => addComment(post._id)}>
            <FontAwesomeIcon icon={faPaperPlane} size={14} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Comments */}
        {post.comments && post.comments.length > 0 && (
          <View style={styles.commentsSection}>
            {post.comments.map(comment => (
              <View
                key={comment._id || comment.text}
                style={styles.commentContainer}>
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
                          onPress={() => setReplyingTo(comment._id!)}>
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
                        <View style={styles.commentLikeRow}>
                          <TouchableOpacity
                            style={styles.commentLikePill}
                            onPress={() =>
                              toggleCommentLike(post._id, comment._id!)
                            }
                            onLongPress={() =>
                              (comment.likes?.length || 0) > 0 &&
                              showLikedBy(
                                t('communityNotes.likedBy') || 'Liked by',
                                comment.likedByUsers || [],
                                comment.likedByUsernames || [],
                                comment.likes?.length || 0,
                              )
                            }>
                            <FontAwesomeIcon
                              icon={faHeart}
                              size={11}
                              color={
                                likedComments.has(comment._id!)
                                  ? '#e74c3c'
                                  : colors.secondaryText
                              }
                            />
                            <Text
                              style={[
                                styles.commentLikePillText,
                                likedComments.has(comment._id!) &&
                                  styles.commentLikePillTextActive,
                              ]}>
                              {comment.likes?.length || 0}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    )}

                    {/* Reply input */}
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
                            t('communityNotes.writeReply') ||
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
                            setReplyingTo(null);
                          }}>
                          <FontAwesomeIcon
                            icon={faPaperPlane}
                            size={12}
                            color="#fff"
                          />
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Replies */}
                    {comment.replies && comment.replies.length > 0 && (
                      <View style={styles.repliesContainer}>
                        {comment.replies.map((reply, replyIdx, replyArr) => {
                          const isLastReply =
                            replyIdx === replyArr.length - 1;
                          return (
                            <View
                              key={reply._id || reply.text}
                              style={styles.replyContainer}>
                              <View style={styles.replyRow}>
                                <View style={styles.replyLeftCol}>
                                  <View style={styles.replyThreadSpineTop} />
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
                                  {!isLastReply && (
                                    <View
                                      style={styles.replyThreadSpineBottom}
                                    />
                                  )}
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
                                    {userData &&
                                      reply.userId === userData._id &&
                                      reply._id && (
                                        <View style={styles.replyActionsRow}>
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
                                        </View>
                                      )}
                                  </View>
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
                                    <Text style={styles.replyText}>
                                      {reply.text}
                                    </Text>
                                  )}
                                </View>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

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
