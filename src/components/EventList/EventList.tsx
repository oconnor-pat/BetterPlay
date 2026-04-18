import React, {
  useState,
  useContext,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
  ScrollView,
  Share,
  KeyboardAvoidingView,
  Keyboard,
  LayoutAnimation,
  UIManager,
  Image,
  Switch,
  Animated,
  PanResponder,
  AppState,
} from 'react-native';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import AsyncStorage from '@react-native-async-storage/async-storage';

// Safe import: react-native-config may not be linked on Android
let Config: {GOOGLE_PLACES_API_KEY?: string} = {};
try {
  Config = require('react-native-config').default || {};
} catch (e) {
  Config = {};
}
import MapView, {Marker, PROVIDER_GOOGLE} from 'react-native-maps';
import DateTimePicker from '@react-native-community/datetimepicker';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Picker} from '@react-native-picker/picker';
import {GooglePlacesAutocomplete} from 'react-native-google-places-autocomplete';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {EventListSkeleton} from '../Skeleton';
import {
  faPlus,
  faTrash,
  faCog,
  faSearch,
  faTimes,
  faFilter,
  faShareAlt,
  faLocationArrow,
  faComments,
  faHeart,
  faGlobe,
  faLock,
  faEnvelope,
  faBell,
  faChevronRight,
  faRotate,
  faEllipsisH,
  faMapMarkerAlt,
  faCalendarAlt,
  faUsers,
  faCheck,
  faPenToSquare,
  faUserPlus,
} from '@fortawesome/free-solid-svg-icons';
import {
  useNavigation,
  NavigationProp,
  useRoute,
  RouteProp,
} from '@react-navigation/native';
import HamburgerMenu from '../HamburgerMenu/HamburgerMenu';
import UserContext, {UserContextType} from '../UserContext';
import {useTheme} from '../ThemeContext/ThemeContext';
import axios from 'axios';
import {API_BASE_URL} from '../../config/api';
import {useTranslation} from 'react-i18next';
import EventComments from './EventComments';
import CountdownTimer from './CountdownTimer';
import {useNotifications} from '../../Context/NotificationContext';
import {useSocket} from '../../Context/SocketContext';
import notificationService from '../../services/NotificationService';
import locationService, {Coordinates} from '../../services/LocationService';
import {
  AvailableMapApp,
  openDirections,
} from '../../services/MapLauncher';
import MapAppPicker from '../MapAppPicker/MapAppPicker';
import eventWatchService, {
  EventWatchPreferences,
} from '../../services/EventWatchService';

export type RootStackParamList = {
  EventList:
    | {
        highlightEventId?: string;
        expandComments?: boolean;
        profileFilter?: 'created' | 'joined';
        userId?: string;
      }
    | undefined;
  EventRoster: {
    eventId: string;
    eventName: string;
    eventType: string;
    date: string;
    time: string;
    location: string;
    totalSpots: number;
    roster: any[];
    jerseyColors?: string[];
  };
  Profile: {_id: string};
};

// Privacy options for events
type EventPrivacy = 'public' | 'private' | 'invite-only';

const privacyOptions: {
  value: EventPrivacy;
  label: string;
  icon: any;
  description: string;
}[] = [
  {
    value: 'public',
    label: 'Public',
    icon: faGlobe,
    description: 'Anyone can see and join',
  },
  {
    value: 'private',
    label: 'Private',
    icon: faLock,
    description: 'Only you can see this event',
  },
  {
    value: 'invite-only',
    label: 'Invite Only',
    icon: faEnvelope,
    description: 'Only invited users can see and join',
  },
];

type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly';

interface Event {
  _id: string;
  name: string;
  location: string; // human-readable address
  time: string;
  date: string;
  rosterSpotsFilled: number;
  totalSpots: number;
  eventType: string;
  createdBy: string;
  createdByUsername?: string;
  createdByProfilePicUrl?: string;
  createdAt?: string;
  likes?: string[];
  latitude?: number;
  longitude?: number;
  jerseyColors?: string[];
  description?: string;
  privacy?: EventPrivacy;
  invitedUsers?: string[];
  commentCount?: number;
  isRecurring?: boolean;
  recurrenceGroupId?: string;
  recurrenceFrequency?: RecurrenceFrequency;
  waitlist?: Array<{userId: string; username: string; profilePicUrl?: string; joinedAt: string}>;
}

const getDefaultWatchPreferences = (): EventWatchPreferences => ({
  spotsAvailable: true,
  generalUpdates: true,
  rosterChanges: false,
  reminders: false,
});

// Google Places API configuration from environment variable
const GOOGLE_PLACES_API_KEY = Config.GOOGLE_PLACES_API_KEY || '';

// Check if API key is configured
const isApiKeyConfigured = !!GOOGLE_PLACES_API_KEY;

// Helper function to create empty event object
const recurrenceOptions: {
  value: RecurrenceFrequency;
  label: string;
  description: string;
}[] = [
  {value: 'weekly', label: 'Weekly', description: 'Same day every week'},
  {value: 'biweekly', label: 'Biweekly', description: 'Every two weeks'},
  {value: 'monthly', label: 'Monthly', description: 'Same day each month'},
];

const recurrenceCountOptions = [2, 3, 4, 5, 6, 8, 10, 12];

const createEmptyEvent = () => ({
  name: '',
  location: '',
  time: '',
  date: '',
  totalSpots: '',
  eventType: '',
  latitude: undefined as number | undefined,
  longitude: undefined as number | undefined,
  jerseyColors: [] as string[],
  privacy: 'public' as EventPrivacy,
  invitedUsers: [] as string[],
  isRecurring: false,
  recurrenceFrequency: 'weekly' as RecurrenceFrequency,
  recurrenceCount: 4,
});

const rosterSizeOptions: string[] = Array.from({length: 30}, (_, i) =>
  (i + 1).toString(),
);

const activityOptions = [
  // Sports
  {label: 'Basketball', emoji: '🏀', category: 'sports'},
  {label: 'Hockey', emoji: '🏒', category: 'sports'},
  {label: 'Soccer', emoji: '⚽', category: 'sports'},
  {label: 'Figure Skating', emoji: '⛸️', category: 'sports'},
  {label: 'Tennis', emoji: '🎾', category: 'sports'},
  {label: 'Golf', emoji: '⛳', category: 'sports'},
  {label: 'Football', emoji: '🏈', category: 'sports'},
  {label: 'Rugby', emoji: '🏉', category: 'sports'},
  {label: 'Baseball', emoji: '⚾', category: 'sports'},
  {label: 'Softball', emoji: '🥎', category: 'sports'},
  {label: 'Lacrosse', emoji: '🥍', category: 'sports'},
  {label: 'Volleyball', emoji: '🏐', category: 'sports'},
  // Social & Entertainment
  {label: 'Trivia Night', emoji: '🧠', category: 'social'},
  {label: 'Game Night', emoji: '🎲', category: 'social'},
  {label: 'Karaoke', emoji: '🎤', category: 'social'},
  {label: 'Open Mic', emoji: '🎙️', category: 'social'},
  {label: 'Watch Party', emoji: '📺', category: 'social'},
  {label: 'Live Music', emoji: '🎵', category: 'social'},
  // Outdoor & Fitness
  {label: 'Hiking', emoji: '🥾', category: 'outdoor'},
  {label: 'Cycling', emoji: '🚴', category: 'outdoor'},
  {label: 'Running', emoji: '🏃', category: 'outdoor'},
  {label: 'Yoga', emoji: '🧘', category: 'outdoor'},
  {label: 'Fishing', emoji: '🎣', category: 'outdoor'},
  {label: 'Camping', emoji: '🏕️', category: 'outdoor'},
  // Community & Learning
  {label: 'Book Club', emoji: '📚', category: 'community'},
  {label: 'Workshop', emoji: '🛠️', category: 'community'},
  {label: 'Meetup', emoji: '🤝', category: 'community'},
  {label: 'Potluck', emoji: '🍲', category: 'community'},
  {label: 'Volunteer', emoji: '💚', category: 'community'},
  // Other
  {label: 'Other', emoji: '🎯', category: 'other'},
];

// Team-based sports that benefit from jersey color selection
const teamSports = [
  'Basketball',
  'Hockey',
  'Soccer',
  'Football',
  'Rugby',
  'Lacrosse',
  'Volleyball',
];

// Available jersey colors for team selection
const jerseyColorOptions: {label: string; color: string}[] = [
  {label: 'Red', color: '#E53935'},
  {label: 'Blue', color: '#1E88E5'},
  {label: 'Green', color: '#43A047'},
  {label: 'White', color: '#FAFAFA'},
  {label: 'Black', color: '#212121'},
];

const isTeamSport = (eventType: string) =>
  teamSports.some(sport => sport.toLowerCase() === eventType.toLowerCase());

// Helper to format event time for display, respecting user's locale
const formatDisplayTime = (timeStr?: string): string => {
  if (!timeStr) {
    return '';
  }
  try {
    let hours: number;
    let minutes: number;

    // Parse 24h format like "18:30"
    const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    // Parse 12h format like "6:30 PM" or "06:30 AM"
    const match12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

    if (match24) {
      hours = parseInt(match24[1], 10);
      minutes = parseInt(match24[2], 10);
    } else if (match12) {
      hours = parseInt(match12[1], 10);
      const period = match12[3].toUpperCase();
      if (period === 'PM' && hours !== 12) {
        hours += 12;
      }
      if (period === 'AM' && hours === 12) {
        hours = 0;
      }
      minutes = parseInt(match12[2], 10);
    } else {
      return timeStr;
    }

    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return timeStr;
  }
};

// Helper to format relative timestamp
const formatRelativeTime = (dateString?: string): string => {
  if (!dateString) {
    return '';
  }
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffMins < 1) {
    return 'Just now';
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  if (diffDays < 30) {
    return `${diffWeeks}w ago`;
  }
  if (diffMonths < 12) {
    return `${diffMonths}mo ago`;
  }
  return `${diffYears}y ago`;
};

// Helper to get initials from username
const getInitials = (username: string): string => {
  if (!username) {
    return '?';
  }
  return username.slice(0, 2).toUpperCase();
};

// Prefer real-name initials (first + last) when a full name is available.
// Falls back to first two characters of name, then username.
const getCreatorInitials = (name?: string, username?: string): string => {
  const trimmedName = name?.trim();
  if (trimmedName) {
    const parts = trimmedName.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return trimmedName.slice(0, 2).toUpperCase();
  }
  return getInitials(username || '');
};

const AVATAR_COLORS = [
  '#E74C3C',
  '#3498DB',
  '#2ECC71',
  '#9B59B6',
  '#E67E22',
  '#1ABC9C',
  '#F39C12',
  '#16A085',
  '#D35400',
  '#8E44AD',
];

