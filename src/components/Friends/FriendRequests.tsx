import React, {useState, useEffect, useCallback} from 'react';
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
  faCheck,
  faTimes,
  faInbox,
  faPaperPlane,
} from '@fortawesome/free-solid-svg-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useTheme} from '../ThemeContext/ThemeContext';
import {API_BASE_URL} from '../../config/api';

interface FriendRequest {
  _id: string;
  username: string;
  name?: string;
  profilePicUrl?: string;
}

type TabType = 'incoming' | 'outgoing';

const FriendRequests: React.FC = () => {
  const {colors} = useTheme();
  const navigation = useNavigation<any>();

  const [activeTab, setActiveTab] = useState<TabType>('incoming');
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');

      // Fetch incoming requests
      const incomingRes = await fetch(
        `${API_BASE_URL}/users/me/friend-requests/incoming`,
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );

      // Fetch outgoing requests
      const outgoingRes = await fetch(
        `${API_BASE_URL}/users/me/friend-requests/outgoing`,
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );

      if (incomingRes.ok) {
        const data = await incomingRes.json();
        setIncomingRequests(Array.isArray(data) ? data : data.requests || []);
      }

      if (outgoingRes.ok) {
        const data = await outgoingRes.json();
        setOutgoingRequests(Array.isArray(data) ? data : data.requests || []);
      }
    } catch (error) {
      console.error('Error fetching friend requests:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRequests();
  }, [fetchRequests]);

  const handleAcceptRequest = useCallback(async (userId: string) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(
        `${API_BASE_URL}/users/me/friend-requests/${userId}/accept`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.ok) {
        setIncomingRequests(prev => prev.filter(r => r._id !== userId));
        Alert.alert('Success', 'Friend request accepted!');
      } else {
        Alert.alert('Error', 'Failed to accept request');
      }
    } catch (error) {
      console.error('Error accepting request:', error);
      Alert.alert('Error', 'Failed to accept request');
    }
  }, []);

  const handleDeclineRequest = useCallback(async (userId: string) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(
        `${API_BASE_URL}/users/me/friend-requests/${userId}/decline`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.ok) {
        setIncomingRequests(prev => prev.filter(r => r._id !== userId));
      } else {
        Alert.alert('Error', 'Failed to decline request');
      }
    } catch (error) {
      console.error('Error declining request:', error);
      Alert.alert('Error', 'Failed to decline request');
    }
  }, []);

  const handleCancelRequest = useCallback(async (userId: string) => {
    Alert.alert(
      'Cancel Request',
      'Are you sure you want to cancel this friend request?',
      [
        {text: 'No', style: 'cancel'},
        {
          text: 'Yes',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('userToken');
              const response = await fetch(
                `${API_BASE_URL}/users/me/friend-requests/${userId}/cancel`,
                {
                  method: 'DELETE',
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                },
              );

              if (response.ok) {
                setOutgoingRequests(prev => prev.filter(r => r._id !== userId));
              } else {
                Alert.alert('Error', 'Failed to cancel request');
              }
            } catch (error) {
              console.error('Error canceling request:', error);
              Alert.alert('Error', 'Failed to cancel request');
            }
          },
        },
      ],
    );
  }, []);

  const navigateToProfile = (request: FriendRequest) => {
    navigation.navigate('PublicProfile', {
      userId: request._id,
      username: request.username,
      profilePicUrl: request.profilePicUrl,
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0]?.toUpperCase())
      .join('')
      .slice(0, 2);
  };

  const styles = StyleSheet.create({
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
    tabContainer: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: 8,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
    },
    activeTab: {
      backgroundColor: colors.primary + '14',
      borderColor: colors.primary,
    },
    inactiveTab: {
      backgroundColor: 'transparent',
      borderColor: colors.border,
    },
    tabText: {
      fontSize: 13,
      fontWeight: '700',
      marginLeft: 8,
    },
    activeTabText: {
      color: colors.primary,
    },
    inactiveTabText: {
      color: colors.secondaryText,
    },
    badge: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      minWidth: 18,
      height: 18,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 6,
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '700',
      paddingHorizontal: 5,
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
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
      paddingVertical: 64,
    },
    emptyIcon: {
      marginBottom: 14,
      opacity: 0.4,
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
    },
    requestCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    avatarContainer: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
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
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    requestInfo: {
      flex: 1,
    },
    requestName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    requestUsername: {
      fontSize: 12,
      color: colors.secondaryText,
      marginTop: 2,
    },
    actionButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    actionButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      backgroundColor: 'transparent',
    },
    acceptButton: {
      borderColor: '#4CAF50',
      backgroundColor: '#4CAF5012',
    },
    declineButton: {
      borderColor: colors.error,
      backgroundColor: (colors.error || '#FF6B6B') + '12',
    },
    cancelButton: {
      borderColor: colors.border,
      backgroundColor: 'transparent',
    },
  });

  const renderIncomingRequest = ({item}: {item: FriendRequest}) => (
    <TouchableOpacity
      style={styles.requestCard}
      onPress={() => navigateToProfile(item)}
      activeOpacity={0.7}>
      <View style={styles.avatarContainer}>
        {item.profilePicUrl ? (
          <Image
            source={{uri: item.profilePicUrl}}
            style={styles.avatarImage}
          />
        ) : (
          <Text style={styles.avatarText}>{getInitials(item.username)}</Text>
        )}
      </View>

      <View style={styles.requestInfo}>
        <Text style={styles.requestName}>{item.name || item.username}</Text>
        {item.name && (
          <Text style={styles.requestUsername}>@{item.username}</Text>
        )}
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPress={() => handleAcceptRequest(item._id)}>
          <FontAwesomeIcon icon={faCheck} size={14} color="#4CAF50" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.declineButton]}
          onPress={() => handleDeclineRequest(item._id)}>
          <FontAwesomeIcon icon={faTimes} size={14} color={colors.error} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderOutgoingRequest = ({item}: {item: FriendRequest}) => (
    <TouchableOpacity
      style={styles.requestCard}
      onPress={() => navigateToProfile(item)}
      activeOpacity={0.7}>
      <View style={styles.avatarContainer}>
        {item.profilePicUrl ? (
          <Image
            source={{uri: item.profilePicUrl}}
            style={styles.avatarImage}
          />
        ) : (
          <Text style={styles.avatarText}>{getInitials(item.username)}</Text>
        )}
      </View>

      <View style={styles.requestInfo}>
        <Text style={styles.requestName}>{item.name || item.username}</Text>
        {item.name && (
          <Text style={styles.requestUsername}>@{item.username}</Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.actionButton, styles.cancelButton]}
        onPress={() => handleCancelRequest(item._id)}>
        <FontAwesomeIcon
          icon={faTimes}
          size={14}
          color={colors.secondaryText}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderEmptyIncoming = () => (
    <View style={styles.emptyContainer}>
      <FontAwesomeIcon
        icon={faInbox}
        size={36}
        color={colors.secondaryText}
        style={styles.emptyIcon}
      />
      <Text style={styles.emptyText}>No Pending Requests</Text>
      <Text style={styles.emptySubtext}>
        When someone sends you a friend request, it will appear here.
      </Text>
    </View>
  );

  const renderEmptyOutgoing = () => (
    <View style={styles.emptyContainer}>
      <FontAwesomeIcon
        icon={faPaperPlane}
        size={36}
        color={colors.secondaryText}
        style={styles.emptyIcon}
      />
      <Text style={styles.emptyText}>No Sent Requests</Text>
      <Text style={styles.emptySubtext}>
        Friend requests you send will appear here until accepted.
      </Text>
    </View>
  );

  const currentData =
    activeTab === 'incoming' ? incomingRequests : outgoingRequests;

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}>
            <FontAwesomeIcon icon={faArrowLeft} size={18} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Friend Requests</Text>
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
        <Text style={styles.headerTitle}>Friend Requests</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'incoming' ? styles.activeTab : styles.inactiveTab,
          ]}
          onPress={() => setActiveTab('incoming')}>
          <FontAwesomeIcon
            icon={faInbox}
            size={13}
            color={
              activeTab === 'incoming' ? colors.primary : colors.secondaryText
            }
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'incoming'
                ? styles.activeTabText
                : styles.inactiveTabText,
            ]}>
            Received
          </Text>
          {incomingRequests.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{incomingRequests.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'outgoing' ? styles.activeTab : styles.inactiveTab,
          ]}
          onPress={() => setActiveTab('outgoing')}>
          <FontAwesomeIcon
            icon={faPaperPlane}
            size={13}
            color={
              activeTab === 'outgoing' ? colors.primary : colors.secondaryText
            }
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'outgoing'
                ? styles.activeTabText
                : styles.inactiveTabText,
            ]}>
            Sent
          </Text>
          {outgoingRequests.length > 0 && (
            <View
              style={[styles.badge, {backgroundColor: colors.secondaryText}]}>
              <Text style={styles.badgeText}>{outgoingRequests.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={currentData}
        renderItem={
          activeTab === 'incoming'
            ? renderIncomingRequest
            : renderOutgoingRequest
        }
        keyExtractor={item => item._id}
        contentContainerStyle={
          currentData.length === 0
            ? styles.listContentEmpty
            : styles.listContent
        }
        ListEmptyComponent={
          activeTab === 'incoming' ? renderEmptyIncoming : renderEmptyOutgoing
        }
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

export default FriendRequests;
