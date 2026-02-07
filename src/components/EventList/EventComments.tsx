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
} from '@fortawesome/free-solid-svg-icons';
import UserContext, {UserContextType} from '../UserContext';
import axios from 'axios';
import {useTheme} from '../ThemeContext/ThemeContext';
import {API_BASE_URL} from '../../config/api';
import {useTranslation} from 'react-i18next';
import {useNavigation, CommonActions} from '@react-navigation/native';

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
          backgroundColor: colors.card,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          paddingTop: 18,
          paddingBottom: 14,
          paddingHorizontal: 16,
          marginTop: 14,
        },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 0,
          marginBottom: 16,
        },
        headerTitle: {
          fontSize: 16,
          fontWeight: '600',
          color: colors.text,
        },
        closeButton: {
          padding: 4,
        },
        loadingContainer: {
          padding: 20,
          alignItems: 'center',
        },
        // Composer
        composerCard: {
          backgroundColor: colors.background,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 16,
          marginBottom: 16,
        },
        composerRow: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        composerAvatar: {
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: colors.primary + '20',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        },
        composerAvatarImage: {
          width: 38,
          height: 38,
          borderRadius: 19,
          marginRight: 12,
        },
        composerAvatarText: {
          fontSize: 14,
          fontWeight: '700',
          color: colors.primary,
        },
        composerInput: {
          flex: 1,
          height: 44,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 22,
          paddingHorizontal: 16,
          color: colors.text,
          backgroundColor: colors.card,
          fontSize: 15,
          marginRight: 12,
        },
        sendButton: {
          width: 44,
          height: 44,
          borderRadius: 22,
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
          marginBottom: 16,
          paddingHorizontal: 2,
        },
        postHeaderRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          marginBottom: 12,
        },
        postAvatar: {
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: colors.primary + '20',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        },
        postAvatarImage: {
          width: 42,
          height: 42,
          borderRadius: 21,
          marginRight: 12,
        },
        postAvatarText: {
          fontSize: 16,
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
          fontSize: 15,
          fontWeight: '700',
        },
        timestamp: {
          color: colors.secondaryText,
          fontSize: 12,
          fontWeight: '400',
          marginLeft: 8,
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
          lineHeight: 23,
          marginBottom: 14,
          paddingLeft: 4,
        },
        // Social actions
        socialActionsRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: 14,
          paddingHorizontal: 4,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        socialAction: {
          flexDirection: 'row',
          alignItems: 'center',
          marginRight: 20,
          paddingVertical: 6,
        },
        socialActionFlex: {
          flexDirection: 'row',
          alignItems: 'center',
          marginRight: 0,
          paddingVertical: 6,
          flex: 1,
          justifyContent: 'flex-end',
        },
        socialActionText: {
          marginLeft: 8,
          fontSize: 14,
          color: colors.text,
          fontWeight: '500',
        },
        likedText: {
          color: '#e74c3c',
        },
        clickableLikeCount: {
          backgroundColor: colors.primary + '20',
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 12,
          fontWeight: '600',
          color: colors.primary,
          overflow: 'hidden',
        },
        likeCountButton: {
          minWidth: 36,
          minHeight: 28,
          justifyContent: 'center',
          alignItems: 'center',
        },
        likeIconButton: {
          padding: 6,
          marginRight: 2,
        },
        // Comment input
        commentInputRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 14,
          paddingTop: 14,
          paddingHorizontal: 4,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        commentInputAvatar: {
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: colors.primary + '20',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        },
        commentInputAvatarImage: {
          width: 32,
          height: 32,
          borderRadius: 16,
          marginRight: 12,
        },
        commentInputAvatarText: {
          fontSize: 11,
          fontWeight: '700',
          color: colors.primary,
        },
        commentInput: {
          flex: 1,
          height: 40,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 20,
          paddingHorizontal: 16,
          color: colors.text,
          backgroundColor: colors.background,
          marginRight: 12,
          fontSize: 14,
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
          marginTop: 16,
        },
        commentContainer: {
          marginTop: 12,
          padding: 14,
          backgroundColor: colors.background,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
        },
        commentHeaderRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
        },
        commentAvatar: {
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: colors.primary + '15',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 10,
        },
        commentAvatarImage: {
          width: 28,
          height: 28,
          borderRadius: 14,
          marginRight: 10,
        },
        commentAvatarText: {
          fontSize: 10,
          fontWeight: '700',
          color: colors.primary,
        },
        commentContent: {
          flex: 1,
        },
        commentUsername: {
          color: colors.text,
          fontSize: 14,
          fontWeight: '600',
        },
        commentActionsRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
        },
        commentText: {
          color: colors.text,
          fontSize: 14,
          marginTop: 5,
          lineHeight: 21,
          paddingLeft: 2,
        },
        replyButton: {
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 6,
          paddingVertical: 2,
        },
        replyButtonText: {
          color: colors.primary,
          marginLeft: 5,
          fontSize: 12,
          fontWeight: '500',
        },
        commentLikeButton: {
          flexDirection: 'row',
          alignItems: 'center',
          padding: 4,
        },
        commentLikeRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 6,
        },
        commentLikeText: {
          marginLeft: 2,
          fontSize: 11,
          color: colors.text,
          fontWeight: '500',
        },
        commentLikedText: {
          color: '#e74c3c',
        },
        commentLikeCountButton: {
          minWidth: 28,
          minHeight: 24,
          justifyContent: 'center',
          alignItems: 'center',
        },
        commentClickableLikeCount: {
          backgroundColor: colors.primary + '20',
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 10,
          fontWeight: '600',
          color: colors.primary,
          overflow: 'hidden',
        },
        // Reply input
        replyInputRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 8,
          marginLeft: 34,
          paddingTop: 6,
        },
        replyInput: {
          flex: 1,
          height: 34,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 17,
          paddingHorizontal: 14,
          color: colors.text,
          backgroundColor: colors.background,
          marginRight: 10,
          fontSize: 13,
        },
        replySendButton: {
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        },
        // Replies
        repliesContainer: {
          marginLeft: 38,
          marginTop: 8,
          borderLeftWidth: 2,
          borderLeftColor: colors.border,
          paddingLeft: 12,
        },
        replyContainer: {
          marginTop: 8,
          padding: 10,
          backgroundColor: colors.background,
          borderRadius: 12,
        },
        replyHeaderRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
        },
        replyAvatar: {
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: colors.primary + '15',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 6,
        },
        replyAvatarImage: {
          width: 22,
          height: 22,
          borderRadius: 11,
          marginRight: 6,
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
          fontSize: 12,
          fontWeight: '600',
        },
        replyActionsRow: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        replyText: {
          color: colors.text,
          fontSize: 12,
          marginTop: 2,
          lineHeight: 16,
        },
        // Edit
        rowCenter: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        editInput: {
          flex: 1,
          height: 34,
          borderColor: colors.primary,
          borderWidth: 1,
          borderRadius: 8,
          paddingHorizontal: 10,
          color: colors.text,
          backgroundColor: colors.background,
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
          paddingVertical: 20,
        },
        emptyStateText: {
          fontSize: 14,
          color: colors.text,
          textAlign: 'center',
          marginBottom: 12,
        },
        // Likes modal
        likesModalOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'center',
          alignItems: 'center',
        },
        likesModalContent: {
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 20,
          width: '80%',
          maxWidth: 300,
          maxHeight: '50%',
        },
        likesModalTitle: {
          fontSize: 16,
          fontWeight: '700',
          color: colors.text,
          textAlign: 'center',
          marginBottom: 14,
        },
        likesModalScroll: {
          maxHeight: 220,
        },
        likesModalUserRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        likesModalAvatar: {
          width: 32,
          height: 32,
          borderRadius: 16,
          marginRight: 10,
        },
        likesModalAvatarPlaceholder: {
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: colors.primary,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 10,
        },
        likesModalAvatarText: {
          color: '#fff',
          fontSize: 12,
          fontWeight: '600',
        },
        likesModalUsername: {
          fontSize: 14,
          color: colors.text,
          flex: 1,
        },
        likesModalUsernameClickable: {
          color: colors.primary,
        },
        likesModalAnonymous: {
          fontSize: 13,
          color: colors.secondaryText,
          fontStyle: 'italic',
          paddingVertical: 8,
          textAlign: 'center',
        },
        likesModalEmpty: {
          textAlign: 'center',
          color: colors.placeholder || '#888',
          fontSize: 13,
          paddingVertical: 16,
        },
        likesModalClose: {
          marginTop: 14,
          paddingVertical: 10,
          backgroundColor: colors.primary,
          borderRadius: 8,
          alignItems: 'center',
        },
        likesModalCloseText: {
          color: '#fff',
          fontWeight: '600',
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
          <View style={styles.socialActionFlex}>
            <TouchableOpacity
              onPress={() => toggleLike(post._id)}
              style={styles.likeIconButton}>
              <FontAwesomeIcon
                icon={faHeart}
                size={16}
                color={likedPosts.has(post._id) ? '#e74c3c' : colors.border}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.likeCountButton}
              onPress={() =>
                showLikedBy(
                  t('communityNotes.likedBy') || 'Liked by',
                  post.likedByUsers || [],
                  post.likedByUsernames || [],
                  post.likes?.length || 0,
                )
              }
              disabled={(post.likes?.length || 0) === 0}>
              <Text
                style={[
                  styles.socialActionText,
                  likedPosts.has(post._id) && styles.likedText,
                  (post.likes?.length || 0) > 0 && styles.clickableLikeCount,
                ]}>
                {post.likes?.length || 0}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.socialActionText}>
            {post.comments?.length || 0}{' '}
            {t('communityNotes.comments') || 'Comments'}
          </Text>
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
                <View style={styles.commentHeaderRow}>
                  <TouchableOpacity
                    onPress={() =>
                      navigateToProfile(
                        comment.userId,
                        comment.username,
                        comment.profilePicUrl,
                      )
                    }
                    disabled={!!(userData && comment.userId === userData._id)}>
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
                            style={styles.commentLikeButton}
                            onPress={() =>
                              toggleCommentLike(post._id, comment._id!)
                            }>
                            <FontAwesomeIcon
                              icon={faHeart}
                              size={11}
                              color={
                                likedComments.has(comment._id!)
                                  ? '#e74c3c'
                                  : colors.border
                              }
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.commentLikeCountButton}
                            onPress={() =>
                              showLikedBy(
                                t('communityNotes.likedBy') || 'Liked by',
                                comment.likedByUsers || [],
                                comment.likedByUsernames || [],
                                comment.likes?.length || 0,
                              )
                            }
                            disabled={(comment.likes?.length || 0) === 0}>
                            <Text
                              style={[
                                styles.commentLikeText,
                                likedComments.has(comment._id!) &&
                                  styles.commentLikedText,
                                (comment.likes?.length || 0) > 0 &&
                                  styles.commentClickableLikeCount,
                              ]}>
                              {comment.likes?.length || 0}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                  </View>
                </View>

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
                        t('communityNotes.writeReply') || 'Write a reply...'
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
                    {comment.replies.map(reply => (
                      <View
                        key={reply._id || reply.text}
                        style={styles.replyContainer}>
                        <View style={styles.replyHeaderRow}>
                          <TouchableOpacity
                            onPress={() =>
                              navigateToProfile(
                                reply.userId,
                                reply.username,
                                reply.profilePicUrl,
                              )
                            }
                            disabled={
                              !!(userData && reply.userId === userData._id)
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
                              <Text style={styles.replyText}>{reply.text}</Text>
                            )}
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
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
          <View style={styles.likesModalContent}>
            <Text style={styles.likesModalTitle}>{likesModalData.title}</Text>
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
                {t('close') || 'Close'}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default EventComments;