const getAvatarColor = (username?: string): string => {
  if (!username) {
    return AVATAR_COLORS[0];
  }
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

// Interface for liked by user data
interface LikedByUser {
  _id: string;
  username: string;
  name?: string;
  profilePicUrl?: string;
}

// Helper function to check if an event date/time has passed
const isEventPast = (eventDate: string, eventTime: string): boolean => {
  const now = new Date();

  // Parse the date - handle formats like "Fri Jan 23 2026" or "Jan 23, 2026"
  // Remove day name if present (e.g., "Fri ", "Mon ", etc.)
  let cleanDate = eventDate.replace(/^[A-Za-z]{3}\s+/, '');

  // Try to parse the date with multiple approaches
  let eventDateTime: Date | null = null;

  // Approach 1: Parse "Jan 23 2026" or "Jan 23, 2026" format
  const monthDayYearMatch = cleanDate.match(
    /([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/,
  );
  if (monthDayYearMatch) {
    const [, month, day, year] = monthDayYearMatch;
    eventDateTime = new Date(`${month} ${day}, ${year}`);
  }

  // Approach 2: If first approach failed, try direct parsing
  if (!eventDateTime || isNaN(eventDateTime.getTime())) {
    eventDateTime = new Date(cleanDate);
  }

  // Approach 3: Try the original date string
  if (!eventDateTime || isNaN(eventDateTime.getTime())) {
    eventDateTime = new Date(eventDate);
  }

  // If we still don't have a valid date, return false (treat as not past)
  if (!eventDateTime || isNaN(eventDateTime.getTime())) {
    return false;
  }

  // Parse time - handle formats like "6:30 PM" or "18:30"
  let hours = 0;
  let minutes = 0;
  const timeMatch = eventTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (timeMatch) {
    hours = parseInt(timeMatch[1], 10);
    minutes = parseInt(timeMatch[2], 10);
    const period = timeMatch[3]?.toUpperCase();
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }
  }

  eventDateTime.setHours(hours, minutes, 0, 0);
  return eventDateTime < now;
};

const dateFilterOptions = [
  {label: 'All Dates', value: 'all'},
  {label: 'Today', value: 'today'},
  {label: 'Tomorrow', value: 'tomorrow'},
  {label: 'This Week', value: 'thisWeek'},
  {label: 'This Month', value: 'thisMonth'},
];

// App Store Links - Update these with your actual app store URLs when published
const APP_STORE_LINKS = {
  ios: 'https://apps.apple.com/app/betterplay/id000000000', // Replace with your iOS App Store link
  android: 'https://play.google.com/store/apps/details?id=com.betterplay', // Replace with your Google Play link
  fallback: 'https://betterplay.app', // Replace with your website/landing page
};

const getEventTypeEmoji = (eventType: string) => {
  const found = activityOptions.find(
    opt => opt.label.toLowerCase() === eventType.toLowerCase(),
  );
  return found ? found.emoji : '🎯';
};

// Open maps for an event — delegates to shared MapLauncher
const openMapsForEvent = async (
  event: Partial<Event>,
  t: (key: string) => string,
  presentPicker?: (apps: AvailableMapApp[], onCancel: () => void) => void,
) => {
  const name = event?.name || 'Destination';
  const address = event?.location || '';

  const coords =
    event?.latitude && event?.longitude
      ? {latitude: event.latitude, longitude: event.longitude}
      : getCoordinatesFromLocation(address);

  await openDirections(
    {
      name,
      address: address || name,
      latitude: coords.latitude,
      longitude: coords.longitude,
    },
    t,
    presentPicker,
  );
};

// Helper function to get approximate coordinates from common locations
const getCoordinatesFromLocation = (
  location: string,
): {latitude: number; longitude: number} => {
  const normalizedLocation = location.toLowerCase().trim();

  // Common location coordinates - you can expand this based on your needs
  const locationMap: {[key: string]: {latitude: number; longitude: number}} = {
    // Sports venues and common locations
    'madison square garden': {latitude: 40.7505, longitude: -73.9934},
    'yankee stadium': {latitude: 40.8296, longitude: -73.9262},
    'central park': {latitude: 40.7829, longitude: -73.9654},
    'golden gate park': {latitude: 37.7694, longitude: -122.4862},
    'griffith observatory': {latitude: 34.1184, longitude: -118.3004},
    'millennium park': {latitude: 41.8826, longitude: -87.6226},

    // Default city centers
    'san francisco': {latitude: 37.7749, longitude: -122.4194},
    'new york': {latitude: 40.7128, longitude: -74.006},
    'los angeles': {latitude: 34.0522, longitude: -118.2437},
    chicago: {latitude: 41.8781, longitude: -87.6298},
    boston: {latitude: 42.3601, longitude: -71.0589},
    seattle: {latitude: 47.6062, longitude: -122.3321},
  };

  // Check for exact matches first
  if (locationMap[normalizedLocation]) {
    return locationMap[normalizedLocation];
  }

  // Check for partial matches (city names within addresses)
  for (const [key, coords] of Object.entries(locationMap)) {
    if (normalizedLocation.includes(key)) {
      return coords;
    }
  }

  // Default to San Francisco if no match found
  return {latitude: 37.7749, longitude: -122.4194};
};

interface RecurringDeckProps {
  groupId: string;
  events: Event[];
  activeIndex: number;
  onIndexChange: (idx: number) => void;
  onCollapse: () => void;
  renderEventCard: (args: {item: Event}) => React.ReactElement;
  colors: any;
  themedStyles: any;
}

const SWIPE_THRESHOLD = 60;
const STACK_OFFSET = 8;
const STACK_SCALE_STEP = 0.035;

const RecurringDeck: React.FC<RecurringDeckProps> = ({
  groupId,
  events,
  activeIndex,
  onIndexChange,
  onCollapse,
  renderEventCard,
  colors,
  themedStyles,
}) => {
  const pan = useRef(new Animated.ValueXY()).current;
  const activeIndexRef = useRef(activeIndex);
  const eventsLengthRef = useRef(events.length);

  activeIndexRef.current = activeIndex;
  eventsLengthRef.current = events.length;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gs) =>
          Math.abs(gs.dx) > 15 && Math.abs(gs.dy) < 40,
        onPanResponderMove: Animated.event([null, {dx: pan.x}], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_, gs) => {
          if (Math.abs(gs.dx) > SWIPE_THRESHOLD) {
            const direction = gs.dx > 0 ? 1 : -1;
            Animated.timing(pan.x, {
              toValue: direction * 400,
              duration: 200,
              useNativeDriver: false,
            }).start(() => {
              pan.setValue({x: 0, y: 0});
              const len = eventsLengthRef.current;
              const cur = activeIndexRef.current;
              const newIndex =
                direction < 0 ? (cur + 1) % len : (cur - 1 + len) % len;
              onIndexChange(newIndex);
            });
          } else {
            Animated.spring(pan, {
              toValue: {x: 0, y: 0},
              useNativeDriver: false,
              friction: 5,
            }).start();
          }
        },
      }),
    [pan, onIndexChange],
  );

  const rotation = pan.x.interpolate({
    inputRange: [-200, 0, 200],
    outputRange: ['-8deg', '0deg', '8deg'],
    extrapolate: 'clamp',
  });

  const visibleCount = Math.min(events.length, 3);

  return (
    <View key={groupId}>
      <View style={themedStyles.recurringCarouselHeader}>
        <View style={themedStyles.rowCenter}>
          <FontAwesomeIcon icon={faRotate} size={13} color={colors.primary} />
          <Text style={themedStyles.recurringCarouselTitle}>
            {events[activeIndex]?.name || events[0].name}
          </Text>
        </View>
        <TouchableOpacity onPress={onCollapse}>
          <Text style={themedStyles.recurringCollapseText}>Collapse</Text>
        </TouchableOpacity>
      </View>

      <View style={themedStyles.carouselPageLabel}>
        <Text style={themedStyles.carouselPageLabelText}>
          {activeIndex + 1} of {events.length}
        </Text>
      </View>

      <View
        style={{
          paddingBottom: (visibleCount - 1) * STACK_OFFSET + 12,
        }}>
        <View style={themedStyles.positionRelative}>
          {Array.from({length: visibleCount})
            .map((_, i) => i)
            .reverse()
            .map(i => {
              const eventIdx = (activeIndex + i) % events.length;
              const evt = events[eventIdx];

              if (i === 0) {
                return (
                  <Animated.View
                    key={'deck-top'}
                    {...panResponder.panHandlers}
                    style={{
                      zIndex: visibleCount,
                      transform: [{translateX: pan.x}, {rotate: rotation}],
                    }}>
                    {renderEventCard({item: evt})}
                  </Animated.View>
                );
              }

              const offset = i * STACK_OFFSET;
              const scale = 1 - i * STACK_SCALE_STEP;
              const horizontalInset = i * 6;
              return (
                <View
                  key={`deck-bg-${i}`}
                  style={[
                    themedStyles.deckBgCardBase,
                    {
                      top: offset,
                      left: horizontalInset,
                      right: horizontalInset,
                      opacity: 1 - i * 0.2,
                      zIndex: visibleCount - i,
                      transform: [{scaleY: scale}],
                    },
                  ]}>
                  {renderEventCard({item: evt})}
                </View>
              );
            })}
        </View>
      </View>

      <View style={themedStyles.deckNavRow}>
        <TouchableOpacity
          onPress={() =>
            onIndexChange((activeIndex - 1 + events.length) % events.length)
          }
          style={themedStyles.deckNavButton}>
          <Text style={themedStyles.deckNavButtonText}>{'‹'} Prev</Text>
        </TouchableOpacity>
        <View style={themedStyles.deckDots}>
          {events.length <= 12 ? (
            events.map((_, i) => (
              <View
                key={i}
                style={[
                  themedStyles.deckDot,
                  i === activeIndex && themedStyles.deckDotActive,
                ]}
              />
            ))
          ) : (
            <Text style={themedStyles.carouselPageLabelText}>
              {activeIndex + 1} / {events.length}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => onIndexChange((activeIndex + 1) % events.length)}
          style={themedStyles.deckNavButton}>
          <Text style={themedStyles.deckNavButtonText}>Next {'›'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const EventList: React.FC = () => {
  const {userData} = useContext(UserContext) as UserContextType;
  const {colors, darkMode} = useTheme();
  const {t} = useTranslation();
  const {badgeCount, hasPermission, requestPermission, settings} =
    useNotifications();
  const {subscribe: socketSubscribe} = useSocket();

  const themedStyles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          paddingTop: 16,
          backgroundColor: colors.background,
        },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          paddingTop: 8,
          paddingHorizontal: 16,
          backgroundColor: colors.background,
          zIndex: 1,
        },
        headerSide: {
          flexDirection: 'row',
          alignItems: 'center',
          width: 90,
        },
        title: {
          fontSize: 22,
          fontWeight: '700',
          color: colors.primary,
          textAlign: 'center',
          flex: 1,
          letterSpacing: 0.2,
        },
        card: {
          backgroundColor: colors.card,
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 10,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          overflow: 'hidden',
        },
        cardHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        },
        cardHeaderLeft: {
          flexDirection: 'row',
          alignItems: 'center',
          flex: 1,
          gap: 10,
        },
        avatar: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
        },
        avatarText: {
          color: '#fff',
          fontSize: 15,
          fontWeight: '700',
          letterSpacing: 0.3,
        },
        cardHeaderIdentity: {
          flex: 1,
        },
        cardHeaderUsername: {
          color: colors.text,
          fontSize: 15,
          fontWeight: '700',
        },
        cardHeaderMetaRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 1,
          flexWrap: 'wrap',
          gap: 4,
        },
        cardHeaderMeta: {
          color: colors.secondaryText,
          fontSize: 12,
          fontWeight: '400',
        },
        cardHeaderMetaDot: {
          color: colors.secondaryText,
          fontSize: 12,
          marginHorizontal: 1,
        },
        pastEventLabel: {
          fontWeight: '600',
          textTransform: 'uppercase' as const,
          letterSpacing: 0.4,
          fontSize: 10,
        },
        cardOptionsButton: {
          padding: 6,
          marginLeft: 6,
        },
        cardBody: {
          marginBottom: 10,
        },
        cardTitleRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          marginBottom: 8,
          gap: 8,
        },
        cardEventEmoji: {
          fontSize: 20,
          lineHeight: 24,
        },
        cardEventTitle: {
          color: colors.text,
          fontSize: 18,
          fontWeight: '700',
          flex: 1,
          lineHeight: 24,
          letterSpacing: -0.2,
        },
        detailRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginTop: 4,
        },
        detailText: {
          color: colors.secondaryText,
          fontSize: 13.5,
          flex: 1,
        },
        mapEmbed: {
          borderRadius: 12,
          overflow: 'hidden' as const,
          marginBottom: 10,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        mapEmbedView: {
          height: 140,
          width: '100%',
        },
        mapEmbedOverlay: {
          position: 'absolute',
          bottom: 8,
          right: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: 'rgba(0,0,0,0.65)',
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 14,
        },
        mapEmbedOverlayText: {
          color: '#fff',
          fontSize: 12,
          fontWeight: '600',
        },
        engagementRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: 8,
          paddingBottom: 4,
          gap: 24,
        },
        engagementButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 4,
        },
        engagementCount: {
          color: colors.secondaryText,
          fontSize: 13,
          fontWeight: '500',
        },
        engagementSpacer: {
          flex: 1,
        },
        pastEventCard: {
          opacity: 0.6,
          backgroundColor: colors.card,
        },
        pastEventBadge: {
          position: 'absolute' as const,
          top: 12,
          right: 12,
          backgroundColor: colors.placeholder || '#888',
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 12,
          zIndex: 1,
        },
        pastEventBadgeText: {
          color: '#fff',
          fontSize: 11,
          fontWeight: '700',
          textTransform: 'uppercase' as const,
          letterSpacing: 0.5,
        },
        cardHeaderSection: {
          marginBottom: 14,
        },
        cardDetailsSection: {
          backgroundColor: colors.inputBackground || colors.background,
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
          gap: 12,
        },
        cardRow: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        cardEmoji: {
          fontSize: 17,
          marginRight: 10,
          width: 24,
          textAlign: 'center',
        },
        cardTitle: {
          color: colors.text,
          fontWeight: 'bold',
          fontSize: 19,
          flex: 1,
        },
        cardText: {
          color: colors.text,
          fontSize: 15,
          flex: 1,
        },
        cardSpacer: {
          height: 6,
        },
        mapBox: {
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.primary + '60',
          backgroundColor: colors.inputBackground || '#eaeaea',
          marginVertical: 10,
          ...(Platform.OS === 'ios' ? {overflow: 'hidden' as const} : {}),
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 1},
          shadowOpacity: 0.06,
          shadowRadius: 4,
          elevation: 2,
        },
        mapView: {
          height: 120,
          width: '100%',
        },
        mapOverlay: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          padding: 8,
          alignItems: 'center',
        },
        mapEmoji: {
          fontSize: 22,
          marginBottom: 4,
        },
        mapText: {
          color: '#fff',
          fontSize: 14,
          fontWeight: '600',
          textAlign: 'center',
        },
        mapSubtext: {
          color: '#fff',
          fontSize: 12,
          opacity: 0.8,
          textAlign: 'center',
        },
        actionRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 12,
          gap: 10,
        },
        actionButton: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
          borderRadius: 12,
          paddingVertical: 13,
          paddingHorizontal: 18,
          borderWidth: 1.5,
          borderColor: colors.primary,
          flex: 1,
        },
        joinButton: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
        actionButtonIcon: {
          marginRight: 8,
        },
        actionButtonText: {
          fontWeight: '600',
          fontSize: 15,
          color: colors.primary,
        },
        joinButtonText: {
          color: colors.buttonText || '#fff',
        },
        watchButtonWatched: {
          backgroundColor: colors.primary + '15',
        },
        watchButtonTextWatched: {
          color: colors.primary,
        },
        iconContainer: {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: 14,
          paddingTop: 14,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border + '60',
          gap: 20,
        },
        iconButton: {
          padding: 10,
          borderRadius: 20,
          backgroundColor: colors.inputBackground || colors.background,
        },
        likeButtonContainer: {
          position: 'relative' as const,
          padding: 10,
          borderRadius: 20,
          backgroundColor: colors.inputBackground || colors.background,
        },
        iconCountBadge: {
          position: 'absolute' as const,
          top: -5,
          right: -8,
          backgroundColor: '#FF3B30',
          borderRadius: 9,
          minWidth: 18,
          height: 18,
          paddingHorizontal: 4,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
        },
        iconCountBadgeText: {
          color: '#fff',
          fontSize: 10,
          fontWeight: '700' as const,
        },
        commentButtonContainer: {
          position: 'relative' as const,
        },
        addButton: {
          width: 38,
          height: 38,
          backgroundColor: colors.primary,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
        },
        fab: {
          position: 'absolute',
          bottom: 24,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: colors.primary,
          shadowOffset: {width: 0, height: 4},
          shadowOpacity: 0.35,
          shadowRadius: 8,
          elevation: 8,
          zIndex: 100,
        },
        headerRight: {
          justifyContent: 'flex-end',
          gap: 14,
        },
        bellButton: {
          width: 38,
          height: 38,
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        },
        badge: {
          position: 'absolute',
          top: -4,
          right: -6,
          backgroundColor: '#FF3B30',
          borderRadius: 10,
          minWidth: 18,
          height: 18,
          paddingHorizontal: 3,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: colors.background,
        },
        badgeText: {
          color: '#fff',
          fontSize: 10,
          fontWeight: '700',
        },
        modalOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'flex-end',
        },
        modalView: {
          backgroundColor: colors.background,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 24 : 16,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          shadowColor: '#000',
          shadowOffset: {width: 0, height: -4},
          shadowOpacity: 0.18,
          shadowRadius: 16,
          elevation: 12,
          maxHeight: '90%',
        },
        modalHandle: {
          alignSelf: 'center',
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
          marginBottom: 8,
        },
        modalFormScroll: {
          flexGrow: 0,
        },
        modalBody: {
          paddingHorizontal: 16,
          paddingTop: 12,
        },
        modalHeader: {
          color: colors.text,
          fontSize: 17,
          paddingHorizontal: 16,
          paddingBottom: 12,
          textAlign: 'center',
          fontWeight: '700',
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        modalLabel: {
          color: colors.secondaryText,
          fontSize: 12,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: 6,
        },
        modalInput: {
          backgroundColor: colors.inputBackground || colors.background,
          color: colors.text,
          paddingHorizontal: 14,
          paddingVertical: 12,
          marginBottom: 10,
          borderRadius: 12,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          fontSize: 15,
          minHeight: 46,
          justifyContent: 'center',
        },
        autocompleteContainer: {
          marginBottom: 10,
          zIndex: 1000,
        },
        saveButton: {
          backgroundColor: colors.primary,
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 24,
          flex: 1,
          alignItems: 'center',
          marginHorizontal: 5,
          minWidth: 90,
        },
        cancelButton: {
          backgroundColor: 'transparent',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        buttonText: {
          color: colors.buttonText || '#fff',
          textAlign: 'center',
          fontWeight: '700',
          fontSize: 14,
        },
        cancelButtonText: {
          color: colors.secondaryText,
        },
        buttonContainer: {
          flexDirection: 'row',
          justifyContent: 'center',
          paddingHorizontal: 16,
          paddingTop: 16,
          alignItems: 'center',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        confirmButton: {
          color: '#fff',
          textAlign: 'center',
          marginTop: 8,
          marginBottom: 10,
          fontSize: 13,
          fontWeight: '700',
          backgroundColor: colors.primary,
          paddingVertical: 10,
          paddingHorizontal: 16,
          borderRadius: 22,
          overflow: 'hidden',
          alignSelf: 'center',
        },
        pickerContainer: {
          backgroundColor: colors.inputBackground || colors.background,
          borderRadius: 12,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          marginBottom: 8,
          overflow: 'hidden',
        },
        // ── Event card options menu (bottom sheet) ──
        optionsMenuSheet: {
          backgroundColor: colors.background,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 28 : 16,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        optionsMenuHeaderBlock: {
          paddingHorizontal: 16,
          paddingBottom: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        optionsMenuTitle: {
          fontSize: 17,
          fontWeight: '700',
          color: colors.text,
          textAlign: 'center',
        },
        optionsMenuSubtitle: {
          fontSize: 13,
          color: colors.secondaryText,
          textAlign: 'center',
          marginTop: 2,
        },
        optionsMenuRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        optionsMenuIconContainer: {
          width: 32,
          height: 32,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        },
        optionsMenuLabel: {
          flex: 1,
          fontSize: 15,
          fontWeight: '600',
          color: colors.text,
        },
        optionsMenuLabelDanger: {
          color: colors.error,
          fontWeight: '700',
        },
        optionsMenuCancel: {
          marginTop: 12,
          marginHorizontal: 16,
          backgroundColor: 'transparent',
          borderRadius: 24,
          paddingVertical: 12,
          alignItems: 'center',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        optionsMenuCancelText: {
          fontSize: 14,
          fontWeight: '700',
          color: colors.secondaryText,
        },
        picker: {
          backgroundColor: 'transparent',
          color: colors.text,
        },
        eventUsername: {
          color: colors.primary,
          fontSize: 13,
          fontWeight: '600',
        },
        eventTimestamp: {
          color: colors.secondaryText,
          fontSize: 12,
          fontWeight: '400',
          marginLeft: 8,
        },
        creatorRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 4,
          paddingVertical: 4,
          paddingHorizontal: 8,
          backgroundColor: colors.inputBackground || 'rgba(0,0,0,0.05)',
          borderRadius: 12,
          alignSelf: 'flex-start',
        },
        searchContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.inputBackground || colors.card,
          borderRadius: 22,
          paddingHorizontal: 12,
          marginBottom: 16,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          minHeight: 40,
        },
        searchInput: {
          flex: 1,
          paddingVertical: 9,
          paddingHorizontal: 6,
          fontSize: 14,
          color: colors.text,
        },
        searchIcon: {
          marginRight: 6,
        },
        clearButton: {
          padding: 4,
        },
        searchButton: {
          padding: 8,
          marginLeft: 8,
          zIndex: 1,
        },
        noResultsContainer: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 40,
          paddingHorizontal: 32,
        },
        noResultsIconContainer: {
          width: 72,
          height: 72,
          borderRadius: 20,
          backgroundColor: colors.primary + '12',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.primary + '30',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 18,
        },
        noResultsText: {
          color: colors.text,
          fontSize: 16,
          fontWeight: '700',
          textAlign: 'center',
        },
        noResultsSubtext: {
          color: colors.secondaryText,
          fontSize: 13,
          textAlign: 'center',
          marginTop: 6,
          lineHeight: 18,
          maxWidth: 280,
        },
        ctaButton: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.primary,
          paddingHorizontal: 18,
          paddingVertical: 11,
          borderRadius: 24,
          marginTop: 20,
          gap: 8,
        },
        ctaButtonText: {
          color: colors.buttonText || '#fff',
          fontSize: 14,
          fontWeight: '700',
        },
        filterButton: {
          width: 40,
          height: 40,
          borderRadius: 12,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: 10,
          position: 'relative',
        },
        filterButtonActive: {
          borderColor: colors.primary,
          backgroundColor: colors.primary + '14',
        },
        filterBadge: {
          position: 'absolute',
          top: -4,
          right: -4,
          backgroundColor: colors.primary,
          borderRadius: 9,
          minWidth: 18,
          height: 18,
          paddingHorizontal: 4,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 2,
          borderColor: colors.background,
        },
        filterBadgeText: {
          color: colors.buttonText || '#fff',
          fontSize: 10,
          fontWeight: '700',
        },
        profileFilterBanner: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.primary + '20',
          paddingHorizontal: 16,
          paddingVertical: 10,
          marginHorizontal: 16,
          marginBottom: 8,
          borderRadius: 8,
          borderLeftWidth: 3,
          borderLeftColor: colors.primary,
        },
        profileFilterText: {
          fontSize: 14,
          color: colors.text,
          flex: 1,
        },
        profileFilterClear: {
          paddingHorizontal: 12,
          paddingVertical: 6,
          backgroundColor: colors.primary,
          borderRadius: 16,
          marginLeft: 8,
        },
        profileFilterClearText: {
          color: '#fff',
          fontSize: 12,
          fontWeight: '600',
        },
        filterModalOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'flex-end',
        },
        filterModalContent: {
          backgroundColor: colors.card,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingTop: 8,
          paddingBottom: 24,
          maxHeight: '85%',
        },
        filterModalHandle: {
          alignSelf: 'center',
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
          marginBottom: 8,
        },
        filterModalHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        filterModalTitle: {
          fontSize: 18,
          fontWeight: '700',
          color: colors.text,
        },
        filterSection: {
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        filterSectionTitle: {
          fontSize: 12,
          fontWeight: '700',
          color: colors.secondaryText,
          textTransform: 'uppercase' as const,
          letterSpacing: 0.6,
          marginBottom: 12,
        },
        filterChipsContainer: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        },
        filterChip: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 7,
          paddingHorizontal: 12,
          borderRadius: 16,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: 'transparent',
          gap: 6,
        },
        filterChipSelected: {
          backgroundColor: colors.primary + '12',
          borderColor: colors.primary,
        },
        filterChipText: {
          fontSize: 13,
          color: colors.text,
          fontWeight: '600',
        },
        filterChipTextSelected: {
          color: colors.primary,
          fontWeight: '700',
        },
        filterChipEmoji: {
          fontSize: 14,
        },
        dateFilterOption: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 12,
          marginHorizontal: -20,
          paddingHorizontal: 20,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        dateFilterOptionSelected: {
          backgroundColor: colors.primary + '0D',
        },
        dateFilterOptionText: {
          fontSize: 14,
          color: colors.text,
        },
        dateFilterOptionTextSelected: {
          color: colors.primary,
          fontWeight: '700',
        },
        toggleOption: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: 4,
        },
        toggleOptionSelected: {},
        toggleOptionText: {
          fontSize: 14,
          color: colors.text,
          flex: 1,
        },
        toggleOptionTextSelected: {
          color: colors.primary,
          fontWeight: '700',
        },
        toggleCheck: {
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        },
        toggleCheckActive: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
        filterButtonsRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingTop: 16,
          gap: 12,
        },
        clearFiltersButton: {
          flex: 1,
          paddingVertical: 12,
          borderRadius: 24,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.error || '#e74c3c',
          alignItems: 'center',
        },
        clearFiltersText: {
          color: colors.error || '#e74c3c',
          fontWeight: '700',
          fontSize: 14,
        },
        applyFiltersButton: {
          flex: 1,
          paddingVertical: 12,
          borderRadius: 24,
          backgroundColor: colors.primary,
          alignItems: 'center',
        },
        applyFiltersText: {
          color: colors.buttonText || '#fff',
          fontWeight: '700',
          fontSize: 14,
        },
        disabledOpacity: {
          opacity: 0.7,
        },
        keyboardAvoidingView: {
          flex: 1,
        },
        contentWrapper: {
          flex: 1,
        },
        flatListContent: {
          paddingBottom: 120,
        },
        noResultsContainerCompact: {
          flex: 0,
          paddingVertical: 60,
        },
        // Jersey color picker styles
        jerseyColorPickerContainer: {
          backgroundColor: colors.inputBackground || colors.background,
          borderRadius: 12,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: 14,
          marginBottom: 12,
        },
        jerseyColorTitle: {
          color: colors.secondaryText,
          fontSize: 12,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: 12,
          textAlign: 'center',
        },
        jerseyColorGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 8,
        },
        jerseyColorOption: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'transparent',
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 18,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          minWidth: 100,
        },
        jerseyColorOptionSelected: {
          borderColor: colors.primary,
          backgroundColor: colors.primary + '14',
        },
        jerseyColorSwatch: {
          width: 20,
          height: 20,
          borderRadius: 10,
          marginRight: 8,
        },
        jerseyColorSwatchLight: {
          borderWidth: 1,
          borderColor: colors.border,
        },
        jerseyColorLabel: {
          color: colors.text,
          fontSize: 14,
        },
        jerseyColorCheck: {
          color: colors.primary,
          fontSize: 16,
          fontWeight: 'bold',
          marginLeft: 'auto',
        },
        activeFiltersContainer: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          marginBottom: 12,
          paddingHorizontal: 16,
          gap: 6,
        },
        activeFilterTag: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.primary + '12',
          paddingVertical: 5,
          paddingHorizontal: 10,
          borderRadius: 14,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.primary + '40',
          gap: 6,
        },
        activeFilterTagText: {
          color: colors.primary,
          fontSize: 12,
          fontWeight: '600',
        },
        // Horizontal filter chip bar (compact pills)
        chipBarContainer: {
          marginBottom: 12,
          minHeight: 46,
          zIndex: 100,
          backgroundColor: colors.background,
          elevation: 10,
          flexShrink: 0,
          overflow: 'visible',
        },
        chipBarContent: {
          paddingHorizontal: 16,
          paddingVertical: 6,
          gap: 8,
          alignItems: 'center',
        },
        chip: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 6,
          paddingHorizontal: 12,
          borderRadius: 18,
          backgroundColor: 'transparent',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          height: 32,
        },
        chipActive: {
          backgroundColor: colors.primary + '14',
          borderColor: colors.primary,
        },
        chipEmoji: {
          fontSize: 13,
          marginRight: 5,
        },
        chipText: {
          fontSize: 13,
          fontWeight: '600',
          color: colors.secondaryText,
        },
        chipTextActive: {
          color: colors.primary,
          fontWeight: '700',
        },
        searchFilterRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 12,
          paddingHorizontal: 16,
          backgroundColor: colors.background,
          zIndex: 100,
          elevation: 10,
          flexShrink: 0,
        },
        searchContainerInRow: {
          flex: 1,
          marginBottom: 0,
        },
        // Privacy selector styles
        privacyContainer: {
          marginBottom: 12,
        },
        privacyLabel: {
          fontSize: 12,
          fontWeight: '700',
          color: colors.secondaryText,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: 8,
        },
        privacyOptions: {
          flexDirection: 'row',
          gap: 8,
        },
        privacyOption: {
          flex: 1,
          alignItems: 'center',
          backgroundColor: 'transparent',
          paddingVertical: 12,
          paddingHorizontal: 8,
          borderRadius: 12,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        privacyOptionSelected: {
          borderColor: colors.primary,
          backgroundColor: colors.primary + '14',
        },
        privacyOptionTextContainer: {
          alignItems: 'center',
          marginTop: 6,
        },
        privacyOptionLabel: {
          fontSize: 13,
          fontWeight: '700',
          color: colors.text,
          textAlign: 'center',
        },
        privacyOptionLabelSelected: {
          color: colors.primary,
        },
        privacyOptionDescription: {
          fontSize: 11,
          color: colors.secondaryText,
          marginTop: 2,
          textAlign: 'center',
          lineHeight: 14,
        },
        // Privacy badge on event cards
        privacyBadge: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.inputBackground || colors.background,
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 12,
          marginLeft: 8,
          gap: 4,
        },
        privacyBadgeText: {
          fontSize: 11,
          color: colors.secondaryText,
          fontWeight: '500',
        },
        // Invite users styles
        inviteContainer: {
          marginBottom: 12,
        },
        inviteSearchContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.inputBackground || colors.background,
          borderRadius: 22,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          paddingHorizontal: 14,
          marginBottom: 8,
        },
        inviteSearchIcon: {
          marginRight: 8,
        },
        inviteSearchInput: {
          flex: 1,
          paddingVertical: 10,
          fontSize: 14,
          color: colors.text,
        },
        inviteSearchResults: {
          backgroundColor: colors.background,
          borderRadius: 12,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          marginBottom: 12,
          maxHeight: 180,
          overflow: 'hidden',
        },
        inviteSearchResultRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        inviteUserAvatar: {
          width: 32,
          height: 32,
          borderRadius: 16,
          marginRight: 10,
        },
        inviteUserAvatarPlaceholder: {
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: colors.primary,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 10,
        },
        inviteUserAvatarText: {
          color: '#fff',
          fontSize: 12,
          fontWeight: '700',
        },
        inviteUserTextBlock: {
          flex: 1,
          marginRight: 8,
        },
        inviteUserName: {
          fontSize: 14,
          fontWeight: '600',
          color: colors.text,
        },
        inviteUserHandle: {
          fontSize: 12,
          color: colors.secondaryText,
          marginTop: 1,
        },
        invitedUsersList: {
          marginTop: 8,
        },
        invitedUsersLabel: {
          fontSize: 12,
          fontWeight: '700',
          color: colors.secondaryText,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: 8,
        },
        invitedUsersChips: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        },
        invitedUserChip: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.primary + '14',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.primary + '40',
          paddingVertical: 5,
          paddingHorizontal: 10,
          borderRadius: 14,
          gap: 6,
        },
        invitedUserChipText: {
          fontSize: 12,
          color: colors.primary,
          fontWeight: '700',
        },
        inviteHint: {
          fontSize: 12,
          color: colors.secondaryText,
          marginTop: 4,
        },
        // Likes modal — bottom-sheet (matches EventComments)
        likesModalOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          justifyContent: 'flex-end',
        },
        likesModalContent: {
          backgroundColor: colors.background,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 24 : 16,
          maxHeight: '70%',
        },
        likesModalHandle: {
          alignSelf: 'center',
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
          marginBottom: 8,
        },
        likesModalHeaderBlock: {
          paddingHorizontal: 16,
          paddingBottom: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        likesModalTitleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        },
        likesModalTitle: {
          fontSize: 17,
          fontWeight: '700',
          color: colors.text,
          textAlign: 'center',
        },
        likesModalCount: {
          fontSize: 12,
          fontWeight: '500',
          color: colors.secondaryText,
          textAlign: 'center',
          marginTop: 4,
        },
        likesModalScroll: {
          paddingHorizontal: 16,
          maxHeight: 360,
        },
        likesModalUserRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        likesModalAvatar: {
          width: 36,
          height: 36,
          borderRadius: 18,
          marginRight: 12,
        },
        likesModalAvatarPlaceholder: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: colors.primary + '14',
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 12,
        },
        likesModalAvatarText: {
          color: colors.primary,
          fontSize: 13,
          fontWeight: '700',
        },
        likesModalUsername: {
          fontSize: 14,
          color: colors.text,
          flex: 1,
          fontWeight: '500',
        },
        likesModalUsernameClickable: {
          color: colors.primary,
          fontWeight: '600',
        },
        likesModalChevron: {
          marginLeft: 8,
        },
        likesModalAnonymous: {
          fontSize: 13,
          color: colors.secondaryText,
          fontStyle: 'italic',
          paddingVertical: 12,
          textAlign: 'center',
        },
        likesModalEmpty: {
          textAlign: 'center',
          color: colors.secondaryText,
          fontSize: 13,
          paddingVertical: 20,
        },
        likesModalClose: {
          marginHorizontal: 16,
          marginTop: 14,
          height: 44,
          borderRadius: 22,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        },
        likesModalCloseText: {
          color: colors.secondaryText,
          fontWeight: '700',
          fontSize: 14,
        },
        watchModalSheet: {
          backgroundColor: colors.background,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 24 : 16,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          maxHeight: '90%',
        },
        watchModalHeaderBlock: {
          paddingHorizontal: 16,
          paddingBottom: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        watchModalTitle: {
          color: colors.text,
          fontSize: 17,
          fontWeight: '700',
          textAlign: 'center',
        },
        watchModalSubtitle: {
          color: colors.secondaryText,
          fontSize: 13,
          marginTop: 4,
          textAlign: 'center',
        },
        watchOptionsList: {
          paddingHorizontal: 16,
        },
        watchOptionRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 14,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          gap: 12,
        },
        watchOptionRowLast: {
          borderBottomWidth: 0,
        },
        watchOptionIconContainer: {
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: colors.primary + '15',
          alignItems: 'center',
          justifyContent: 'center',
        },
        watchOptionInfo: {
          flex: 1,
        },
        watchOptionTitle: {
          color: colors.text,
          fontSize: 15,
          fontWeight: '600',
        },
        watchOptionDescription: {
          color: colors.secondaryText,
          fontSize: 12,
          marginTop: 2,
          lineHeight: 16,
        },
        watchModalFooter: {
          flexDirection: 'row',
          paddingHorizontal: 16,
          paddingTop: 14,
          marginTop: 4,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          gap: 10,
        },
        watchSecondaryButton: {
          flex: 1,
          borderRadius: 24,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          paddingVertical: 12,
          alignItems: 'center',
          backgroundColor: 'transparent',
        },
        watchSecondaryButtonText: {
          color: colors.secondaryText,
          fontWeight: '700',
          fontSize: 14,
        },
        watchDangerButton: {
          borderColor: colors.error || '#e74c3c',
          backgroundColor: 'transparent',
        },
        watchDangerButtonText: {
          color: colors.error || '#e74c3c',
        },
        watchPrimaryButton: {
          flex: 1,
          borderRadius: 24,
          backgroundColor: colors.primary,
          paddingVertical: 12,
          alignItems: 'center',
          justifyContent: 'center',
        },
        watchPrimaryButtonText: {
          color: colors.buttonText || '#fff',
          fontWeight: '700',
          fontSize: 14,
        },
        watchGlobalMutedNote: {
          marginHorizontal: 16,
          marginTop: 12,
          padding: 12,
          borderRadius: 12,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: (colors.error || '#e74c3c') + '40',
          backgroundColor: (colors.error || '#e74c3c') + '0D',
          color: colors.error || '#e74c3c',
          fontSize: 12,
          lineHeight: 17,
        },
        recurrenceSection: {
          backgroundColor: colors.inputBackground || colors.background,
          borderRadius: 12,
          padding: 14,
          marginBottom: 10,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        recurrenceToggleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        recurrenceLabel: {
          color: colors.text,
          fontSize: 14,
          fontWeight: '700',
        },
        recurrenceDescription: {
          color: colors.secondaryText,
          fontSize: 12,
          marginTop: 2,
        },
        recurrenceOptions: {
          marginTop: 12,
          paddingTop: 12,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        recurrenceSubLabel: {
          color: colors.secondaryText,
          fontSize: 12,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: 8,
        },
        recurrenceFrequencyRow: {
          flexDirection: 'row',
          gap: 8,
        },
        recurrenceFrequencyOption: {
          flex: 1,
          alignItems: 'center',
          paddingVertical: 8,
          borderRadius: 18,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: 'transparent',
        },
        recurrenceFrequencySelected: {
          borderColor: colors.primary,
          backgroundColor: colors.primary + '14',
        },
        recurrenceFrequencyText: {
          color: colors.secondaryText,
          fontSize: 13,
          fontWeight: '700',
        },
        recurrenceFrequencyTextSelected: {
          color: colors.primary,
        },
        recurrenceCountScroll: {
          flexGrow: 0,
          marginBottom: 10,
        },
        recurrenceCountOption: {
          width: 40,
          height: 40,
          borderRadius: 20,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 8,
        },
        recurrenceCountSelected: {
          borderColor: colors.primary,
          backgroundColor: colors.primary + '14',
        },
        recurrenceCountText: {
          color: colors.secondaryText,
          fontSize: 14,
          fontWeight: '700',
        },
        recurrenceCountTextSelected: {
          color: colors.primary,
        },
        recurrenceSummary: {
          color: colors.secondaryText,
          fontSize: 12,
          marginTop: 4,
        },
        recurringBadge: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.primary + '15',
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 10,
          marginLeft: 8,
        },
        recurringBadgeText: {
          color: colors.primary,
          fontSize: 11,
          fontWeight: '600',
          marginLeft: 4,
        },
        recurringStackIndicator: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 10,
          paddingHorizontal: 16,
          marginHorizontal: 16,
          marginTop: -8,
          marginBottom: 12,
          backgroundColor: colors.primary + '10',
          borderRadius: 10,
          gap: 6,
        },
        recurringStackText: {
          color: colors.primary,
          fontSize: 13,
          fontWeight: '600',
          flex: 1,
        },
        recurringCarouselHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 10,
          gap: 8,
        },
        recurringCarouselTitle: {
          color: colors.text,
          fontSize: 16,
          fontWeight: '700',
          marginLeft: 8,
        },
        recurringCollapseText: {
          color: colors.primary,
          fontSize: 13,
          fontWeight: '600',
        },
        carouselPageLabel: {
          alignSelf: 'center',
          backgroundColor: colors.primary + '20',
          paddingHorizontal: 10,
          paddingVertical: 3,
          borderRadius: 10,
          marginBottom: 6,
        },
        carouselPageLabelText: {
          color: colors.primary,
          fontSize: 12,
          fontWeight: '700',
        },
        deckNavRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          marginTop: -4,
          marginBottom: 12,
        },
        deckNavButton: {
          paddingVertical: 6,
          paddingHorizontal: 14,
          backgroundColor: colors.primary + '18',
          borderRadius: 16,
        },
        deckNavButtonText: {
          color: colors.primary,
          fontSize: 13,
          fontWeight: '700',
        },
        deckDots: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
        },
        deckDot: {
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.border || '#555',
        },
        deckDotActive: {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.primary,
        },
        rowCenter: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        positionRelative: {
          position: 'relative',
        },
        deckBgCardBase: {
          position: 'absolute',
          left: 0,
          right: 0,
        },
        zIndexTop: {
          zIndex: 10,
        },
        flexOne: {
          flex: 1,
        },
        recurrenceCountSubLabel: {
          marginTop: 12,
        },
        proximityToggleContent: {
          flexDirection: 'row',
          alignItems: 'center',
          flex: 1,
        },
        proximityIconMargin: {
          marginRight: 8,
        },
        proximityDistanceRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          marginTop: 12,
        },
        proximityDistanceChip: {
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 14,
          borderWidth: StyleSheet.hairlineWidth,
        },
        proximityDistanceChipSelected: {
          backgroundColor: colors.primary + '12',
          borderColor: colors.primary,
        },
        proximityDistanceChipDefault: {
          backgroundColor: 'transparent',
          borderColor: colors.border,
        },
        proximityDistanceText: {
          fontSize: 12,
          fontWeight: '700',
        },
        proximityDistanceTextSelected: {
          color: colors.primary,
        },
        proximityDistanceTextDefault: {
          color: colors.text,
        },
      }),
    [colors],
  );

  // Memoize GooglePlacesAutocomplete styles to prevent infinite loop
  const autocompleteStyles = useMemo(
    () => ({
      container: {
        flex: 0,
      },
      textInputContainer: {
        backgroundColor: 'transparent',
      },
      textInput: {
        backgroundColor: colors.inputBackground || '#fff',
        color: colors.text,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        fontSize: 15,
        minHeight: 46,
      },
      listView: {
        backgroundColor: colors.background || '#fff',
        borderColor: colors.border,
        borderWidth: StyleSheet.hairlineWidth,
        borderTopWidth: 0,
        borderRadius: 12,
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        maxHeight: 200,
      },
      row: {
        backgroundColor: colors.background || '#fff',
        paddingHorizontal: 14,
        paddingVertical: 12,
        minHeight: 44,
        flexDirection: 'row' as const,
      },
      separator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.border,
      },
      description: {
        color: colors.text,
      },
    }),
    [colors],
  );

  const [eventData, setEventData] = useState<Event[]>([]);
  const [loading, setLoading] = useState<boolean>(true); // Start true to show skeleton
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newEvent, setNewEvent] = useState(() => createEmptyEvent());

  // Falls back to manual text input if Google Places API fails (e.g. billing not enabled)
  const [placesApiFailed, setPlacesApiFailed] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Filter state
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);
  const [selectedDateFilter, setSelectedDateFilter] = useState('all');
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);
  const [hidePastEvents, setHidePastEvents] = useState(true);
  const [profileFilter, setProfileFilter] = useState<
    'created' | 'joined' | null
  >(null);
  const [profileFilterUserId, setProfileFilterUserId] = useState<string | null>(
    null,
  );

  // Proximity filter state
  const [proximityEnabled, setProximityEnabled] = useState(false);
  const [proximityRadius, setProximityRadius] = useState(25); // miles
  const [eventUserLocation, setEventUserLocation] =
    useState<Coordinates | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  // Location autocomplete state - removed manual toggle, now seamless

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState<Date | undefined>(new Date());

  const [showRosterSizePicker, setShowRosterSizePicker] = useState(false);
  const [tempRosterSize, setTempRosterSize] = useState(
    newEvent.totalSpots || '',
  );
  const [showEventTypePicker, setShowEventTypePicker] = useState(false);
  const [tempEventType, setTempEventType] = useState(newEvent.eventType || '');

  // Jersey color picker state for team sports
  const [showJerseyColorPicker, setShowJerseyColorPicker] = useState(false);

  // Invite users state (for invite-only events)
  const [inviteSearchQuery, setInviteSearchQuery] = useState('');
  const [availableUsersToInvite, setAvailableUsersToInvite] = useState<
    LikedByUser[]
  >([]);
  const [loadingInviteUsers, setLoadingInviteUsers] = useState(false);
  const [invitedUserDetails, setInvitedUserDetails] = useState<LikedByUser[]>(
    [],
  );

  // Close all pickers except the one being opened (accordion behavior)
  const closeAllPickers = (except?: string) => {
    if (except !== 'date') {
      setShowDatePicker(false);
    }
    if (except !== 'time') {
      setShowTimePicker(false);
    }
    if (except !== 'rosterSize') {
      setShowRosterSizePicker(false);
    }
    if (except !== 'eventType') {
      setShowEventTypePicker(false);
    }
    if (except !== 'jerseyColor') {
      setShowJerseyColorPicker(false);
    }
  };

  // Expanded comments state - tracks which event's comments are shown inline
  const [expandedCommentsEventId, setExpandedCommentsEventId] = useState<
    string | null
  >(null);

  // Liked events state
  const [likedEvents, setLikedEvents] = useState<Set<string>>(new Set());

  // Local comment count overrides (updated when user adds/removes comments)
  const [localCommentCounts, setLocalCommentCounts] = useState<{
    [eventId: string]: number;
  }>({});

  // Cache of event-creator profile pic + real-name lookups, keyed by username.
  // Backend doesn't return these on /events yet, so we hydrate them from /users.
  const [creatorInfoMap, setCreatorInfoMap] = useState<
    Record<string, {profilePicUrl?: string; name?: string}>
  >({});
  const lastCreatorFetchRef = useRef<number>(0);

  // Likes modal state
  const [likesModalVisible, setLikesModalVisible] = useState(false);
  const [likesModalData, setLikesModalData] = useState<{
    title: string;
    users: LikedByUser[];
    anonymousCount: number;
  }>({title: '', users: [], anonymousCount: 0});

  // Loading state for save operations
  const [savingEvent, setSavingEvent] = useState(false);
  const [_deletingEventId, setDeletingEventId] = useState<string | null>(null);

  // Recurring group deck state
  const [expandedRecurringGroup, setExpandedRecurringGroup] = useState<
    string | null
  >(null);
  const [deckActiveIndex, setDeckActiveIndex] = useState<{
    [groupId: string]: number;
  }>({});

  // Event watch state
  const [watchModalVisible, setWatchModalVisible] = useState(false);
  const [watchTargetEvent, setWatchTargetEvent] = useState<Event | null>(null);
  const [optionsMenuEvent, setOptionsMenuEvent] = useState<Event | null>(null);

  // Map app picker state
  const [mapPickerApps, setMapPickerApps] = useState<AvailableMapApp[]>([]);
  const [mapPickerVisible, setMapPickerVisible] = useState(false);
  const presentMapPicker = useCallback((apps: AvailableMapApp[]) => {
    setMapPickerApps(apps);
    setMapPickerVisible(true);
  }, []);
  const [watchPreferencesDraft, setWatchPreferencesDraft] =
    useState<EventWatchPreferences>(getDefaultWatchPreferences());
  const [watchedEventIds, setWatchedEventIds] = useState<Set<string>>(
    new Set(),
  );
  const [savingWatch, setSavingWatch] = useState(false);

  // First-time user onboarding state
  const [showFirstTimeHint, setShowFirstTimeHint] = useState(false);

  // Ref for scrolling to specific events
  const flatListRef = useRef<FlatList<any> | null>(null);

  const navigation = useNavigation<NavigationProp<any>>();
  const route = useRoute<RouteProp<RootStackParamList, 'EventList'>>();

  const fetchEvents = React.useCallback(async () => {
    if (initialLoadDone) {
      // For pull-to-refresh, don't show full loading state
    } else {
      setLoading(true);
    }
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await axios.get(`${API_BASE_URL}/events`, {
        headers: token ? {Authorization: `Bearer ${token}`} : {},
      });
      setEventData(response.data);
      // Cache events for faster startup
      AsyncStorage.setItem('cachedEvents', JSON.stringify(response.data));
    } catch (error) {
      if (!initialLoadDone) {
        Alert.alert(t('common.error'), t('events.fetchError'));
      }
    } finally {
      setLoading(false);
      setInitialLoadDone(true);
    }
  }, [initialLoadDone, t]);

  // Check if user has seen the events onboarding - non-blocking
  useEffect(() => {
    AsyncStorage.getItem('hasSeenEventsHint').then(hasSeenHint => {
      if (!hasSeenHint) {
        setShowFirstTimeHint(true);
      }
    });
  }, [fetchEvents]);

  // Initialize liked events from event data
  useEffect(() => {
    if (userData && eventData.length > 0) {
      const userLikedEvents = eventData
        .filter(event => event.likes?.includes(userData._id))
        .map(event => event._id);
      setLikedEvents(new Set(userLikedEvents));
    }
  }, [eventData, userData]);

  // Pre-seed creator cache with the current user so events they create
  // optimistically render with their avatar before /users resolves.
  useEffect(() => {
    if (!userData?.username) {
      return;
    }
    setCreatorInfoMap(prev => {
      const existing = prev[userData.username];
      if (existing?.profilePicUrl === userData.profilePicUrl) {
        return prev;
      }
      return {
        ...prev,
        [userData.username]: {
          ...existing,
          profilePicUrl: userData.profilePicUrl,
        },
      };
    });
  }, [userData?.username, userData?.profilePicUrl]);

  // Hydrate event-creator profile pics + real names from /users.
  // Backend doesn't include createdByProfilePicUrl on /events yet, so we
  // build a username -> {profilePicUrl, name} cache and merge it client-side.
  // Skips the network call when every visible creator is already cached or
  // when we fetched recently (5 min TTL).
  useEffect(() => {
    if (eventData.length === 0) {
      return;
    }
    const neededUsernames = Array.from(
      new Set(
        eventData
          .map(e => e.createdByUsername)
          .filter(
            (u): u is string => typeof u === 'string' && u.length > 0,
          ),
      ),
    );
    const missing = neededUsernames.filter(u => !(u in creatorInfoMap));
    if (missing.length === 0) {
      return;
    }
    const now = Date.now();
    const TTL_MS = 5 * 60 * 1000;
    if (now - lastCreatorFetchRef.current < TTL_MS) {
      return;
    }
    lastCreatorFetchRef.current = now;
    (async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const response = await axios.get(`${API_BASE_URL}/users`, {
          headers: token ? {Authorization: `Bearer ${token}`} : {},
        });
        const allUsers = response.data?.users || response.data || [];
        const next: Record<
          string,
          {profilePicUrl?: string; name?: string}
        > = {};
        for (const u of allUsers) {
          if (u?.username) {
            next[u.username] = {
              profilePicUrl: u.profilePicUrl,
              name: u.name,
            };
          }
        }
        setCreatorInfoMap(prev => ({...prev, ...next}));
      } catch {
        // Silent fail — initials fallback still renders correctly.
      }
    })();
  }, [eventData, creatorInfoMap]);

  // Load watched events from persistent storage
  useEffect(() => {
    const loadWatches = async () => {
      const ids = await eventWatchService.getWatchedEventIds();
      setWatchedEventIds(new Set(ids));
    };

    loadWatches();
  }, []);

  // Dismiss hint and save to storage
  const dismissFirstTimeHint = async () => {
    await AsyncStorage.setItem('hasSeenEventsHint', 'true');
    setShowFirstTimeHint(false);
  };

  // Fetch events from backend - OPTIMIZED with caching
  useEffect(() => {
    const loadEvents = async () => {
      // FAST PATH: Load cached events immediately
      try {
        const cachedEvents = await AsyncStorage.getItem('cachedEvents');
        if (cachedEvents) {
          const parsed = JSON.parse(cachedEvents);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setEventData(parsed);
            setLoading(false);
            setInitialLoadDone(true);
            // Fetch fresh data in background
            fetchEventsInBackground();
            return;
          }
        }
      } catch {
        // Invalid cache, fall through
      }

      // NO CACHE: Fetch from server
      await fetchEvents();
    };

    const fetchEventsInBackground = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const response = await axios.get(`${API_BASE_URL}/events`, {
          headers: token ? {Authorization: `Bearer ${token}`} : {},
        });
        if (Array.isArray(response.data)) {
          setEventData(response.data);
          // Cache for next launch (fire and forget)
          AsyncStorage.setItem('cachedEvents', JSON.stringify(response.data));
        }
      } catch (error) {
        console.log('Background events fetch failed:', error);
      }
    };

    loadEvents();
  }, [fetchEvents]);

  // Refresh event data via REST (used by socket triggers and foreground resume)
  const fetchLatestEvents = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await axios.get(`${API_BASE_URL}/events`, {
        headers: token ? {Authorization: `Bearer ${token}`} : {},
      });
      if (Array.isArray(response.data)) {
        setEventData(response.data);
        AsyncStorage.setItem('cachedEvents', JSON.stringify(response.data));
      }
    } catch {
      // Silent fail — will retry on next socket event or foreground resume
    }
  }, []);

  // Listen for real-time event updates via WebSocket
  useEffect(() => {
    if (!initialLoadDone) {
      return;
    }

    const unsubRefresh = socketSubscribe('events:refresh', () => {
      fetchLatestEvents();
    });

    const unsubLiked = socketSubscribe(
      'event:liked',
      (data: {
        eventId: string;
        likes: string[];
        likedByUsernames: string[];
      }) => {
        setEventData(prev =>
          prev.map(ev =>
            ev._id === data.eventId
              ? {
                  ...ev,
                  likes: data.likes,
                  likedByUsernames: data.likedByUsernames,
                }
              : ev,
          ),
        );
      },
    );

    // Fallback: refresh when app returns to foreground
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        fetchLatestEvents();
      }
    });

    return () => {
      unsubRefresh();
      unsubLiked();
      subscription.remove();
    };
  }, [initialLoadDone, socketSubscribe, fetchLatestEvents]);

  // Filter events based on search query and filters
  const filteredEvents = useMemo(() => {
    let filtered = eventData;

    // Text search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(event => {
        const nameMatch = event.name.toLowerCase().includes(query);
        const locationMatch = event.location.toLowerCase().includes(query);
        const dateMatch = event.date.toLowerCase().includes(query);
        const typeMatch = event.eventType.toLowerCase().includes(query);
        const creatorMatch = event.createdByUsername
          ?.toLowerCase()
          .includes(query);
        return (
          nameMatch || locationMatch || dateMatch || typeMatch || creatorMatch
        );
      });
    }

    // Event type filter
    if (selectedEventTypes.length > 0) {
      filtered = filtered.filter(event =>
        selectedEventTypes.some(
          type => type.toLowerCase() === event.eventType.toLowerCase(),
        ),
      );
    }

    // Date filter
    if (selectedDateFilter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      filtered = filtered.filter(event => {
        const eventDate = new Date(event.date);
        eventDate.setHours(0, 0, 0, 0);

        switch (selectedDateFilter) {
          case 'today':
            return eventDate.getTime() === today.getTime();
          case 'tomorrow':
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            return eventDate.getTime() === tomorrow.getTime();
          case 'thisWeek':
            const weekEnd = new Date(today);
            weekEnd.setDate(weekEnd.getDate() + 7);
            return eventDate >= today && eventDate <= weekEnd;
          case 'thisMonth':
            const monthEnd = new Date(today);
            monthEnd.setMonth(monthEnd.getMonth() + 1);
            return eventDate >= today && eventDate <= monthEnd;
          default:
            return true;
        }
      });
    }

    // Available spots filter
    if (showAvailableOnly) {
      filtered = filtered.filter(
        event => event.rosterSpotsFilled < event.totalSpots,
      );
    }

    // Hide past events filter
    if (hidePastEvents) {
      filtered = filtered.filter(event => !isEventPast(event.date, event.time));
    }

    // Profile filter (from Profile page navigation)
    if (profileFilter && profileFilterUserId) {
      if (profileFilter === 'created') {
        filtered = filtered.filter(
          event => event.createdBy === profileFilterUserId,
        );
      } else if (profileFilter === 'joined') {
        filtered = filtered.filter(event =>
          (event as any).roster?.some(
            (r: any) => r.userId === profileFilterUserId,
          ),
        );
      }
    }

    // Proximity filter (client-side Haversine)
    if (proximityEnabled && eventUserLocation) {
      filtered = filtered.filter(event => {
        if (event.latitude == null || event.longitude == null) {
          return false;
        }
        const dist = locationService.haversineDistance(
          eventUserLocation,
          {latitude: event.latitude, longitude: event.longitude},
          'mi',
        );
        return dist <= proximityRadius;
      });
    }

    // Sort by date (soonest first) so new events appear in chronological order
    filtered = [...filtered].sort((a, b) => {
      const dateA = new Date(`${a.date} ${a.time}`);
      const dateB = new Date(`${b.date} ${b.time}`);
      return dateA.getTime() - dateB.getTime();
    });

    return filtered;
  }, [
    eventData,
    searchQuery,
    selectedEventTypes,
    selectedDateFilter,
    showAvailableOnly,
    hidePastEvents,
    profileFilter,
    profileFilterUserId,
    proximityEnabled,
    proximityRadius,
    eventUserLocation,
  ]);

  type DisplayItem =
    | {type: 'single'; event: Event}
    | {type: 'recurring'; groupId: string; events: Event[]};

  const displayItems: DisplayItem[] = useMemo(() => {
    const items: DisplayItem[] = [];
    const seenGroups = new Set<string>();

    for (const event of filteredEvents) {
      if (event.isRecurring && event.recurrenceGroupId) {
        if (seenGroups.has(event.recurrenceGroupId)) {
          continue;
        }
        seenGroups.add(event.recurrenceGroupId);
        const groupEvents = filteredEvents.filter(
          e => e.recurrenceGroupId === event.recurrenceGroupId,
        );
        items.push({
          type: 'recurring',
          groupId: event.recurrenceGroupId,
          events: groupEvents,
        });
      } else {
        items.push({type: 'single', event});
      }
    }
    return items;
  }, [filteredEvents]);

  // Scroll so the comment input is visible when the keyboard opens
  useEffect(() => {
    if (!expandedCommentsEventId) {
      return;
    }
    const kbEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(kbEvent, () => {
      const idx = displayItems.findIndex(di =>
        di.type === 'single'
          ? di.event._id === expandedCommentsEventId
          : di.events.some(e => e._id === expandedCommentsEventId),
      );
      if (idx >= 0 && flatListRef.current) {
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index: idx,
            animated: true,
            viewPosition: 1,
          });
        }, 100);
      }
    });
    return () => sub.remove();
  }, [expandedCommentsEventId, filteredEvents, displayItems]);

  // Handle profile filter from navigation params
  useEffect(() => {
    if (route.params?.profileFilter && route.params?.userId) {
      setProfileFilter(route.params.profileFilter);
      setProfileFilterUserId(route.params.userId);
      // Also disable hide past events to show all relevant events
      setHidePastEvents(false);
    }
  }, [route.params?.profileFilter, route.params?.userId]);

  // Scroll to highlighted event and optionally expand comments (once per navigation)
  const hasScrolledToHighlight = useRef<string | null>(null);
  useEffect(() => {
    const targetId = route.params?.highlightEventId;
    if (
      targetId &&
      displayItems.length > 0 &&
      hasScrolledToHighlight.current !== targetId
    ) {
      const eventIndex = displayItems.findIndex(di =>
        di.type === 'single'
          ? di.event._id === targetId
          : di.events.some(e => e._id === targetId),
      );
      if (eventIndex !== -1) {
        hasScrolledToHighlight.current = targetId;
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index: eventIndex,
            animated: true,
            viewPosition: 0.3,
          });
        }, 300);

        if (route.params?.expandComments) {
          setTimeout(() => {
            setExpandedCommentsEventId(targetId);
          }, 600);
        }
      }
    }
  }, [
    route.params?.highlightEventId,
    route.params?.expandComments,
    displayItems,
  ]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedEventTypes.length > 0) {
      count++;
    }
    if (selectedDateFilter !== 'all') {
      count++;
    }
    if (showAvailableOnly) {
      count++;
    }
    if (proximityEnabled) {
      count++;
    }
    return count;
  }, [
    selectedEventTypes,
    selectedDateFilter,
    showAvailableOnly,
    proximityEnabled,
  ]);

  // Toggle event type selection
  const toggleEventType = (type: string) => {
    setSelectedEventTypes(prev =>
      prev.includes(type)
        ? prev.filter(eventType => eventType !== type)
        : [...prev, type],
    );
  };

  // Toggle proximity filter for events
  const handleEventProximityToggle = async () => {
    if (proximityEnabled) {
      setProximityEnabled(false);
      return;
    }

    const locEnabled = await AsyncStorage.getItem('locationEnabled');
    if (locEnabled !== 'true') {
      Alert.alert(
        'Location Required',
        'Enable Location Services in Settings to filter by distance.',
      );
      return;
    }

    setLocationLoading(true);
    try {
      const coords = await locationService.getLocation();
      if (coords) {
        setEventUserLocation(coords);
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
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedEventTypes([]);
    setSelectedDateFilter('all');
    setShowAvailableOnly(false);
    setHidePastEvents(true);
    setProfileFilter(null);
    setProfileFilterUserId(null);
    setProximityEnabled(false);
  };

  const handleSaveNewEvent = async () => {
    // Validate jersey colors for team sports
    if (isTeamSport(newEvent.eventType) && newEvent.jerseyColors.length !== 2) {
      Alert.alert(
        t('events.missingFields'),
        t('events.selectTwoJerseyColors') ||
          'Please select exactly 2 jersey colors for team sports.',
      );
      return;
    }

    if (
      newEvent.name &&
      newEvent.location &&
      newEvent.time &&
      newEvent.date &&
      newEvent.totalSpots &&
      newEvent.eventType
    ) {
      setSavingEvent(true);
      if (isEditing && editingEventId) {
        try {
          const response = await axios.put(
            `${API_BASE_URL}/events/${editingEventId}`,
            {
              name: newEvent.name,
              location: newEvent.location,
              time: newEvent.time,
              date: newEvent.date,
              totalSpots: parseInt(newEvent.totalSpots, 10),
              eventType: newEvent.eventType,
              createdByUsername: userData?.username || '',
              latitude: newEvent.latitude,
              longitude: newEvent.longitude,
              jerseyColors: isTeamSport(newEvent.eventType)
                ? newEvent.jerseyColors
                : undefined,
              privacy: newEvent.privacy,
              invitedUsers: newEvent.invitedUsers,
            },
          );
          // Merge the response with local privacy settings in case backend doesn't return them
          const updatedEvent = {
            ...response.data,
            privacy: response.data.privacy || newEvent.privacy,
            invitedUsers: response.data.invitedUsers || newEvent.invitedUsers,
          };
          setEventData(prevData =>
            prevData.map(event =>
              event._id === editingEventId ? updatedEvent : event,
            ),
          );
          notificationService
            .scheduleEventNotifications(updatedEvent)
            .catch(() => {});
        } catch (error) {
          Alert.alert(t('common.error'), t('events.updateError'));
          setSavingEvent(false);
          return;
        }
      } else {
        try {
          const eventPayload: Record<string, any> = {
            name: newEvent.name,
            location: newEvent.location,
            time: newEvent.time,
            date: newEvent.date,
            totalSpots: parseInt(newEvent.totalSpots, 10),
            eventType: newEvent.eventType,
            createdBy: userData?._id || '',
            createdByUsername: userData?.username || '',
            latitude: newEvent.latitude,
            longitude: newEvent.longitude,
            jerseyColors: isTeamSport(newEvent.eventType)
              ? newEvent.jerseyColors
              : undefined,
            privacy: newEvent.privacy,
            invitedUsers: newEvent.invitedUsers,
          };

          if (newEvent.isRecurring) {
            eventPayload.isRecurring = true;
            eventPayload.recurrenceFrequency = newEvent.recurrenceFrequency;
            eventPayload.recurrenceCount = newEvent.recurrenceCount;
          }

          const response = await axios.post(
            `${API_BASE_URL}/events`,
            eventPayload,
          );

          const responseData = response.data;
          const createdEvents: Event[] = Array.isArray(responseData)
            ? responseData
            : [responseData];

          const mergedEvents = createdEvents.map(evt => ({
            ...evt,
            privacy: evt.privacy || newEvent.privacy,
            invitedUsers: evt.invitedUsers || newEvent.invitedUsers,
          }));

          setEventData(prevData => [...mergedEvents, ...prevData]);
          for (const evt of mergedEvents) {
            notificationService.scheduleEventNotifications(evt).catch(() => {});
          }
        } catch (error) {
          Alert.alert(t('common.error'), t('events.createError'));
          setSavingEvent(false);
          return;
        }
      }
      setSavingEvent(false);
      setModalVisible(false);
      setNewEvent(createEmptyEvent());
      setTempRosterSize('');
      setTempEventType('');
      setIsEditing(false);
      setEditingEventId(null);
      setInviteSearchQuery('');
      setAvailableUsersToInvite([]);
      setInvitedUserDetails([]);
    } else {
      Alert.alert(t('events.missingFields'), t('events.missingFieldsMessage'));
    }
  };

  const handleEventPress = (event: Event) => {
    navigation.navigate('EventRoster', {
      eventId: event._id,
      eventName: event.name,
      eventType: event.eventType,
      date: event.date,
      time: event.time,
      location: event.location,
      totalSpots: event.totalSpots,
      roster: [],
      jerseyColors: event.jerseyColors,
    });
  };

  const handleDeleteEvent = (event: Event) => {
    if (event.createdBy !== (userData?._id || '')) {
      Alert.alert(t('events.notAuthorized'), t('events.notAuthorizedDelete'));
      return;
    }
    Alert.alert(
      t('events.deleteConfirm'),
      t('events.deleteConfirmMessage'),
      [
        {text: t('common.cancel'), style: 'cancel'},
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            setDeletingEventId(event._id);
            try {
              await axios.delete(`${API_BASE_URL}/events/${event._id}`);
              notificationService
                .cancelEventNotifications(event._id)
                .catch(() => {});
              setEventData(prevData =>
                prevData.filter(e => e._id !== event._id),
              );
            } catch (error) {
              Alert.alert(t('common.error'), t('events.deleteError'));
            } finally {
              setDeletingEventId(null);
            }
          },
        },
      ],
      {cancelable: true},
    );
  };

  const handleEditEvent = async (event: Event) => {
    setNewEvent({
      name: event.name,
      location: event.location,
      time: event.time,
      date: event.date,
      totalSpots: event.totalSpots.toString(),
      eventType: event.eventType,
      latitude: event.latitude,
      longitude: event.longitude,
      jerseyColors: event.jerseyColors || [],
      privacy: event.privacy || 'public',
      invitedUsers: event.invitedUsers || [],
      isRecurring: event.isRecurring || false,
      recurrenceFrequency: event.recurrenceFrequency || 'weekly',
      recurrenceCount: 4,
    });
    setPlacesApiFailed(false);
    setModalVisible(true);
    setTempRosterSize(event.totalSpots.toString());
    setTempEventType(event.eventType);
    setIsEditing(true);
    setEditingEventId(event._id);

    // Load invited user details if editing an invite-only event
    if (event.invitedUsers && event.invitedUsers.length > 0) {
      const users = await fetchUsersByIds(event.invitedUsers);
      setInvitedUserDetails(users);
    } else {
      setInvitedUserDetails([]);
    }
  };

  const handleShareEvent = async (event: Event) => {
    const emoji = getEventTypeEmoji(event.eventType);
    const spotsAvailable = event.totalSpots - event.rosterSpotsFilled;
    const appLink =
      Platform.OS === 'ios' ? APP_STORE_LINKS.ios : APP_STORE_LINKS.android;

    const shareMessage =
      `${emoji} Join me for ${event.name}!\n\n` +
      `🏷️ ${event.eventType}\n` +
      `📅 ${event.date} @ ${formatDisplayTime(event.time)}\n` +
      `📍 ${event.location}\n` +
      `👥 ${spotsAvailable} spot${
        spotsAvailable !== 1 ? 's' : ''
      } available\n\n` +
      `Download BetterPlay to join:\n${appLink}`;

    try {
      const result = await Share.share({
        message: shareMessage,
        title: `Join ${event.name} on BetterPlay`,
      });

      if (result.action === Share.sharedAction) {
        // Shared successfully
        if (result.activityType) {
          // Shared with activity type of result.activityType (iOS only)
          console.log('Shared via:', result.activityType);
        }
      }
    } catch (error) {
      Alert.alert(
        t('common.error'),
        t('events.shareError') || 'Failed to share event',
      );
    }
  };

  const openWatchModal = async (event: Event) => {
    const existing = await eventWatchService.getWatch(event._id);
    setWatchTargetEvent(event);
    setWatchPreferencesDraft(
      existing?.preferences || eventWatchService.getDefaultPreferences(),
    );
    setWatchModalVisible(true);
  };

  const closeWatchModal = () => {
    setWatchModalVisible(false);
    setWatchTargetEvent(null);
    setWatchPreferencesDraft(getDefaultWatchPreferences());
  };

  const saveWatchPreferences = async () => {
    if (!watchTargetEvent) {
      return;
    }

    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert(
          'Notifications Disabled',
          'Enable system notifications to receive watched-event alerts.',
        );
        return;
      }
    }

    setSavingWatch(true);
    try {
      await eventWatchService.watchEvent({
        eventId: watchTargetEvent._id,
        eventName: watchTargetEvent.name,
        eventDate: watchTargetEvent.date,
        eventTime: watchTargetEvent.time,
        preferences: watchPreferencesDraft,
      });

      setWatchedEventIds(prev => {
        const updated = new Set(prev);
        updated.add(watchTargetEvent._id);
        return updated;
      });

      closeWatchModal();
    } catch (error) {
      Alert.alert('Error', 'Unable to save watch preferences right now.');
    } finally {
      setSavingWatch(false);
    }
  };

  const stopWatchingEvent = async () => {
    if (!watchTargetEvent) {
      return;
    }

    setSavingWatch(true);
    try {
      await eventWatchService.unwatchEvent(watchTargetEvent._id);
      setWatchedEventIds(prev => {
        const updated = new Set(prev);
        updated.delete(watchTargetEvent._id);
        return updated;
      });
      closeWatchModal();
    } catch {
      Alert.alert('Error', 'Unable to remove watch right now.');
    } finally {
      setSavingWatch(false);
    }
  };

  // Toggle inline comments for an event
  const handleDiscussEvent = (event: Event) => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(
        250,
        LayoutAnimation.Types.easeInEaseOut,
        LayoutAnimation.Properties.opacity,
      ),
    );
    setExpandedCommentsEventId(prev => (prev === event._id ? null : event._id));
  };

  // Fetch user details by user IDs
  const fetchUsersByIds = async (userIds: string[]): Promise<LikedByUser[]> => {
    if (userIds.length === 0) {
      return [];
    }
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await axios.get(`${API_BASE_URL}/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const allUsers = response.data?.users || response.data || [];
      // Filter to only users whose _id is in our list
      const matchedUsers = allUsers.filter((user: LikedByUser) =>
        userIds.includes(user._id),
      );
      return matchedUsers.map((user: LikedByUser) => ({
        _id: user._id,
        username: user.username,
        name: user.name,
        profilePicUrl: user.profilePicUrl,
      }));
    } catch {
      // Return empty on error
      return [];
    }
  };

  // Search users for invite picker
  const searchUsersForInvite = async (query: string) => {
    if (query.length < 2) {
      setAvailableUsersToInvite([]);
      return;
    }
    setLoadingInviteUsers(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await axios.get(`${API_BASE_URL}/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const allUsers = response.data?.users || response.data || [];
      const normalizedQuery = query.toLowerCase();
      // Filter users by username OR real name (exclude current user and already invited)
      const filteredUsers = allUsers.filter(
        (user: LikedByUser) =>
          (user.username?.toLowerCase().includes(normalizedQuery) ||
            (user.name &&
              user.name.toLowerCase().includes(normalizedQuery))) &&
          user._id !== userData?._id &&
          !newEvent.invitedUsers.includes(user._id),
      );
      setAvailableUsersToInvite(
        filteredUsers.slice(0, 10).map((user: LikedByUser) => ({
          _id: user._id,
          username: user.username,
          name: user.name,
          profilePicUrl: user.profilePicUrl,
        })),
      );
    } catch {
      setAvailableUsersToInvite([]);
    }
    setLoadingInviteUsers(false);
  };

  // Add user to invite list
  const addUserToInvite = (user: LikedByUser) => {
    setNewEvent(prev => ({
      ...prev,
      invitedUsers: [...prev.invitedUsers, user._id],
    }));
    setInvitedUserDetails(prev => [...prev, user]);
    setInviteSearchQuery('');
    setAvailableUsersToInvite([]);
  };

  // Remove user from invite list
  const removeUserFromInvite = (userId: string) => {
    setNewEvent(prev => ({
      ...prev,
      invitedUsers: prev.invitedUsers.filter(id => id !== userId),
    }));
    setInvitedUserDetails(prev => prev.filter(u => u._id !== userId));
  };

  // Show who liked the event
  const showEventLikedBy = async (event: Event) => {
    const likes = event.likes || [];
    if (likes.length === 0) {
      return;
    }

    // Fetch user details for the user IDs
    const users = await fetchUsersByIds(likes);

    // Calculate how many likes don't have user info attached
    const anonymousCount = Math.max(0, likes.length - users.length);

    setLikesModalData({
      title: 'Liked by',
      users,
      anonymousCount,
    });
    setLikesModalVisible(true);
  };

  // Navigate to a user's public profile
  const navigateToProfile = (
    userId: string,
    username: string,
    profilePicUrl?: string,
  ) => {
    navigation.navigate('PublicProfile', {
      userId,
      username,
      profilePicUrl,
    });
  };

  // Toggle like on event
  const toggleEventLike = async (event: Event) => {
    if (!userData) {
      return;
    }

    const isLiked = likedEvents.has(event._id);

    // Optimistic update
    setLikedEvents(prev => {
      const newSet = new Set(prev);
      if (isLiked) {
        newSet.delete(event._id);
      } else {
        newSet.add(event._id);
      }
      return newSet;
    });

    // Update event data optimistically
    setEventData(prev =>
      prev.map(e =>
        e._id === event._id
          ? {
              ...e,
              likes: isLiked
                ? (e.likes || []).filter(id => id !== userData._id)
                : [...(e.likes || []), userData._id],
            }
          : e,
      ),
    );

    try {
      const token = await AsyncStorage.getItem('userToken');
      await axios.post(
        `${API_BASE_URL}/events/${event._id}/like`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
    } catch (error) {
      // Revert on error
      setLikedEvents(prev => {
        const newSet = new Set(prev);
        if (isLiked) {
          newSet.add(event._id);
        } else {
          newSet.delete(event._id);
        }
        return newSet;
      });
      setEventData(prev =>
        prev.map(e =>
          e._id === event._id
            ? {
                ...e,
                likes: isLiked
                  ? [...(e.likes || []), userData._id]
                  : (e.likes || []).filter(id => id !== userData._id),
              }
            : e,
        ),
      );
      console.error('Failed to toggle event like:', error);
    }
  };

  const handleCancelModal = () => {
    setModalVisible(false);
    setNewEvent(createEmptyEvent());
    setTempRosterSize('');
    setTempEventType('');
    setIsEditing(false);
    setEditingEventId(null);
    setInviteSearchQuery('');
    setAvailableUsersToInvite([]);
    setInvitedUserDetails([]);
    setShowDatePicker(false);
    setShowTimePicker(false);
    setShowRosterSizePicker(false);
    setShowEventTypePicker(false);
    setShowJerseyColorPicker(false);
    setDate(new Date());
    setTime(new Date());
  };

  const onDateChange = (evt: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDate(selectedDate);
      const isToday = selectedDate.toDateString() === new Date().toDateString();
      if (isToday && time && time < new Date()) {
        setTime(undefined);
        setNewEvent(prev => ({
          ...prev,
          date: selectedDate.toDateString(),
          time: '',
        }));
      } else {
        setNewEvent(prev => ({...prev, date: selectedDate.toDateString()}));
      }
    }
  };

  const onTimeChange = (evt: any, selectedTime?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (selectedTime) {
      const roundedTime = new Date(
        Math.ceil(selectedTime.getTime() / (15 * 1000)) * 15 * 1000,
      );
      setTime(roundedTime);
      setNewEvent(prev => ({
        ...prev,
        time:
          roundedTime.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }) ?? '',
      }));
    }
  };

  const renderEventCard = ({item}: {item: Event}) => {
    const isPast = isEventPast(item.date, item.time);
    const isCommentsExpanded = expandedCommentsEventId === item._id;
    const isWatching = watchedEventIds.has(item._id);
    const isEventFull = item.rosterSpotsFilled >= item.totalSpots;
    const isCreator = userData?._id === item.createdBy;
    const username = item.createdByUsername || '';
    const creatorInfo = creatorInfoMap[username];
    const creatorProfilePicUrl =
      item.createdByProfilePicUrl || creatorInfo?.profilePicUrl;
    const creatorInitials = getCreatorInitials(creatorInfo?.name, username);
    const likeCount = item.likes?.length || 0;
    const commentCount =
      localCommentCounts[item._id] ?? item.commentCount ?? 0;

    const showOptionsMenu = () => {
      setOptionsMenuEvent(item);
    };

    return (
      <View style={[themedStyles.card, isPast && themedStyles.pastEventCard]}>
        {/* Header: Avatar + Identity + Options */}
        <View style={themedStyles.cardHeader}>
          <TouchableOpacity
            onPress={() => handleEventPress(item)}
            activeOpacity={0.7}
            style={themedStyles.cardHeaderLeft}>
            {creatorProfilePicUrl ? (
              <Image
                source={{uri: creatorProfilePicUrl}}
                style={themedStyles.avatar}
              />
            ) : (
              <View
                style={[
                  themedStyles.avatar,
                  {backgroundColor: getAvatarColor(username)},
                ]}>
                <Text style={themedStyles.avatarText}>
                  {creatorInitials}
                </Text>
              </View>
            )}
            <View style={themedStyles.cardHeaderIdentity}>
              <Text
                style={themedStyles.cardHeaderUsername}
                numberOfLines={1}>
                {username || t('events.anonymous') || 'Unknown'}
              </Text>
              <View style={themedStyles.cardHeaderMetaRow}>
                {item.createdAt && (
                  <Text style={themedStyles.cardHeaderMeta}>
                    {formatRelativeTime(item.createdAt)}
                  </Text>
                )}
                {item.privacy && item.privacy !== 'public' && (
                  <>
                    <Text style={themedStyles.cardHeaderMetaDot}>·</Text>
                    <FontAwesomeIcon
                      icon={item.privacy === 'private' ? faLock : faEnvelope}
                      size={10}
                      color={colors.secondaryText}
                    />
                    <Text style={themedStyles.cardHeaderMeta}>
                      {item.privacy === 'private' ? 'Private' : 'Invite Only'}
                    </Text>
                  </>
                )}
                {item.isRecurring && (
                  <>
                    <Text style={themedStyles.cardHeaderMetaDot}>·</Text>
                    <FontAwesomeIcon
                      icon={faRotate}
                      size={10}
                      color={colors.secondaryText}
                    />
                    <Text style={themedStyles.cardHeaderMeta}>Recurring</Text>
                  </>
                )}
                {isPast && (
                  <>
                    <Text style={themedStyles.cardHeaderMetaDot}>·</Text>
                    <Text
                      style={[
                        themedStyles.cardHeaderMeta,
                        themedStyles.pastEventLabel,
                      ]}>
                      {t('events.past') || 'Past'}
                    </Text>
                  </>
                )}
              </View>
            </View>
          </TouchableOpacity>
          {isCreator && (
            <TouchableOpacity
              style={themedStyles.cardOptionsButton}
              onPress={showOptionsMenu}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
              <FontAwesomeIcon
                icon={faEllipsisH}
                size={18}
                color={colors.secondaryText}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Title + Details */}
        <TouchableOpacity
          onPress={() => handleEventPress(item)}
          activeOpacity={0.7}>
          <View style={themedStyles.cardBody}>
            <View style={themedStyles.cardTitleRow}>
              <Text style={themedStyles.cardEventEmoji}>
                {getEventTypeEmoji(item.eventType)}
              </Text>
              <Text style={themedStyles.cardEventTitle} numberOfLines={2}>
                {item.name}
              </Text>
            </View>

            <View style={themedStyles.detailRow}>
              <FontAwesomeIcon
                icon={faMapMarkerAlt}
                size={12}
                color={colors.secondaryText}
              />
              <Text style={themedStyles.detailText} numberOfLines={1}>
                {item.location}
              </Text>
            </View>

            <View style={themedStyles.detailRow}>
              <FontAwesomeIcon
                icon={faCalendarAlt}
                size={12}
                color={colors.secondaryText}
              />
              <Text style={themedStyles.detailText}>
                {item.date} · {formatDisplayTime(item.time)}
              </Text>
            </View>

            <View style={themedStyles.detailRow}>
              <FontAwesomeIcon
                icon={faUsers}
                size={12}
                color={colors.secondaryText}
              />
              <Text style={themedStyles.detailText}>
                {item.rosterSpotsFilled}/{item.totalSpots}{' '}
                {t('events.playersJoined')}
                {isEventFull && item.waitlist && item.waitlist.length > 0
                  ? ` · ${item.waitlist.length} waitlisted`
                  : ''}
              </Text>
            </View>

            {!isPast && (
              <CountdownTimer eventDate={item.date} eventTime={item.time} />
            )}
          </View>
        </TouchableOpacity>

        {/* Embedded Map Preview */}
        <TouchableOpacity
          style={themedStyles.mapEmbed}
          onPress={() => openMapsForEvent(item, t, presentMapPicker)}
          activeOpacity={0.85}>
          {(() => {
            const coords =
              item.latitude && item.longitude
                ? {latitude: item.latitude, longitude: item.longitude}
                : getCoordinatesFromLocation(item.location);

            return (
              <MapView
                provider={
                  Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined
                }
                liteMode={Platform.OS === 'android'}
                style={themedStyles.mapEmbedView}
                initialRegion={{
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}>
                <Marker
                  coordinate={coords}
                  title={item.name}
                  description={item.location}
                />
              </MapView>
            );
          })()}
          <View style={themedStyles.mapEmbedOverlay}>
            <FontAwesomeIcon
              icon={faLocationArrow}
              size={11}
              color="#fff"
            />
            <Text style={themedStyles.mapEmbedOverlayText}>
              {t('events.getDirections')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Engagement Footer */}
        <View style={themedStyles.engagementRow}>
          <TouchableOpacity
            style={themedStyles.engagementButton}
            onPress={() => toggleEventLike(item)}
            onLongPress={() => likeCount > 0 && showEventLikedBy(item)}
            hitSlop={{top: 8, bottom: 8, left: 4, right: 4}}>
            <FontAwesomeIcon
              icon={faHeart}
              size={16}
              color={
                likedEvents.has(item._id) ? '#e74c3c' : colors.secondaryText
              }
            />
            {likeCount > 0 && (
              <Text
                style={[
                  themedStyles.engagementCount,
                  likedEvents.has(item._id) && {color: '#e74c3c'},
                ]}>
                {likeCount}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={themedStyles.engagementButton}
            onPress={() => handleDiscussEvent(item)}
            hitSlop={{top: 8, bottom: 8, left: 4, right: 4}}>
            <FontAwesomeIcon
              icon={faComments}
              size={16}
              color={
                isCommentsExpanded ? colors.primary : colors.secondaryText
              }
            />
            {commentCount > 0 && (
              <Text
                style={[
                  themedStyles.engagementCount,
                  isCommentsExpanded && {color: colors.primary},
                ]}>
                {commentCount}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={themedStyles.engagementButton}
            onPress={() => handleShareEvent(item)}
            hitSlop={{top: 8, bottom: 8, left: 4, right: 4}}>
            <FontAwesomeIcon
              icon={faShareAlt}
              size={16}
              color={colors.secondaryText}
            />
          </TouchableOpacity>

          <View style={themedStyles.engagementSpacer} />

          <TouchableOpacity
            style={themedStyles.engagementButton}
            onPress={() => openWatchModal(item)}
            hitSlop={{top: 8, bottom: 8, left: 4, right: 4}}>
            <FontAwesomeIcon
              icon={faBell}
              size={16}
              color={isWatching ? colors.primary : colors.secondaryText}
            />
            {isWatching && (
              <Text
                style={[
                  themedStyles.engagementCount,
                  {color: colors.primary},
                ]}>
                Watching
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Inline Event Comments */}
        {isCommentsExpanded && (
          <EventComments
            eventId={item._id}
            eventName={item.name}
            eventType={item.eventType}
            onClose={() => setExpandedCommentsEventId(null)}
            onCommentCountChange={(eid, count) =>
              setLocalCommentCounts(prev => ({...prev, [eid]: count}))
            }
          />
        )}
      </View>
    );
  };

  const renderRecurringGroup = (groupId: string, events: Event[]) => {
    const isExpanded = expandedRecurringGroup === groupId;
    const activeIdx = deckActiveIndex[groupId] || 0;
    const previewEvent = events[activeIdx] || events[0];

    if (!isExpanded) {
      const stackCards = Math.min(events.length, 3);
      return (
        <View key={groupId}>
          <TouchableOpacity
            activeOpacity={0.95}
            onPress={() => {
              LayoutAnimation.configureNext(
                LayoutAnimation.Presets.easeInEaseOut,
              );
              setExpandedRecurringGroup(groupId);
            }}
            style={{marginBottom: (stackCards - 1) * 4 + 8}}>
            <View style={themedStyles.positionRelative}>
              {Array.from({length: stackCards})
                .map((_, i) => i)
                .reverse()
                .map(i => {
                  if (i === 0) {
                    return null;
                  }
                  const offset = i * 6;
                  const scale = 1 - i * 0.03;
                  return (
                    <View
                      key={`shadow-${i}`}
                      style={[
                        themedStyles.deckBgCardBase,
                        {
                          top: offset,
                          transform: [{scale}],
                          opacity: 1 - i * 0.2,
                          zIndex: -i,
                        },
                      ]}>
                      {renderEventCard({item: events[i] || previewEvent})}
                    </View>
                  );
                })}
              <View style={themedStyles.zIndexTop}>
                {renderEventCard({item: previewEvent})}
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={themedStyles.recurringStackIndicator}
            onPress={() => {
              LayoutAnimation.configureNext(
                LayoutAnimation.Presets.easeInEaseOut,
              );
              setExpandedRecurringGroup(groupId);
            }}>
            <FontAwesomeIcon icon={faRotate} size={12} color={colors.primary} />
            <Text style={themedStyles.recurringStackText}>
              {events.length} events in this series — tap to browse
            </Text>
            <FontAwesomeIcon
              icon={faChevronRight}
              size={10}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <RecurringDeck
        groupId={groupId}
        events={events}
        activeIndex={activeIdx}
        onIndexChange={idx =>
          setDeckActiveIndex(prev => ({...prev, [groupId]: idx}))
        }
        onCollapse={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setExpandedRecurringGroup(null);
        }}
        renderEventCard={renderEventCard}
        colors={colors}
        themedStyles={themedStyles}
      />
    );
  };

  const renderDisplayItem = ({item}: {item: DisplayItem}) => {
    if (item.type === 'single') {
      return renderEventCard({item: item.event});
    }
    return renderRecurringGroup(item.groupId, item.events);
  };

  return (
    <SafeAreaView style={themedStyles.container} edges={['top']}>
      {/* Header */}
      <View style={themedStyles.header}>
        <View style={themedStyles.headerSide}>
          <HamburgerMenu />
        </View>
        <Text style={themedStyles.title}>{t('events.title')}</Text>
        <View style={[themedStyles.headerSide, themedStyles.headerRight]}>
          <TouchableOpacity
            style={themedStyles.bellButton}
            onPress={() => navigation.navigate('Notifications' as never)}>
            <FontAwesomeIcon icon={faBell} size={22} color={colors.primary} />
            {badgeCount > 0 && (
              <View style={themedStyles.badge}>
                <Text style={themedStyles.badgeText}>
                  {badgeCount > 99 ? '99+' : badgeCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
      {/* Search Bar with Filter Button */}
      <View style={themedStyles.searchFilterRow}>
        <View
          style={[
            themedStyles.searchContainer,
            themedStyles.searchContainerInRow,
          ]}>
          <FontAwesomeIcon
            icon={faSearch}
            size={14}
            color={colors.secondaryText}
            style={themedStyles.searchIcon}
          />
          <TextInput
            style={themedStyles.searchInput}
            placeholder={t('events.searchPlaceholder') || 'Search events...'}
            placeholderTextColor={colors.secondaryText}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              style={themedStyles.clearButton}
              onPress={() => setSearchQuery('')}>
              <FontAwesomeIcon
                icon={faTimes}
                size={14}
                color={colors.secondaryText}
              />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[
            themedStyles.filterButton,
            activeFilterCount > 0 && themedStyles.filterButtonActive,
          ]}
          onPress={() => setShowFilterModal(true)}>
          <FontAwesomeIcon
            icon={faFilter}
            size={16}
            color={
              activeFilterCount > 0 ? colors.primary : colors.secondaryText
            }
          />
          {activeFilterCount > 0 && (
            <View style={themedStyles.filterBadge}>
              <Text style={themedStyles.filterBadgeText}>
                {activeFilterCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      {/* Content wrapper: pills + filters + event list */}
      <KeyboardAvoidingView
        style={themedStyles.contentWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 56 : 0}>
        {/* Horizontal Activity Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={themedStyles.chipBarContainer}
          contentContainerStyle={themedStyles.chipBarContent}>
          {activityOptions.map(option => {
            const isActive = selectedEventTypes.includes(option.label);
            return (
              <TouchableOpacity
                key={option.label}
                style={[themedStyles.chip, isActive && themedStyles.chipActive]}
                onPress={() => toggleEventType(option.label)}
                activeOpacity={0.7}>
                <Text style={themedStyles.chipEmoji}>{option.emoji}</Text>
                <Text
                  style={[
                    themedStyles.chipText,
                    isActive && themedStyles.chipTextActive,
                  ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {/* Profile Filter Banner */}
        {profileFilter && (
          <View style={themedStyles.profileFilterBanner}>
            <Text style={themedStyles.profileFilterText}>
              {profileFilter === 'created'
                ? t('profile.showingEventsCreated') ||
                  'Showing events you created'
                : t('profile.showingEventsJoined') ||
                  'Showing events you joined'}
            </Text>
            <TouchableOpacity
              style={themedStyles.profileFilterClear}
              onPress={clearFilters}>
              <Text style={themedStyles.profileFilterClearText}>
                {t('profile.clearFilter') || 'Clear'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {/* Active Filters Display */}
        {activeFilterCount > 0 && (
          <View style={themedStyles.activeFiltersContainer}>
            {selectedEventTypes.map(type => (
              <TouchableOpacity
                key={type}
                style={themedStyles.activeFilterTag}
                onPress={() => toggleEventType(type)}>
                <Text style={themedStyles.activeFilterTagText}>
                  {getEventTypeEmoji(type)} {type}
                </Text>
                <FontAwesomeIcon
                  icon={faTimes}
                  size={10}
                  color={colors.primary}
                />
              </TouchableOpacity>
            ))}
            {selectedDateFilter !== 'all' && (
              <TouchableOpacity
                style={themedStyles.activeFilterTag}
                onPress={() => setSelectedDateFilter('all')}>
                <Text style={themedStyles.activeFilterTagText}>
                  📅{' '}
                  {
                    dateFilterOptions.find(d => d.value === selectedDateFilter)
                      ?.label
                  }
                </Text>
                <FontAwesomeIcon
                  icon={faTimes}
                  size={10}
                  color={colors.primary}
                />
              </TouchableOpacity>
            )}
            {showAvailableOnly && (
              <TouchableOpacity
                style={themedStyles.activeFilterTag}
                onPress={() => setShowAvailableOnly(false)}>
                <Text style={themedStyles.activeFilterTagText}>
                  ✅ {t('events.availableOnly') || 'Available spots'}
                </Text>
                <FontAwesomeIcon
                  icon={faTimes}
                  size={10}
                  color={colors.primary}
                />
              </TouchableOpacity>
            )}
            {proximityEnabled && (
              <TouchableOpacity
                style={themedStyles.activeFilterTag}
                onPress={() => setProximityEnabled(false)}>
                <Text style={themedStyles.activeFilterTagText}>
                  📍 Within {proximityRadius} mi
                </Text>
                <FontAwesomeIcon
                  icon={faTimes}
                  size={10}
                  color={colors.primary}
                />
              </TouchableOpacity>
            )}
          </View>
        )}
        {loading ? (
          <EventListSkeleton count={4} />
        ) : (
          <FlatList
            ref={flatListRef}
            data={displayItems}
            renderItem={renderDisplayItem}
            keyExtractor={item =>
              item.type === 'single' ? item.event._id : item.groupId
            }
            refreshing={loading}
            onRefresh={fetchEvents}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentContainerStyle={themedStyles.flatListContent}
            onScrollToIndexFailed={info => {
              const maxIndex = displayItems.length - 1;
              if (maxIndex >= 0) {
                setTimeout(() => {
                  flatListRef.current?.scrollToIndex({
                    index: Math.min(info.index, maxIndex),
                    animated: true,
                  });
                }, 100);
              }
            }}
            ListEmptyComponent={
              <View
                style={[
                  themedStyles.noResultsContainer,
                  themedStyles.noResultsContainerCompact,
                ]}>
                <View style={themedStyles.noResultsIconContainer}>
                  <FontAwesomeIcon
                    icon={
                      searchQuery
                        ? faSearch
                        : activeFilterCount > 0
                        ? faFilter
                        : faCalendarAlt
                    }
                    size={28}
                    color={colors.primary}
                  />
                </View>
                <Text style={themedStyles.noResultsText}>
                  {searchQuery
                    ? t('common.noResults')
                    : activeFilterCount > 0
                    ? t('events.noMatchingEvents')
                    : t('events.noEvents')}
                </Text>
                {searchQuery ? (
                  <Text style={themedStyles.noResultsSubtext}>
                    {t('events.tryDifferentSearch')}
                  </Text>
                ) : activeFilterCount > 0 ? (
                  <>
                    <Text style={themedStyles.noResultsSubtext}>
                      {t('events.tryDifferentFilter')}
                    </Text>
                    <TouchableOpacity
                      style={themedStyles.ctaButton}
                      onPress={clearFilters}>
                      <FontAwesomeIcon
                        icon={faTimes}
                        size={14}
                        color={colors.buttonText || '#fff'}
                      />
                      <Text style={themedStyles.ctaButtonText}>
                        {t('events.clearFilters')}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : showFirstTimeHint ? (
                  <>
                    <Text style={themedStyles.noResultsSubtext}>
                      {t('events.noEventsSubtext')}
                    </Text>
                    <TouchableOpacity
                      style={themedStyles.ctaButton}
                      onPress={() => {
                        dismissFirstTimeHint();
                        setPlacesApiFailed(false);
                        setModalVisible(true);
                      }}>
                      <FontAwesomeIcon
                        icon={faPlus}
                        size={14}
                        color={colors.buttonText || '#fff'}
                      />
                      <Text style={themedStyles.ctaButtonText}>
                        {t('events.createFirstEvent')}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
            }
          />
        )}
      </KeyboardAvoidingView>
      {/* Floating Action Button */}
      <TouchableOpacity
        style={themedStyles.fab}
        activeOpacity={0.85}
        onPress={() => {
          setPlacesApiFailed(false);
          setModalVisible(true);
          setIsEditing(false);
          setEditingEventId(null);
          setNewEvent(createEmptyEvent());
          setTempRosterSize('');
          setTempEventType('');
        }}>
        <FontAwesomeIcon
          icon={faPlus}
          size={24}
          color={colors.buttonText || '#fff'}
        />
      </TouchableOpacity>
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={handleCancelModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={themedStyles.keyboardAvoidingView}>
          <View style={themedStyles.modalOverlay}>
            <View style={themedStyles.modalView}>
              <View style={themedStyles.modalHandle} />
              <Text style={themedStyles.modalHeader}>
                {isEditing
                  ? t('events.editEvent')
                  : t('events.createEvent')}
              </Text>

              <ScrollView
                style={themedStyles.modalFormScroll}
                contentContainerStyle={themedStyles.modalBody}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled">
                <TextInput
                  style={themedStyles.modalInput}
                  placeholder={t('events.eventName')}
                  placeholderTextColor={colors.placeholder || '#888'}
                  value={newEvent.name}
                  onChangeText={text => setNewEvent({...newEvent, name: text})}
                />
                {/* Location Input with Autocomplete */}
                <View style={themedStyles.autocompleteContainer}>
                  {isApiKeyConfigured && !placesApiFailed ? (
                    <GooglePlacesAutocomplete
                      placeholder="Location/Facility"
                      onPress={(data, details = null) => {
                        console.log('Selected place:', data, details);
                        const location =
                          data.description ||
                          data.structured_formatting?.main_text ||
                          '';
                        const coords = details?.geometry?.location;

                        setNewEvent({
                          ...newEvent,
                          location: location,
                          latitude: coords?.lat,
                          longitude: coords?.lng,
                        });
                      }}
                      query={{
                        key: GOOGLE_PLACES_API_KEY,
                        language: 'en',
                        types: 'establishment|geocode',
                      }}
                      fetchDetails={true}
                      disableScroll={true}
                      listViewDisplayed="auto"
                      styles={autocompleteStyles}
                      onFail={error => {
                        console.warn('GooglePlacesAutocomplete error:', error);
                        // Fall back to plain text input when API fails
                        // (e.g. billing not enabled, quota exceeded, invalid key)
                        setPlacesApiFailed(true);
                      }}
                      textInputProps={{
                        placeholderTextColor: colors.placeholder || '#888',
                      }}
                      enablePoweredByContainer={false}
                      debounce={200}
                    />
                  ) : (
                    <TextInput
                      style={themedStyles.modalInput}
                      placeholder={
                        placesApiFailed
                          ? 'Enter location manually'
                          : t('events.eventLocation')
                      }
                      placeholderTextColor={colors.placeholder || '#888'}
                      value={newEvent.location}
                      onChangeText={text =>
                        setNewEvent({...newEvent, location: text})
                      }
                    />
                  )}
                </View>

                {/* Event Date selector */}
                <TouchableOpacity
                  style={themedStyles.modalInput}
                  onPress={() => {
                    closeAllPickers('date');
                    setShowDatePicker(true);
                  }}>
                  <Text
                    style={{
                      color: newEvent.date ? colors.text : colors.placeholder,
                    }}>
                    {newEvent.date
                      ? newEvent.date
                      : t('events.selectEventDate')}
                  </Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <View>
                    <DateTimePicker
                      value={date || new Date()}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'inline' : 'default'}
                      onChange={onDateChange}
                      minimumDate={new Date()}
                      themeVariant={darkMode ? 'dark' : 'light'}
                      accentColor={colors.primary}
                      textColor={colors.text}
                    />
                    {Platform.OS === 'ios' && (
                      <TouchableOpacity
                        onPress={() => setShowDatePicker(false)}>
                        <Text style={themedStyles.confirmButton}>
                          {t('events.confirmDate')}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Event Time selector */}
                <TouchableOpacity
                  style={themedStyles.modalInput}
                  onPress={() => {
                    closeAllPickers('time');
                    setShowTimePicker(true);
                  }}>
                  <Text
                    style={{
                      color: newEvent.time ? colors.text : colors.placeholder,
                    }}>
                    {newEvent.time
                      ? formatDisplayTime(newEvent.time)
                      : t('events.selectEventTime')}
                  </Text>
                </TouchableOpacity>
                {showTimePicker && (
                  <View>
                    <DateTimePicker
                      value={time || new Date()}
                      mode="time"
                      minuteInterval={15}
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={onTimeChange}
                      themeVariant={darkMode ? 'dark' : 'light'}
                      accentColor={colors.primary}
                      textColor={colors.text}
                      minimumDate={
                        date &&
                        date.toDateString() === new Date().toDateString()
                          ? new Date()
                          : undefined
                      }
                    />
                    {Platform.OS === 'ios' && (
                      <TouchableOpacity
                        onPress={() => setShowTimePicker(false)}>
                        <Text style={themedStyles.confirmButton}>
                          {t('events.confirmTime')}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Recurring Event toggle */}
                {!isEditing && (
                  <View style={themedStyles.recurrenceSection}>
                    <View style={themedStyles.recurrenceToggleRow}>
                      <View style={themedStyles.flexOne}>
                        <Text style={themedStyles.recurrenceLabel}>
                          Recurring Event
                        </Text>
                        <Text style={themedStyles.recurrenceDescription}>
                          Automatically create multiple events on a schedule
                        </Text>
                      </View>
                      <Switch
                        value={newEvent.isRecurring}
                        onValueChange={value =>
                          setNewEvent({...newEvent, isRecurring: value})
                        }
                        trackColor={{
                          false: colors.border,
                          true: colors.primary,
                        }}
                      />
                    </View>

                    {newEvent.isRecurring && (
                      <View style={themedStyles.recurrenceOptions}>
                        <Text style={themedStyles.recurrenceSubLabel}>
                          Frequency
                        </Text>
                        <View style={themedStyles.recurrenceFrequencyRow}>
                          {recurrenceOptions.map(option => (
                            <TouchableOpacity
                              key={option.value}
                              style={[
                                themedStyles.recurrenceFrequencyOption,
                                newEvent.recurrenceFrequency === option.value &&
                                  themedStyles.recurrenceFrequencySelected,
                              ]}
                              onPress={() =>
                                setNewEvent({
                                  ...newEvent,
                                  recurrenceFrequency: option.value,
                                })
                              }>
                              <Text
                                style={[
                                  themedStyles.recurrenceFrequencyText,
                                  newEvent.recurrenceFrequency ===
                                    option.value &&
                                    themedStyles.recurrenceFrequencyTextSelected,
                                ]}>
                                {option.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        <Text
                          style={[
                            themedStyles.recurrenceSubLabel,
                            themedStyles.recurrenceCountSubLabel,
                          ]}>
                          Number of Events
                        </Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={themedStyles.recurrenceCountScroll}>
                          {recurrenceCountOptions.map(count => (
                            <TouchableOpacity
                              key={count}
                              style={[
                                themedStyles.recurrenceCountOption,
                                newEvent.recurrenceCount === count &&
                                  themedStyles.recurrenceCountSelected,
                              ]}
                              onPress={() =>
                                setNewEvent({
                                  ...newEvent,
                                  recurrenceCount: count,
                                })
                              }>
                              <Text
                                style={[
                                  themedStyles.recurrenceCountText,
                                  newEvent.recurrenceCount === count &&
                                    themedStyles.recurrenceCountTextSelected,
                                ]}>
                                {count}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>

                        <Text style={themedStyles.recurrenceSummary}>
                          {newEvent.date
                            ? `${newEvent.recurrenceCount} events, ${newEvent.recurrenceFrequency}, starting ${newEvent.date}`
                            : 'Select a date above to see the schedule'}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Roster Size selector */}
                <TouchableOpacity
                  style={themedStyles.modalInput}
                  onPress={() => {
                    closeAllPickers('rosterSize');
                    setShowRosterSizePicker(true);
                    setTempRosterSize(newEvent.totalSpots || '');
                  }}>
                  <Text
                    style={{
                      color: newEvent.totalSpots
                        ? colors.text
                        : colors.placeholder,
                    }}>
                    {newEvent.totalSpots
                      ? newEvent.totalSpots
                      : t('events.selectRosterSize')}
                  </Text>
                </TouchableOpacity>
                {showRosterSizePicker && (
                  <View>
                    <View style={themedStyles.pickerContainer}>
                      <Picker
                        selectedValue={tempRosterSize}
                        onValueChange={itemValue =>
                          setTempRosterSize(itemValue)
                        }
                        style={themedStyles.picker}
                        dropdownIconColor={colors.text}>
                        {rosterSizeOptions.map(value => (
                          <Picker.Item
                            key={value}
                            label={value}
                            value={value}
                            color={colors.text}
                          />
                        ))}
                      </Picker>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setNewEvent({...newEvent, totalSpots: tempRosterSize});
                        setShowRosterSizePicker(false);
                      }}>
                      <Text style={themedStyles.confirmButton}>
                        {t('events.confirmRosterSize')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Event Type selector */}
                <TouchableOpacity
                  style={themedStyles.modalInput}
                  onPress={() => {
                    closeAllPickers('eventType');
                    setShowEventTypePicker(true);
                    setTempEventType(newEvent.eventType || '');
                  }}>
                  <Text
                    style={{
                      color: newEvent.eventType
                        ? colors.text
                        : colors.placeholder,
                    }}>
                    {newEvent.eventType
                      ? newEvent.eventType
                      : t('events.selectEventType')}
                  </Text>
                </TouchableOpacity>
                {showEventTypePicker && (
                  <View>
                    <View style={themedStyles.pickerContainer}>
                      <Picker
                        selectedValue={tempEventType}
                        onValueChange={itemValue => setTempEventType(itemValue)}
                        style={themedStyles.picker}
                        dropdownIconColor={colors.text}>
                        {activityOptions.map(opt => (
                          <Picker.Item
                            key={opt.label}
                            label={`${opt.emoji} ${opt.label}`}
                            value={opt.label}
                            color={colors.text}
                          />
                        ))}
                      </Picker>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        // Reset jersey colors when changing event type
                        setNewEvent({
                          ...newEvent,
                          eventType: tempEventType,
                          jerseyColors: [],
                        });
                        setShowEventTypePicker(false);
                      }}>
                      <Text style={themedStyles.confirmButton}>
                        {t('events.confirmEventType')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Jersey Color Selector - only for team sports */}
                {isTeamSport(newEvent.eventType) && (
                  <>
                    <TouchableOpacity
                      style={themedStyles.modalInput}
                      onPress={() => {
                        closeAllPickers('jerseyColor');
                        setShowJerseyColorPicker(true);
                      }}>
                      <Text
                        style={{
                          color:
                            newEvent.jerseyColors.length === 2
                              ? colors.text
                              : colors.placeholder,
                        }}>
                        {newEvent.jerseyColors.length === 2
                          ? `Team Colors: ${newEvent.jerseyColors.join(' vs ')}`
                          : t('events.selectJerseyColors') ||
                            'Select 2 Jersey Colors'}
                      </Text>
                    </TouchableOpacity>
                    {showJerseyColorPicker && (
                      <View style={themedStyles.jerseyColorPickerContainer}>
                        <Text style={themedStyles.jerseyColorTitle}>
                          {t('events.selectTwoColors') ||
                            'Select 2 team jersey colors:'}
                        </Text>
                        <View style={themedStyles.jerseyColorGrid}>
                          {jerseyColorOptions.map(colorOpt => {
                            const isSelected = newEvent.jerseyColors.includes(
                              colorOpt.label,
                            );
                            const isLight =
                              colorOpt.label === 'White' ||
                              colorOpt.label === 'Yellow';
                            return (
                              <TouchableOpacity
                                key={colorOpt.label}
                                style={[
                                  themedStyles.jerseyColorOption,
                                  isSelected &&
                                    themedStyles.jerseyColorOptionSelected,
                                ]}
                                onPress={() => {
                                  let updatedColors = [
                                    ...newEvent.jerseyColors,
                                  ];
                                  if (isSelected) {
                                    // Remove if already selected
                                    updatedColors = updatedColors.filter(
                                      c => c !== colorOpt.label,
                                    );
                                  } else if (updatedColors.length < 2) {
                                    // Add if less than 2 selected
                                    updatedColors.push(colorOpt.label);
                                  }
                                  setNewEvent({
                                    ...newEvent,
                                    jerseyColors: updatedColors,
                                  });
                                }}>
                                <View
                                  style={[
                                    themedStyles.jerseyColorSwatch,
                                    {backgroundColor: colorOpt.color},
                                    isLight &&
                                      themedStyles.jerseyColorSwatchLight,
                                  ]}
                                />
                                <Text style={themedStyles.jerseyColorLabel}>
                                  {colorOpt.label}
                                </Text>
                                {isSelected && (
                                  <Text style={themedStyles.jerseyColorCheck}>
                                    ✓
                                  </Text>
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        <TouchableOpacity
                          onPress={() => setShowJerseyColorPicker(false)}>
                          <Text style={themedStyles.confirmButton}>
                            {t('common.done') || 'Done'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                )}

                {/* Privacy Selector */}
                <View style={themedStyles.privacyContainer}>
                  <Text style={themedStyles.privacyLabel}>
                    {t('events.eventPrivacy') || 'Event Privacy'}
                  </Text>
                  <View style={themedStyles.privacyOptions}>
                    {privacyOptions.map(option => (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          themedStyles.privacyOption,
                          newEvent.privacy === option.value &&
                            themedStyles.privacyOptionSelected,
                        ]}
                        onPress={() =>
                          setNewEvent({...newEvent, privacy: option.value})
                        }>
                        <FontAwesomeIcon
                          icon={option.icon}
                          size={16}
                          color={
                            newEvent.privacy === option.value
                              ? colors.primary
                              : colors.secondaryText
                          }
                        />
                        <View style={themedStyles.privacyOptionTextContainer}>
                          <Text
                            style={[
                              themedStyles.privacyOptionLabel,
                              newEvent.privacy === option.value &&
                                themedStyles.privacyOptionLabelSelected,
                            ]}>
                            {option.label}
                          </Text>
                          <Text style={themedStyles.privacyOptionDescription}>
                            {option.description}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Invite Users Section - only for invite-only events */}
                {newEvent.privacy === 'invite-only' && (
                  <View style={themedStyles.inviteContainer}>
                    <Text style={themedStyles.privacyLabel}>
                      {t('events.inviteUsers') || 'Invite Users'}
                    </Text>

                    {/* Search Input */}
                    <View style={themedStyles.inviteSearchContainer}>
                      <FontAwesomeIcon
                        icon={faSearch}
                        size={16}
                        color={colors.placeholder}
                        style={themedStyles.inviteSearchIcon}
                      />
                      <TextInput
                        style={themedStyles.inviteSearchInput}
                        placeholder={
                          t('events.searchUsersToInvite') ||
                          'Search users to invite...'
                        }
                        placeholderTextColor={colors.placeholder}
                        value={inviteSearchQuery}
                        onChangeText={text => {
                          setInviteSearchQuery(text);
                          searchUsersForInvite(text);
                        }}
                      />
                      {loadingInviteUsers && (
                        <ActivityIndicator
                          size="small"
                          color={colors.primary}
                        />
                      )}
                    </View>

                    {/* Search Results */}
                    {availableUsersToInvite.length > 0 && (
                      <View style={themedStyles.inviteSearchResults}>
                        {availableUsersToInvite.map(user => (
                          <TouchableOpacity
                            key={user._id}
                            style={themedStyles.inviteSearchResultRow}
                            onPress={() => addUserToInvite(user)}>
                            {user.profilePicUrl ? (
                              <Image
                                source={{uri: user.profilePicUrl}}
                                style={themedStyles.inviteUserAvatar}
                              />
                            ) : (
                              <View
                                style={
                                  themedStyles.inviteUserAvatarPlaceholder
                                }>
                                <Text style={themedStyles.inviteUserAvatarText}>
                                  {getInitials(user.name || user.username)}
                                </Text>
                              </View>
                            )}
                            <View style={themedStyles.inviteUserTextBlock}>
                              <Text
                                style={themedStyles.inviteUserName}
                                numberOfLines={1}>
                                {user.name || user.username}
                              </Text>
                              {user.name ? (
                                <Text
                                  style={themedStyles.inviteUserHandle}
                                  numberOfLines={1}>
                                  @{user.username}
                                </Text>
                              ) : null}
                            </View>
                            <FontAwesomeIcon
                              icon={faPlus}
                              size={16}
                              color={colors.primary}
                            />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {/* Invited Users List */}
                    {invitedUserDetails.length > 0 && (
                      <View style={themedStyles.invitedUsersList}>
                        <Text style={themedStyles.invitedUsersLabel}>
                          {t('events.invitedUsers') || 'Invited'} (
                          {invitedUserDetails.length})
                        </Text>
                        <View style={themedStyles.invitedUsersChips}>
                          {invitedUserDetails.map(user => (
                            <View
                              key={user._id}
                              style={themedStyles.invitedUserChip}>
                              <Text style={themedStyles.invitedUserChipText}>
                                {user.name || user.username}
                              </Text>
                              <TouchableOpacity
                                onPress={() => removeUserFromInvite(user._id)}
                                hitSlop={{
                                  top: 10,
                                  bottom: 10,
                                  left: 10,
                                  right: 10,
                                }}>
                                <FontAwesomeIcon
                                  icon={faTimes}
                                  size={12}
                                  color={colors.secondaryText}
                                />
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {invitedUserDetails.length === 0 && (
                      <Text style={themedStyles.inviteHint}>
                        {t('events.inviteHint') ||
                          'Search and add users who can see and join this event'}
                      </Text>
                    )}
                  </View>
                )}
              </ScrollView>

              <View style={themedStyles.buttonContainer}>
                <TouchableOpacity
                  style={[
                    themedStyles.saveButton,
                    savingEvent && themedStyles.disabledOpacity,
                  ]}
                  onPress={handleSaveNewEvent}
                  disabled={savingEvent}>
                  {savingEvent ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={themedStyles.buttonText}>
                      {isEditing
                        ? t('events.saveChanges')
                        : t('events.createEvent')}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[themedStyles.saveButton, themedStyles.cancelButton]}
                  onPress={handleCancelModal}
                  disabled={savingEvent}>
                  <Text
                    style={[
                      themedStyles.buttonText,
                      themedStyles.cancelButtonText,
                    ]}>
                    {t('common.cancel')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* Event Card Options Menu (themed bottom sheet) */}
      <Modal
        visible={optionsMenuEvent !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setOptionsMenuEvent(null)}>
        <TouchableOpacity
          style={themedStyles.modalOverlay}
          activeOpacity={1}
          onPress={() => setOptionsMenuEvent(null)}>
          <View
            style={themedStyles.optionsMenuSheet}
            onStartShouldSetResponder={() => true}>
            <View style={themedStyles.modalHandle} />
            <View style={themedStyles.optionsMenuHeaderBlock}>
              <Text style={themedStyles.optionsMenuTitle}>
                {t('events.eventDetails') || 'Event Options'}
              </Text>
              {optionsMenuEvent && (
                <Text
                  style={themedStyles.optionsMenuSubtitle}
                  numberOfLines={1}>
                  {optionsMenuEvent.name}
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={themedStyles.optionsMenuRow}
              activeOpacity={0.7}
              onPress={() => {
                const target = optionsMenuEvent;
                setOptionsMenuEvent(null);
                if (target) {
                  handleEditEvent(target);
                }
              }}>
              <View
                style={[
                  themedStyles.optionsMenuIconContainer,
                  {backgroundColor: colors.primary + '15'},
                ]}>
                <FontAwesomeIcon
                  icon={faPenToSquare}
                  size={14}
                  color={colors.primary}
                />
              </View>
              <Text style={themedStyles.optionsMenuLabel}>
                {t('common.edit') || 'Edit'}
              </Text>
              <FontAwesomeIcon
                icon={faChevronRight}
                size={12}
                color={colors.secondaryText}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={themedStyles.optionsMenuRow}
              activeOpacity={0.7}
              onPress={() => {
                const target = optionsMenuEvent;
                setOptionsMenuEvent(null);
                if (target) {
                  handleDeleteEvent(target);
                }
              }}>
              <View
                style={[
                  themedStyles.optionsMenuIconContainer,
                  {backgroundColor: colors.error + '15'},
                ]}>
                <FontAwesomeIcon
                  icon={faTrash}
                  size={14}
                  color={colors.error}
                />
              </View>
              <Text
                style={[
                  themedStyles.optionsMenuLabel,
                  themedStyles.optionsMenuLabelDanger,
                ]}>
                {t('common.delete') || 'Delete'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={themedStyles.optionsMenuCancel}
              activeOpacity={0.7}
              onPress={() => setOptionsMenuEvent(null)}>
              <Text style={themedStyles.optionsMenuCancelText}>
                {t('common.cancel') || 'Cancel'}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={watchModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeWatchModal}>
        <TouchableOpacity
          style={themedStyles.modalOverlay}
          activeOpacity={1}
          onPress={closeWatchModal}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={e => e.stopPropagation()}
            style={themedStyles.watchModalSheet}>
            <View style={themedStyles.modalHandle} />
            <View style={themedStyles.watchModalHeaderBlock}>
              <Text style={themedStyles.watchModalTitle}>
                {watchedEventIds.has(watchTargetEvent?._id || '')
                  ? 'Update Watch Settings'
                  : 'Watch This Event'}
              </Text>
              {!!watchTargetEvent?.name && (
                <Text style={themedStyles.watchModalSubtitle}>
                  {watchTargetEvent.name}
                </Text>
              )}
            </View>

            <View style={themedStyles.watchOptionsList}>
              <View style={themedStyles.watchOptionRow}>
                <View style={themedStyles.watchOptionIconContainer}>
                  <FontAwesomeIcon
                    icon={faUserPlus}
                    size={14}
                    color={colors.primary}
                  />
                </View>
                <View style={themedStyles.watchOptionInfo}>
                  <Text style={themedStyles.watchOptionTitle}>
                    Spots Opened
                  </Text>
                  <Text style={themedStyles.watchOptionDescription}>
                    Alert me when a full event has a free spot.
                  </Text>
                </View>
                <Switch
                  value={watchPreferencesDraft.spotsAvailable}
                  onValueChange={value =>
                    setWatchPreferencesDraft(prev => ({
                      ...prev,
                      spotsAvailable: value,
                    }))
                  }
                  trackColor={{false: colors.border, true: colors.primary}}
                />
              </View>

              <View style={themedStyles.watchOptionRow}>
                <View style={themedStyles.watchOptionIconContainer}>
                  <FontAwesomeIcon
                    icon={faPenToSquare}
                    size={14}
                    color={colors.primary}
                  />
                </View>
                <View style={themedStyles.watchOptionInfo}>
                  <Text style={themedStyles.watchOptionTitle}>
                    General Updates
                  </Text>
                  <Text style={themedStyles.watchOptionDescription}>
                    Important changes to date, time, or location.
                  </Text>
                </View>
                <Switch
                  value={watchPreferencesDraft.generalUpdates}
                  onValueChange={value =>
                    setWatchPreferencesDraft(prev => ({
                      ...prev,
                      generalUpdates: value,
                    }))
                  }
                  trackColor={{false: colors.border, true: colors.primary}}
                />
              </View>

              <View style={themedStyles.watchOptionRow}>
                <View style={themedStyles.watchOptionIconContainer}>
                  <FontAwesomeIcon
                    icon={faUsers}
                    size={14}
                    color={colors.primary}
                  />
                </View>
                <View style={themedStyles.watchOptionInfo}>
                  <Text style={themedStyles.watchOptionTitle}>
                    Roster Changes
                  </Text>
                  <Text style={themedStyles.watchOptionDescription}>
                    Notify me when roster activity changes this event.
                  </Text>
                </View>
                <Switch
                  value={watchPreferencesDraft.rosterChanges}
                  onValueChange={value =>
                    setWatchPreferencesDraft(prev => ({
                      ...prev,
                      rosterChanges: value,
                    }))
                  }
                  trackColor={{false: colors.border, true: colors.primary}}
                />
              </View>

              <View
                style={[
                  themedStyles.watchOptionRow,
                  themedStyles.watchOptionRowLast,
                ]}>
                <View style={themedStyles.watchOptionIconContainer}>
                  <FontAwesomeIcon
                    icon={faBell}
                    size={14}
                    color={colors.primary}
                  />
                </View>
                <View style={themedStyles.watchOptionInfo}>
                  <Text style={themedStyles.watchOptionTitle}>Reminders</Text>
                  <Text style={themedStyles.watchOptionDescription}>
                    Day-of reminders for watched events.
                  </Text>
                </View>
                <Switch
                  value={watchPreferencesDraft.reminders}
                  onValueChange={value =>
                    setWatchPreferencesDraft(prev => ({
                      ...prev,
                      reminders: value,
                    }))
                  }
                  trackColor={{false: colors.border, true: colors.primary}}
                />
              </View>
            </View>

            {(!settings.enabled || !settings.watchedEvents) && (
              <Text style={themedStyles.watchGlobalMutedNote}>
                Global notification settings are currently muting watched-event
                alerts. You can turn them on in Notification Settings.
              </Text>
            )}

            <View style={themedStyles.watchModalFooter}>
              <TouchableOpacity
                style={themedStyles.watchSecondaryButton}
                onPress={closeWatchModal}>
                <Text style={themedStyles.watchSecondaryButtonText}>
                  Cancel
                </Text>
              </TouchableOpacity>

              {watchedEventIds.has(watchTargetEvent?._id || '') && (
                <TouchableOpacity
                  style={[
                    themedStyles.watchSecondaryButton,
                    themedStyles.watchDangerButton,
                  ]}
                  disabled={savingWatch}
                  onPress={stopWatchingEvent}>
                  <Text
                    style={[
                      themedStyles.watchSecondaryButtonText,
                      themedStyles.watchDangerButtonText,
                    ]}>
                    Stop Watching
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={themedStyles.watchPrimaryButton}
                disabled={savingWatch}
                onPress={saveWatchPreferences}>
                {savingWatch ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.buttonText || '#fff'}
                  />
                ) : (
                  <Text style={themedStyles.watchPrimaryButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showFilterModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}>
        <TouchableOpacity
          style={themedStyles.filterModalOverlay}
          activeOpacity={1}
          onPress={() => setShowFilterModal(false)}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={e => e.stopPropagation()}
            style={themedStyles.filterModalContent}>
            <View style={themedStyles.filterModalHandle} />
            <View style={themedStyles.filterModalHeader}>
              <Text style={themedStyles.filterModalTitle}>
                {t('events.filterEvents') || 'Filter Events'}
              </Text>
              <TouchableOpacity
                onPress={() => setShowFilterModal(false)}
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                <FontAwesomeIcon icon={faTimes} size={20} color={colors.secondaryText} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Event Type Filter */}
              <View style={themedStyles.filterSection}>
                <Text style={themedStyles.filterSectionTitle}>
                  {t('events.eventType') || 'Event Type'}
                </Text>
                <View style={themedStyles.filterChipsContainer}>
                  {activityOptions.map(option => (
                    <TouchableOpacity
                      key={option.label}
                      style={[
                        themedStyles.filterChip,
                        selectedEventTypes.includes(option.label) &&
                          themedStyles.filterChipSelected,
                      ]}
                      onPress={() => toggleEventType(option.label)}>
                      <Text style={themedStyles.filterChipEmoji}>
                        {option.emoji}
                      </Text>
                      <Text
                        style={[
                          themedStyles.filterChipText,
                          selectedEventTypes.includes(option.label) &&
                            themedStyles.filterChipTextSelected,
                        ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Date Filter */}
              <View style={themedStyles.filterSection}>
                <Text style={themedStyles.filterSectionTitle}>
                  {t('events.dateRange') || 'Date'}
                </Text>
                {dateFilterOptions.map(option => {
                  const isSelected = selectedDateFilter === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        themedStyles.dateFilterOption,
                        isSelected && themedStyles.dateFilterOptionSelected,
                      ]}
                      onPress={() => setSelectedDateFilter(option.value)}>
                      <Text
                        style={[
                          themedStyles.dateFilterOptionText,
                          isSelected &&
                            themedStyles.dateFilterOptionTextSelected,
                        ]}>
                        {option.label}
                      </Text>
                      {isSelected && (
                        <FontAwesomeIcon
                          icon={faCheck}
                          size={14}
                          color={colors.primary}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Available Spots Filter */}
              <View style={themedStyles.filterSection}>
                <Text style={themedStyles.filterSectionTitle}>
                  {t('events.availability') || 'Availability'}
                </Text>
                <TouchableOpacity
                  style={themedStyles.toggleOption}
                  onPress={() => setShowAvailableOnly(!showAvailableOnly)}
                  activeOpacity={0.7}>
                  <Text
                    style={[
                      themedStyles.toggleOptionText,
                      showAvailableOnly &&
                        themedStyles.toggleOptionTextSelected,
                    ]}>
                    {t('events.availableOnly') ||
                      'Show only events with available spots'}
                  </Text>
                  <View
                    style={[
                      themedStyles.toggleCheck,
                      showAvailableOnly && themedStyles.toggleCheckActive,
                    ]}>
                    {showAvailableOnly && (
                      <FontAwesomeIcon
                        icon={faCheck}
                        size={12}
                        color={colors.buttonText || '#fff'}
                      />
                    )}
                  </View>
                </TouchableOpacity>
              </View>

              {/* Past Events Filter */}
              <View style={themedStyles.filterSection}>
                <Text style={themedStyles.filterSectionTitle}>
                  {t('events.pastEvents') || 'Past Events'}
                </Text>
                <TouchableOpacity
                  style={themedStyles.toggleOption}
                  onPress={() => setHidePastEvents(!hidePastEvents)}
                  activeOpacity={0.7}>
                  <Text
                    style={[
                      themedStyles.toggleOptionText,
                      !hidePastEvents && themedStyles.toggleOptionTextSelected,
                    ]}>
                    {t('events.showPastEvents') || 'Show past events'}
                  </Text>
                  <View
                    style={[
                      themedStyles.toggleCheck,
                      !hidePastEvents && themedStyles.toggleCheckActive,
                    ]}>
                    {!hidePastEvents && (
                      <FontAwesomeIcon
                        icon={faCheck}
                        size={12}
                        color={colors.buttonText || '#fff'}
                      />
                    )}
                  </View>
                </TouchableOpacity>
              </View>

              {/* Proximity Filter */}
              <View style={themedStyles.filterSection}>
                <Text style={themedStyles.filterSectionTitle}>Nearby</Text>
                <TouchableOpacity
                  style={themedStyles.toggleOption}
                  onPress={handleEventProximityToggle}
                  disabled={locationLoading}
                  activeOpacity={0.7}>
                  <View style={themedStyles.proximityToggleContent}>
                    {locationLoading ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.primary}
                        style={themedStyles.proximityIconMargin}
                      />
                    ) : (
                      <FontAwesomeIcon
                        icon={faLocationArrow}
                        size={13}
                        color={
                          proximityEnabled ? colors.primary : colors.secondaryText
                        }
                        style={themedStyles.proximityIconMargin}
                      />
                    )}
                    <Text
                      style={[
                        themedStyles.toggleOptionText,
                        proximityEnabled &&
                          themedStyles.toggleOptionTextSelected,
                      ]}>
                      Show events within {proximityRadius} mi
                    </Text>
                  </View>
                  <View
                    style={[
                      themedStyles.toggleCheck,
                      proximityEnabled && themedStyles.toggleCheckActive,
                    ]}>
                    {proximityEnabled && (
                      <FontAwesomeIcon
                        icon={faCheck}
                        size={12}
                        color={colors.buttonText || '#fff'}
                      />
                    )}
                  </View>
                </TouchableOpacity>
                {proximityEnabled && (
                  <View style={themedStyles.proximityDistanceRow}>
                    {[5, 10, 25, 50, 100].map(dist => (
                      <TouchableOpacity
                        key={dist}
                        style={[
                          themedStyles.proximityDistanceChip,
                          proximityRadius === dist
                            ? themedStyles.proximityDistanceChipSelected
                            : themedStyles.proximityDistanceChipDefault,
                        ]}
                        onPress={() => setProximityRadius(dist)}>
                        <Text
                          style={[
                            themedStyles.proximityDistanceText,
                            proximityRadius === dist
                              ? themedStyles.proximityDistanceTextSelected
                              : themedStyles.proximityDistanceTextDefault,
                          ]}>
                          {dist} mi
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={themedStyles.filterButtonsRow}>
              <TouchableOpacity
                style={themedStyles.clearFiltersButton}
                onPress={clearFilters}>
                <Text style={themedStyles.clearFiltersText}>
                  {t('events.clearFilters') || 'Clear All'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={themedStyles.applyFiltersButton}
                onPress={() => setShowFilterModal(false)}>
                <Text style={themedStyles.applyFiltersText}>
                  {t('events.applyFilters') || 'Apply Filters'}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Likes Modal */}
      <Modal
        visible={likesModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLikesModalVisible(false)}>
        <TouchableOpacity
          style={themedStyles.likesModalOverlay}
          activeOpacity={1}
          onPress={() => setLikesModalVisible(false)}>
          <View
            style={themedStyles.likesModalContent}
            onStartShouldSetResponder={() => true}>
            <View style={themedStyles.likesModalHandle} />
            <View style={themedStyles.likesModalHeaderBlock}>
              <View style={themedStyles.likesModalTitleRow}>
                <FontAwesomeIcon
                  icon={faHeart}
                  size={14}
                  color={'#e74c3c'}
                />
                <Text style={themedStyles.likesModalTitle}>
                  {likesModalData.title}
                </Text>
              </View>
              {likesModalData.users.length + likesModalData.anonymousCount >
                0 && (
                <Text style={themedStyles.likesModalCount}>
                  {`${
                    likesModalData.users.length +
                    likesModalData.anonymousCount
                  } ${
                    likesModalData.users.length +
                      likesModalData.anonymousCount ===
                    1
                      ? 'person'
                      : 'people'
                  }`}
                </Text>
              )}
            </View>
            <ScrollView
              style={themedStyles.likesModalScroll}
              showsVerticalScrollIndicator={false}>
              {likesModalData.users.length > 0 ? (
                <>
                  {likesModalData.users.map((user, index) => (
                    <TouchableOpacity
                      key={index}
                      style={themedStyles.likesModalUserRow}
                      onPress={() => {
                        if (user._id) {
                          setLikesModalVisible(false);
                          navigateToProfile(
                            user._id,
                            user.username,
                            user.profilePicUrl,
                          );
                        }
                      }}
                      disabled={!user._id}
                      activeOpacity={user._id ? 0.7 : 1}>
                      {user.profilePicUrl ? (
                        <Image
                          source={{uri: user.profilePicUrl}}
                          style={themedStyles.likesModalAvatar}
                        />
                      ) : (
                        <View style={themedStyles.likesModalAvatarPlaceholder}>
                          <Text style={themedStyles.likesModalAvatarText}>
                            {getInitials(user.username)}
                          </Text>
                        </View>
                      )}
                      <Text
                        style={[
                          themedStyles.likesModalUsername,
                          !!user._id &&
                            themedStyles.likesModalUsernameClickable,
                        ]}>
                        {user.username}
                      </Text>
                      {!!user._id && (
                        <FontAwesomeIcon
                          icon={faChevronRight}
                          size={12}
                          color={colors.secondaryText}
                          style={themedStyles.likesModalChevron}
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                  {likesModalData.anonymousCount > 0 && (
                    <Text style={themedStyles.likesModalAnonymous}>
                      {`and ${likesModalData.anonymousCount} other${
                        likesModalData.anonymousCount === 1 ? '' : 's'
                      }`}
                    </Text>
                  )}
                </>
              ) : likesModalData.anonymousCount > 0 ? (
                <Text style={themedStyles.likesModalAnonymous}>
                  {`${likesModalData.anonymousCount} ${
                    likesModalData.anonymousCount === 1 ? 'person' : 'people'
                  } liked this`}
                </Text>
              ) : (
                <Text style={themedStyles.likesModalEmpty}>No likes yet</Text>
              )}
            </ScrollView>
            <TouchableOpacity
              style={themedStyles.likesModalClose}
              onPress={() => setLikesModalVisible(false)}>
              <Text style={themedStyles.likesModalCloseText}>
                {t('common.close') || 'Close'}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <MapAppPicker
        visible={mapPickerVisible}
        apps={mapPickerApps}
        onSelect={async app => {
          setMapPickerVisible(false);
          await app.open();
        }}
        onClose={() => setMapPickerVisible(false)}
      />
    </SafeAreaView>
  );
};

export default EventList;
