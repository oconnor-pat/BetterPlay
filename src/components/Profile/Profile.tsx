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
  Platform,
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
import {useEventContext, Event} from '../../Context/EventContext';

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
  faClock,
  faLocationDot,
  faFire,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons';
import {useTranslation} from 'react-i18next';

// Types
type ProfileScreenRouteProp = RouteProp<
  {Profile: {_id: string; username: string; email: string}},
  'Profile'
>;

// Available interests/activities for the favorites section
const INTERESTS_OPTIONS = [
  // Sports
  {id: 'basketball', emoji: '🏀', label: 'Basketball'},
  {id: 'hockey', emoji: '🏒', label: 'Hockey'},
  {id: 'soccer', emoji: '⚽', label: 'Soccer'},
  {id: 'football', emoji: '🏈', label: 'Football'},
  {id: 'baseball', emoji: '⚾', label: 'Baseball'},
  {id: 'tennis', emoji: '🎾', label: 'Tennis'},
  {id: 'golf', emoji: '⛳', label: 'Golf'},
  {id: 'volleyball', emoji: '🏐', label: 'Volleyball'},
  // Social & Entertainment
  {id: 'trivia', emoji: '🧠', label: 'Trivia'},
  {id: 'game-nights', emoji: '🎲', label: 'Game Nights'},
  {id: 'karaoke', emoji: '🎤', label: 'Karaoke'},
  {id: 'live-music', emoji: '🎵', label: 'Live Music'},
  // Outdoor & Fitness
  {id: 'hiking', emoji: '🥾', label: 'Hiking'},
  {id: 'cycling', emoji: '🚴', label: 'Cycling'},
  {id: 'running', emoji: '🏃', label: 'Running'},
  {id: 'yoga', emoji: '🧘', label: 'Yoga'},
  // Community
  {id: 'book-club', emoji: '📚', label: 'Book Club'},
  {id: 'volunteering', emoji: '💚', label: 'Volunteering'},
  {id: 'cooking', emoji: '🍲', label: 'Cooking'},
  {id: 'workshops', emoji: '🛠️', label: 'Workshops'},
];

