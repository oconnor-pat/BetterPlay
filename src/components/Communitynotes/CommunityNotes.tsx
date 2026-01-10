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
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {SafeAreaView} from 'react-native-safe-area-context';
import HamburgerMenu from '../HamburgerMenu/HamburgerMenu';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faTrash,
  faReply,
  faEdit,
  faCheck,
  faTimes,
  faHeart,
  faComment,
  faPaperPlane,
} from '@fortawesome/free-solid-svg-icons';
import UserContext, {UserContextType} from '../UserContext';
import axios from 'axios';
import {useTheme} from '../ThemeContext/ThemeContext';
import {API_BASE_URL} from '../../config/api';
import {useTranslation} from 'react-i18next';

interface Reply {
  _id?: string;
  text: string;
  username: string;
  userId: string;
  profilePicUrl?: string;
}

interface Comment {
  _id?: string;
  text: string;
  username: string;
  userId: string;
  profilePicUrl?: string;
  replies?: Reply[];
  likes?: string[]; // Array of user IDs who liked
  likedByUsernames?: string[]; // Array of usernames who liked
}

interface Post {
  _id: string;
  text: string;
  userId: string;
  username: string;
  profilePicUrl?: string;
  comments: Comment[];
  likes?: string[]; // Array of user IDs who liked
  likedByUsernames?: string[]; // Array of usernames who liked
  createdAt?: string;
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

// Helper to format timestamp
const formatTimeAgo = (dateString?: string): string => {
  if (!dateString) {
    return '';
  }
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'Just now';
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  return date.toLocaleDateString();
};

const CommunityNotes: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostText, setNewPostText] = useState<string>('');
  const [commentText, setCommentText] = useState<{[key: string]: string}>({});
  const [replyText, setReplyText] = useState<{[key: string]: string}>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const [expandedComments, setExpandedComments] = useState<Set<string>>(
    new Set(),
  );
  const [likesModalVisible, setLikesModalVisible] = useState(false);
  const [likesModalData, setLikesModalData] = useState<{
    title: string;
    usernames: string[];
  }>({title: '', usernames: []});

  // Loading states for operations
  const [postingContent, setPostingContent] = useState(false);

  // Edit state
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostText, setEditingPostText] = useState<string>('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState<string>('');
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editingReplyText, setEditingReplyText] = useState<string>('');
  const [editingReplyParent, setEditingReplyParent] = useState<{
    postId: string;
    commentId: string;
  } | null>(null);

  const {userData} = useContext(UserContext) as UserContextType;
  const {colors} = useTheme();
  const {t} = useTranslation();

  // First-time user onboarding state
  const [showFirstTimeHint, setShowFirstTimeHint] = useState(false);

  // --- Autofocus logic for reply input ---
  const replyInputRefs = useRef<{[key: string]: TextInput | null}>({});
  const composerInputRef = useRef<TextInput | null>(null);

  // Check if user has seen the community notes onboarding
  useEffect(() => {
    const checkFirstTimeUser = async () => {
      const hasSeenHint = await AsyncStorage.getItem(
        'hasSeenCommunityNotesHint',
      );
      if (!hasSeenHint) {
        setShowFirstTimeHint(true);
      }
    };
    checkFirstTimeUser();
  }, []);

  // Dismiss hint and save to storage
  const dismissFirstTimeHint = async () => {
    await AsyncStorage.setItem('hasSeenCommunityNotesHint', 'true');
    setShowFirstTimeHint(false);
  };

  useEffect(() => {
    if (replyingTo && replyInputRefs.current[replyingTo]) {
      replyInputRefs.current[replyingTo]?.focus();
    }
  }, [replyingTo]);
  // ---------------------------------------

  // Memoize styles to update when theme changes
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
          paddingHorizontal: 0,
          paddingTop: 0,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 8,
          marginBottom: 16,
          paddingTop: 8,
          paddingHorizontal: 16,
          backgroundColor: colors.background,
          zIndex: 1,
        },
        hamburger: {
          marginRight: 12,
        },
        title: {
          fontSize: 25,
          fontWeight: '700',
          color: colors.primary,
          textAlign: 'center',
          flex: 1,
          position: 'absolute',
          left: 0,
          right: 0,
          top: 8,
          zIndex: -1,
        },
        // Composer Card
        composerCard: {
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 16,
          marginHorizontal: 16,
          marginBottom: 16,
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 2},
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 3,
        },
        composerRow: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        composerAvatar: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.primary + '20',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        },
        composerAvatarImage: {
          width: 40,
          height: 40,
          borderRadius: 20,
          marginRight: 12,
        },
        composerAvatarText: {
          fontSize: 16,
          fontWeight: '700',
          color: colors.primary,
        },
        addPostInputRow: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
        },
        addPostInput: {
          flex: 1,
          height: 44,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 22,
          paddingHorizontal: 16,
          paddingVertical: 0,
          textAlignVertical: 'center',
          color: colors.text,
          backgroundColor: colors.background,
          fontSize: 16,
          marginRight: 10,
        },
        modernButton: {
          backgroundColor: colors.primary,
          paddingVertical: 10,
          paddingHorizontal: 16,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
        },
        modernButtonText: {
          color: '#fff',
          fontWeight: '600',
          fontSize: 15,
        },
        // Post Card
        postContainer: {
          marginBottom: 12,
          marginHorizontal: 16,
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 16,
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 2},
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 3,
        },
        postHeaderRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          marginBottom: 12,
        },
        postAvatar: {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: colors.primary + '20',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        },
        postAvatarImage: {
          width: 44,
          height: 44,
          borderRadius: 22,
          marginRight: 12,
        },
        postAvatarText: {
          fontSize: 18,
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
          fontSize: 16,
          fontWeight: '700',
        },
        postTimestamp: {
          color: colors.placeholder || '#888',
          fontSize: 13,
          marginTop: 2,
        },
        postText: {
          fontSize: 16,
          color: colors.text,
          lineHeight: 22,
          marginBottom: 12,
        },
        // Social Actions Row
        socialActionsRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          marginTop: 4,
        },
        socialAction: {
          flexDirection: 'row',
          alignItems: 'center',
          marginRight: 24,
          paddingVertical: 4,
        },
        socialActionFlex: {
          flexDirection: 'row',
          alignItems: 'center',
          marginRight: 24,
          paddingVertical: 4,
          flex: 1,
        },
        socialActionText: {
          marginLeft: 6,
          fontSize: 14,
          color: colors.text,
          fontWeight: '500',
        },
        likedText: {
          color: '#e74c3c',
        },
        likedByPreview: {
          fontSize: 13,
          color: colors.text,
          marginLeft: 4,
          flex: 1,
        },
        likedByUsername: {
          fontWeight: '600',
        },
        likedByOthers: {
          color: colors.border,
        },
        postActionsRow: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        postTrashIcon: {
          marginLeft: 8,
          padding: 4,
        },
        postEditIcon: {
          marginLeft: 8,
          padding: 4,
        },
        // Comments Section
        commentsSection: {
          marginTop: 8,
          paddingTop: 8,
        },
        commentInputRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 12,
          paddingTop: 12,
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
          marginRight: 10,
        },
        commentInputAvatarImage: {
          width: 32,
          height: 32,
          borderRadius: 16,
          marginRight: 10,
        },
        commentInputAvatarText: {
          fontSize: 12,
          fontWeight: '700',
          color: colors.primary,
        },
        commentInput: {
          flex: 1,
          height: 36,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 18,
          paddingHorizontal: 14,
          color: colors.text,
          backgroundColor: colors.background,
          marginRight: 8,
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
        commentContainer: {
          marginTop: 12,
          padding: 12,
          backgroundColor: colors.background,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
        },
        commentHeaderRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          marginBottom: 4,
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
          fontWeight: '600',
        },
        commentText: {
          color: colors.text,
          fontSize: 14,
          marginTop: 4,
          lineHeight: 20,
        },
        commentActionsRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
        },
        commentTrashIcon: {
          padding: 2,
          marginLeft: 4,
        },
        commentEditIcon: {
          padding: 2,
          marginLeft: 4,
        },
        replyButton: {
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 8,
          paddingVertical: 4,
        },
        replyButtonText: {
          color: colors.primary,
          marginLeft: 6,
          fontSize: 13,
          fontWeight: '500',
        },
        replyInputRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 10,
          marginLeft: 38,
          paddingTop: 8,
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
          marginRight: 8,
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
          backgroundColor: colors.card,
          borderRadius: 10,
        },
        replyHeaderRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
        },
        replyAvatar: {
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: colors.primary + '15',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 8,
        },
        replyAvatarImage: {
          width: 24,
          height: 24,
          borderRadius: 12,
          marginRight: 8,
        },
        replyAvatarText: {
          fontSize: 10,
          fontWeight: '700',
          color: colors.primary,
        },
        replyContent: {
          flex: 1,
        },
        replyUsername: {
          color: colors.text,
          fontSize: 13,
          fontWeight: '600',
        },
        replyText: {
          color: colors.text,
          fontSize: 13,
          marginTop: 3,
          lineHeight: 18,
        },
        replyActionsRow: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        replyTrashIcon: {
          padding: 2,
          marginLeft: 4,
        },
        replyEditIcon: {
          padding: 2,
          marginLeft: 4,
        },
        rowCenter: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        editInput: {
          flex: 1,
          height: 38,
          borderColor: colors.primary,
          borderWidth: 1,
          borderRadius: 8,
          paddingHorizontal: 10,
          color: colors.text,
          backgroundColor: colors.background,
          fontSize: 15,
          marginRight: 8,
        },
        editActionIcon: {
          marginLeft: 4,
          padding: 4,
        },
        flex1: {
          flex: 1,
        },
        // Empty State
        emptyState: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 60,
          paddingHorizontal: 32,
        },
        emptyStateText: {
          fontSize: 18,
          fontWeight: '600',
          color: colors.text,
          marginTop: 16,
          textAlign: 'center',
        },
        emptyStateSubtext: {
          fontSize: 14,
          color: colors.placeholder || '#888',
          marginTop: 8,
          textAlign: 'center',
        },
        ctaButton: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.primary,
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderRadius: 25,
          marginTop: 20,
          gap: 8,
        },
        ctaButtonText: {
          color: '#fff',
          fontSize: 16,
          fontWeight: '600',
        },
        listContent: {
          paddingTop: 8,
          paddingBottom: 24,
        },
        disabledButton: {
          opacity: 0.5,
        },
        loadingContainer: {
          marginTop: 40,
        },
        editInputFlex: {
          flex: 1,
        },
        // Comment like styles
        commentLikeButton: {
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 8,
          paddingVertical: 4,
        },
        commentLikeText: {
          marginLeft: 4,
          fontSize: 12,
          color: colors.text,
          fontWeight: '500',
        },
        commentLikedText: {
          color: '#e74c3c',
        },
        // Likes modal styles
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
          maxWidth: 320,
          maxHeight: '60%',
        },
        likesModalTitle: {
          fontSize: 18,
          fontWeight: '700',
          color: colors.text,
          textAlign: 'center',
          marginBottom: 16,
        },
        likesModalList: {
          maxHeight: 250,
        },
        likesModalItem: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        likesModalItemAvatar: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: colors.primary + '20',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        },
        likesModalItemAvatarText: {
          fontSize: 14,
          fontWeight: '600',
          color: colors.primary,
        },
        likesModalItemName: {
          fontSize: 15,
          color: colors.text,
          fontWeight: '500',
        },
        likesModalClose: {
          marginTop: 16,
          paddingVertical: 12,
          backgroundColor: colors.primary,
          borderRadius: 10,
          alignItems: 'center',
        },
        likesModalCloseText: {
          color: '#fff',
          fontWeight: '600',
          fontSize: 15,
        },
        likesModalEmpty: {
          textAlign: 'center',
          color: colors.placeholder || '#888',
          fontSize: 14,
          paddingVertical: 20,
        },
        likesModalScroll: {
          maxHeight: 200,
        },
        likesModalUsername: {
          fontSize: 15,
          color: colors.text,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        keyboardAvoidingView: {
          flex: 1,
        },
      }),
    [colors],
  );

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/community-notes`);
      setPosts(response.data);
      // Initialize liked posts and comments from response if available
      if (userData) {
        const likedPostsSet = new Set<string>();
        const likedCommentsSet = new Set<string>();
        response.data.forEach((post: Post) => {
          if (post.likes?.includes(userData._id)) {
            likedPostsSet.add(post._id);
          }
          // Check comments for likes
          post.comments?.forEach((comment: Comment) => {
            if (comment.likes?.includes(userData._id) && comment._id) {
              likedCommentsSet.add(comment._id);
            }
          });
        });
        setLikedPosts(likedPostsSet);
        setLikedComments(likedCommentsSet);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch posts.');
    } finally {
      setLoading(false);
    }
  }, [userData]);

  // Fetch posts from backend on mount
  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
  };

  // Toggle like on a post (optimistic UI update with revert on error)
  const toggleLike = async (postId: string) => {
    if (!userData) {
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

    setPosts(prevPosts =>
      prevPosts.map(post =>
        post._id === postId
          ? {
              ...post,
              likes: isLiked
                ? (post.likes || []).filter(id => id !== userData._id)
                : [...(post.likes || []), userData._id],
              likedByUsernames: isLiked
                ? (post.likedByUsernames || []).filter(
                    name => name !== userData.username,
                  )
                : [...(post.likedByUsernames || []), userData.username],
            }
          : post,
      ),
    );

    // Send to backend
    try {
      const response = await axios.post(
        `${API_BASE_URL}/community-notes/${postId}/like`,
        {
          userId: userData._id,
        },
      );
      // Update with actual server response to ensure consistency
      setPosts(prevPosts =>
        prevPosts.map(post =>
          post._id === postId
            ? {
                ...post,
                likes: response.data.likes,
                likedByUsernames:
                  response.data.likedByUsernames || post.likedByUsernames,
              }
            : post,
        ),
      );
    } catch (error) {
      // Revert optimistic update on error
      setLikedPosts(prev => {
        const newSet = new Set(prev);
        if (isLiked) {
          newSet.add(postId); // Re-add if was liked before
        } else {
          newSet.delete(postId); // Remove if wasn't liked before
        }
        return newSet;
      });

      setPosts(prevPosts =>
        prevPosts.map(post =>
          post._id === postId
            ? {
                ...post,
                likes: isLiked
                  ? [...(post.likes || []), userData._id] // Re-add user
                  : (post.likes || []).filter(id => id !== userData._id), // Remove user
                likedByUsernames: isLiked
                  ? [...(post.likedByUsernames || []), userData.username]
                  : (post.likedByUsernames || []).filter(
                      name => name !== userData.username,
                    ),
              }
            : post,
        ),
      );

      Alert.alert('Error', 'Failed to update like. Please try again.');
    }
  };

  // Toggle like on a comment
  const toggleCommentLike = async (postId: string, commentId: string) => {
    if (!userData) {
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

    setPosts(prevPosts =>
      prevPosts.map(post =>
        post._id === postId
          ? {
              ...post,
              comments: post.comments.map(comment =>
                comment._id === commentId
                  ? {
                      ...comment,
                      likes: isLiked
                        ? (comment.likes || []).filter(
                            id => id !== userData._id,
                          )
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
          : post,
      ),
    );

    // Send to backend
    try {
      const response = await axios.post(
        `${API_BASE_URL}/community-notes/${postId}/comments/${commentId}/like`,
        {
          userId: userData._id,
          username: userData.username,
        },
      );
      // Update with actual server response
      setPosts(prevPosts =>
        prevPosts.map(post =>
          post._id === postId
            ? {
                ...post,
                comments: post.comments.map(comment =>
                  comment._id === commentId
                    ? {
                        ...comment,
                        likes: response.data.likes,
                        // Keep optimistic likedByUsernames if server doesn't return them
                        likedByUsernames:
                          response.data.likedByUsernames ||
                          comment.likedByUsernames,
                      }
                    : comment,
                ),
              }
            : post,
        ),
      );
    } catch (error) {
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
      // Note: For simplicity, we don't revert the posts state here
      // The next fetch will sync the correct state
    }
  };

  // Format "liked by" preview text (Instagram style)
  const formatLikedByText = (usernames: string[], totalLikes: number) => {
    if (!usernames || usernames.length === 0 || totalLikes === 0) {
      return null;
    }
    const othersCount = totalLikes - Math.min(usernames.length, 2);
    if (usernames.length === 1) {
      return (
        <Text style={styles.likedByPreview}>
          <Text style={styles.likedByUsername}>{usernames[0]}</Text>
        </Text>
      );
    } else if (usernames.length === 2 && othersCount <= 0) {
      return (
        <Text style={styles.likedByPreview}>
          <Text style={styles.likedByUsername}>{usernames[0]}</Text>
          {' & '}
          <Text style={styles.likedByUsername}>{usernames[1]}</Text>
        </Text>
      );
    } else {
      return (
        <Text style={styles.likedByPreview}>
          <Text style={styles.likedByUsername}>{usernames[0]}</Text>
          {othersCount > 0 ? (
            <Text style={styles.likedByOthers}>
              {' '}
              +{othersCount} {othersCount === 1 ? 'other' : 'others'}
            </Text>
          ) : (
            <>
              {' & '}
              <Text style={styles.likedByUsername}>{usernames[1]}</Text>
            </>
          )}
        </Text>
      );
    }
  };

  // Show who liked a post or comment
  const showLikedBy = (title: string, usernames: string[]) => {
    if (usernames.length === 0) {
      return;
    }
    setLikesModalData({title, usernames});
    setLikesModalVisible(true);
  };

  // Add a new post via backend
  const addPost = async () => {
    if (newPostText.trim() !== '' && userData) {
      setPostingContent(true);
      try {
        const response = await axios.post(`${API_BASE_URL}/community-notes`, {
          text: newPostText,
          userId: userData._id,
          username: userData.username,
          profilePicUrl: userData.profilePicUrl || '',
        });
        setPosts(prev => [...prev, response.data]);
        setNewPostText('');
      } catch (error) {
        Alert.alert('Error', 'Failed to add post.');
      } finally {
        setPostingContent(false);
      }
    }
  };

  // Edit post
  const startEditPost = (post: Post) => {
    setEditingPostId(post._id);
    setEditingPostText(post.text);
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
        {
          text: editingPostText,
        },
      );
      setPosts(prevPosts =>
        prevPosts.map(post =>
          post._id === postId ? {...post, text: response.data.text} : post,
        ),
      );
      setEditingPostId(null);
      setEditingPostText('');
    } catch (error) {
      Alert.alert('Error', 'Failed to edit post.');
    }
  };

  // Add a comment to a post via backend
  const addComment = async (postId: string) => {
    const text = commentText[postId]?.trim();
    if (text && userData) {
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
        setPosts(prevPosts =>
          prevPosts.map(post =>
            post._id === postId
              ? {...post, comments: response.data.comments}
              : post,
          ),
        );
        setCommentText(prev => ({...prev, [postId]: ''}));
      } catch (error) {
        Alert.alert('Error', 'Failed to add comment.');
      }
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
        {
          text: editingCommentText,
        },
      );
      setPosts(prevPosts =>
        prevPosts.map(post =>
          post._id === postId
            ? {
                ...post,
                comments: post.comments.map(comment =>
                  comment._id === commentId
                    ? {...comment, text: response.data.text}
                    : comment,
                ),
              }
            : post,
        ),
      );
      setEditingCommentId(null);
      setEditingCommentText('');
    } catch (error) {
      Alert.alert('Error', 'Failed to edit comment.');
    }
  };

  // Add a reply to a comment via backend
  const addReply = async (postId: string, commentId: string) => {
    const text = replyText[commentId]?.trim();
    if (text && userData) {
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
        setPosts(prevPosts =>
          prevPosts.map(post =>
            post._id === postId
              ? {
                  ...post,
                  comments: post.comments.map(comment =>
                    comment._id === commentId
                      ? {...comment, replies: response.data.replies}
                      : comment,
                  ),
                }
              : post,
          ),
        );
        setReplyText(prev => ({...prev, [commentId]: ''}));
        setReplyingTo(null);
      } catch (error) {
        Alert.alert('Error', 'Failed to add reply.');
      }
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
        {
          text: editingReplyText,
        },
      );
      setPosts(prevPosts =>
        prevPosts.map(post =>
          post._id === postId
            ? {
                ...post,
                comments: post.comments.map(comment =>
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
            : post,
        ),
      );
      setEditingReplyId(null);
      setEditingReplyText('');
      setEditingReplyParent(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to edit reply.');
    }
  };

  // Delete a post via backend
  const deletePost = async (postId: string) => {
    try {
      await axios.delete(`${API_BASE_URL}/community-notes/${postId}`);
      setPosts(prevPosts => prevPosts.filter(post => post._id !== postId));
    } catch (error) {
      Alert.alert('Error', 'Failed to delete post.');
    }
  };

  // Delete a comment via backend
  const deleteComment = async (postId: string, commentId: string) => {
    try {
      const response = await axios.delete(
        `${API_BASE_URL}/community-notes/${postId}/comments/${commentId}`,
      );
      setPosts(prevPosts =>
        prevPosts.map(post =>
          post._id === postId
            ? {...post, comments: response.data.comments}
            : post,
        ),
      );
    } catch (error: any) {
      console.error(
        'Delete comment error:',
        error.response?.data || error.message,
      );
      Alert.alert(
        'Error',
        `Failed to delete comment: ${
          error.response?.data?.error || error.message
        }`,
      );
    }
  };

  // Delete a reply via backend
  const deleteReply = async (
    postId: string,
    commentId: string,
    replyId: string,
  ) => {
    try {
      const response = await axios.delete(
        `${API_BASE_URL}/community-notes/${postId}/comments/${commentId}/replies/${replyId}`,
      );
      setPosts(prevPosts =>
        prevPosts.map(post =>
          post._id === postId
            ? {
                ...post,
                comments: post.comments.map(comment =>
                  comment._id === commentId
                    ? {...comment, replies: response.data.replies}
                    : comment,
                ),
              }
            : post,
        ),
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to delete reply.');
    }
  };

  // Empty state component
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <FontAwesomeIcon icon={faComment} size={48} color={colors.border} />
      <Text style={styles.emptyStateText}>{t('communityNotes.noPosts')}</Text>
      <Text style={styles.emptyStateSubtext}>
        {t('communityNotes.beFirstToShare')}
      </Text>
      {showFirstTimeHint && (
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => {
            dismissFirstTimeHint();
            composerInputRef.current?.focus();
          }}>
          <FontAwesomeIcon icon={faPaperPlane} size={16} color="#fff" />
          <Text style={styles.ctaButtonText}>
            {t('communityNotes.writeFirstPost') || 'Write Your First Post'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}>
        <View style={styles.header}>
          <View style={styles.hamburger}>
            <HamburgerMenu />
          </View>
          <Text style={styles.title}>{t('communityNotes.title')}</Text>
        </View>

        {/* Composer Card */}
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
            <View style={styles.addPostInputRow}>
              <TextInput
                ref={composerInputRef}
                style={styles.addPostInput}
                placeholder={t('communityNotes.whatsOnYourMind')}
                placeholderTextColor={colors.border}
                value={newPostText}
                onChangeText={text => setNewPostText(text)}
                multiline
              />
              <TouchableOpacity
                style={[
                  styles.modernButton,
                  (!newPostText.trim() || postingContent) &&
                    styles.disabledButton,
                ]}
                onPress={addPost}
                disabled={!newPostText.trim() || postingContent}>
                {postingContent ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <FontAwesomeIcon icon={faPaperPlane} size={16} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {loading && posts.length === 0 ? (
          <ActivityIndicator
            size="large"
            color={colors.primary}
            style={styles.loadingContainer}
          />
        ) : (
          <FlatList
            data={posts}
            keyExtractor={item => item._id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={renderEmptyState}
            renderItem={({item}) => (
              <View style={styles.postContainer}>
                {/* Post Header with Avatar */}
                <View style={styles.postHeaderRow}>
                  {item.profilePicUrl ? (
                    <Image
                      source={{uri: item.profilePicUrl}}
                      style={styles.postAvatarImage}
                    />
                  ) : (
                    <View style={styles.postAvatar}>
                      <Text style={styles.postAvatarText}>
                        {getInitials(item.username)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.postHeaderContent}>
                    <View style={styles.postUsernameRow}>
                      <Text style={styles.postUsername}>{item.username}</Text>
                      {userData &&
                        item.userId === userData._id &&
                        editingPostId !== item._id && (
                          <View style={styles.postActionsRow}>
                            <TouchableOpacity
                              style={styles.postEditIcon}
                              onPress={() => startEditPost(item)}>
                              <FontAwesomeIcon
                                icon={faEdit}
                                size={16}
                                color={colors.primary}
                              />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.postTrashIcon}
                              onPress={() => deletePost(item._id)}>
                              <FontAwesomeIcon
                                icon={faTrash}
                                size={16}
                                color={colors.text}
                              />
                            </TouchableOpacity>
                          </View>
                        )}
                    </View>
                    <Text style={styles.postTimestamp}>
                      {formatTimeAgo(item.createdAt)}
                    </Text>
                  </View>
                </View>

                {/* Post Content */}
                {editingPostId === item._id ? (
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
                      onPress={() => saveEditPost(item._id)}>
                      <FontAwesomeIcon
                        icon={faCheck}
                        size={18}
                        color={colors.primary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.editActionIcon}
                      onPress={cancelEditPost}>
                      <FontAwesomeIcon
                        icon={faTimes}
                        size={18}
                        color={colors.text}
                      />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.postText}>{item.text}</Text>
                )}

                {/* Social Actions Row */}
                <View style={styles.socialActionsRow}>
                  <TouchableOpacity
                    style={styles.socialActionFlex}
                    onPress={() => toggleLike(item._id)}
                    onLongPress={() =>
                      showLikedBy(
                        t('communityNotes.likedBy') || 'Liked by',
                        item.likedByUsernames || [],
                      )
                    }
                    delayLongPress={300}>
                    <FontAwesomeIcon
                      icon={faHeart}
                      size={18}
                      color={
                        likedPosts.has(item._id) ? '#e74c3c' : colors.border
                      }
                    />
                    <Text
                      style={[
                        styles.socialActionText,
                        likedPosts.has(item._id) && styles.likedText,
                      ]}>
                      {item.likes?.length || 0}
                    </Text>
                    {formatLikedByText(
                      item.likedByUsernames || [],
                      item.likes?.length || 0,
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.socialAction}
                    onPress={() => {
                      setExpandedComments(prev => {
                        const newSet = new Set(prev);
                        if (newSet.has(item._id)) {
                          newSet.delete(item._id);
                        } else {
                          newSet.add(item._id);
                        }
                        return newSet;
                      });
                    }}>
                    <FontAwesomeIcon
                      icon={faComment}
                      size={18}
                      color={
                        expandedComments.has(item._id)
                          ? colors.primary
                          : colors.text
                      }
                    />
                    <Text
                      style={[
                        styles.socialActionText,
                        expandedComments.has(item._id) && {
                          color: colors.primary,
                        },
                      ]}>
                      {item.comments?.length || 0}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Add Comment Input Row - only show when expanded */}
                {expandedComments.has(item._id) && (
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
                      placeholder={t('communityNotes.writeComment')}
                      placeholderTextColor={colors.border}
                      value={commentText[item._id] || ''}
                      onChangeText={text =>
                        setCommentText(prev => ({...prev, [item._id]: text}))
                      }
                    />
                    <TouchableOpacity
                      style={styles.commentSendButton}
                      onPress={() => addComment(item._id)}>
                      <FontAwesomeIcon
                        icon={faPaperPlane}
                        size={14}
                        color="#fff"
                      />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Comments Section - only show when expanded */}
                {expandedComments.has(item._id) &&
                  item.comments &&
                  item.comments.length > 0 && (
                    <View style={styles.commentsSection}>
                      {item.comments.map(comment => (
                        <View
                          key={comment._id || comment.text}
                          style={styles.commentContainer}>
                          <View style={styles.commentHeaderRow}>
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
                            <View style={styles.commentContent}>
                              <View style={styles.postUsernameRow}>
                                <Text style={styles.commentUsername}>
                                  {comment.username}
                                </Text>
                                <View style={styles.commentActionsRow}>
                                  <TouchableOpacity
                                    style={styles.replyButton}
                                    onPress={() => setReplyingTo(comment._id!)}>
                                    <FontAwesomeIcon
                                      icon={faReply}
                                      size={12}
                                      color={colors.primary}
                                    />
                                    <Text style={styles.replyButtonText}>
                                      {t('communityNotes.reply')}
                                    </Text>
                                  </TouchableOpacity>
                                  {userData &&
                                  comment.userId === userData._id &&
                                  comment._id ? (
                                    <>
                                      <TouchableOpacity
                                        style={styles.editActionIcon}
                                        onPress={() =>
                                          startEditComment(comment)
                                        }>
                                        <FontAwesomeIcon
                                          icon={faEdit}
                                          size={14}
                                          color={colors.primary}
                                        />
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        style={styles.editActionIcon}
                                        onPress={() =>
                                          deleteComment(item._id, comment._id!)
                                        }>
                                        <FontAwesomeIcon
                                          icon={faTrash}
                                          size={14}
                                          color={colors.text}
                                        />
                                      </TouchableOpacity>
                                    </>
                                  ) : null}
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
                                      saveEditComment(item._id, comment._id!)
                                    }>
                                    <FontAwesomeIcon
                                      icon={faCheck}
                                      size={14}
                                      color={colors.primary}
                                    />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={styles.editActionIcon}
                                    onPress={cancelEditComment}>
                                    <FontAwesomeIcon
                                      icon={faTimes}
                                      size={14}
                                      color={colors.text}
                                    />
                                  </TouchableOpacity>
                                </View>
                              ) : (
                                <>
                                  <Text style={styles.commentText}>
                                    {comment.text}
                                  </Text>
                                  {/* Comment Like Button */}
                                  <TouchableOpacity
                                    style={styles.commentLikeButton}
                                    onPress={() =>
                                      toggleCommentLike(item._id, comment._id!)
                                    }
                                    onLongPress={() =>
                                      showLikedBy(
                                        t('communityNotes.likedBy') ||
                                          'Liked by',
                                        comment.likedByUsernames || [],
                                      )
                                    }
                                    delayLongPress={300}>
                                    <FontAwesomeIcon
                                      icon={faHeart}
                                      size={12}
                                      color={
                                        likedComments.has(comment._id!)
                                          ? '#e74c3c'
                                          : colors.border
                                      }
                                    />
                                    <Text
                                      style={[
                                        styles.commentLikeText,
                                        likedComments.has(comment._id!) &&
                                          styles.commentLikedText,
                                      ]}>
                                      {comment.likes?.length || 0}
                                    </Text>
                                    {formatLikedByText(
                                      comment.likedByUsernames || [],
                                      comment.likes?.length || 0,
                                    )}
                                  </TouchableOpacity>
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
                                placeholder={t('communityNotes.writeReply')}
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
                                  addReply(item._id, comment._id!);
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
                                    <View style={styles.replyContent}>
                                      <View style={styles.postUsernameRow}>
                                        <Text style={styles.replyUsername}>
                                          {reply.username}
                                        </Text>
                                        {userData &&
                                        reply.userId === userData._id &&
                                        reply._id ? (
                                          <View style={styles.replyActionsRow}>
                                            <TouchableOpacity
                                              style={styles.editActionIcon}
                                              onPress={() =>
                                                startEditReply(
                                                  item._id,
                                                  comment._id!,
                                                  reply,
                                                )
                                              }>
                                              <FontAwesomeIcon
                                                icon={faEdit}
                                                size={12}
                                                color={colors.primary}
                                              />
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                              style={styles.editActionIcon}
                                              onPress={() =>
                                                deleteReply(
                                                  item._id,
                                                  comment._id!,
                                                  reply._id!,
                                                )
                                              }>
                                              <FontAwesomeIcon
                                                icon={faTrash}
                                                size={12}
                                                color={colors.text}
                                              />
                                            </TouchableOpacity>
                                          </View>
                                        ) : null}
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
                                              size={12}
                                              color={colors.primary}
                                            />
                                          </TouchableOpacity>
                                          <TouchableOpacity
                                            style={styles.editActionIcon}
                                            onPress={cancelEditReply}>
                                            <FontAwesomeIcon
                                              icon={faTimes}
                                              size={12}
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
                              ))}
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
              </View>
            )}
          />
        )}
      </KeyboardAvoidingView>

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
              {likesModalData.usernames.length > 0 ? (
                likesModalData.usernames.map((username, index) => (
                  <Text key={index} style={styles.likesModalUsername}>
                    {username}
                  </Text>
                ))
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
    </SafeAreaView>
  );
};

export default CommunityNotes;
