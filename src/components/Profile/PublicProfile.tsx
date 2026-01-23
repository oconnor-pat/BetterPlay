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
    // Count events where this user is on the roster
    // Note: This is a simplified count since we don't have full roster data in EventContext
    return {eventsCreated};
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
          padding: 16,
          paddingBottom: 32,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 20,
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
        // Profile Card
        profileCard: {
          backgroundColor: colors.card,
          borderRadius: 20,
          padding: 24,
          marginBottom: 16,
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 2},
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 3,
          alignItems: 'center',
        },
        avatarContainer: {
          marginBottom: 16,
        },
        avatar: {
          width: 100,
          height: 100,
          borderRadius: 50,
          backgroundColor: colors.border,
        },
        avatarPlaceholder: {
          width: 100,
          height: 100,
          borderRadius: 50,
          backgroundColor: colors.primary + '20',
          alignItems: 'center',
          justifyContent: 'center',
        },
        avatarInitials: {
          fontSize: 36,
          fontWeight: '700',
          color: colors.primary,
        },
        userName: {
          fontSize: 24,
          fontWeight: '700',
          color: colors.text,
          marginBottom: 4,
          textAlign: 'center',
        },
        // Stats Card
        statsCard: {
          backgroundColor: colors.card,
          borderRadius: 20,
          padding: 20,
          marginBottom: 16,
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 2},
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 3,
        },
        sectionTitle: {
          fontSize: 18,
          fontWeight: '700',
          color: colors.text,
          marginBottom: 16,
        },
        statsRow: {
          flexDirection: 'row',
          justifyContent: 'space-around',
        },
        statItem: {
          alignItems: 'center',
          flex: 1,
        },
        statIconContainer: {
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 10,
        },
        statValue: {
          fontSize: 28,
          fontWeight: '700',
          color: colors.text,
        },
        statLabel: {
          fontSize: 13,
          color: colors.placeholder,
          marginTop: 4,
          textAlign: 'center',
        },
        // Achievements Card
        achievementsCard: {
          backgroundColor: colors.card,
          borderRadius: 20,
          padding: 20,
          marginBottom: 16,
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 2},
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 3,
        },
        achievementsRow: {
          flexDirection: 'row',
          justifyContent: 'space-around',
          marginTop: 8,
        },
        achievementBadge: {
          alignItems: 'center',
          opacity: 0.4,
        },
        achievementBadgeEarned: {
          opacity: 1,
        },
        achievementIcon: {
          width: 48,
          height: 48,
          borderRadius: 24,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 6,
        },
        achievementEmoji: {
          fontSize: 24,
        },
        achievementName: {
          fontSize: 11,
          color: colors.placeholder,
          textAlign: 'center',
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
        {/* Profile Card */}
        <View style={themedStyles.profileCard}>
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

        {/* Stats Card - Limited public view */}
        <View style={themedStyles.statsCard}>
          <Text style={themedStyles.sectionTitle}>
            📊 {t('profile.activity')}
          </Text>
          <View style={themedStyles.statsRow}>
            <View style={themedStyles.statItem}>
              <View
                style={[
                  themedStyles.statIconContainer,
                  {backgroundColor: colors.primary + '20'},
                ]}>
                <FontAwesomeIcon
                  icon={faCalendarPlus}
                  size={24}
                  color={colors.primary}
                />
              </View>
              <Text style={themedStyles.statValue}>
                {userStats.eventsCreated}
              </Text>
              <Text style={themedStyles.statLabel}>
                {t('profile.eventsCreated')}
              </Text>
            </View>
            <View style={themedStyles.statItem}>
              <View
                style={[
                  themedStyles.statIconContainer,
                  {backgroundColor: '#4CAF50' + '20'},
                ]}>
                <FontAwesomeIcon
                  icon={faCalendarCheck}
                  size={24}
                  color="#4CAF50"
                />
              </View>
              <Text style={themedStyles.statValue}>-</Text>
              <Text style={themedStyles.statLabel}>
                {t('profile.eventsJoined')}
              </Text>
            </View>
          </View>
        </View>

        {/* Achievements Preview - Public view */}
        <View style={themedStyles.achievementsCard}>
          <Text style={themedStyles.sectionTitle}>
            🏆 {t('profile.achievements')}
          </Text>
          <View style={themedStyles.achievementsRow}>
            <View
              style={[
                themedStyles.achievementBadge,
                userStats.eventsCreated >= 1 &&
                  themedStyles.achievementBadgeEarned,
              ]}>
              <View
                style={[
                  themedStyles.achievementIcon,
                  {backgroundColor: '#FFD700' + '30'},
                ]}>
                <Text style={themedStyles.achievementEmoji}>🎯</Text>
              </View>
              <Text style={themedStyles.achievementName}>
                {t('profile.firstEvent')}
              </Text>
            </View>
            <View
              style={[
                themedStyles.achievementBadge,
                userStats.eventsCreated >= 5 &&
                  themedStyles.achievementBadgeEarned,
              ]}>
              <View
                style={[
                  themedStyles.achievementIcon,
                  {backgroundColor: '#C0C0C0' + '30'},
                ]}>
                <Text style={themedStyles.achievementEmoji}>⭐</Text>
              </View>
              <Text style={themedStyles.achievementName}>
                {t('profile.fiveEvents')}
              </Text>
            </View>
            <View
              style={[
                themedStyles.achievementBadge,
                userStats.eventsCreated >= 10 &&
                  themedStyles.achievementBadgeEarned,
              ]}>
              <View
                style={[
                  themedStyles.achievementIcon,
                  {backgroundColor: '#CD7F32' + '30'},
                ]}>
                <Text style={themedStyles.achievementEmoji}>🏅</Text>
              </View>
              <Text style={themedStyles.achievementName}>
                {t('profile.tenEvents')}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default PublicProfile;
