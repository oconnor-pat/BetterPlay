import React, {
  useState,
  useEffect,
  useMemo,
  useContext,
  useCallback,
  useRef,
} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  Animated,
  AppState,
  ActionSheetIOS,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {
  RouteProp,
  useRoute,
  useNavigation,
  useFocusEffect,
} from '@react-navigation/native';
import {useTheme} from '../ThemeContext/ThemeContext';
import axios from 'axios';
import {useEventContext} from '../../Context/EventContext';
import UserContext, {UserContextType} from '../UserContext';
import {API_BASE_URL} from '../../config/api';
import analyticsService from '../../services/AnalyticsService';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {useTranslation} from 'react-i18next';
import {RosterListSkeleton} from '../Skeleton';
import {
  faChevronDown,
  faChevronRight,
  faChevronUp,
  faUserPlus,
  faUsers,
  faCheck,
  faTimes,
  faFutbol,
  faEnvelope,
  faSearch,
  faPlus,
  faBell,
  faComment,
  faStar,
  faCalendarPlus,
  faEllipsisH,
  faInfoCircle,
} from '@fortawesome/free-solid-svg-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notificationService from '../../services/NotificationService';
import {addEventToCalendar} from '../../services/CalendarService';
import {useSocket} from '../../Context/SocketContext';
import {getEventDateTime, isEventEnded} from '../../utils/eventDateTime';
import EventRatingModal from '../EventRating/EventRatingModal';
import PlayerRatingModal, {
  PlayerRatingTarget,
} from '../EventRating/PlayerRatingModal';

/** Minimum ratings before showing the roster avatar chip. */
const ROSTER_RATING_MIN_COUNT = 3;

export interface Player {
  userId?: string;
  username: string;
  paidStatus: string;
  jerseyColor: string;
  position: string;
  profilePicUrl?: string;
}

type EventRosterRouteProp = RouteProp<
  {
    EventRoster: {
      eventId: string;
      eventName?: string;
      eventType?: string;
      date?: string;
      time?: string;
      location?: string;
      totalSpots?: number;
      roster?: Player[];
      jerseyColors?: string[];
      changedFields?: string;
      isVirtual?: boolean;
      // Recurring + Group context for the "live link" banner. When both
      // `isRecurring` and `groupName` are present, the banner tells the
      // user that future instances re-pull the group's roster.
      isRecurring?: boolean;
      groupId?: string;
      groupName?: string;
      openRating?: boolean;
    };
  },
  'EventRoster'
>;

const positionOptions: Record<string, string[]> = {
  Basketball: ['Guard', 'Forward', 'Center'],
  Hockey: ['Forward', 'Defense', 'Goalie'],
  Soccer: ['Forward', 'Midfielder', 'Defender', 'Goalkeeper'],
  'Figure Skating': ['Singles', 'Pairs', 'Ice Dance'],
  Tennis: ['Singles', 'Doubles'],
  Golf: ['Player'],
  Football: [
    'Quarterback',
    'Running Back',
    'Wide Receiver',
    'Lineman',
    'Defense',
  ],
  Rugby: ['Forward', 'Back'],
  Baseball: ['Pitcher', 'Catcher', 'Infield', 'Outfield'],
  Softball: ['Pitcher', 'Catcher', 'Infield', 'Outfield'],
  Lacrosse: ['Attack', 'Midfield', 'Defense', 'Goalie'],
  Volleyball: ['Setter', 'Outside Hitter', 'Middle Blocker', 'Libero'],
  // General activity roles
  'Trivia Night': ['Player', 'Team Captain', 'Host'],
  'Game Night': ['Player', 'Host'],
  Karaoke: ['Singer', 'Audience'],
  'Open Mic': ['Performer', 'Audience'],
  'Watch Party': ['Attendee', 'Host'],
  'Live Music': ['Attendee'],
  Hiking: ['Hiker', 'Guide'],
  Cycling: ['Cyclist', 'Guide'],
  Running: ['Runner', 'Pacer'],
  Yoga: ['Participant', 'Instructor'],
  Fishing: ['Angler'],
  Camping: ['Camper', 'Organizer'],
  'Book Club': ['Reader', 'Discussion Leader'],
  Workshop: ['Participant', 'Instructor'],
  Meetup: ['Attendee', 'Organizer'],
  Potluck: ['Guest', 'Host'],
  Volunteer: ['Volunteer', 'Coordinator'],
  Other: ['Participant'],
  Default: ['Participant'],
};

const sportEmojis: Record<string, string> = {
  Basketball: '🏀',
  Hockey: '🏒',
  Soccer: '⚽',
  'Figure Skating': '⛸️',
  Tennis: '🎾',
  Golf: '⛳',
  Football: '🏈',
  Rugby: '🏉',
  Baseball: '⚾',
  Softball: '🥎',
  Lacrosse: '🥍',
  Volleyball: '🏐',
  // Social & Entertainment
  'Trivia Night': '🧠',
  'Game Night': '🎲',
  Karaoke: '🎤',
  'Open Mic': '🎙️',
  'Watch Party': '📺',
  'Live Music': '🎵',
  // Outdoor & Fitness
  Hiking: '🥾',
  Cycling: '🚴',
  Running: '🏃',
  Yoga: '🧘',
  Fishing: '🎣',
  Camping: '🏕️',
  // Community
  'Book Club': '📚',
  Workshop: '🛠️',
  Meetup: '🤝',
  Potluck: '🍲',
  Volunteer: '💚',
  Other: '🎯',
};

const jerseyColors: Record<string, string> = {
  Red: '#E53935',
  Blue: '#1E88E5',
  Green: '#43A047',
  White: '#FAFAFA',
  Black: '#212121',
  Yellow: '#FDD835',
  Orange: '#FB8C00',
  Purple: '#8E24AA',
  Pink: '#D81B60',
  Other: '#757575',
};

// Light colors need dark text and a border for visibility
const positionRatios: Record<string, Record<string, number>> = {
  Basketball: {Guard: 2, Forward: 2, Center: 1},
  Hockey: {Forward: 3, Defense: 2, Goalie: 1},
  Soccer: {Forward: 3, Midfielder: 4, Defender: 4, Goalkeeper: 1},
  Football: {
    Quarterback: 1,
    'Running Back': 2,
    'Wide Receiver': 3,
    Lineman: 5,
    Defense: 5,
  },
  Rugby: {Forward: 8, Back: 7},
  Lacrosse: {Attack: 3, Midfield: 3, Defense: 3, Goalie: 1},
  Volleyball: {Setter: 1, 'Outside Hitter': 2, 'Middle Blocker': 2, Libero: 1},
  Baseball: {Pitcher: 1, Catcher: 1, Infield: 4, Outfield: 3},
  Softball: {Pitcher: 1, Catcher: 1, Infield: 4, Outfield: 3},
};

const getScaledPositionCounts = (
  sport: string,
  rosterSize: number,
  teamCount: number,
): Record<string, number> | null => {
  const ratios = positionRatios[sport];
  if (!ratios) {
    return null;
  }

  const ratioTotal = Object.values(ratios).reduce((sum, v) => sum + v, 0);
  const effectiveSize =
    teamCount > 1 ? Math.round(rosterSize / teamCount) : rosterSize;

  const scaled: Record<string, number> = {};
  let assigned = 0;
  const entries = Object.entries(ratios);

  entries.forEach(([pos, ratio], i) => {
    if (i === entries.length - 1) {
      scaled[pos] = Math.max(effectiveSize - assigned, 1);
    } else {
      const count = Math.max(
        Math.round((ratio / ratioTotal) * effectiveSize),
        1,
      );
      scaled[pos] = count;
      assigned += count;
    }
  });

  return scaled;
};

const lightJerseyColors = ['White', 'Yellow'];

const isLightColor = (colorName: string) =>
  lightJerseyColors.includes(colorName);

// Team sports that use jersey colors and paid status
const teamSports = [
  'Basketball',
  'Hockey',
  'Soccer',
  'Football',
  'Rugby',
  'Lacrosse',
  'Volleyball',
  'Baseball',
  'Softball',
  'Tennis',
  'Golf',
  'Figure Skating',
];

const isTeamSport = (type?: string) =>
  !!type &&
  teamSports.some(sport => sport.toLowerCase() === type.toLowerCase());

const getInitials = (name: string) => {
  if (!name) {
    return '?';
  }
  return name
    .split(' ')
    .map(part => part[0]?.toUpperCase())
    .join('')
    .slice(0, 2);
};

const ReservationCountdown: React.FC<{expiresAt: string; colors: any}> = ({
  expiresAt,
  colors,
}) => {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining('Expired');
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRemaining(`${mins}m ${secs.toString().padStart(2, '0')}s remaining`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <Text
      style={{
        color: remaining === 'Expired' ? colors.error : colors.secondaryText,
        fontSize: 12,
        fontWeight: '600',
        marginTop: 6,
      }}>
      ⏱ {remaining}
    </Text>
  );
};

