// Slim venue detail page — shows the basics from Google Places + an Events
// feed scoped to this venue + the primary "Plan event here" CTA that bridges
// to the existing Events create flow.
//
// PR 2a: tapping "View website" opens the venue's site externally (Linking).
// PR 2b will swap this for an in-app WebView once react-native-webview is
// added and the app is rebuilt.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faArrowLeft,
  faGlobe,
  faMapMarkerAlt,
  faPhone,
  faPlus,
  faStar,
  faClock,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import {
  useNavigation,
  useRoute,
  RouteProp,
  CommonActions,
} from '@react-navigation/native';
import axios from 'axios';
import {useTheme} from '../ThemeContext/ThemeContext';
import {API_BASE_URL} from '../../config/api';
import {
  PlaceSummary,
  buildPhotoUrl,
  getPlaceDetails,
} from '../../services/PlacesService';

// Route params come from VenueListPlaces. We pass the whole PlaceSummary so
// the detail page can render instantly (no loading flash) — Place Details is
// only needed if we want fields the summary doesn't have, like opening hours
// breakdown.
export type VenuePlaceDetailParams = {
  place: PlaceSummary;
};

type RouteParams = RouteProp<
  {VenuePlaceDetail: VenuePlaceDetailParams},
  'VenuePlaceDetail'
>;

interface EventCard {
  _id: string;
  name: string;
  location: string;
  date: string;
  time: string;
  totalSpots: number;
  rosterSpotsFilled: number;
  eventType: string;
  createdByUsername?: string;
  privacy?: string;
}

