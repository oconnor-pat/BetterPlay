import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Alert,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faArrowLeft,
  faUserMinus,
  faUser,
  faChevronRight,
  faSearch,
} from '@fortawesome/free-solid-svg-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useTheme} from '../ThemeContext/ThemeContext';
import {API_BASE_URL} from '../../config/api';


interface Friend {
  _id: string;
  username: string;
  name?: string;
  profilePicUrl?: string;
  favoriteSports?: string[];
}

const FriendsList: React.FC = () => {
  const {colors} = useTheme();
  const navigation = useNavigation<any>();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFriends = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${API_BASE_URL}/users/me/friends`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setFriends(Array.isArray(data) ? data : data.friends || []);
      } else {
        console.warn('Failed to fetch friends:', response.status);
        setFriends([]);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
      setFriends([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchFriends();
  }, [fetchFriends]);

  const handleRemoveFriend = useCallback(
    async (friendId: string, friendName: string) => {
      Alert.alert(
        'Remove Friend',
        `Are you sure you want to remove ${friendName} from your friends?`,
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                const token = await AsyncStorage.getItem('userToken');
                const response = await fetch(
                  `${API_BASE_URL}/users/me/friends/${friendId}`,
                  {
                    method: 'DELETE',
                    headers: {
                      Authorization: `Bearer ${token}`,
                    },
                  },
                );

                if (response.ok) {
                  setFriends(prev => prev.filter(f => f._id !== friendId));
                } else {
                  Alert.alert('Error', 'Failed to remove friend');
                }
              } catch (error) {
                console.error('Error removing friend:', error);
                Alert.alert('Error', 'Failed to remove friend');
              }
            },
          },
        ],
      );
    },
    [],
  );

  const navigateToProfile = (friend: Friend) => {
    navigation.navigate('PublicProfile', {
      userId: friend._id,
      username: friend.username,
      profilePicUrl: friend.profilePicUrl,
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0]?.toUpperCase())
      .join('')
      .slice(0, 2);
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: colors.background,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        backButton: {
          padding: 8,
          marginRight: 12,
        },
        headerTitle: {
          fontSize: 22,
          fontWeight: '700',
          color: colors.text,
          flex: 1,
        },
        headerCount: {
          fontSize: 15,
          fontWeight: '600',
          color: colors.placeholder,
          backgroundColor: colors.card,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 12,
          overflow: 'hidden',
        },
        loadingContainer: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        },
        listContent: {
          padding: 16,
          gap: 12,
        },
        listContentEmpty: {
          padding: 16,
          flex: 1,
        },
        // Empty state
        emptyContainer: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 40,
        },
        emptyIconContainer: {
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: colors.primary + '15',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
        },
        emptyText: {
          fontSize: 20,
          fontWeight: '700',
          color: colors.text,
          marginBottom: 8,
          textAlign: 'center',
        },
        emptySubtext: {
          fontSize: 15,
          color: colors.placeholder,
          textAlign: 'center',
          lineHeight: 22,
          marginBottom: 24,
        },
        emptyButton: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.primary,
          paddingHorizontal: 24,
          paddingVertical: 12,
          borderRadius: 24,
          gap: 8,
        },
        emptyButtonText: {
          fontSize: 15,
          fontWeight: '600',
          color: '#fff',
        },
        // Friend card
        friendCard: {
          backgroundColor: colors.card,
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
        friendCardContent: {
          flexDirection: 'row',
          alignItems: 'center',
          padding: 14,
        },
        avatarContainer: {
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: colors.primary + '20',
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 14,
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: colors.primary + '40',
        },
        avatarImage: {
          width: 52,
          height: 52,
          borderRadius: 26,
        },
        avatarText: {
          color: colors.primary,
          fontSize: 18,
          fontWeight: '700',
        },
        friendInfo: {
          flex: 1,
        },
        friendName: {
          fontSize: 16,
          fontWeight: '700',
          color: colors.text,
          marginBottom: 2,
        },
        friendUsername: {
          fontSize: 13,
          color: colors.placeholder,
        },
        friendActions: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        viewProfileButton: {
          padding: 8,
        },
        removeButton: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.error + '15',
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 10,
          gap: 6,
        },
        removeButtonText: {
          fontSize: 13,
          fontWeight: '600',
          color: colors.error,
        },
      }),
    [colors],
  );

  const renderFriend = ({item}: {item: Friend}) => (
    <View style={styles.friendCard}>
      <View style={styles.friendCardContent}>
        <TouchableOpacity
          onPress={() => navigateToProfile(item)}
          activeOpacity={0.7}
          style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
          <View style={styles.avatarContainer}>
            {item.profilePicUrl ? (
              <Image
                source={{uri: item.profilePicUrl}}
                style={styles.avatarImage}
              />
            ) : (
              <Text style={styles.avatarText}>
                {getInitials(item.username)}
              </Text>
            )}
          </View>

          <View style={styles.friendInfo}>
            <Text style={styles.friendName} numberOfLines={1}>
              {item.name || item.username}
            </Text>
            <Text style={styles.friendUsername} numberOfLines={1}>
              @{item.username}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.friendActions}>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() =>
              handleRemoveFriend(item._id, item.name || item.username)
            }>
            <FontAwesomeIcon
              icon={faUserMinus}
              size={13}
              color={colors.error}
            />
            <Text style={styles.removeButtonText}>Unfriend</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.viewProfileButton}
            onPress={() => navigateToProfile(item)}>
            <FontAwesomeIcon
              icon={faChevronRight}
              size={13}
              color={colors.placeholder}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <FontAwesomeIcon icon={faUser} size={32} color={colors.primary} />
      </View>
      <Text style={styles.emptyText}>No Friends Yet</Text>
      <Text style={styles.emptySubtext}>
        Find people through search or at events and add them as friends!
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => navigation.navigate('UserSearch')}>
        <FontAwesomeIcon icon={faSearch} size={14} color="#fff" />
        <Text style={styles.emptyButtonText}>Find People</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}>
            <FontAwesomeIcon icon={faArrowLeft} size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Friends</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <FontAwesomeIcon icon={faArrowLeft} size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Friends</Text>
        <Text style={styles.headerCount}>{friends.length}</Text>
      </View>

      <FlatList
        data={friends}
        renderItem={renderFriend}
        keyExtractor={item => item._id}
        contentContainerStyle={
          friends.length === 0 ? styles.listContentEmpty : styles.listContent
        }
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      />
    </SafeAreaView>
  );
};

export default FriendsList;
