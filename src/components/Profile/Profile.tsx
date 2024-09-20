import React, {useContext, useEffect, useState} from 'react';
import {View, Text, StyleSheet, Image, TouchableOpacity} from 'react-native';
import * as ImagePicker from 'react-native-image-picker';
import {ImagePickerResponse} from 'react-native-image-picker';
import UserContext, {UserContextType} from '../UserContext';
import {SafeAreaView} from 'react-native-safe-area-context';
import CustomHeader from '../CustomHeader';
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

const Profile: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Get user ID from route params
  const route = useRoute<ProfileScreenRouteProp>();
  const {_id} = route.params;

  // Access the user data from the context
  const {userData, setUserData} = useContext(UserContext) as UserContextType;

  useEffect(() => {
    const fetchUserData = async () => {
      if (!_id) {
        console.log('Invalid user ID');
        return;
      }

      try {
        const response = await fetch(
          `https://omhl-be-9801a7de15ab.herokuapp.com/user/${_id}`,
        );
        const data = await response.json();

        if (data.user) {
          setUserData(data.user);
          setSelectedImage(data.user.profilePicUrl);
        } else {
          console.log('User not found');
        }
      } catch (error) {
        console.error('Error during fetch:', error);
      }
    };

    fetchUserData();
  }, [_id, setUserData]);

  // Navigation
  const LandingPageNavigation = useNavigation<NavigationProp<any>>();

  // Function to update the user's profile picture in the backend
  const updateUserProfilePic = (imageUrl: string) => {
    axios
      .put('https://omhl-be-9801a7de15ab.herokuapp.com/user/profile-pic', {
        userId: _id,
        profilePicUrl: imageUrl, // S3 URL returned from Lambda
      })
      .then(() => {
        const updatedUserData = {
          ...userData,
          profilePicUrl: imageUrl,
        };
        setUserData(updatedUserData);
        AsyncStorage.setItem('@profilePicUrl', imageUrl).catch(error => {
          console.error(
            'Error saving profile picture URL to AsyncStorage: ',
            error,
          );
        });
      })
      .catch(error => {
        console.error('Error updating user data: ', error);
      });
  };

  // Function to handle the image picker and send base64 image
  const handleChoosePhoto = () => {
    const options: ImagePicker.ImageLibraryOptions = {
      mediaType: 'photo',
      includeBase64: true, // Includes base64 in the response
    };

    ImagePicker.launchImageLibrary(options, (response: ImagePickerResponse) => {
      if (response.assets) {
        const firstAsset = response.assets[0];
        if (firstAsset && firstAsset.base64) {
          uploadImageToLambda(firstAsset.base64, firstAsset.fileName); // base64 string and fileName
        }
      }
    });
  };

  // Function to handle the image upload to Lambda
  const uploadImageToLambda = async (base64Image: string, fileName: string) => {
    try {
      const lambdaResponse = await axios.post(
        'https://8nxzl6o6fd.execute-api.us-east-2.amazonaws.com/default/uploadImageFunction', // Lambda function URL
        {
          image: base64Image,
          fileName: fileName,
        },
      );

      const imageUrl = lambdaResponse.data.url; // S3 URL returned from Lambda
      setSelectedImage(imageUrl);
      updateUserProfilePic(imageUrl); // Saves the S3 URL in backend
    } catch (error) {
      console.error('Error uploading image to Lambda:', error);
    }
  };

  // Function to handle taking a photo
  const handleTakePhoto = () => {
    const options: ImagePicker.CameraOptions = {
      mediaType: 'photo',
      includeBase64: true, // Includes base64 in the response for camera as well
    };

    ImagePicker.launchCamera(options, (response: ImagePickerResponse) => {
      if (response.assets) {
        const firstAsset = response.assets[0];
        if (firstAsset && firstAsset.base64) {
          uploadImageToLambda(firstAsset.base64, firstAsset.fileName); // base64 string and fileName
        }
      }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <CustomHeader navigation={LandingPageNavigation} />
      <View>
        {selectedImage && (
          <Image source={{uri: selectedImage}} style={styles.avatar} />
        )}
        <Text style={styles.userName}>{userData?.username}</Text>
        <Text style={styles.emailText}>{userData?.email}</Text>
        <TouchableOpacity
          style={styles.changePhotoButton}
          onPress={handleChoosePhoto}>
          <Text style={styles.buttonText}>Select Photo</Text>
        </TouchableOpacity>
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
