import React, {useEffect, useState, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useRoute, RouteProp, useNavigation} from '@react-navigation/native';
import axios from 'axios';
import {useTheme} from '../ThemeContext/ThemeContext';
import {API_BASE_URL} from '../../config/api';
import {useEventContext} from '../../Context/EventContext';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faCalendarCheck,
  faCalendarPlus,
  faArrowLeft,
} from '@fortawesome/free-solid-svg-icons';
import {useTranslation} from 'react-i18next';
import {TouchableOpacity} from 'react-native';

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
}

const PublicProfile: React.FC = () => {
  const route = useRoute<PublicProfileRouteProp>();
  const navigation = useNavigation();
  const {userId, username, profilePicUrl} = route.params;
  const {colors} = useTheme();
  const {events} = useEventContext();
  const {t} = useTranslation();

  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<PublicUserData | null>(null);

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
      // If we already have the data from route params, use it
      if (username) {
        setUserData({
          _id: userId,
          username: username,
          profilePicUrl: profilePicUrl,
        });
        return;
      }

      // Otherwise fetch from API
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
          fontSize: 20,
          fontWeight: '700',
          color: colors.text,
        },
        loadingContainer: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        },
        // Profile Header Section
        profileSection: {
          alignItems: 'center',
          paddingVertical: 24,
          paddingHorizontal: 16,
        },
        avatarContainer: {
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
          textAlign: 'center',
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
        menuValue: {
          fontSize: 14,
          color: colors.placeholder,
          marginRight: 8,
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
        {/* Profile Header */}
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

        {/* Activity Section */}
        <View style={themedStyles.sectionCard}>
          <Text style={themedStyles.sectionHeader}>
            {t('profile.activity') || 'Activity'}
          </Text>

          <View style={themedStyles.menuRow}>
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
          </View>

          <View style={[themedStyles.menuRow, themedStyles.menuRowLast]}>
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
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default PublicProfile;
