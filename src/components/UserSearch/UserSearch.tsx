import React, {useState, useEffect, useCallback, useContext} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faSearch,
  faTimes,
  faArrowLeft,
  faFilter,
  faLocationArrow,
} from '@fortawesome/free-solid-svg-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useTheme} from '../ThemeContext/ThemeContext';
import {API_BASE_URL} from '../../config/api';
import locationService, {Coordinates} from '../../services/LocationService';
import UserSearchCard, {FriendStatus} from './UserSearchCard';
import UserContext, {UserContextType} from '../UserContext';

// Helper to add opacity to hex colors (handles both 3 and 6 char hex)
const addOpacity = (hex: string, opacity: number): string => {
  // Remove # if present
  let color = hex.replace('#', '');
  // Expand 3-char hex to 6-char
  if (color.length === 3) {
    color = color[0] + color[0] + color[1] + color[1] + color[2] + color[2];
  }
  // Convert opacity (0-1) to hex (00-FF)
  const alpha = Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${color}${alpha}`;
};

interface User {
  _id: string;
  username: string;
  name?: string;
  profilePicUrl?: string;
  favoriteActivities?: string[];
  eventsCreated?: number;
  eventsJoined?: number;
  distance?: number; // miles, returned by backend when proximity query is active
}

const PROXIMITY_PRESETS = [
  {label: '5 mi', value: 5},
  {label: '10 mi', value: 10},
  {label: '25 mi', value: 25},
  {label: '50 mi', value: 50},
  {label: '100 mi', value: 100},
];

// All activities for filtering (matches EventList activityOptions)
const INTEREST_FILTERS = [
  {id: 'all', label: 'All', emoji: '🎯'},
  // Sports
  {id: 'basketball', label: 'Basketball', emoji: '🏀'},
  {id: 'hockey', label: 'Hockey', emoji: '🏒'},
  {id: 'soccer', label: 'Soccer', emoji: '⚽'},
  {id: 'figure-skating', label: 'Figure Skating', emoji: '⛸️'},
  {id: 'tennis', label: 'Tennis', emoji: '🎾'},
  {id: 'golf', label: 'Golf', emoji: '⛳'},
  {id: 'football', label: 'Football', emoji: '🏈'},
  {id: 'rugby', label: 'Rugby', emoji: '🏉'},
  {id: 'baseball', label: 'Baseball', emoji: '⚾'},
  {id: 'softball', label: 'Softball', emoji: '🥎'},
  {id: 'lacrosse', label: 'Lacrosse', emoji: '🥍'},
  {id: 'volleyball', label: 'Volleyball', emoji: '🏐'},
  // Social & Entertainment
  {id: 'trivia', label: 'Trivia Night', emoji: '🧠'},
  {id: 'game-nights', label: 'Game Night', emoji: '🎲'},
  {id: 'karaoke', label: 'Karaoke', emoji: '🎤'},
  {id: 'open-mic', label: 'Open Mic', emoji: '🎙️'},
  {id: 'watch-party', label: 'Watch Party', emoji: '📺'},
  {id: 'live-music', label: 'Live Music', emoji: '🎵'},
  // Outdoor & Fitness
  {id: 'hiking', label: 'Hiking', emoji: '🥾'},
  {id: 'cycling', label: 'Cycling', emoji: '🚴'},
  {id: 'running', label: 'Running', emoji: '🏃'},
  {id: 'yoga', label: 'Yoga', emoji: '🧘'},
  {id: 'fishing', label: 'Fishing', emoji: '🎣'},
  {id: 'camping', label: 'Camping', emoji: '🏕️'},
  // Community & Learning
  {id: 'book-club', label: 'Book Club', emoji: '📚'},
  {id: 'workshops', label: 'Workshop', emoji: '🛠️'},
  {id: 'meetup', label: 'Meetup', emoji: '🤝'},
  {id: 'cooking', label: 'Potluck', emoji: '🍲'},
  {id: 'volunteering', label: 'Volunteer', emoji: '💚'},
  // Other
  {id: 'other', label: 'Other', emoji: '🎯'},
];

const UserSearch: React.FC = () => {
  const {colors} = useTheme();
  const navigation = useNavigation<any>();
  const {userData} = useContext(UserContext) as UserContextType;

  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedInterest, setSelectedInterest] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // Proximity filter state
  const [proximityEnabled, setProximityEnabled] = useState(false);
  const [proximityRadius, setProximityRadius] = useState(25); // miles
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  // Friend status tracking
  const [friendStatuses, setFriendStatuses] = useState<
    Record<string, FriendStatus>
  >({});
  const [friends, setFriends] = useState<string[]>([]);
  const [sentRequests, setSentRequests] = useState<string[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<string[]>([]);

  // Fetch friend data
  const fetchFriendData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');

      // Fetch friends list
      const friendsRes = await fetch(`${API_BASE_URL}/users/me/friends`, {
        headers: {Authorization: `Bearer ${token}`},
      });
      if (friendsRes.ok) {
        const data = await friendsRes.json();
        const friendIds = (Array.isArray(data) ? data : data.friends || []).map(
          (f: any) => f._id,
        );
        setFriends(friendIds);
      }

      // Fetch outgoing requests
      const outgoingRes = await fetch(
        `${API_BASE_URL}/users/me/friend-requests/outgoing`,
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );
      if (outgoingRes.ok) {
        const data = await outgoingRes.json();
        const requestIds = (
          Array.isArray(data) ? data : data.requests || []
        ).map((r: any) => r._id);
        setSentRequests(requestIds);
      }

      // Fetch incoming requests
      const incomingRes = await fetch(
        `${API_BASE_URL}/users/me/friend-requests/incoming`,
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );
      if (incomingRes.ok) {
        const data = await incomingRes.json();
        const requestIds = (
          Array.isArray(data) ? data : data.requests || []
        ).map((r: any) => r._id);
        setIncomingRequests(requestIds);
      }
    } catch (error) {
      console.error('Error fetching friend data:', error);
    }
  }, []);

  // Compute friend statuses when data changes
  useEffect(() => {
    const statuses: Record<string, FriendStatus> = {};
    users.forEach(user => {
      if (friends.includes(user._id)) {
        statuses[user._id] = 'friends';
      } else if (sentRequests.includes(user._id)) {
        statuses[user._id] = 'pending';
      } else if (incomingRequests.includes(user._id)) {
        statuses[user._id] = 'incoming';
      } else {
        statuses[user._id] = 'none';
      }
    });
    setFriendStatuses(statuses);
  }, [users, friends, sentRequests, incomingRequests]);

  // Fetch all users from the backend
  const fetchUsers = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');

      let url = `${API_BASE_URL}/users`;
      if (proximityEnabled && userLocation) {
        const params = new URLSearchParams({
          lat: userLocation.latitude.toString(),
          lng: userLocation.longitude.toString(),
          maxDistance: proximityRadius.toString(),
        });
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Ensure data is an array before filtering
        if (Array.isArray(data)) {
          // Filter out the current user from results
          const otherUsers = data.filter(
            (user: User) => user._id !== userData?._id,
          );
          setUsers(otherUsers);
          setFilteredUsers(otherUsers);
        } else if (data.users && Array.isArray(data.users)) {
          const otherUsers = data.users.filter(
            (user: User) => user._id !== userData?._id,
          );
          setUsers(otherUsers);
          setFilteredUsers(otherUsers);
        } else {
          console.warn('Unexpected API response format:', data);
          setUsers([]);
          setFilteredUsers([]);
        }
      } else {
        console.warn('Failed to fetch users:', response.status);
        setUsers([]);
        setFilteredUsers([]);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
      setFilteredUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userData?._id, proximityEnabled, userLocation, proximityRadius]);

  useEffect(() => {
    fetchUsers();
    fetchFriendData();
  }, [fetchUsers, fetchFriendData]);

  // Check if the search query matches an activity name
  const matchedActivity = searchQuery.trim()
    ? INTEREST_FILTERS.find(
        f =>
          f.id !== 'all' &&
          f.label.toLowerCase().includes(searchQuery.toLowerCase().trim()),
      )
    : null;

  // Filter users based on search query and selected interest
  useEffect(() => {
    let results = users;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();

      // Check if the query matches an activity/interest name
      const activityMatch = INTEREST_FILTERS.find(
        f =>
          f.id !== 'all' &&
          (f.label.toLowerCase() === query ||
            f.id.toLowerCase() === query),
      );

      if (activityMatch) {
        // Exact activity match: filter by that interest
        results = results.filter(user =>
          user.favoriteActivities?.some(
            a => a.toLowerCase() === activityMatch.id.toLowerCase(),
          ),
        );
      } else {
        // Search by username, name, OR activity
        results = results.filter(
          user =>
            user.username.toLowerCase().includes(query) ||
            (user.name && user.name.toLowerCase().includes(query)) ||
            user.favoriteActivities?.some(a =>
              a.toLowerCase().includes(query),
            ),
        );
      }
    }

    // Filter by selected interest chip
    if (selectedInterest !== 'all') {
      results = results.filter(user =>
        user.favoriteActivities?.some(
          activity =>
            activity.toLowerCase() === selectedInterest.toLowerCase(),
        ),
      );
    }

    setFilteredUsers(results);
  }, [searchQuery, selectedInterest, users]);

  // Toggle proximity filter
  const handleProximityToggle = useCallback(async () => {
    if (proximityEnabled) {
      setProximityEnabled(false);
      return;
    }

    const locEnabled = await AsyncStorage.getItem('locationEnabled');
    if (locEnabled !== 'true') {
      Alert.alert(
        'Location Required',
        'Enable Location Services in Settings to find nearby players.',
      );
      return;
    }

    setLocationLoading(true);
    try {
      const coords = await locationService.getLocation();
      if (coords) {
        setUserLocation(coords);
        setProximityEnabled(true);
      } else {
        Alert.alert(
          'Location Unavailable',
          'Could not determine your location. Please try again.',
        );
      }
    } catch {
      Alert.alert(
        'Location Error',
        'Could not determine your location. Please try again.',
      );
    } finally {
      setLocationLoading(false);
    }
  }, [proximityEnabled]);

  // Re-fetch users when proximity settings change
  useEffect(() => {
    if (proximityEnabled && userLocation) {
      setLoading(true);
      fetchUsers();
    } else if (!proximityEnabled) {
      setLoading(true);
      fetchUsers();
    }
  }, [proximityEnabled, proximityRadius, userLocation, fetchUsers]);

  // Handle friend action (send request, cancel, accept, etc.)
  const handleFriendAction = useCallback(
    async (userId: string, currentStatus: FriendStatus) => {
      const token = await AsyncStorage.getItem('userToken');

      // Set loading state
      setFriendStatuses(prev => ({...prev, [userId]: 'loading'}));

      try {
        switch (currentStatus) {
          case 'none':
            // Send friend request
            const sendRes = await fetch(
              `${API_BASE_URL}/users/${userId}/friend-request`,
              {
                method: 'POST',
                headers: {Authorization: `Bearer ${token}`},
              },
            );
            if (sendRes.ok) {
              setSentRequests(prev => [...prev, userId]);
              setFriendStatuses(prev => ({...prev, [userId]: 'pending'}));
            } else {
              Alert.alert('Error', 'Failed to send friend request');
              setFriendStatuses(prev => ({...prev, [userId]: 'none'}));
            }
            break;

          case 'pending':
            // Cancel friend request
            Alert.alert('Cancel Request', 'Cancel this friend request?', [
              {
                text: 'No',
                style: 'cancel',
                onPress: () =>
                  setFriendStatuses(prev => ({...prev, [userId]: 'pending'})),
              },
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
                  if (cancelRes.ok) {
                    setSentRequests(prev => prev.filter(id => id !== userId));
                    setFriendStatuses(prev => ({...prev, [userId]: 'none'}));
                  } else {
                    setFriendStatuses(prev => ({
                      ...prev,
                      [userId]: 'pending',
                    }));
                  }
                },
              },
            ]);
            break;

          case 'incoming':
            // Accept incoming request
            const acceptRes = await fetch(
              `${API_BASE_URL}/users/me/friend-requests/${userId}/accept`,
              {
                method: 'POST',
                headers: {Authorization: `Bearer ${token}`},
              },
            );
            if (acceptRes.ok) {
              setIncomingRequests(prev => prev.filter(id => id !== userId));
              setFriends(prev => [...prev, userId]);
              setFriendStatuses(prev => ({...prev, [userId]: 'friends'}));
              Alert.alert('Success', 'Friend request accepted!');
            } else {
              setFriendStatuses(prev => ({...prev, [userId]: 'incoming'}));
            }
            break;

          case 'friends':
            // Already friends - show profile or unfriend option
            Alert.alert(
              'Already Friends',
              'You are already friends with this user.',
              [{text: 'OK'}],
            );
            setFriendStatuses(prev => ({...prev, [userId]: 'friends'}));
            break;

          default:
            break;
        }
      } catch (error) {
        console.error('Friend action error:', error);
        Alert.alert('Error', 'Something went wrong');
        // Reset to previous status
        fetchFriendData();
      }
    },
    [fetchFriendData],
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchUsers();
    fetchFriendData();
  };

  const handleUserPress = (user: User) => {
    navigation.navigate('PublicProfile', {
      userId: user._id,
      username: user.username,
      profilePicUrl: user.profilePicUrl,
    });
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.card,
    },
    backButton: {
      padding: 8,
      marginRight: 8,
    },
    headerTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    filterButton: {
      padding: 8,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 8,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      height: 44,
      fontSize: 16,
      color: colors.text,
    },
    clearButton: {
      padding: 8,
    },
    filtersContainer: {
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    filtersScroll: {
      flexDirection: 'row',
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      marginRight: 8,
      borderWidth: 1,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterChipInactive: {
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    filterEmoji: {
      fontSize: 14,
      marginRight: 6,
    },
    filterLabel: {
      fontSize: 13,
      fontWeight: '500',
    },
    filterLabelActive: {
      color: '#FFFFFF',
    },
    filterLabelInactive: {
      color: colors.text,
    },
    listContainer: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    emptyText: {
      fontSize: 16,
      color: colors.text,
      textAlign: 'center',
      opacity: 0.6,
      marginTop: 12,
    },
    resultsCount: {
      fontSize: 13,
      color: colors.text,
      opacity: 0.6,
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    activitySuggestion: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginBottom: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: colors.primary + '15',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary + '30',
    },
    activitySuggestionEmoji: {
      fontSize: 16,
      marginRight: 8,
    },
    activitySuggestionText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '500',
      color: colors.primary,
    },
    activeInterestTag: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      marginHorizontal: 16,
      marginBottom: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.primary + '20',
      borderRadius: 16,
    },
    activeInterestTagText: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.primary,
      marginRight: 8,
    },
    proximityContainer: {
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    proximityToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    proximityToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
    },
    proximityToggleActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    proximityToggleInactive: {
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    proximityToggleText: {
      fontSize: 13,
      fontWeight: '600',
      marginLeft: 6,
    },
    proximityPresetsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    proximityPreset: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
    },
    proximityPresetActive: {
      backgroundColor: colors.primary + '20',
      borderColor: colors.primary,
    },
    proximityPresetInactive: {
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    proximityPresetText: {
      fontSize: 12,
      fontWeight: '500',
    },
    proximityPresetTextActive: {
      color: colors.primary,
    },
    proximityPresetTextInactive: {
      color: colors.text,
    },
  });

  const renderUser = ({item}: {item: User}) => (
    <UserSearchCard
      user={item}
      onPress={() => handleUserPress(item)}
      friendStatus={friendStatuses[item._id] || 'none'}
      onFriendAction={() =>
        handleFriendAction(item._id, friendStatuses[item._id] || 'none')
      }
      distance={proximityEnabled ? item.distance : undefined}
    />
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <FontAwesomeIcon icon={faSearch} size={48} color={colors.border} />
      <Text style={styles.emptyText}>
        {searchQuery || selectedInterest !== 'all'
          ? 'No players found matching your criteria'
          : 'No players available'}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}>
            <FontAwesomeIcon icon={faArrowLeft} size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Find Players</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <FontAwesomeIcon icon={faArrowLeft} size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find Players</Text>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(!showFilters)}>
          <FontAwesomeIcon
            icon={faFilter}
            size={18}
            color={selectedInterest !== 'all' ? colors.primary : colors.text}
          />
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <FontAwesomeIcon
          icon={faSearch}
          size={16}
          color={colors.text}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, username, or interest..."
          placeholderTextColor={addOpacity(colors.text, 0.5)}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={clearSearch}>
            <FontAwesomeIcon icon={faTimes} size={16} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>

      {/* Activity suggestion when search matches an interest */}
      {matchedActivity && selectedInterest === 'all' && (
        <TouchableOpacity
          style={styles.activitySuggestion}
          onPress={() => {
            setSelectedInterest(matchedActivity.id);
            setSearchQuery('');
          }}>
          <Text style={styles.activitySuggestionEmoji}>
            {matchedActivity.emoji}
          </Text>
          <Text style={styles.activitySuggestionText}>
            Filter by {matchedActivity.label}
          </Text>
          <FontAwesomeIcon icon={faFilter} size={12} color={colors.primary} />
        </TouchableOpacity>
      )}

      {/* Interest Filters */}
      {showFilters && (
        <View style={styles.filtersContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={INTEREST_FILTERS}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.filtersScroll}
            renderItem={({item}) => (
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  selectedInterest === item.id
                    ? styles.filterChipActive
                    : styles.filterChipInactive,
                ]}
                onPress={() => setSelectedInterest(item.id)}>
                <Text style={styles.filterEmoji}>{item.emoji}</Text>
                <Text
                  style={[
                    styles.filterLabel,
                    selectedInterest === item.id
                      ? styles.filterLabelActive
                      : styles.filterLabelInactive,
                  ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Proximity Filter */}
      <View style={styles.proximityContainer}>
        <View style={styles.proximityToggleRow}>
          <TouchableOpacity
            style={[
              styles.proximityToggle,
              proximityEnabled
                ? styles.proximityToggleActive
                : styles.proximityToggleInactive,
            ]}
            onPress={handleProximityToggle}
            disabled={locationLoading}>
            {locationLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <FontAwesomeIcon
                icon={faLocationArrow}
                size={14}
                color={proximityEnabled ? '#FFFFFF' : colors.text}
              />
            )}
            <Text
              style={[
                styles.proximityToggleText,
                {color: proximityEnabled ? '#FFFFFF' : colors.text},
              ]}>
              Nearby
            </Text>
          </TouchableOpacity>
        </View>
        {proximityEnabled && (
          <View style={styles.proximityPresetsRow}>
            {PROXIMITY_PRESETS.map(preset => (
              <TouchableOpacity
                key={preset.value}
                style={[
                  styles.proximityPreset,
                  proximityRadius === preset.value
                    ? styles.proximityPresetActive
                    : styles.proximityPresetInactive,
                ]}
                onPress={() => setProximityRadius(preset.value)}>
                <Text
                  style={[
                    styles.proximityPresetText,
                    proximityRadius === preset.value
                      ? styles.proximityPresetTextActive
                      : styles.proximityPresetTextInactive,
                  ]}>
                  {preset.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Active interest filter tag */}
      {selectedInterest !== 'all' && (
        <TouchableOpacity
          style={styles.activeInterestTag}
          onPress={() => setSelectedInterest('all')}>
          <Text style={styles.activeInterestTagText}>
            {INTEREST_FILTERS.find(f => f.id === selectedInterest)?.emoji}{' '}
            {INTEREST_FILTERS.find(f => f.id === selectedInterest)?.label}
          </Text>
          <FontAwesomeIcon icon={faTimes} size={12} color={colors.primary} />
        </TouchableOpacity>
      )}

      {/* Results Count */}
      <Text style={styles.resultsCount}>
        {filteredUsers.length} player{filteredUsers.length !== 1 ? 's' : ''}{' '}
        found
        {proximityEnabled ? ` within ${proximityRadius} mi` : ''}
      </Text>

      {/* User List */}
      <View style={styles.listContainer}>
        <FlatList
          data={filteredUsers}
          renderItem={renderUser}
          keyExtractor={item => item._id}
          ListEmptyComponent={renderEmptyList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        />
      </View>
    </SafeAreaView>
  );
};

export default UserSearch;
