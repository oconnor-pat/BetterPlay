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
  ActionSheetIOS,
  Platform,
  Modal,
  Pressable,
  TouchableOpacity,
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
  faComment,
  faUserPlus,
  faUserCheck,
  faUserClock,
  faEllipsisVertical,
  faUserSlash,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';
import {useTranslation} from 'react-i18next';
import ProfileRatingBadges from '../EventRating/ProfileRatingBadges';
import PlayerRatingModal, {
  PlayerRatingTarget,
} from '../EventRating/PlayerRatingModal';
import UserContext, {UserContextType} from '../UserContext';
import ReportSheet from '../Moderation/ReportSheet';
import {
  blockUser,
  fetchBlockStatus,
  unblockUser,
} from '../../services/ModerationService';

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
  name?: string;
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
  brewery: {emoji: '🍻', label: 'Brewery'},
  wine: {emoji: '🍷', label: 'Wine'},
  coffee: {emoji: '☕', label: 'Coffee'},
  'sports-bar': {emoji: '📺', label: 'Sports Bar'},
  hiking: {emoji: '🥾', label: 'Hiking'},
  cycling: {emoji: '🚴', label: 'Cycling'},
  running: {emoji: '🏃', label: 'Running'},
  yoga: {emoji: '🧘', label: 'Yoga'},
  swimming: {emoji: '🏊', label: 'Swimming'},
  bowling: {emoji: '🎳', label: 'Bowling'},
  arcade: {emoji: '🕹️', label: 'Arcade'},
  gaming: {emoji: '🎮', label: 'Gaming'},
  dance: {emoji: '💃', label: 'Dance'},
  'book-club': {emoji: '📚', label: 'Book Club'},
  volunteering: {emoji: '💚', label: 'Volunteering'},
  cooking: {emoji: '🍲', label: 'Cooking'},
  workshops: {emoji: '🛠️', label: 'Workshops'},
};

