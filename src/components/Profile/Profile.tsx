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
import {useRoute, RouteProp, useNavigation} from '@react-navigation/native';
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
  faCamera,
  faImage,
  faChevronRight,
  faCalendarDays,
  faGear,
  faRightFromBracket,
  faPlus,
  faUsers,
  faUserPlus,
  faUserClock,
  faBell,
} from '@fortawesome/free-solid-svg-icons';
import {useTranslation} from 'react-i18next';

// Types
type ProfileScreenRouteProp = RouteProp<
  {Profile: {_id: string; username: string; email: string}},
  'Profile'
>;

// Available sports for the favorite sports section
const SPORTS_OPTIONS = [
  {id: 'basketball', emoji: '🏀', label: 'Basketball'},
  {id: 'hockey', emoji: '🏒', label: 'Hockey'},
  {id: 'soccer', emoji: '⚽', label: 'Soccer'},
  {id: 'football', emoji: '🏈', label: 'Football'},
  {id: 'baseball', emoji: '⚾', label: 'Baseball'},
  {id: 'tennis', emoji: '🎾', label: 'Tennis'},
  {id: 'golf', emoji: '⛳', label: 'Golf'},
  {id: 'volleyball', emoji: '🏐', label: 'Volleyball'},
];

const Profile: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [favoriteSports, setFavoriteSports] = useState<string[]>([]);
  const [showSportsPicker, setShowSportsPicker] = useState(false);

  const route = useRoute<ProfileScreenRouteProp>();
  const navigation = useNavigation<any>();
  const {_id} = route.params;

  const {userData, setUserData} = useContext(UserContext) as UserContextType;
  const {colors} = useTheme();
  const {events} = useEventContext();
  const {t} = useTranslation();

  // Load favorite sports from backend on mount
  useEffect(() => {
    const loadFavoriteSports = async () => {
      if (!_id) {
        return;
      }
      try {
        const token = await AsyncStorage.getItem('userToken');
        const response = await fetch(
          `${API_BASE_URL}/user/${_id}/favorite-sports`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        if (response.ok) {
          const data = await response.json();
          setFavoriteSports(data.favoriteSports || ['hockey']);
        } else {
          setFavoriteSports(['hockey']);
        }
      } catch (error) {
        console.error('Error loading favorite sports:', error);
        setFavoriteSports(['hockey']);
      }
    };
    loadFavoriteSports();
  }, [_id]);

  // Save favorite sports to backend when they change
  const saveFavoriteSports = useCallback(
    async (sports: string[]) => {
      if (!_id) {
        return;
      }
      try {
        const token = await AsyncStorage.getItem('userToken');
        await fetch(`${API_BASE_URL}/user/${_id}/favorite-sports`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({favoriteSports: sports}),
        });
      } catch (error) {
        console.error('Error saving favorite sports:', error);
      }
    },
    [_id],
  );

  // Calculate user stats
  const userStats = useMemo(() => {
    const eventsCreated = events.filter(e => e.createdBy === _id).length;
    // Events joined: events where user is in roster (including their own events)
    const eventsJoined = events.filter(e => {
      const roster = (e as any).roster || (e as any).participants || [];
      return roster.some((r: any) => r.userId === _id || r._id === _id);
    }).length;
    return {eventsCreated, eventsJoined};
  }, [events, _id]);

  // Get member since year from user data
  const memberSinceYear = useMemo(() => {
    if (userData && 'createdAt' in userData && userData.createdAt) {
      return new Date(userData.createdAt as string).getFullYear();
    }
    return new Date().getFullYear();
  }, [userData]);

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
          paddingBottom: 32,
        },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
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
        // Profile Header Section
        profileSection: {
          alignItems: 'center',
          paddingVertical: 24,
          paddingHorizontal: 16,
        },
        avatarContainer: {
          position: 'relative',
          marginBottom: 16,
        },
        avatar: {
          width: 110,
          height: 110,
          borderRadius: 55,
          borderWidth: 3,
          borderColor: colors.primary,
        },
        avatarPlaceholder: {
          width: 110,
          height: 110,
          borderRadius: 55,
          backgroundColor: colors.primary + '20',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 3,
          borderColor: colors.primary,
        },
        avatarInitials: {
          fontSize: 38,
          fontWeight: '700',
          color: colors.primary,
        },
        userName: {
          fontSize: 26,
          fontWeight: '700',
          color: colors.text,
          marginBottom: 4,
        },
        emailText: {
          fontSize: 15,
          color: colors.placeholder,
          marginBottom: 16,
        },
        photoButtonsRow: {
          flexDirection: 'row',
          gap: 12,
        },
        photoButton: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.card,
          paddingVertical: 10,
          paddingHorizontal: 18,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.border,
        },
        photoButtonText: {
          color: colors.primary,
          fontSize: 14,
          fontWeight: '600',
          marginLeft: 8,
        },
        // Stats Row - Compact inline
        statsRow: {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 16,
          paddingHorizontal: 16,
          marginHorizontal: 16,
          backgroundColor: colors.card,
          borderRadius: 12,
          marginBottom: 16,
        },
        statItem: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        statValue: {
          fontSize: 18,
          fontWeight: '700',
          color: colors.text,
          marginRight: 4,
        },
        statLabel: {
          fontSize: 14,
          color: colors.placeholder,
        },
        statDivider: {
          width: 1,
          height: 20,
          backgroundColor: colors.border,
          marginHorizontal: 24,
        },
        // Section Card
        sectionCard: {
          backgroundColor: colors.card,
          marginHorizontal: 16,
          marginBottom: 16,
          borderRadius: 12,
          overflow: 'hidden',
        },
        sectionHeader: {
          fontSize: 13,
          fontWeight: '600',
          color: colors.placeholder,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 8,
        },
        // Menu Row
        menuRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        menuRowLast: {
          borderBottomWidth: 0,
        },
        menuIcon: {
          width: 36,
          height: 36,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 14,
        },
        menuContent: {
          flex: 1,
        },
        menuTitle: {
          fontSize: 16,
          fontWeight: '500',
          color: colors.text,
        },
        menuSubtitle: {
          fontSize: 13,
          color: colors.placeholder,
          marginTop: 2,
        },
        menuChevron: {
          marginLeft: 8,
        },
        menuValue: {
          fontSize: 14,
          color: colors.placeholder,
          marginRight: 8,
        },
        // Favorite Sports
        sportsContainer: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          paddingHorizontal: 16,
          paddingBottom: 16,
          gap: 10,
        },
        sportTag: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.primary + '20',
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.primary + '40',
        },
        sportEmoji: {
          fontSize: 18,
        },
        sportTagText: {
          fontSize: 14,
          marginLeft: 6,
          color: colors.text,
          fontWeight: '500',
        },
        addSportButton: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.background,
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.border,
          borderStyle: 'dashed',
        },
        addSportText: {
          fontSize: 14,
          marginLeft: 6,
          color: colors.placeholder,
          fontWeight: '500',
        },
        // Sports Picker Modal
        sportsPickerOverlay: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          padding: 16,
        },
        sportsPickerCard: {
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 20,
          maxHeight: '70%',
        },
        sportsPickerTitle: {
          fontSize: 18,
          fontWeight: '700',
          color: colors.text,
          marginBottom: 16,
          textAlign: 'center',
        },
        sportsPickerGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 10,
          justifyContent: 'center',
        },
        sportPickerItem: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.background,
          paddingVertical: 10,
          paddingHorizontal: 16,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: colors.border,
          minWidth: '45%',
        },
        sportPickerItemSelected: {
          borderColor: colors.primary,
          backgroundColor: colors.primary + '15',
        },
        sportPickerEmoji: {
          fontSize: 20,
          marginRight: 8,
        },
        sportPickerLabel: {
          fontSize: 14,
          color: colors.text,
          fontWeight: '500',
        },
        sportsPickerDone: {
          backgroundColor: colors.primary,
          paddingVertical: 14,
          borderRadius: 12,
          marginTop: 20,
          alignItems: 'center',
        },
        sportsPickerDoneText: {
          color: '#fff',
          fontSize: 16,
          fontWeight: '600',
        },
        signOutText: {
          color: '#DC3545',
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
      if (!userData) {
        return;
      }
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

  const handleSignOut = async () => {
    Alert.alert(
      t('auth.signOut'),
      t('profile.signOutConfirm') || 'Are you sure you want to sign out?',
      [
        {text: t('common.cancel'), style: 'cancel'},
        {
          text: t('auth.signOut'),
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.multiRemove([
              'userToken',
              '@profilePicUrl',
              '@app_language',
            ]);
            setUserData(null);
            navigation.reset({
              index: 0,
              routes: [{name: 'LandingPage'}],
            });
          },
        },
      ],
    );
  };

  const toggleSport = (sportId: string) => {
    setFavoriteSports(prev => {
      const newSports = prev.includes(sportId)
        ? prev.filter(s => s !== sportId)
        : [...prev, sportId];
      saveFavoriteSports(newSports);
      return newSports;
    });
  };

  const getFavoriteSportsDisplay = () => {
    return SPORTS_OPTIONS.filter(s => favoriteSports.includes(s.id));
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
        {/* Profile Header */}
        <View style={themedStyles.profileSection}>
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

          <Text style={themedStyles.userName}>{userData?.username}</Text>
          <Text style={themedStyles.emailText}>{userData?.email}</Text>

          {/* Photo Buttons */}
          {uploadingImage ? (
            <View style={themedStyles.photoButtonsRow}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : (
            <View style={themedStyles.photoButtonsRow}>
              <TouchableOpacity
                style={themedStyles.photoButton}
                onPress={handleChoosePhoto}>
                <FontAwesomeIcon
                  icon={faImage}
                  size={14}
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
                  size={14}
                  color={colors.primary}
                />
                <Text style={themedStyles.photoButtonText}>
                  {t('profile.camera')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Stats Row */}
        <View style={themedStyles.statsRow}>
          <View style={themedStyles.statItem}>
            <Text style={themedStyles.statValue}>
              {userStats.eventsCreated}
            </Text>
            <Text style={themedStyles.statLabel}>
              {t('profile.created') || 'Created'}
            </Text>
          </View>
          <View style={themedStyles.statDivider} />
          <View style={themedStyles.statItem}>
            <Text style={themedStyles.statValue}>{userStats.eventsJoined}</Text>
            <Text style={themedStyles.statLabel}>
              {t('profile.joined') || 'Joined'}
            </Text>
          </View>
        </View>

        {/* My Events Section */}
        <View style={themedStyles.sectionCard}>
          <Text style={themedStyles.sectionHeader}>
            {t('profile.myEvents') || 'My Events'}
          </Text>

          <TouchableOpacity
            style={themedStyles.menuRow}
            onPress={() =>
              navigation.navigate('EventList', {
                profileFilter: 'created',
                userId: _id,
              })
            }>
            <View
              style={[
                themedStyles.menuIcon,
                {backgroundColor: colors.primary + '20'},
              ]}>
              <FontAwesomeIcon
                icon={faCalendarPlus}
                size={16}
                color={colors.primary}
              />
            </View>
            <View style={themedStyles.menuContent}>
              <Text style={themedStyles.menuTitle}>
                {t('profile.eventsCreated') || 'Events Created'}
              </Text>
              <Text style={themedStyles.menuSubtitle}>
                {userStats.eventsCreated}{' '}
                {userStats.eventsCreated === 1 ? 'event' : 'events'}
              </Text>
            </View>
            <FontAwesomeIcon
              icon={faChevronRight}
              size={14}
              color={colors.placeholder}
              style={themedStyles.menuChevron}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[themedStyles.menuRow, themedStyles.menuRowLast]}
            onPress={() =>
              navigation.navigate('EventList', {
                profileFilter: 'joined',
                userId: _id,
              })
            }>
            <View
              style={[
                themedStyles.menuIcon,
                {backgroundColor: '#4CAF50' + '20'},
              ]}>
              <FontAwesomeIcon
                icon={faCalendarCheck}
                size={16}
                color="#4CAF50"
              />
            </View>
            <View style={themedStyles.menuContent}>
              <Text style={themedStyles.menuTitle}>
                {t('profile.eventsJoined') || 'Events Joined'}
              </Text>
              <Text style={themedStyles.menuSubtitle}>
                {userStats.eventsJoined}{' '}
                {userStats.eventsJoined === 1 ? 'event' : 'events'}
              </Text>
            </View>
            <FontAwesomeIcon
              icon={faChevronRight}
              size={14}
              color={colors.placeholder}
              style={themedStyles.menuChevron}
            />
          </TouchableOpacity>
        </View>

        {/* Notifications Section */}
        <View style={themedStyles.sectionCard}>
          <Text style={themedStyles.sectionHeader}>
            {t('profile.notifications') || 'Notifications'}
          </Text>

          <TouchableOpacity
            style={[themedStyles.menuRow, themedStyles.menuRowLast]}
            onPress={() => navigation.navigate('Notifications')}>
            <View
              style={[
                themedStyles.menuIcon,
                {backgroundColor: '#FF5722' + '20'},
              ]}>
              <FontAwesomeIcon icon={faBell} size={16} color="#FF5722" />
            </View>
            <View style={themedStyles.menuContent}>
              <Text style={themedStyles.menuTitle}>
                {t('profile.allNotifications') || 'All Notifications'}
              </Text>
              <Text style={themedStyles.menuSubtitle}>
                {t('profile.viewAllNotifications') ||
                  'View all your notifications'}
              </Text>
            </View>
            <FontAwesomeIcon
              icon={faChevronRight}
              size={14}
              color={colors.placeholder}
              style={themedStyles.menuChevron}
            />
          </TouchableOpacity>
        </View>

        {/* Friends Section */}
        <View style={themedStyles.sectionCard}>
          <Text style={themedStyles.sectionHeader}>Friends</Text>

          <TouchableOpacity
            style={themedStyles.menuRow}
            onPress={() => navigation.navigate('FriendsList')}>
            <View
              style={[
                themedStyles.menuIcon,
                {backgroundColor: '#2196F3' + '20'},
              ]}>
              <FontAwesomeIcon icon={faUsers} size={16} color="#2196F3" />
            </View>
            <View style={themedStyles.menuContent}>
              <Text style={themedStyles.menuTitle}>My Friends</Text>
              <Text style={themedStyles.menuSubtitle}>
                View and manage your friends
              </Text>
            </View>
            <FontAwesomeIcon
              icon={faChevronRight}
              size={14}
              color={colors.placeholder}
              style={themedStyles.menuChevron}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={themedStyles.menuRow}
            onPress={() => navigation.navigate('FriendRequests')}>
            <View
              style={[
                themedStyles.menuIcon,
                {backgroundColor: '#FF9800' + '20'},
              ]}>
              <FontAwesomeIcon icon={faUserClock} size={16} color="#FF9800" />
            </View>
            <View style={themedStyles.menuContent}>
              <Text style={themedStyles.menuTitle}>Friend Requests</Text>
              <Text style={themedStyles.menuSubtitle}>Pending requests</Text>
            </View>
            <FontAwesomeIcon
              icon={faChevronRight}
              size={14}
              color={colors.placeholder}
              style={themedStyles.menuChevron}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[themedStyles.menuRow, themedStyles.menuRowLast]}
            onPress={() => navigation.navigate('UserSearch')}>
            <View
              style={[
                themedStyles.menuIcon,
                {backgroundColor: '#9C27B0' + '20'},
              ]}>
              <FontAwesomeIcon icon={faUserPlus} size={16} color="#9C27B0" />
            </View>
            <View style={themedStyles.menuContent}>
              <Text style={themedStyles.menuTitle}>Find Players</Text>
              <Text style={themedStyles.menuSubtitle}>
                Search for new friends
              </Text>
            </View>
            <FontAwesomeIcon
              icon={faChevronRight}
              size={14}
              color={colors.placeholder}
              style={themedStyles.menuChevron}
            />
          </TouchableOpacity>
        </View>

        {/* Favorite Sports Section */}
        <View style={themedStyles.sectionCard}>
          <Text style={themedStyles.sectionHeader}>
            {t('profile.favoriteSports') || 'Favorite Sports'}
          </Text>
          <View style={themedStyles.sportsContainer}>
            {getFavoriteSportsDisplay().map(sport => (
              <View key={sport.id} style={themedStyles.sportTag}>
                <Text style={themedStyles.sportEmoji}>{sport.emoji}</Text>
                <Text style={themedStyles.sportTagText}>{sport.label}</Text>
              </View>
            ))}
            <TouchableOpacity
              style={themedStyles.addSportButton}
              onPress={() => setShowSportsPicker(true)}>
              <FontAwesomeIcon
                icon={faPlus}
                size={12}
                color={colors.placeholder}
              />
              <Text style={themedStyles.addSportText}>
                {t('profile.edit') || 'Edit'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Account Section */}
        <View style={themedStyles.sectionCard}>
          <Text style={themedStyles.sectionHeader}>
            {t('profile.account') || 'Account'}
          </Text>

          <View style={themedStyles.menuRow}>
            <View
              style={[
                themedStyles.menuIcon,
                {backgroundColor: '#9C27B0' + '20'},
              ]}>
              <FontAwesomeIcon
                icon={faCalendarDays}
                size={16}
                color="#9C27B0"
              />
            </View>
            <View style={themedStyles.menuContent}>
              <Text style={themedStyles.menuTitle}>
                {t('profile.memberSince') || 'Member since'}
              </Text>
            </View>
            <Text style={themedStyles.menuValue}>{memberSinceYear}</Text>
          </View>

          <TouchableOpacity
            style={themedStyles.menuRow}
            onPress={() => navigation.navigate('Settings')}>
            <View
              style={[
                themedStyles.menuIcon,
                {backgroundColor: colors.placeholder + '20'},
              ]}>
              <FontAwesomeIcon
                icon={faGear}
                size={16}
                color={colors.placeholder}
              />
            </View>
            <View style={themedStyles.menuContent}>
              <Text style={themedStyles.menuTitle}>
                {t('navigation.settings') || 'Settings'}
              </Text>
            </View>
            <FontAwesomeIcon
              icon={faChevronRight}
              size={14}
              color={colors.placeholder}
              style={themedStyles.menuChevron}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[themedStyles.menuRow, themedStyles.menuRowLast]}
            onPress={handleSignOut}>
            <View
              style={[
                themedStyles.menuIcon,
                {backgroundColor: '#DC3545' + '20'},
              ]}>
              <FontAwesomeIcon
                icon={faRightFromBracket}
                size={16}
                color="#DC3545"
              />
            </View>
            <View style={themedStyles.menuContent}>
              <Text style={[themedStyles.menuTitle, themedStyles.signOutText]}>
                {t('auth.signOut') || 'Sign Out'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Sports Picker Modal */}
      {showSportsPicker && (
        <View style={themedStyles.sportsPickerOverlay}>
          <View style={themedStyles.sportsPickerCard}>
            <Text style={themedStyles.sportsPickerTitle}>
              {t('profile.selectFavoriteSports') ||
                'Select Your Favorite Sports'}
            </Text>
            <ScrollView>
              <View style={themedStyles.sportsPickerGrid}>
                {SPORTS_OPTIONS.map(sport => (
                  <TouchableOpacity
                    key={sport.id}
                    style={[
                      themedStyles.sportPickerItem,
                      favoriteSports.includes(sport.id) &&
                        themedStyles.sportPickerItemSelected,
                    ]}
                    onPress={() => toggleSport(sport.id)}>
                    <Text style={themedStyles.sportPickerEmoji}>
                      {sport.emoji}
                    </Text>
                    <Text style={themedStyles.sportPickerLabel}>
                      {sport.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <TouchableOpacity
              style={themedStyles.sportsPickerDone}
              onPress={() => setShowSportsPicker(false)}>
              <Text style={themedStyles.sportsPickerDoneText}>
                {t('common.done') || 'Done'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

export default Profile;