const Profile: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [favoriteSports, setFavoriteSports] = useState<string[]>([]);
  const [showInterestsPicker, setShowInterestsPicker] = useState(false);
  const [friendsCount, setFriendsCount] = useState<number>(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);

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

  // Fetch friends count and pending requests count
  useEffect(() => {
    const loadSocialCounts = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        // Fetch friends
        const friendsRes = await fetch(`${API_BASE_URL}/users/me/friends`, {
          headers: {Authorization: `Bearer ${token}`},
        });
        if (friendsRes.ok) {
          const friendsData = await friendsRes.json();
          const list = Array.isArray(friendsData)
            ? friendsData
            : friendsData.friends || [];
          setFriendsCount(list.length);
        }
        // Fetch pending incoming requests
        const reqRes = await fetch(
          `${API_BASE_URL}/users/me/friend-requests/incoming`,
          {
            headers: {Authorization: `Bearer ${token}`},
          },
        );
        if (reqRes.ok) {
          const reqData = await reqRes.json();
          const reqList = Array.isArray(reqData)
            ? reqData
            : reqData.requests || [];
          setPendingRequestsCount(reqList.length);
        }
      } catch (error) {
        console.error('Error loading social counts:', error);
      }
    };
    loadSocialCounts();
  }, []);

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
    const eventsJoined = events.filter(e => {
      const roster = (e as any).roster || (e as any).participants || [];
      return roster.some((r: any) => r.userId === _id || r._id === _id);
    }).length;
    return {eventsCreated, eventsJoined};
  }, [events, _id]);

  // Find next upcoming event for this user
  const nextUpcomingEvent = useMemo(() => {
    const now = new Date();
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const userEvents = events
      .filter(e => {
        const isCreator = e.createdBy === _id;
        const roster = (e as any).roster || (e as any).participants || [];
        const isInRoster = roster.some(
          (r: any) => r.userId === _id || r._id === _id,
        );
        return isCreator || isInRoster;
      })
      .filter(e => {
        try {
          const eventDate = new Date(`${e.date}T${e.time || '00:00'}`);
          return eventDate > now && eventDate <= oneWeekFromNow;
        } catch {
          return false;
        }
      })
      .sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time || '00:00'}`);
        const dateB = new Date(`${b.date}T${b.time || '00:00'}`);
        return dateA.getTime() - dateB.getTime();
      });
    return userEvents[0] || null;
  }, [events, _id]);

  // Format upcoming event date nicely
  const formatEventDate = (event: Event) => {
    try {
      const date = new Date(`${event.date}T${event.time || '00:00'}`);
      const now = new Date();
      const diffMs = date.getTime() - now.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 0) {
        return t('profile.today') || 'Today';
      }
      if (diffDays === 1) {
        return t('profile.tomorrow') || 'Tomorrow';
      }
      if (diffDays < 7) {
        return date.toLocaleDateString(undefined, {weekday: 'long'});
      }
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return event.date;
    }
  };

  const formatEventTime = (event: Event) => {
    try {
      const date = new Date(`${event.date}T${event.time || '00:00'}`);
      return date.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return event.time;
    }
  };

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
        // ── Profile Header (compact) ──
        profileSection: {
          alignItems: 'center',
          paddingTop: 16,
          paddingBottom: 20,
          paddingHorizontal: 16,
        },
        avatarContainer: {
          position: 'relative',
          marginBottom: 12,
        },
        avatar: {
          width: 100,
          height: 100,
          borderRadius: 50,
          borderWidth: 3,
          borderColor: colors.primary,
        },
        avatarPlaceholder: {
          width: 100,
          height: 100,
          borderRadius: 50,
          backgroundColor: colors.primary + '20',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 3,
          borderColor: colors.primary,
        },
        avatarInitials: {
          fontSize: 34,
          fontWeight: '700',
          color: colors.primary,
        },
        avatarEditBadge: {
          position: 'absolute',
          bottom: 0,
          right: -4,
          backgroundColor: colors.primary,
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: colors.background,
        },
        userName: {
          fontSize: 24,
          fontWeight: '700',
          color: colors.text,
          marginBottom: 2,
        },
        emailText: {
          fontSize: 14,
          color: colors.placeholder,
          marginBottom: 10,
        },
        photoButtonsRow: {
          flexDirection: 'row',
          gap: 10,
        },
        photoButton: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.card,
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
        },
        photoButtonText: {
          color: colors.primary,
          fontSize: 13,
          fontWeight: '600',
          marginLeft: 6,
        },
        // ── Widget Card (base) ──
        widgetCard: {
          backgroundColor: colors.card,
          marginHorizontal: 16,
          marginBottom: 14,
          borderRadius: 16,
          overflow: 'hidden',
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: {width: 0, height: 2},
              shadowOpacity: 0.08,
              shadowRadius: 8,
            },
            android: {
              elevation: 3,
            },
          }),
        },
        widgetCardInner: {
          padding: 16,
        },
        widgetHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        },
        widgetHeaderLeft: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        widgetIcon: {
          width: 32,
          height: 32,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 10,
        },
        widgetTitle: {
          fontSize: 15,
          fontWeight: '700',
          color: colors.text,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
        widgetSeeAll: {
          fontSize: 13,
          color: colors.primary,
          fontWeight: '600',
        },
        // ── Quick Stats Widget (2x2 grid) ──
        statsGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 10,
        },
        statCell: {
          flex: 1,
          minWidth: '45%',
          backgroundColor: colors.background,
          paddingVertical: 14,
          paddingHorizontal: 14,
          borderRadius: 12,
          alignItems: 'center',
        },
        statCellIcon: {
          width: 36,
          height: 36,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
        },
        statCellValue: {
          fontSize: 22,
          fontWeight: '800',
          color: colors.text,
        },
        statCellLabel: {
          fontSize: 12,
          color: colors.placeholder,
          fontWeight: '500',
          marginTop: 2,
        },
        // ── Upcoming Event Widget ──
        upcomingEventCard: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.background,
          borderRadius: 12,
          padding: 14,
        },
        upcomingDateBadge: {
          backgroundColor: colors.primary,
          borderRadius: 12,
          paddingVertical: 10,
          paddingHorizontal: 14,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 14,
          minWidth: 56,
        },
        upcomingDateDay: {
          fontSize: 14,
          fontWeight: '700',
          color: '#fff',
        },
        upcomingDateTime: {
          fontSize: 11,
          color: '#fff',
          opacity: 0.85,
          marginTop: 2,
        },
        upcomingEventInfo: {
          flex: 1,
        },
        upcomingEventName: {
          fontSize: 16,
          fontWeight: '700',
          color: colors.text,
          marginBottom: 4,
        },
        upcomingEventMeta: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        },
        upcomingEventMetaText: {
          fontSize: 13,
          color: colors.placeholder,
        },
        upcomingEmptyText: {
          fontSize: 14,
          color: colors.placeholder,
          textAlign: 'center',
          paddingVertical: 12,
        },
        upcomingEmptyCta: {
          fontSize: 14,
          color: colors.primary,
          fontWeight: '600',
          textAlign: 'center',
          marginTop: 6,
        },
        // ── Social Hub Widget ──
        socialQuickActions: {
          flexDirection: 'row',
          gap: 10,
          marginTop: 12,
        },
        socialActionBtn: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 10,
          gap: 6,
        },
        socialActionText: {
          fontSize: 12,
          fontWeight: '600',
          color: colors.text,
        },
        socialActionBadge: {
          backgroundColor: colors.error,
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 4,
          marginLeft: 4,
        },
        socialActionBadgeText: {
          fontSize: 10,
          fontWeight: '700',
          color: '#fff',
        },
        // ── Interests Widget ──
        sportsContainer: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 10,
        },
        sportTag: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.primary + '18',
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 20,
          borderWidth: 1.5,
          borderColor: colors.primary + '35',
        },
        sportEmoji: {
          fontSize: 17,
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
          borderWidth: 1.5,
          borderColor: colors.border,
          borderStyle: 'dashed',
        },
        addSportText: {
          fontSize: 14,
          marginLeft: 6,
          color: colors.placeholder,
          fontWeight: '500',
        },
        interestsEmoji: {
          fontSize: 20,
          marginRight: 8,
        },
        // ── Account / Footer ──
        sectionCard: {
          backgroundColor: colors.card,
          marginHorizontal: 16,
          marginBottom: 14,
          borderRadius: 16,
          overflow: 'hidden',
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: {width: 0, height: 2},
              shadowOpacity: 0.08,
              shadowRadius: 8,
            },
            android: {
              elevation: 3,
            },
          }),
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
        signOutText: {
          color: '#DC3545',
        },
        // ── Sports Picker Modal ──
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
    return INTERESTS_OPTIONS.filter(s => favoriteSports.includes(s.id));
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
        {/* ── Profile Header (compact) ── */}
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
                  size={13}
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
                  size={13}
                  color={colors.primary}
                />
                <Text style={themedStyles.photoButtonText}>
                  {t('profile.camera')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Quick Stats Widget (2x2 grid) ── */}
        <View style={themedStyles.widgetCard}>
          <View style={themedStyles.widgetCardInner}>
            <View style={themedStyles.widgetHeader}>
              <View style={themedStyles.widgetHeaderLeft}>
                <View
                  style={[
                    themedStyles.widgetIcon,
                    {backgroundColor: colors.primary + '20'},
                  ]}>
                  <FontAwesomeIcon
                    icon={faFire}
                    size={15}
                    color={colors.primary}
                  />
                </View>
                <Text style={themedStyles.widgetTitle}>
                  {t('profile.yourActivity') || 'Your Activity'}
                </Text>
              </View>
            </View>
            <View style={themedStyles.statsGrid}>
              <TouchableOpacity
                style={themedStyles.statCell}
                onPress={() =>
                  navigation.navigate('EventList', {
                    profileFilter: 'created',
                    userId: _id,
                  })
                }>
                <View
                  style={[
                    themedStyles.statCellIcon,
                    {backgroundColor: colors.primary + '20'},
                  ]}>
                  <FontAwesomeIcon
                    icon={faCalendarPlus}
                    size={16}
                    color={colors.primary}
                  />
                </View>
                <Text style={themedStyles.statCellValue}>
                  {userStats.eventsCreated}
                </Text>
                <Text style={themedStyles.statCellLabel}>
                  {t('profile.created') || 'Created'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={themedStyles.statCell}
                onPress={() =>
                  navigation.navigate('EventList', {
                    profileFilter: 'joined',
                    userId: _id,
                  })
                }>
                <View
                  style={[
                    themedStyles.statCellIcon,
                    {backgroundColor: '#4CAF50' + '20'},
                  ]}>
                  <FontAwesomeIcon
                    icon={faCalendarCheck}
                    size={16}
                    color="#4CAF50"
                  />
                </View>
                <Text style={themedStyles.statCellValue}>
                  {userStats.eventsJoined}
                </Text>
                <Text style={themedStyles.statCellLabel}>
                  {t('profile.joined') || 'Joined'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={themedStyles.statCell}
                onPress={() => navigation.navigate('FriendsList')}>
                <View
                  style={[
                    themedStyles.statCellIcon,
                    {backgroundColor: '#2196F3' + '20'},
                  ]}>
                  <FontAwesomeIcon
                    icon={faUserGroup}
                    size={16}
                    color="#2196F3"
                  />
                </View>
                <Text style={themedStyles.statCellValue}>{friendsCount}</Text>
                <Text style={themedStyles.statCellLabel}>
                  {t('profile.friends') || 'Friends'}
                </Text>
              </TouchableOpacity>

              <View style={themedStyles.statCell}>
                <View
                  style={[
                    themedStyles.statCellIcon,
                    {backgroundColor: '#9C27B0' + '20'},
                  ]}>
                  <FontAwesomeIcon
                    icon={faCalendarDays}
                    size={16}
                    color="#9C27B0"
                  />
                </View>
                <Text style={themedStyles.statCellValue}>
                  {memberSinceYear}
                </Text>
                <Text style={themedStyles.statCellLabel}>
                  {t('profile.memberSince') || 'Member since'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Upcoming Event Widget ── */}
        <View style={themedStyles.widgetCard}>
          <View style={themedStyles.widgetCardInner}>
            <View style={themedStyles.widgetHeader}>
              <View style={themedStyles.widgetHeaderLeft}>
                <View
                  style={[
                    themedStyles.widgetIcon,
                    {backgroundColor: '#FF9800' + '20'},
                  ]}>
                  <FontAwesomeIcon icon={faClock} size={15} color="#FF9800" />
                </View>
                <Text style={themedStyles.widgetTitle}>
                  {t('profile.upNext') || 'Up Next'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('EventList', {
                    profileFilter: 'joined',
                    userId: _id,
                  })
                }>
                <Text style={themedStyles.widgetSeeAll}>
                  {t('profile.seeAll') || 'See All'}
                </Text>
              </TouchableOpacity>
            </View>

            {nextUpcomingEvent ? (
              <TouchableOpacity
                style={themedStyles.upcomingEventCard}
                onPress={() =>
                  navigation.navigate('EventComments', {
                    eventId: nextUpcomingEvent._id,
                  })
                }>
                <View style={themedStyles.upcomingDateBadge}>
                  <Text style={themedStyles.upcomingDateDay}>
                    {formatEventDate(nextUpcomingEvent)}
                  </Text>
                  <Text style={themedStyles.upcomingDateTime}>
                    {formatEventTime(nextUpcomingEvent)}
                  </Text>
                </View>
                <View style={themedStyles.upcomingEventInfo}>
                  <Text
                    style={themedStyles.upcomingEventName}
                    numberOfLines={1}>
                    {nextUpcomingEvent.name}
                  </Text>
                  <View style={themedStyles.upcomingEventMeta}>
                    <FontAwesomeIcon
                      icon={faLocationDot}
                      size={11}
                      color={colors.placeholder}
                    />
                    <Text
                      style={themedStyles.upcomingEventMetaText}
                      numberOfLines={1}>
                      {nextUpcomingEvent.location}
                    </Text>
                  </View>
                </View>
                <FontAwesomeIcon
                  icon={faChevronRight}
                  size={13}
                  color={colors.placeholder}
                />
              </TouchableOpacity>
            ) : (
              <View>
                <Text style={themedStyles.upcomingEmptyText}>
                  {t('profile.noUpcoming') || 'No upcoming events'}
                </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Events')}>
                  <Text style={themedStyles.upcomingEmptyCta}>
                    {t('profile.browseEvents') || 'Browse Events'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* ── Social Hub Widget ── */}
        <View style={themedStyles.widgetCard}>
          <View style={themedStyles.widgetCardInner}>
            <View style={themedStyles.widgetHeader}>
              <View style={themedStyles.widgetHeaderLeft}>
                <View
                  style={[
                    themedStyles.widgetIcon,
                    {backgroundColor: '#2196F3' + '20'},
                  ]}>
                  <FontAwesomeIcon icon={faUsers} size={15} color="#2196F3" />
                </View>
                <Text style={themedStyles.widgetTitle}>
                  {t('profile.social') || 'Social'}
                </Text>
              </View>
            </View>
            <View style={themedStyles.socialQuickActions}>
              <TouchableOpacity
                style={themedStyles.socialActionBtn}
                onPress={() => navigation.navigate('FriendRequests')}>
                <FontAwesomeIcon icon={faUserClock} size={13} color="#FF9800" />
                <Text style={themedStyles.socialActionText}>
                  {t('profile.requests') || 'Requests'}
                </Text>
                {pendingRequestsCount > 0 && (
                  <View style={themedStyles.socialActionBadge}>
                    <Text style={themedStyles.socialActionBadgeText}>
                      {pendingRequestsCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={themedStyles.socialActionBtn}
                onPress={() => navigation.navigate('UserSearch')}>
                <FontAwesomeIcon icon={faUserPlus} size={13} color="#9C27B0" />
                <Text style={themedStyles.socialActionText}>
                  {t('profile.findPeople') || 'Find'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Interests Widget ── */}
        <View style={themedStyles.widgetCard}>
          <View style={themedStyles.widgetCardInner}>
            <View style={themedStyles.widgetHeader}>
              <View style={themedStyles.widgetHeaderLeft}>
                <Text style={themedStyles.interestsEmoji}>✨</Text>
                <Text style={themedStyles.widgetTitle}>
                  {t('profile.interests') || 'Interests'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowInterestsPicker(true)}>
                <Text style={themedStyles.widgetSeeAll}>
                  {t('common.edit') || 'Edit'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={themedStyles.sportsContainer}>
              {getFavoriteSportsDisplay().map(sport => (
                <View key={sport.id} style={themedStyles.sportTag}>
                  <Text style={themedStyles.sportEmoji}>{sport.emoji}</Text>
                  <Text style={themedStyles.sportTagText}>{sport.label}</Text>
                </View>
              ))}
              {getFavoriteSportsDisplay().length === 0 && (
                <TouchableOpacity
                  style={themedStyles.addSportButton}
                  onPress={() => setShowInterestsPicker(true)}>
                  <FontAwesomeIcon
                    icon={faPlus}
                    size={12}
                    color={colors.placeholder}
                  />
                  <Text style={themedStyles.addSportText}>
                    {t('profile.addInterests') || 'Add interests'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* ── Account Section ── */}
        <View style={themedStyles.sectionCard}>
          <Text style={themedStyles.sectionHeader}>
            {t('profile.account') || 'Account'}
          </Text>

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

      {/* Interests Picker Modal */}
      {showInterestsPicker && (
        <View style={themedStyles.sportsPickerOverlay}>
          <View style={themedStyles.sportsPickerCard}>
            <Text style={themedStyles.sportsPickerTitle}>
              {t('profile.selectInterests') || 'Select Your Interests'}
            </Text>
            <ScrollView>
              <View style={themedStyles.sportsPickerGrid}>
                {INTERESTS_OPTIONS.map(sport => (
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
              onPress={() => setShowInterestsPicker(false)}>
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
