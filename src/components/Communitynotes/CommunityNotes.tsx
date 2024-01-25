// CommunityNotes.tsx

import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  StyleSheet,
} from 'react-native';

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
    fontSize: 24,
    marginBottom: 20,
    color: '#fff',
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
});

const CommunityNotes: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostText, setNewPostText] = useState<string>('');

  const addPost = () => {
    if (newPostText.trim() !== '') {
      setPosts([...posts, {id: Date.now(), text: newPostText, comments: []}]);
      setNewPostText('');
    }
  };

  const addComment = (postId: number, commentText: string) => {
    setPosts(prevPosts => {
      return prevPosts.map(post =>
        post.id === postId
          ? {...post, comments: [...post.comments, {text: commentText}]}
          : post,
      );
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Community Notes</Text>

      <TextInput
        style={styles.commentInput}
        placeholder="Enter your post"
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
              onChangeText={text => addComment(item.id, text)}
            />
            <FlatList
              data={item.comments}
              keyExtractor={comment => comment.text}
              renderItem={({item: comment}) => (
                <View style={styles.commentContainer}>
                  <Text>{comment.text}</Text>
                </View>
              )}
            />
          </View>
        )}
      />
    </View>
  );
};

export default CommunityNotes;