const PublicProfile: React.FC = () => {
  const route = useRoute<PublicProfileRouteProp>();
  // Untyped like the other screens that navigate across tabs — this one
  // is registered in four stacks, so there's no single param list to
  // type it against.
  const navigation = useNavigation<any>();
  const {userId, username, profilePicUrl} = route.params;
  const {colors} = useTheme();
  const {events} = useEventContext();
  const {t} = useTranslation();
  const {userData: currentUser} = useContext(UserContext) as UserContextType;

  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<PublicUserData | null>(null);
  const [friendStatus, setFriendStatus] = useState<FriendStatus>('none');
  const [mutualFriendsCount, setMutualFriendsCount] = useState<number>(0);
  const [mutualFriends, setMutualFriends] = useState<
    Array<{_id: string; username: string; profilePicUrl?: string}>
  >([]);
  const [favoriteSports, setFavoriteSports] = useState<string[]>([]);
  const [isBlocked, setIsBlocked] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);

  const isSelf = userId === currentUser?._id;

  useEffect(() => {
    if (isSelf) {
      return;
    }
    fetchBlockStatus(userId)
      .then(setIsBlocked)
      .catch(err => console.error('Failed to fetch block status:', err));
  }, [userId, isSelf]);

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

  useEffect(() => {
    if (!currentUser?._id || userId === currentUser._id) {
      setMutualFriendsCount(0);
      setMutualFriends([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const response = await fetch(
          `${API_BASE_URL}/users/${userId}/mutual-friends`,
          {headers: token ? {Authorization: `Bearer ${token}`} : undefined},
        );
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (cancelled) {
          return;
        }
        setMutualFriendsCount(Number(data.count) || 0);
        setMutualFriends(Array.isArray(data.friends) ? data.friends : []);
      } catch (error) {
        console.error('Error loading mutual friends:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, currentUser?._id]);

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

  // Cross-tab jump into the Messages stack. The thread screen opens (or
  // finds) the conversation itself from the userId, so this navigates
  // straight there instead of waiting on a round trip.
  const handleMessage = useCallback(() => {
    navigation.navigate('Messages', {
      screen: 'DmThread',
      params: {
        userId,
        username: userData?.username,
        profilePicUrl: userData?.profilePicUrl,
      },
    });
  }, [navigation, userData, userId]);

  const handleBlock = useCallback(() => {
    Alert.alert(
      t('moderation.blockTitle', {username: username || userData?.username}),
      t('moderation.blockBody'),
      [
        {text: t('common.cancel'), style: 'cancel'},
        {
          text: t('moderation.block'),
          style: 'destructive',
          onPress: async () => {
            try {
              await blockUser(userId);
              setIsBlocked(true);
              // Blocking unfriends both sides server-side, so the local
              // friend state would otherwise still read "Friends".
              setFriendStatus('none');
            } catch (err) {
              console.error('Failed to block:', err);
              Alert.alert(t('moderation.blockFailed'));
            }
          },
        },
      ],
    );
  }, [userId, username, userData?.username, t]);

  const handleUnblock = useCallback(async () => {
    try {
      await unblockUser(userId);
      setIsBlocked(false);
    } catch (err) {
      console.error('Failed to unblock:', err);
      Alert.alert(t('moderation.unblockFailed'));
    }
  }, [userId, t]);

  // Kebab menu. Android caps Alert at three buttons, so the two-action
  // menu fits there, matching how the chat screens handle the same
  // constraint.
  const openOverflowMenu = useCallback(() => {
    const blockLabel = isBlocked
      ? t('moderation.unblock')
      : t('moderation.block');
    const onBlockAction = isBlocked ? handleUnblock : handleBlock;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t('common.cancel'), t('moderation.report'), blockLabel],
          destructiveButtonIndex: isBlocked ? undefined : 2,
          cancelButtonIndex: 0,
        },
        index => {
          if (index === 1) {
            setReportVisible(true);
          }
          if (index === 2) {
            onBlockAction();
          }
        },
      );
      return;
    }

    Alert.alert(username || t('moderation.thisPerson'), undefined, [
      {text: t('moderation.report'), onPress: () => setReportVisible(true)},
      {
        text: blockLabel,
        style: isBlocked ? 'default' : 'destructive',
        onPress: onBlockAction,
      },
      {text: t('common.cancel'), style: 'cancel'},
    ]);
  }, [isBlocked, handleBlock, handleUnblock, username, t]);

  const [hostRatingAverage, setHostRatingAverage] = useState<number | null>(
    null,
  );
  const [hostRatingCount, setHostRatingCount] = useState(0);
  const [playerRatingAverage, setPlayerRatingAverage] = useState<number | null>(
    null,
  );
  const [playerRatingCount, setPlayerRatingCount] = useState(0);
  const [createdCount, setCreatedCount] = useState<number | null>(null);
  const [joinedCount, setJoinedCount] = useState<number | null>(null);
  const [canRatePlayer, setCanRatePlayer] = useState(false);
  const [myPlayerScore, setMyPlayerScore] = useState(0);
  const [playerModalVisible, setPlayerModalVisible] = useState(false);
  const [playerModalTarget, setPlayerModalTarget] =
    useState<PlayerRatingTarget | null>(null);
  const [photoPreviewVisible, setPhotoPreviewVisible] = useState(false);

  const userStats = useMemo(() => {
    const eventsCreated =
      createdCount != null
        ? createdCount
        : events.filter(e => String(e.createdBy) === String(userId)).length;
    const eventsJoined =
      joinedCount != null
        ? joinedCount
        : events.filter(e =>
            (e as any).roster?.some(
              (r: any) => String(r.userId) === String(userId),
            ),
          ).length;
    return {eventsCreated, eventsJoined};
  }, [events, userId, createdCount, joinedCount]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const headers = token ? {Authorization: `Bearer ${token}`} : {};
        const response = await axios.get(
          `${API_BASE_URL}/user/${userId}/events/stats`,
          {headers},
        );
        if (!cancelled) {
          setHostRatingAverage(
            typeof response.data?.hostRatingAverage === 'number'
              ? response.data.hostRatingAverage
              : null,
          );
          setHostRatingCount(response.data?.hostRatingCount || 0);
          setPlayerRatingAverage(
            typeof response.data?.playerRatingAverage === 'number'
              ? response.data.playerRatingAverage
              : null,
          );
          setPlayerRatingCount(response.data?.playerRatingCount || 0);
          if (typeof response.data?.created === 'number') {
            setCreatedCount(response.data.created);
          }
          if (typeof response.data?.joined === 'number') {
            setJoinedCount(response.data.joined);
          }
        }

        if (token && currentUser?._id && currentUser._id !== userId) {
          const me = await axios.get(
            `${API_BASE_URL}/user/${userId}/player-rating/me`,
            {headers},
          );
          if (!cancelled) {
            setCanRatePlayer(!!me.data?.canRate);
            setMyPlayerScore(me.data?.rating?.score || 0);
          }
        }
      } catch {
        // best-effort
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, currentUser?._id]);

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
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          backgroundColor: colors.background,
        },
        backButton: {
          padding: 8,
          marginRight: 4,
        },
        title: {
          fontSize: 16,
          fontWeight: '700',
          color: colors.text,
        },
        // Pushes the kebab to the trailing edge without disturbing the
        // existing back-button-then-title layout.
        headerSpacer: {
          flex: 1,
        },
        overflowButton: {
          padding: 8,
        },
        blockedNotice: {
          alignItems: 'center',
          paddingHorizontal: 32,
          paddingVertical: 48,
        },
        blockedNoticeTitle: {
          fontSize: 16,
          fontWeight: '700',
          color: colors.text,
          marginTop: 14,
          textAlign: 'center',
        },
        blockedNoticeBody: {
          fontSize: 13,
          color: colors.secondaryText,
          marginTop: 6,
          textAlign: 'center',
          lineHeight: 19,
        },
        blockedNoticeButton: {
          marginTop: 20,
          paddingHorizontal: 20,
          paddingVertical: 10,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.primary,
        },
        blockedNoticeButtonText: {
          fontSize: 14,
          fontWeight: '600',
          color: colors.primary,
        },
        loadingContainer: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        },
        // ── Profile Header ──
        profileSection: {
          alignItems: 'center',
          paddingTop: 12,
          paddingBottom: 14,
          paddingHorizontal: 16,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        avatarContainer: {
          marginBottom: 8,
        },
        avatar: {
          width: 112,
          height: 112,
          borderRadius: 56,
          borderWidth: 3,
          borderColor: colors.primary,
        },
        avatarPlaceholder: {
          width: 112,
          height: 112,
          borderRadius: 56,
          backgroundColor: colors.primary + '14',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 3,
          borderColor: colors.primary,
        },
        avatarInitials: {
          fontSize: 36,
          fontWeight: '700',
          color: colors.primary,
        },
        photoPreviewBackdrop: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.92)',
          justifyContent: 'center',
          alignItems: 'center',
        },
        photoPreviewImage: {
          width: '92%',
          aspectRatio: 1,
          borderRadius: 16,
        },
        photoPreviewClose: {
          position: 'absolute',
          top: 56,
          right: 20,
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: 'rgba(255,255,255,0.15)',
          alignItems: 'center',
          justifyContent: 'center',
        },
        userName: {
          fontSize: 22,
          fontWeight: '700',
          color: colors.text,
          textAlign: 'center',
          marginBottom: 6,
        },
        userHandle: {
          fontSize: 13,
          color: colors.secondaryText,
          marginBottom: 12,
        },
        mutualFriendsRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 14,
          maxWidth: '92%',
        },
        mutualFriendsAvatars: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        mutualFriendAvatar: {
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 1.5,
          borderColor: colors.background,
        },
        mutualFriendAvatarFallback: {
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        },
        mutualFriendAvatarText: {
          color: '#fff',
          fontSize: 9,
          fontWeight: '700',
        },
        mutualFriendsLabel: {
          fontSize: 13,
          color: colors.secondaryText,
          flexShrink: 1,
        },
        actionRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        },
        // Friend action button (outlined hairline pill, status-colored)
        friendButton: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 18,
          paddingVertical: 8,
          borderRadius: 22,
          borderWidth: StyleSheet.hairlineWidth,
          backgroundColor: 'transparent',
          gap: 8,
        },
        friendButtonText: {
          fontSize: 13,
          fontWeight: '700',
        },
        messageButton: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 18,
          paddingVertical: 8,
          borderRadius: 22,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.primary + '66',
          backgroundColor: colors.primary + '12',
          gap: 8,
        },
        messageButtonText: {
          fontSize: 13,
          fontWeight: '700',
          color: colors.primary,
        },
        // ── Flat Section ──
        section: {
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 16,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        sectionHeaderRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        },
        sectionLabel: {
          fontSize: 12,
          fontWeight: '700',
          color: colors.secondaryText,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        },
        // ── Stats Grid (flat) ──
        statsGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
        },
        statCell: {
          width: '50%',
          paddingVertical: 12,
          alignItems: 'center',
          justifyContent: 'center',
        },
        statCellIconRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginBottom: 4,
        },
        statCellValue: {
          fontSize: 22,
          fontWeight: '800',
          color: colors.text,
        },
        statCellLabel: {
          fontSize: 12,
          color: colors.secondaryText,
          fontWeight: '500',
          marginTop: 2,
        },
        // ── Interests ──
        sportsContainer: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        },
        sportTag: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.primary + '12',
          paddingVertical: 6,
          paddingHorizontal: 12,
          borderRadius: 16,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.primary + '40',
        },
        sportEmoji: {
          fontSize: 14,
        },
        sportTagText: {
          fontSize: 13,
          marginLeft: 6,
          color: colors.text,
          fontWeight: '600',
        },
        noInterestsText: {
          fontSize: 13,
          color: colors.secondaryText,
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
          <FontAwesomeIcon icon={faArrowLeft} size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={themedStyles.title}>{t('profile.playerProfile')}</Text>
        <View style={themedStyles.headerSpacer} />
        {!isSelf && (
          <TouchableOpacity
            style={themedStyles.overflowButton}
            onPress={openOverflowMenu}
            accessibilityLabel={t('moderation.moreOptions')}>
            <FontAwesomeIcon
              icon={faEllipsisVertical}
              size={18}
              color={colors.text}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* A blocked profile collapses to a notice with a way out. The
          server hides their content from the feed anyway, so rendering
          the usual profile here would be showing something that exists
          nowhere else in the app. */}
      {isBlocked ? (
        <View style={themedStyles.blockedNotice}>
          <FontAwesomeIcon
            icon={faUserSlash}
            size={30}
            color={colors.secondaryText}
          />
          <Text style={themedStyles.blockedNoticeTitle}>
            {t('moderation.profileBlockedTitle', {
              username: username || userData?.username,
            })}
          </Text>
          <Text style={themedStyles.blockedNoticeBody}>
            {t('moderation.profileBlockedBody')}
          </Text>
          <TouchableOpacity
            style={themedStyles.blockedNoticeButton}
            onPress={handleUnblock}>
            <Text style={themedStyles.blockedNoticeButtonText}>
              {t('moderation.unblock')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={themedStyles.container}
          contentContainerStyle={themedStyles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* ── Profile Header ── */}
          <View style={themedStyles.profileSection}>
            <TouchableOpacity
              style={themedStyles.avatarContainer}
              activeOpacity={userData?.profilePicUrl ? 0.85 : 1}
              disabled={!userData?.profilePicUrl}
              onPress={() => {
                if (userData?.profilePicUrl) {
                  setPhotoPreviewVisible(true);
                }
              }}
              accessibilityRole="imagebutton"
              accessibilityLabel="View profile photo">
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
            </TouchableOpacity>

            <Text style={themedStyles.userName}>
              {userData?.name?.trim() || userData?.username}
            </Text>

            <ProfileRatingBadges
              userId={userId}
              username={userData?.username || username}
              hostAverage={hostRatingAverage}
              hostCount={hostRatingCount}
              playerAverage={playerRatingAverage}
              playerCount={playerRatingCount}
            />

            <Text style={themedStyles.userHandle}>@{userData?.username}</Text>

            {!isSelf && mutualFriendsCount > 0 ? (
              <View style={themedStyles.mutualFriendsRow}>
                {mutualFriends.length > 0 ? (
                  <View style={themedStyles.mutualFriendsAvatars}>
                    {mutualFriends.slice(0, 3).map((friend, index) => (
                      <TouchableOpacity
                        key={friend._id}
                        onPress={() =>
                          navigation.push('PublicProfile', {
                            userId: friend._id,
                            username: friend.username,
                            profilePicUrl: friend.profilePicUrl,
                          })
                        }
                        style={{marginLeft: index === 0 ? 0 : -6}}>
                        {friend.profilePicUrl ? (
                          <Image
                            source={{uri: friend.profilePicUrl}}
                            style={themedStyles.mutualFriendAvatar}
                          />
                        ) : (
                          <View
                            style={[
                              themedStyles.mutualFriendAvatar,
                              themedStyles.mutualFriendAvatarFallback,
                            ]}>
                            <Text style={themedStyles.mutualFriendAvatarText}>
                              {getInitials(friend.username)}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
                <Text style={themedStyles.mutualFriendsLabel}>
                  {mutualFriendsCount === 1
                    ? t('profile.mutualFriendOne') || '1 mutual friend'
                    : t('profile.mutualFriendsCount', {
                        count: mutualFriendsCount,
                      }) || `${mutualFriendsCount} mutual friends`}
                </Text>
              </View>
            ) : null}

            {/* Friend + Message actions */}
            {userId !== currentUser?._id && (
              <View style={themedStyles.actionRow}>
                <TouchableOpacity
                  style={[
                    themedStyles.friendButton,
                    {
                      borderColor: friendButtonConfig.color + '66',
                      backgroundColor: friendButtonConfig.color + '12',
                    },
                  ]}
                  onPress={handleFriendAction}
                  disabled={friendStatus === 'loading'}>
                  {friendStatus === 'loading' ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <FontAwesomeIcon
                        icon={friendButtonConfig.icon}
                        size={13}
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
                <TouchableOpacity
                  style={themedStyles.messageButton}
                  onPress={handleMessage}>
                  <FontAwesomeIcon
                    icon={faComment}
                    size={13}
                    color={colors.primary}
                  />
                  <Text style={themedStyles.messageButtonText}>
                    {t('messages.message') || 'Message'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            {canRatePlayer && (
              <TouchableOpacity
                style={[
                  themedStyles.messageButton,
                  {marginTop: 10, alignSelf: 'center'},
                ]}
                onPress={() => {
                  if (myPlayerScore > 0) {
                    Alert.alert(
                      'Already rated',
                      "You've already rated this player. Each person can leave one review.",
                    );
                    return;
                  }
                  setPlayerModalTarget({
                    userId,
                    username: userData?.username || username,
                  });
                  setPlayerModalVisible(true);
                }}>
                <Text style={themedStyles.messageButtonText}>
                  Rate as player
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Activity ── */}
          <View style={themedStyles.section}>
            <View style={themedStyles.sectionHeaderRow}>
              <Text style={themedStyles.sectionLabel}>
                {t('profile.activity') || 'Activity'}
              </Text>
            </View>
            <View style={themedStyles.statsGrid}>
              <View style={themedStyles.statCell}>
                <View style={themedStyles.statCellIconRow}>
                  <FontAwesomeIcon
                    icon={faCalendarPlus}
                    size={14}
                    color={colors.primary}
                  />
                  <Text style={themedStyles.statCellValue}>
                    {userStats.eventsCreated}
                  </Text>
                </View>
                <Text style={themedStyles.statCellLabel}>
                  {t('profile.created') || 'Created'}
                </Text>
              </View>

              <View style={themedStyles.statCell}>
                <View style={themedStyles.statCellIconRow}>
                  <FontAwesomeIcon
                    icon={faCalendarCheck}
                    size={14}
                    color="#4CAF50"
                  />
                  <Text style={themedStyles.statCellValue}>
                    {userStats.eventsJoined}
                  </Text>
                </View>
                <Text style={themedStyles.statCellLabel}>
                  {t('profile.joined') || 'Joined'}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Interests ── */}
          <View style={themedStyles.section}>
            <View style={themedStyles.sectionHeaderRow}>
              <Text style={themedStyles.sectionLabel}>
                {t('profile.interests') || 'Interests'}
              </Text>
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
        </ScrollView>
      )}

      <ReportSheet
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        reportedUserId={userId}
        username={username || userData?.username}
        target="user"
        onBlockRequested={isBlocked ? undefined : handleBlock}
      />

      <PlayerRatingModal
        visible={playerModalVisible}
        target={playerModalTarget}
        initialScore={myPlayerScore}
        onClose={() => setPlayerModalVisible(false)}
        onSubmitted={() => {
          setMyPlayerScore(prev => (prev > 0 ? prev : 5));
          // Refresh aggregates
          axios
            .get(`${API_BASE_URL}/user/${userId}/events/stats`)
            .then(response => {
              setPlayerRatingAverage(
                typeof response.data?.playerRatingAverage === 'number'
                  ? response.data.playerRatingAverage
                  : null,
              );
              setPlayerRatingCount(response.data?.playerRatingCount || 0);
            })
            .catch(() => {});
        }}
      />

      <Modal
        visible={photoPreviewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoPreviewVisible(false)}>
        <Pressable
          style={themedStyles.photoPreviewBackdrop}
          onPress={() => setPhotoPreviewVisible(false)}>
          <TouchableOpacity
            style={themedStyles.photoPreviewClose}
            onPress={() => setPhotoPreviewVisible(false)}
            hitSlop={12}>
            <FontAwesomeIcon icon={faTimes} size={18} color="#fff" />
          </TouchableOpacity>
          {userData?.profilePicUrl ? (
            <Image
              source={{uri: userData.profilePicUrl}}
              style={themedStyles.photoPreviewImage}
              resizeMode="cover"
            />
          ) : null}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

export default PublicProfile;
