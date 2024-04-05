import React, {useContext, useState} from 'react';
import {View, Text, StyleSheet, Image, TouchableOpacity} from 'react-native';
import * as ImagePicker from 'react-native-image-picker';
import {ImagePickerResponse} from 'react-native-image-picker';
import UserContext, {UserContextType} from '../UserContext';
import {SafeAreaView} from 'react-native-safe-area-context';
import CustomHeader from '../CustomHeader';
import {LandingPageParamList} from '../CustomHeader';
import {NavigationProp, useNavigation} from '@react-navigation/native';

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
  // Access the user data from the context
  const {userData} = useContext(UserContext) as UserContextType;
  console.log(userData);

  // State to manage the selected user image
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Navigation
  const LandingPageNavigation =
    useNavigation<NavigationProp<LandingPageParamList>>();

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
        }
      }
    });
  };

  // Function to handle the camera
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
