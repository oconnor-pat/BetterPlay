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
import {openDirections} from '../../services/MapLauncher';
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

// Interface for liked by user data
interface LikedByUser {
  _id: string;
  username: string;
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
  const {colors} = useTheme();
  const {t} = useTranslation();
  const {badgeCount, hasPermission, requestPermission, settings} =
    useNotifications();
  const {subscribe: socketSubscribe} = useSocket();

  const themedStyles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          padding: 16,
          backgroundColor: colors.background,
        },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          paddingTop: 8,
          backgroundColor: colors.background,
          zIndex: 1,
        },
        headerSide: {
          flexDirection: 'row',
          alignItems: 'center',
          width: 90,
        },
        title: {
          fontSize: 25,
          fontWeight: '700',
          color: colors.primary,
          textAlign: 'center',
          flex: 1,
        },
        card: {
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 20,
          marginBottom: 20,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border + '80',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 2},
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 3,
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
          justifyContent: 'center',
          padding: 16,
        },
        modalView: {
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 20,
          paddingTop: 16,
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 4},
          shadowOpacity: 0.25,
          shadowRadius: 12,
          elevation: 8,
          maxHeight: '85%',
        },
        modalFormScroll: {
          flexGrow: 0,
        },
        modalHeader: {
          color: colors.text,
          fontSize: 22,
          marginBottom: 16,
          textAlign: 'center',
          fontWeight: '700',
        },
        modalLabel: {
          color: colors.text,
          fontSize: 14,
          fontWeight: '600',
          marginBottom: 8,
          marginLeft: 4,
        },
        modalInput: {
          backgroundColor: colors.inputBackground || colors.background,
          color: colors.text,
          padding: 12,
          marginBottom: 12,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          fontSize: 15,
        },
        autocompleteContainer: {
          marginBottom: 12,
          zIndex: 1000,
        },
        saveButton: {
          backgroundColor: colors.primary,
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 10,
          marginVertical: 4,
          flex: 1,
          alignItems: 'center',
          marginHorizontal: 5,
          minWidth: 90,
          shadowColor: colors.primary,
          shadowOffset: {width: 0, height: 2},
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 3,
        },
        cancelButton: {
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderColor: colors.error || '#b11313',
          shadowOpacity: 0,
          elevation: 0,
        },
        buttonText: {
          color: colors.buttonText || '#fff',
          textAlign: 'center',
          fontWeight: '700',
          fontSize: 16,
        },
        cancelButtonText: {
          color: colors.error || '#b11313',
        },
        buttonContainer: {
          flexDirection: 'row',
          justifyContent: 'center',
          marginTop: 16,
          alignItems: 'center',
        },
        confirmButton: {
          color: colors.buttonText || '#fff',
          textAlign: 'center',
          marginTop: 8,
          marginBottom: 12,
          fontSize: 15,
          fontWeight: '600',
          backgroundColor: colors.primary,
          paddingVertical: 8,
          paddingHorizontal: 16,
          borderRadius: 8,
          overflow: 'hidden',
        },
        pickerContainer: {
          backgroundColor: colors.inputBackground || colors.background,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: 8,
          overflow: 'hidden',
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
          borderRadius: 20,
          paddingHorizontal: 14,
          marginBottom: 16,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        searchInput: {
          flex: 1,
          paddingVertical: 12,
          paddingHorizontal: 8,
          fontSize: 16,
          color: colors.text,
        },
        searchIcon: {
          marginRight: 4,
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
        },
        noResultsText: {
          color: colors.text,
          fontSize: 16,
          opacity: 0.7,
          textAlign: 'center',
        },
        noResultsSubtext: {
          color: colors.text,
          fontSize: 14,
          opacity: 0.5,
          textAlign: 'center',
          marginTop: 8,
        },
        ctaButton: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.primary,
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderRadius: 25,
          marginTop: 20,
          gap: 8,
        },
        ctaButtonText: {
          color: '#fff',
          fontSize: 16,
          fontWeight: '600',
        },
        filterButton: {
          padding: 8,
          marginLeft: 8,
          position: 'relative',
        },
        filterBadge: {
          position: 'absolute',
          top: 0,
          right: 0,
          backgroundColor: colors.error || '#e74c3c',
          borderRadius: 10,
          minWidth: 18,
          height: 18,
          justifyContent: 'center',
          alignItems: 'center',
        },
        filterBadgeText: {
          color: '#fff',
          fontSize: 11,
          fontWeight: 'bold',
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
          paddingTop: 20,
          paddingHorizontal: 20,
          paddingBottom: 40,
          maxHeight: '80%',
        },
        filterModalHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        },
        filterModalTitle: {
          fontSize: 20,
          fontWeight: '700',
          color: colors.text,
        },
        filterSection: {
          marginBottom: 20,
        },
        filterSectionTitle: {
          fontSize: 16,
          fontWeight: '600',
          color: colors.text,
          marginBottom: 12,
        },
        filterChipsContainer: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          marginHorizontal: -4,
        },
        filterChip: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
          margin: 4,
        },
        filterChipSelected: {
          backgroundColor: colors.primary + '20',
          borderColor: colors.primary,
          borderWidth: 1.5,
        },
        filterChipText: {
          fontSize: 14,
          color: colors.text,
          marginLeft: 6,
        },
        filterChipTextSelected: {
          color: colors.primary,
          fontWeight: '600',
        },
        filterChipEmoji: {
          fontSize: 16,
        },
        dateFilterOption: {
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
          marginBottom: 8,
        },
        dateFilterOptionSelected: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
        dateFilterOptionText: {
          fontSize: 15,
          color: colors.text,
        },
        dateFilterOptionTextSelected: {
          color: colors.buttonText || '#fff',
          fontWeight: '600',
        },
        toggleOption: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
        },
        toggleOptionSelected: {
          backgroundColor: colors.primary + '20',
          borderColor: colors.primary,
          borderWidth: 1.5,
        },
        toggleOptionText: {
          fontSize: 15,
          color: colors.text,
        },
        toggleOptionTextSelected: {
          color: colors.primary,
          fontWeight: '600',
        },
        filterButtonsRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: 20,
          gap: 12,
        },
        clearFiltersButton: {
          flex: 1,
          paddingVertical: 14,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: colors.error || '#e74c3c',
          alignItems: 'center',
        },
        clearFiltersText: {
          color: colors.error || '#e74c3c',
          fontWeight: '600',
          fontSize: 16,
        },
        applyFiltersButton: {
          flex: 1,
          paddingVertical: 14,
          borderRadius: 12,
          backgroundColor: colors.primary,
          alignItems: 'center',
        },
        applyFiltersText: {
          color: colors.buttonText || '#fff',
          fontWeight: '600',
          fontSize: 16,
        },
        noResultsIcon: {
          marginBottom: 16,
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
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
        },
        jerseyColorTitle: {
          color: colors.text,
          fontSize: 14,
          fontWeight: '600',
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
          backgroundColor: colors.card,
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.border,
          minWidth: 100,
        },
        jerseyColorOptionSelected: {
          borderColor: colors.primary,
          borderWidth: 2,
          backgroundColor: colors.primary + '15',
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
          gap: 8,
        },
        activeFilterTag: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.primary + '20',
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 16,
          marginRight: 8,
          marginBottom: 4,
        },
        activeFilterTagText: {
          color: colors.primary,
          fontSize: 13,
          fontWeight: '500',
          marginRight: 6,
        },
        // Horizontal filter chip bar (compact pills)
        chipBarContainer: {
          marginBottom: 12,
          minHeight: 50,
          zIndex: 100,
          backgroundColor: colors.background,
          elevation: 10,
          flexShrink: 0,
          overflow: 'visible',
        },
        chipBarContent: {
          paddingHorizontal: 4,
          paddingVertical: 8,
          gap: 10,
          alignItems: 'center',
        },
        chip: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 6,
          paddingHorizontal: 12,
          borderRadius: 18,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          height: 36,
        },
        chipActive: {
          backgroundColor: colors.primary + '18',
          borderColor: colors.primary,
          borderWidth: 1.5,
        },
        chipEmoji: {
          fontSize: 15,
          marginRight: 5,
        },
        chipText: {
          fontSize: 13,
          fontWeight: '500',
          color: colors.secondaryText,
        },
        chipTextActive: {
          color: colors.primary,
          fontWeight: '600',
        },
        searchFilterRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 12,
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
          fontSize: 13,
          fontWeight: '600',
          color: colors.text,
          marginBottom: 8,
        },
        privacyOptions: {
          flexDirection: 'row',
          gap: 8,
        },
        privacyOption: {
          flex: 1,
          alignItems: 'center',
          backgroundColor: colors.inputBackground || colors.background,
          paddingVertical: 10,
          paddingHorizontal: 8,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.border,
        },
        privacyOptionSelected: {
          borderColor: colors.primary,
          borderWidth: 2,
          backgroundColor: colors.primary + '10',
        },
        privacyOptionTextContainer: {
          alignItems: 'center',
          marginTop: 6,
        },
        privacyOptionLabel: {
          fontSize: 12,
          fontWeight: '600',
          color: colors.text,
          textAlign: 'center',
        },
        privacyOptionLabelSelected: {
          color: colors.primary,
        },
        privacyOptionDescription: {
          fontSize: 10,
          color: colors.secondaryText,
          marginTop: 2,
          textAlign: 'center',
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
          marginBottom: 16,
        },
        inviteSearchContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.inputBackground || colors.background,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 12,
          marginBottom: 8,
        },
        inviteSearchIcon: {
          marginRight: 8,
        },
        inviteSearchInput: {
          flex: 1,
          paddingVertical: 12,
          fontSize: 14,
          color: colors.text,
        },
        inviteSearchResults: {
          backgroundColor: colors.card,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: 12,
          maxHeight: 150,
        },
        inviteSearchResultRow: {
          flexDirection: 'row',
          alignItems: 'center',
          padding: 10,
          borderBottomWidth: 1,
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
          fontWeight: '600',
        },
        inviteUserName: {
          flex: 1,
          fontSize: 14,
          color: colors.text,
        },
        invitedUsersList: {
          marginTop: 8,
        },
        invitedUsersLabel: {
          fontSize: 13,
          fontWeight: '600',
          color: colors.text,
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
          backgroundColor: colors.primary + '20',
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 16,
          gap: 6,
        },
        invitedUserChipText: {
          fontSize: 13,
          color: colors.primary,
          fontWeight: '500',
        },
        inviteHint: {
          fontSize: 12,
          color: colors.secondaryText,
          fontStyle: 'italic',
          marginTop: 4,
        },
        // Likes modal styles
        likesModalOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.55)',
          justifyContent: 'flex-end',
        },
        likesModalContent: {
          backgroundColor: colors.card,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingHorizontal: 20,
          paddingBottom: Platform.OS === 'ios' ? 36 : 20,
          maxHeight: '55%',
        },
        likesModalHandle: {
          alignSelf: 'center',
          width: 40,
          height: 5,
          borderRadius: 3,
          backgroundColor: colors.border,
          marginTop: 10,
          marginBottom: 16,
        },
        likesModalHeaderRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          gap: 8,
        },
        likesModalTitle: {
          fontSize: 18,
          fontWeight: '700',
          color: colors.text,
        },
        likesModalScroll: {
          maxHeight: 320,
        },
        likesModalUserRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        likesModalAvatar: {
          width: 42,
          height: 42,
          borderRadius: 21,
          marginRight: 14,
        },
        likesModalAvatarPlaceholder: {
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: colors.primary,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 14,
        },
        likesModalAvatarText: {
          color: '#fff',
          fontSize: 15,
          fontWeight: '700',
        },
        likesModalUsername: {
          fontSize: 15,
          color: colors.text,
          flex: 1,
          fontWeight: '500',
        },
        likesModalUsernameClickable: {
          color: colors.primary,
        },
        likesModalChevron: {
          marginLeft: 8,
          opacity: 0.4,
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
          color: colors.placeholder || '#888',
          fontSize: 14,
          paddingVertical: 24,
        },
        likesModalClose: {
          marginTop: 16,
          paddingVertical: 12,
          backgroundColor: colors.primary,
          borderRadius: 12,
          alignItems: 'center',
        },
        likesModalCloseText: {
          color: '#fff',
          fontWeight: '700',
          fontSize: 15,
        },
        watchModalCard: {
          backgroundColor: colors.card,
          borderRadius: 14,
          padding: 16,
        },
        watchModalTitle: {
          color: colors.text,
          fontSize: 20,
          fontWeight: '700',
          marginBottom: 4,
        },
        watchModalSubtitle: {
          color: colors.secondaryText,
          fontSize: 13,
          marginBottom: 14,
        },
        watchOptionRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 10,
        },
        watchOptionInfo: {
          flex: 1,
          paddingRight: 10,
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
        },
        watchOptionDivider: {
          height: 1,
          backgroundColor: colors.border,
        },
        watchModalFooter: {
          flexDirection: 'row',
          marginTop: 14,
          gap: 10,
        },
        watchSecondaryButton: {
          flex: 1,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: 12,
          alignItems: 'center',
        },
        watchSecondaryButtonText: {
          color: colors.text,
          fontWeight: '600',
          fontSize: 14,
        },
        watchDangerButton: {
          borderColor: colors.error || '#e74c3c',
          backgroundColor: (colors.error || '#e74c3c') + '14',
        },
        watchDangerButtonText: {
          color: colors.error || '#e74c3c',
        },
        watchPrimaryButton: {
          flex: 1,
          borderRadius: 10,
          backgroundColor: colors.primary,
          paddingVertical: 12,
          alignItems: 'center',
        },
        watchPrimaryButtonText: {
          color: colors.buttonText || '#fff',
          fontWeight: '700',
          fontSize: 14,
        },
        watchGlobalMutedNote: {
          marginTop: 12,
          color: colors.secondaryText,
          fontSize: 12,
          lineHeight: 18,
        },
        recurrenceSection: {
          backgroundColor: colors.inputBackground || colors.background,
          borderRadius: 12,
          padding: 14,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: colors.border,
        },
        recurrenceToggleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        recurrenceLabel: {
          color: colors.text,
          fontSize: 15,
          fontWeight: '600',
        },
        recurrenceDescription: {
          color: colors.secondaryText,
          fontSize: 12,
          marginTop: 2,
        },
        recurrenceOptions: {
          marginTop: 14,
          paddingTop: 14,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        recurrenceSubLabel: {
          color: colors.text,
          fontSize: 13,
          fontWeight: '600',
          marginBottom: 8,
        },
        recurrenceFrequencyRow: {
          flexDirection: 'row',
          gap: 8,
        },
        recurrenceFrequencyOption: {
          flex: 1,
          alignItems: 'center',
          paddingVertical: 10,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
        },
        recurrenceFrequencySelected: {
          borderColor: colors.primary,
          borderWidth: 2,
          backgroundColor: colors.primary + '10',
        },
        recurrenceFrequencyText: {
          color: colors.text,
          fontSize: 13,
          fontWeight: '600',
        },
        recurrenceFrequencyTextSelected: {
          color: colors.primary,
        },
        recurrenceCountScroll: {
          flexGrow: 0,
          marginBottom: 10,
        },
        recurrenceCountOption: {
          width: 44,
          height: 44,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 8,
        },
        recurrenceCountSelected: {
          borderColor: colors.primary,
          borderWidth: 2,
          backgroundColor: colors.primary + '10',
        },
        recurrenceCountText: {
          color: colors.text,
          fontSize: 15,
          fontWeight: '600',
        },
        recurrenceCountTextSelected: {
          color: colors.primary,
        },
        recurrenceSummary: {
          color: colors.secondaryText,
          fontSize: 12,
          fontStyle: 'italic',
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
          marginTop: 10,
        },
        proximityDistanceChip: {
          paddingHorizontal: 14,
          paddingVertical: 7,
          borderRadius: 16,
          borderWidth: 1,
        },
        proximityDistanceChipSelected: {
          backgroundColor: colors.primary + '20',
          borderColor: colors.primary,
        },
        proximityDistanceChipDefault: {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        proximityDistanceText: {
          fontSize: 13,
          fontWeight: '600',
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
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        fontSize: 16,
      },
      listView: {
        backgroundColor: colors.card || '#fff',
        borderColor: colors.border,
        borderWidth: 1,
        borderTopWidth: 0,
        borderRadius: 8,
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        maxHeight: 200,
      },
      row: {
        backgroundColor: colors.card || '#fff',
        padding: 13,
        minHeight: 44,
        flexDirection: 'row' as const,
      },
      separator: {
        height: 0.5,
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
      // Filter users by search query (exclude current user and already invited)
      const filteredUsers = allUsers.filter(
        (user: LikedByUser) =>
          user.username.toLowerCase().includes(query.toLowerCase()) &&
          user._id !== userData?._id &&
          !newEvent.invitedUsers.includes(user._id),
      );
      setAvailableUsersToInvite(
        filteredUsers.slice(0, 10).map((user: LikedByUser) => ({
          _id: user._id,
          username: user.username,
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
    let watchButtonLabel = 'Watch Event';
    if (isWatching) {
      watchButtonLabel = 'Watching';
    } else if (isEventFull) {
      watchButtonLabel = 'Watch for Spots';
    }

    return (
      <View style={[themedStyles.card, isPast && themedStyles.pastEventCard]}>
        <TouchableOpacity
          onPress={() => handleEventPress(item)}
          activeOpacity={0.9}>
          {/* Past Event Badge */}
          {isPast && (
            <View style={themedStyles.pastEventBadge}>
              <Text style={themedStyles.pastEventBadgeText}>
                {t('events.past') || 'Past'}
              </Text>
            </View>
          )}

          {/* Header: Name + Creator */}
          <View style={themedStyles.cardHeaderSection}>
            <View style={themedStyles.cardRow}>
              <Text style={themedStyles.cardEmoji}>
                {getEventTypeEmoji(item.eventType)}
              </Text>
              <Text style={themedStyles.cardTitle}>{item.name}</Text>
              {item.privacy && item.privacy !== 'public' && (
                <View style={themedStyles.privacyBadge}>
                  <FontAwesomeIcon
                    icon={item.privacy === 'private' ? faLock : faEnvelope}
                    size={12}
                    color={colors.secondaryText}
                  />
                  <Text style={themedStyles.privacyBadgeText}>
                    {item.privacy === 'private' ? 'Private' : 'Invite Only'}
                  </Text>
                </View>
              )}
              {item.isRecurring && (
                <View style={themedStyles.recurringBadge}>
                  <FontAwesomeIcon
                    icon={faRotate}
                    size={10}
                    color={colors.primary}
                  />
                  <Text style={themedStyles.recurringBadgeText}>Recurring</Text>
                </View>
              )}
            </View>
            {item.createdByUsername && (
              <View style={themedStyles.creatorRow}>
                <Text style={themedStyles.eventUsername}>
                  {t('events.createdBy')} {item.createdByUsername}
                </Text>
                {item.createdAt && (
                  <Text style={themedStyles.eventTimestamp}>
                    {formatRelativeTime(item.createdAt)}
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Details: Location, Date/Time, Roster */}
          <View style={themedStyles.cardDetailsSection}>
            <View style={themedStyles.cardRow}>
              <Text style={themedStyles.cardEmoji}>📍</Text>
              <Text style={themedStyles.cardText}>{item.location}</Text>
            </View>
            <View style={themedStyles.cardRow}>
              <Text style={themedStyles.cardEmoji}>🗓️</Text>
              <Text style={themedStyles.cardText}>
                {item.date} @ {formatDisplayTime(item.time)}
              </Text>
            </View>
            <View style={themedStyles.cardRow}>
              <Text style={themedStyles.cardEmoji}>👥</Text>
              <Text style={themedStyles.cardText}>
                {item.rosterSpotsFilled} / {item.totalSpots}{' '}
                {t('events.playersJoined')}
              </Text>
            </View>
          </View>

          {/* Countdown Timer */}
          {!isPast && (
            <CountdownTimer eventDate={item.date} eventTime={item.time} />
          )}
        </TouchableOpacity>

        {/* Spacer */}
        <View style={themedStyles.cardSpacer} />

        {/* Interactive Map View */}
        <TouchableOpacity
          style={themedStyles.mapBox}
          onPress={() => openMapsForEvent(item, t)}
          activeOpacity={0.7}>
          {(() => {
            // Use exact coordinates if available, otherwise use location lookup
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
                style={themedStyles.mapView}
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
          <View style={themedStyles.mapOverlay}>
            <Text style={themedStyles.mapText}>📍 {item.location}</Text>
            <Text style={themedStyles.mapSubtext}>
              {t('events.tapToOpenMaps')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Spacer */}
        <View style={themedStyles.cardSpacer} />

        {/* Action Buttons */}
        <View style={themedStyles.actionRow}>
          <TouchableOpacity
            style={[
              themedStyles.actionButton,
              isWatching && themedStyles.watchButtonWatched,
            ]}
            onPress={() => openWatchModal(item)}>
            <FontAwesomeIcon
              icon={faBell}
              size={16}
              color={isWatching ? colors.primary : colors.primary}
              style={themedStyles.actionButtonIcon}
            />
            <Text
              style={[
                themedStyles.actionButtonText,
                isWatching && themedStyles.watchButtonTextWatched,
              ]}>
              {watchButtonLabel}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[themedStyles.actionButton, themedStyles.joinButton]}
            onPress={() => openMapsForEvent(item, t)}>
            <FontAwesomeIcon
              icon={faLocationArrow}
              size={16}
              color={colors.buttonText || '#fff'}
              style={themedStyles.actionButtonIcon}
            />
            <Text
              style={[
                themedStyles.actionButtonText,
                themedStyles.joinButtonText,
              ]}>
              {t('events.getDirections')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Share/Discuss/Like/Settings/Delete Icons */}
        <View style={themedStyles.iconContainer}>
          {/* Like Button with Count Badge */}
          <TouchableOpacity
            style={themedStyles.likeButtonContainer}
            onPress={() => toggleEventLike(item)}
            onLongPress={() =>
              (item.likes?.length || 0) > 0 && showEventLikedBy(item)
            }>
            <FontAwesomeIcon
              icon={faHeart}
              size={18}
              color={
                likedEvents.has(item._id) ? '#e74c3c' : colors.secondaryText
              }
            />
            {(item.likes?.length || 0) > 0 && (
              <View style={themedStyles.iconCountBadge}>
                <Text style={themedStyles.iconCountBadgeText}>
                  {item.likes!.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={themedStyles.iconButton}
            onPress={() => handleShareEvent(item)}>
            <FontAwesomeIcon
              icon={faShareAlt}
              size={18}
              color={colors.primary}
            />
          </TouchableOpacity>
          {/* Comment Button with Count Badge */}
          <View style={themedStyles.commentButtonContainer}>
            <TouchableOpacity
              style={[
                themedStyles.iconButton,
                isCommentsExpanded && {backgroundColor: colors.primary + '20'},
              ]}
              onPress={() => handleDiscussEvent(item)}>
              <FontAwesomeIcon
                icon={faComments}
                size={18}
                color={colors.primary}
              />
            </TouchableOpacity>
            {(localCommentCounts[item._id] ?? item.commentCount ?? 0) > 0 && (
              <View style={themedStyles.iconCountBadge}>
                <Text style={themedStyles.iconCountBadgeText}>
                  {localCommentCounts[item._id] ?? item.commentCount ?? 0}
                </Text>
              </View>
            )}
          </View>
          {userData?._id === item.createdBy && (
            <TouchableOpacity
              style={themedStyles.iconButton}
              onPress={() => handleEditEvent(item)}>
              <FontAwesomeIcon icon={faCog} size={18} color={colors.text} />
            </TouchableOpacity>
          )}
          {userData?._id === item.createdBy && (
            <TouchableOpacity
              style={themedStyles.iconButton}
              onPress={() => handleDeleteEvent(item)}>
              <FontAwesomeIcon
                icon={faTrash}
                size={18}
                color={colors.error || '#e74c3c'}
              />
            </TouchableOpacity>
          )}
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
            size={18}
            color={colors.placeholder || '#888'}
            style={themedStyles.searchIcon}
          />
          <TextInput
            style={themedStyles.searchInput}
            placeholder={t('events.searchPlaceholder') || 'Search events...'}
            placeholderTextColor={colors.placeholder || '#888'}
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
                size={18}
                color={colors.placeholder || '#888'}
              />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={themedStyles.filterButton}
          onPress={() => setShowFilterModal(true)}>
          <FontAwesomeIcon
            icon={faFilter}
            size={20}
            color={activeFilterCount > 0 ? colors.primary : colors.text}
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
                  size={12}
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
                  size={12}
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
                  size={12}
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
                  size={12}
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
                <FontAwesomeIcon
                  icon={faPlus}
                  size={48}
                  color={colors.border}
                  style={themedStyles.noResultsIcon}
                />
                <Text style={themedStyles.noResultsText}>
                  {searchQuery
                    ? t('common.noResults')
                    : activeFilterCount > 0
                    ? t('events.noMatchingEvents') || 'No matching events'
                    : t('events.noEvents')}
                </Text>
                {searchQuery ? (
                  <Text style={themedStyles.noResultsSubtext}>
                    {t('events.tryDifferentSearch') ||
                      'Try a different search term'}
                  </Text>
                ) : activeFilterCount > 0 ? (
                  <>
                    <Text style={themedStyles.noResultsSubtext}>
                      {t('events.tryDifferentFilter') ||
                        'Try a different filter or clear your current filters'}
                    </Text>
                    <TouchableOpacity
                      style={themedStyles.ctaButton}
                      onPress={clearFilters}>
                      <FontAwesomeIcon icon={faTimes} size={16} color="#fff" />
                      <Text style={themedStyles.ctaButtonText}>
                        {t('events.clearFilters') || 'Clear Filters'}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : showFirstTimeHint ? (
                  <>
                    <Text style={themedStyles.noResultsSubtext}>
                      {t('events.noEventsSubtext') ||
                        'Create your first event and invite others to join!'}
                    </Text>
                    <TouchableOpacity
                      style={themedStyles.ctaButton}
                      onPress={() => {
                        dismissFirstTimeHint();
                        setPlacesApiFailed(false);
                        setModalVisible(true);
                      }}>
                      <FontAwesomeIcon icon={faPlus} size={16} color="#fff" />
                      <Text style={themedStyles.ctaButtonText}>
                        {t('events.createFirstEvent') ||
                          'Create Your First Event'}
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
              <Text style={themedStyles.modalHeader}>
                {isEditing
                  ? `✏️ ${t('events.editEvent')}`
                  : `🎉 ${t('events.createEvent')}`}
              </Text>

              <ScrollView
                style={themedStyles.modalFormScroll}
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
                      themeVariant="dark"
                      accentColor={colors.primary}
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
                          false: '#767577',
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
                                  {getInitials(user.username)}
                                </Text>
                              </View>
                            )}
                            <Text style={themedStyles.inviteUserName}>
                              {user.username}
                            </Text>
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
                                {user.username}
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
            style={themedStyles.watchModalCard}>
            <Text style={themedStyles.watchModalTitle}>
              {watchedEventIds.has(watchTargetEvent?._id || '')
                ? 'Update Watch Settings'
                : 'Watch This Event'}
            </Text>
            <Text style={themedStyles.watchModalSubtitle}>
              {watchTargetEvent?.name || ''}
            </Text>

            <View style={themedStyles.watchOptionRow}>
              <View style={themedStyles.watchOptionInfo}>
                <Text style={themedStyles.watchOptionTitle}>Spots Opened</Text>
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
                trackColor={{false: '#767577', true: colors.primary}}
              />
            </View>
            <View style={themedStyles.watchOptionDivider} />

            <View style={themedStyles.watchOptionRow}>
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
                trackColor={{false: '#767577', true: colors.primary}}
              />
            </View>
            <View style={themedStyles.watchOptionDivider} />

            <View style={themedStyles.watchOptionRow}>
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
                trackColor={{false: '#767577', true: colors.primary}}
              />
            </View>
            <View style={themedStyles.watchOptionDivider} />

            <View style={themedStyles.watchOptionRow}>
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
                trackColor={{false: '#767577', true: colors.primary}}
              />
            </View>

            {(!settings.enabled || !settings.watchedEvents) && (
              <Text style={themedStyles.watchGlobalMutedNote}>
                Global notification settings are currently muting watched-event
                alerts. You can turn them on in Notification Settings.
              </Text>
            )}

            <View style={themedStyles.watchModalFooter}>
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
                  <ActivityIndicator size="small" color="#fff" />
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
            <View style={themedStyles.filterModalHeader}>
              <Text style={themedStyles.filterModalTitle}>
                {t('events.filterEvents') || 'Filter Events'}
              </Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <FontAwesomeIcon icon={faTimes} size={24} color={colors.text} />
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
                {dateFilterOptions.map(option => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      themedStyles.dateFilterOption,
                      selectedDateFilter === option.value &&
                        themedStyles.dateFilterOptionSelected,
                    ]}
                    onPress={() => setSelectedDateFilter(option.value)}>
                    <Text
                      style={[
                        themedStyles.dateFilterOptionText,
                        selectedDateFilter === option.value &&
                          themedStyles.dateFilterOptionTextSelected,
                      ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Available Spots Filter */}
              <View style={themedStyles.filterSection}>
                <Text style={themedStyles.filterSectionTitle}>
                  {t('events.availability') || 'Availability'}
                </Text>
                <TouchableOpacity
                  style={[
                    themedStyles.toggleOption,
                    showAvailableOnly && themedStyles.toggleOptionSelected,
                  ]}
                  onPress={() => setShowAvailableOnly(!showAvailableOnly)}>
                  <Text
                    style={[
                      themedStyles.toggleOptionText,
                      showAvailableOnly &&
                        themedStyles.toggleOptionTextSelected,
                    ]}>
                    {t('events.availableOnly') ||
                      'Show only events with available spots'}
                  </Text>
                  {showAvailableOnly && (
                    <Text style={{color: colors.buttonText || '#fff'}}>✓</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Past Events Filter */}
              <View style={themedStyles.filterSection}>
                <Text style={themedStyles.filterSectionTitle}>
                  {t('events.pastEvents') || 'Past Events'}
                </Text>
                <TouchableOpacity
                  style={[
                    themedStyles.toggleOption,
                    !hidePastEvents && themedStyles.toggleOptionSelected,
                  ]}
                  onPress={() => setHidePastEvents(!hidePastEvents)}>
                  <Text
                    style={[
                      themedStyles.toggleOptionText,
                      !hidePastEvents && themedStyles.toggleOptionTextSelected,
                    ]}>
                    {t('events.showPastEvents') || 'Show past events'}
                  </Text>
                  {!hidePastEvents && (
                    <Text style={{color: colors.buttonText || '#fff'}}>✓</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Proximity Filter */}
              <View style={themedStyles.filterSection}>
                <Text style={themedStyles.filterSectionTitle}>Nearby</Text>
                <TouchableOpacity
                  style={[
                    themedStyles.toggleOption,
                    proximityEnabled && themedStyles.toggleOptionSelected,
                  ]}
                  onPress={handleEventProximityToggle}
                  disabled={locationLoading}>
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
                        size={14}
                        color={
                          proximityEnabled
                            ? colors.buttonText || '#fff'
                            : colors.text
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
                  {proximityEnabled && (
                    <Text style={{color: colors.buttonText || '#fff'}}>✓</Text>
                  )}
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
            <View style={themedStyles.likesModalHeaderRow}>
              <FontAwesomeIcon
                icon={faHeart}
                size={18}
                color={colors.primary}
              />
              <Text style={themedStyles.likesModalTitle}>
                {likesModalData.title}
              </Text>
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
              <Text style={themedStyles.likesModalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

export default EventList;
