import React, {useContext, useEffect, useState, useMemo} from 'react';
import {View, Text, StyleSheet, Image, TouchableOpacity} from 'react-native';
import * as ImagePicker from 'react-native-image-picker';
import {ImagePickerResponse} from 'react-native-image-picker';
import UserContext, {UserContextType} from '../UserContext';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRoute, RouteProp} from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import HamburgerMenu from '../HamburgerMenu/HamburgerMenu';
import {useTheme} from '../ThemeContext/ThemeContext';

// Types
type ProfileScreenRouteProp = RouteProp<
  {Profile: {_id: string; username: string; email: string}},
  'Profile'
>;

const Profile: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const route = useRoute<ProfileScreenRouteProp>();
  const {_id} = route.params;

  const {userData, setUserData} = useContext(UserContext) as UserContextType;
  const {colors} = useTheme();

  // Themed styles
  const themedStyles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          padding: 16,
          backgroundColor: colors.background,
        },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        },
        title: {
          fontSize: 25,
          color: colors.primary,
          textAlign: 'center',
          flex: 1,
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          zIndex: -1,
        },
        profileRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 24,
          marginTop: 8,
        },
        avatar: {
          width: 90,
          height: 90,
          borderRadius: 45,
          marginRight: 18,
          backgroundColor: colors.card,
        },
        userInfo: {
          flex: 1,
          justifyContent: 'center',
          backgroundColor: 'transparent',
          paddingVertical: 0,
          paddingHorizontal: 0,
        },
        userName: {
          fontSize: 22,
          fontWeight: '600',
          color: colors.text,
          marginBottom: 2,
          textAlign: 'left',
          letterSpacing: 0.2,
          backgroundColor: 'transparent',
        },
        emailText: {
          fontSize: 16,
          color: colors.text,
          opacity: 0.7,
          textAlign: 'left',
          letterSpacing: 0.1,
          backgroundColor: 'transparent',
        },
        modernButton: {
          backgroundColor: colors.card,
          paddingVertical: 10,
          paddingHorizontal: 24,
          borderRadius: 8,
          marginTop: 0,
          marginHorizontal: 6,
          borderWidth: 1,
          borderColor: colors.border,
          elevation: 0,
        },
        buttonText: {
          color: colors.primary,
          textAlign: 'center',
          fontSize: 16,
          fontWeight: '500',
          letterSpacing: 0.2,
        },
        buttonRow: {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: 8,
        },
      }),
    [colors],
  );

  useEffect(() => {
    const fetchUserData = async () => {
      if (!_id) {
        console.log('Invalid user ID');
        return;
      }

      try {
        const token = await AsyncStorage.getItem('token');
        const response = await fetch(
          `https://omhl-be-9801a7de15ab.herokuapp.com/user/${_id}`,
          {
            headers: {
              Authorization: token ? `Bearer ${token}` : '',
              'Content-Type': 'application/json',
            },
          },
        );
        const text = await response.text();
        if (!response.ok) {
          console.error(`Fetch failed with status ${response.status}:`, text);
          throw new Error(`Fetch failed with status ${response.status}`);
        }
        let data;
        try {
          data = JSON.parse(text);
        } catch (jsonError) {
          console.error('Failed to parse JSON. Response text:', text);
          throw jsonError;
        }

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

  const updateUserProfilePic = async (imageUrl: string) => {
    try {
      const token = await AsyncStorage.getItem('token');
      await axios.put(
        'https://omhl-be-9801a7de15ab.herokuapp.com/user/profile-pic',
        {
          userId: _id,
          profilePicUrl: imageUrl,
        },
        {
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json',
          },
        },
      );
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
    } catch (error) {
      console.error('Error updating user data: ', error);
    }
  };

  return (
    <SafeAreaView style={themedStyles.container}>
      {/* Header container for hamburger and centered title */}
      <View style={themedStyles.header}>
        <HamburgerMenu />
        <Text style={themedStyles.title}>Profile</Text>
      </View>

      {/* Profile info row */}
      <View style={themedStyles.profileRow}>
        {selectedImage ? (
          <Image source={{uri: selectedImage}} style={themedStyles.avatar} />
        ) : (
          <View style={themedStyles.avatar} />
        )}
        <View style={themedStyles.userInfo}>
          <Text style={themedStyles.userName}>{userData?.username}</Text>
          <Text style={themedStyles.emailText}>{userData?.email}</Text>
        </View>
      </View>

      {/* Modern button row, now centered */}
      <View style={themedStyles.buttonRow}>
        <TouchableOpacity
          style={themedStyles.modernButton}
          onPress={handleChoosePhoto}>
          <Text style={themedStyles.buttonText}>Select Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={themedStyles.modernButton}
          onPress={handleTakePhoto}>
          <Text style={themedStyles.buttonText}>Take Photo</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default Profile;
