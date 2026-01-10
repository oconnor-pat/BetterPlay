import React, {
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'react-native-image-picker';
import {ImagePickerResponse} from 'react-native-image-picker';
import UserContext, {UserContextType} from '../UserContext';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRoute, RouteProp} from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import HamburgerMenu from '../HamburgerMenu/HamburgerMenu';
import {useTheme} from '../ThemeContext/ThemeContext';
import {API_BASE_URL} from '../../config/api';
import {useEventContext} from '../../Context/EventContext';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faCalendarCheck,
  faCalendarPlus,
  faMoon,
  faSun,
  faCamera,
  faImage,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import {useTranslation} from 'react-i18next';

// Types
type ProfileScreenRouteProp = RouteProp<
  {Profile: {_id: string; username: string; email: string}},
  'Profile'
>;

const Profile: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const route = useRoute<ProfileScreenRouteProp>();
  const {_id} = route.params;

  const {userData, setUserData} = useContext(UserContext) as UserContextType;
  const {colors, darkMode, themeMode} = useTheme();
  const {events} = useEventContext();
  const {t} = useTranslation();

  // Calculate user stats
  const userStats = useMemo(() => {
    const eventsCreated = events.filter(e => e.createdBy === _id).length;
    const eventsJoined = events.filter(e => e.rosterSpotsFilled > 0).length;
    return {eventsCreated, eventsJoined};
  }, [events, _id]);

  // Themed styles
  const themedStyles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: colors.background,
        },
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        scrollContent: {
          padding: 16,
          paddingBottom: 32,
        },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          paddingHorizontal: 16,
          paddingTop: 8,
          backgroundColor: colors.background,
          zIndex: 1,
        },
        title: {
          fontSize: 25,
          fontWeight: '700',
          color: colors.primary,
          textAlign: 'center',
          flex: 1,
          position: 'absolute',
          left: 0,
          right: 0,
          top: 8,
          zIndex: -1,
        },
        // Profile Card
        profileCard: {
          backgroundColor: colors.card,
          borderRadius: 20,
          padding: 24,
          marginBottom: 16,
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 2},
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 3,
        },
        profileRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 20,
        },
        avatarContainer: {
          position: 'relative',
        },
        avatar: {
          width: 90,
          height: 90,
          borderRadius: 45,
          backgroundColor: colors.border,
        },
        avatarPlaceholder: {
          width: 90,
          height: 90,
          borderRadius: 45,
          backgroundColor: colors.primary + '20',
          alignItems: 'center',
          justifyContent: 'center',
        },
        avatarInitials: {
          fontSize: 32,
          fontWeight: '700',
          color: colors.primary,
        },
        userInfo: {
          flex: 1,
          marginLeft: 18,
        },
        userName: {
          fontSize: 24,
          fontWeight: '700',
          color: colors.text,
          marginBottom: 4,
        },
        emailText: {
          fontSize: 15,
          color: colors.placeholder,
        },
        photoButtonsRow: {
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 12,
        },
        photoButton: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.background,
          paddingVertical: 10,
          paddingHorizontal: 16,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
        },
        photoButtonText: {
          color: colors.primary,
          fontSize: 14,
          fontWeight: '600',
          marginLeft: 8,
        },
        // Stats Section
        statsCard: {
          backgroundColor: colors.card,
          borderRadius: 20,
          padding: 20,
          marginBottom: 16,
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 2},
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 3,
        },
        sectionTitle: {
          fontSize: 18,
          fontWeight: '700',
          color: colors.text,
          marginBottom: 16,
        },
        statsRow: {
          flexDirection: 'row',
          justifyContent: 'space-around',
        },
        statItem: {
          alignItems: 'center',
          flex: 1,
        },
        statIconContainer: {
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 10,
        },
        statValue: {
          fontSize: 28,
          fontWeight: '700',
          color: colors.text,
        },
        statLabel: {
          fontSize: 13,
          color: colors.placeholder,
          marginTop: 4,
        },
        // Quick Settings
        settingsCard: {
          backgroundColor: colors.card,
          borderRadius: 20,
          padding: 20,
          marginBottom: 16,
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 2},
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 3,
        },
        settingRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        settingRowLast: {
          borderBottomWidth: 0,
        },
        settingLeft: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        settingIconContainer: {
          width: 40,
          height: 40,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 14,
        },
        settingText: {
          fontSize: 16,
          fontWeight: '500',
          color: colors.text,
        },
        settingSubtext: {
          fontSize: 13,
          color: colors.placeholder,
          marginTop: 2,
        },
        settingSubtextRight: {
          fontSize: 13,
          color: colors.placeholder,
          marginTop: 2,
          marginLeft: 'auto',
        },
        // Achievements Preview
        achievementsCard: {
          backgroundColor: colors.card,
          borderRadius: 20,
          padding: 20,
          marginBottom: 16,
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 2},
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 3,
        },
        achievementsRow: {
          flexDirection: 'row',
          justifyContent: 'space-around',
          marginTop: 8,
        },
        achievementBadge: {
          alignItems: 'center',
          opacity: 0.4,
        },
        achievementBadgeEarned: {
          opacity: 1,
        },
        achievementEmoji: {
          fontSize: 24,
        },
        achievementIcon: {
          width: 50,
          height: 50,
          borderRadius: 25,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
        },
        achievementName: {
          fontSize: 12,
          color: colors.text,
          fontWeight: '500',
        },
        // Member Since
        memberSince: {
          textAlign: 'center',
          fontSize: 13,
          color: colors.placeholder,
          marginTop: 8,
        },
      }),
    [colors],
  );

  const fetchUserData = useCallback(async () => {
    if (!_id) {
      console.log('Invalid user ID');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${API_BASE_URL}/user/${_id}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
      });
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
  }, [_id, setUserData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUserData();
    setRefreshing(false);
  }, [fetchUserData]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const handleChoosePhoto = () => {
    const options: ImagePicker.ImageLibraryOptions = {
      mediaType: 'photo',
      includeBase64: true,
      maxWidth: 800,
      maxHeight: 800,
      quality: 0.7,
    };

    ImagePicker.launchImageLibrary(options, (response: ImagePickerResponse) => {
      if (response.assets) {
        const firstAsset = response.assets[0];
        if (firstAsset && firstAsset.base64) {
          uploadImageToLambda(
            firstAsset.base64,
            firstAsset.fileName || 'photo.jpg',
          );
        }
      }
    });
  };

  const handleTakePhoto = () => {
    const options: ImagePicker.CameraOptions = {
      mediaType: 'photo',
      includeBase64: true,
      maxWidth: 800,
      maxHeight: 800,
      quality: 0.7,
    };

    ImagePicker.launchCamera(options, (response: ImagePickerResponse) => {
      if (response.assets) {
        const firstAsset = response.assets[0];
        if (firstAsset && firstAsset.base64) {
          uploadImageToLambda(
            firstAsset.base64,
            firstAsset.fileName || 'photo.jpg',
          );
        }
      }
    });
  };

  const uploadImageToLambda = async (
    base64Image: string,
    fileName: string | undefined,
  ) => {
    setUploadingImage(true);
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
      await updateUserProfilePic(imageUrl);
    } catch (error: any) {
      console.error('Error uploading image to Lambda:', error);
      if (error?.response?.status === 413) {
        Alert.alert(
          t('profile.imageTooLarge'),
          t('profile.imageTooLargeMessage'),
        );
      } else {
        Alert.alert(
          t('profile.uploadFailed'),
          t('profile.uploadFailedMessage'),
        );
      }
    } finally {
      setUploadingImage(false);
    }
  };

  const updateUserProfilePic = async (imageUrl: string) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
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

  const getInitials = (name: string | undefined) => {
    if (!name) {
      return '?';
    }
    return name
      .split(' ')
      .map(part => part[0]?.toUpperCase())
      .join('')
      .slice(0, 2);
  };

  return (
    <SafeAreaView style={themedStyles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={themedStyles.header}>
        <HamburgerMenu />
        <Text style={themedStyles.title}>{t('profile.title')}</Text>
      </View>

      <ScrollView
        style={themedStyles.container}
        contentContainerStyle={themedStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }>
        {/* Profile Card */}
        <View style={themedStyles.profileCard}>
          <View style={themedStyles.profileRow}>
            <View style={themedStyles.avatarContainer}>
              {selectedImage ? (
                <Image
                  source={{uri: selectedImage}}
                  style={themedStyles.avatar}
                />
              ) : (
                <View style={themedStyles.avatarPlaceholder}>
                  <Text style={themedStyles.avatarInitials}>
                    {getInitials(userData?.username)}
                  </Text>
                </View>
              )}
            </View>
            <View style={themedStyles.userInfo}>
              <Text style={themedStyles.userName}>{userData?.username}</Text>
              <Text style={themedStyles.emailText}>{userData?.email}</Text>
            </View>
          </View>

          {/* Photo Buttons */}
          {uploadingImage ? (
            <View style={themedStyles.photoButtonsRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={themedStyles.photoButtonText}>
                {t('common.loading') || 'Uploading...'}
              </Text>
            </View>
          ) : (
            <View style={themedStyles.photoButtonsRow}>
              <TouchableOpacity
                style={themedStyles.photoButton}
                onPress={handleChoosePhoto}>
                <FontAwesomeIcon
                  icon={faImage}
                  size={16}
                  color={colors.primary}
                />
                <Text style={themedStyles.photoButtonText}>
                  {t('profile.gallery')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={themedStyles.photoButton}
                onPress={handleTakePhoto}>
                <FontAwesomeIcon
                  icon={faCamera}
                  size={16}
                  color={colors.primary}
                />
                <Text style={themedStyles.photoButtonText}>
                  {t('profile.camera')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Stats Card */}
        <View style={themedStyles.statsCard}>
          <Text style={themedStyles.sectionTitle}>
            📊 {t('profile.yourActivity')}
          </Text>
          <View style={themedStyles.statsRow}>
            <View style={themedStyles.statItem}>
              <View
                style={[
                  themedStyles.statIconContainer,
                  {backgroundColor: colors.primary + '20'},
                ]}>
                <FontAwesomeIcon
                  icon={faCalendarPlus}
                  size={24}
                  color={colors.primary}
                />
              </View>
              <Text style={themedStyles.statValue}>
                {userStats.eventsCreated}
              </Text>
              <Text style={themedStyles.statLabel}>
                {t('profile.eventsCreated')}
              </Text>
            </View>
            <View style={themedStyles.statItem}>
              <View
                style={[
                  themedStyles.statIconContainer,
                  {backgroundColor: '#4CAF50' + '20'},
                ]}>
                <FontAwesomeIcon
                  icon={faCalendarCheck}
                  size={24}
                  color="#4CAF50"
                />
              </View>
              <Text style={themedStyles.statValue}>
                {userStats.eventsJoined}
              </Text>
              <Text style={themedStyles.statLabel}>
                {t('profile.eventsJoined')}
              </Text>
            </View>
            <View style={themedStyles.statItem}>
              <View
                style={[
                  themedStyles.statIconContainer,
                  {backgroundColor: '#FF9800' + '20'},
                ]}>
                <FontAwesomeIcon icon={faUsers} size={24} color="#FF9800" />
              </View>
              <Text style={themedStyles.statValue}>{events.length}</Text>
              <Text style={themedStyles.statLabel}>
                {t('profile.totalEvents')}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Settings Card */}
        <View style={themedStyles.settingsCard}>
          <Text style={themedStyles.sectionTitle}>
            ⚙️ {t('profile.quickSettings')}
          </Text>
          <View style={[themedStyles.settingRow, themedStyles.settingRowLast]}>
            <View style={themedStyles.settingLeft}>
              <View
                style={[
                  themedStyles.settingIconContainer,
                  {
                    backgroundColor: darkMode
                      ? '#5C6BC0' + '20'
                      : '#FFC107' + '20',
                  },
                ]}>
                <FontAwesomeIcon
                  icon={darkMode ? faMoon : faSun}
                  size={18}
                  color={darkMode ? '#5C6BC0' : '#FFC107'}
                />
              </View>
              <View>
                <Text style={themedStyles.settingText}>
                  {t('profile.darkMode')}
                </Text>
                <Text style={themedStyles.settingSubtext}>
                  {darkMode
                    ? t('profile.currentlyOn')
                    : t('profile.currentlyOff')}
                </Text>
              </View>
            </View>
            <Text style={themedStyles.settingSubtextRight}>
              {themeMode === 'system'
                ? t('settings.system')
                : themeMode === 'dark'
                ? t('settings.dark')
                : t('settings.light')}
            </Text>
          </View>
        </View>

        {/* Achievements Preview Card */}
        <View style={themedStyles.achievementsCard}>
          <Text style={themedStyles.sectionTitle}>
            🏆 {t('profile.achievements')}
          </Text>
          <View style={themedStyles.achievementsRow}>
            <View
              style={[
                themedStyles.achievementBadge,
                userStats.eventsCreated >= 1 &&
                  themedStyles.achievementBadgeEarned,
              ]}>
              <View
                style={[
                  themedStyles.achievementIcon,
                  {backgroundColor: '#FFD700' + '30'},
                ]}>
                <Text style={themedStyles.achievementEmoji}>🎯</Text>
              </View>
              <Text style={themedStyles.achievementName}>
                {t('profile.firstEvent')}
              </Text>
            </View>
            <View
              style={[
                themedStyles.achievementBadge,
                userStats.eventsCreated >= 5 &&
                  themedStyles.achievementBadgeEarned,
              ]}>
              <View
                style={[
                  themedStyles.achievementIcon,
                  {backgroundColor: '#C0C0C0' + '30'},
                ]}>
                <Text style={themedStyles.achievementEmoji}>⭐</Text>
              </View>
              <Text style={themedStyles.achievementName}>
                {t('profile.fiveEvents')}
              </Text>
            </View>
            <View
              style={[
                themedStyles.achievementBadge,
                userStats.eventsCreated >= 10 &&
                  themedStyles.achievementBadgeEarned,
              ]}>
              <View
                style={[
                  themedStyles.achievementIcon,
                  {backgroundColor: '#CD7F32' + '30'},
                ]}>
                <Text style={themedStyles.achievementEmoji}>🏅</Text>
              </View>
              <Text style={themedStyles.achievementName}>
                {t('profile.tenEvents')}
              </Text>
            </View>
            <View
              style={[
                themedStyles.achievementBadge,
                userStats.eventsJoined >= 10 &&
                  themedStyles.achievementBadgeEarned,
              ]}>
              <View
                style={[
                  themedStyles.achievementIcon,
                  {backgroundColor: colors.primary + '30'},
                ]}>
                <Text style={themedStyles.achievementEmoji}>🤝</Text>
              </View>
              <Text style={themedStyles.achievementName}>
                {t('profile.teamPlayer')}
              </Text>
            </View>
          </View>
        </View>

        {/* Member Since */}
        <Text style={themedStyles.memberSince}>
          {t('profile.memberSince')} {new Date().getFullYear()}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Profile;
