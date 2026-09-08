// Read-only summary for an event that has already concluded.
// Opened from group-chat system cards (and past Events list rows) so users
// don't land on the live roster with Join / Suggest guest still active.

import React, {useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {
  RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faArrowLeft,
  faCalendarDay,
  faCheckCircle,
  faClock,
  faMapMarkerAlt,
  faStar,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../ThemeContext/ThemeContext';
import UserContext, {UserContextType} from '../UserContext';
import {API_BASE_URL} from '../../config/api';
import {formatEventTimeRange, isEventEnded} from '../../utils/eventDateTime';
import EventRatingModal from '../EventRating/EventRatingModal';
import PlayerRatingModal, {
  PlayerRatingTarget,
} from '../EventRating/PlayerRatingModal';

type WrapUpParams = {
  EventWrapUp: {
    eventId: string;
    eventName?: string;
  };
};

type Attendee = {
  userId?: string;
  username: string;
  profilePicUrl?: string;
  position?: string;
};

const EVENT_TYPE_EMOJI: Record<string, string> = {
  Soccer: '⚽',
  Basketball: '🏀',
  Volleyball: '🏐',
  Tennis: '🎾',
  'Pickle Ball': '🏓',
  Pickleball: '🏓',
  Baseball: '⚾',
  Football: '🏈',
  Golf: '⛳',
  Hockey: '🏒',
  Running: '🏃',
  Hiking: '🥾',
  Cycling: '🚴',
  Swimming: '🏊',
  Yoga: '🧘',
  Workout: '💪',
  Gym: '🏋️',
  'Board Games': '🎲',
  'Game Night': '🎲',
  'Video Games': '🎮',
  'Comedy Show': '🎭',
  Concert: '🎵',
  Party: '🎉',
  Hangout: '👋',
  Food: '🍽️',
  Other: '📌',
};

const getEventTypeEmoji = (eventType?: string) =>
  (eventType && EVENT_TYPE_EMOJI[eventType]) || '📌';

const getInitials = (name?: string) => {
  const source = (name || '?').trim();
  const parts = source.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const EventWrapUp: React.FC = () => {
  const {colors} = useTheme();
  const {t} = useTranslation();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<WrapUpParams, 'EventWrapUp'>>();
  const {userData} = useContext(UserContext) as UserContextType;

  const eventId = route.params?.eventId;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [name, setName] = useState(route.params?.eventName || '');
  const [eventType, setEventType] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number | undefined>();
  const [location, setLocation] = useState('');
  const [isVirtual, setIsVirtual] = useState(false);
  const [createdBy, setCreatedBy] = useState('');
  const [createdByUsername, setCreatedByUsername] = useState('');
  const [roster, setRoster] = useState<Attendee[]>([]);
  const [hasRatedEvent, setHasRatedEvent] = useState(false);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [playerModalVisible, setPlayerModalVisible] = useState(false);
  const [playerModalTarget, setPlayerModalTarget] =
    useState<PlayerRatingTarget | null>(null);
  const [ratedPlayerIds, setRatedPlayerIds] = useState<Set<string>>(new Set());

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: {flex: 1, backgroundColor: colors.background},
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 10,
          gap: 8,
        },
        backBtn: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
        },
        headerTitle: {
          flex: 1,
          fontSize: 17,
          fontWeight: '700',
          color: colors.text,
        },
        body: {flex: 1},
        content: {paddingHorizontal: 16, paddingBottom: 32},
        banner: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          padding: 14,
          borderRadius: 14,
          backgroundColor: colors.primary + '18',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.primary + '55',
          marginBottom: 18,
        },
        bannerTextWrap: {flex: 1},
        bannerTitle: {
          color: colors.primary,
          fontSize: 15,
          fontWeight: '700',
        },
        bannerSub: {
          color: colors.secondaryText,
          fontSize: 13,
          marginTop: 2,
          lineHeight: 18,
        },
        titleRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 10,
          marginBottom: 14,
        },
        emoji: {fontSize: 28, lineHeight: 34},
        title: {
          flex: 1,
          color: colors.text,
          fontSize: 24,
          fontWeight: '800',
          letterSpacing: -0.3,
          lineHeight: 30,
        },
        typeBadge: {
          alignSelf: 'flex-start',
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 8,
          backgroundColor: colors.primary + '18',
          marginBottom: 14,
        },
        typeBadgeText: {
          color: colors.primary,
          fontSize: 12,
          fontWeight: '700',
        },
        detailRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          marginBottom: 10,
        },
        detailText: {
          flex: 1,
          color: colors.secondaryText,
          fontSize: 14,
          lineHeight: 20,
        },
        sectionHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginTop: 22,
          marginBottom: 12,
        },
        sectionTitle: {
          color: colors.text,
          fontSize: 15,
          fontWeight: '700',
        },
        attendeeRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 10,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        avatar: {
          width: 40,
          height: 40,
          borderRadius: 20,
        },
        avatarFallback: {
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        },
        avatarText: {
          color: '#fff',
          fontWeight: '700',
          fontSize: 13,
        },
        attendeeName: {
          flex: 1,
          color: colors.text,
          fontSize: 15,
          fontWeight: '600',
        },
        attendeeMeta: {
          color: colors.secondaryText,
          fontSize: 12,
          marginTop: 2,
        },
        rateChip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.primary + '66',
          backgroundColor: colors.primary + '12',
        },
        rateChipText: {
          color: colors.primary,
          fontSize: 12,
          fontWeight: '700',
        },
        primaryBtn: {
          marginTop: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingVertical: 14,
          borderRadius: 14,
          backgroundColor: colors.primary,
        },
        primaryBtnText: {
          color: colors.buttonText || '#fff',
          fontSize: 15,
          fontWeight: '700',
        },
        emptyAttendees: {
          color: colors.secondaryText,
          fontSize: 14,
          paddingVertical: 8,
        },
        centered: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        },
        errorText: {
          color: colors.secondaryText,
          textAlign: 'center',
          marginBottom: 16,
        },
        retryBtn: {
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 12,
          backgroundColor: colors.primary,
        },
        retryText: {
          color: colors.buttonText || '#fff',
          fontWeight: '700',
        },
      }),
    [colors],
  );

  const load = useCallback(async () => {
    if (!eventId) {
      setLoadError(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const headers = token ? {Authorization: `Bearer ${token}`} : {};
      const response = await axios.get(`${API_BASE_URL}/events/${eventId}`, {
        headers,
      });
      const ev = response.data || {};
      setName(ev.name || '');
      setEventType(ev.eventType || '');
      setDate(ev.date || '');
      setTime(ev.time || '');
      setDurationMinutes(
        ev.durationMinutes != null ? ev.durationMinutes : undefined,
      );
      setLocation(ev.location || '');
      setIsVirtual(!!ev.isVirtual);
      setCreatedBy(ev.createdBy || '');
      setCreatedByUsername(ev.createdByUsername || '');
      setRoster(
        (ev.roster || []).map((p: any) => ({
          userId: p.userId ? String(p.userId) : undefined,
          username: p.username || 'Guest',
          profilePicUrl: p.profilePicUrl,
          position: p.position,
        })),
      );

      if (userData?._id) {
        try {
          const me = await axios.get(
            `${API_BASE_URL}/events/${eventId}/ratings/me`,
            {headers},
          );
          setHasRatedEvent(!!me.data?.rated);
        } catch {
          // non-blocking
        }
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [eventId, userData?._id]);

  useEffect(() => {
    load();
  }, [load]);

  const isCreator = !!userData?._id && String(createdBy) === String(userData._id);
  const isOnRoster = roster.some(
    p =>
      (p.userId && p.userId === userData?._id) ||
      p.username === userData?.username,
  );
  const ended = isEventEnded(date, time, durationMinutes);
  const canRateEvent =
    !!userData?._id && !isCreator && isOnRoster && ended && !hasRatedEvent;

  const openProfile = (userId?: string, username?: string) => {
    if (!userId && !username) {
      return;
    }
    navigation.navigate('PublicProfile', {
      userId,
      username,
    });
  };

  const openPlayerRate = (attendee: Attendee) => {
    if (!attendee.userId || attendee.userId === userData?._id) {
      return;
    }
    setPlayerModalTarget({
      userId: attendee.userId,
      username: attendee.username,
      eventId: eventId!,
    });
    setPlayerModalVisible(true);
  };

  const renderAttendee = ({item}: {item: Attendee}) => {
    const canRatePlayer =
      !!item.userId &&
      item.userId !== userData?._id &&
      isOnRoster &&
      ended &&
      !ratedPlayerIds.has(item.userId);

    return (
      <TouchableOpacity
        style={styles.attendeeRow}
        activeOpacity={0.7}
        onPress={() => openProfile(item.userId, item.username)}
        disabled={!item.userId}>
        {item.profilePicUrl ? (
          <Image source={{uri: item.profilePicUrl}} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarText}>{getInitials(item.username)}</Text>
          </View>
        )}
        <View style={{flex: 1, minWidth: 0}}>
          <Text style={styles.attendeeName} numberOfLines={1}>
            {item.username}
            {item.userId && item.userId === createdBy
              ? ` · ${t('roster.host') || 'Host'}`
              : ''}
          </Text>
          {item.position ? (
            <Text style={styles.attendeeMeta} numberOfLines={1}>
              {item.position}
            </Text>
          ) : null}
        </View>
        {canRatePlayer ? (
          <TouchableOpacity
            style={styles.rateChip}
            onPress={() => openPlayerRate(item)}
            hitSlop={{top: 6, bottom: 6, left: 6, right: 6}}>
            <FontAwesomeIcon icon={faStar} size={11} color={colors.primary} />
            <Text style={styles.rateChipText}>
              {t('events.ratePlayer') || 'Rate'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
          <FontAwesomeIcon icon={faArrowLeft} size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {t('events.eventWrapUp') || 'Event wrap-up'}
        </Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : loadError ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>
            {t('events.wrapUpLoadError') ||
              "Couldn't load this event wrap-up."}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>{t('common.retry') || 'Retry'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          style={styles.body}
          contentContainerStyle={styles.content}
          data={roster}
          keyExtractor={(item, index) =>
            item.userId || `${item.username}-${index}`
          }
          renderItem={renderAttendee}
          ListHeaderComponent={
            <View>
              <View style={styles.banner}>
                <FontAwesomeIcon
                  icon={faCheckCircle}
                  size={22}
                  color={colors.primary}
                />
                <View style={styles.bannerTextWrap}>
                  <Text style={styles.bannerTitle}>
                    {t('events.eventConcludedTitle') || 'Event concluded'}
                  </Text>
                  <Text style={styles.bannerSub}>
                    {t('events.eventConcludedMessage') ||
                      'This event has ended. Review who attended and leave ratings below.'}
                  </Text>
                </View>
              </View>

              <View style={styles.titleRow}>
                <Text style={styles.emoji}>{getEventTypeEmoji(eventType)}</Text>
                <Text style={styles.title}>{name || 'Event'}</Text>
              </View>

              {eventType ? (
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>{eventType}</Text>
                </View>
              ) : null}

              {date ? (
                <View style={styles.detailRow}>
                  <FontAwesomeIcon
                    icon={faCalendarDay}
                    size={14}
                    color={colors.secondaryText}
                  />
                  <Text style={styles.detailText}>{date}</Text>
                </View>
              ) : null}

              {time ? (
                <View style={styles.detailRow}>
                  <FontAwesomeIcon
                    icon={faClock}
                    size={14}
                    color={colors.secondaryText}
                  />
                  <Text style={styles.detailText}>
                    {formatEventTimeRange(date, time, durationMinutes)}
                  </Text>
                </View>
              ) : null}

              {location ? (
                <View style={styles.detailRow}>
                  <FontAwesomeIcon
                    icon={faMapMarkerAlt}
                    size={14}
                    color={colors.secondaryText}
                  />
                  <Text style={styles.detailText}>
                    {isVirtual
                      ? location.trim() ||
                        t('events.virtualLocationBadge') ||
                        'Other'
                      : location}
                  </Text>
                </View>
              ) : null}

              {createdByUsername ? (
                <View style={styles.detailRow}>
                  <FontAwesomeIcon
                    icon={faUsers}
                    size={14}
                    color={colors.secondaryText}
                  />
                  <Text style={styles.detailText}>
                    {t('events.hostedBy', {name: createdByUsername}) ||
                      `Hosted by @${createdByUsername}`}
                  </Text>
                </View>
              ) : null}

              {canRateEvent ? (
                <TouchableOpacity
                  style={styles.primaryBtn}
                  activeOpacity={0.85}
                  onPress={() => setRatingModalVisible(true)}>
                  <FontAwesomeIcon
                    icon={faStar}
                    size={15}
                    color={colors.buttonText || '#fff'}
                  />
                  <Text style={styles.primaryBtnText}>
                    {t('events.rateThisEvent') || 'Rate this event'}
                  </Text>
                </TouchableOpacity>
              ) : null}

              <View style={styles.sectionHeader}>
                <FontAwesomeIcon
                  icon={faUsers}
                  size={15}
                  color={colors.primary}
                />
                <Text style={styles.sectionTitle}>
                  {t('events.whoAttended') || 'Who attended'} ({roster.length})
                </Text>
              </View>
              {roster.length === 0 ? (
                <Text style={styles.emptyAttendees}>
                  {t('roster.noPlayersYet') || 'No one was on the roster.'}
                </Text>
              ) : null}
            </View>
          }
        />
      )}

      <EventRatingModal
        visible={ratingModalVisible}
        pending={
          canRateEvent || ratingModalVisible
            ? {
                eventId: eventId!,
                eventName: name || 'Event',
                hostId: createdBy,
                hostUsername: createdByUsername || null,
              }
            : null
        }
        onClose={() => setRatingModalVisible(false)}
        onSubmitted={() => setHasRatedEvent(true)}
      />

      <PlayerRatingModal
        visible={playerModalVisible}
        target={playerModalTarget}
        onClose={() => setPlayerModalVisible(false)}
        onSubmitted={() => {
          if (playerModalTarget?.userId) {
            setRatedPlayerIds(prev => {
              const next = new Set(prev);
              next.add(playerModalTarget.userId);
              return next;
            });
          }
        }}
      />
    </SafeAreaView>
  );
};

export default EventWrapUp;
