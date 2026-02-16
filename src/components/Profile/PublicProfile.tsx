import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useContext,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRoute, RouteProp, useNavigation} from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useTheme} from '../ThemeContext/ThemeContext';
import {API_BASE_URL} from '../../config/api';
import {useEventContext} from '../../Context/EventContext';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faCalendarCheck,
  faCalendarPlus,
  faArrowLeft,
  faUserPlus,
  faUserCheck,
  faUserClock,
  faUserMinus,
  faFire,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons';
import {useTranslation} from 'react-i18next';
import {TouchableOpacity} from 'react-native';
import UserContext, {UserContextType} from '../UserContext';

type FriendStatus = 'none' | 'friends' | 'pending' | 'incoming' | 'loading';

type PublicProfileRouteProp = RouteProp<
  {
    PublicProfile: {
      userId: string;
      username: string;
      profilePicUrl?: string;
    };
  },
  'PublicProfile'
>;

interface PublicUserData {
  _id: string;
  username: string;
  profilePicUrl?: string;
  favoriteSports?: string[];
}

// Interest display map
const INTERESTS_MAP: Record<string, {emoji: string; label: string}> = {
  basketball: {emoji: '🏀', label: 'Basketball'},
  hockey: {emoji: '🏒', label: 'Hockey'},
  soccer: {emoji: '⚽', label: 'Soccer'},
  football: {emoji: '🏈', label: 'Football'},
  baseball: {emoji: '⚾', label: 'Baseball'},
  tennis: {emoji: '🎾', label: 'Tennis'},
  golf: {emoji: '⛳', label: 'Golf'},
  volleyball: {emoji: '🏐', label: 'Volleyball'},
  trivia: {emoji: '🧠', label: 'Trivia'},
  'game-nights': {emoji: '🎲', label: 'Game Nights'},
  karaoke: {emoji: '🎤', label: 'Karaoke'},
  'live-music': {emoji: '🎵', label: 'Live Music'},
  hiking: {emoji: '🥾', label: 'Hiking'},
  cycling: {emoji: '🚴', label: 'Cycling'},
  running: {emoji: '🏃', label: 'Running'},
  yoga: {emoji: '🧘', label: 'Yoga'},
  'book-club': {emoji: '📚', label: 'Book Club'},
  volunteering: {emoji: '💚', label: 'Volunteering'},
  cooking: {emoji: '🍲', label: 'Cooking'},
  workshops: {emoji: '🛠️', label: 'Workshops'},
};

