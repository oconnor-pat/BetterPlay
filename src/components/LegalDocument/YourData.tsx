import React, {useState, useEffect, useContext} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Share,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {useTheme} from '../ThemeContext/ThemeContext';
import {useTranslation} from 'react-i18next';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {YourDataSkeleton} from '../Skeleton';
import {
  faArrowLeft,
  faDownload,
  faUser,
  faCalendarAlt,
  faUsers,
  faComments,
  faMapMarkerAlt,
} from '@fortawesome/free-solid-svg-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import {API_BASE_URL} from '../../config/api';
import UserContext, {UserContextType} from '../UserContext';

interface UserDataResponse {
  profile: {
    id?: string;
    name?: string;
    username: string;
    email: string;
    createdAt?: string;
    profilePicUrl?: string;
  };
  eventsCreated: Array<{
    id: string;
    name: string;
    date: string;
    location: string;
    time?: string;
    eventType?: string;
  }>;
  eventsJoined: Array<{
    id: string;
    name: string;
    date: string;
    location: string;
    time?: string;
    eventType?: string;
  }>;
  communityPosts: Array<{
    id: string;
    text: string;
    createdAt: string;
    likes?: number;
  }>;
  statistics?: {
    totalEventsCreated: number;
    totalEventsJoined: number;
    totalCommunityPosts: number;
    totalComments: number;
    totalReplies: number;
  };
}

