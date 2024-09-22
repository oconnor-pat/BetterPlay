import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  StyleSheet,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

interface Comment {
  text: string;
}

interface Post {
  id: number;
  text: string;
  comments: Comment[];
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#02131D',
    flex: 1,
  },
  title: {
    fontSize: 25,
    marginBottom: 20,
    color: '#fff',
    textAlign: 'center',
  },
  postContainer: {
    marginVertical: 10,
    padding: 20,
    backgroundColor: '#333',
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
  },
  commentText: {
    color: '#fff',
  },
});

const CommunityNotes: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostText, setNewPostText] = useState<string>('');
  const [commentText, setCommentText] = useState<{[key: number]: string}>({});

  const addPost = () => {
    if (newPostText.trim() !== '') {
      setPosts([...posts, {id: Date.now(), text: newPostText, comments: []}]);
      setNewPostText('');
    }
  };

  const addComment = (postId: number) => {
    const text = commentText[postId]?.trim();
    if (text) {
      setPosts(prevPosts =>
        prevPosts.map(post =>
          post.id === postId
            ? {...post, comments: [...post.comments, {text}]}
            : post,
        ),
      );
      setCommentText(prev => ({...prev, [postId]: ''}));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Community Notes</Text>

      <TextInput
        style={styles.commentInput}
        placeholder="Enter your post"
        placeholderTextColor="#aaa"
        value={newPostText}
        onChangeText={text => setNewPostText(text)}
      />
      <Button title="Add Post" onPress={addPost} />

      <FlatList
        data={posts}
        keyExtractor={item => item.id.toString()}
        renderItem={({item}) => (
          <View style={styles.postContainer}>
            <Text style={styles.postText}>{item.text}</Text>

            <TextInput
              style={styles.commentInput}
              placeholder="Add a comment"
              placeholderTextColor="#aaa"
              value={commentText[item.id] || ''}
              onChangeText={text =>
                setCommentText(prev => ({...prev, [item.id]: text}))
              }
            />
            <Button title="Add Comment" onPress={() => addComment(item.id)} />

            <FlatList
              data={item.comments}
              keyExtractor={(_, index) => index.toString()}
              renderItem={({item: comment}) => (
                <View style={styles.commentContainer}>
                  <Text style={styles.commentText}>{comment.text}</Text>
                </View>
              )}
            />
          </View>
        )}
      />
    </SafeAreaView>
  );
};

export default CommunityNotes;