const EventRoster: React.FC = () => {
  const route = useRoute<EventRosterRouteProp>();
  const navigation = useNavigation<any>();
  const {
    eventId,
    eventName: paramEventName,
    eventType: paramEventType,
    date: paramDate,
    time: paramTime,
    location: paramLocation,
    totalSpots: paramTotalSpots = 10,
    roster: initialRoster,
    jerseyColors: initialJerseyColors,
    changedFields: changedFieldsParam,
    isVirtual: paramIsVirtual,
    isRecurring: paramIsRecurring,
    groupId: paramGroupId,
    groupName: paramGroupName,
    openRating: paramOpenRating,
  } = route.params;
  const {colors} = useTheme();
  const {updateRosterSpots} = useEventContext();
  const {userData} = useContext(UserContext) as UserContextType;
  const {t} = useTranslation();
  const {subscribe: socketSubscribe, joinEvent, leaveEvent} = useSocket();

  // Jump to the event's Group (lives under a sibling bottom tab).
  const openGroup = (groupId?: string) => {
    if (!groupId) {
      return;
    }
    navigation.navigate('Groups', {
      screen: 'GroupDetail',
      params: {groupId},
    });
  };

  const highlightAnim = useRef(new Animated.Value(0)).current;
  const [highlightedFields, setHighlightedFields] = useState<Set<string>>(
    new Set(),
  );

  // State for event details (populated from params or fetched from API)
  const [eventName, setEventName] = useState(paramEventName || '');
  const [eventType, setEventType] = useState(paramEventType || '');
  const [date, setDate] = useState(paramDate || '');
  const [time, setTime] = useState(paramTime || '');
  const [location, setLocation] = useState(paramLocation || '');
  const [isVirtual, setIsVirtual] = useState(!!paramIsVirtual);
  const [totalSpots, setTotalSpots] = useState(paramTotalSpots);
  const [durationMinutes, setDurationMinutes] = useState<number | undefined>(
    undefined,
  );
  const [hostRatings, setHostRatings] = useState<
    Record<string, {average: number; count: number}>
  >({});
  const [playerRatings, setPlayerRatings] = useState<
    Record<string, {average: number; count: number}>
  >({});
  const [ratedPlayerIds, setRatedPlayerIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [hasRatedEvent, setHasRatedEvent] = useState(false);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [eventCreatedByUsername, setEventCreatedByUsername] = useState('');
  const [playerModalVisible, setPlayerModalVisible] = useState(false);
  const [playerModalTarget, setPlayerModalTarget] =
    useState<PlayerRatingTarget | null>(null);

  // State for event jersey colors (can be updated from backend)
  const [eventJerseyColors, setEventJerseyColors] = useState<
    string[] | undefined
  >(initialJerseyColors);

  // Filter jersey colors if event has specified team colors
  const availableJerseyColors = useMemo(() => {
    if (eventJerseyColors && eventJerseyColors.length === 2) {
      // Only show the 2 team colors specified for this event
      return Object.entries(jerseyColors)
        .filter(([name]) => eventJerseyColors.includes(name))
        .reduce(
          (acc, [name, color]) => ({...acc, [name]: color}),
          {} as Record<string, string>,
        );
    }
    // Show all colors if no team colors specified
    return jerseyColors;
  }, [eventJerseyColors]);

  const [roster, setRoster] = useState<Player[]>(initialRoster || []);
  const [username, setUsername] = useState(userData?.username || '');
  const [paidStatus, setPaidStatus] = useState('');
  const [jerseyColor, setJerseyColor] = useState('');
  const [position, setPosition] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [paidStatusModalVisible, setPaidStatusModalVisible] = useState(false);
  const [jerseyColorModalVisible, setJerseyColorModalVisible] = useState(false);
  const [positionModalVisible, setPositionModalVisible] = useState(false);

  const [loading, setLoading] = useState(true);
  const [savingRoster, setSavingRoster] = useState(false);
  const [addPlayerExpanded, setAddPlayerExpanded] = useState(false);

  const [activeTeamTab, setActiveTeamTab] = useState<string>('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'unpaid'>(
    'all',
  );
  // Details = event info / join / invites / RSVP. Roster = team tabs + players.
  const [surfaceTab, setSurfaceTab] = useState<'details' | 'roster'>('details');
  const [trackPayment, setTrackPayment] = useState(false);

  // Edit mode state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editPaidStatus, setEditPaidStatus] = useState('');
  const [editJerseyColor, setEditJerseyColor] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Event privacy and invite state
  const [eventPrivacy, setEventPrivacy] = useState<
    'public' | 'private' | 'invite-only'
  >('public');
  const [eventCreatedBy, setEventCreatedBy] = useState<string>('');
  const [invitedUsers, setInvitedUsers] = useState<string[]>([]);
  // Host-kicked users — blocked from rejoining until the host re-invites.
  const [removedUserIds, setRemovedUserIds] = useState<string[]>([]);
  // "Maybe"/"can't make it" replies. "Going" is roster membership, so this
  // only holds the other two states.
  const [rsvps, setRsvps] = useState<
    Array<{
      userId: string;
      username: string;
      profilePicUrl?: string;
      status: 'maybe' | 'cant';
    }>
  >([]);
  // Pending requests to join a gated public event (only returned to the
  // creator). Approving adds them to the roster; denying drops the request.
  const [joinRequests, setJoinRequests] = useState<
    Array<{userId: string; username: string; profilePicUrl?: string}>
  >([]);
  const [guestAddRequests, setGuestAddRequests] = useState<
    Array<{
      requestedBy: string;
      requestedByUsername: string;
      proposedUserId: string;
      proposedUsername: string;
      proposedProfilePicUrl?: string;
    }>
  >([]);
  const [inviteExpanded, setInviteExpanded] = useState(false);
  const [inviteSearchQuery, setInviteSearchQuery] = useState('');
  const [inviteSearchResults, setInviteSearchResults] = useState<
    {_id: string; username: string; name?: string; profilePicUrl?: string}[]
  >([]);
  const [loadingInviteSearch, setLoadingInviteSearch] = useState(false);
  const [pingingRsvpIds, setPingingRsvpIds] = useState<Set<string>>(new Set());
  const [pingingAllRsvp, setPingingAllRsvp] = useState(false);
  const [invitedUserDetails, setInvitedUserDetails] = useState<
    {_id: string; username: string; name?: string; profilePicUrl?: string}[]
  >([]);

  // Waitlist state
  const [waitlist, setWaitlist] = useState<
    {
      userId: string;
      username: string;
      profilePicUrl?: string;
      joinedAt: string;
    }[]
  >([]);
  const [joiningWaitlist, setJoiningWaitlist] = useState(false);

  // Spot reservation state
  const [spotReservation, setSpotReservation] = useState<{
    userId: string;
    username: string;
    profilePicUrl?: string;
    expiresAt: string;
  } | null>(null);

  useEffect(() => {
    if (changedFieldsParam) {
      const fields = changedFieldsParam.split(',').map(f => f.trim());
      setHighlightedFields(new Set(fields));
      highlightAnim.setValue(0);
      Animated.sequence([
        Animated.timing(highlightAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: false,
        }),
        Animated.delay(5000),
        Animated.timing(highlightAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: false,
        }),
      ]).start(() => {
        setHighlightedFields(new Set());
      });
    }
  }, [changedFieldsParam, highlightAnim]);

  const highlightBgColor = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', colors.primary + '40'],
  });

  // Check if current user is the event creator
  const isEventCreator = useMemo(() => {
    return userData?._id === eventCreatedBy;
  }, [userData?._id, eventCreatedBy]);

  const isUserOnRoster = useMemo(
    () =>
      roster.some(
        p =>
          (p.userId && p.userId === userData?._id) ||
          p.username === userData?.username,
      ),
    [roster, userData?._id, userData?.username],
  );

  const eventHasEnded = useMemo(
    () => isEventEnded(date, time, durationMinutes),
    [date, time, durationMinutes],
  );

  const canAddToCalendar = useMemo(
    () => !!getEventDateTime(date, time),
    [date, time],
  );

  const canRateEvent =
    !!userData?._id &&
    !isEventCreator &&
    isUserOnRoster &&
    eventHasEnded &&
    !hasRatedEvent;

  useEffect(() => {
    if (paramOpenRating && canRateEvent) {
      setRatingModalVisible(true);
    }
  }, [paramOpenRating, canRateEvent]);

  // Check if current user is invited to the event
  const isUserInvited = useMemo(() => {
    return invitedUsers.includes(userData?._id || '');
  }, [invitedUsers, userData?._id]);

  const isUserRemoved = useMemo(() => {
    return removedUserIds.map(String).includes(String(userData?._id || ''));
  }, [removedUserIds, userData?._id]);

  // Check if user can join this event
  const canJoinEvent = useMemo(() => {
    if (isUserRemoved && !isEventCreator) {
      return false;
    }
    // Public events: anyone can join
    if (eventPrivacy === 'public') {
      return true;
    }
    // Private events: anyone can join (they just can't see it in the list)
    if (eventPrivacy === 'private') {
      return true;
    }
    // Invite-only: only invited users or the creator can join
    if (eventPrivacy === 'invite-only') {
      return isEventCreator || isUserInvited;
    }
    return true;
  }, [eventPrivacy, isEventCreator, isUserInvited, isUserRemoved]);

  // Invitees / roster members can suggest guests for the creator to approve.
  const canSuggestGuests = useMemo(() => {
    return (
      eventPrivacy === 'invite-only' &&
      !isEventCreator &&
      (isUserInvited || isUserOnRoster)
    );
  }, [eventPrivacy, isEventCreator, isUserInvited, isUserOnRoster]);

  const isUserOnWaitlist = useMemo(() => {
    return waitlist.some(w => w.userId === userData?._id);
  }, [waitlist, userData?._id]);

  const userWaitlistPosition = useMemo(() => {
    const idx = waitlist.findIndex(w => w.userId === userData?._id);
    return idx >= 0 ? idx + 1 : 0;
  }, [waitlist, userData?._id]);

  const isEventFull = useMemo(() => {
    return totalSpots > 0 && roster.length >= totalSpots;
  }, [roster.length, totalSpots]);

  const hasActiveReservation = useMemo(() => {
    if (!spotReservation) {
      return false;
    }
    return new Date(spotReservation.expiresAt) > new Date();
  }, [spotReservation]);

  const isMyReservation = useMemo(() => {
    return hasActiveReservation && spotReservation?.userId === userData?._id;
  }, [hasActiveReservation, spotReservation, userData?._id]);

  // Calculate roster stats
  const rosterStats = useMemo(() => {
    const paidCount = roster.filter(p => p.paidStatus === 'Paid').length;
    const unpaidCount = roster.filter(p => p.paidStatus === 'Unpaid').length;
    const positionCounts: Record<string, number> = {};
    const teamCounts: Record<string, number> = {};

    roster.forEach(player => {
      positionCounts[player.position] =
        (positionCounts[player.position] || 0) + 1;
      teamCounts[player.jerseyColor] =
        (teamCounts[player.jerseyColor] || 0) + 1;
    });

    return {paidCount, unpaidCount, positionCounts, teamCounts};
  }, [roster]);

  const teamColors = useMemo((): string[] => {
    if (!isTeamSport(eventType)) {
      return [];
    }
    // Prefer the event's declared jersey pair so both teams stay selectable
    // even when one side is empty (no "All" fallback).
    if (eventJerseyColors && eventJerseyColors.length === 2) {
      return eventJerseyColors;
    }
    return Object.keys(rosterStats.teamCounts).filter(c => c !== 'N/A');
  }, [rosterStats.teamCounts, eventType, eventJerseyColors]);

  // Default / repair the selected team when colors load or change.
  useEffect(() => {
    if (teamColors.length < 2) {
      return;
    }
    if (!teamColors.includes(activeTeamTab)) {
      setActiveTeamTab(teamColors[0]);
    }
  }, [teamColors, activeTeamTab]);

  const filteredRoster = useMemo(() => {
    let players = roster;

    if (isTeamSport(eventType) && teamColors.length > 1 && activeTeamTab) {
      players = players.filter(p => p.jerseyColor === activeTeamTab);
    }

    if (
      trackPayment &&
      (paymentFilter === 'paid' || paymentFilter === 'unpaid')
    ) {
      players = players.filter(p =>
        paymentFilter === 'paid'
          ? p.paidStatus === 'Paid'
          : p.paidStatus === 'Unpaid',
      );
    }

    return players;
  }, [
    roster,
    activeTeamTab,
    paymentFilter,
    eventType,
    teamColors,
    trackPayment,
  ]);

  const scaledPositions = useMemo(() => {
    const numTeams = teamColors.length > 1 ? teamColors.length : 1;
    return getScaledPositionCounts(eventType, totalSpots, numTeams);
  }, [eventType, totalSpots, teamColors]);

  const positionSummary = useMemo(() => {
    const positions = positionOptions[eventType] || positionOptions.Default;
    const currentPlayers =
      isTeamSport(eventType) && teamColors.length > 1 && activeTeamTab
        ? roster.filter(p => p.jerseyColor === activeTeamTab)
        : roster;

    return positions.map(pos => {
      const filled = currentPlayers.filter(p => p.position === pos).length;
      const expected = scaledPositions ? scaledPositions[pos] || 0 : 0;
      return {position: pos, filled, expected};
    });
  }, [eventType, roster, activeTeamTab, teamColors, scaledPositions]);

  const playersGroupedByPosition = useMemo(() => {
    const groups: Record<string, Player[]> = {};
    const positions = positionOptions[eventType] || positionOptions.Default;
    positions.forEach(pos => {
      groups[pos] = [];
    });
    filteredRoster.forEach(player => {
      if (!groups[player.position]) {
        groups[player.position] = [];
      }
      groups[player.position].push(player);
    });
    return groups;
  }, [filteredRoster, eventType]);

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
        surfaceSegment: {
          flexDirection: 'row',
          backgroundColor: colors.inputBackground || colors.card,
          borderRadius: 14,
          padding: 4,
          marginHorizontal: 16,
          marginBottom: 10,
        },
        surfaceSegmentBtn: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingVertical: 10,
          borderRadius: 11,
        },
        surfaceSegmentBtnActive: {
          backgroundColor: colors.primary,
        },
        surfaceSegmentText: {
          fontSize: 13,
          fontWeight: '700',
          color: colors.secondaryText,
        },
        surfaceSegmentTextActive: {
          color: '#FFFFFF',
        },
        // Section building blocks
        section: {
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        sectionLabel: {
          fontSize: 12,
          fontWeight: '700',
          color: colors.secondaryText,
          textTransform: 'uppercase' as const,
          letterSpacing: 0.6,
          marginBottom: 10,
        },
        // Event Header
        eventHeader: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 12,
          gap: 10,
        },
        eventEmoji: {
          fontSize: 28,
          lineHeight: 32,
        },
        eventName: {
          fontSize: 22,
          fontWeight: '700',
          color: colors.text,
          flex: 1,
          flexWrap: 'wrap',
          letterSpacing: -0.3,
          lineHeight: 28,
        },
        // Event Card (now flat section)
        eventCard: {
          paddingHorizontal: 16,
          paddingTop: 4,
          paddingBottom: 14,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        eventTypeRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 14,
        },
        eventTypeBadge: {
          backgroundColor: colors.primary + '15',
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 12,
        },
        eventTypeText: {
          color: colors.primary,
          fontSize: 12,
          fontWeight: '700',
          letterSpacing: 0.3,
        },
        eventDetailRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 6,
        },
        eventDetailIcon: {
          fontSize: 14,
          marginRight: 10,
          width: 20,
          textAlign: 'center' as const,
        },
        eventDetailText: {
          color: colors.text,
          fontSize: 14,
          flex: 1,
        },
        groupLinkBanner: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: colors.primary + '15',
          borderRadius: 10,
          paddingVertical: 10,
          paddingHorizontal: 12,
          marginTop: 12,
        },
        groupLinkBannerText: {
          flex: 1,
          color: colors.text,
          fontSize: 13,
          lineHeight: 18,
        },
        groupLinkBannerName: {
          color: colors.primary,
          fontWeight: '700',
        },
        // Progress Bar (lives inside its own flat section)
        progressSection: {
          marginTop: 12,
        },
        progressHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        },
        progressLabel: {
          fontSize: 13,
          color: colors.secondaryText,
          fontWeight: '600',
        },
        progressCount: {
          fontSize: 14,
          color: colors.primary,
          fontWeight: '700',
        },
        progressBarBg: {
          height: 6,
          backgroundColor: colors.border,
          borderRadius: 3,
          overflow: 'hidden',
        },
        progressBarFill: {
          height: '100%',
          backgroundColor: colors.primary,
          borderRadius: 3,
        },
        // Stats Section (flat)
        statsSection: {
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        statsSectionTitle: {
          fontSize: 12,
          fontWeight: '700',
          color: colors.secondaryText,
          textTransform: 'uppercase' as const,
          letterSpacing: 0.6,
          marginBottom: 12,
        },
        statsRow: {
          flexDirection: 'row',
          justifyContent: 'space-around',
        },
        statItem: {
          alignItems: 'center',
          flex: 1,
        },
        statValue: {
          fontSize: 22,
          fontWeight: '700',
          color: colors.primary,
        },
        statLabel: {
          fontSize: 12,
          color: colors.secondaryText,
          marginTop: 2,
        },
        // Team Breakdown
        teamBreakdown: {
          marginTop: 12,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        teamRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        },
        teamBadge: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 16,
          borderWidth: 2,
        },
        teamBadgeText: {
          fontSize: 12,
          fontWeight: '600',
          marginLeft: 6,
          color: colors.text,
        },
        // Add Player Section (flat, collapsible)
        addPlayerSection: {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          overflow: 'hidden',
        },
        primaryActionsRow: {
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 10,
          gap: 10,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        primaryActionButton: {
          backgroundColor: colors.primary,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 14,
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'center',
          gap: 8,
        },
        primaryActionButtonSecondary: {
          backgroundColor: 'transparent',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.primary,
        },
        primaryActionButtonText: {
          color: colors.buttonText || '#fff',
          fontWeight: '700',
          fontSize: 16,
        },
        primaryActionButtonTextSecondary: {
          color: colors.primary,
        },
        addPlayerHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 14,
        },
        addPlayerHeaderLeft: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        addPlayerTitle: {
          fontSize: 15,
          fontWeight: '600',
          color: colors.text,
          marginLeft: 10,
        },
        addPlayerContent: {
          paddingHorizontal: 16,
          paddingBottom: 16,
          paddingTop: 4,
        },
        alreadyJoinedBadge: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.primary + '20',
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 20,
          alignSelf: 'flex-start',
          marginTop: 12,
        },
        alreadyJoinedText: {
          color: colors.primary,
          fontSize: 14,
          fontWeight: '500',
          marginLeft: 6,
        },
        input: {
          backgroundColor: colors.inputBackground,
          color: colors.text,
          padding: 14,
          marginTop: 12,
          marginBottom: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          fontSize: 16,
        },
        dropdown: {
          backgroundColor: 'transparent',
          paddingHorizontal: 20,
          paddingVertical: 16,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        dropdownText: {
          color: colors.text,
          fontSize: 15,
          fontWeight: '500',
        },
        placeholderText: {
          color: colors.placeholder,
          fontSize: 15,
        },
        saveButton: {
          backgroundColor: colors.primary,
          padding: 16,
          borderRadius: 12,
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'center',
          shadowColor: colors.primary,
          shadowOffset: {width: 0, height: 2},
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 3,
        },
        saveButtonDisabled: {
          backgroundColor: colors.border,
          shadowOpacity: 0,
          elevation: 0,
        },
        buttonText: {
          color: colors.buttonText,
          fontWeight: '700',
          fontSize: 16,
          marginLeft: 8,
        },
        errorMessage: {
          color: colors.error,
          marginBottom: 12,
          marginTop: 12,
          textAlign: 'center',
          fontSize: 14,
        },
        // Invite Players Section (flat, collapsible)
        inviteSection: {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          overflow: 'hidden',
        },
        inviteContent: {
          paddingHorizontal: 16,
          paddingBottom: 16,
          paddingTop: 4,
        },
        inviteSearchContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.inputBackground,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 12,
          marginTop: 12,
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
          backgroundColor: colors.inputBackground,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          marginTop: 8,
          maxHeight: 200,
        },
        inviteSearchResultRow: {
          flexDirection: 'row',
          alignItems: 'center',
          padding: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        inviteUserAvatar: {
          width: 36,
          height: 36,
          borderRadius: 18,
          marginRight: 12,
        },
        inviteUserAvatarPlaceholder: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: colors.primary,
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 12,
        },
        inviteUserAvatarText: {
          color: '#fff',
          fontSize: 14,
          fontWeight: '600',
        },
        inviteUserTextBlock: {
          flex: 1,
          marginRight: 8,
        },
        inviteUserName: {
          fontSize: 14,
          color: colors.text,
          fontWeight: '600',
        },
        inviteUserHandle: {
          fontSize: 12,
          color: colors.secondaryText,
          marginTop: 1,
        },
        invitedUsersList: {
          marginTop: 12,
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
          paddingHorizontal: 12,
          borderRadius: 16,
          gap: 6,
        },
        invitedUserChipText: {
          fontSize: 13,
          color: colors.primary,
          fontWeight: '500',
        },
        inviteHint: {
          fontSize: 13,
          color: colors.secondaryText,
          fontStyle: 'italic',
          marginTop: 12,
          textAlign: 'center',
        },
        // Roster Section
        rosterSection: {
          paddingTop: 4,
        },
        rsvpSectionWrap: {
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 4,
        },
        rsvpResponseSection: {
          marginTop: 12,
        },
        rsvpSectionTitle: {
          fontSize: 13,
          fontWeight: '700',
          color: colors.secondaryText,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: 8,
        },
        rsvpPersonRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingVertical: 6,
        },
        rsvpPersonAvatar: {
          width: 32,
          height: 32,
          borderRadius: 16,
          marginRight: 10,
        },
        rsvpPersonAvatarFallback: {
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary,
        },
        rsvpPersonAvatarText: {
          color: '#fff',
          fontSize: 12,
          fontWeight: '700',
        },
        rsvpPersonName: {
          flex: 1,
          fontSize: 15,
          color: colors.text,
        },
        rsvpRemindBtn: {
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 14,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border || 'rgba(128,128,128,0.35)',
          backgroundColor: colors.card,
          marginLeft: 0,
        },
        rsvpRemindBtnDisabled: {
          opacity: 0.45,
        },
        rsvpSectionHeaderRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        },
        rsvpRemindAllBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 12,
          backgroundColor: colors.primary + '18',
        },
        rsvpRemindAllText: {
          fontSize: 12,
          fontWeight: '600',
          color: colors.primary,
        },
        rsvpDot: {
          width: 10,
          height: 10,
          borderRadius: 5,
          marginLeft: 8,
        },
        requestRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 6,
        },
        requestApproveBtn: {
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#2ecc71',
          marginLeft: 8,
        },
        requestDenyBtn: {
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#e74c3c',
          marginLeft: 8,
        },
        sectionHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 10,
        },
        sectionTitle: {
          fontSize: 15,
          fontWeight: '700',
          color: colors.text,
          marginLeft: 8,
        },
        // Team Tabs
        teamTabsContainer: {
          flexDirection: 'row',
          marginHorizontal: 16,
          marginBottom: 12,
          borderRadius: 12,
          backgroundColor: colors.inputBackground || colors.background,
          padding: 4,
        },
        teamTab: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 10,
          paddingHorizontal: 8,
          borderRadius: 10,
          gap: 6,
        },
        teamTabActive: {
          backgroundColor: colors.card,
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 1},
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: 2,
        },
        teamTabDot: {
          width: 12,
          height: 12,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: colors.border,
        },
        teamTabText: {
          fontSize: 13,
          fontWeight: '500',
          color: colors.secondaryText,
        },
        teamTabTextActive: {
          color: colors.text,
          fontWeight: '700',
        },
        teamTabCount: {
          fontSize: 11,
          fontWeight: '600',
          color: colors.secondaryText,
          backgroundColor: colors.inputBackground || colors.background,
          paddingHorizontal: 6,
          paddingVertical: 1,
          borderRadius: 8,
          overflow: 'hidden',
        },
        teamTabCountActive: {
          backgroundColor: colors.primary + '20',
          color: colors.primary,
        },
        // Payment Filter Tabs
        paymentFilterContainer: {
          flexDirection: 'row',
          paddingHorizontal: 16,
          marginBottom: 12,
          gap: 8,
        },
        paymentFilterTab: {
          paddingVertical: 7,
          paddingHorizontal: 14,
          borderRadius: 20,
          backgroundColor: colors.inputBackground || colors.background,
          borderWidth: 1,
          borderColor: 'transparent',
        },
        paymentFilterTabActive: {
          borderColor: colors.primary,
          backgroundColor: colors.primary + '12',
        },
        paymentFilterText: {
          fontSize: 13,
          fontWeight: '500',
          color: colors.secondaryText,
        },
        paymentFilterTextActive: {
          color: colors.primary,
          fontWeight: '700',
        },
        // Position Summary (flat)
        positionSummaryContainer: {
          paddingHorizontal: 16,
          paddingTop: 4,
          paddingBottom: 14,
        },
        positionSummaryTitle: {
          fontSize: 14,
          fontWeight: '600',
          color: colors.text,
          marginBottom: 10,
        },
        positionRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 8,
        },
        positionLabel: {
          fontSize: 13,
          color: colors.text,
          width: 110,
          fontWeight: '500',
        },
        positionBarBg: {
          flex: 1,
          height: 8,
          backgroundColor: colors.inputBackground || colors.background,
          borderRadius: 4,
          marginHorizontal: 10,
          overflow: 'hidden',
        },
        positionBarFill: {
          height: '100%',
          backgroundColor: colors.primary,
          borderRadius: 4,
        },
        positionBarOverfill: {
          backgroundColor: '#FFA726',
        },
        positionCount: {
          fontSize: 12,
          fontWeight: '600',
          color: colors.secondaryText,
          width: 42,
          textAlign: 'right',
        },
        // Position Group Headers
        positionGroupHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: 6,
        },
        positionGroupTitle: {
          fontSize: 12,
          fontWeight: '700',
          color: colors.secondaryText,
          textTransform: 'uppercase' as const,
          letterSpacing: 0.6,
        },
        positionGroupCount: {
          fontSize: 11,
          fontWeight: '600',
          color: colors.placeholder,
          marginLeft: 8,
        },
        emptyPositionText: {
          fontSize: 13,
          color: colors.placeholder,
          fontStyle: 'italic',
          paddingHorizontal: 16,
          paddingVertical: 8,
        },
        // Player Card (flat row)
        playerCard: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          overflow: 'hidden',
        },
        playerCardSelf: {
          backgroundColor: colors.primary + '08',
        },
        playerCardTeamRail: {
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
        },
        playerCardWithTeam: {
          paddingLeft: 20,
        },
        teamPill: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          backgroundColor: colors.card,
          borderRadius: 10,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        teamPillText: {
          fontSize: 11,
          fontWeight: '800',
          color: colors.text,
        },
        kebabBtn: {
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: 'center',
          justifyContent: 'center',
        },
        onTeamBanner: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          alignSelf: 'center',
          marginTop: 10,
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 16,
          backgroundColor: colors.primary + '18',
        },
        onTeamBannerText: {
          color: colors.primary,
          fontSize: 14,
          fontWeight: '700',
        },
        avatar: {
          width: 42,
          height: 42,
          borderRadius: 21,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        },
        avatarImage: {
          width: 42,
          height: 42,
          borderRadius: 21,
          marginRight: 12,
        },
        avatarLight: {
          borderWidth: 2,
          borderColor: colors.border,
        },
        avatarText: {
          color: '#fff',
          fontWeight: 'bold',
          fontSize: 16,
        },
        avatarTextDark: {
          color: '#333',
        },
        avatarWrap: {
          position: 'relative',
          marginRight: 12,
        },
        ratingChip: {
          position: 'absolute',
          right: -2,
          bottom: -2,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          backgroundColor: colors.card,
          borderRadius: 8,
          paddingHorizontal: 4,
          paddingVertical: 1,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        ratingChipText: {
          fontSize: 9,
          fontWeight: '700',
          color: colors.text,
        },
        ratePlayerFab: {
          position: 'absolute',
          left: -4,
          top: -4,
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: colors.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        },
        eventActionButtons: {
          marginTop: 12,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        },
        rateEventButton: {
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: colors.primary + '18',
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 8,
        },
        rateEventButtonText: {
          color: colors.primary,
          fontWeight: '700',
          fontSize: 13,
        },
        playerInfo: {
          flex: 1,
        },
        playerName: {
          fontSize: 15,
          fontWeight: '700',
          color: colors.text,
          marginBottom: 3,
        },
        playerActions: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginLeft: 8,
        },
        editButton: {
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 14,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        editButtonText: {
          color: colors.text,
          fontWeight: '600',
          fontSize: 12,
        },
        playerDetails: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 6,
        },
        playerBadge: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.inputBackground || colors.background,
          paddingHorizontal: 7,
          paddingVertical: 3,
          borderRadius: 10,
        },
        playerBadgeText: {
          fontSize: 11,
          color: colors.secondaryText,
          marginLeft: 4,
          fontWeight: '600',
        },
        paidBadge: {
          backgroundColor: '#4CAF50' + '20',
        },
        paidBadgeText: {
          color: '#4CAF50',
        },
        unpaidBadge: {
          backgroundColor: colors.error + '20',
        },
        unpaidBadgeText: {
          color: colors.error,
        },
        jerseyIndicator: {
          width: 14,
          height: 14,
          borderRadius: 7,
          borderWidth: 1,
          borderColor: colors.border,
        },
        deleteButton: {
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 14,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.error + '60',
        },
        deleteButtonText: {
          color: colors.error,
          fontWeight: '600',
          fontSize: 12,
        },
        emptyState: {
          textAlign: 'center',
          color: colors.placeholder,
          fontSize: 15,
          paddingHorizontal: 16,
          paddingVertical: 30,
        },
        // Modal
        modalOverlay: {
          flex: 1,
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.5)',
          padding: 24,
        },
        modalContent: {
          backgroundColor: colors.card,
          borderRadius: 18,
          paddingTop: 18,
          paddingBottom: 14,
          maxHeight: '70%',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        modalTitle: {
          fontSize: 17,
          fontWeight: '700',
          color: colors.text,
          textAlign: 'center',
          marginBottom: 14,
          paddingHorizontal: 20,
          paddingBottom: 14,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        modalOption: {
          paddingVertical: 14,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        modalOptionSelected: {
          backgroundColor: colors.primary + '0D',
        },
        modalOptionText: {
          color: colors.text,
          fontSize: 15,
          flex: 1,
        },
        modalOptionTextSelected: {
          color: colors.primary,
          fontWeight: '700',
        },
        modalOptionTextWithMargin: {
          color: colors.text,
          fontSize: 15,
          flex: 1,
          marginLeft: 12,
        },
        expandedOptions: {
          backgroundColor: colors.inputBackground || colors.background,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        inlineOption: {
          paddingVertical: 12,
          paddingHorizontal: 24,
          flexDirection: 'row',
          alignItems: 'center',
        },
        inlineOptionSelected: {
          backgroundColor: colors.primary + '12',
        },
        inlineOptionText: {
          color: colors.text,
          fontSize: 14,
          flex: 1,
          marginLeft: 12,
        },
        inlineOptionTextSelected: {
          color: colors.primary,
          fontWeight: '700',
        },
        colorSwatch: {
          width: 20,
          height: 20,
          borderRadius: 10,
          marginRight: 12,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        modalClose: {
          marginTop: 10,
          marginHorizontal: 20,
          paddingVertical: 12,
          backgroundColor: 'transparent',
          borderRadius: 24,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          alignItems: 'center',
        },
        modalCloseText: {
          color: colors.text,
          fontWeight: '600',
          fontSize: 15,
        },
        modalSaveButton: {
          marginHorizontal: 20,
          marginTop: 16,
          paddingVertical: 13,
          backgroundColor: colors.primary,
          borderRadius: 24,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        },
        modalSaveButtonText: {
          color: colors.buttonText,
          fontWeight: '700',
          fontSize: 15,
          marginLeft: 8,
        },
        modalScrollView: {
          maxHeight: 320,
        },
        progressRemaining: {
          fontSize: 14,
          color: colors.text,
          fontWeight: '500',
          marginTop: 8,
          textAlign: 'center',
        },
        statValueGreen: {
          fontSize: 22,
          fontWeight: '700',
          color: '#4CAF50',
        },
        statValueError: {
          fontSize: 22,
          fontWeight: '700',
          color: colors.error,
        },
        statsSectionTitleSmall: {
          fontSize: 16,
          fontWeight: '600',
          color: colors.text,
          marginBottom: 8,
        },
        jerseyDropdownRow: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        jerseyIndicatorLarge: {
          width: 14,
          height: 14,
          borderRadius: 7,
          borderWidth: 1,
          borderColor: colors.border,
          marginRight: 10,
        },
      }),
    [colors],
  );

  // Fetch roster and event details from backend
  const fetchEventData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await axios.get(`${API_BASE_URL}/events/${eventId}`, {
        headers: token ? {Authorization: `Bearer ${token}`} : {},
      });
      setRoster(response.data.roster || []);
      if (response.data.name) {
        setEventName(response.data.name);
      }
      if (response.data.eventType) {
        setEventType(response.data.eventType);
      }
      if (response.data.date) {
        setDate(response.data.date);
      }
      if (response.data.time) {
        setTime(response.data.time);
      }
      if (response.data.location) {
        setLocation(response.data.location);
      }
      if (response.data.isVirtual !== undefined) {
        setIsVirtual(!!response.data.isVirtual);
      }
      setTrackPayment(response.data.trackPayment === true);
      if (response.data.durationMinutes != null) {
        setDurationMinutes(response.data.durationMinutes);
      } else {
        setDurationMinutes(undefined);
      }
      if (
        response.data.totalSpots !== undefined &&
        response.data.totalSpots !== null
      ) {
        setTotalSpots(response.data.totalSpots);
      }
      // Update jersey colors from backend if available
      if (
        response.data.jerseyColors &&
        response.data.jerseyColors.length === 2
      ) {
        setEventJerseyColors(response.data.jerseyColors);
      } else {
        setEventJerseyColors([]);
      }
      // Update privacy settings
      setEventPrivacy(response.data.privacy || 'public');
      setEventCreatedBy(response.data.createdBy || '');
      setEventCreatedByUsername(response.data.createdByUsername || '');
      setInvitedUsers(response.data.invitedUsers || []);
      setRemovedUserIds(response.data.removedUserIds || []);
      setRsvps(response.data.rsvps || []);
      setJoinRequests(response.data.joinRequests || []);
      setGuestAddRequests(response.data.guestAddRequests || []);
      setWaitlist(response.data.waitlist || []);
      setSpotReservation(response.data.spotReservation || null);

      // Rating chips for everyone on the roster (host + player averages).
      const hostIds = Array.from(
        new Set(
          [
            response.data.createdBy,
            ...((response.data.roster || []).map((p: any) => p.userId) || []),
          ]
            .filter(Boolean)
            .map(String),
        ),
      );
      if (hostIds.length > 0) {
        try {
          const [hostRes, playerRes] = await Promise.all([
            axios.post(
              `${API_BASE_URL}/events/ratings/hosts`,
              {hostIds},
              {headers: token ? {Authorization: `Bearer ${token}`} : {}},
            ),
            axios.post(
              `${API_BASE_URL}/users/player-ratings/summary`,
              {userIds: hostIds},
              {headers: token ? {Authorization: `Bearer ${token}`} : {}},
            ),
          ]);
          setHostRatings(hostRes.data?.ratings || {});
          setPlayerRatings(playerRes.data?.ratings || {});
          setRatedPlayerIds(
            new Set(
              Array.isArray(playerRes.data?.ratedByMe)
                ? playerRes.data.ratedByMe.map(String)
                : [],
            ),
          );
        } catch {
          // non-blocking
        }
      }

      if (userData?._id) {
        try {
          const meResponse = await axios.get(
            `${API_BASE_URL}/events/${eventId}/ratings/me`,
            {headers: token ? {Authorization: `Bearer ${token}`} : {}},
          );
          setHasRatedEvent(!!meResponse.data?.rated);
        } catch {
          // non-blocking
        }
      }

      // Fetch invited user details for the pending-invite section
      if (response.data.invitedUsers?.length > 0) {
        const usersResponse = await axios.get(`${API_BASE_URL}/users`, {
          headers: token ? {Authorization: `Bearer ${token}`} : {},
        });
        const allUsers = usersResponse.data?.users || usersResponse.data || [];
        const invitedDetails = allUsers
          .filter((u: any) => response.data.invitedUsers.includes(u._id))
          .map((u: any) => ({
            _id: u._id,
            username: u.username,
            name: u.name,
            profilePicUrl: u.profilePicUrl,
          }));
        setInvitedUserDetails(invitedDetails);
      } else {
        setInvitedUserDetails([]);
      }
    } catch (error) {
      setRoster([]);
    }
  }, [eventId, userData?._id]);

  const handleApproveRequest = useCallback(
    async (requesterId: string) => {
      setJoinRequests(prev => prev.filter(r => r.userId !== requesterId));
      try {
        const token = await AsyncStorage.getItem('userToken');
        await axios.post(
          `${API_BASE_URL}/events/${eventId}/join-request/${requesterId}/approve`,
          {},
          {headers: {Authorization: `Bearer ${token}`}},
        );
      } catch (error) {
        // Roll back to server truth (e.g. event became full).
      } finally {
        fetchEventData();
      }
    },
    [eventId, fetchEventData],
  );

  const handleDenyRequest = useCallback(
    async (requesterId: string) => {
      setJoinRequests(prev => prev.filter(r => r.userId !== requesterId));
      try {
        const token = await AsyncStorage.getItem('userToken');
        await axios.post(
          `${API_BASE_URL}/events/${eventId}/join-request/${requesterId}/deny`,
          {},
          {headers: {Authorization: `Bearer ${token}`}},
        );
      } catch (error) {
        fetchEventData();
      }
    },
    [eventId, fetchEventData],
  );

  const handleApproveGuestAdd = useCallback(
    async (proposedUserId: string) => {
      setGuestAddRequests(prev =>
        prev.filter(r => r.proposedUserId !== proposedUserId),
      );
      try {
        const token = await AsyncStorage.getItem('userToken');
        await axios.post(
          `${API_BASE_URL}/events/${eventId}/guest-add-request/${proposedUserId}/approve`,
          {},
          {headers: {Authorization: `Bearer ${token}`}},
        );
      } catch (error) {
        // roll back via refetch
      } finally {
        fetchEventData();
      }
    },
    [eventId, fetchEventData],
  );

  const handleDenyGuestAdd = useCallback(
    async (proposedUserId: string) => {
      setGuestAddRequests(prev =>
        prev.filter(r => r.proposedUserId !== proposedUserId),
      );
      try {
        const token = await AsyncStorage.getItem('userToken');
        await axios.post(
          `${API_BASE_URL}/events/${eventId}/guest-add-request/${proposedUserId}/deny`,
          {},
          {headers: {Authorization: `Bearer ${token}`}},
        );
      } catch (error) {
        fetchEventData();
      }
    },
    [eventId, fetchEventData],
  );

  // Auto-refresh when screen comes into focus (e.g., navigating back)
  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        setLoading(true);
        await fetchEventData();
        setLoading(false);
      };
      loadData();
    }, [fetchEventData]),
  );

  // Join the event's socket room and listen for real-time roster updates
  useEffect(() => {
    joinEvent(eventId);

    const unsubRoster = socketSubscribe(
      'roster:updated',
      (data: {
        eventId: string;
        roster: any[];
        rosterSpotsFilled: number;
        waitlist?: any[];
        spotReservation?: any;
        rsvps?: any[];
        invitedUsers?: string[];
        removedUserIds?: string[];
        joinRequests?: any[];
        totalSpots?: number;
      }) => {
        if (data.eventId === eventId) {
          setRoster(data.roster);
          if (typeof data.totalSpots === 'number') {
            setTotalSpots(data.totalSpots);
          }
          updateRosterSpots(eventId, data.rosterSpotsFilled);
          if (data.waitlist !== undefined) {
            setWaitlist(data.waitlist);
          }
          if (data.spotReservation !== undefined) {
            setSpotReservation(data.spotReservation);
          }
          if (data.rsvps !== undefined) {
            setRsvps(data.rsvps);
          }
          if (data.invitedUsers !== undefined) {
            setInvitedUsers(data.invitedUsers);
            setInvitedUserDetails(prev =>
              prev.filter(u => data.invitedUsers!.includes(u._id)),
            );
          }
          if (data.removedUserIds !== undefined) {
            setRemovedUserIds(data.removedUserIds);
          }
          if (data.joinRequests !== undefined) {
            setJoinRequests(data.joinRequests);
          }
        }
      },
    );

    const unsubWaitlist = socketSubscribe(
      'waitlist:updated',
      (data: {eventId: string; waitlist: any[]}) => {
        if (data.eventId === eventId) {
          setWaitlist(data.waitlist);
        }
      },
    );

    const unsubEvent = socketSubscribe(
      'event:updated',
      (data: {event: any}) => {
        if (data.event && data.event._id === eventId) {
          const ev = data.event;
          if (ev.name) {
            setEventName(ev.name);
          }
          if (ev.eventType) {
            setEventType(ev.eventType);
          }
          if (ev.date) {
            setDate(ev.date);
          }
          if (ev.time) {
            setTime(ev.time);
          }
          if (ev.location) {
            setLocation(ev.location);
          }
          if (ev.isVirtual !== undefined) {
            setIsVirtual(!!ev.isVirtual);
          }
          if (ev.totalSpots !== undefined && ev.totalSpots !== null) {
            setTotalSpots(ev.totalSpots);
          }
          if (ev.roster) {
            setRoster(ev.roster);
          }
          if (ev.jerseyColors) {
            setEventJerseyColors(ev.jerseyColors);
          }
        }
      },
    );

    // Join requests (and gating transitions) come through as a lightweight
    // "events:refresh" nudge — refetch this event so the creator's pending
    // list stays current while they're on the roster screen.
    const unsubEventsRefresh = socketSubscribe(
      'events:refresh',
      (data: {eventId?: string}) => {
        if (!data?.eventId || data.eventId === eventId) {
          fetchEventData();
        }
      },
    );

    // Fallback: refresh when app returns to foreground
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        fetchEventData();
      }
    });

    return () => {
      leaveEvent(eventId);
      unsubRoster();
      unsubWaitlist();
      unsubEvent();
      unsubEventsRefresh();
      subscription.remove();
    };
  }, [
    eventId,
    joinEvent,
    leaveEvent,
    socketSubscribe,
    fetchEventData,
    updateRosterSpots,
  ]);

  // Persist roster to backend
  const persistRoster = useCallback(
    async (updatedRoster: Player[]) => {
      try {
        await axios.put(`${API_BASE_URL}/events/${eventId}/roster`, {
          roster: updatedRoster,
        });
      } catch (error) {
        console.error('Error persisting roster:', error);
      }
    },
    [eventId],
  );

  // Add player via dedicated endpoint (triggers backend notifications)
  const handleSave = async () => {
    const isSport = isTeamSport(eventType);
    if (
      !username ||
      !position ||
      (isSport && !jerseyColor) ||
      (isSport && trackPayment && !paidStatus)
    ) {
      setErrorMessage('Please fill out all fields.');
      return;
    }
    if (isUserOnRoster) {
      setErrorMessage('You are already on this roster.');
      return;
    }
    setSavingRoster(true);
    const newPlayer: Player = {
      userId: userData?._id,
      username,
      paidStatus: isSport && trackPayment ? paidStatus : 'N/A',
      jerseyColor: isSport ? jerseyColor : 'N/A',
      position,
      profilePicUrl: userData?.profilePicUrl,
    };

    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await axios.post(
        `${API_BASE_URL}/events/${eventId}/roster`,
        {participant: newPlayer},
        token ? {headers: {Authorization: `Bearer ${token}`}} : {},
      );
      if (typeof response.data?.totalSpots === 'number') {
        setTotalSpots(response.data.totalSpots);
      }
    } catch (error: any) {
      if (error?.response?.status === 409) {
        setErrorMessage('You are already on this roster.');
      } else if (error?.response?.data?.reserved) {
        setErrorMessage(
          'The last spot is temporarily reserved for another player.',
        );
        fetchEventData();
      } else if (error?.response?.data?.full) {
        setErrorMessage(
          'This event is now full. You can join the waitlist instead.',
        );
        fetchEventData();
      } else {
        setErrorMessage('Failed to join event. Please try again.');
      }
      setSavingRoster(false);
      return;
    }

    const updatedRoster = [...roster, newPlayer];
    setRoster(updatedRoster);
    setSurfaceTab('roster');
    updateRosterSpots(eventId, updatedRoster.length);
    analyticsService.trackJoinEvent(eventId, eventName).catch(() => {});

    if (date && time) {
      notificationService
        .scheduleEventNotifications({
          _id: eventId,
          name: eventName,
          date,
          time,
        })
        .catch(() => {});
    }

    setPaidStatus('');
    setJerseyColor('');
    setPosition('');
    setErrorMessage('');
    setAddPlayerExpanded(false);
    setSavingRoster(false);
  };

  // Search users to invite
  const searchUsersToInvite = async (query: string) => {
    if (query.length < 2) {
      setInviteSearchResults([]);
      return;
    }
    setLoadingInviteSearch(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await axios.get(`${API_BASE_URL}/users`, {
        headers: token ? {Authorization: `Bearer ${token}`} : {},
      });
      const allUsers = response.data?.users || response.data || [];
      const normalizedQuery = query.toLowerCase();
      // Filter users by username OR real name (exclude current user and already invited)
      const filteredUsers = allUsers.filter(
        (user: any) =>
          (user.username?.toLowerCase().includes(normalizedQuery) ||
            (user.name && user.name.toLowerCase().includes(normalizedQuery))) &&
          user._id !== userData?._id &&
          !invitedUsers.includes(user._id),
      );
      setInviteSearchResults(
        filteredUsers.slice(0, 8).map((user: any) => ({
          _id: user._id,
          username: user.username,
          name: user.name,
          profilePicUrl: user.profilePicUrl,
        })),
      );
    } catch {
      setInviteSearchResults([]);
    }
    setLoadingInviteSearch(false);
  };

  // Invite a user to the event (creator) or suggest a guest (invitee).
  const inviteUserToEvent = async (user: {
    _id: string;
    username: string;
    name?: string;
    profilePicUrl?: string;
  }) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (canSuggestGuests) {
        await axios.post(
          `${API_BASE_URL}/events/${eventId}/guest-add-request`,
          {
            proposedUserId: user._id,
            proposedUsername: user.username,
            proposedProfilePicUrl: user.profilePicUrl,
            requestedByUsername: userData?.username,
          },
          {headers: token ? {Authorization: `Bearer ${token}`} : {}},
        );
        setInviteSearchQuery('');
        setInviteSearchResults([]);
        Alert.alert(
          t('roster.guestSuggestedTitle') || 'Suggestion sent',
          t('roster.guestSuggestedBody') ||
            'The host will approve or decline your guest.',
        );
        return;
      }
      const inviteRes = await axios.post(
        `${API_BASE_URL}/events/${eventId}/invite`,
        {userIds: [user._id]},
        {headers: token ? {Authorization: `Bearer ${token}`} : {}},
      );
      // Update local state
      setInvitedUsers(prev =>
        prev.includes(user._id) ? prev : [...prev, user._id],
      );
      setInvitedUserDetails(prev =>
        prev.some(u => u._id === user._id) ? prev : [...prev, user],
      );
      setRemovedUserIds(prev => prev.filter(id => id !== user._id));
      if (inviteRes.data?.removedUserIds) {
        setRemovedUserIds(inviteRes.data.removedUserIds);
      }
      if (typeof inviteRes.data?.totalSpots === 'number') {
        setTotalSpots(inviteRes.data.totalSpots);
      }
      setInviteSearchQuery('');
      setInviteSearchResults([]);
    } catch (error: any) {
      Alert.alert(
        t('common.error'),
        error?.response?.data?.message ||
          t('roster.inviteError') ||
          'Failed to invite user',
      );
    }
  };

  // Remove invite from a user (pending invite only — not a roster kick/ban).
  const removeInvite = useCallback(
    async (userId: string) => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const response = await axios.delete(
          `${API_BASE_URL}/events/${eventId}/invite/${userId}`,
          {
            headers: token ? {Authorization: `Bearer ${token}`} : {},
          },
        );
        if (response.data?.invitedUsers) {
          setInvitedUsers(response.data.invitedUsers);
        } else {
          setInvitedUsers(prev => prev.filter(id => id !== userId));
        }
        setInvitedUserDetails(prev => prev.filter(u => u._id !== userId));
      } catch (error) {
        Alert.alert(
          t('common.error'),
          t('roster.removeInviteError') || 'Failed to uninvite',
        );
      }
    },
    [eventId, t],
  );

  const showInviteeMoreMenu = useCallback(
    (personUserId: string, name: string) => {
      if (!isEventCreator) {
        return;
      }
      const uninviteLabel = t('roster.uninvite') || 'Uninvite';
      const cancelLabel = t('common.cancel') || 'Cancel';

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: [cancelLabel, uninviteLabel],
            cancelButtonIndex: 0,
            destructiveButtonIndex: 1,
          },
          index => {
            if (index === 1) {
              removeInvite(personUserId);
            }
          },
        );
        return;
      }

      Alert.alert(
        t('roster.uninviteTitle') || 'Uninvite?',
        t('roster.uninviteMessage') ||
          `Uninvite ${name}? They can be invited again later.`,
        [
          {text: cancelLabel, style: 'cancel'},
          {
            text: uninviteLabel,
            style: 'destructive',
            onPress: () => removeInvite(personUserId),
          },
        ],
      );
    },
    [isEventCreator, t, removeInvite],
  );

  // Nudge invitees who haven't RSVP'd. Pass userIds for one person, or omit
  // for everyone still pending. Server enforces a 1h cooldown per invitee.
  const pingRsvp = async (userIds?: string[]) => {
    if (!isEventCreator) {
      return;
    }
    const targetingOne = !!userIds?.length;
    if (targetingOne) {
      setPingingRsvpIds(prev => {
        const next = new Set(prev);
        userIds!.forEach(id => next.add(id));
        return next;
      });
    } else {
      setPingingAllRsvp(true);
    }
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await axios.post(
        `${API_BASE_URL}/events/${eventId}/ping-rsvp`,
        targetingOne ? {userIds} : {},
        {headers: token ? {Authorization: `Bearer ${token}`} : {}},
      );
      const pingedCount = response.data?.pinged?.length || 0;
      const rateLimitedCount = response.data?.rateLimited?.length || 0;
      if (pingedCount > 0) {
        Alert.alert(
          t('roster.remindSentTitle') || 'Reminder sent',
          pingedCount === 1
            ? t('roster.remindSentOne') || "They'll get a nudge to RSVP."
            : t('roster.remindSentMany', {count: pingedCount}) ||
                `Reminded ${pingedCount} people to RSVP.`,
        );
      } else if (rateLimitedCount > 0) {
        Alert.alert(
          t('roster.remindCooldownTitle') || 'Already reminded',
          t('roster.remindCooldownBody') ||
            'You already sent a reminder recently. Try again in about an hour.',
        );
      }
    } catch (error: any) {
      const status = error?.response?.status;
      const rateLimited = error?.response?.data?.rateLimited?.length > 0;
      if (status === 429 || rateLimited) {
        Alert.alert(
          t('roster.remindCooldownTitle') || 'Already reminded',
          t('roster.remindCooldownBody') ||
            'You already sent a reminder recently. Try again in about an hour.',
        );
      } else {
        Alert.alert(
          t('common.error'),
          error?.response?.data?.message ||
            t('roster.remindError') ||
            'Failed to send reminder',
        );
      }
    } finally {
      if (targetingOne) {
        setPingingRsvpIds(prev => {
          const next = new Set(prev);
          userIds!.forEach(id => next.delete(id));
          return next;
        });
      } else {
        setPingingAllRsvp(false);
      }
    }
  };

  // Navigate to player's public profile
  const handlePlayerPress = (player: Player) => {
    // Don't navigate to your own profile from here
    if (player.username === userData?.username) {
      return;
    }
    navigation.navigate('PublicProfile', {
      userId: player.userId,
      username: player.username,
      profilePicUrl: player.profilePicUrl,
    });
  };

  const openProfile = (params: {
    userId?: string;
    username: string;
    profilePicUrl?: string;
  }) => {
    if (!params.userId || params.userId === userData?._id) {
      return;
    }
    navigation.navigate('PublicProfile', {
      userId: params.userId,
      username: params.username,
      profilePicUrl: params.profilePicUrl,
    });
  };

  const messageUser = (params: {
    userId?: string;
    username: string;
    profilePicUrl?: string;
  }) => {
    if (!params.userId || params.userId === userData?._id) {
      return;
    }
    navigation.navigate('Messages', {
      screen: 'DmThread',
      params: {
        userId: params.userId,
        username: params.username,
        profilePicUrl: params.profilePicUrl,
      },
    });
  };

  // Leave (self) or boot (host removing someone else)
  const handleDelete = useCallback(
    (playerUsername: string, options?: {boot?: boolean}) => {
      const isBoot = !!options?.boot;
      if (isBoot) {
        if (!isEventCreator) {
          return;
        }
        Alert.alert(
          t('roster.bootConfirm') || 'Remove from event?',
          t('roster.bootConfirmMessage') ||
            `Remove ${playerUsername} from this event? They'll be notified and won't be able to rejoin unless you invite them again.`,
          [
            {text: t('common.cancel'), style: 'cancel'},
            {
              text: t('roster.removePlayer') || 'Remove',
              style: 'destructive',
              onPress: async () => {
                try {
                  const token = await AsyncStorage.getItem('userToken');
                  const response = await axios.delete(
                    `${API_BASE_URL}/events/${eventId}/roster/${encodeURIComponent(
                      playerUsername,
                    )}`,
                    token
                      ? {headers: {Authorization: `Bearer ${token}`}}
                      : undefined,
                  );
                  const updatedRoster =
                    response.data?.roster ||
                    roster.filter(p => p.username !== playerUsername);
                  setRoster(updatedRoster);
                  updateRosterSpots(eventId, updatedRoster.length);
                  if (response.data?.invitedUsers) {
                    setInvitedUsers(response.data.invitedUsers);
                    setInvitedUserDetails(prev =>
                      prev.filter(u =>
                        response.data.invitedUsers.includes(u._id),
                      ),
                    );
                  } else {
                    const booted = roster.find(
                      p => p.username === playerUsername,
                    );
                    if (booted?.userId) {
                      setInvitedUsers(prev =>
                        prev.filter(id => id !== booted.userId),
                      );
                      setInvitedUserDetails(prev =>
                        prev.filter(u => u._id !== booted.userId),
                      );
                    }
                  }
                  if (response.data?.removedUserIds) {
                    setRemovedUserIds(response.data.removedUserIds);
                  }
                  if (response.data?.waitlist) {
                    setWaitlist(response.data.waitlist);
                  }
                  if (response.data?.rsvps) {
                    setRsvps(response.data.rsvps);
                  }
                } catch (error: any) {
                  Alert.alert(
                    t('common.error'),
                    error?.response?.data?.message ||
                      t('roster.bootError') ||
                      'Failed to remove player',
                  );
                }
              },
            },
          ],
        );
        return;
      }

      if (!userData?.username || playerUsername !== userData.username) {
        Alert.alert(
          t('roster.onlyRemoveSelf'),
          t('roster.onlyRemoveSelfMessage'),
        );
        return;
      }
      Alert.alert(t('roster.leaveConfirm'), t('roster.leaveConfirmMessage'), [
        {text: t('common.cancel'), style: 'cancel'},
        {
          text: t('common.leave'),
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('userToken');
              await axios.delete(
                `${API_BASE_URL}/events/${eventId}/roster/${encodeURIComponent(
                  playerUsername,
                )}`,
                token
                  ? {headers: {Authorization: `Bearer ${token}`}}
                  : undefined,
              );
            } catch (error) {
              console.error('Error leaving event:', error);
            }
            const updatedRoster = roster.filter(
              p => p.username !== playerUsername,
            );
            setRoster(updatedRoster);
            updateRosterSpots(eventId, updatedRoster.length);
            notificationService
              .cancelEventNotifications(eventId)
              .catch(() => {});
          },
        },
      ]);
    },
    [userData?.username, t, eventId, updateRosterSpots, roster, isEventCreator],
  );

  const handleJoinWaitlist = useCallback(async () => {
    setJoiningWaitlist(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await axios.post(
        `${API_BASE_URL}/events/${eventId}/waitlist`,
        {},
        {headers: token ? {Authorization: `Bearer ${token}`} : {}},
      );
      if (response.data.joinedRoster) {
        if (response.data.roster) {
          setRoster(response.data.roster);
        }
        if (typeof response.data.totalSpots === 'number') {
          setTotalSpots(response.data.totalSpots);
        }
        if (Array.isArray(response.data.roster)) {
          updateRosterSpots(eventId, response.data.roster.length);
        }
        Alert.alert(
          t('common.success') || 'Success',
          t('roster.invitedJoinBody') ||
            "You're on the roster — the host reserved a spot for you.",
        );
        return;
      }
      if (response.data.waitlist) {
        setWaitlist(response.data.waitlist);
      }
      Alert.alert(
        t('common.success') || 'Success',
        `You're #${response.data.position} on the waitlist. We'll notify you when a spot opens!`,
      );
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Failed to join waitlist';
      Alert.alert(t('common.error') || 'Error', msg);
    } finally {
      setJoiningWaitlist(false);
    }
  }, [eventId, t, updateRosterSpots]);

  const handleLeaveWaitlist = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await axios.delete(
        `${API_BASE_URL}/events/${eventId}/waitlist`,
        {headers: token ? {Authorization: `Bearer ${token}`} : {}},
      );
      if (response.data.waitlist) {
        setWaitlist(response.data.waitlist);
      }
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Failed to leave waitlist';
      Alert.alert(t('common.error') || 'Error', msg);
    }
  }, [eventId, t]);

  // Open edit modal for current user
  const handleEdit = useCallback(() => {
    const currentPlayer = roster.find(p => p.username === userData?.username);
    if (currentPlayer) {
      setEditPaidStatus(currentPlayer.paidStatus);
      setEditJerseyColor(currentPlayer.jerseyColor);
      setEditPosition(currentPlayer.position);
      setEditModalVisible(true);
    }
  }, [roster, userData?.username]);

  // Save edited player info
  const handleSaveEdit = useCallback(async () => {
    const isSport = isTeamSport(eventType);
    if (
      !editPosition ||
      (isSport && !editJerseyColor) ||
      (isSport && trackPayment && !editPaidStatus)
    ) {
      Alert.alert(t('roster.missingFields'), t('roster.missingFieldsMessage'));
      return;
    }
    const updatedRoster = roster.map(player =>
      player.username === userData?.username
        ? {
            ...player,
            paidStatus:
              isSport && trackPayment
                ? editPaidStatus
                : player.paidStatus || 'N/A',
            jerseyColor: editJerseyColor,
            position: editPosition,
          }
        : player,
    );
    setRoster(updatedRoster);
    await persistRoster(updatedRoster);
    setEditModalVisible(false);
  }, [
    editPaidStatus,
    editJerseyColor,
    editPosition,
    userData?.username,
    t,
    roster,
    eventType,
    trackPayment,
    persistRoster,
  ]);

  const renderPlayerCard = ({
    item,
    index: _index,
  }: {
    item: Player;
    index: number;
  }) => {
    const isSelf = item.username === userData?.username;
    const jerseyColorHex = jerseyColors[item.jerseyColor] || jerseyColors.Other;
    const isLight = isLightColor(item.jerseyColor);
    // Allow navigation to any other user's profile (not just those with userId)
    const canNavigateToProfile = !isSelf;

    // For the current user, use their latest profilePicUrl from context
    // For other users, use the stored profilePicUrl from roster
    const displayProfilePicUrl = isSelf
      ? userData?.profilePicUrl || item.profilePicUrl
      : item.profilePicUrl;

    const avatarContent = displayProfilePicUrl ? (
      <Image
        source={{uri: displayProfilePicUrl}}
        style={[
          themedStyles.avatarImage,
          {borderWidth: 3, borderColor: jerseyColorHex, marginRight: 0},
        ]}
      />
    ) : (
      <View
        style={[
          themedStyles.avatar,
          {backgroundColor: jerseyColorHex, marginRight: 0},
          isLight && themedStyles.avatarLight,
        ]}>
        <Text
          style={[
            themedStyles.avatarText,
            isLight && themedStyles.avatarTextDark,
          ]}>
          {getInitials(item.username)}
        </Text>
      </View>
    );

    const hostInfo = item.userId ? hostRatings[item.userId] : undefined;
    const playerInfo = item.userId ? playerRatings[item.userId] : undefined;
    // Prefer player chip (everyone); fall back to host chip for frequent hosts.
    let chipInfo: {average: number; kind: 'player' | 'host'} | null = null;
    if (playerInfo && playerInfo.count >= ROSTER_RATING_MIN_COUNT) {
      chipInfo = {average: playerInfo.average, kind: 'player'};
    } else if (hostInfo && hostInfo.count >= ROSTER_RATING_MIN_COUNT) {
      chipInfo = {average: hostInfo.average, kind: 'host'};
    }

    const alreadyRated = item.userId
      ? ratedPlayerIds.has(String(item.userId))
      : false;

    const openPlayerRating = () => {
      if (!item.userId || isSelf || !isUserOnRoster) {
        return;
      }
      if (alreadyRated) {
        Alert.alert(
          'Already rated',
          "You've already rated this player. Each person can leave one review.",
        );
        return;
      }
      setPlayerModalTarget({
        userId: item.userId,
        username: item.username,
        eventId,
      });
      setPlayerModalVisible(true);
    };

    const avatarWithChip = (
      <View style={themedStyles.avatarWrap}>
        {canNavigateToProfile ? (
          <TouchableOpacity
            onPress={() => handlePlayerPress(item)}
            activeOpacity={0.7}>
            {avatarContent}
          </TouchableOpacity>
        ) : (
          avatarContent
        )}
        {chipInfo && (
          <View style={themedStyles.ratingChip} pointerEvents="none">
            <FontAwesomeIcon
              icon={faStar}
              size={8}
              color={chipInfo.kind === 'host' ? '#F5A623' : '#4FC3F7'}
            />
            <Text style={themedStyles.ratingChipText}>
              {chipInfo.average.toFixed(1)}
            </Text>
          </View>
        )}
        {!isSelf && isUserOnRoster && !!item.userId && (
          <TouchableOpacity
            style={themedStyles.ratePlayerFab}
            onPress={openPlayerRating}
            hitSlop={8}
            accessibilityLabel={
              alreadyRated
                ? `Already rated ${item.username}`
                : `Rate ${item.username} as player`
            }>
            <FontAwesomeIcon icon={faStar} size={9} color="#F5A623" />
          </TouchableOpacity>
        )}
      </View>
    );

    const hasTeam =
      isTeamSport(eventType) &&
      !!item.jerseyColor &&
      item.jerseyColor !== 'N/A';
    const validPositions =
      positionOptions[eventType] || positionOptions.Default;
    const displayPosition = validPositions.includes(item.position)
      ? item.position
      : validPositions[0];

    const openPlayerMenu = () => {
      const options: {
        label: string;
        style?: 'destructive' | 'cancel';
        onPress: () => void;
      }[] = [];

      if (isSelf) {
        options.push({
          label: t('roster.editPlayer') || 'Edit',
          onPress: handleEdit,
        });
        options.push({
          label: t('roster.leaveRoster') || 'Leave',
          style: 'destructive',
          onPress: () => handleDelete(item.username),
        });
      } else {
        if (item.userId) {
          options.push({
            label: t('roster.message') || 'Message',
            onPress: () =>
              messageUser({
                userId: item.userId,
                username: item.username,
                profilePicUrl: item.profilePicUrl,
              }),
          });
        }
        if (isEventCreator) {
          options.push({
            label: t('roster.boot') || 'Remove',
            style: 'destructive',
            onPress: () => handleDelete(item.username, {boot: true}),
          });
        }
      }
      if (options.length === 0) {
        return;
      }
      options.push({
        label: t('common.cancel') || 'Cancel',
        style: 'cancel',
        onPress: () => {},
      });

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: options.map(o => o.label),
            cancelButtonIndex: options.length - 1,
            destructiveButtonIndex: options.findIndex(
              o => o.style === 'destructive',
            ),
          },
          idx => options[idx]?.onPress?.(),
        );
      } else {
        Alert.alert(
          item.username,
          undefined,
          options.map(o => ({
            text: o.label,
            style: o.style,
            onPress: o.onPress,
          })),
        );
      }
    };

    const showMenu = isSelf || !!item.userId || isEventCreator;

    return (
      <View
        key={item.userId || item.username}
        style={[
          themedStyles.playerCard,
          isSelf && themedStyles.playerCardSelf,
          hasTeam && themedStyles.playerCardWithTeam,
        ]}>
        {hasTeam ? (
          <View
            style={[
              themedStyles.playerCardTeamRail,
              {backgroundColor: jerseyColorHex},
            ]}
            pointerEvents="none"
          />
        ) : null}
        {avatarWithChip}
        <View style={themedStyles.playerInfo}>
          {canNavigateToProfile ? (
            <TouchableOpacity onPress={() => handlePlayerPress(item)}>
              <Text style={[themedStyles.playerName, {color: colors.primary}]}>
                {item.username}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={themedStyles.playerName}>
              {item.username} {isSelf && '(You)'}
            </Text>
          )}
          <View style={themedStyles.playerDetails}>
            {hasTeam ? (
              <View style={themedStyles.teamPill}>
                <View
                  style={[
                    themedStyles.jerseyIndicator,
                    {backgroundColor: jerseyColorHex},
                  ]}
                />
                <Text style={themedStyles.teamPillText}>
                  {item.jerseyColor}
                </Text>
              </View>
            ) : null}
            <View style={themedStyles.playerBadge}>
              <FontAwesomeIcon icon={faFutbol} size={10} color={colors.text} />
              <Text style={themedStyles.playerBadgeText}>
                {displayPosition}
              </Text>
            </View>
            {trackPayment &&
              isTeamSport(eventType) &&
              item.paidStatus !== 'N/A' && (
                <View
                  style={[
                    themedStyles.playerBadge,
                    item.paidStatus === 'Paid'
                      ? themedStyles.paidBadge
                      : themedStyles.unpaidBadge,
                  ]}>
                  <FontAwesomeIcon
                    icon={item.paidStatus === 'Paid' ? faCheck : faTimes}
                    size={10}
                    color={
                      item.paidStatus === 'Paid' ? '#4CAF50' : colors.error
                    }
                  />
                  <Text
                    style={[
                      themedStyles.playerBadgeText,
                      item.paidStatus === 'Paid'
                        ? themedStyles.paidBadgeText
                        : themedStyles.unpaidBadgeText,
                    ]}>
                    {item.paidStatus}
                  </Text>
                </View>
              )}
          </View>
        </View>
        {showMenu ? (
          <TouchableOpacity
            style={themedStyles.kebabBtn}
            onPress={openPlayerMenu}
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
            <FontAwesomeIcon
              icon={faEllipsisH}
              size={16}
              color={colors.secondaryText}
            />
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  const progressPercentage =
    totalSpots > 0 ? Math.min((roster.length / totalSpots) * 100, 100) : 0;
  const spotsRemaining =
    totalSpots > 0 ? Math.max(totalSpots - roster.length, 0) : null;
  const sportEmoji = sportEmojis[eventType] || '🎯';

  return (
    <SafeAreaView style={themedStyles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <ScrollView
          style={themedStyles.container}
          contentContainerStyle={themedStyles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {/* Event Header */}
          <Animated.View
            style={[
              themedStyles.eventHeader,
              highlightedFields.has('name') && {
                backgroundColor: highlightBgColor,
                borderRadius: 10,
                marginHorizontal: -6,
                paddingHorizontal: 6,
              },
            ]}>
            <Text style={themedStyles.eventEmoji}>{sportEmoji}</Text>
            <Text style={themedStyles.eventName} numberOfLines={2}>
              {eventName}
            </Text>
          </Animated.View>

          <View style={themedStyles.surfaceSegment}>
            <TouchableOpacity
              style={[
                themedStyles.surfaceSegmentBtn,
                surfaceTab === 'details' &&
                  themedStyles.surfaceSegmentBtnActive,
              ]}
              activeOpacity={0.85}
              onPress={() => setSurfaceTab('details')}>
              <FontAwesomeIcon
                icon={faInfoCircle}
                size={13}
                color={
                  surfaceTab === 'details' ? '#FFFFFF' : colors.secondaryText
                }
              />
              <Text
                style={[
                  themedStyles.surfaceSegmentText,
                  surfaceTab === 'details' &&
                    themedStyles.surfaceSegmentTextActive,
                ]}>
                {t('roster.tabDetails') || 'Details'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                themedStyles.surfaceSegmentBtn,
                surfaceTab === 'roster' && themedStyles.surfaceSegmentBtnActive,
              ]}
              activeOpacity={0.85}
              onPress={() => setSurfaceTab('roster')}>
              <FontAwesomeIcon
                icon={faUsers}
                size={13}
                color={
                  surfaceTab === 'roster' ? '#FFFFFF' : colors.secondaryText
                }
              />
              <Text
                style={[
                  themedStyles.surfaceSegmentText,
                  surfaceTab === 'roster' &&
                    themedStyles.surfaceSegmentTextActive,
                ]}>
                {t('roster.tabRoster') || 'Roster'}
                {roster.length > 0 ? ` · ${roster.length}` : ''}
              </Text>
            </TouchableOpacity>
          </View>

          {surfaceTab === 'details' ? (
            <>
              {/* Event Details Card */}
              <View style={themedStyles.eventCard}>
                <View style={themedStyles.eventTypeRow}>
                  <View style={themedStyles.eventTypeBadge}>
                    <Text style={themedStyles.eventTypeText}>{eventType}</Text>
                  </View>
                </View>

                {date && (
                  <Animated.View
                    style={[
                      themedStyles.eventDetailRow,
                      highlightedFields.has('date') && {
                        backgroundColor: highlightBgColor,
                        borderRadius: 8,
                        marginHorizontal: -6,
                        paddingHorizontal: 6,
                      },
                    ]}>
                    <Text style={themedStyles.eventDetailIcon}>📅</Text>
                    <Text style={themedStyles.eventDetailText}>{date}</Text>
                  </Animated.View>
                )}
                {time && (
                  <Animated.View
                    style={[
                      themedStyles.eventDetailRow,
                      highlightedFields.has('time') && {
                        backgroundColor: highlightBgColor,
                        borderRadius: 8,
                        marginHorizontal: -6,
                        paddingHorizontal: 6,
                      },
                    ]}>
                    <Text style={themedStyles.eventDetailIcon}>🕐</Text>
                    <Text style={themedStyles.eventDetailText}>{time}</Text>
                  </Animated.View>
                )}
                {location && (
                  <Animated.View
                    style={[
                      themedStyles.eventDetailRow,
                      highlightedFields.has('location') && {
                        backgroundColor: highlightBgColor,
                        borderRadius: 8,
                        marginHorizontal: -6,
                        paddingHorizontal: 6,
                      },
                    ]}>
                    <Text style={themedStyles.eventDetailIcon}>📍</Text>
                    <Text style={themedStyles.eventDetailText}>
                      {isVirtual
                        ? (() => {
                            const badge =
                              t('events.virtualLocationBadge') || 'Other';
                            const loc = location.trim();
                            const generic =
                              !loc ||
                              loc.toLowerCase() === 'other' ||
                              loc.toLowerCase() === 'online / other' ||
                              loc.toLowerCase() === 'online/other';
                            return generic ? badge : `${badge} · ${loc}`;
                          })()
                        : location}
                    </Text>
                  </Animated.View>
                )}

                {(canAddToCalendar || canRateEvent) && (
                  <View style={themedStyles.eventActionButtons}>
                    {canAddToCalendar && (
                      <TouchableOpacity
                        style={themedStyles.rateEventButton}
                        onPress={() =>
                          addEventToCalendar(
                            {
                              title: eventName || 'BetterPlay event',
                              date,
                              time,
                              durationMinutes,
                              location,
                              eventType,
                            },
                            t,
                          )
                        }>
                        <FontAwesomeIcon
                          icon={faCalendarPlus}
                          size={13}
                          color={colors.primary}
                        />
                        <Text style={themedStyles.rateEventButtonText}>
                          {t('events.addToCalendar', {
                            defaultValue: 'Add to calendar',
                          })}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {canRateEvent && (
                      <TouchableOpacity
                        style={themedStyles.rateEventButton}
                        onPress={() => setRatingModalVisible(true)}>
                        <FontAwesomeIcon
                          icon={faStar}
                          size={13}
                          color={colors.primary}
                        />
                        <Text style={themedStyles.rateEventButtonText}>
                          Rate this event
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Group banner — shown whenever an event belongs to a Group.
                Tappable to jump straight to the group. For recurring series
                it also explains the live-link (adding a member invites them
                to future instances automatically). */}
                {paramGroupName ? (
                  <TouchableOpacity
                    style={themedStyles.groupLinkBanner}
                    activeOpacity={0.7}
                    onPress={() => openGroup(paramGroupId)}
                    disabled={!paramGroupId}>
                    <FontAwesomeIcon
                      icon={faUsers}
                      size={13}
                      color={colors.primary}
                    />
                    <Text style={themedStyles.groupLinkBannerText}>
                      {paramIsRecurring ? (
                        <>
                          This series invites everyone in{' '}
                          <Text style={themedStyles.groupLinkBannerName}>
                            {paramGroupName}
                          </Text>
                          .
                        </>
                      ) : (
                        <>
                          Part of{' '}
                          <Text style={themedStyles.groupLinkBannerName}>
                            {paramGroupName}
                          </Text>
                        </>
                      )}
                    </Text>
                    {paramGroupId ? (
                      <FontAwesomeIcon
                        icon={faChevronRight}
                        size={12}
                        color={colors.primary}
                      />
                    ) : null}
                  </TouchableOpacity>
                ) : null}

                {/* Progress Bar */}
                <Animated.View
                  style={[
                    themedStyles.progressSection,
                    highlightedFields.has('totalSpots') && {
                      backgroundColor: highlightBgColor,
                      borderRadius: 8,
                      marginHorizontal: -6,
                      paddingHorizontal: 6,
                    },
                  ]}>
                  <View style={themedStyles.progressHeader}>
                    <Text style={themedStyles.progressLabel}>
                      {t('roster.rosterSpots')}
                    </Text>
                    <Text style={themedStyles.progressCount}>
                      {totalSpots > 0
                        ? `${roster.length} / ${totalSpots}`
                        : `${roster.length} · ${
                            t('events.noLimit') || 'No limit'
                          }`}
                    </Text>
                  </View>
                  <View style={themedStyles.progressBarBg}>
                    <View
                      style={[
                        themedStyles.progressBarFill,
                        {width: `${progressPercentage}%`},
                      ]}
                    />
                  </View>
                  <Text style={themedStyles.progressRemaining}>
                    {spotsRemaining === null
                      ? t('events.noLimit') || 'No limit'
                      : spotsRemaining > 0
                      ? t('roster.spotsRemaining', {count: spotsRemaining})
                      : t('roster.rosterFull')}
                    {isEventFull && waitlist.length > 0
                      ? ` · ${waitlist.length} on waitlist`
                      : ''}
                  </Text>
                </Animated.View>
              </View>

              {/* Stats Section */}
              {roster.length > 0 && (
                <View style={themedStyles.statsSection}>
                  <Text style={themedStyles.statsSectionTitle}>
                    📊 {t('roster.rosterStats')}
                  </Text>
                  <View style={themedStyles.statsRow}>
                    <View style={themedStyles.statItem}>
                      <Text style={themedStyles.statValue}>
                        {roster.length}
                      </Text>
                      <Text style={themedStyles.statLabel}>
                        {t('roster.players')}
                      </Text>
                    </View>
                    {isTeamSport(eventType) && trackPayment && (
                      <View style={themedStyles.statItem}>
                        <Text style={themedStyles.statValueGreen}>
                          {rosterStats.paidCount}
                        </Text>
                        <Text style={themedStyles.statLabel}>
                          {t('roster.paid')}
                        </Text>
                      </View>
                    )}
                    {isTeamSport(eventType) && trackPayment && (
                      <View style={themedStyles.statItem}>
                        <Text style={themedStyles.statValueError}>
                          {rosterStats.unpaidCount}
                        </Text>
                        <Text style={themedStyles.statLabel}>
                          {t('roster.unpaid')}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Team Breakdown - Sports only */}
                  {isTeamSport(eventType) &&
                    Object.keys(rosterStats.teamCounts).length > 1 && (
                      <View style={themedStyles.teamBreakdown}>
                        <Text style={themedStyles.statsSectionTitleSmall}>
                          {t('roster.teamsByJersey')}
                        </Text>
                        <View style={themedStyles.teamRow}>
                          {Object.entries(rosterStats.teamCounts).map(
                            ([color, count]) => (
                              <View
                                key={color}
                                style={[
                                  themedStyles.teamBadge,
                                  {
                                    borderColor:
                                      jerseyColors[color] || jerseyColors.Other,
                                  },
                                ]}>
                                <View
                                  style={[
                                    themedStyles.jerseyIndicator,
                                    {
                                      backgroundColor:
                                        jerseyColors[color] ||
                                        jerseyColors.Other,
                                    },
                                  ]}
                                />
                                <Text style={themedStyles.teamBadgeText}>
                                  {color}: {count}
                                </Text>
                              </View>
                            ),
                          )}
                        </View>
                      </View>
                    )}
                </View>
              )}

              {/* Primary CTAs — Join / Suggest guest / Invite (obvious buttons) */}
              {((canJoinEvent && !isUserOnRoster) ||
                canSuggestGuests ||
                (eventPrivacy === 'invite-only' && isEventCreator)) && (
                <View style={themedStyles.primaryActionsRow}>
                  {canJoinEvent && !isUserOnRoster && (
                    <TouchableOpacity
                      style={themedStyles.primaryActionButton}
                      onPress={() => {
                        if (isEventFull && !isMyReservation) {
                          if (isUserOnWaitlist) {
                            handleLeaveWaitlist();
                          } else {
                            handleJoinWaitlist();
                          }
                          return;
                        }
                        setAddPlayerExpanded(true);
                      }}
                      activeOpacity={0.85}
                      disabled={joiningWaitlist}>
                      {joiningWaitlist ? (
                        <ActivityIndicator
                          size="small"
                          color={colors.buttonText || '#fff'}
                        />
                      ) : (
                        <FontAwesomeIcon
                          icon={faUserPlus}
                          size={16}
                          color={colors.buttonText || '#fff'}
                        />
                      )}
                      <Text style={themedStyles.primaryActionButtonText}>
                        {isEventFull && !isMyReservation
                          ? isUserOnWaitlist
                            ? `Leave Waitlist (#${userWaitlistPosition})`
                            : t('roster.joinWaitlist') || 'Join Waitlist'
                          : t('roster.joinEvent')}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {canSuggestGuests && (
                    <TouchableOpacity
                      style={[
                        themedStyles.primaryActionButton,
                        ((canJoinEvent && !isUserOnRoster) ||
                          (eventPrivacy === 'invite-only' && isEventCreator)) &&
                          themedStyles.primaryActionButtonSecondary,
                      ]}
                      onPress={() => setInviteExpanded(true)}
                      activeOpacity={0.85}>
                      <FontAwesomeIcon
                        icon={faEnvelope}
                        size={16}
                        color={
                          (canJoinEvent && !isUserOnRoster) ||
                          (eventPrivacy === 'invite-only' && isEventCreator)
                            ? colors.primary
                            : colors.buttonText || '#fff'
                        }
                      />
                      <Text
                        style={[
                          themedStyles.primaryActionButtonText,
                          ((canJoinEvent && !isUserOnRoster) ||
                            (eventPrivacy === 'invite-only' &&
                              isEventCreator)) &&
                            themedStyles.primaryActionButtonTextSecondary,
                        ]}>
                        {t('roster.suggestGuest') || 'Suggest a guest'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {eventPrivacy === 'invite-only' && isEventCreator && (
                    <TouchableOpacity
                      style={[
                        themedStyles.primaryActionButton,
                        ((canJoinEvent && !isUserOnRoster) ||
                          canSuggestGuests) &&
                          themedStyles.primaryActionButtonSecondary,
                      ]}
                      onPress={() => setInviteExpanded(true)}
                      activeOpacity={0.85}>
                      <FontAwesomeIcon
                        icon={faEnvelope}
                        size={16}
                        color={
                          (canJoinEvent && !isUserOnRoster) || canSuggestGuests
                            ? colors.primary
                            : colors.buttonText || '#fff'
                        }
                      />
                      <Text
                        style={[
                          themedStyles.primaryActionButtonText,
                          ((canJoinEvent && !isUserOnRoster) ||
                            canSuggestGuests) &&
                            themedStyles.primaryActionButtonTextSecondary,
                        ]}>
                        {t('roster.invitePlayers') || 'Invite People'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Join form — expands from the primary Join button */}
              {canJoinEvent && !isUserOnRoster && addPlayerExpanded && (
                <View style={themedStyles.addPlayerSection}>
                  <View style={themedStyles.addPlayerContent}>
                    {errorMessage ? (
                      <Text style={themedStyles.errorMessage}>
                        {errorMessage}
                      </Text>
                    ) : null}

                    <TextInput
                      style={themedStyles.input}
                      placeholder={t('roster.yourName')}
                      placeholderTextColor={colors.placeholder}
                      value={username}
                      onChangeText={setUsername}
                    />

                    {/* Paid Status Dropdown - only when host opted into tracking */}
                    {isTeamSport(eventType) && trackPayment && (
                      <TouchableOpacity
                        style={themedStyles.dropdown}
                        onPress={() => setPaidStatusModalVisible(true)}>
                        <Text
                          style={
                            paidStatus
                              ? themedStyles.dropdownText
                              : themedStyles.placeholderText
                          }>
                          {paidStatus || t('roster.selectPaidStatus')}
                        </Text>
                        <FontAwesomeIcon
                          icon={faChevronDown}
                          size={14}
                          color={colors.placeholder}
                        />
                      </TouchableOpacity>
                    )}

                    {/* Jersey Color Dropdown - Sports only */}
                    {isTeamSport(eventType) && (
                      <TouchableOpacity
                        style={themedStyles.dropdown}
                        onPress={() => setJerseyColorModalVisible(true)}>
                        <View style={themedStyles.jerseyDropdownRow}>
                          {jerseyColor && (
                            <View
                              style={[
                                themedStyles.jerseyIndicatorLarge,
                                {
                                  backgroundColor:
                                    jerseyColors[jerseyColor] ||
                                    jerseyColors.Other,
                                },
                              ]}
                            />
                          )}
                          <Text
                            style={
                              jerseyColor
                                ? themedStyles.dropdownText
                                : themedStyles.placeholderText
                            }>
                            {jerseyColor || t('roster.selectJerseyColor')}
                          </Text>
                        </View>
                        <FontAwesomeIcon
                          icon={faChevronDown}
                          size={14}
                          color={colors.placeholder}
                        />
                      </TouchableOpacity>
                    )}

                    {/* Position Dropdown */}
                    <TouchableOpacity
                      style={themedStyles.dropdown}
                      onPress={() => setPositionModalVisible(true)}>
                      <Text
                        style={
                          position
                            ? themedStyles.dropdownText
                            : themedStyles.placeholderText
                        }>
                        {position || t('roster.selectPosition')}
                      </Text>
                      <FontAwesomeIcon
                        icon={faChevronDown}
                        size={14}
                        color={colors.placeholder}
                      />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        themedStyles.saveButton,
                        ((spotsRemaining === 0 && !isMyReservation) ||
                          savingRoster) &&
                          themedStyles.saveButtonDisabled,
                        isMyReservation && {backgroundColor: colors.primary},
                      ]}
                      onPress={handleSave}
                      disabled={
                        (spotsRemaining === 0 && !isMyReservation) ||
                        savingRoster
                      }>
                      {savingRoster ? (
                        <ActivityIndicator
                          size="small"
                          color={colors.buttonText}
                        />
                      ) : (
                        <FontAwesomeIcon
                          icon={
                            isMyReservation || spotsRemaining === 0
                              ? faUserPlus
                              : faCheck
                          }
                          size={16}
                          color={colors.buttonText}
                        />
                      )}
                      <Text style={themedStyles.buttonText}>
                        {savingRoster
                          ? t('common.loading') || 'Joining...'
                          : isMyReservation
                          ? 'Claim Your Spot!'
                          : spotsRemaining === 0
                          ? t('roster.rosterFull')
                          : t('common.confirm') || 'Confirm'}
                      </Text>
                    </TouchableOpacity>

                    {isEventFull && !isUserOnRoster && !isMyReservation && (
                      <TouchableOpacity
                        style={[
                          themedStyles.saveButton,
                          {marginTop: 10},
                          isUserOnWaitlist && {backgroundColor: colors.error},
                        ]}
                        onPress={
                          isUserOnWaitlist
                            ? handleLeaveWaitlist
                            : handleJoinWaitlist
                        }
                        disabled={joiningWaitlist}>
                        {joiningWaitlist ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.buttonText}
                          />
                        ) : null}
                        <Text style={themedStyles.buttonText}>
                          {joiningWaitlist
                            ? 'Joining...'
                            : isUserOnWaitlist
                            ? `Leave Waitlist (#${userWaitlistPosition})`
                            : t('roster.joinWaitlist') || 'Join Waitlist'}
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={() => setAddPlayerExpanded(false)}
                      style={{alignItems: 'center', paddingTop: 12}}>
                      <Text
                        style={{
                          color: colors.secondaryText,
                          fontWeight: '600',
                        }}>
                        {t('common.cancel') || 'Cancel'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {canJoinEvent && isUserOnRoster && (
                <View style={themedStyles.addPlayerSection}>
                  <View
                    style={[
                      themedStyles.addPlayerContent,
                      {paddingTop: 12, paddingBottom: 12},
                    ]}>
                    <View style={themedStyles.alreadyJoinedBadge}>
                      <FontAwesomeIcon
                        icon={faCheck}
                        size={14}
                        color={colors.primary}
                      />
                      {(() => {
                        const me = roster.find(
                          p =>
                            p.username === userData?.username ||
                            p.userId === userData?._id,
                        );
                        const myTeam =
                          isTeamSport(eventType) &&
                          me?.jerseyColor &&
                          me.jerseyColor !== 'N/A'
                            ? me.jerseyColor
                            : null;
                        return (
                          <>
                            {myTeam ? (
                              <View
                                style={[
                                  themedStyles.jerseyIndicator,
                                  {
                                    backgroundColor:
                                      jerseyColors[myTeam] ||
                                      jerseyColors.Other,
                                  },
                                ]}
                              />
                            ) : null}
                            <Text style={themedStyles.alreadyJoinedText}>
                              {myTeam
                                ? t('roster.youreOnTeam', {team: myTeam}) ||
                                  `You're on ${myTeam}`
                                : t('roster.youreOnTheRoster')}
                            </Text>
                          </>
                        );
                      })()}
                    </View>
                  </View>
                </View>
              )}

              {/* Spot Reservation Banner */}
              {hasActiveReservation && spotReservation && (
                <View
                  style={{
                    backgroundColor: isMyReservation
                      ? colors.primary + '12'
                      : '#FF9800' + '12',
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderTopWidth: 2,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderTopColor: isMyReservation
                      ? colors.primary
                      : '#FF9800',
                    borderBottomColor: colors.border,
                  }}>
                  {isMyReservation ? (
                    <>
                      <Text
                        style={{
                          color: colors.primary,
                          fontSize: 15,
                          fontWeight: '700',
                          marginBottom: 4,
                        }}>
                        A spot is reserved for you!
                      </Text>
                      <Text
                        style={{
                          color: colors.secondaryText,
                          fontSize: 13,
                        }}>
                        Join the roster before your reservation expires. Use the
                        "Join This Event" section above to claim your spot.
                      </Text>
                      <ReservationCountdown
                        expiresAt={spotReservation.expiresAt}
                        colors={colors}
                      />
                    </>
                  ) : (
                    <>
                      <Text
                        style={{
                          color: '#FF9800',
                          fontSize: 14,
                          fontWeight: '600',
                        }}>
                        A spot is being held for {spotReservation.username}
                      </Text>
                      <ReservationCountdown
                        expiresAt={spotReservation.expiresAt}
                        colors={colors}
                      />
                    </>
                  )}
                </View>
              )}

              {/* Waitlist Section - visible when there are waitlisted users */}
              {waitlist.length > 0 && (
                <View style={themedStyles.statsSection}>
                  <Text style={themedStyles.statsSectionTitle}>
                    ⏳ Waitlist ({waitlist.length})
                  </Text>
                  {waitlist.map((entry, index) => {
                    const isMe = entry.userId === userData?._id;
                    const displayPic = isMe
                      ? userData?.profilePicUrl || entry.profilePicUrl
                      : entry.profilePicUrl;

                    return (
                      <TouchableOpacity
                        key={entry.userId}
                        activeOpacity={isMe ? 1.0 : 0.7}
                        onPress={() => {
                          if (!isMe && entry.userId) {
                            navigation.navigate('PublicProfile', {
                              userId: entry.userId,
                              username: entry.username,
                              profilePicUrl: displayPic,
                            });
                          }
                        }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 10,
                          borderBottomWidth:
                            index < waitlist.length - 1
                              ? StyleSheet.hairlineWidth
                              : 0,
                          borderBottomColor: colors.border,
                        }}>
                        {/* Position badge */}
                        <View
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 11,
                            backgroundColor: colors.primary + '15',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginRight: 8,
                          }}>
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: '700',
                              color: colors.primary,
                            }}>
                            {index + 1}
                          </Text>
                        </View>

                        {/* Avatar — smaller and dashed-border style */}
                        {displayPic ? (
                          <Image
                            source={{uri: displayPic}}
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 18,
                              marginRight: 12,
                              borderWidth: 2,
                              borderColor: colors.primary + '50',
                              opacity: 0.85,
                            }}
                          />
                        ) : (
                          <View
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 18,
                              backgroundColor: colors.primary + '15',
                              borderWidth: 2,
                              borderColor: colors.primary + '40',
                              justifyContent: 'center',
                              alignItems: 'center',
                              marginRight: 12,
                              opacity: 0.85,
                            }}>
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: '600',
                                color: colors.primary,
                              }}>
                              {getInitials(entry.username)}
                            </Text>
                          </View>
                        )}

                        {/* Username */}
                        <Text
                          style={{
                            color: colors.text,
                            fontSize: 14,
                            fontWeight: '500',
                            flex: 1,
                            opacity: 0.85,
                          }}>
                          {entry.username}
                        </Text>

                        {/* "You" badge or "Waiting" label */}
                        {isMe ? (
                          <View
                            style={{
                              backgroundColor: colors.primary + '20',
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderRadius: 10,
                            }}>
                            <Text
                              style={{
                                fontSize: 11,
                                color: colors.primary,
                                fontWeight: '600',
                              }}>
                              You
                            </Text>
                          </View>
                        ) : (
                          <Text
                            style={{
                              fontSize: 11,
                              color: colors.secondaryText,
                              fontStyle: 'italic',
                            }}>
                            Waiting
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Invite / suggest guests — opened from the primary CTA above. */}
              {eventPrivacy === 'invite-only' &&
                (isEventCreator || canSuggestGuests) &&
                inviteExpanded && (
                  <View style={themedStyles.inviteSection}>
                    <View style={themedStyles.inviteContent}>
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
                            canSuggestGuests
                              ? t('roster.searchUsersToSuggest') ||
                                'Search people to suggest...'
                              : t('roster.searchUsersToInvite') ||
                                'Search users to invite...'
                          }
                          placeholderTextColor={colors.placeholder}
                          value={inviteSearchQuery}
                          onChangeText={text => {
                            setInviteSearchQuery(text);
                            searchUsersToInvite(text);
                          }}
                          autoFocus
                        />
                        {loadingInviteSearch && (
                          <ActivityIndicator
                            size="small"
                            color={colors.primary}
                          />
                        )}
                      </View>

                      {/* Search Results */}
                      {inviteSearchResults.length > 0 && (
                        <View style={themedStyles.inviteSearchResults}>
                          {inviteSearchResults.map(user => (
                            <TouchableOpacity
                              key={user._id}
                              style={themedStyles.inviteSearchResultRow}
                              onPress={() => inviteUserToEvent(user)}>
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
                                  <Text
                                    style={themedStyles.inviteUserAvatarText}>
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

                      {/* Invited Users List (creator only) */}
                      {isEventCreator && invitedUserDetails.length > 0 && (
                        <View style={themedStyles.invitedUsersList}>
                          <Text style={themedStyles.invitedUsersLabel}>
                            {t('roster.invitedUsers') || 'Invited'} (
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
                                  onPress={() => removeInvite(user._id)}
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

                      {inviteSearchQuery.length === 0 &&
                        (canSuggestGuests ? (
                          <Text style={themedStyles.inviteHint}>
                            {t('roster.suggestGuestHint') ||
                              'Suggest someone — the host will approve before they get an invite'}
                          </Text>
                        ) : (
                          invitedUserDetails.length === 0 && (
                            <Text style={themedStyles.inviteHint}>
                              {t('roster.inviteHint') ||
                                'Search and add users who can see and join this event'}
                            </Text>
                          )
                        ))}

                      <TouchableOpacity
                        onPress={() => {
                          setInviteExpanded(false);
                          setInviteSearchQuery('');
                          setInviteSearchResults([]);
                        }}
                        style={{alignItems: 'center', paddingTop: 12}}>
                        <Text
                          style={{
                            color: colors.secondaryText,
                            fontWeight: '600',
                          }}>
                          {t('common.done') || 'Done'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
            </>
          ) : null}

          {surfaceTab === 'roster' ? (
            <>
              {/* Rostered Players Section */}
              <View style={themedStyles.rosterSection}>
                <View style={themedStyles.sectionHeader}>
                  <FontAwesomeIcon
                    icon={faUsers}
                    size={18}
                    color={colors.primary}
                  />
                  <Text style={themedStyles.sectionTitle}>
                    {t('roster.rosteredPlayers')} ({roster.length})
                  </Text>
                </View>

                {loading ? (
                  <RosterListSkeleton count={5} />
                ) : roster.length === 0 ? (
                  <Text style={themedStyles.emptyState}>
                    {t('roster.noPlayersYet')}
                  </Text>
                ) : (
                  <>
                    {/* Team tabs — one jersey at a time (no All). */}
                    {isTeamSport(eventType) && teamColors.length > 1 && (
                      <View style={themedStyles.teamTabsContainer}>
                        {teamColors.map(color => (
                          <TouchableOpacity
                            key={color}
                            style={[
                              themedStyles.teamTab,
                              activeTeamTab === color &&
                                themedStyles.teamTabActive,
                            ]}
                            onPress={() => setActiveTeamTab(color)}
                            activeOpacity={0.7}>
                            <View
                              style={[
                                themedStyles.teamTabDot,
                                {
                                  backgroundColor:
                                    jerseyColors[color] || jerseyColors.Other,
                                },
                              ]}
                            />
                            <Text
                              style={[
                                themedStyles.teamTabText,
                                activeTeamTab === color &&
                                  themedStyles.teamTabTextActive,
                              ]}
                              numberOfLines={1}>
                              {color}
                            </Text>
                            <Text
                              style={[
                                themedStyles.teamTabCount,
                                activeTeamTab === color &&
                                  themedStyles.teamTabCountActive,
                              ]}>
                              {rosterStats.teamCounts[color] || 0}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {/* Position Fill Summary */}
                    {isTeamSport(eventType) && scaledPositions && (
                      <View style={themedStyles.positionSummaryContainer}>
                        <Text style={themedStyles.positionSummaryTitle}>
                          Positions
                        </Text>
                        {positionSummary.map(
                          ({position: pos, filled, expected}) => {
                            const pct =
                              expected > 0
                                ? Math.min((filled / expected) * 100, 100)
                                : filled > 0
                                ? 100
                                : 0;
                            const isOver = expected > 0 && filled > expected;
                            return (
                              <View key={pos} style={themedStyles.positionRow}>
                                <Text style={themedStyles.positionLabel}>
                                  {pos}
                                </Text>
                                <View style={themedStyles.positionBarBg}>
                                  <View
                                    style={[
                                      themedStyles.positionBarFill,
                                      {width: `${pct}%`},
                                      isOver &&
                                        themedStyles.positionBarOverfill,
                                    ]}
                                  />
                                </View>
                                <Text style={themedStyles.positionCount}>
                                  {filled}
                                  {expected > 0 ? ` / ${expected}` : ''}
                                </Text>
                              </View>
                            );
                          },
                        )}
                      </View>
                    )}

                    {/* Payment Filter Tabs */}
                    {trackPayment &&
                      isTeamSport(eventType) &&
                      roster.length > 0 && (
                        <View style={themedStyles.paymentFilterContainer}>
                          {(['all', 'paid', 'unpaid'] as const).map(filter => {
                            const count =
                              filter === 'all'
                                ? activeTeamTab
                                  ? roster.filter(
                                      p => p.jerseyColor === activeTeamTab,
                                    ).length
                                  : roster.length
                                : filter === 'paid'
                                ? activeTeamTab
                                  ? roster.filter(
                                      p =>
                                        p.jerseyColor === activeTeamTab &&
                                        p.paidStatus === 'Paid',
                                    ).length
                                  : rosterStats.paidCount
                                : activeTeamTab
                                ? roster.filter(
                                    p =>
                                      p.jerseyColor === activeTeamTab &&
                                      p.paidStatus === 'Unpaid',
                                  ).length
                                : rosterStats.unpaidCount;
                            const label =
                              filter === 'all'
                                ? 'All'
                                : filter === 'paid'
                                ? 'Paid'
                                : 'Unpaid';
                            return (
                              <TouchableOpacity
                                key={filter}
                                style={[
                                  themedStyles.paymentFilterTab,
                                  paymentFilter === filter &&
                                    themedStyles.paymentFilterTabActive,
                                ]}
                                onPress={() => setPaymentFilter(filter)}
                                activeOpacity={0.7}>
                                <Text
                                  style={[
                                    themedStyles.paymentFilterText,
                                    paymentFilter === filter &&
                                      themedStyles.paymentFilterTextActive,
                                  ]}>
                                  {label} ({count})
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}

                    {/* Players grouped by position */}
                    {isTeamSport(eventType)
                      ? Object.entries(playersGroupedByPosition).map(
                          ([pos, players]) => {
                            if (
                              players.length === 0 &&
                              paymentFilter !== 'all'
                            ) {
                              return null;
                            }
                            const expected = scaledPositions
                              ? scaledPositions[pos] || 0
                              : 0;
                            return (
                              <View key={pos}>
                                <View style={themedStyles.positionGroupHeader}>
                                  <Text style={themedStyles.positionGroupTitle}>
                                    {pos}
                                  </Text>
                                  <Text style={themedStyles.positionGroupCount}>
                                    {players.length}
                                    {expected > 0 ? ` / ${expected}` : ''}
                                  </Text>
                                </View>
                                {players.length > 0 ? (
                                  players.map((player, idx) =>
                                    renderPlayerCard({
                                      item: player,
                                      index: idx,
                                    }),
                                  )
                                ) : (
                                  <Text style={themedStyles.emptyPositionText}>
                                    No players yet
                                  </Text>
                                )}
                              </View>
                            );
                          },
                        )
                      : filteredRoster.map((player, idx) =>
                          renderPlayerCard({item: player, index: idx}),
                        )}
                  </>
                )}
              </View>
            </>
          ) : null}

          {surfaceTab === 'details' ? (
            <>
              {/* Pending join requests (creator-only — the API only returns these
              to the owner). Approve to add them to the roster, deny to drop
              the request. */}
              {joinRequests.length > 0 && (
                <View style={themedStyles.rsvpSectionWrap}>
                  <View style={themedStyles.rsvpResponseSection}>
                    <Text style={themedStyles.rsvpSectionTitle}>
                      {t('roster.joinRequests') || 'Requests'} (
                      {joinRequests.length})
                    </Text>
                    {joinRequests.map(r => (
                      <View
                        key={`req-${r.userId}`}
                        style={themedStyles.requestRow}>
                        {r.profilePicUrl ? (
                          <Image
                            source={{uri: r.profilePicUrl}}
                            style={themedStyles.rsvpPersonAvatar}
                          />
                        ) : (
                          <View
                            style={[
                              themedStyles.rsvpPersonAvatar,
                              themedStyles.rsvpPersonAvatarFallback,
                            ]}>
                            <Text style={themedStyles.rsvpPersonAvatarText}>
                              {getInitials(r.username)}
                            </Text>
                          </View>
                        )}
                        <Text
                          style={themedStyles.rsvpPersonName}
                          numberOfLines={1}>
                          {r.username}
                        </Text>
                        <TouchableOpacity
                          style={themedStyles.requestApproveBtn}
                          onPress={() => handleApproveRequest(r.userId)}
                          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                          <FontAwesomeIcon
                            icon={faCheck}
                            size={14}
                            color="#fff"
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={themedStyles.requestDenyBtn}
                          onPress={() => handleDenyRequest(r.userId)}
                          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                          <FontAwesomeIcon
                            icon={faTimes}
                            size={14}
                            color="#fff"
                          />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {guestAddRequests.length > 0 && isEventCreator && (
                <View style={themedStyles.rsvpSectionWrap}>
                  <View style={themedStyles.rsvpResponseSection}>
                    <Text style={themedStyles.rsvpSectionTitle}>
                      {t('roster.guestSuggestions') || 'Guest suggestions'} (
                      {guestAddRequests.length})
                    </Text>
                    {guestAddRequests.map(r => (
                      <View
                        key={`guest-${r.proposedUserId}-${r.requestedBy}`}
                        style={themedStyles.requestRow}>
                        {r.proposedProfilePicUrl ? (
                          <Image
                            source={{uri: r.proposedProfilePicUrl}}
                            style={themedStyles.rsvpPersonAvatar}
                          />
                        ) : (
                          <View
                            style={[
                              themedStyles.rsvpPersonAvatar,
                              themedStyles.rsvpPersonAvatarFallback,
                            ]}>
                            <Text style={themedStyles.rsvpPersonAvatarText}>
                              {getInitials(r.proposedUsername)}
                            </Text>
                          </View>
                        )}
                        <View style={{flex: 1, minWidth: 0}}>
                          <Text
                            style={themedStyles.rsvpPersonName}
                            numberOfLines={1}>
                            {r.proposedUsername}
                          </Text>
                          <Text
                            style={{
                              fontSize: 11,
                              color: colors.secondaryText,
                            }}
                            numberOfLines={1}>
                            {t('roster.suggestedBy', {
                              name: r.requestedByUsername,
                            }) || `Suggested by ${r.requestedByUsername}`}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={themedStyles.requestApproveBtn}
                          onPress={() =>
                            handleApproveGuestAdd(r.proposedUserId)
                          }
                          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                          <FontAwesomeIcon
                            icon={faCheck}
                            size={14}
                            color="#fff"
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={themedStyles.requestDenyBtn}
                          onPress={() => handleDenyGuestAdd(r.proposedUserId)}
                          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                          <FontAwesomeIcon
                            icon={faTimes}
                            size={14}
                            color="#fff"
                          />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* RSVP responses beyond "going": who replied Maybe or Can't make
              it, plus invited people who haven't replied yet. Colored dots
              differentiate the states (amber = maybe, red = can't). */}
              {(() => {
                const maybeList = rsvps.filter(r => r.status === 'maybe');
                const cantList = rsvps.filter(r => r.status === 'cant');
                const noReplyList = invitedUserDetails.filter(
                  u =>
                    !roster.some(
                      p => p.userId === u._id || p.username === u.username,
                    ) && !rsvps.some(r => r.userId === u._id),
                );
                if (
                  maybeList.length === 0 &&
                  cantList.length === 0 &&
                  noReplyList.length === 0
                ) {
                  return null;
                }
                const renderPerson = (
                  key: string,
                  name: string,
                  profilePicUrl: string | undefined,
                  tint: string,
                  personUserId?: string,
                  showRemind?: boolean,
                  showRemoveInvite?: boolean,
                ) => {
                  const isMe = !!personUserId && personUserId === userData?._id;
                  const canOpen = !!personUserId && !isMe;
                  return (
                    <View key={key} style={themedStyles.rsvpPersonRow}>
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          flex: 1,
                        }}
                        onPress={() =>
                          canOpen &&
                          openProfile({
                            userId: personUserId,
                            username: name,
                            profilePicUrl,
                          })
                        }
                        disabled={!canOpen}
                        activeOpacity={canOpen ? 0.7 : 1}>
                        {profilePicUrl ? (
                          <Image
                            source={{uri: profilePicUrl}}
                            style={themedStyles.rsvpPersonAvatar}
                          />
                        ) : (
                          <View
                            style={[
                              themedStyles.rsvpPersonAvatar,
                              themedStyles.rsvpPersonAvatarFallback,
                            ]}>
                            <Text style={themedStyles.rsvpPersonAvatarText}>
                              {getInitials(name)}
                            </Text>
                          </View>
                        )}
                        <Text
                          style={[
                            themedStyles.rsvpPersonName,
                            canOpen && {color: colors.primary},
                          ]}
                          numberOfLines={1}>
                          {name}
                        </Text>
                        <View
                          style={[
                            themedStyles.rsvpDot,
                            {backgroundColor: tint},
                          ]}
                        />
                      </TouchableOpacity>
                      {canOpen ? (
                        <TouchableOpacity
                          style={themedStyles.rsvpRemindBtn}
                          onPress={() =>
                            messageUser({
                              userId: personUserId,
                              username: name,
                              profilePicUrl,
                            })
                          }
                          hitSlop={{top: 6, bottom: 6, left: 4, right: 4}}>
                          <FontAwesomeIcon
                            icon={faComment}
                            size={13}
                            color={colors.primary}
                          />
                        </TouchableOpacity>
                      ) : null}
                      {showRemind && personUserId && isEventCreator ? (
                        <TouchableOpacity
                          style={[
                            themedStyles.rsvpRemindBtn,
                            (pingingRsvpIds.has(personUserId) ||
                              pingingAllRsvp) &&
                              themedStyles.rsvpRemindBtnDisabled,
                          ]}
                          onPress={() => pingRsvp([personUserId])}
                          disabled={
                            pingingRsvpIds.has(personUserId) || pingingAllRsvp
                          }
                          hitSlop={{top: 6, bottom: 6, left: 4, right: 4}}>
                          {pingingRsvpIds.has(personUserId) ? (
                            <ActivityIndicator
                              size="small"
                              color={colors.primary}
                            />
                          ) : (
                            <FontAwesomeIcon
                              icon={faBell}
                              size={13}
                              color={colors.primary}
                            />
                          )}
                        </TouchableOpacity>
                      ) : null}
                      {showRemoveInvite && personUserId && isEventCreator ? (
                        <TouchableOpacity
                          style={themedStyles.rsvpRemindBtn}
                          onPress={() =>
                            showInviteeMoreMenu(personUserId, name)
                          }
                          hitSlop={{top: 6, bottom: 6, left: 4, right: 4}}
                          accessibilityLabel={
                            t('roster.moreActions') || 'More actions'
                          }>
                          <FontAwesomeIcon
                            icon={faEllipsisH}
                            size={13}
                            color={colors.secondaryText}
                          />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  );
                };
                return (
                  <View style={themedStyles.rsvpSectionWrap}>
                    {maybeList.length > 0 && (
                      <View style={themedStyles.rsvpResponseSection}>
                        <Text style={themedStyles.rsvpSectionTitle}>
                          {t('events.rsvpMaybe') || 'Maybe'} ({maybeList.length}
                          )
                        </Text>
                        {maybeList.map(r =>
                          renderPerson(
                            `maybe-${r.userId}`,
                            r.username,
                            r.profilePicUrl,
                            '#f1c40f',
                            r.userId,
                          ),
                        )}
                      </View>
                    )}
                    {cantList.length > 0 && (
                      <View style={themedStyles.rsvpResponseSection}>
                        <Text style={themedStyles.rsvpSectionTitle}>
                          {t('events.rsvpCant') || "Can't make it"} (
                          {cantList.length})
                        </Text>
                        {cantList.map(r =>
                          renderPerson(
                            `cant-${r.userId}`,
                            r.username,
                            r.profilePicUrl,
                            '#e74c3c',
                            r.userId,
                          ),
                        )}
                      </View>
                    )}
                    {noReplyList.length > 0 && (
                      <View style={themedStyles.rsvpResponseSection}>
                        <View style={themedStyles.rsvpSectionHeaderRow}>
                          <Text
                            style={[
                              themedStyles.rsvpSectionTitle,
                              {marginBottom: 0, flex: 1},
                            ]}>
                            {t('roster.noReply') || 'Invited · no reply'} (
                            {noReplyList.length})
                          </Text>
                          {isEventCreator ? (
                            <TouchableOpacity
                              style={[
                                themedStyles.rsvpRemindAllBtn,
                                pingingAllRsvp &&
                                  themedStyles.rsvpRemindBtnDisabled,
                              ]}
                              onPress={() => pingRsvp()}
                              disabled={
                                pingingAllRsvp || pingingRsvpIds.size > 0
                              }
                              activeOpacity={0.75}>
                              {pingingAllRsvp ? (
                                <ActivityIndicator
                                  size="small"
                                  color={colors.primary}
                                />
                              ) : (
                                <>
                                  <FontAwesomeIcon
                                    icon={faBell}
                                    size={11}
                                    color={colors.primary}
                                  />
                                  <Text style={themedStyles.rsvpRemindAllText}>
                                    {t('roster.remindAll') || 'Remind all'}
                                  </Text>
                                </>
                              )}
                            </TouchableOpacity>
                          ) : null}
                        </View>
                        {noReplyList.map(u =>
                          renderPerson(
                            `noreply-${u._id}`,
                            u.name || u.username,
                            u.profilePicUrl,
                            colors.secondaryText,
                            u._id,
                            true,
                            true,
                          ),
                        )}
                      </View>
                    )}
                  </View>
                );
              })()}
            </>
          ) : null}

          {/* Paid Status Modal */}
          <Modal
            visible={paidStatusModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setPaidStatusModalVisible(false)}>
            <View style={themedStyles.modalOverlay}>
              <View style={themedStyles.modalContent}>
                <Text style={themedStyles.modalTitle}>
                  {t('roster.paymentStatus')}
                </Text>
                {['Paid', 'Unpaid'].map(status => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      themedStyles.modalOption,
                      paidStatus === status && themedStyles.modalOptionSelected,
                    ]}
                    onPress={() => {
                      setPaidStatus(status);
                      setPaidStatusModalVisible(false);
                    }}>
                    <FontAwesomeIcon
                      icon={status === 'Paid' ? faCheck : faTimes}
                      size={16}
                      color={
                        status === 'Paid'
                          ? '#4CAF50'
                          : paidStatus === status
                          ? colors.primary
                          : colors.text
                      }
                    />
                    <Text
                      style={[
                        themedStyles.modalOptionTextWithMargin,
                        paidStatus === status &&
                          themedStyles.modalOptionTextSelected,
                      ]}>
                      {status}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={themedStyles.modalClose}
                  onPress={() => setPaidStatusModalVisible(false)}>
                  <Text style={themedStyles.modalCloseText}>
                    {t('common.close')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Jersey Color Modal */}
          <Modal
            visible={jerseyColorModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setJerseyColorModalVisible(false)}>
            <View style={themedStyles.modalOverlay}>
              <View style={themedStyles.modalContent}>
                <Text style={themedStyles.modalTitle}>
                  {t('roster.jerseyColor')}
                </Text>
                <ScrollView style={themedStyles.modalScrollView}>
                  {Object.keys(availableJerseyColors).map(color => (
                    <TouchableOpacity
                      key={color}
                      style={[
                        themedStyles.modalOption,
                        jerseyColor === color &&
                          themedStyles.modalOptionSelected,
                      ]}
                      onPress={() => {
                        setJerseyColor(color);
                        setJerseyColorModalVisible(false);
                      }}>
                      <View
                        style={[
                          themedStyles.colorSwatch,
                          {backgroundColor: availableJerseyColors[color]},
                        ]}
                      />
                      <Text
                        style={[
                          themedStyles.modalOptionText,
                          jerseyColor === color &&
                            themedStyles.modalOptionTextSelected,
                        ]}>
                        {color}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity
                  style={themedStyles.modalClose}
                  onPress={() => setJerseyColorModalVisible(false)}>
                  <Text style={themedStyles.modalCloseText}>
                    {t('common.close')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Position Modal */}
          <Modal
            visible={positionModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setPositionModalVisible(false)}>
            <View style={themedStyles.modalOverlay}>
              <View style={themedStyles.modalContent}>
                <Text style={themedStyles.modalTitle}>Select Position</Text>
                <ScrollView style={themedStyles.modalScrollView}>
                  {(positionOptions[eventType] || positionOptions.Default).map(
                    pos => (
                      <TouchableOpacity
                        key={pos}
                        style={[
                          themedStyles.modalOption,
                          position === pos && themedStyles.modalOptionSelected,
                        ]}
                        onPress={() => {
                          setPosition(pos);
                          setPositionModalVisible(false);
                        }}>
                        <FontAwesomeIcon
                          icon={faFutbol}
                          size={16}
                          color={
                            position === pos
                              ? colors.primary
                              : colors.placeholder
                          }
                        />
                        <Text
                          style={[
                            themedStyles.modalOptionTextWithMargin,
                            position === pos &&
                              themedStyles.modalOptionTextSelected,
                          ]}>
                          {pos}
                        </Text>
                      </TouchableOpacity>
                    ),
                  )}
                </ScrollView>
                <TouchableOpacity
                  style={themedStyles.modalClose}
                  onPress={() => setPositionModalVisible(false)}>
                  <Text style={themedStyles.modalCloseText}>
                    {t('common.close')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Edit Player Modal */}
          <Modal
            visible={editModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => {
              setEditModalVisible(false);
              setExpandedSection(null);
            }}>
            <View style={themedStyles.modalOverlay}>
              <View style={[themedStyles.modalContent, {maxHeight: '80%'}]}>
                <Text style={themedStyles.modalTitle}>
                  ✏️ {t('roster.editYourInfo')}
                </Text>

                <ScrollView
                  style={{flexGrow: 0}}
                  showsVerticalScrollIndicator={false}>
                  {/* Edit Paid Status - only when host opted into tracking */}
                  {isTeamSport(eventType) && trackPayment && (
                    <>
                      <TouchableOpacity
                        style={themedStyles.dropdown}
                        onPress={() =>
                          setExpandedSection(
                            expandedSection === 'paid' ? null : 'paid',
                          )
                        }>
                        <Text
                          style={
                            editPaidStatus
                              ? themedStyles.dropdownText
                              : themedStyles.placeholderText
                          }>
                          {editPaidStatus || t('roster.selectPaidStatus')}
                        </Text>
                        <FontAwesomeIcon
                          icon={
                            expandedSection === 'paid'
                              ? faChevronUp
                              : faChevronDown
                          }
                          size={14}
                          color={colors.placeholder}
                        />
                      </TouchableOpacity>
                      {expandedSection === 'paid' && (
                        <View style={themedStyles.expandedOptions}>
                          {['Paid', 'Unpaid'].map(status => (
                            <TouchableOpacity
                              key={status}
                              style={[
                                themedStyles.inlineOption,
                                editPaidStatus === status &&
                                  themedStyles.inlineOptionSelected,
                              ]}
                              onPress={() => {
                                setEditPaidStatus(status);
                                setExpandedSection(null);
                              }}>
                              <FontAwesomeIcon
                                icon={status === 'Paid' ? faCheck : faTimes}
                                size={16}
                                color={
                                  status === 'Paid'
                                    ? '#4CAF50'
                                    : editPaidStatus === status
                                    ? colors.primary
                                    : colors.text
                                }
                              />
                              <Text
                                style={[
                                  themedStyles.inlineOptionText,
                                  editPaidStatus === status &&
                                    themedStyles.inlineOptionTextSelected,
                                ]}>
                                {status}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </>
                  )}

                  {/* Edit Jersey Color - Sports only */}
                  {isTeamSport(eventType) && (
                    <>
                      <TouchableOpacity
                        style={themedStyles.dropdown}
                        onPress={() =>
                          setExpandedSection(
                            expandedSection === 'jersey' ? null : 'jersey',
                          )
                        }>
                        <View style={themedStyles.jerseyDropdownRow}>
                          {editJerseyColor && (
                            <View
                              style={[
                                themedStyles.jerseyIndicatorLarge,
                                {
                                  backgroundColor:
                                    jerseyColors[editJerseyColor] ||
                                    jerseyColors.Other,
                                },
                              ]}
                            />
                          )}
                          <Text
                            style={
                              editJerseyColor
                                ? themedStyles.dropdownText
                                : themedStyles.placeholderText
                            }>
                            {editJerseyColor || t('roster.selectJerseyColor')}
                          </Text>
                        </View>
                        <FontAwesomeIcon
                          icon={
                            expandedSection === 'jersey'
                              ? faChevronUp
                              : faChevronDown
                          }
                          size={14}
                          color={colors.placeholder}
                        />
                      </TouchableOpacity>
                      {expandedSection === 'jersey' && (
                        <View style={themedStyles.expandedOptions}>
                          {Object.keys(availableJerseyColors).map(color => (
                            <TouchableOpacity
                              key={color}
                              style={[
                                themedStyles.inlineOption,
                                editJerseyColor === color &&
                                  themedStyles.inlineOptionSelected,
                              ]}
                              onPress={() => {
                                setEditJerseyColor(color);
                                setExpandedSection(null);
                              }}>
                              <View
                                style={[
                                  themedStyles.colorSwatch,
                                  {
                                    backgroundColor:
                                      availableJerseyColors[color],
                                  },
                                ]}
                              />
                              <Text
                                style={[
                                  themedStyles.inlineOptionText,
                                  editJerseyColor === color &&
                                    themedStyles.inlineOptionTextSelected,
                                ]}>
                                {color}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </>
                  )}

                  {/* Edit Position */}
                  <TouchableOpacity
                    style={themedStyles.dropdown}
                    onPress={() =>
                      setExpandedSection(
                        expandedSection === 'position' ? null : 'position',
                      )
                    }>
                    <Text
                      style={
                        editPosition
                          ? themedStyles.dropdownText
                          : themedStyles.placeholderText
                      }>
                      {editPosition || t('roster.selectPosition')}
                    </Text>
                    <FontAwesomeIcon
                      icon={
                        expandedSection === 'position'
                          ? faChevronUp
                          : faChevronDown
                      }
                      size={14}
                      color={colors.placeholder}
                    />
                  </TouchableOpacity>
                  {expandedSection === 'position' && (
                    <View style={themedStyles.expandedOptions}>
                      {(
                        positionOptions[eventType] || positionOptions.Default
                      ).map(pos => (
                        <TouchableOpacity
                          key={pos}
                          style={[
                            themedStyles.inlineOption,
                            editPosition === pos &&
                              themedStyles.inlineOptionSelected,
                          ]}
                          onPress={() => {
                            setEditPosition(pos);
                            setExpandedSection(null);
                          }}>
                          <FontAwesomeIcon
                            icon={faFutbol}
                            size={16}
                            color={
                              editPosition === pos
                                ? colors.primary
                                : colors.placeholder
                            }
                          />
                          <Text
                            style={[
                              themedStyles.inlineOptionText,
                              editPosition === pos &&
                                themedStyles.inlineOptionTextSelected,
                            ]}>
                            {pos}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </ScrollView>

                {/* Save & Cancel Buttons */}
                <TouchableOpacity
                  style={themedStyles.modalSaveButton}
                  onPress={handleSaveEdit}>
                  <FontAwesomeIcon
                    icon={faCheck}
                    size={16}
                    color={colors.buttonText}
                  />
                  <Text style={themedStyles.modalSaveButtonText}>
                    {t('roster.saveChanges')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={themedStyles.modalClose}
                  onPress={() => {
                    setEditModalVisible(false);
                    setExpandedSection(null);
                  }}>
                  <Text style={themedStyles.modalCloseText}>
                    {t('common.cancel')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </ScrollView>
      </KeyboardAvoidingView>

      <EventRatingModal
        visible={ratingModalVisible}
        pending={
          canRateEvent || ratingModalVisible
            ? {
                eventId,
                eventName,
                hostId: eventCreatedBy,
                hostUsername: eventCreatedByUsername || null,
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
            const ratedId = playerModalTarget.userId;
            setRatedPlayerIds(prev => {
              const next = new Set(prev);
              next.add(ratedId);
              return next;
            });
            axios
              .post(`${API_BASE_URL}/users/player-ratings/summary`, {
                userIds: [ratedId],
              })
              .then(res => {
                setPlayerRatings(prev => ({
                  ...prev,
                  ...(res.data?.ratings || {}),
                }));
              })
              .catch(() => {});
          }
        }}
      />
    </SafeAreaView>
  );
};

export default EventRoster;
