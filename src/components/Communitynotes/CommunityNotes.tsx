import React, {useState, useContext, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import HamburgerMenu from '../HamburgerMenu/HamburgerMenu';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {faTrash} from '@fortawesome/free-solid-svg-icons';
import UserContext, {UserContextType} from '../UserContext';
import axios from 'axios';

// Update interfaces to match MongoDB (_id)
interface Comment {
  _id?: string;
  text: string;
  username: string;
  userId: string;
}

interface Post {
  _id: string;
  text: string;
  userId: string;
  username: string;
  comments: Comment[];
}

const API_BASE_URL = 'http://localhost:8001';

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#02131D',
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 25,
    color: '#fff',
    textAlign: 'center',
    flex: 1,
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: -1,
  },
  postContainer: {
    marginVertical: 10,
    padding: 20,
    backgroundColor: '#333',
    position: 'relative',
  },
  postText: {
    fontSize: 18,
    marginBottom: 5,
    color: '#fff',
  },
  commentInput: {
    height: 30,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 5,
    padding: 5,
    color: '#fff',
  },
  commentContainer: {
    marginLeft: 10,
    marginTop: 16,
    marginBottom: 16,
    padding: 10,
    backgroundColor: '#222',
    borderRadius: 8,
  },
  commentUsername: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'left',
  },
  commentText: {
    color: '#fff',
  },
  trashIcon: {
    position: 'absolute',
    bottom: 7,
    right: 10,
  },
  addPostButton: {
    backgroundColor: '#b11313',
    padding: 10,
    borderRadius: 20,
    marginTop: 16,
    width: '40%',
    alignSelf: 'center',
  },
  addPostButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

const CommunityNotes: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostText, setNewPostText] = useState<string>('');
  const [commentText, setCommentText] = useState<{[key: string]: string}>({});
  const [loading, setLoading] = useState<boolean>(false);

  const {userData} = useContext(UserContext) as UserContextType;

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <HamburgerMenu />
        <Text style={styles.title}>Community Notes</Text>
      </View>

      <TextInput
        style={styles.commentInput}
        placeholder="Enter your post"
        placeholderTextColor="#aaa"
        value={newPostText}
        onChangeText={text => setNewPostText(text)}
      />
      <TouchableOpacity style={styles.addPostButton} onPress={addPost}>
        <Text style={styles.addPostButtonText}>Add Post</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator size="large" color="#fff" />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => item._id}
          refreshing={loading}
          onRefresh={fetchPosts}
          renderItem={({item}) => (
            <View style={styles.postContainer}>
              <Text style={styles.postText}>{item.text}</Text>

              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment"
                placeholderTextColor="#aaa"
                value={commentText[item._id] || ''}
                onChangeText={text =>
                  setCommentText(prev => ({...prev, [item._id]: text}))
                }
              />
              <Button
                title="Add Comment"
                onPress={() => addComment(item._id)}
              />

              <FlatList
                data={item.comments}
                keyExtractor={comment => comment._id || comment.text}
                renderItem={({item: comment}) => (
                  <View style={styles.commentContainer}>
                    <Text style={styles.commentUsername}>
                      {comment.username}
                    </Text>
                    <Text style={styles.commentText}>{comment.text}</Text>
                    {userData &&
                      comment.userId === userData._id &&
                      comment._id && (
                        <TouchableOpacity
                          style={[styles.trashIcon]}
                          onPress={() => deleteComment(item._id, comment._id!)}>
                          <FontAwesomeIcon
                            icon={faTrash}
                            size={18}
                            color="#fff"
                          />
                        </TouchableOpacity>
                      )}
                  </View>
                )}
              />

              {userData && item.userId === userData._id && (
                <TouchableOpacity
                  style={styles.trashIcon}
                  onPress={() => deletePost(item._id)}>
                  <FontAwesomeIcon icon={faTrash} size={24} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
};

export default CommunityNotes;
