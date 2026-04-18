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
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faArrowLeft,
  faUserMinus,
  faUser,
  faChevronRight,
  faUserPlus,
  faSearch,
} from '@fortawesome/free-solid-svg-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useTheme} from '../ThemeContext/ThemeContext';
import {API_BASE_URL} from '../../config/api';
import {useTranslation} from 'react-i18next';

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
  const {t} = useTranslation();

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
          paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        backButton: {
          padding: 8,
          marginRight: 4,
        },
        headerTitle: {
          fontSize: 16,
          fontWeight: '700',
          color: colors.text,
          flex: 1,
        },
        headerCount: {
          fontSize: 12,
          fontWeight: '700',
          color: colors.secondaryText,
          backgroundColor: 'transparent',
          paddingHorizontal: 10,
          paddingVertical: 3,
          borderRadius: 12,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          overflow: 'hidden',
        },
        loadingContainer: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        },
        listContent: {
          paddingTop: 4,
          paddingBottom: 16,
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
          paddingVertical: 64,
        },
        emptyIconContainer: {
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.primary + '12',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.primary + '40',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        },
        emptyText: {
          fontSize: 16,
          fontWeight: '700',
          color: colors.text,
          marginBottom: 6,
          textAlign: 'center',
        },
        emptySubtext: {
          fontSize: 13,
          color: colors.secondaryText,
          textAlign: 'center',
          lineHeight: 19,
          marginBottom: 20,
        },
        emptyButton: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.primary,
          paddingHorizontal: 18,
          paddingVertical: 10,
          borderRadius: 22,
          gap: 8,
        },
        emptyButtonText: {
          fontSize: 14,
          fontWeight: '700',
          color: '#fff',
        },
        // Friend row
        friendCard: {
          backgroundColor: colors.background,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        friendCardContent: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
        },
        friendTapArea: {
          flexDirection: 'row',
          alignItems: 'center',
          flex: 1,
        },
        avatarContainer: {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: colors.primary + '20',
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 12,
          overflow: 'hidden',
        },
        avatarImage: {
          width: 44,
          height: 44,
          borderRadius: 22,
        },
        avatarText: {
          color: colors.primary,
          fontSize: 16,
          fontWeight: '700',
        },
        friendInfo: {
          flex: 1,
        },
        friendName: {
          fontSize: 15,
          fontWeight: '700',
          color: colors.text,
          marginBottom: 2,
        },
        friendUsername: {
          fontSize: 12,
          color: colors.secondaryText,
        },
        friendActions: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        },
        viewProfileButton: {
          padding: 6,
        },
        removeButton: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'transparent',
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 18,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.error,
          gap: 6,
        },
        removeButtonText: {
          fontSize: 12,
          fontWeight: '700',
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
          style={styles.friendTapArea}>
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
              size={11}
              color={colors.error}
            />
            <Text style={styles.removeButtonText}>Unfriend</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.viewProfileButton}
            onPress={() => navigateToProfile(item)}>
            <FontAwesomeIcon
              icon={faChevronRight}
              size={12}
              color={colors.secondaryText}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconContainer}>
        <FontAwesomeIcon icon={faUser} size={26} color={colors.primary} />
      </View>
      <Text style={styles.emptyText}>No Friends Yet</Text>
      <Text style={styles.emptySubtext}>
        Find people through search or at events and add them as friends!
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        onPress={() => navigation.navigate('UserSearch')}>
        <FontAwesomeIcon icon={faSearch} size={13} color="#fff" />
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
            <FontAwesomeIcon icon={faArrowLeft} size={18} color={colors.text} />
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
          <FontAwesomeIcon icon={faArrowLeft} size={18} color={colors.text} />
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
