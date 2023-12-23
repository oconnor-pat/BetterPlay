import React from 'react';
import {View, Text, StyleSheet, Image} from 'react-native';
//import {useRoute} from '@react-navigation/native';

// Mock user data for testing
const userData = {
  name: 'John Doe',
  avatarUrl: 'https://example.com/avatar.jpg', // Replace with the actual URL of the user's avatar
  skillRating: 4, // Assuming a rating out of 5
};

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
  },
  starIcon: {
    width: 20,
    height: 20,
    marginRight: 4,
  },
});

// TODO: Make sure to set up functionality so that my viewprofile button can target the user's ID in the database when navigating to the profile page.

const Profile = () => {
  // Convert the skillRating to an array of stars
  const stars = Array.from(
    {length: userData.skillRating},
    (_, index) => index + 1,
  );

  // Get the route object
  //const route = useRoute();

  // Extract the userId from route params
  //const {userId} = route.params as {userId: string};

  return (
    <View style={styles.container}>
      {/* Avatar */}
      <Image source={{uri: userData.avatarUrl}} style={styles.avatar} />

      {/* User Name */}
      <Text style={styles.userName}>{userData.name}</Text>

      {/* Try Hard Rating */}
      <View style={styles.ratingContainer}>
        {stars.map(star => (
          <Image
            key={star}
            // source={require('./star-icon.png')}
            style={styles.starIcon}
          />
        ))}
      </View>
    </View>
  );
};

export default Profile;
