import React, {useCallback, useContext, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faBuilding,
  faCalendarPlus,
  faChevronRight,
  faGear,
  faMapMarkerAlt,
  faRightFromBracket,
} from '@fortawesome/free-solid-svg-icons';
import {useTranslation} from 'react-i18next';
import UserContext, {UserContextType} from '../UserContext';
import {useTheme} from '../ThemeContext/ThemeContext';
import HamburgerMenu from '../HamburgerMenu/HamburgerMenu';
import {useEventContext} from '../../Context/EventContext';
import {isEventPast} from '../../utils/eventDateTime';

/**
 * Host-mode profile for venue business accounts. Replaces the personal
 * Profile (friends, interests, proximity) with venue-centric actions.
 */
const VenueHostProfile: React.FC = () => {
  const {colors} = useTheme();
  const {t} = useTranslation();
  const navigation = useNavigation<any>();
  const {userData, setUserData} = useContext(UserContext) as UserContextType;
  const {events, fetchEvents} = useEventContext();

  useFocusEffect(
    useCallback(() => {
      fetchEvents().catch(() => {});
    }, [fetchEvents]),
  );

  const managed = userData?.managedVenue;
  const venueName = managed?.name || userData?.name || userData?.username || 'Venue';
  const photoUrl = managed?.photoUrl || userData?.profilePicUrl;
  const address = managed?.address;

  const upcomingHosted = useMemo(() => {
    if (!userData?._id) {
      return [];
    }
    return (events || []).filter(
      e =>
        e.createdBy === userData._id &&
        !isEventPast(e.date, e.time),
    );
  }, [events, userData?._id]);

  const openVenuePage = useCallback(() => {
    if (!managed?.placeId) {
      Alert.alert(
        'Venue not linked',
        'This account has no managed Google Place. Ask a BetterPlay admin to assign one.',
      );
      return;
    }
    // Events stack owns VenuePlaceDetail — jump via parent tab navigator.
    navigation.navigate('Events', {
      screen: 'VenuePlaceDetail',
      params: {
        place: {
          id: managed.placeId,
          name: managed.name,
          formattedAddress: managed.address,
          location:
            managed.latitude != null && managed.longitude != null
              ? {
                  latitude: managed.latitude,
                  longitude: managed.longitude,
                }
              : undefined,
        },
      },
    });
  }, [managed, navigation]);

  const goPostNight = useCallback(() => {
    navigation.navigate('Events', {
      screen: 'EventList',
      params: {openCreate: true},
    });
  }, [navigation]);

  const handleLogout = useCallback(() => {
    Alert.alert(
      t('common.signOut') || 'Sign Out',
      t('profile.signOutConfirm') || 'Are you sure you want to sign out?',
      [
        {text: t('common.cancel') || 'Cancel', style: 'cancel'},
        {
          text: t('common.signOut') || 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.multiRemove(['userToken', 'cachedUserData']);
            setUserData(null);
          },
        },
      ],
    );
  }, [setUserData, t]);

  const initials = venueName
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || '')
    .join('');

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: {flex: 1, backgroundColor: colors.background},
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: 4,
          paddingBottom: 4,
        },
        headerTitle: {
          flex: 1,
          textAlign: 'center',
          fontSize: 16,
          fontWeight: '700',
          color: colors.text,
          marginRight: 40,
        },
        scroll: {paddingHorizontal: 16, paddingBottom: 40},
        hero: {
          alignItems: 'center',
          paddingTop: 12,
          paddingBottom: 20,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          marginBottom: 16,
        },
        avatar: {
          width: 96,
          height: 96,
          borderRadius: 48,
          borderWidth: 3,
          borderColor: colors.primary,
          marginBottom: 12,
        },
        avatarPlaceholder: {
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: colors.primary + '18',
          borderWidth: 3,
          borderColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        },
        avatarInitials: {
          fontSize: 32,
          fontWeight: '800',
          color: colors.primary,
        },
        name: {
          fontSize: 22,
          fontWeight: '800',
          color: colors.text,
          textAlign: 'center',
        },
        chip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginTop: 8,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 12,
          backgroundColor: colors.primary + '22',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.primary + '88',
        },
        chipText: {
          color: colors.primary,
          fontSize: 12,
          fontWeight: '700',
        },
        addressRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 8,
          marginTop: 10,
          paddingHorizontal: 12,
        },
        address: {
          flex: 1,
          fontSize: 13,
          color: colors.secondaryText,
          textAlign: 'center',
        },
        statsRow: {
          flexDirection: 'row',
          gap: 10,
          marginBottom: 16,
        },
        statCard: {
          flex: 1,
          backgroundColor: colors.card,
          borderRadius: 14,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          paddingVertical: 14,
          paddingHorizontal: 12,
          alignItems: 'center',
        },
        statValue: {
          fontSize: 22,
          fontWeight: '800',
          color: colors.text,
        },
        statLabel: {
          marginTop: 4,
          fontSize: 12,
          fontWeight: '600',
          color: colors.secondaryText,
        },
        primaryBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: colors.primary,
          borderRadius: 14,
          paddingVertical: 14,
          marginBottom: 10,
        },
        primaryBtnText: {
          color: '#fff',
          fontSize: 16,
          fontWeight: '700',
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.card,
          borderRadius: 14,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          paddingVertical: 14,
          paddingHorizontal: 14,
          marginBottom: 10,
        },
        rowIcon: {
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: colors.primary + '18',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        },
        rowText: {flex: 1},
        rowTitle: {
          fontSize: 15,
          fontWeight: '700',
          color: colors.text,
        },
        rowDesc: {
          fontSize: 12,
          color: colors.secondaryText,
          marginTop: 2,
        },
        hint: {
          marginTop: 8,
          fontSize: 12,
          lineHeight: 17,
          color: colors.secondaryText,
          textAlign: 'center',
        },
      }),
    [colors],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <HamburgerMenu />
        <Text style={styles.headerTitle}>
          {t('venues.hostProfileTitle') || 'Venue'}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          {photoUrl ? (
            <Image source={{uri: photoUrl}} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>{initials || 'V'}</Text>
            </View>
          )}
          <Text style={styles.name}>{venueName}</Text>
          <View style={styles.chip}>
            <FontAwesomeIcon
              icon={faBuilding}
              size={11}
              color={colors.primary}
            />
            <Text style={styles.chipText}>
              {t('events.venueOfficialBadge') || 'Official venue'}
            </Text>
          </View>
          {address ? (
            <View style={styles.addressRow}>
              <FontAwesomeIcon
                icon={faMapMarkerAlt}
                size={12}
                color={colors.secondaryText}
              />
              <Text style={styles.address}>{address}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{upcomingHosted.length}</Text>
            <Text style={styles.statLabel}>
              {t('venues.upcomingNights') || 'Upcoming nights'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryBtn}
          activeOpacity={0.85}
          onPress={goPostNight}>
          <FontAwesomeIcon icon={faCalendarPlus} size={16} color="#fff" />
          <Text style={styles.primaryBtnText}>
            {t('venues.postANight') || 'Post a night'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.75}
          onPress={openVenuePage}>
          <View style={styles.rowIcon}>
            <FontAwesomeIcon
              icon={faBuilding}
              size={14}
              color={colors.primary}
            />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>
              {t('venues.viewVenuePage') || 'View venue page'}
            </Text>
            <Text style={styles.rowDesc}>
              {t('venues.viewVenuePageDesc') ||
                'Public schedule and place details'}
            </Text>
          </View>
          <FontAwesomeIcon
            icon={faChevronRight}
            size={13}
            color={colors.secondaryText}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.75}
          onPress={() => navigation.navigate('Settings')}>
          <View style={styles.rowIcon}>
            <FontAwesomeIcon icon={faGear} size={14} color={colors.primary} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>
              {t('navigation.settings') || 'Settings'}
            </Text>
            <Text style={styles.rowDesc}>
              {t('venues.hostSettingsDesc') || 'Account, notifications, and more'}
            </Text>
          </View>
          <FontAwesomeIcon
            icon={faChevronRight}
            size={13}
            color={colors.secondaryText}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.75}
          onPress={handleLogout}>
          <View style={styles.rowIcon}>
            <FontAwesomeIcon
              icon={faRightFromBracket}
              size={14}
              color={colors.error || '#FF3B30'}
            />
          </View>
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, {color: colors.error || '#FF3B30'}]}>
              {t('common.signOut') || 'Sign Out'}
            </Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.hint}>
          {t('venues.hostModeHint') ||
            'This is a venue host account. Locals see your nights in the Events feed with an Official venue badge.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

export default VenueHostProfile;
