import React, {useState, useContext, useEffect, useMemo, useRef} from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import HamburgerMenu from '../HamburgerMenu/HamburgerMenu';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faTrash,
  faReply,
  faEdit,
  faCheck,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';
import UserContext, {UserContextType} from '../UserContext';
import axios from 'axios';
import {useTheme} from '../ThemeContext/ThemeContext';

interface Reply {
  _id?: string;
  text: string;
  username: string;
  userId: string;
}

interface Comment {
  _id?: string;
  text: string;
  username: string;
  userId: string;
  replies?: Reply[];
}

interface Post {
  _id: string;
  text: string;
  userId: string;
  username: string;
  comments: Comment[];
}

const API_BASE_URL = 'http://localhost:8001';

const CommunityNotes: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostText, setNewPostText] = useState<string>('');
  const [commentText, setCommentText] = useState<{[key: string]: string}>({});
  const [replyText, setReplyText] = useState<{[key: string]: string}>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

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

  // --- Autofocus logic for reply input ---
  const replyInputRefs = useRef<{[key: string]: TextInput | null}>({});

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
          paddingHorizontal: 16,
          paddingTop: 0,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-start',
          marginTop: 8,
          marginBottom: 16,
        },
        hamburger: {
          marginRight: 12,
        },
        title: {
          fontSize: 24,
          fontWeight: 'bold',
          color: colors.text,
        },
        addPostInputRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 16,
        },
        addPostInput: {
          flex: 1,
          height: 44,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 10,
          paddingHorizontal: 14,
          color: colors.text,
          backgroundColor: colors.card,
          fontSize: 16,
          marginRight: 10,
        },
        modernButton: {
          backgroundColor: colors.primary,
          paddingVertical: 10,
          paddingHorizontal: 18,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        },
        modernButtonText: {
          color: colors.background,
          fontWeight: 'bold',
          fontSize: 16,
        },
        postContainer: {
          marginBottom: 16,
          backgroundColor: colors.card,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 14,
          shadowColor: colors.text,
          shadowOffset: {width: 0, height: 2},
          shadowOpacity: 0.07,
          shadowRadius: 4,
          elevation: 2,
        },
        postHeaderRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 8,
        },
        postText: {
          fontSize: 17,
          color: colors.text,
          flex: 1,
          marginRight: 8,
        },
        postTrashIcon: {
          marginLeft: 8,
          padding: 4,
        },
        postEditIcon: {
          marginLeft: 8,
          padding: 4,
        },
        commentInputRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 8,
          marginBottom: 4,
        },
        commentInput: {
          flex: 1,
          height: 38,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 8,
          paddingHorizontal: 10,
          color: colors.text,
          backgroundColor: colors.background,
          marginRight: 8,
          fontSize: 15,
        },
        commentContainer: {
          marginLeft: 0,
          marginTop: 10,
          marginBottom: 10,
          padding: 10,
          backgroundColor: colors.background,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: colors.text,
          shadowOffset: {width: 0, height: 1},
          shadowOpacity: 0.04,
          shadowRadius: 2,
          elevation: 1,
          minHeight: 44,
        },
        commentHeaderRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 2,
        },
        commentUsername: {
          color: colors.primary,
          fontSize: 14,
          fontWeight: 'bold',
          textAlign: 'left',
          flex: 1,
          paddingRight: 8,
        },
        commentText: {
          color: colors.text,
          marginTop: 2,
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
          marginTop: 4,
        },
        replyButtonText: {
          color: colors.primary,
          marginLeft: 4,
          fontSize: 13,
        },
        replyInputRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 6,
          marginLeft: 16,
        },
        replyInput: {
          flex: 1,
          height: 36,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 8,
          paddingHorizontal: 10,
          color: colors.text,
          backgroundColor: colors.background,
          marginRight: 8,
          fontSize: 14,
        },
        replyContainer: {
          marginLeft: 16,
          marginTop: 6,
          marginBottom: 6,
          padding: 8,
          backgroundColor: colors.card,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.border,
        },
        replyHeaderRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        replyUsername: {
          color: colors.primary,
          fontSize: 13,
          fontWeight: 'bold',
        },
        replyText: {
          color: colors.text,
          fontSize: 13,
          marginTop: 2,
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
      }),
    [colors],
  );

  // Fetch posts from backend on mount
  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/community-notes`);
      setPosts(response.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch posts.');
    } finally {
      setLoading(false);
    }
  };

  // Add a new post via backend
  const addPost = async () => {
    if (newPostText.trim() !== '' && userData) {
      try {
        const response = await axios.post(`${API_BASE_URL}/community-notes`, {
          text: newPostText,
          userId: userData._id,
          username: userData.username,
        });
        setPosts(prev => [...prev, response.data]);
        setNewPostText('');
      } catch (error) {
        Alert.alert('Error', 'Failed to add post.');
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
    } catch (error) {
      Alert.alert('Error', 'Failed to delete comment.');
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.hamburger}>
          <HamburgerMenu />
        </View>
        <Text style={styles.title}>Community Notes</Text>
      </View>

      {/* Add Post Input Row */}
      <View style={styles.addPostInputRow}>
        <TextInput
          style={styles.addPostInput}
          placeholder="Enter your post"
          placeholderTextColor={colors.border}
          value={newPostText}
          onChangeText={text => setNewPostText(text)}
        />
        <TouchableOpacity style={styles.modernButton} onPress={addPost}>
          <Text style={styles.modernButtonText}>Add Post</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => item._id}
          refreshing={loading}
          onRefresh={fetchPosts}
          renderItem={({item}) => (
            <View style={styles.postContainer}>
              {/* Post header row with text and trash/edit icons */}
              <View style={styles.postHeaderRow}>
                {editingPostId === item._id ? (
                  <>
                    <TextInput
                      style={styles.editInput}
                      value={editingPostText}
                      onChangeText={setEditingPostText}
                      autoFocus
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
                  </>
                ) : (
                  <>
                    <Text style={styles.postText}>{item.text}</Text>
                    {userData && item.userId === userData._id ? (
                      <View style={styles.rowCenter}>
                        <TouchableOpacity
                          style={styles.postEditIcon}
                          onPress={() => startEditPost(item)}>
                          <FontAwesomeIcon
                            icon={faEdit}
                            size={20}
                            color={colors.primary}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.postTrashIcon}
                          onPress={() => deletePost(item._id)}>
                          <FontAwesomeIcon
                            icon={faTrash}
                            size={22}
                            color={colors.text}
                          />
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </>
                )}
              </View>

              {/* Add Comment Input Row */}
              <View style={styles.commentInputRow}>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Add a comment"
                  placeholderTextColor={colors.border}
                  value={commentText[item._id] || ''}
                  onChangeText={text =>
                    setCommentText(prev => ({...prev, [item._id]: text}))
                  }
                />
                <TouchableOpacity
                  style={styles.modernButton}
                  onPress={() => addComment(item._id)}>
                  <Text style={styles.modernButtonText}>Add Comment</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={item.comments}
                keyExtractor={comment => comment._id || comment.text}
                renderItem={({item: comment}) => (
                  <View style={styles.commentContainer}>
                    <View style={styles.commentHeaderRow}>
                      <Text style={styles.commentUsername}>
                        {comment.username}
                      </Text>
                      <View style={styles.rowCenter}>
                        <TouchableOpacity
                          style={styles.replyButton}
                          onPress={() => setReplyingTo(comment._id!)}>
                          <FontAwesomeIcon
                            icon={faReply}
                            size={14}
                            color={colors.primary}
                          />
                          <Text style={styles.replyButtonText}>Reply</Text>
                        </TouchableOpacity>
                        {userData &&
                        comment.userId === userData._id &&
                        comment._id ? (
                          <>
                            <TouchableOpacity
                              style={styles.commentEditIcon}
                              onPress={() => startEditComment(comment)}>
                              <FontAwesomeIcon
                                icon={faEdit}
                                size={16}
                                color={colors.primary}
                              />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.commentTrashIcon}
                              onPress={() =>
                                deleteComment(item._id, comment._id!)
                              }>
                              <FontAwesomeIcon
                                icon={faTrash}
                                size={16}
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
                            size={16}
                            color={colors.primary}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.editActionIcon}
                          onPress={cancelEditComment}>
                          <FontAwesomeIcon
                            icon={faTimes}
                            size={16}
                            color={colors.text}
                          />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <Text style={styles.commentText}>{comment.text}</Text>
                    )}

                    {/* Reply input */}
                    {replyingTo === comment._id ? (
                      <View style={styles.replyInputRow}>
                        <TextInput
                          ref={ref => {
                            if (ref) {
                              replyInputRefs.current[comment._id!] = ref;
                            }
                          }}
                          style={styles.replyInput}
                          placeholder="Write a reply..."
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
                          style={styles.modernButton}
                          onPress={() => {
                            addReply(item._id, comment._id!);
                            setReplyingTo(null);
                          }}>
                          <Text style={styles.modernButtonText}>Reply</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}

                    {/* Replies */}
                    {comment.replies && comment.replies.length > 0 ? (
                      <FlatList
                        data={comment.replies}
                        keyExtractor={reply => reply._id || reply.text}
                        renderItem={({item: reply}) => (
                          <View style={styles.replyContainer}>
                            <View style={styles.replyHeaderRow}>
                              <Text style={styles.replyUsername}>
                                {reply.username}
                              </Text>
                              {userData &&
                              reply.userId === userData._id &&
                              reply._id ? (
                                <View style={styles.rowCenter}>
                                  <TouchableOpacity
                                    style={styles.replyEditIcon}
                                    onPress={() =>
                                      startEditReply(
                                        item._id,
                                        comment._id!,
                                        reply,
                                      )
                                    }>
                                    <FontAwesomeIcon
                                      icon={faEdit}
                                      size={14}
                                      color={colors.primary}
                                    />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    style={styles.replyTrashIcon}
                                    onPress={() =>
                                      deleteReply(
                                        item._id,
                                        comment._id!,
                                        reply._id!,
                                      )
                                    }>
                                    <FontAwesomeIcon
                                      icon={faTrash}
                                      size={14}
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
                                    size={14}
                                    color={colors.primary}
                                  />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.editActionIcon}
                                  onPress={cancelEditReply}>
                                  <FontAwesomeIcon
                                    icon={faTimes}
                                    size={14}
                                    color={colors.text}
                                  />
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <Text style={styles.replyText}>{reply.text}</Text>
                            )}
                          </View>
                        )}
                      />
                    ) : null}
                  </View>
                )}
              />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
};

export default CommunityNotes;