const PublicProfile: React.FC = () => {
  const route = useRoute<PublicProfileRouteProp>();
  const navigation = useNavigation();
  const {userId, username, profilePicUrl} = route.params;
  const {colors} = useTheme();
  const {events} = useEventContext();
  const {t} = useTranslation();
  const {userData: currentUser} = useContext(UserContext) as UserContextType;

  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<PublicUserData | null>(null);
  const [friendStatus, setFriendStatus] = useState<FriendStatus>('none');
  const [mutualFriendsCount, setMutualFriendsCount] = useState<number>(0);
  const [favoriteSports, setFavoriteSports] = useState<string[]>([]);

  // Fetch friend status
  const fetchFriendStatus = useCallback(async () => {
    if (userId === currentUser?._id) {
      return;
    }

    try {
      const token = await AsyncStorage.getItem('userToken');

      // Check if already friends
      const friendsRes = await fetch(`${API_BASE_URL}/users/me/friends`, {
        headers: {Authorization: `Bearer ${token}`},
      });
      if (friendsRes.ok) {
        const data = await friendsRes.json();
        const friends = Array.isArray(data) ? data : data.friends || [];
        if (friends.some((f: any) => f._id === userId)) {
          setFriendStatus('friends');
          return;
        }
      }

      // Check outgoing requests
      const outgoingRes = await fetch(
        `${API_BASE_URL}/users/me/friend-requests/outgoing`,
        {headers: {Authorization: `Bearer ${token}`}},
      );
      if (outgoingRes.ok) {
        const data = await outgoingRes.json();
        const requests = Array.isArray(data) ? data : data.requests || [];
        if (requests.some((r: any) => r._id === userId)) {
          setFriendStatus('pending');
          return;
        }
      }

      // Check incoming requests
      const incomingRes = await fetch(
        `${API_BASE_URL}/users/me/friend-requests/incoming`,
        {headers: {Authorization: `Bearer ${token}`}},
      );
      if (incomingRes.ok) {
        const data = await incomingRes.json();
        const requests = Array.isArray(data) ? data : data.requests || [];
        if (requests.some((r: any) => r._id === userId)) {
          setFriendStatus('incoming');
          return;
        }
      }

      setFriendStatus('none');
    } catch (error) {
      console.error('Error fetching friend status:', error);
    }
  }, [userId, currentUser?._id]);

  useEffect(() => {
    fetchFriendStatus();
  }, [fetchFriendStatus]);

  // Fetch favorite sports for this user
  useEffect(() => {
    const loadFavoriteSports = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const response = await fetch(
          `${API_BASE_URL}/user/${userId}/favorite-sports`,
          {
            headers: {Authorization: `Bearer ${token}`},
          },
        );
        if (response.ok) {
          const data = await response.json();
          setFavoriteSports(data.favoriteSports || []);
        }
      } catch (error) {
        console.error('Error loading favorite sports:', error);
      }
    };
    loadFavoriteSports();
  }, [userId]);

  // Handle friend action
  const handleFriendAction = useCallback(async () => {
    const token = await AsyncStorage.getItem('userToken');
    const prevStatus = friendStatus;
    setFriendStatus('loading');

    try {
      switch (prevStatus) {
        case 'none': {
          const sendRes = await fetch(
            `${API_BASE_URL}/users/${userId}/friend-request`,
            {
              method: 'POST',
              headers: {Authorization: `Bearer ${token}`},
            },
          );
          if (sendRes.ok) {
            setFriendStatus('pending');
            Alert.alert('Success', 'Friend request sent!');
          } else {
            setFriendStatus('none');
            Alert.alert('Error', 'Failed to send friend request');
          }
          break;
        }

        case 'pending':
          Alert.alert('Cancel Request', 'Cancel this friend request?', [
            {text: 'No', onPress: () => setFriendStatus('pending')},
            {
              text: 'Yes',
              onPress: async () => {
                const cancelRes = await fetch(
                  `${API_BASE_URL}/users/me/friend-requests/${userId}/cancel`,
                  {
                    method: 'DELETE',
                    headers: {Authorization: `Bearer ${token}`},
                  },
                );
                setFriendStatus(cancelRes.ok ? 'none' : 'pending');
              },
            },
          ]);
          break;

        case 'incoming': {
          const acceptRes = await fetch(
            `${API_BASE_URL}/users/me/friend-requests/${userId}/accept`,
            {
              method: 'POST',
              headers: {Authorization: `Bearer ${token}`},
            },
          );
          if (acceptRes.ok) {
            setFriendStatus('friends');
            Alert.alert('Success', 'Friend request accepted!');
          } else {
            setFriendStatus('incoming');
          }
          break;
        }

        case 'friends':
          Alert.alert('Remove Friend', 'Are you sure you want to unfriend?', [
            {text: 'Cancel', onPress: () => setFriendStatus('friends')},
            {
              text: 'Remove',
              style: 'destructive',
              onPress: async () => {
                const removeRes = await fetch(
                  `${API_BASE_URL}/users/me/friends/${userId}`,
                  {
                    method: 'DELETE',
                    headers: {Authorization: `Bearer ${token}`},
                  },
                );
                setFriendStatus(removeRes.ok ? 'none' : 'friends');
              },
            },
          ]);
          break;
      }
    } catch (error) {
      console.error('Friend action error:', error);
      fetchFriendStatus();
    }
  }, [friendStatus, userId, fetchFriendStatus]);

  const getFriendButtonConfig = () => {
    switch (friendStatus) {
      case 'friends':
        return {
          icon: faUserCheck,
          label: 'Friends',
          color: '#4CAF50',
          bgColor: '#4CAF50' + '20',
        };
      case 'pending':
        return {
          icon: faUserClock,
          label: 'Request Sent',
          color: '#FF9800',
          bgColor: '#FF9800' + '20',
        };
      case 'incoming':
        return {
          icon: faUserCheck,
          label: 'Accept Request',
          color: '#2196F3',
          bgColor: '#2196F3' + '20',
        };
      default:
        return {
          icon: faUserPlus,
          label: 'Add Friend',
          color: colors.primary,
          bgColor: colors.primary + '20',
        };
    }
  };

  const friendButtonConfig = getFriendButtonConfig();

  // Calculate user stats based on events
  const userStats = useMemo(() => {
    const eventsCreated = events.filter(e => e.createdBy === userId).length;
    const eventsJoined = events.filter(e =>
      (e as any).roster?.some((r: any) => r.userId === userId),
    ).length;
    return {eventsCreated, eventsJoined};
  }, [events, userId]);

  // Fetch user data if needed
  useEffect(() => {
    const fetchUserData = async () => {
      if (username) {
        setUserData({
          _id: userId,
          username: username,
          profilePicUrl: profilePicUrl,
        });
        return;
      }

      setLoading(true);
      try {
        const response = await axios.get(`${API_BASE_URL}/users/${userId}`);
        setUserData(response.data);
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
      setLoading(false);
    };

    fetchUserData();
  }, [userId, username, profilePicUrl]);

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
          alignItems: 'center',
          marginBottom: 8,
          paddingHorizontal: 16,
          paddingTop: 8,
          backgroundColor: colors.background,
        },
        backButton: {
          padding: 8,
          marginRight: 12,
        },
        title: {
          fontSize: 22,
          fontWeight: '700',
          color: colors.text,
        },
        loadingContainer: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        },
        // ── Profile Header ──
        profileSection: {
          alignItems: 'center',
          paddingTop: 16,
          paddingBottom: 20,
          paddingHorizontal: 16,
        },
        avatarContainer: {
          marginBottom: 14,
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
        userName: {
          fontSize: 24,
          fontWeight: '700',
          color: colors.text,
          textAlign: 'center',
          marginBottom: 4,
        },
        userHandle: {
          fontSize: 14,
          color: colors.placeholder,
          marginBottom: 16,
        },
        // Friend action button
        friendButton: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 28,
          paddingVertical: 12,
          borderRadius: 24,
          gap: 8,
        },
        friendButtonText: {
          fontSize: 15,
          fontWeight: '700',
        },
        // ── Widget Card ──
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
        // ── Stats Grid ──
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
        // ── Interests ──
        interestsEmoji: {
          fontSize: 20,
          marginRight: 8,
        },
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
        noInterestsText: {
          fontSize: 14,
          color: colors.placeholder,
          fontStyle: 'italic',
        },
      }),
    [colors],
  );

  if (loading) {
    return (
      <SafeAreaView style={themedStyles.safeArea} edges={['top']}>
        <View style={themedStyles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={themedStyles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={themedStyles.header}>
        <TouchableOpacity
          style={themedStyles.backButton}
          onPress={() => navigation.goBack()}>
          <FontAwesomeIcon icon={faArrowLeft} size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={themedStyles.title}>{t('profile.playerProfile')}</Text>
      </View>

      <ScrollView
        style={themedStyles.container}
        contentContainerStyle={themedStyles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* ── Profile Header ── */}
        <View style={themedStyles.profileSection}>
          <View style={themedStyles.avatarContainer}>
            {userData?.profilePicUrl ? (
              <Image
                source={{uri: userData.profilePicUrl}}
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
          <Text style={themedStyles.userHandle}>@{userData?.username}</Text>

          {/* Friend Action Button */}
          {userId !== currentUser?._id && (
            <TouchableOpacity
              style={[
                themedStyles.friendButton,
                {backgroundColor: friendButtonConfig.bgColor},
              ]}
              onPress={handleFriendAction}
              disabled={friendStatus === 'loading'}>
              {friendStatus === 'loading' ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <FontAwesomeIcon
                    icon={friendButtonConfig.icon}
                    size={16}
                    color={friendButtonConfig.color}
                  />
                  <Text
                    style={[
                      themedStyles.friendButtonText,
                      {color: friendButtonConfig.color},
                    ]}>
                    {friendButtonConfig.label}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* ── Activity Widget (2x2 grid) ── */}
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
                  {t('profile.activity') || 'Activity'}
                </Text>
              </View>
            </View>
            <View style={themedStyles.statsGrid}>
              <View style={themedStyles.statCell}>
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
              </View>

              <View style={themedStyles.statCell}>
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
              </View>
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
            </View>
            {favoriteSports.length > 0 ? (
              <View style={themedStyles.sportsContainer}>
                {favoriteSports.map(sportId => {
                  const sport = INTERESTS_MAP[sportId];
                  if (!sport) {
                    return null;
                  }
                  return (
                    <View key={sportId} style={themedStyles.sportTag}>
                      <Text style={themedStyles.sportEmoji}>{sport.emoji}</Text>
                      <Text style={themedStyles.sportTagText}>
                        {sport.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={themedStyles.noInterestsText}>
                No interests added yet
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default PublicProfile;
