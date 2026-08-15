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
  faComment,
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
  faUserGroup,
  faCheck,
  faPenToSquare,
  faUserPlus,
  faBuilding,
  faQuestion,
} from '@fortawesome/free-solid-svg-icons';
import {
  useNavigation,
  NavigationProp,
  useRoute,
  RouteProp,
} from '@react-navigation/native';
import HamburgerMenu from '../HamburgerMenu/HamburgerMenu';
import UserContext, {UserContextType} from '../UserContext';
import GroupPickerModal from '../Groups/GroupPickerModal';
import RosterAvatarStrip from '../shared/RosterAvatarStrip';
import {Group} from '../../types/group';
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
  formatEventTimeRange,
  getEventDateTime,
  isEventActive,
  isEventPast,
  parseEventDateLocal,
} from '../../utils/eventDateTime';
import {AvailableMapApp, openDirections} from '../../services/MapLauncher';
import MapAppPicker from '../MapAppPicker/MapAppPicker';
import eventWatchService, {
  EventWatchPreferences,
} from '../../services/EventWatchService';
import EmojiPicker, {type EmojiType} from 'rn-emoji-keyboard';

// Optional prefill payload sent from the Venues tab via the "Plan event
// here" bridge. Any subset of these fields is OK — anything missing falls
// back to the empty-event defaults so the user can still fill it in.
export interface PrefillEvent {
  name?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  date?: string;
  time?: string;
  eventType?: string;
  // Venue listing reference (Google Place ID + cached display fields).
  venueId?: string;
  venueName?: string;
  sourceUrl?: string;
}