const YourData: React.FC = () => {
  const {colors} = useTheme();
  const {t} = useTranslation();
  const navigation = useNavigation();
  const {userData} = useContext(UserContext) as UserContextType;
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<UserDataResponse>({
    profile: {
      username: '',
      email: '',
      createdAt: new Date().toISOString(),
    },
    eventsCreated: [],
    eventsJoined: [],
    communityPosts: [],
    statistics: {
      totalEventsCreated: 0,
      totalEventsJoined: 0,
      totalCommunityPosts: 0,
      totalComments: 0,
      totalReplies: 0,
    },
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = await AsyncStorage.getItem('userToken');

        if (!token) {
          setError(t('settings.sessionExpired'));
          setLoading(false);
          return;
        }

        // Fetch user data from backend
        const response = await axios.get(`${API_BASE_URL}/auth/user-data`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.data.success && response.data.data) {
          setData(response.data.data);
        } else {
          // If endpoint doesn't exist yet, show local data
          await loadLocalData();
        }
      } catch (err) {
        console.log('API not available, loading local data');
        await loadLocalData();
      } finally {
        setLoading(false);
      }
    };

    const loadLocalData = async () => {
      // Fallback to locally available data
      setData({
        profile: {
          username: userData?.username || 'Unknown',
          email: userData?.email || 'Unknown',
          createdAt: new Date().toISOString(),
        },
        eventsCreated: [],
        eventsJoined: [],
        communityPosts: [],
        statistics: {
          totalEventsCreated: 0,
          totalEventsJoined: 0,
          totalCommunityPosts: 0,
          totalComments: 0,
          totalReplies: 0,
        },
      });
    };

    fetchUserData();
  }, [t, userData?.username, userData?.email]);

  const handleExportData = async () => {
    if (!data) {
      return;
    }

    const exportData = JSON.stringify(data, null, 2);

    try {
      await Share.share({
        message: exportData,
        title: t('settings.yourDataExport') || 'BetterPlay - Your Data Export',
      });
    } catch (err) {
      Alert.alert(
        t('common.error') || 'Error',
        t('settings.exportError') || 'Failed to export data',
      );
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: 8,
      marginRight: 12,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
    },
    exportButton: {
      padding: 8,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: 20,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    errorText: {
      fontSize: 16,
      color: colors.placeholder,
      textAlign: 'center',
    },
    intro: {
      fontSize: 15,
      color: colors.placeholder,
      lineHeight: 22,
      marginBottom: 24,
    },
    section: {
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionIcon: {
      marginRight: 10,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
    },
    dataRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    dataRowLast: {
      borderBottomWidth: 0,
    },
    dataLabel: {
      fontSize: 15,
      color: colors.placeholder,
    },
    dataValue: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '500',
      maxWidth: '60%',
      textAlign: 'right',
    },
    emptyText: {
      fontSize: 14,
      color: colors.placeholder,
      fontStyle: 'italic',
    },
    eventItem: {
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    eventItemLast: {
      borderBottomWidth: 0,
    },
    eventTitle: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '500',
      marginBottom: 4,
    },
    eventDetails: {
      fontSize: 13,
      color: colors.placeholder,
    },
    postItem: {
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    postItemLast: {
      borderBottomWidth: 0,
    },
    postContent: {
      fontSize: 14,
      color: colors.text,
      marginBottom: 4,
    },
    postDate: {
      fontSize: 12,
      color: colors.placeholder,
    },
    footer: {
      fontSize: 13,
      color: colors.placeholder,
      textAlign: 'center',
      marginTop: 20,
      marginBottom: 40,
      lineHeight: 20,
    },
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}>
            <FontAwesomeIcon icon={faArrowLeft} size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {t('settings.yourData') || 'Your Data'}
          </Text>
        </View>
        <ScrollView style={styles.content}>
          <YourDataSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}>
            <FontAwesomeIcon icon={faArrowLeft} size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {t('settings.yourData') || 'Your Data'}
          </Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <FontAwesomeIcon icon={faArrowLeft} size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t('settings.yourData') || 'Your Data'}
        </Text>
        <TouchableOpacity
          style={styles.exportButton}
          onPress={handleExportData}>
          <FontAwesomeIcon icon={faDownload} size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.intro}>
            {t('settings.yourDataIntro') ||
              'Here is all the data we have collected about you. You can export this data using the download button above.'}
          </Text>

          {/* Profile Information */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <FontAwesomeIcon
                icon={faUser}
                size={18}
                color={colors.primary}
                style={styles.sectionIcon}
              />
              <Text style={styles.sectionTitle}>
                {t('settings.profileInfo') || 'Profile Information'}
              </Text>
            </View>
            <View style={styles.card}>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>
                  {t('profile.username') || 'Username'}
                </Text>
                <Text style={styles.dataValue}>{data?.profile.username}</Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>
                  {t('profile.email') || 'Email'}
                </Text>
                <Text style={styles.dataValue}>{data?.profile.email}</Text>
              </View>
              <View style={[styles.dataRow, styles.dataRowLast]}>
                <Text style={styles.dataLabel}>
                  {t('settings.memberSince') || 'Member Since'}
                </Text>
                <Text style={styles.dataValue}>
                  {data?.profile.createdAt
                    ? formatDate(data.profile.createdAt)
                    : 'Unknown'}
                </Text>
              </View>
            </View>
          </View>

          {/* Events Created */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <FontAwesomeIcon
                icon={faCalendarAlt}
                size={18}
                color={colors.primary}
                style={styles.sectionIcon}
              />
              <Text style={styles.sectionTitle}>
                {t('settings.eventsCreated') || 'Events Created'}
              </Text>
            </View>
            <View style={styles.card}>
              {data?.eventsCreated && data.eventsCreated.length > 0 ? (
                data.eventsCreated.map((event, index) => (
                  <View
                    key={event.id}
                    style={[
                      styles.eventItem,
                      index === data.eventsCreated.length - 1 &&
                        styles.eventItemLast,
                    ]}>
                    <Text style={styles.eventTitle}>{event.name}</Text>
                    <Text style={styles.eventDetails}>
                      {formatDate(event.date)} • {event.location}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>
                  {t('settings.noEventsCreated') || 'No events created yet'}
                </Text>
              )}
            </View>
          </View>

          {/* Events Joined */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <FontAwesomeIcon
                icon={faUsers}
                size={18}
                color={colors.primary}
                style={styles.sectionIcon}
              />
              <Text style={styles.sectionTitle}>
                {t('settings.eventsJoined') || 'Events Joined'}
              </Text>
            </View>
            <View style={styles.card}>
              {data?.eventsJoined && data.eventsJoined.length > 0 ? (
                data.eventsJoined.map((event, index) => (
                  <View
                    key={event.id}
                    style={[
                      styles.eventItem,
                      index === data.eventsJoined.length - 1 &&
                        styles.eventItemLast,
                    ]}>
                    <Text style={styles.eventTitle}>{event.name}</Text>
                    <Text style={styles.eventDetails}>
                      {formatDate(event.date)} • {event.location}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>
                  {t('settings.noEventsJoined') || 'No events joined yet'}
                </Text>
              )}
            </View>
          </View>

          {/* Community Posts */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <FontAwesomeIcon
                icon={faComments}
                size={18}
                color={colors.primary}
                style={styles.sectionIcon}
              />
              <Text style={styles.sectionTitle}>
                {t('settings.communityPosts') || 'Community Posts'}
              </Text>
            </View>
            <View style={styles.card}>
              {data?.communityPosts && data.communityPosts.length > 0 ? (
                data.communityPosts.map((post, index) => (
                  <View
                    key={post.id}
                    style={[
                      styles.postItem,
                      index === data.communityPosts.length - 1 &&
                        styles.postItemLast,
                    ]}>
                    <Text style={styles.postContent} numberOfLines={3}>
                      {post.text}
                    </Text>
                    <Text style={styles.postDate}>
                      {formatDate(post.createdAt)}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>
                  {t('settings.noPosts') || 'No community posts yet'}
                </Text>
              )}
            </View>
          </View>

          {/* Statistics */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <FontAwesomeIcon
                icon={faMapMarkerAlt}
                size={18}
                color={colors.primary}
                style={styles.sectionIcon}
              />
              <Text style={styles.sectionTitle}>
                {t('settings.statistics') || 'Statistics'}
              </Text>
            </View>
            <View style={styles.card}>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>
                  {t('settings.eventsCreated') || 'Events Created'}
                </Text>
                <Text style={styles.dataValue}>
                  {data?.statistics?.totalEventsCreated || 0}
                </Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>
                  {t('settings.eventsJoined') || 'Events Joined'}
                </Text>
                <Text style={styles.dataValue}>
                  {data?.statistics?.totalEventsJoined || 0}
                </Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>
                  {t('settings.communityPosts') || 'Community Posts'}
                </Text>
                <Text style={styles.dataValue}>
                  {data?.statistics?.totalCommunityPosts || 0}
                </Text>
              </View>
              <View style={[styles.dataRow, styles.dataRowLast]}>
                <Text style={styles.dataLabel}>
                  {t('settings.totalComments') || 'Total Comments'}
                </Text>
                <Text style={styles.dataValue}>
                  {(data?.statistics?.totalComments || 0) +
                    (data?.statistics?.totalReplies || 0)}
                </Text>
              </View>
            </View>
          </View>

          <Text style={styles.footer}>
            {t('settings.dataFooter') ||
              'To request deletion of your data, use the "Delete Account" option in Settings. For questions, contact support@betterplay.app'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default YourData;