// Be permissive about whatever shape the BE hands back for `date` — across
// the codebase's history we've seen "YYYY-MM-DD" strings, full ISO
// datetimes, and stringified Mongoose Dates depending on how the event was
// originally created. Returns null only when the value is unparseable.
const parseEventDate = (raw?: string): Date | null => {
  if (!raw) {
    return null;
  }
  // Pure date (no time component) — anchor to local midnight to avoid
  // timezone shifts pushing it to the day before.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(n => parseInt(n, 10));
    return new Date(y, m - 1, d);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

// Local midnight for "today" — anything strictly before this is past and
// should be hidden from the venue feed.
const startOfToday = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const VenuePlaceDetail: React.FC = () => {
  const {colors, darkMode} = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteParams>();
  const {place: initialPlace} = route.params;

  const [place, setPlace] = useState<PlaceSummary>(initialPlace);
  const [events, setEvents] = useState<EventCard[]>([]);
  const [eventsLoading, setEventsLoading] = useState<boolean>(true);

  // Refresh details in the background — gets us full opening hours and any
  // fields Nearby Search omitted. Cheap to do once per venue view.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fresh = await getPlaceDetails(initialPlace.id);
        if (!cancelled) {
          setPlace({...initialPlace, ...fresh});
        }
      } catch {
        // Silently keep the summary data if details fail.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialPlace]);

  // Fetch events scoped to this venue. We send both the Place ID (catches
  // events planned through the Venues-tab bridge) and the venue's lat/lng
  // (catches events created via the regular `+` FAB whose location was
  // picked from Google Places autocomplete — same coords, no venueId).
  // We also send the auth token so the BE's privacy filter can include
  // private/invite-only events the current user is allowed to see.
  const fetchVenueEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await axios.get(`${API_BASE_URL}/events`, {
        params: {
          venueId: initialPlace.id,
          lat: initialPlace.location?.latitude,
          lng: initialPlace.location?.longitude,
        },
        headers: token ? {Authorization: `Bearer ${token}`} : undefined,
      });
      const all = (response.data || []) as EventCard[];
      // Hide past events. We use the same permissive parser as the renderer
      // so legacy events stored in non-ISO formats (e.g. "Jan 23, 2026") are
      // compared by real date rather than naive string slicing — earlier we
      // saw past events leaking through because a non-ISO string never
      // started with the YYYY-MM-DD prefix the comparison expected.
      const todayMs = startOfToday().getTime();
      const upcoming = all
        .map(e => ({event: e, ts: parseEventDate(e.date)?.getTime() ?? null}))
        .filter(({ts}) => ts !== null && ts >= todayMs)
        .sort((a, b) => {
          const dateDiff = (a.ts || 0) - (b.ts || 0);
          if (dateDiff !== 0) {
            return dateDiff;
          }
          return (a.event.time || '').localeCompare(b.event.time || '');
        })
        .map(({event}) => event);
      setEvents(upcoming);
    } catch (err) {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, [initialPlace.id, initialPlace.location]);

  useEffect(() => {
    fetchVenueEvents();
  }, [fetchVenueEvents]);

  // Re-fetch when the screen regains focus (e.g. after creating an event).
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchVenueEvents);
    return unsubscribe;
  }, [navigation, fetchVenueEvents]);

  // ── Actions ───────────────────────────────────────────────────────────
  const handlePlanEvent = useCallback(() => {
    const params = {
      prefillEvent: {
        name: '',
        location:
          place.formattedAddress || place.shortFormattedAddress || place.name,
        latitude: place.location?.latitude,
        longitude: place.location?.longitude,
        venueId: place.id,
        venueName: place.name,
        sourceUrl: place.websiteUri,
      },
    };
    // Cross-tab navigation: jump to the Events tab and open the create modal
    // with the venue prefilled. getParent() walks up to the bottom tab nav.
    const parent = navigation.getParent();
    if (parent) {
      parent.dispatch(
        CommonActions.navigate({
          name: 'Events',
          params: {screen: 'EventList', params},
        }),
      );
    } else {
      navigation.navigate('Events', {screen: 'EventList', params});
    }
  }, [place, navigation]);

  // Navigate into the in-app browser. When the venue has no website on
  // file we fall back to a Google search for the venue name + city — that
  // turns out to be more useful than guessing at Instagram / Facebook URLs
  // (Places API v1 doesn't expose social handles, so the only honest fallback
  // is to surface results the user can pick from themselves).
  const handleViewWebsite = useCallback(() => {
    const url = place.websiteUri
      ? place.websiteUri
      : `https://www.google.com/search?q=${encodeURIComponent(
          [place.name, place.shortFormattedAddress || place.formattedAddress]
            .filter(Boolean)
            .join(' '),
        )}`;
    navigation.navigate('VenueWebView', {
      initialUrl: url,
      venueId: place.id,
      venueName: place.name,
      venueAddress: place.formattedAddress || place.shortFormattedAddress,
      venueLatitude: place.location?.latitude,
      venueLongitude: place.location?.longitude,
    });
  }, [place, navigation]);

  const handleCallVenue = useCallback(() => {
    const phone = place.nationalPhoneNumber || place.internationalPhoneNumber;
    if (!phone) {
      return;
    }
    const tel = `tel:${phone.replace(/[^0-9+]/g, '')}`;
    Linking.openURL(tel).catch(() => {
      Alert.alert('Could not open dialer', phone);
    });
  }, [place]);

  const handleGetDirections = useCallback(() => {
    const lat = place.location?.latitude;
    const lng = place.location?.longitude;
    const label = encodeURIComponent(place.name);
    const url =
      Platform.OS === 'ios' && lat && lng
        ? `maps://?ll=${lat},${lng}&q=${label}`
        : lat && lng
        ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
        : `https://www.google.com/maps/search/?api=1&query=${label}`;
    Linking.openURL(url).catch(() => {});
  }, [place]);

  // ── Derived UI bits ───────────────────────────────────────────────────
  const heroPhotoUrl = useMemo(() => {
    const photoName = place.photos?.[0]?.name;
    return photoName ? buildPhotoUrl(photoName, {maxWidthPx: 1200}) : null;
  }, [place.photos]);

  const todayHoursText = useMemo(() => {
    const list = place.currentOpeningHours?.weekdayDescriptions;
    if (!list || list.length === 0) {
      return null;
    }
    // Google returns the list starting with Monday. Map JS day-of-week
    // (Sunday=0) to that list's index.
    const day = new Date().getDay();
    const idx = (day + 6) % 7; // Mon=0..Sun=6
    return list[idx] || null;
  }, [place.currentOpeningHours]);

  const ratingText = useMemo(() => {
    if (typeof place.rating !== 'number') {
      return null;
    }
    const count = place.userRatingCount
      ? ` (${place.userRatingCount.toLocaleString()})`
      : '';
    return `${place.rating.toFixed(1)}${count}`;
  }, [place.rating, place.userRatingCount]);

  // ── Styles ────────────────────────────────────────────────────────────
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {flex: 1, backgroundColor: colors.background},
        topBar: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 8,
          paddingVertical: 8,
          gap: 4,
        },
        backButton: {
          padding: 8,
        },
        topBarTitle: {
          flex: 1,
          fontSize: 16,
          fontWeight: '700',
          color: colors.text,
          marginLeft: 4,
        },
        scroll: {flex: 1},
        scrollContent: {paddingBottom: 32},
        hero: {
          width: '100%',
          height: 180,
          backgroundColor: darkMode
            ? 'rgba(255,255,255,0.05)'
            : 'rgba(0,0,0,0.05)',
          alignItems: 'center',
          justifyContent: 'center',
        },
        heroImage: {width: '100%', height: 180},
        heroEmoji: {fontSize: 64},
        venueHeader: {
          paddingHorizontal: 16,
          paddingTop: 16,
        },
        venueName: {
          fontSize: 24,
          fontWeight: '800',
          color: colors.text,
        },
        venueMetaRow: {
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          marginTop: 6,
        },
        venueMetaChip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        },
        venueMetaText: {
          fontSize: 13,
          color: colors.secondaryText,
          fontWeight: '600',
        },
        ctaRow: {
          flexDirection: 'row',
          paddingHorizontal: 16,
          paddingTop: 16,
          gap: 10,
        },
        primaryCta: {
          flex: 1,
          backgroundColor: colors.primary,
          paddingVertical: 12,
          borderRadius: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        },
        primaryCtaText: {
          color: '#FFFFFF',
          fontSize: 15,
          fontWeight: '700',
        },
        secondaryCta: {
          flex: 1,
          backgroundColor: colors.card,
          paddingVertical: 12,
          borderRadius: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        secondaryCtaText: {
          color: colors.text,
          fontSize: 15,
          fontWeight: '700',
        },
        section: {
          paddingHorizontal: 16,
          paddingTop: 24,
        },
        sectionTitle: {
          fontSize: 12,
          fontWeight: '700',
          letterSpacing: 0.5,
          color: colors.secondaryText,
          textTransform: 'uppercase',
          marginBottom: 8,
        },
        infoRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 10,
          paddingVertical: 6,
        },
        infoIcon: {
          marginTop: 2,
          width: 18,
          alignItems: 'center',
        },
        infoText: {
          flex: 1,
          fontSize: 14,
          color: colors.text,
        },
        infoLink: {
          color: colors.primary,
        },
        eventCard: {
          backgroundColor: colors.card,
          borderRadius: 12,
          padding: 14,
          marginBottom: 8,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        },
        eventDateBlock: {
          width: 52,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 6,
          borderRadius: 8,
          backgroundColor: darkMode
            ? 'rgba(255,255,255,0.05)'
            : 'rgba(0,0,0,0.04)',
        },
        eventDateMonth: {
          fontSize: 11,
          fontWeight: '700',
          color: colors.primary,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        },
        eventDateDay: {
          fontSize: 18,
          fontWeight: '800',
          color: colors.text,
          lineHeight: 20,
        },
        eventBody: {flex: 1},
        eventName: {
          fontSize: 15,
          fontWeight: '700',
          color: colors.text,
        },
        eventMeta: {
          fontSize: 12,
          color: colors.secondaryText,
          marginTop: 2,
        },
        eventStats: {
          fontSize: 12,
          color: colors.primary,
          fontWeight: '700',
          marginTop: 4,
        },
        emptyEvents: {
          padding: 16,
          backgroundColor: colors.card,
          borderRadius: 12,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          alignItems: 'center',
        },
        emptyEventsText: {
          color: colors.secondaryText,
          textAlign: 'center',
          fontSize: 13,
          lineHeight: 18,
          marginBottom: 12,
        },
        emptyEventsCta: {
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 14,
          backgroundColor: colors.primary,
        },
        emptyEventsCtaText: {
          color: '#FFFFFF',
          fontWeight: '700',
          fontSize: 13,
        },
      }),
    [colors, darkMode],
  );

  // ── Renderers ─────────────────────────────────────────────────────────
  const renderEventCard = (e: EventCard) => {
    const dateObj = parseEventDate(e.date);
    const monthAbbr = dateObj
      ? dateObj.toLocaleString('en-US', {month: 'short'})
      : '';
    const dayNum = dateObj ? String(dateObj.getDate()) : '';
    return (
      <TouchableOpacity
        key={e._id}
        style={styles.eventCard}
        activeOpacity={0.8}
        onPress={() => {
          const parent = navigation.getParent();
          const params = {highlightEventId: e._id};
          if (parent) {
            parent.dispatch(
              CommonActions.navigate({
                name: 'Events',
                params: {screen: 'EventList', params},
              }),
            );
          } else {
            navigation.navigate('Events', {screen: 'EventList', params});
          }
        }}>
        <View style={styles.eventDateBlock}>
          <Text style={styles.eventDateMonth}>{monthAbbr}</Text>
          <Text style={styles.eventDateDay}>{dayNum}</Text>
        </View>
        <View style={styles.eventBody}>
          <Text style={styles.eventName} numberOfLines={1}>
            {e.name}
          </Text>
          <Text style={styles.eventMeta} numberOfLines={1}>
            {e.time}
            {e.eventType ? ` · ${e.eventType}` : ''}
            {e.createdByUsername ? ` · by ${e.createdByUsername}` : ''}
          </Text>
          <Text style={styles.eventStats}>
            {e.rosterSpotsFilled}/{e.totalSpots} going
          </Text>
        </View>
        <FontAwesomeIcon
          icon={faChevronRight}
          size={14}
          color={colors.secondaryText}
        />
      </TouchableOpacity>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <FontAwesomeIcon icon={faArrowLeft} size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {place.name}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {heroPhotoUrl ? (
            <Image
              source={{uri: heroPhotoUrl}}
              style={styles.heroImage}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.heroEmoji}>📍</Text>
          )}
        </View>

        <View style={styles.venueHeader}>
          <Text style={styles.venueName}>{place.name}</Text>
          <View style={styles.venueMetaRow}>
            {place.primaryTypeDisplayName ? (
              <View style={styles.venueMetaChip}>
                <Text style={styles.venueMetaText}>
                  {place.primaryTypeDisplayName}
                </Text>
              </View>
            ) : null}
            {ratingText ? (
              <View style={styles.venueMetaChip}>
                <FontAwesomeIcon
                  icon={faStar}
                  size={12}
                  color={colors.secondaryText}
                />
                <Text style={styles.venueMetaText}>{ratingText}</Text>
              </View>
            ) : null}
            {typeof place.currentOpeningHours?.openNow === 'boolean' ? (
              <View style={styles.venueMetaChip}>
                <Text
                  style={[
                    styles.venueMetaText,
                    {
                      color: place.currentOpeningHours.openNow
                        ? colors.primary
                        : colors.secondaryText,
                    },
                  ]}>
                  {place.currentOpeningHours.openNow ? 'Open now' : 'Closed'}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.ctaRow}>
          <TouchableOpacity
            style={styles.primaryCta}
            activeOpacity={0.85}
            onPress={handlePlanEvent}>
            <FontAwesomeIcon icon={faPlus} size={14} color="#FFFFFF" />
            <Text style={styles.primaryCtaText}>Plan event here</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryCta}
            activeOpacity={0.85}
            onPress={handleViewWebsite}>
            <FontAwesomeIcon icon={faGlobe} size={14} color={colors.text} />
            <Text style={styles.secondaryCtaText}>
              {place.websiteUri ? 'View website' : 'Search the web'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Happening Here</Text>
          {eventsLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : events.length > 0 ? (
            events.map(renderEventCard)
          ) : (
            <View style={styles.emptyEvents}>
              <Text style={styles.emptyEventsText}>
                No events here yet. Be the first to plan one with friends.
              </Text>
              <TouchableOpacity
                style={styles.emptyEventsCta}
                onPress={handlePlanEvent}>
                <Text style={styles.emptyEventsCtaText}>Plan event here</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          {place.formattedAddress ? (
            <TouchableOpacity
              style={styles.infoRow}
              onPress={handleGetDirections}
              activeOpacity={0.7}>
              <View style={styles.infoIcon}>
                <FontAwesomeIcon
                  icon={faMapMarkerAlt}
                  size={14}
                  color={colors.secondaryText}
                />
              </View>
              <Text style={[styles.infoText, styles.infoLink]}>
                {place.formattedAddress}
              </Text>
            </TouchableOpacity>
          ) : null}
          {todayHoursText ? (
            <View style={styles.infoRow}>
              <View style={styles.infoIcon}>
                <FontAwesomeIcon
                  icon={faClock}
                  size={14}
                  color={colors.secondaryText}
                />
              </View>
              <Text style={styles.infoText}>{todayHoursText}</Text>
            </View>
          ) : null}
          {place.nationalPhoneNumber || place.internationalPhoneNumber ? (
            <TouchableOpacity
              style={styles.infoRow}
              onPress={handleCallVenue}
              activeOpacity={0.7}>
              <View style={styles.infoIcon}>
                <FontAwesomeIcon
                  icon={faPhone}
                  size={14}
                  color={colors.secondaryText}
                />
              </View>
              <Text style={[styles.infoText, styles.infoLink]}>
                {place.nationalPhoneNumber || place.internationalPhoneNumber}
              </Text>
            </TouchableOpacity>
          ) : null}
          {place.websiteUri ? (
            <TouchableOpacity
              style={styles.infoRow}
              onPress={handleViewWebsite}
              activeOpacity={0.7}>
              <View style={styles.infoIcon}>
                <FontAwesomeIcon
                  icon={faGlobe}
                  size={14}
                  color={colors.secondaryText}
                />
              </View>
              <Text
                style={[styles.infoText, styles.infoLink]}
                numberOfLines={1}>
                {place.websiteUri.replace(/^https?:\/\//, '')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Future home of the "Friends who've been here" avatar strip — needs
            a backend query for events at this venue with my friends in the
            roster. Punted to a follow-up so PR 2 stays focused on the
            primary discover → plan flow. */}
      </ScrollView>
    </SafeAreaView>
  );
};

export default VenuePlaceDetail;
