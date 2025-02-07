import React, {useContext, useEffect, useState} from 'react';
import {View, Text, StyleSheet, Image, TouchableOpacity} from 'react-native';
import * as ImagePicker from 'react-native-image-picker';
import {ImagePickerResponse} from 'react-native-image-picker';
import UserContext, {UserContextType} from '../UserContext';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRoute, RouteProp} from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import HamburgerMenu from '../HamburgerMenu/HamburgerMenu';

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
    backgroundColor: '#02131D',
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
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: 'red',
    backgroundColor: '#D3D3D3',
    padding: 10,
    textAlign: 'center',
    overflow: 'hidden',
    borderRadius: 10,
    width: '50%',
    alignSelf: 'center',
  },
  emailText: {
    fontSize: 20,
    marginBottom: 16,
    color: 'red',
    backgroundColor: '#D3D3D3',
    padding: 10,
    textAlign: 'center',
    overflow: 'hidden',
    borderRadius: 10,
    width: '75%',
    alignSelf: 'center',
  },
  changePhotoButton: {
    backgroundColor: '#b11313',
    padding: 8,
    borderRadius: 20,
    marginTop: 16,
    width: '35%',
    alignSelf: 'center',
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
  },
});

const Profile: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const route = useRoute<ProfileScreenRouteProp>();
  const {_id} = route.params;

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

  const handleChoosePhoto = () => {
    const options: ImagePicker.ImageLibraryOptions = {
      mediaType: 'photo',
      includeBase64: true,
    };

    ImagePicker.launchImageLibrary(options, (response: ImagePickerResponse) => {
      if (response.assets) {
        const firstAsset = response.assets[0];
        if (firstAsset && firstAsset.base64) {
          uploadImageToLambda(firstAsset.base64, firstAsset.fileName);
        }
      }
    });
  };

  const handleTakePhoto = () => {
    const options: ImagePicker.CameraOptions = {
      mediaType: 'photo',
      includeBase64: true,
    };

    ImagePicker.launchCamera(options, (response: ImagePickerResponse) => {
      if (response.assets) {
        const firstAsset = response.assets[0];
        if (firstAsset && firstAsset.base64) {
          uploadImageToLambda(firstAsset.base64, firstAsset.fileName);
        }
      }
    });
  };

  const uploadImageToLambda = async (base64Image: string, fileName: string) => {
    try {
      const lambdaResponse = await axios.post(
        'https://8nxzl6o6fd.execute-api.us-east-2.amazonaws.com/default/uploadImageFunction',
        {
          image: base64Image,
          fileName: fileName,
        },
      );

      const imageUrl = lambdaResponse.data.url;
      setSelectedImage(imageUrl);
      updateUserProfilePic(imageUrl);
    } catch (error) {
      console.error('Error uploading image to Lambda:', error);
    }
  };

  const updateUserProfilePic = (imageUrl: string) => {
    axios
      .put('https://omhl-be-9801a7de15ab.herokuapp.com/user/profile-pic', {
        userId: _id,
        profilePicUrl: imageUrl,
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header container for hamburger and centered title */}
      <View style={styles.header}>
        <HamburgerMenu />
        <Text style={styles.title}>Profile</Text>
      </View>

      {selectedImage ? (
        <Image source={{uri: selectedImage}} style={styles.avatar} />
      ) : null}

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
    </SafeAreaView>
  );
};

export default Profile;