export type RootStackParamList = {
  EventList:
    | {
        highlightEventId?: string;
        expandComments?: boolean;
        profileFilter?: 'created' | 'joined' | 'upcoming';
        userId?: string;
        prefillEvent?: PrefillEvent;
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
    description: 'Anyone can find it; you approve who joins',
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
  // Human-readable address. Optional because a gated public event is served
  // redacted: the backend withholds the address (and coordinates) until the
  // host approves you, unless they enabled `showLocationPublicly`. Treat it as
  // possibly-absent anywhere an event might be gated.
  location?: string;
  time: string;
  // How long the event runs. Absent on events created before durations
  // existed, in which case only a start time is shown.
  durationMinutes?: number;
  date: string;
  rosterSpotsFilled: number;
  totalSpots: number;
  eventType: string;
  createdBy: string;
  createdByUsername?: string;
  createdByProfilePicUrl?: string;
  createdAt?: string;
  // Superseded by `reactions`; the server still sends it so clients older than
  // the reactions release keep working. Read `reactions` instead.
  likes?: string[];
  reactions?: Array<{userId: string; emoji: string}>;
  latitude?: number;
  longitude?: number;
  isVirtual?: boolean;
  jerseyColors?: string[];
  description?: string;
  privacy?: EventPrivacy;
  invitedUsers?: string[];
  // Public-event creator controls. When `allowJoinRequests` is false the card
  // shows "not accepting requests" instead of the join button; when
  // `showLocationPublicly` is true the location/map is revealed on the gated
  // public teaser instead of being hidden until approval.
  allowJoinRequests?: boolean;
  showLocationPublicly?: boolean;
  commentCount?: number;
  isRecurring?: boolean;
  recurrenceGroupId?: string;
  recurrenceFrequency?: RecurrenceFrequency;
  recurrenceIndefinite?: boolean;
  waitlist?: Array<{
    userId: string;
    username: string;
    profilePicUrl?: string;
    joinedAt: string;
  }>;
  // People who are "going" (on the roster). Present on list responses so the
  // card can show the current user's RSVP state and the going count.
  roster?: Array<{
    userId?: string;
    username: string;
    profilePicUrl?: string;
    paidStatus?: string;
  }>;
  // "Maybe"/"can't make it" replies. "Going" is represented by roster
  // membership, so this only ever holds the other two states.
  rsvps?: Array<{
    userId: string;
    username: string;
    profilePicUrl?: string;
    status: 'maybe' | 'cant';
    respondedAt?: string;
  }>;
  // Pending requests to join a gated public event (only sent to the creator).
  joinRequests?: Array<{
    userId: string;
    username: string;
    profilePicUrl?: string;
    requestedAt?: string;
  }>;
  // True when the server redacted this public event's details because the
  // viewer hasn't been approved yet — the card renders a locked teaser.
  isGated?: boolean;
  // The viewer's own request state on a gated public event.
  myJoinRequestStatus?: 'none' | 'pending';
  // Optional venue listing reference (set when an event was planned from
  // the Venues tab). Mirrors the BE Event model fields added in PR 1.
  venueId?: string;
  venueName?: string;
  // Optional Group attached at event creation. Drives the group-name
  // badge on event cards and (for recurring events) the live link that
  // re-pulls members per instance — see PR 3.
  groupId?: string;
  groupName?: string;
  // Compact member preview (capped at 5) computed server-side for any
  // event with a groupId. Powers the avatar strip next to the
  // group-name badge on the event card.
  groupMembersPreview?: Array<{
    userId: string;
    username?: string;
    name?: string;
    profilePicUrl?: string;
  }>;
  sourceUrl?: string;
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

const DURATION_OPTIONS: {label: string; minutes: number | null}[] = [
  {label: '30m', minutes: 30},
  {label: '1h', minutes: 60},
  {label: '90m', minutes: 90},
  {label: '2h', minutes: 120},
  {label: '3h', minutes: 180},
  {label: '4h', minutes: 240},
  {label: '6h', minutes: 360},
  // null = open-ended: start time only, no derived end. Matches the
  // backend treating a missing duration as "unknown length".
  {label: 'Open', minutes: null},
];
const DEFAULT_DURATION_MINUTES = 60;

const createEmptyEvent = () => ({
  name: '',
  location: '',
  time: '',
  durationMinutes: DEFAULT_DURATION_MINUTES as number | null,
  date: '',
  totalSpots: '',
  eventType: '',
  latitude: undefined as number | undefined,
  longitude: undefined as number | undefined,
  isVirtual: false,
  jerseyColors: [] as string[],
  privacy: 'public' as EventPrivacy,
  invitedUsers: [] as string[],
  allowJoinRequests: true,
  showLocationPublicly: false,
  isRecurring: false,
  recurrenceFrequency: 'weekly' as RecurrenceFrequency,
  recurrenceCount: 4,
  recurrenceIndefinite: false,
  // Optional venue listing reference set by the Venues-tab bridge.
  venueId: undefined as string | undefined,
  venueName: undefined as string | undefined,
  // Optional Group attached via the "Invite a group" picker. The group's
  // members are snapshotted into `invitedUsers`; `groupId`/`groupName`
  // travel with the event as origin metadata (and, for recurring events,
  // as a live link maintained by PR 3 backend logic).
  groupId: undefined as string | undefined,
  groupName: undefined as string | undefined,
  sourceUrl: undefined as string | undefined,
});

// "0" is the unlimited sentinel — kept as a string so it fits the same
// picker path as 1–30. The backend treats totalSpots === 0 as no cap.
const rosterSizeOptions: string[] = [
  ...Array.from({length: 30}, (_, i) => (i + 1).toString()),
  '0',
];

const rosterSizeLabel = (value: string, noLimitLabel: string): string =>
  value === '0' ? noLimitLabel : value;

// Profile interest IDs → event activity chip labels. Only maps interests that
// have a clear matching chip; others are skipped rather than forcing a bad filter.
const INTEREST_TO_EVENT_TYPE: Record<string, string> = {
  basketball: 'Basketball',
  hockey: 'Hockey',
  soccer: 'Soccer',
  football: 'Football',
  baseball: 'Baseball',
  tennis: 'Tennis',
  golf: 'Golf',
  volleyball: 'Volleyball',
  bowling: 'Bowling',
  trivia: 'Trivia Night',
  'game-nights': 'Game Night',
  karaoke: 'Karaoke',
  'live-music': 'Live Music',
  brewery: 'Brewery Visit',
  wine: 'Wine Tasting',
  hiking: 'Hiking',
  cycling: 'Cycling',
  running: 'Running',
  yoga: 'Yoga',
  swimming: 'Swimming',
  dance: 'Dancing',
  gaming: 'Game Night',
  'sports-bar': 'Watch Party',
  coffee: 'Happy Hour',
};

const activityOptions = [
  // Sports
  {label: 'Basketball', emoji: '🏀', category: 'sports'},
  {label: 'Hockey', emoji: '🏒', category: 'sports'},
  {label: 'Soccer', emoji: '⚽', category: 'sports'},
  {label: 'Figure Skating', emoji: '⛸️', category: 'sports'},
  {label: 'Tennis', emoji: '🎾', category: 'sports'},
  {label: 'Pickleball', emoji: '🥒', category: 'sports'},
  {label: 'Golf', emoji: '⛳', category: 'sports'},
  {label: 'Football', emoji: '🏈', category: 'sports'},
  {label: 'Rugby', emoji: '🏉', category: 'sports'},
  {label: 'Baseball', emoji: '⚾', category: 'sports'},
  {label: 'Softball', emoji: '🥎', category: 'sports'},
  {label: 'Lacrosse', emoji: '🥍', category: 'sports'},
  {label: 'Volleyball', emoji: '🏐', category: 'sports'},
  {label: 'Badminton', emoji: '🏸', category: 'sports'},
  {label: 'Table Tennis', emoji: '🏓', category: 'sports'},
  {label: 'Bowling', emoji: '🎳', category: 'sports'},
  {label: 'Disc Golf', emoji: '🥏', category: 'sports'},
  {label: 'Ultimate Frisbee', emoji: '🥏', category: 'sports'},
  {label: 'Boxing', emoji: '🥊', category: 'sports'},
  {label: 'Martial Arts', emoji: '🥋', category: 'sports'},
  // Social & Entertainment
  {label: 'Trivia Night', emoji: '🧠', category: 'social'},
  {label: 'Game Night', emoji: '🎲', category: 'social'},
  {label: 'Karaoke', emoji: '🎤', category: 'social'},
  {label: 'Open Mic', emoji: '🎙️', category: 'social'},
  {label: 'Watch Party', emoji: '📺', category: 'social'},
  {label: 'Live Music', emoji: '🎵', category: 'social'},
  {label: 'Comedy Show', emoji: '😂', category: 'social'},
  {label: 'Happy Hour', emoji: '🍻', category: 'social'},
  {label: 'Dinner', emoji: '🍽️', category: 'social'},
  {label: 'Brewery Visit', emoji: '🍺', category: 'social'},
  {label: 'Wine Tasting', emoji: '🍷', category: 'social'},
  {label: 'Dancing', emoji: '💃', category: 'social'},
  {label: 'Movie Night', emoji: '🎬', category: 'social'},
  {label: 'Paint Night', emoji: '🎨', category: 'social'},
  // Outdoor & Fitness
  {label: 'Hiking', emoji: '🥾', category: 'outdoor'},
  {label: 'Cycling', emoji: '🚴', category: 'outdoor'},
  {label: 'Running', emoji: '🏃', category: 'outdoor'},
  {label: 'Yoga', emoji: '🧘', category: 'outdoor'},
  {label: 'Gym Session', emoji: '🏋️', category: 'outdoor'},
  {label: 'Rock Climbing', emoji: '🧗', category: 'outdoor'},
  {label: 'Swimming', emoji: '🏊', category: 'outdoor'},
  {label: 'Kayaking', emoji: '🛶', category: 'outdoor'},
  {label: 'Skiing', emoji: '⛷️', category: 'outdoor'},
  {label: 'Snowboarding', emoji: '🏂', category: 'outdoor'},
  {label: 'Fishing', emoji: '🎣', category: 'outdoor'},
  {label: 'Camping', emoji: '🏕️', category: 'outdoor'},
  {label: 'Picnic', emoji: '🧺', category: 'outdoor'},
  {label: 'Beach Day', emoji: '🏖️', category: 'outdoor'},
  // Community & Learning
  {label: 'Book Club', emoji: '📚', category: 'community'},
  {label: 'Workshop', emoji: '🛠️', category: 'community'},
  {label: 'Meetup', emoji: '🤝', category: 'community'},
  {label: 'Potluck', emoji: '🍲', category: 'community'},
  {label: 'Volunteer', emoji: '💚', category: 'community'},
  {label: 'Study Group', emoji: '📖', category: 'community'},
  {label: 'Networking', emoji: '💼', category: 'community'},
  {label: 'Fundraiser', emoji: '🎗️', category: 'community'},
  // Other
  {label: 'Custom', emoji: '✏️', category: 'other'},
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

// "Custom" is a picker-only sentinel: choosing it in the create/edit form
// swaps in whatever free text was typed, so no saved event ever has
// eventType === "Custom". As a *filter* it therefore has to mean "any event
// whose type isn't one of the presets", otherwise it matches nothing.
const CUSTOM_EVENT_TYPE = 'Custom';

const isPresetEventType = (eventType?: string): boolean =>
  !!eventType &&
  activityOptions.some(
    opt =>
      opt.label !== CUSTOM_EVENT_TYPE &&
      opt.label.toLowerCase() === eventType.toLowerCase(),
  );

const matchesEventTypeFilter = (
  eventType: string | undefined,
  selectedType: string,
): boolean =>
  selectedType === CUSTOM_EVENT_TYPE
    ? !!eventType?.trim() && !isPresetEventType(eventType)
    : selectedType.toLowerCase() === (eventType || '').toLowerCase();

// The emoji a legacy "like" maps to. The server keeps the deprecated `likes`
// array in sync with these so older clients still see hearts.
const LIKE_EMOJI = '❤️';

// Collapse reactions into one pill per distinct emoji. Ordered by first
// appearance (the server appends, so that's first-reacted-first, same as
// Discord) rather than by count, so pills don't jump around as votes land.
const summarizeReactions = (
  event: Event,
  userId?: string,
): {emoji: string; count: number; mine: boolean}[] => {
  const order: string[] = [];
  const counts = new Map<string, number>();
  const mine = new Set<string>();

  (event.reactions || []).forEach(r => {
    if (!counts.has(r.emoji)) {
      order.push(r.emoji);
    }
    counts.set(r.emoji, (counts.get(r.emoji) || 0) + 1);
    if (userId && r.userId === userId) {
      mine.add(r.emoji);
    }
  });

  return order.map(emoji => ({
    emoji,
    count: counts.get(emoji) as number,
    mine: mine.has(emoji),
  }));
};

// Open maps for an event — delegates to shared MapLauncher
const openMapsForEvent = async (
  event: Partial<Event>,
  t: (key: string) => string,
  presentPicker?: (apps: AvailableMapApp[], onCancel: () => void) => void,
) => {
  if (event?.isVirtual) {
    return;
  }
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
              const horizontalInset = i * 6;
              // Placeholder layer only — rendering full event cards here made
              // taller siblings poke their content through whenever the front
              // card was shorter (e.g. the first instance with no countdown).
              return (
                <View
                  key={`deck-bg-${i}`}
                  style={[
                    themedStyles.deckBgPlaceholder,
                    {
                      top: 0,
                      bottom: -offset,
                      left: horizontalInset,
                      right: horizontalInset,
                      opacity: 1 - i * 0.2,
                      zIndex: visibleCount - i,
                    },
                  ]}
                />
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
  const myUserId = userData?._id;
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
          paddingTop: 4,
          backgroundColor: colors.background,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
          paddingTop: 4,
          paddingHorizontal: 12,
          backgroundColor: colors.background,
          zIndex: 100,
        },
        headerSearch: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          minWidth: 0,
          gap: 6,
        },
        headerRight: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 8,
          flexShrink: 0,
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
          marginBottom: 6,
        },
        cardTitleRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          marginBottom: 10,
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
          marginTop: 6,
        },
        detailText: {
          color: colors.secondaryText,
          fontSize: 13.5,
          flex: 1,
          lineHeight: 18,
        },
        mapEmbed: {
          borderRadius: 12,
          overflow: 'hidden' as const,
          marginTop: 4,
          marginBottom: 4,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        virtualLocationBanner: {
          borderRadius: 10,
          marginTop: 4,
          marginBottom: 4,
          paddingHorizontal: 12,
          paddingVertical: 10,
          backgroundColor: colors.inputBackground || colors.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        virtualLocationBannerText: {
          color: colors.text,
          fontSize: 13,
          fontWeight: '600',
          lineHeight: 18,
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
          paddingTop: 6,
          paddingBottom: 2,
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
        rsvpContainer: {
          paddingTop: 8,
          paddingBottom: 0,
        },
        rsvpButtonsRow: {
          flexDirection: 'row',
          gap: 8,
        },
        rsvpButton: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingVertical: 8,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border || 'rgba(128,128,128,0.3)',
          backgroundColor: colors.card,
        },
        rsvpButtonGoingActive: {
          backgroundColor: '#2ecc71',
          borderColor: '#2ecc71',
        },
        rsvpButtonMaybeActive: {
          backgroundColor: '#f1c40f',
          borderColor: '#f1c40f',
        },
        rsvpButtonCantActive: {
          backgroundColor: '#e74c3c',
          borderColor: '#e74c3c',
        },
        rsvpButtonText: {
          color: colors.secondaryText,
          fontSize: 13,
          fontWeight: '600',
        },
        rsvpButtonTextActive: {
          color: '#fff',
          fontWeight: '700',
        },
        rsvpSummary: {
          color: colors.secondaryText,
          fontSize: 12,
          marginTop: 6,
          marginLeft: 2,
        },
        publicJoinButton: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'flex-start',
          gap: 7,
          paddingVertical: 9,
          paddingHorizontal: 22,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.border || 'rgba(128,128,128,0.3)',
          backgroundColor: colors.card,
        },
        gatedHintRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginTop: 8,
        },
        gatedHintText: {
          flex: 1,
          color: colors.secondaryText,
          fontSize: 12,
          fontStyle: 'italic',
        },
        gatedActionsRow: {
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: 8,
          marginTop: 10,
        },
        messageHostButton: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border || 'rgba(128,128,128,0.3)',
          backgroundColor: colors.card,
          flex: 1,
        },
        messageHostButtonText: {
          color: colors.text,
          fontSize: 14,
          fontWeight: '600',
        },
        requestButton: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingVertical: 12,
          borderRadius: 10,
          backgroundColor: colors.primary,
          flex: 1,
        },
        requestButtonPending: {
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border || 'rgba(128,128,128,0.3)',
        },
        requestButtonText: {
          color: '#fff',
          fontSize: 15,
          fontWeight: '700',
        },
        requestButtonTextPending: {
          color: colors.secondaryText,
        },
        requestsClosedBar: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingVertical: 12,
          borderRadius: 10,
          backgroundColor: colors.inputBackground || colors.background,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          marginTop: 12,
        },
        requestsClosedText: {
          color: colors.secondaryText,
          fontSize: 14,
          fontWeight: '600',
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
        bellButton: {
          width: 34,
          height: 34,
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        },
        findPlaceButton: {
          width: 34,
          height: 34,
          alignItems: 'center',
          justifyContent: 'center',
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
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.inputBackground || colors.card,
          borderRadius: 18,
          paddingHorizontal: 10,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          minHeight: 36,
          minWidth: 0,
        },
        searchInput: {
          flex: 1,
          paddingVertical: 7,
          paddingHorizontal: 4,
          fontSize: 13,
          color: colors.text,
          minWidth: 0,
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
          width: 36,
          height: 36,
          borderRadius: 10,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          flexShrink: 0,
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
        // Public-event creator control rows (toggles)
        publicControlsContainer: {
          marginBottom: 12,
          gap: 4,
        },
        publicControlRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 8,
          gap: 12,
        },
        publicControlText: {
          flex: 1,
        },
        publicControlLabel: {
          fontSize: 14,
          fontWeight: '600',
          color: colors.text,
        },
        publicControlDesc: {
          fontSize: 12,
          color: colors.secondaryText,
          marginTop: 2,
          lineHeight: 16,
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
        inviteGroupButton: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: colors.primary + '15',
          borderRadius: 12,
          paddingVertical: 12,
          marginTop: 10,
          marginBottom: 10,
        },
        inviteGroupButtonText: {
          color: colors.primary,
          fontWeight: '700',
          fontSize: 14,
        },
        attachedGroupPill: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          alignSelf: 'flex-start',
          backgroundColor: colors.primary + '15',
          borderRadius: 14,
          paddingHorizontal: 12,
          paddingVertical: 8,
          marginTop: 10,
          marginBottom: 10,
        },
        attachedGroupText: {
          color: colors.primary,
          fontWeight: '700',
          fontSize: 13,
        },
        groupBadge: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          alignSelf: 'flex-start',
          backgroundColor: colors.primary + '18',
          borderRadius: 10,
          paddingHorizontal: 8,
          paddingVertical: 3,
        },
        groupBadgeText: {
          color: colors.primary,
          fontSize: 11,
          fontWeight: '700',
        },
        cardHeaderGroupRow: {
          // Dedicated row for group affiliation, sitting just below the
          // meta row inside the identity column. Gets its own line so
          // the group name has room to read at a normal size and the
          // avatar strip can breathe without colliding with the kebab.
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 6,
          gap: 6,
        },
        cardHeaderGroupName: {
          fontSize: 13,
          color: colors.primary,
          fontWeight: '600',
          // Cap the name so really long group names don't push the
          // avatar strip off the right edge of the identity column.
          flexShrink: 1,
        },
        // Reaction pills — Discord-style row under the card body.
        reactionRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 6,
          paddingTop: 8,
        },
        reactionPill: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 8,
          height: 26,
          borderRadius: 13,
          backgroundColor: colors.secondaryText + '14',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'transparent',
        },
        reactionPillMine: {
          backgroundColor: colors.primary + '1F',
          borderColor: colors.primary,
        },
        reactionPillEmoji: {
          fontSize: 13,
        },
        reactionPillCount: {
          fontSize: 12,
          fontWeight: '600',
          color: colors.secondaryText,
        },
        reactionPillCountMine: {
          color: colors.primary,
        },
        reactionAddButton: {
          width: 28,
          height: 26,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.secondaryText + '14',
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
        likesModalEmoji: {
          fontSize: 16,
          marginLeft: 8,
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
        durationSection: {
          backgroundColor: colors.inputBackground || colors.background,
          borderRadius: 12,
          padding: 14,
          marginBottom: 10,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        locationModeRow: {
          flexDirection: 'row',
          gap: 8,
          marginBottom: 10,
        },
        locationModePill: {
          flex: 1,
          paddingVertical: 10,
          borderRadius: 10,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          alignItems: 'center',
          backgroundColor: colors.inputBackground || colors.background,
        },
        locationModePillSelected: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
        locationModePillText: {
          color: colors.secondaryText,
          fontSize: 13,
          fontWeight: '600',
        },
        locationModePillTextSelected: {
          color: '#fff',
          fontWeight: '700',
        },
        durationHeaderRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        },
        durationLabel: {
          color: colors.text,
          fontSize: 14,
          fontWeight: '700',
        },
        durationEndHint: {
          color: colors.secondaryText,
          fontSize: 12,
        },
        durationRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        },
        durationPill: {
          paddingHorizontal: 14,
          paddingVertical: 7,
          borderRadius: 16,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        durationPillSelected: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
        durationPillText: {
          color: colors.secondaryText,
          fontSize: 13,
          fontWeight: '600',
        },
        durationPillTextSelected: {
          color: '#fff',
          fontWeight: '700',
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
          marginTop: 10,
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
        deckBgPlaceholder: {
          position: 'absolute',
          backgroundColor: colors.card,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          borderBottomLeftRadius: 12,
          borderBottomRightRadius: 12,
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
  const [showMyEventsOnly, setShowMyEventsOnly] = useState(false);
  // Opt-in: when true, activity chips default from profile interests. Persisted;
  // defaults off so opening Events shows the full feed.
  const [filterByInterests, setFilterByInterests] = useState(false);
  const [hidePastEvents, setHidePastEvents] = useState(true);
  const [profileFilter, setProfileFilter] = useState<
    'created' | 'joined' | 'upcoming' | null
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
  // Free-text value when the "Custom" event style is chosen.
  const [customEventType, setCustomEventType] = useState('');

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
  const [groupPickerVisible, setGroupPickerVisible] = useState(false);

  // Attach a Group to the event being created. Snapshots the group's
  // members into invitedUsers (additive — anyone already picked
  // individually stays), and stashes groupId/groupName on the event
  // payload so the BE can cache the display name and (for recurring
  // series) maintain the live link in PR 3.
  const handleGroupSelected = useCallback(
    (group: Group) => {
      setGroupPickerVisible(false);
      const currentUserId = userData?._id;
      const incomingMembers = group.members
        .filter(m => m.userId && m.userId !== currentUserId)
        .map(m => ({
          _id: m.userId,
          username: m.username || 'member',
          name: m.name,
          profilePicUrl: m.profilePicUrl,
        }));
      setNewEvent(prev => {
        const existing = new Set(prev.invitedUsers);
        const additions: string[] = [];
        for (const m of incomingMembers) {
          if (!existing.has(m._id)) {
            additions.push(m._id);
            existing.add(m._id);
          }
        }
        return {
          ...prev,
          groupId: group._id,
          groupName: group.name,
          invitedUsers: [...prev.invitedUsers, ...additions],
        };
      });
      setInvitedUserDetails(prev => {
        const have = new Set(prev.map(u => u._id));
        const additions = incomingMembers.filter(u => !have.has(u._id));
        return [...prev, ...(additions as LikedByUser[])];
      });
    },
    [userData?._id],
  );

  // Detach the Group from the in-progress event. Doesn't unsnapshot the
  // already-added members — those become regular individual invitees and
  // the user can remove them one-by-one if they want (matches the
  // "metadata about origin, not a live audience filter" rule).
  const handleGroupCleared = useCallback(() => {
    setNewEvent(prev => ({...prev, groupId: undefined, groupName: undefined}));
  }, []);

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

  // Which event the reaction picker is open for, if any.
  const [reactionPickerEvent, setReactionPickerEvent] = useState<Event | null>(
    null,
  );

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

  // "Who reacted" modal state. Each entry carries the emoji that user picked.
  const [likesModalVisible, setLikesModalVisible] = useState(false);
  const [likesModalData, setLikesModalData] = useState<{
    title: string;
    users: Array<LikedByUser & {emoji?: string}>;
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
          .filter((u): u is string => typeof u === 'string' && u.length > 0),
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
        const next: Record<string, {profilePicUrl?: string; name?: string}> =
          {};
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

    // Targeted, instant patch for roster/RSVP changes on a single event.
    // The events list isn't a member of any event's socket room, so this
    // broadcast is how observers (e.g. the organizer) update their card in
    // real time without waiting on a full refetch.
    const unsubRosterChanged = socketSubscribe(
      'event:rosterChanged',
      (data: {
        eventId: string;
        roster?: any[];
        rsvps?: any[];
        rosterSpotsFilled?: number;
      }) => {
        setEventData(prev =>
          prev.map(ev =>
            ev._id === data.eventId
              ? {
                  ...ev,
                  roster: Array.isArray(data.roster) ? data.roster : ev.roster,
                  rsvps: Array.isArray(data.rsvps) ? data.rsvps : ev.rsvps,
                  rosterSpotsFilled:
                    typeof data.rosterSpotsFilled === 'number'
                      ? data.rosterSpotsFilled
                      : ev.rosterSpotsFilled,
                }
              : ev,
          ),
        );
      },
    );

    const unsubLiked = socketSubscribe(
      'event:reacted',
      (data: {
        eventId: string;
        reactions: Array<{userId: string; emoji: string}>;
        likes: string[];
        likedByUsernames: string[];
      }) => {
        setEventData(prev =>
          prev.map(ev =>
            ev._id === data.eventId
              ? {
                  ...ev,
                  reactions: data.reactions,
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
      unsubRosterChanged();
      unsubLiked();
      subscription.remove();
    };
  }, [initialLoadDone, socketSubscribe, fetchLatestEvents]);

  // Filter events based on search query and filters
  const filteredEvents = useMemo(() => {
    let filtered = eventData;

    // Text search filter. Every field is read defensively: a gated public
    // event arrives redacted (no location until the host approves you), so
    // assuming any of these is a string crashes the screen on the first
    // keystroke.
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const matches = (value?: string) =>
        !!value && value.toLowerCase().includes(query);
      filtered = filtered.filter(
        event =>
          matches(event.name) ||
          matches(event.location) ||
          matches(event.date) ||
          matches(event.eventType) ||
          matches(event.createdByUsername),
      );
    }

    // Event type filter
    if (selectedEventTypes.length > 0) {
      filtered = filtered.filter(event =>
        selectedEventTypes.some(type =>
          matchesEventTypeFilter(event.eventType, type),
        ),
      );
    }

    // Date filter
    if (selectedDateFilter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      filtered = filtered.filter(event => {
        const eventDate = parseEventDateLocal(event.date);
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
        event =>
          event.totalSpots <= 0 || event.rosterSpotsFilled < event.totalSpots,
      );
    }

    // "My events only" filter. Counts anything the user has a stake in, not
    // just what they created: hosting, going, replying maybe/can't, and being
    // invited all make an event theirs for decluttering purposes.
    if (showMyEventsOnly && myUserId) {
      filtered = filtered.filter(
        event =>
          event.createdBy === myUserId ||
          (event.roster || []).some(r => r.userId === myUserId) ||
          (event.rsvps || []).some(r => r.userId === myUserId) ||
          (event.invitedUsers || []).includes(myUserId),
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
      } else if (profileFilter === 'upcoming') {
        // Match Profile "Upcoming": hosting or on roster, not past.
        filtered = filtered.filter(event => {
          const isCreator = event.createdBy === profileFilterUserId;
          const onRoster = (event.roster || []).some(
            (r: any) => r.userId === profileFilterUserId,
          );
          return (
            (isCreator || onRoster) &&
            isEventActive(event.date, event.time, event.durationMinutes)
          );
        });
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

    // Order the list: upcoming events first (soonest first), then any past
    // events after them (most recent first). Past events are only present when
    // the user opted into them, and keeping them below the upcoming ones stops
    // history from burying what's actually actionable. Unparseable dates sort
    // last rather than returning NaN, which would scramble the whole list.
    const nowMs = Date.now();
    filtered = [...filtered]
      .map(event => {
        const when = getEventDateTime(event.date, event.time)?.getTime();
        return {event, when, isPast: when != null && when < nowMs};
      })
      .sort((a, b) => {
        if (a.when == null || b.when == null) {
          return a.when == null ? (b.when == null ? 0 : 1) : -1;
        }
        if (a.isPast !== b.isPast) {
          return a.isPast ? 1 : -1;
        }
        return a.isPast ? b.when - a.when : a.when - b.when;
      })
      .map(entry => entry.event);

    return filtered;
  }, [
    eventData,
    searchQuery,
    selectedEventTypes,
    selectedDateFilter,
    showAvailableOnly,
    showMyEventsOnly,
    myUserId,
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
      // Upcoming is already active-only; other profile filters may include past.
      if (route.params.profileFilter === 'upcoming') {
        setHidePastEvents(true);
      } else {
        setHidePastEvents(false);
      }
    }
  }, [route.params?.profileFilter, route.params?.userId]);

  // One-shot load of the "match my interests" preference (defaults off).
  useEffect(() => {
    AsyncStorage.getItem('eventsFilterByInterests').then(value => {
      if (value === 'true') {
        setFilterByInterests(true);
      }
    });
  }, []);

  const applyInterestEventTypes = useCallback(async () => {
    if (!myUserId) {
      return;
    }
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await axios.get(
        `${API_BASE_URL}/user/${myUserId}/favorite-sports`,
        {headers: token ? {Authorization: `Bearer ${token}`} : undefined},
      );
      const interests: string[] = res.data?.favoriteSports || [];
      const labels = Array.from(
        new Set(
          interests
            .map(id => INTEREST_TO_EVENT_TYPE[id])
            .filter((label): label is string => !!label)
            .filter(label => activityOptions.some(opt => opt.label === label)),
        ),
      );
      if (labels.length > 0) {
        setSelectedEventTypes(labels);
      }
    } catch {
      // Leave chips alone if interests can't be loaded.
    }
  }, [myUserId]);

  // When the preference is on, apply interest chips once per session (or after
  // the user turns the toggle on). Skipped when the preference is off.
  const interestFilterAppliedRef = useRef(false);
  useEffect(() => {
    if (!filterByInterests || !myUserId || interestFilterAppliedRef.current) {
      return;
    }
    interestFilterAppliedRef.current = true;
    applyInterestEventTypes();
  }, [filterByInterests, myUserId, applyInterestEventTypes]);

  const handleFilterByInterestsToggle = useCallback(async () => {
    const next = !filterByInterests;
    setFilterByInterests(next);
    await AsyncStorage.setItem(
      'eventsFilterByInterests',
      next ? 'true' : 'false',
    );
    if (next) {
      interestFilterAppliedRef.current = true;
      await applyInterestEventTypes();
    } else {
      setSelectedEventTypes([]);
      interestFilterAppliedRef.current = false;
    }
  }, [filterByInterests, applyInterestEventTypes]);

  // Open the create-event modal prefilled when a venue screen bridges in via
  // `navigate('EventList', {prefillEvent})` (same Events stack — the "Find a
  // place" flow). We track which prefill payload we've already consumed so
  // back-navigation doesn't re-open the modal a second time.
  const consumedPrefillRef = useRef<string | null>(null);
  useEffect(() => {
    const prefill = route.params?.prefillEvent;
    if (!prefill) {
      return;
    }
    // Cheap signature so we don't re-trigger on harmless re-renders.
    const sig = JSON.stringify(prefill);
    if (consumedPrefillRef.current === sig) {
      return;
    }
    consumedPrefillRef.current = sig;
    setNewEvent({
      ...createEmptyEvent(),
      name: prefill.name || '',
      location: prefill.location || '',
      latitude: prefill.latitude,
      longitude: prefill.longitude,
      // Default to today when a venue bridges in without a date, so the form
      // is one tap from done. Matches the date picker's toDateString() format
      // and stays fully editable.
      date: prefill.date || new Date().toDateString(),
      time: prefill.time || '',
      eventType: prefill.eventType || '',
      venueId: prefill.venueId,
      venueName: prefill.venueName,
      sourceUrl: prefill.sourceUrl,
    });
    setTempRosterSize('');
    setTempEventType(prefill.eventType || '');
    setIsEditing(false);
    setEditingEventId(null);
    setPlacesApiFailed(false);
    setModalVisible(true);
    // Clear the param so navigating away and back doesn't re-pop the modal.
    navigation.setParams({prefillEvent: undefined} as never);
  }, [route.params?.prefillEvent, navigation]);

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
    if (showMyEventsOnly) {
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
    showMyEventsOnly,
    proximityEnabled,
  ]);

  // Whether to show the removable-tag row under the chips. Activity types are
  // deliberately excluded: they're already shown as highlighted chips, so
  // echoing them as tags just duplicates the selection and adds an empty-ish
  // extra row. Only the filters that have no other on-screen affordance
  // (date range, available-only, proximity) get a tag here.
  const hasTagRowFilters =
    selectedDateFilter !== 'all' ||
    showAvailableOnly ||
    showMyEventsOnly ||
    proximityEnabled;

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
    setShowMyEventsOnly(false);
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
              durationMinutes: newEvent.durationMinutes,
              date: newEvent.date,
              totalSpots: parseInt(newEvent.totalSpots, 10),
              eventType: newEvent.eventType,
              createdByUsername: userData?.username || '',
              latitude: newEvent.isVirtual ? undefined : newEvent.latitude,
              longitude: newEvent.isVirtual ? undefined : newEvent.longitude,
              isVirtual: newEvent.isVirtual,
              jerseyColors: isTeamSport(newEvent.eventType)
                ? newEvent.jerseyColors
                : undefined,
              privacy: newEvent.privacy,
              invitedUsers: newEvent.invitedUsers,
              allowJoinRequests: newEvent.allowJoinRequests,
              showLocationPublicly: newEvent.showLocationPublicly,
              // Absolute start + creator offset so server reminders don't
              // misread wall-clock time as UTC (Heroku).
              startsAt: getEventDateTime(
                newEvent.date,
                newEvent.time,
              )?.toISOString(),
              timezoneOffsetMinutes: new Date().getTimezoneOffset(),
              // Recurrence intent — lets the backend convert single↔recurring
              // or re-shape the series. `recurrenceCount` is the number of
              // occurrences from this event forward (set in handleEditEvent).
              isRecurring: newEvent.isRecurring,
              recurrenceFrequency: newEvent.recurrenceFrequency,
              recurrenceCount: newEvent.recurrenceIndefinite
                ? 0
                : newEvent.recurrenceCount,
              recurrenceIndefinite: !!newEvent.recurrenceIndefinite,
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
            durationMinutes: newEvent.durationMinutes,
            date: newEvent.date,
            totalSpots: parseInt(newEvent.totalSpots, 10),
            eventType: newEvent.eventType,
            createdBy: userData?._id || '',
            createdByUsername: userData?.username || '',
            latitude: newEvent.isVirtual ? undefined : newEvent.latitude,
            longitude: newEvent.isVirtual ? undefined : newEvent.longitude,
            isVirtual: newEvent.isVirtual,
            jerseyColors: isTeamSport(newEvent.eventType)
              ? newEvent.jerseyColors
              : undefined,
            privacy: newEvent.privacy,
            invitedUsers: newEvent.invitedUsers,
            allowJoinRequests: newEvent.allowJoinRequests,
            showLocationPublicly: newEvent.showLocationPublicly,
            // Optional venue listing reference (set by the Venues-tab bridge).
            venueId: newEvent.isVirtual ? undefined : newEvent.venueId,
            venueName: newEvent.isVirtual ? undefined : newEvent.venueName,
            // Optional Group reference (set when the user picked "Invite
            // a group"). BE re-resolves to snapshot members and cache
            // the display name for the group-name badge on event cards.
            groupId: newEvent.groupId,
            sourceUrl: newEvent.sourceUrl,
            startsAt: getEventDateTime(
              newEvent.date,
              newEvent.time,
            )?.toISOString(),
            timezoneOffsetMinutes: new Date().getTimezoneOffset(),
          };

          if (newEvent.isRecurring) {
            eventPayload.isRecurring = true;
            eventPayload.recurrenceFrequency = newEvent.recurrenceFrequency;
            eventPayload.recurrenceIndefinite = !!newEvent.recurrenceIndefinite;
            eventPayload.recurrenceCount = newEvent.recurrenceIndefinite
              ? 0
              : newEvent.recurrenceCount;
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

  // Jump to the event's associated Group. The Groups stack lives under a
  // sibling bottom tab, so we navigate to the tab and target its detail screen.
  const openGroup = (groupId?: string) => {
    if (!groupId) {
      return;
    }
    navigation.navigate('Groups', {
      screen: 'GroupDetail',
      params: {groupId},
    });
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
      isRecurring: event.isRecurring,
      groupId: event.groupId,
      groupName: event.groupName,
    });
  };

  const handleDeleteEvent = (event: Event) => {
    if (event.createdBy !== (userData?._id || '')) {
      Alert.alert(t('events.notAuthorized'), t('events.notAuthorizedDelete'));
      return;
    }

    // Both delete paths attach the JWT manually because there's no
    // global axios interceptor in this codebase — every other authed
    // call in this file does the same dance. The series endpoint
    // enforces auth server-side; the single endpoint currently does
    // not, but we send the header anyway so a future tightening of
    // that route doesn't silently break this flow.
    const deleteSingle = async () => {
      setDeletingEventId(event._id);
      try {
        const token = await AsyncStorage.getItem('userToken');
        await axios.delete(`${API_BASE_URL}/events/${event._id}`, {
          headers: token ? {Authorization: `Bearer ${token}`} : {},
        });
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
    };

    // Series delete hits the backend's `/events/series/:recurrenceGroupId`
    // endpoint, which deletes only the future-dated instances in that
    // series — past events stay as history. We mirror that scope here
    // so the optimistic local-state update doesn't prune past cards the
    // BE deliberately kept. Same YYYY-MM-DD string compare the BE uses
    // (events store `date` as a string in that format).
    const deleteSeries = async () => {
      const recurrenceId = event.recurrenceGroupId;
      if (!recurrenceId) return;
      setDeletingEventId(event._id);
      try {
        const token = await AsyncStorage.getItem('userToken');
        await axios.delete(
          `${API_BASE_URL}/events/series/${recurrenceId}`,
          {headers: token ? {Authorization: `Bearer ${token}`} : {}},
        );
        const d = new Date();
        const todayStr =
          `${d.getFullYear()}-` +
          `${String(d.getMonth() + 1).padStart(2, '0')}-` +
          `${String(d.getDate()).padStart(2, '0')}`;
        const isFutureInSeries = (e: Event) =>
          e.recurrenceGroupId === recurrenceId && e.date >= todayStr;
        eventData.filter(isFutureInSeries).forEach(e =>
          notificationService
            .cancelEventNotifications(e._id)
            .catch(() => {}),
        );
        setEventData(prevData =>
          prevData.filter(e => !isFutureInSeries(e)),
        );
      } catch (error) {
        Alert.alert(t('common.error'), t('events.deleteError'));
      } finally {
        setDeletingEventId(null);
      }
    };

    // Recurring cards get a three-button prompt so the user can
    // distinguish "kill this Tuesday" from "stop doing this entirely."
    // Non-recurring events keep the original single-confirm flow — no
    // need to surface a scope picker when there's only one card to delete.
    if (event.isRecurring && event.recurrenceGroupId) {
      Alert.alert(
        t('events.deleteRecurringTitle'),
        t('events.deleteRecurringMessage'),
        [
          {text: t('common.cancel'), style: 'cancel'},
          {
            text: t('events.deleteThisEvent'),
            style: 'destructive',
            onPress: deleteSingle,
          },
          {
            text: t('events.deleteEntireSeries'),
            style: 'destructive',
            onPress: deleteSeries,
          },
        ],
        {cancelable: true},
      );
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
          onPress: deleteSingle,
        },
      ],
      {cancelable: true},
    );
  };

  const handleEditEvent = async (event: Event) => {
    // For a recurring event, the modal's count reflects how many occurrences
    // remain from this one forward (inclusive), so leaving it untouched is a
    // no-op on the backend. Single events default to 4 if turned recurring.
    const forwardCount =
      event.isRecurring && event.recurrenceGroupId
        ? eventData.filter(
            e =>
              e.recurrenceGroupId === event.recurrenceGroupId &&
              parseEventDateLocal(e.date).getTime() >=
                parseEventDateLocal(event.date).getTime(),
          ).length
        : 4;
    setNewEvent({
      name: event.name,
      location: event.location || '',
      time: event.time,
      durationMinutes: event.durationMinutes ?? null,
      date: event.date,
      totalSpots: event.totalSpots.toString(),
      eventType: event.eventType,
      latitude: event.latitude,
      longitude: event.longitude,
      isVirtual: !!event.isVirtual,
      jerseyColors: event.jerseyColors || [],
      // 'private' is deprecated (redundant with invite-only); migrate legacy
      // private events to invite-only when they're edited.
      privacy: event.privacy === 'private' ? 'invite-only' : event.privacy || 'public',
      allowJoinRequests: event.allowJoinRequests !== false,
      showLocationPublicly: event.showLocationPublicly === true,
      invitedUsers: event.invitedUsers || [],
      isRecurring: event.isRecurring || false,
      recurrenceFrequency: event.recurrenceFrequency || 'weekly',
      recurrenceIndefinite: !!event.recurrenceIndefinite,
      recurrenceCount: event.recurrenceIndefinite ? 0 : forwardCount,
      // Preserve any venue link the event was originally created with.
      venueId: event.venueId,
      venueName: event.venueName,
      groupId: event.groupId,
      groupName: event.groupName,
      sourceUrl: event.sourceUrl,
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
    const spotsAvailable =
      event.totalSpots > 0
        ? event.totalSpots - event.rosterSpotsFilled
        : null;
    const appLink =
      Platform.OS === 'ios' ? APP_STORE_LINKS.ios : APP_STORE_LINKS.android;

    const shareMessage =
      `${emoji} Join me for ${event.name}!\n\n` +
      `🏷️ ${event.eventType}\n` +
      `📅 ${event.date} @ ${formatDisplayTime(event.time)}\n` +
      `📍 ${event.location}\n` +
      (spotsAvailable === null
        ? `👥 ${t('events.noLimit') || 'No limit'}\n\n`
        : `👥 ${spotsAvailable} spot${
            spotsAvailable !== 1 ? 's' : ''
          } available\n\n`) +
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
            (user.name && user.name.toLowerCase().includes(normalizedQuery))) &&
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

  // Show who reacted to the event, and with what.
  const showEventReactedBy = async (event: Event) => {
    const reactions = event.reactions || [];
    if (reactions.length === 0) {
      return;
    }

    const userIds = reactions.map(r => r.userId);
    const users = await fetchUsersByIds(userIds);

    const emojiByUserId = new Map(reactions.map(r => [r.userId, r.emoji]));
    const usersWithEmoji = users.map(user => ({
      ...user,
      emoji: user._id ? emojiByUserId.get(user._id) : undefined,
    }));

    // Reactors we couldn't resolve to a profile still get counted.
    const anonymousCount = Math.max(0, reactions.length - users.length);

    setLikesModalData({
      title: t('events.reactions') || 'Reactions',
      users: usersWithEmoji,
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

  // Add or remove one emoji for the current user. A user can hold several
  // different reactions at once, so only the exact (user, emoji) pair toggles
  // — mirroring the server so the optimistic state matches the reply.
  const toggleEventReaction = async (event: Event, emoji: string) => {
    if (!userData) {
      return;
    }

    const myUid = userData._id;
    const hadIt = (event.reactions || []).some(
      r => r.userId === myUid && r.emoji === emoji,
    );

    const withPair = (target: Event, shouldHave: boolean): Event => {
      const others = (target.reactions || []).filter(
        r => !(r.userId === myUid && r.emoji === emoji),
      );
      const reactions = shouldHave
        ? [...others, {userId: myUid, emoji}]
        : others;
      return {
        ...target,
        reactions,
        likes: reactions
          .filter(r => r.emoji === LIKE_EMOJI)
          .map(r => r.userId),
      };
    };

    setEventData(prev =>
      prev.map(e => (e._id === event._id ? withPair(e, !hadIt) : e)),
    );

    try {
      const token = await AsyncStorage.getItem('userToken');
      await axios.post(
        `${API_BASE_URL}/events/${event._id}/react`,
        {emoji},
        {headers: {Authorization: `Bearer ${token}`}},
      );
    } catch (error) {
      setEventData(prev =>
        prev.map(e => (e._id === event._id ? withPair(e, hadIt) : e)),
      );
      console.error('Failed to toggle event reaction:', error);
    }
  };

  // --- RSVP (Going / Maybe / Can't make it) --------------------------------
  // "Going" is represented by roster membership (which owns the spot count);
  // "maybe"/"cant" live in the event's rsvps array. A user is only ever in
  // one place, and tapping the currently-active state clears it.
  const getMyRsvp = (event: Event): 'going' | 'maybe' | 'cant' | 'none' => {
    const uid = userData?._id;
    if (!uid) {
      return 'none';
    }
    if ((event.roster || []).some(p => p.userId === uid)) {
      return 'going';
    }
    const mine = (event.rsvps || []).find(r => r.userId === uid);
    return mine ? mine.status : 'none';
  };

  const applyRsvpOptimistic = (
    eventId: string,
    next: 'going' | 'maybe' | 'cant' | 'none',
  ) => {
    if (!userData) {
      return;
    }
    const uid = userData._id;
    setEventData(prev =>
      prev.map(e => {
        if (e._id !== eventId) {
          return e;
        }
        const roster = (e.roster || []).filter(p => p.userId !== uid);
        const rsvps = (e.rsvps || []).filter(r => r.userId !== uid);
        if (next === 'going') {
          roster.push({
            userId: uid,
            username: userData.username || '',
            profilePicUrl: userData.profilePicUrl,
            paidStatus: 'Unpaid',
          });
        } else if (next === 'maybe' || next === 'cant') {
          rsvps.push({
            userId: uid,
            username: userData.username || '',
            profilePicUrl: userData.profilePicUrl,
            status: next,
          });
        }
        return {
          ...e,
          roster,
          rsvps,
          rosterSpotsFilled: roster.length,
        };
      }),
    );
  };

  const handleRsvp = async (
    event: Event,
    status: 'going' | 'maybe' | 'cant',
  ) => {
    if (!userData) {
      return;
    }
    const current = getMyRsvp(event);
    const next = current === status ? 'none' : status;

    // Instant feedback; the socket "events:refresh" reconciles with server
    // truth (and rolls us back on failure below).
    applyRsvpOptimistic(event._id, next);

    try {
      const token = await AsyncStorage.getItem('userToken');
      const headers = {Authorization: `Bearer ${token}`};
      if (next === 'none') {
        if (current === 'going') {
          await axios.delete(
            `${API_BASE_URL}/events/${event._id}/roster/${encodeURIComponent(
              userData.username || '',
            )}`,
            {headers},
          );
        } else {
          await axios.delete(
            `${API_BASE_URL}/events/${event._id}/rsvp/${userData._id}`,
            {headers},
          );
        }
      } else {
        await axios.put(
          `${API_BASE_URL}/events/${event._id}/rsvp`,
          {
            userId: userData._id,
            username: userData.username,
            profilePicUrl: userData.profilePicUrl,
            status: next,
          },
          {headers},
        );
      }
    } catch (error: any) {
      if (error?.response?.data?.full) {
        Alert.alert(
          t('events.eventFull') || 'Event full',
          t('events.eventFullMessage') ||
            'This event is full right now. You can join the waitlist from the event page.',
        );
      }
      // Reconcile with server truth after any failure.
      fetchLatestEvents();
    }
  };

  // Ask the owner of a gated public event for access. Optimistically flips the
  // card to "Requested…"; the details unlock (via refetch) once approved.
  const handleMessageHost = (event: Event) => {
    if (!event.createdBy || event.createdBy === userData?._id) {
      return;
    }
    navigation.navigate('Messages', {
      screen: 'DmThread',
      params: {
        userId: event.createdBy,
        username: event.createdByUsername,
        profilePicUrl: event.createdByProfilePicUrl,
      },
    });
  };

  const handleJoinRequest = async (event: Event) => {
    if (!userData) {
      return;
    }
    setEventData(prev =>
      prev.map(e =>
        e._id === event._id ? {...e, myJoinRequestStatus: 'pending'} : e,
      ),
    );
    try {
      const token = await AsyncStorage.getItem('userToken');
      await axios.post(
        `${API_BASE_URL}/events/${event._id}/join-request`,
        {
          username: userData.username,
          profilePicUrl: userData.profilePicUrl,
        },
        {headers: {Authorization: `Bearer ${token}`}},
      );
    } catch (error) {
      setEventData(prev =>
        prev.map(e =>
          e._id === event._id ? {...e, myJoinRequestStatus: 'none'} : e,
        ),
      );
      fetchLatestEvents();
    }
  };

  // Open-join public events (`allowJoinRequests === false`): add self to roster.
  const handleOpenJoin = async (event: Event) => {
    if (!userData?._id) {
      return;
    }
    try {
      const token = await AsyncStorage.getItem('userToken');
      await axios.post(
        `${API_BASE_URL}/events/${event._id}/roster`,
        {
          participant: {
            userId: userData._id,
            username: userData.username,
            profilePicUrl: userData.profilePicUrl,
          },
        },
        {headers: {Authorization: `Bearer ${token}`}},
      );
      fetchLatestEvents();
    } catch (error: any) {
      if (error?.response?.data?.full) {
        Alert.alert(
          t('events.eventFull') || 'Event full',
          t('events.eventFullMessage') ||
            'This event is full right now. You can join the waitlist from the event page.',
        );
      } else {
        Alert.alert(
          t('common.error') || 'Error',
          error?.response?.data?.message ||
            t('events.joinError') ||
            'Could not join this event.',
        );
      }
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
    const isEventFull =
      item.totalSpots > 0 && item.rosterSpotsFilled >= item.totalSpots;
    const isCreator = userData?._id === item.createdBy;
    const username = item.createdByUsername || '';
    const creatorInfo = creatorInfoMap[username];
    const creatorProfilePicUrl =
      item.createdByProfilePicUrl || creatorInfo?.profilePicUrl;
    const creatorInitials = getCreatorInitials(creatorInfo?.name, username);
    const reactionSummary = summarizeReactions(item, myUserId);
    const commentCount = localCommentCounts[item._id] ?? item.commentCount ?? 0;

    const showOptionsMenu = () => {
      setOptionsMenuEvent(item);
    };

    // Locked teaser for gated public events the viewer hasn't been approved
    // for. Shows just enough to decide (name, type, organizer, when, spots)
    // and a request-to-join CTA — no address, map, roster, or discussion.
    if (item.isGated) {
      const isPending = item.myJoinRequestStatus === 'pending';
      return (
        <View style={themedStyles.card}>
          <View style={themedStyles.cardHeader}>
            <View style={themedStyles.cardHeaderLeft}>
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
                  <Text style={themedStyles.avatarText}>{creatorInitials}</Text>
                </View>
              )}
              <View style={themedStyles.cardHeaderIdentity}>
                <Text style={themedStyles.cardHeaderUsername} numberOfLines={1}>
                  {username || t('events.anonymous') || 'Unknown'}
                </Text>
                <View style={themedStyles.cardHeaderMetaRow}>
                  <FontAwesomeIcon
                    icon={faUserGroup}
                    size={10}
                    color={colors.secondaryText}
                  />
                  <Text style={themedStyles.cardHeaderMeta}>
                    {t('events.lfgBadge') || 'Looking for group'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

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
                icon={faCalendarAlt}
                size={12}
                color={colors.secondaryText}
              />
              <Text style={themedStyles.detailText}>
                {item.date} ·{' '}
                {formatEventTimeRange(
                  item.date,
                  item.time,
                  item.durationMinutes,
                )}
              </Text>
            </View>

            <View style={themedStyles.detailRow}>
              <FontAwesomeIcon
                icon={faUsers}
                size={12}
                color={colors.secondaryText}
              />
              <Text style={themedStyles.detailText}>
                {item.totalSpots > 0
                  ? `${item.rosterSpotsFilled}/${item.totalSpots} ${t(
                      'events.playersJoined',
                    )}`
                  : `${item.rosterSpotsFilled} ${t(
                      'events.playersJoined',
                    )} · ${t('events.noLimit') || 'No limit'}`}
              </Text>
            </View>

            {item.showLocationPublicly && item.location ? (
              <View style={themedStyles.detailRow}>
                <FontAwesomeIcon
                  icon={faMapMarkerAlt}
                  size={12}
                  color={colors.secondaryText}
                />
                <Text style={themedStyles.detailText} numberOfLines={2}>
                  {item.location}
                </Text>
              </View>
            ) : null}

            <View style={themedStyles.gatedHintRow}>
              <FontAwesomeIcon
                icon={faComment}
                size={11}
                color={colors.secondaryText}
              />
              <Text style={themedStyles.gatedHintText}>
                {item.allowJoinRequests === false
                  ? t('events.openJoinHint') ||
                    'Anyone can join this event. Message the host anytime.'
                  : t('events.lfgHint') ||
                    "Message the host with a question, then request to join when you're ready."}
              </Text>
            </View>
          </View>

          <View style={themedStyles.gatedActionsRow}>
            <TouchableOpacity
              style={themedStyles.messageHostButton}
              onPress={() => handleMessageHost(item)}
              activeOpacity={0.8}>
              <FontAwesomeIcon
                icon={faComment}
                size={14}
                color={colors.text}
              />
              <Text style={themedStyles.messageHostButtonText} numberOfLines={1}>
                {t('events.messageHost') || 'Message host'}
              </Text>
            </TouchableOpacity>
            {item.allowJoinRequests === false ? (
              <TouchableOpacity
                style={[themedStyles.requestButton, {flex: 1, marginTop: 0}]}
                onPress={() => handleOpenJoin(item)}
                activeOpacity={0.8}>
                <FontAwesomeIcon icon={faUserPlus} size={14} color="#fff" />
                <Text style={themedStyles.requestButtonText} numberOfLines={1}>
                  {t('events.joinEvent') || 'Join Event'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  themedStyles.requestButton,
                  isPending && themedStyles.requestButtonPending,
                ]}
                onPress={() => !isPending && handleJoinRequest(item)}
                disabled={isPending}
                activeOpacity={0.8}>
                <FontAwesomeIcon
                  icon={isPending ? faCheck : faUserPlus}
                  size={14}
                  color={isPending ? colors.secondaryText : '#fff'}
                />
                <Text
                  style={[
                    themedStyles.requestButtonText,
                    isPending && themedStyles.requestButtonTextPending,
                  ]}
                  numberOfLines={1}>
                  {isPending
                    ? t('events.requested') || 'Requested'
                    : t('events.requestToJoin') || 'Request to join'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

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
                <Text style={themedStyles.avatarText}>{creatorInitials}</Text>
              </View>
            )}
            <View style={themedStyles.cardHeaderIdentity}>
              <Text style={themedStyles.cardHeaderUsername} numberOfLines={1}>
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
              {/* Group affiliation row — promoted out of the meta row
                  because the group is more than incidental metadata; it
                  tells you whose crew this event belongs to. Renders
                  only when the event has a Group attached. */}
              {item.groupName ? (
                <TouchableOpacity
                  style={themedStyles.cardHeaderGroupRow}
                  activeOpacity={0.6}
                  onPress={() => openGroup(item.groupId)}
                  disabled={!item.groupId}
                  hitSlop={{top: 6, bottom: 6, left: 4, right: 4}}>
                  <FontAwesomeIcon
                    icon={faUserGroup}
                    size={11}
                    color={colors.primary}
                  />
                  <Text
                    style={themedStyles.cardHeaderGroupName}
                    numberOfLines={1}>
                    {item.groupName}
                  </Text>
                  {item.groupMembersPreview &&
                  item.groupMembersPreview.length > 0 ? (
                    <RosterAvatarStrip
                      members={item.groupMembersPreview}
                      maxVisible={3}
                      size={20}
                      overlap={7}
                    />
                  ) : null}
                </TouchableOpacity>
              ) : null}
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
              <Text style={themedStyles.detailText} numberOfLines={2}>
                {item.isVirtual
                  ? item.location
                    ? `${t('events.virtualLocationBadge') || 'Online / other'} · ${item.location}`
                    : t('events.virtualLocationBadge') || 'Online / other'
                  : item.location}
              </Text>
            </View>

            <View style={themedStyles.detailRow}>
              <FontAwesomeIcon
                icon={faCalendarAlt}
                size={12}
                color={colors.secondaryText}
              />
              <Text style={themedStyles.detailText}>
                {item.date} ·{' '}
                {formatEventTimeRange(
                  item.date,
                  item.time,
                  item.durationMinutes,
                )}
              </Text>
            </View>

            <View style={themedStyles.detailRow}>
              <FontAwesomeIcon
                icon={faUsers}
                size={12}
                color={colors.secondaryText}
              />
              <Text style={themedStyles.detailText}>
                {item.totalSpots > 0
                  ? `${item.rosterSpotsFilled}/${item.totalSpots} ${t(
                      'events.playersJoined',
                    )}`
                  : `${item.rosterSpotsFilled} ${t(
                      'events.playersJoined',
                    )} · ${t('events.noLimit') || 'No limit'}`}
                {isEventFull && item.waitlist && item.waitlist.length > 0
                  ? ` · ${item.waitlist.length} waitlisted`
                  : ''}
              </Text>
            </View>

            {!isPast && (
              <CountdownTimer
                eventDate={item.date}
                eventTime={item.time}
                durationMinutes={item.durationMinutes}
              />
            )}
          </View>
        </TouchableOpacity>

        {/* Physical events get a map preview; virtual ones already show
            "Online / other · …" in the detail row above. */}
        {!item.isVirtual ? (
        <TouchableOpacity
          style={themedStyles.mapEmbed}
          onPress={() => openMapsForEvent(item, t, presentMapPicker)}
          activeOpacity={0.85}>
          {(() => {
            const coords =
              item.latitude && item.longitude
                ? {latitude: item.latitude, longitude: item.longitude}
                : getCoordinatesFromLocation(item.location || '');

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
            <FontAwesomeIcon icon={faLocationArrow} size={11} color="#fff" />
            <Text style={themedStyles.mapEmbedOverlayText}>
              {t('events.getDirections')}
            </Text>
          </View>
        </TouchableOpacity>
        ) : null}

        {/* RSVP control — Going / Maybe / Can't make it. Only invite-only
            events use the 3-way RSVP: you were invited, so you reply. Public
            events use a single Join toggle (below) and private events have no
            one to RSVP. "Going" adds you to the roster; the other two record a
            reply without taking a spot. */}
        {!isPast && item.privacy === 'invite-only'
          ? (() => {
              const myRsvp = getMyRsvp(item);
              const goingCount =
                typeof item.rosterSpotsFilled === 'number'
                  ? item.rosterSpotsFilled
                  : (item.roster || []).length;
              const maybeCount = (item.rsvps || []).filter(
                r => r.status === 'maybe',
              ).length;
              const cantCount = (item.rsvps || []).filter(
                r => r.status === 'cant',
              ).length;
              const summaryParts = [
                goingCount > 0
                  ? `${goingCount} ${t('events.rsvpGoing') || 'Going'}`
                  : '',
                maybeCount > 0
                  ? `${maybeCount} ${t('events.rsvpMaybe') || 'Maybe'}`
                  : '',
                cantCount > 0
                  ? `${cantCount} ${t('events.rsvpCant') || "Can't make it"}`
                  : '',
              ].filter(Boolean);
              return (
                <View style={themedStyles.rsvpContainer}>
                  <View style={themedStyles.rsvpButtonsRow}>
                    <TouchableOpacity
                      style={[
                        themedStyles.rsvpButton,
                        myRsvp === 'going' && themedStyles.rsvpButtonGoingActive,
                      ]}
                      onPress={() => handleRsvp(item, 'going')}
                      activeOpacity={0.8}>
                      <FontAwesomeIcon
                        icon={faCheck}
                        size={13}
                        color={myRsvp === 'going' ? '#fff' : colors.secondaryText}
                      />
                      <Text
                        style={[
                          themedStyles.rsvpButtonText,
                          myRsvp === 'going' && themedStyles.rsvpButtonTextActive,
                        ]}>
                        {t('events.rsvpGoing') || 'Going'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        themedStyles.rsvpButton,
                        myRsvp === 'maybe' && themedStyles.rsvpButtonMaybeActive,
                      ]}
                      onPress={() => handleRsvp(item, 'maybe')}
                      activeOpacity={0.8}>
                      <FontAwesomeIcon
                        icon={faQuestion}
                        size={13}
                        color={myRsvp === 'maybe' ? '#fff' : colors.secondaryText}
                      />
                      <Text
                        style={[
                          themedStyles.rsvpButtonText,
                          myRsvp === 'maybe' && themedStyles.rsvpButtonTextActive,
                        ]}>
                        {t('events.rsvpMaybe') || 'Maybe'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        themedStyles.rsvpButton,
                        myRsvp === 'cant' && themedStyles.rsvpButtonCantActive,
                      ]}
                      onPress={() => handleRsvp(item, 'cant')}
                      activeOpacity={0.8}>
                      <FontAwesomeIcon
                        icon={faTimes}
                        size={13}
                        color={myRsvp === 'cant' ? '#fff' : colors.secondaryText}
                      />
                      <Text
                        style={[
                          themedStyles.rsvpButtonText,
                          myRsvp === 'cant' && themedStyles.rsvpButtonTextActive,
                        ]}>
                        {t('events.rsvpCant') || "Can't make it"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {summaryParts.length > 0 ? (
                    <Text style={themedStyles.rsvpSummary}>
                      {summaryParts.join(' · ')}
                    </Text>
                  ) : null}
                </View>
              );
            })()
          : null}

        {/* Public (ungated — you're the creator or already approved): a single
            Join/Going toggle. Requesters see the locked teaser instead. */}
        {!isPast && item.privacy === 'public'
          ? (() => {
              const isGoing = getMyRsvp(item) === 'going';
              const goingCount =
                typeof item.rosterSpotsFilled === 'number'
                  ? item.rosterSpotsFilled
                  : (item.roster || []).length;
              const canMessageHost =
                !isCreator && !!item.createdBy && item.createdBy !== myUserId;
              return (
                <View style={themedStyles.rsvpContainer}>
                  <View
                    style={[themedStyles.gatedActionsRow, {marginTop: 0}]}>
                    {canMessageHost ? (
                      <TouchableOpacity
                        style={themedStyles.messageHostButton}
                        onPress={() => handleMessageHost(item)}
                        activeOpacity={0.8}>
                        <FontAwesomeIcon
                          icon={faComment}
                          size={14}
                          color={colors.text}
                        />
                        <Text
                          style={themedStyles.messageHostButtonText}
                          numberOfLines={1}>
                          {t('events.messageHost') || 'Message host'}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      style={[
                        themedStyles.publicJoinButton,
                        isGoing && themedStyles.rsvpButtonGoingActive,
                        canMessageHost ? {flex: 1, alignSelf: 'stretch'} : null,
                      ]}
                      onPress={() => handleRsvp(item, 'going')}
                      activeOpacity={0.8}>
                      <FontAwesomeIcon
                        icon={faCheck}
                        size={14}
                        color={isGoing ? '#fff' : colors.secondaryText}
                      />
                      <Text
                        style={[
                          themedStyles.rsvpButtonText,
                          isGoing && themedStyles.rsvpButtonTextActive,
                        ]}>
                        {isGoing
                          ? t('events.rsvpGoing') || 'Going'
                          : t('events.joinEvent') || 'Join'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {goingCount > 0 ? (
                    <Text style={themedStyles.rsvpSummary}>
                      {`${goingCount} ${t('events.rsvpGoing') || 'Going'}`}
                    </Text>
                  ) : null}
                </View>
              );
            })()
          : null}

        {/* Reactions. One pill per distinct emoji: tap to add or remove your
            own, long-press to see who reacted. The "+" is always present so
            there's an entry point on a card nobody has reacted to yet. */}
        <View style={themedStyles.reactionRow}>
          {reactionSummary.map(entry => (
            <TouchableOpacity
              key={entry.emoji}
              style={[
                themedStyles.reactionPill,
                entry.mine && themedStyles.reactionPillMine,
              ]}
              onPress={() => toggleEventReaction(item, entry.emoji)}
              onLongPress={() => showEventReactedBy(item)}
              hitSlop={{top: 6, bottom: 6, left: 2, right: 2}}>
              <Text style={themedStyles.reactionPillEmoji}>{entry.emoji}</Text>
              <Text
                style={[
                  themedStyles.reactionPillCount,
                  entry.mine && themedStyles.reactionPillCountMine,
                ]}>
                {entry.count}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={themedStyles.reactionAddButton}
            onPress={() => setReactionPickerEvent(item)}
            hitSlop={{top: 6, bottom: 6, left: 6, right: 6}}>
            <FontAwesomeIcon
              icon={faPlus}
              size={11}
              color={colors.secondaryText}
            />
          </TouchableOpacity>
        </View>

        {/* Engagement Footer */}
        <View style={themedStyles.engagementRow}>
          <TouchableOpacity
            style={themedStyles.engagementButton}
            onPress={() => handleDiscussEvent(item)}
            hitSlop={{top: 8, bottom: 8, left: 4, right: 4}}>
            <FontAwesomeIcon
              icon={faComments}
              size={16}
              color={isCommentsExpanded ? colors.primary : colors.secondaryText}
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
                style={[themedStyles.engagementCount, {color: colors.primary}]}>
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
      return (
        <View key={groupId}>
          {renderEventCard({item: previewEvent})}
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
      {/* Compact top bar: menu · search · filter · venues · notifications */}
      <View style={themedStyles.header}>
        <HamburgerMenu />
        <View style={themedStyles.headerSearch}>
          <View style={themedStyles.searchContainer}>
            <FontAwesomeIcon
              icon={faSearch}
              size={13}
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
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                style={themedStyles.clearButton}
                onPress={() => setSearchQuery('')}>
                <FontAwesomeIcon
                  icon={faTimes}
                  size={13}
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
            onPress={() => setShowFilterModal(true)}
            accessibilityLabel={t('events.filters') || 'Filters'}>
            <FontAwesomeIcon
              icon={faFilter}
              size={14}
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
        <View style={themedStyles.headerRight}>
          <TouchableOpacity
            style={themedStyles.findPlaceButton}
            onPress={() => navigation.navigate('VenueList' as never)}
            accessibilityLabel={t('events.findAPlace') || 'Find a place'}>
            <FontAwesomeIcon
              icon={faBuilding}
              size={18}
              color={colors.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={themedStyles.bellButton}
            onPress={() => navigation.navigate('Notifications' as never)}
            accessibilityLabel={
              t('navigation.notifications') || 'Notifications'
            }>
            <FontAwesomeIcon icon={faBell} size={20} color={colors.primary} />
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
                : profileFilter === 'upcoming'
                  ? t('profile.showingUpcoming') ||
                    'Showing your upcoming events'
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
        {/* Active Filters Display — activity types are omitted here because
            the chip bar above already shows them selected; only modal-driven
            filters (date/available/proximity) surface as removable tags. */}
        {hasTagRowFilters && (
          <View style={themedStyles.activeFiltersContainer}>
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
            {showMyEventsOnly && (
              <TouchableOpacity
                style={themedStyles.activeFilterTag}
                onPress={() => setShowMyEventsOnly(false)}>
                <Text style={themedStyles.activeFilterTagText}>
                  👤 {t('events.myEventsOnly') || 'My events'}
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
                {isEditing ? t('events.editEvent') : t('events.createEvent')}
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
                {/* Location: Place (maps) or Online/other (free-text label). */}
                <View style={themedStyles.locationModeRow}>
                  {(
                    [
                      {value: false, fallback: 'Place'},
                      {value: true, fallback: 'Online / other'},
                    ] as const
                  ).map(option => {
                    const selected = !!newEvent.isVirtual === option.value;
                    return (
                      <TouchableOpacity
                        key={String(option.value)}
                        style={[
                          themedStyles.locationModePill,
                          selected && themedStyles.locationModePillSelected,
                        ]}
                        onPress={() =>
                          setNewEvent(prev => ({
                            ...prev,
                            isVirtual: option.value,
                            ...(option.value
                              ? {
                                  latitude: undefined,
                                  longitude: undefined,
                                  venueId: undefined,
                                  venueName: undefined,
                                  location: prev.isVirtual ? prev.location : '',
                                }
                              : {
                                  location: prev.isVirtual ? '' : prev.location,
                                }),
                          }))
                        }
                        activeOpacity={0.7}>
                        <Text
                          style={[
                            themedStyles.locationModePillText,
                            selected &&
                              themedStyles.locationModePillTextSelected,
                          ]}>
                          {option.value
                            ? t('events.locationVirtual') || option.fallback
                            : t('events.locationPlace') || option.fallback}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {newEvent.isVirtual ? (
                  <TextInput
                    style={themedStyles.modalInput}
                    placeholder={
                      t('events.virtualLocationPlaceholder') ||
                      'e.g. Friday night gaming, Discord, my place'
                    }
                    placeholderTextColor={colors.placeholder || '#888'}
                    value={newEvent.location}
                    onChangeText={text =>
                      setNewEvent({...newEvent, location: text})
                    }
                  />
                ) : (
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
                            isVirtual: false,
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
                          console.warn(
                            'GooglePlacesAutocomplete error:',
                            error,
                          );
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
                )}

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

                {/* How long the event runs. Stored as a duration; the end time
                    shown here is derived so the organizer can sanity-check it.
                    "Open" clears the duration so the card shows a start only. */}
                <View style={themedStyles.durationSection}>
                  <View style={themedStyles.durationHeaderRow}>
                    <Text style={themedStyles.durationLabel}>
                      {t('events.duration')}
                    </Text>
                    {newEvent.time ? (
                      <Text style={themedStyles.durationEndHint}>
                        {newEvent.durationMinutes
                          ? t('events.endsAt', {
                              time: formatEventTimeRange(
                                newEvent.date || new Date().toDateString(),
                                newEvent.time,
                                newEvent.durationMinutes,
                              ).split(' – ')[1],
                            })
                          : t('events.openEnded') || 'Open-ended'}
                      </Text>
                    ) : null}
                  </View>
                  <View style={themedStyles.durationRow}>
                    {DURATION_OPTIONS.map(option => {
                      const selected =
                        newEvent.durationMinutes === option.minutes;
                      return (
                        <TouchableOpacity
                          key={option.label}
                          style={[
                            themedStyles.durationPill,
                            selected && themedStyles.durationPillSelected,
                          ]}
                          onPress={() =>
                            setNewEvent(prev => ({
                              ...prev,
                              durationMinutes: option.minutes,
                            }))
                          }
                          activeOpacity={0.7}>
                          <Text
                            style={[
                              themedStyles.durationPillText,
                              selected && themedStyles.durationPillTextSelected,
                            ]}>
                            {option.minutes === null
                              ? t('events.openEndedShort') || 'Open'
                              : option.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Recurring Event toggle */}
                <View style={themedStyles.recurrenceSection}>
                    <View style={themedStyles.recurrenceToggleRow}>
                      <View style={themedStyles.flexOne}>
                        <Text style={themedStyles.recurrenceLabel}>
                          Recurring Event
                        </Text>
                        <Text style={themedStyles.recurrenceDescription}>
                          {isEditing
                            ? 'Turn on to repeat this event on a schedule, or off to make it a single event'
                            : 'Automatically create multiple events on a schedule'}
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
                          {isEditing
                            ? 'Occurrences (from this one forward)'
                            : 'Number of Events'}
                        </Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={themedStyles.recurrenceCountScroll}>
                          <TouchableOpacity
                            style={[
                              themedStyles.recurrenceCountOption,
                              newEvent.recurrenceIndefinite &&
                                themedStyles.recurrenceCountSelected,
                            ]}
                            onPress={() =>
                              setNewEvent({
                                ...newEvent,
                                recurrenceIndefinite: true,
                                recurrenceCount: 0,
                              })
                            }>
                            <Text
                              style={[
                                themedStyles.recurrenceCountText,
                                newEvent.recurrenceIndefinite &&
                                  themedStyles.recurrenceCountTextSelected,
                              ]}>
                              {t('events.noEnd') || 'No end'}
                            </Text>
                          </TouchableOpacity>
                          {recurrenceCountOptions.map(count => (
                            <TouchableOpacity
                              key={count}
                              style={[
                                themedStyles.recurrenceCountOption,
                                !newEvent.recurrenceIndefinite &&
                                  newEvent.recurrenceCount === count &&
                                  themedStyles.recurrenceCountSelected,
                              ]}
                              onPress={() =>
                                setNewEvent({
                                  ...newEvent,
                                  recurrenceIndefinite: false,
                                  recurrenceCount: count,
                                })
                              }>
                              <Text
                                style={[
                                  themedStyles.recurrenceCountText,
                                  !newEvent.recurrenceIndefinite &&
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
                            ? newEvent.recurrenceIndefinite
                              ? `${newEvent.recurrenceFrequency}, no end date, starting ${newEvent.date}`
                              : `${newEvent.recurrenceCount} events, ${newEvent.recurrenceFrequency}, starting ${newEvent.date}`
                            : 'Select a date above to see the schedule'}
                        </Text>
                      </View>
                    )}
                  </View>

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
                      ? rosterSizeLabel(
                          newEvent.totalSpots,
                          t('events.noLimit') || 'No limit',
                        )
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
                            label={rosterSizeLabel(
                              value,
                              t('events.noLimit') || 'No limit',
                            )}
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
                    // If the event already has a type that isn't a preset
                    // (e.g. a previously entered custom one), open on "Custom"
                    // with the text prefilled so it stays editable.
                    const isPreset = activityOptions.some(
                      o => o.label === newEvent.eventType,
                    );
                    if (newEvent.eventType && !isPreset) {
                      setTempEventType('Custom');
                      setCustomEventType(newEvent.eventType);
                    } else {
                      setTempEventType(newEvent.eventType || '');
                      setCustomEventType('');
                    }
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
                    {tempEventType === 'Custom' && (
                      <TextInput
                        style={themedStyles.modalInput}
                        value={customEventType}
                        onChangeText={setCustomEventType}
                        placeholder={
                          t('events.customEventTypePlaceholder') ||
                          'Enter a custom activity'
                        }
                        placeholderTextColor={colors.placeholder}
                        maxLength={40}
                      />
                    )}
                    <TouchableOpacity
                      onPress={() => {
                        // Resolve "Custom" to the typed value (falling back to
                        // "Other" if left blank). Reset jersey colors on change.
                        const resolvedType =
                          tempEventType === 'Custom'
                            ? customEventType.trim() || 'Other'
                            : tempEventType;
                        setNewEvent({
                          ...newEvent,
                          eventType: resolvedType,
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

                {/* Public-event creator controls */}
                {newEvent.privacy === 'public' && (
                  <View style={themedStyles.publicControlsContainer}>
                    <View style={themedStyles.publicControlRow}>
                      <View style={themedStyles.publicControlText}>
                        <Text style={themedStyles.publicControlLabel}>
                          {t('events.requireApproval') ||
                            'Require approval to join'}
                        </Text>
                        <Text style={themedStyles.publicControlDesc}>
                          {t('events.requireApprovalDesc') ||
                            'On: people request and you approve. Off: anyone can join.'}
                        </Text>
                      </View>
                      <Switch
                        value={newEvent.allowJoinRequests}
                        onValueChange={value =>
                          setNewEvent({...newEvent, allowJoinRequests: value})
                        }
                        trackColor={{false: colors.border, true: colors.primary}}
                      />
                    </View>

                    <View style={themedStyles.publicControlRow}>
                      <View style={themedStyles.publicControlText}>
                        <Text style={themedStyles.publicControlLabel}>
                          {t('events.showLocationPublicly') ||
                            'Show location publicly'}
                        </Text>
                        <Text style={themedStyles.publicControlDesc}>
                          {t('events.showLocationPubliclyDesc') ||
                            'Reveal the address and map before people are approved.'}
                        </Text>
                      </View>
                      <Switch
                        value={newEvent.showLocationPublicly}
                        onValueChange={value =>
                          setNewEvent({
                            ...newEvent,
                            showLocationPublicly: value,
                          })
                        }
                        trackColor={{false: colors.border, true: colors.primary}}
                      />
                    </View>
                  </View>
                )}

                {/* Invite Users Section - only for invite-only events */}
                {newEvent.privacy === 'invite-only' && (
                  <View style={themedStyles.inviteContainer}>
                    <Text style={themedStyles.privacyLabel}>
                      {t('events.inviteUsers') || 'Invite Users'}
                    </Text>

                    {/* Group picker affordance — one tap to snapshot the
                        members of a saved Group into the invite list. */}
                    {newEvent.groupName ? (
                      <View style={themedStyles.attachedGroupPill}>
                        <FontAwesomeIcon
                          icon={faUserGroup}
                          size={13}
                          color={colors.primary}
                        />
                        <Text style={themedStyles.attachedGroupText}>
                          {newEvent.groupName}
                        </Text>
                        <TouchableOpacity
                          onPress={handleGroupCleared}
                          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                          <FontAwesomeIcon
                            icon={faTimes}
                            size={12}
                            color={colors.primary}
                          />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={themedStyles.inviteGroupButton}
                        onPress={() => setGroupPickerVisible(true)}>
                        <FontAwesomeIcon
                          icon={faUserGroup}
                          size={14}
                          color={colors.primary}
                        />
                        <Text style={themedStyles.inviteGroupButtonText}>
                          {t('events.inviteAGroup') || 'Invite a group'}
                        </Text>
                      </TouchableOpacity>
                    )}

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
        {/* Nested inside the Create Event modal so iOS presents it on
            top of the parent modal. Rendering it as a sibling outside
            the parent <Modal> causes the second modal to be obscured
            entirely on iOS. */}
        <GroupPickerModal
          visible={groupPickerVisible}
          onClose={() => setGroupPickerVisible(false)}
          onSelect={handleGroupSelected}
        />
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
                <FontAwesomeIcon
                  icon={faTimes}
                  size={20}
                  color={colors.secondaryText}
                />
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

              {/* Match profile interests */}
              <View style={themedStyles.filterSection}>
                <Text style={themedStyles.filterSectionTitle}>
                  {t('events.interests') || 'Interests'}
                </Text>
                <TouchableOpacity
                  style={themedStyles.toggleOption}
                  onPress={handleFilterByInterestsToggle}
                  activeOpacity={0.7}>
                  <Text
                    style={[
                      themedStyles.toggleOptionText,
                      filterByInterests &&
                        themedStyles.toggleOptionTextSelected,
                    ]}>
                    {t('events.filterByInterestsDescription') ||
                      'Filter by my profile interests'}
                  </Text>
                  <View
                    style={[
                      themedStyles.toggleCheck,
                      filterByInterests && themedStyles.toggleCheckActive,
                    ]}>
                    {filterByInterests && (
                      <FontAwesomeIcon
                        icon={faCheck}
                        size={12}
                        color={colors.buttonText || '#fff'}
                      />
                    )}
                  </View>
                </TouchableOpacity>
              </View>

              {/* My Events Filter */}
              <View style={themedStyles.filterSection}>
                <Text style={themedStyles.filterSectionTitle}>
                  {t('events.myEvents') || 'My Events'}
                </Text>
                <TouchableOpacity
                  style={themedStyles.toggleOption}
                  onPress={() => setShowMyEventsOnly(!showMyEventsOnly)}
                  activeOpacity={0.7}>
                  <Text
                    style={[
                      themedStyles.toggleOptionText,
                      showMyEventsOnly && themedStyles.toggleOptionTextSelected,
                    ]}>
                    {t('events.myEventsOnlyDescription') ||
                      "Show only events I'm hosting or attending"}
                  </Text>
                  <View
                    style={[
                      themedStyles.toggleCheck,
                      showMyEventsOnly && themedStyles.toggleCheckActive,
                    ]}>
                    {showMyEventsOnly && (
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
                          proximityEnabled
                            ? colors.primary
                            : colors.secondaryText
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

      {/* Full emoji picker (pure-JS, no native module) */}
      <EmojiPicker
        open={!!reactionPickerEvent}
        onClose={() => setReactionPickerEvent(null)}
        onEmojiSelected={(picked: EmojiType) => {
          if (reactionPickerEvent) {
            toggleEventReaction(reactionPickerEvent, picked.emoji);
          }
          setReactionPickerEvent(null);
        }}
        enableSearchBar
        enableRecentlyUsed
        // Must not be "top": that flips the sheet with column-reverse, which
        // pushes the search field to the bottom where the keyboard covers it.
        categoryPosition="bottom"
        // The search results live in a category at the end of a horizontal
        // paging list, so the first keystroke otherwise animates a scroll
        // across every category in between. Both flags are needed: the
        // library ANDs enableCategoryChangeAnimation into the scroll directly,
        // while enableSearchAnimation is applied a render too late to stop
        // that first jump.
        enableCategoryChangeAnimation={false}
        enableSearchAnimation={false}
        theme={{
          backdrop: '#00000066',
          knob: colors.primary,
          container: colors.card || colors.background,
          header: colors.text,
          category: {
            icon: colors.secondaryText,
            iconActive: colors.buttonText || '#fff',
            container: colors.background,
            containerActive: colors.primary,
          },
          search: {
            text: colors.text,
            placeholder: colors.secondaryText,
            icon: colors.secondaryText,
            background: colors.background,
          },
        }}
      />

      {/* Reactions Modal */}
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
                <Text style={themedStyles.likesModalTitle}>
                  {likesModalData.title}
                </Text>
              </View>
              {likesModalData.users.length + likesModalData.anonymousCount >
                0 && (
                <Text style={themedStyles.likesModalCount}>
                  {`${
                    likesModalData.users.length + likesModalData.anonymousCount
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
                      {!!user.emoji && (
                        <Text style={themedStyles.likesModalEmoji}>
                          {user.emoji}
                        </Text>
                      )}
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
                  } ${t('events.reactedToThis') || 'reacted to this'}`}
                </Text>
              ) : (
                <Text style={themedStyles.likesModalEmpty}>
                  {t('events.noReactionsYet') || 'No reactions yet'}
                </Text>
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
