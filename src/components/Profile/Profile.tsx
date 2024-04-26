import React, {useContext, useEffect, useState} from 'react';
import {View, Text, StyleSheet, Image, TouchableOpacity} from 'react-native';
import * as ImagePicker from 'react-native-image-picker';
import {ImagePickerResponse} from 'react-native-image-picker';
import UserContext, {UserContextType} from '../UserContext';
import {SafeAreaView} from 'react-native-safe-area-context';
import CustomHeader from '../CustomHeader';
import {LandingPageParamList} from '../CustomHeader';
import {
  NavigationProp,
  useNavigation,
  useRoute,
  RouteProp,
} from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
type ProfileScreenRouteProp = RouteProp<
  {Profile: {_id: string; username: string; email: string}},
  'Profile'
>;

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#02131D',
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
    color: 'red',
    backgroundColor: '#fff',
    padding: 10,
  },
  emailText: {
    fontSize: 16,
    marginBottom: 16,
    color: 'red',
    backgroundColor: '#fff',
    padding: 10,
  },
  changePhotoButton: {
    backgroundColor: '#b11313',
    padding: 8,
    borderRadius: 5,
    marginTop: 16,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
  },
});

const Profile: React.FC<{}> = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Inside your Profile component
  const route = useRoute<ProfileScreenRouteProp>();
  const {_id} = route.params;

  // Access the user data from the context
  const {userData, setUserData} = useContext(UserContext) as UserContextType;
  console.log(userData);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!_id) {
        console.log('Invalid user ID');
        return;
      }

      console.log('Fetching user data for ID:', _id); // Log the user ID

      try {
        const response = await fetch(
          `https://omhl-be-9801a7de15ab.herokuapp.com/user/${_id}`,
        );
        const data = await response.json(); // Parse the JSON data

        console.log('Fetch response:', data); // Log the parsed data

        if (data.user) {
          setUserData(data.user);
          setSelectedImage(data.user.profilePicUrl);
        } else {
          console.log('User not found');
        }
      } catch (error) {
        console.error('Error during fetch:', error); // Log any errors during the fetch
      }
    };

    fetchUserData();
  }, [_id, setUserData, setSelectedImage]);

  // Navigation
  const LandingPageNavigation =
    useNavigation<NavigationProp<LandingPageParamList>>();

  // Function to update the user's profile picture
  const updateUserProfilePic = (imageUrl: string) => {
    axios
      .put(`https://omhl-be-9801a7de15ab.herokuapp.com/users/${_id}`, {
        profilePicUrl: imageUrl,
      })
      .then(response => {
        // The user's data has been updated
        console.log('User data updated: ', response.data);

        // Merge the server's response with the existing user data
        const updatedUserData = {
          ...userData,
          ...response.data,
          profilePicUrl: imageUrl,
        };

        // Update the user data in the context
        setUserData(updatedUserData);

        // Save the profile picture URL to AsyncStorage
        AsyncStorage.setItem('@profilePicUrl', imageUrl).catch(error => {
          console.log(
            'Error saving profile picture URL to AsyncStorage: ',
            error,
          );
        });
      })
      .catch(error => {
        console.log('Error updating user data: ', error);
      });
  };

  // Function to handle the image picker
  const handleChoosePhoto = () => {
    const options: ImagePicker.ImageLibraryOptions = {
      mediaType: 'photo',
    };
    ImagePicker.launchImageLibrary(options, (response: ImagePickerResponse) => {
      if (response.didCancel) {
        console.log('User cancelled image picker');
      } else if (response.errorMessage) {
        console.log('ImagePicker Error: ', response.errorMessage);
      } else if (response.assets) {
        const firstAsset = response.assets[0];
        if (firstAsset && firstAsset.uri) {
          setSelectedImage(firstAsset.uri);

          // Create a new FormData object
          let formData = new FormData();
          formData.append('image', {
            uri: firstAsset.uri,
            type: 'image/jpeg', // or 'image/png'
            name: 'userProfilePic.jpg', // or '.png'
          });

          // Upload the image
          axios
            .post(
              'https://omhl-be-9801a7de15ab.herokuapp.com/upload',
              formData,
              {
                headers: {
                  'Content-Type': 'multipart/form-data',
                },
              },
            )
            .then(uploadResponse => {
              // The image has been uploaded, and the server has returned a URL
              const imageUrl = uploadResponse.data.url;

              // Store the image URL in the state
              setSelectedImage(imageUrl);

              // Update the user's profile picture
              updateUserProfilePic(imageUrl);
            })
            .catch(error => {
              console.log('Error uploading image: ', error);
            });
        }
      }
    });
  };

  // Get the user profile picture URL from AsyncStorage
  useEffect(() => {
    // Get the profile picture URL from AsyncStorage
    const getProfilePictureUrl = async () => {
      try {
        const url = await AsyncStorage.getItem('@profilePicUrl');
        if (url !== null) {
          setSelectedImage(url);
        }
      } catch (error) {
        console.log(
          'Error getting profile picture URL from AsyncStorage: ',
          error,
        );
      }
    };

    getProfilePictureUrl();
  }, [_id]);

  // Function to handle taking a photo
  const handleTakePhoto = () => {
    const options: ImagePicker.CameraOptions = {
      mediaType: 'photo',
    };
    ImagePicker.launchCamera(options, (response: ImagePickerResponse) => {
      if (response.didCancel) {
        console.log('User cancelled image picker');
      } else if (response.errorMessage) {
        console.log('ImagePicker Error: ', response.errorMessage);
      } else if (response.assets) {
        const firstAsset = response.assets[0];
        if (firstAsset && firstAsset.uri) {
          setSelectedImage(firstAsset.uri);

          // New FormData object
          let formData = new FormData();
          formData.append('image', {
            uri: firstAsset.uri,
            type: 'image/jpeg',
            name: 'userProfilePic.jpg',
          });

          // Upload the image
          axios
            .post(
              'https://omhl-be-9801a7de15ab.herokuapp.com/upload',
              formData,
              {
                headers: {
                  'Content-Type': 'multipart/form-data',
                },
              },
            )
            .then(uploadResponse => {
              // The image has been uploaded, and the server has returned a URL
              const imageUrl = uploadResponse.data.url;

              // Store the image URL in the state
              setSelectedImage(imageUrl);

              // Update the user's profile picture
              updateUserProfilePic(imageUrl);
            })
            .catch(error => {
              console.log('Error uploading image: ', error);
            });
        }
      }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <CustomHeader navigation={LandingPageNavigation} />
      <View>
        {/* Avatar */}
        {selectedImage && (
          <Image source={{uri: selectedImage}} style={styles.avatar} />
        )}

        {/* User Name */}
        <Text style={styles.userName}>{userData?.username}</Text>

        {/* Email Address */}
        <Text style={styles.emailText}>{userData?.email}</Text>

        {/* Change Photo Button */}
        <TouchableOpacity
          style={styles.changePhotoButton}
          onPress={handleChoosePhoto}>
          <Text style={styles.buttonText}>Select Photo</Text>
        </TouchableOpacity>

        {/* Take Photo Button */}
        <TouchableOpacity
          style={styles.changePhotoButton}
          onPress={handleTakePhoto}>
          <Text style={styles.buttonText}>Take Photo</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default Profile;
