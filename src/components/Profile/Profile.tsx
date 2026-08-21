import React, {
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  ActionSheetIOS,
  Animated,
  Pressable,
} from 'react-native';
import * as ImagePicker from 'react-native-image-picker';
import {ImagePickerResponse} from 'react-native-image-picker';
import UserContext, {UserContextType} from '../UserContext';
import {SafeAreaView} from 'react-native-safe-area-context';
import {
  useRoute,
  RouteProp,
  useNavigation,
  useFocusEffect,
} from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import HamburgerMenu from '../HamburgerMenu/HamburgerMenu';
import {useTheme} from '../ThemeContext/ThemeContext';
import {API_BASE_URL, IMAGE_UPLOAD_URL} from '../../config/api';
import analyticsService from '../../services/AnalyticsService';
import {useEventContext, Event} from '../../Context/EventContext';
import {
  getEventDateTime,
  isEventActive,
  isEventLive,
} from '../../utils/eventDateTime';

import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faCalendarCheck,
  faCalendarPlus,
  faCamera,
  faChevronRight,
  faGear,
  faRightFromBracket,
  faPlus,
  faUserPlus,
  faUserClock,
  faLocationDot,
  faUserGroup,
  faCalendarDays,
  faTimes,
  faPen,
} from '@fortawesome/free-solid-svg-icons';
import {useTranslation} from 'react-i18next';
import ProfileRatingBadges from '../EventRating/ProfileRatingBadges';
import EditProfileModal from './EditProfileModal';

// Types
type ProfileScreenRouteProp = RouteProp<
  {Profile: {_id: string; username: string; email: string}},
  'Profile'
>;

// Available interests/activities for the favorites section
const INTERESTS_OPTIONS = [
  // Sports
  {id: 'basketball', emoji: '🏀', label: 'Basketball'},
  {id: 'hockey', emoji: '🏒', label: 'Hockey'},
  {id: 'soccer', emoji: '⚽', label: 'Soccer'},
  {id: 'football', emoji: '🏈', label: 'Football'},
  {id: 'baseball', emoji: '⚾', label: 'Baseball'},
  {id: 'tennis', emoji: '🎾', label: 'Tennis'},
  {id: 'golf', emoji: '⛳', label: 'Golf'},
  {id: 'volleyball', emoji: '🏐', label: 'Volleyball'},
  // Social & Entertainment
  {id: 'trivia', emoji: '🧠', label: 'Trivia'},
  {id: 'game-nights', emoji: '🎲', label: 'Game Nights'},
  {id: 'karaoke', emoji: '🎤', label: 'Karaoke'},
  {id: 'live-music', emoji: '🎵', label: 'Live Music'},
  {id: 'brewery', emoji: '🍻', label: 'Brewery'},
  {id: 'wine', emoji: '🍷', label: 'Wine'},
  {id: 'coffee', emoji: '☕', label: 'Coffee'},
  {id: 'sports-bar', emoji: '📺', label: 'Sports Bar'},
  // Outdoor & Fitness
  {id: 'hiking', emoji: '🥾', label: 'Hiking'},
  {id: 'cycling', emoji: '🚴', label: 'Cycling'},
  {id: 'running', emoji: '🏃', label: 'Running'},
  {id: 'yoga', emoji: '🧘', label: 'Yoga'},
  {id: 'swimming', emoji: '🏊', label: 'Swimming'},
  // Indoor Games
  {id: 'bowling', emoji: '🎳', label: 'Bowling'},
  {id: 'arcade', emoji: '🕹️', label: 'Arcade'},
  {id: 'gaming', emoji: '🎮', label: 'Gaming'},
  {id: 'dance', emoji: '💃', label: 'Dance'},
  // Community
  {id: 'book-club', emoji: '📚', label: 'Book Club'},
  {id: 'volunteering', emoji: '💚', label: 'Volunteering'},
  {id: 'cooking', emoji: '🍲', label: 'Cooking'},
  {id: 'workshops', emoji: '🛠️', label: 'Workshops'},
];

const Profile: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [favoriteSports, setFavoriteSports] = useState<string[]>([]);
  const [showInterestsPicker, setShowInterestsPicker] = useState(false);
  const [friendsCount, setFriendsCount] = useState<number>(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);
  const [signOutModalVisible, setSignOutModalVisible] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [photoPreviewVisible, setPhotoPreviewVisible] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const avatarScale = useRef(new Animated.Value(0.92)).current;
  const avatarOpacity = useRef(new Animated.Value(0)).current;

  const route = useRoute<ProfileScreenRouteProp>();
  const navigation = useNavigation<any>();
  const {_id} = route.params;

  const {userData, setUserData} = useContext(UserContext) as UserContextType;
  const {colors} = useTheme();
  const {events, fetchEvents} = useEventContext();

  const {t} = useTranslation();

  // Load favorite sports from backend on mount
  useEffect(() => {
    const loadFavoriteSports = async () => {
      if (!_id) {
        return;
      }
      try {
        const token = await AsyncStorage.getItem('userToken');
        const response = await fetch(
          `${API_BASE_URL}/user/${_id}/favorite-sports`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        if (response.ok) {
          const data = await response.json();
          setFavoriteSports(data.favoriteSports || ['hockey']);
        } else {
          setFavoriteSports(['hockey']);
        }
      } catch (error) {
        console.error('Error loading favorite sports:', error);
        setFavoriteSports(['hockey']);
      }
    };
    loadFavoriteSports();
  }, [_id]);

  // Jump to the Groups tab. Groups used to render as a full section
  // here; it now has its own tab, so Profile keeps just a shortcut row.
  const goToGroups = useCallback(() => {
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate('Groups');
    } else {
      navigation.navigate('Groups');
    }
  }, [navigation]);

  // Fetch friends count and pending requests count
  const loadSocialCounts = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      // Fetch friends
      const friendsRes = await fetch(`${API_BASE_URL}/users/me/friends`, {
        headers: {Authorization: `Bearer ${token}`},
      });
      if (friendsRes.ok) {
        const friendsData = await friendsRes.json();
        const list = Array.isArray(friendsData)
          ? friendsData
          : friendsData.friends || [];
        setFriendsCount(list.length);
      }
      // Fetch pending incoming requests
      const reqRes = await fetch(
        `${API_BASE_URL}/users/me/friend-requests/incoming`,
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );
      if (reqRes.ok) {
        const reqData = await reqRes.json();
        const reqList = Array.isArray(reqData)
          ? reqData
          : reqData.requests || [];
        setPendingRequestsCount(reqList.length);
      }
    } catch (error) {
      console.error('Error loading social counts:', error);
    }
  }, []);

  useEffect(() => {
    loadSocialCounts();
  }, [loadSocialCounts]);

  // Save favorite sports to backend when they change
  const saveFavoriteSports = useCallback(
    async (sports: string[]) => {
      if (!_id) {
        return;
      }
      try {
        const token = await AsyncStorage.getItem('userToken');
        await fetch(`${API_BASE_URL}/user/${_id}/favorite-sports`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({favoriteSports: sports}),
        });
      } catch (error) {
        console.error('Error saving favorite sports:', error);
      }
    },
    [_id],
  );

  const [hostRatingAverage, setHostRatingAverage] = useState<number | null>(
    null,
  );
  const [hostRatingCount, setHostRatingCount] = useState(0);
  const [playerRatingAverage, setPlayerRatingAverage] = useState<number | null>(
    null,
  );
  const [playerRatingCount, setPlayerRatingCount] = useState(0);
  const [createdCount, setCreatedCount] = useState<number | null>(null);
  const [joinedCount, setJoinedCount] = useState<number | null>(null);

  // Calculate user stats. Prefer the server counts (all events, unique series)
  // over the privacy-scoped events feed, which undercounts.
  const userStats = useMemo(() => {
    const eventsCreated =
      createdCount != null
        ? createdCount
        : events.filter(e => String(e.createdBy) === String(_id)).length;
    const eventsJoined =
      joinedCount != null
        ? joinedCount
        : events.filter(e => {
            const roster = (e as any).roster || (e as any).participants || [];
            return roster.some(
              (r: any) =>
                String(r.userId) === String(_id) || String(r._id) === String(_id),
            );
          }).length;
    return {eventsCreated, eventsJoined};
  }, [events, _id, createdCount, joinedCount]);

  const fetchEventStats = useCallback(async () => {
    if (!_id) {
      return;
    }
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await axios.get(
        `${API_BASE_URL}/user/${_id}/events/stats`,
        {headers: token ? {Authorization: `Bearer ${token}`} : {}},
      );
      setHostRatingAverage(
        typeof response.data?.hostRatingAverage === 'number'
          ? response.data.hostRatingAverage
          : null,
      );
      setHostRatingCount(response.data?.hostRatingCount || 0);
      setPlayerRatingAverage(
        typeof response.data?.playerRatingAverage === 'number'
          ? response.data.playerRatingAverage
          : null,
      );
      setPlayerRatingCount(response.data?.playerRatingCount || 0);
      if (typeof response.data?.created === 'number') {
        setCreatedCount(response.data.created);
      }
      if (typeof response.data?.joined === 'number') {
        setJoinedCount(response.data.joined);
      }
    } catch {
      // Stats enrichment is best-effort
    }
  }, [_id]);

  useEffect(() => {
    fetchEventStats();
  }, [fetchEventStats]);

  const memberSinceYear = useMemo(() => {
    if (userData && 'createdAt' in userData && userData.createdAt) {
      return new Date(userData.createdAt as string).getFullYear();
    }
    return new Date().getFullYear();
  }, [userData]);

  // Events live in a sibling tab's stack, so jumping to one has to address the
  // tab first — a bare navigate() looks only in this stack and silently does
  // nothing. Name and type are passed so the roster header renders immediately
  // instead of blank until the fetch lands.
  const openEvent = useCallback(
    (event: Event) => {
      navigation.navigate('Events', {
        screen: 'EventRoster',
        params: {
          eventId: event._id,
          eventName: event.name,
          eventType: event.eventType,
        },
      });
    },
    [navigation],
  );

  // Upcoming events this user is involved in (created or on roster), soonest
  // first. Shown as a short list on Profile; "See All" opens the Events tab
  // filtered to the same set.
  const upcomingEvents = useMemo(() => {
    return events
      .filter(e => {
        const isCreator = e.createdBy === _id;
        const roster = (e as any).roster || (e as any).participants || [];
        const isInRoster = roster.some(
          (r: any) => r.userId === _id || r._id === _id,
        );
        return isCreator || isInRoster;
      })
      .map(e => ({event: e, when: getEventDateTime(e.date, e.time)}))
      .filter(
        ({event, when}) =>
          when != null &&
          isEventActive(event.date, event.time, event.durationMinutes),
      )
      .sort((a, b) => a.when!.getTime() - b.when!.getTime())
      .map(({event}) => event);
  }, [events, _id]);

  const previewUpcomingEvents = upcomingEvents.slice(0, 3);

  // Format upcoming event date nicely. Compare calendar days rather than
  // subtracting timestamps: an event 20 hours out can still be "Tomorrow".
  const formatEventDate = (event: Event) => {
    const date = getEventDateTime(event.date, event.time);
    if (!date) {
      return event.date;
    }
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfEventDay = new Date(date);
    startOfEventDay.setHours(0, 0, 0, 0);
    const diffDays = Math.round(
      (startOfEventDay.getTime() - startOfToday.getTime()) /
        (1000 * 60 * 60 * 24),
    );
    if (diffDays <= 0) {
      return t('profile.today') || 'Today';
    }
    if (diffDays === 1) {
      return t('profile.tomorrow') || 'Tomorrow';
    }
    if (diffDays < 7) {
      return date.toLocaleDateString(undefined, {weekday: 'long'});
    }
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatEventTime = (event: Event) => {
    const date = getEventDateTime(event.date, event.time);
    if (!date) {
      return event.time;
    }
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
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
          paddingHorizontal: 16,
          paddingTop: 4,
          paddingBottom: 4,
          backgroundColor: colors.background,
          zIndex: 1,
        },
        // ── Profile Header (compact) ──
        profileSection: {
          alignItems: 'center',
          paddingTop: 12,
          paddingBottom: 14,
          paddingHorizontal: 16,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        avatarContainer: {
          position: 'relative',
          marginBottom: 8,
          alignItems: 'center',
          justifyContent: 'center',
        },
        avatarGlow: {
          position: 'absolute',
          width: 128,
          height: 128,
          borderRadius: 64,
          backgroundColor: colors.primary + '22',
        },
        avatarRing: {
          padding: 4,
          borderRadius: 64,
          borderWidth: 2,
          borderColor: colors.primary + '55',
        },
        avatar: {
          width: 112,
          height: 112,
          borderRadius: 56,
          borderWidth: 3,
          borderColor: colors.primary,
        },
        avatarPlaceholder: {
          width: 112,
          height: 112,
          borderRadius: 56,
          backgroundColor: colors.primary + '14',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 3,
          borderColor: colors.primary,
        },
        avatarInitials: {
          fontSize: 36,
          fontWeight: '700',
          color: colors.primary,
        },
        avatarEditBadge: {
          position: 'absolute',
          bottom: 4,
          right: 4,
          backgroundColor: colors.primary,
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: colors.background,
        },
        avatarUploadingOverlay: {
          ...StyleSheet.absoluteFillObject,
          borderRadius: 56,
          backgroundColor: 'rgba(0,0,0,0.45)',
          alignItems: 'center',
          justifyContent: 'center',
        },
        photoPreviewBackdrop: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.92)',
          justifyContent: 'center',
          alignItems: 'center',
        },
        photoPreviewImage: {
          width: '92%',
          aspectRatio: 1,
          borderRadius: 16,
        },
        photoPreviewClose: {
          position: 'absolute',
          top: 56,
          right: 20,
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: 'rgba(255,255,255,0.15)',
          alignItems: 'center',
          justifyContent: 'center',
        },
        userName: {
          fontSize: 22,
          fontWeight: '700',
          color: colors.text,
          marginBottom: 2,
        },
        userHandle: {
          fontSize: 14,
          fontWeight: '500',
          color: colors.secondaryText,
          marginBottom: 6,
        },
        nameRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 2,
        },
        editProfileChip: {
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 8,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        emailText: {
          fontSize: 13,
          color: colors.secondaryText,
          marginBottom: 0,
          textAlign: 'center',
        },
        emailToggle: {
          marginTop: 2,
          paddingVertical: 4,
          paddingHorizontal: 8,
        },
        emailToggleText: {
          fontSize: 12,
          fontWeight: '600',
          color: colors.secondaryText,
          textAlign: 'center',
        },
        // ── Section (flat block) ──
        section: {
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 14,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        sectionHeaderRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        },
        sectionLabel: {
          fontSize: 12,
          fontWeight: '700',
          color: colors.secondaryText,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        },
        sectionAction: {
          fontSize: 13,
          color: colors.primary,
          fontWeight: '700',
        },
        // ── Stats grid (2x2 flat) ──
        statsGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
        },
        statCell: {
          width: '50%',
          paddingVertical: 12,
          alignItems: 'center',
          justifyContent: 'center',
        },
        statCellValue: {
          fontSize: 22,
          fontWeight: '800',
          color: colors.text,
        },
        statCellLabel: {
          fontSize: 12,
          color: colors.secondaryText,
          fontWeight: '500',
          marginTop: 2,
        },
        statCellIconRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginBottom: 4,
        },
        // ── Upcoming Event row ──
        upcomingEventCard: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 10,
        },
        upcomingList: {
          gap: 2,
        },
        upcomingMoreText: {
          fontSize: 12,
          color: colors.secondaryText,
          marginTop: 6,
          paddingLeft: 2,
        },
        upcomingDateBadge: {
          backgroundColor: colors.primary + '14',
          borderRadius: 10,
          paddingVertical: 8,
          paddingHorizontal: 10,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
          minWidth: 64,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.primary + '40',
        },
        upcomingDateDay: {
          fontSize: 13,
          fontWeight: '700',
          color: colors.primary,
        },
        upcomingDateTime: {
          fontSize: 11,
          color: colors.primary,
          marginTop: 2,
          fontWeight: '500',
        },
        upcomingEventInfo: {
          flex: 1,
          minWidth: 0,
          justifyContent: 'center',
        },
        upcomingEventName: {
          fontSize: 15,
          fontWeight: '700',
          color: colors.text,
          marginBottom: 3,
        },
        upcomingEventMeta: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        upcomingEventMetaIcon: {
          width: 14,
          alignItems: 'center',
          marginRight: 5,
        },
        upcomingEventMetaText: {
          fontSize: 13,
          color: colors.secondaryText,
          flex: 1,
          flexShrink: 1,
        },
        upcomingChevron: {
          marginLeft: 8,
          justifyContent: 'center',
          alignItems: 'center',
        },
        liveBadge: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        liveDot: {
          width: 7,
          height: 7,
          borderRadius: 4,
          backgroundColor: '#4CAF50',
          marginRight: 5,
        },
        liveBadgeText: {
          fontSize: 12,
          fontWeight: '700',
          color: '#4CAF50',
        },
        upcomingEmptyText: {
          fontSize: 14,
          color: colors.secondaryText,
          textAlign: 'center',
          paddingVertical: 8,
        },
        upcomingEmptyCta: {
          fontSize: 14,
          color: colors.primary,
          fontWeight: '700',
          textAlign: 'center',
          marginTop: 6,
        },
        // ── Social ──
        socialQuickActions: {
          gap: 10,
        },
        socialActionCard: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 14,
          paddingHorizontal: 14,
          borderRadius: 16,
          backgroundColor: colors.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        socialActionCardPending: {
          borderColor: colors.primary + '55',
          backgroundColor: colors.primary + '10',
        },
        socialActionIcon: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary + '18',
          marginRight: 12,
        },
        socialActionCopy: {
          flex: 1,
          minWidth: 0,
        },
        socialActionText: {
          fontSize: 16,
          fontWeight: '700',
          color: colors.text,
        },
        socialActionHint: {
          marginTop: 2,
          fontSize: 12,
          fontWeight: '600',
          color: colors.secondaryText,
        },
        socialActionTrail: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginLeft: 8,
        },
        socialActionBadge: {
          backgroundColor: '#FF3B30',
          minWidth: 22,
          height: 22,
          borderRadius: 11,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 7,
        },
        socialActionBadgeText: {
          fontSize: 12,
          fontWeight: '800',
          color: '#fff',
        },
        // ── Interests chips ──
        sportsContainer: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        },
        sportTag: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.primary + '12',
          paddingVertical: 6,
          paddingHorizontal: 12,
          borderRadius: 16,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.primary + '40',
        },
        sportEmoji: {
          fontSize: 14,
        },
        sportTagText: {
          fontSize: 13,
          marginLeft: 6,
          color: colors.text,
          fontWeight: '600',
        },
        addSportButton: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'transparent',
          paddingVertical: 6,
          paddingHorizontal: 12,
          borderRadius: 16,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          borderStyle: 'dashed',
        },
        addSportText: {
          fontSize: 13,
          marginLeft: 6,
          color: colors.secondaryText,
          fontWeight: '600',
        },
        // ── Account / Footer (flat list rows) ──
        accountSection: {
          paddingTop: 16,
        },
        accountSectionLabel: {
          fontSize: 12,
          fontWeight: '700',
          color: colors.secondaryText,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          paddingHorizontal: 16,
          paddingBottom: 10,
        },
        menuRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        menuRowLast: {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        menuIcon: {
          width: 32,
          height: 32,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        },
        menuContent: {
          flex: 1,
        },
        menuTitle: {
          fontSize: 15,
          fontWeight: '600',
          color: colors.text,
        },
        menuSubtitle: {
          fontSize: 13,
          color: colors.secondaryText,
          marginTop: 2,
        },
        menuChevron: {
          marginLeft: 8,
        },
        menuValue: {
          fontSize: 13,
          color: colors.secondaryText,
          marginRight: 8,
        },
        signOutText: {
          color: '#DC3545',
          fontWeight: '700',
        },
        // ── Interests Picker Modal (bottom-sheet pattern) ──
        sportsPickerOverlay: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 16,
        },
        sportsPickerCard: {
          width: '100%',
          backgroundColor: colors.card,
          borderRadius: 18,
          paddingTop: 8,
          paddingBottom: 16,
          maxHeight: '80%',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        sportsPickerHandle: {
          alignSelf: 'center',
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
          marginBottom: 6,
        },
        sportsPickerTitle: {
          fontSize: 17,
          fontWeight: '700',
          color: colors.text,
          paddingHorizontal: 20,
          paddingBottom: 12,
          textAlign: 'center',
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        sportsPickerBody: {
          paddingHorizontal: 16,
          paddingTop: 16,
        },
        sportsPickerGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        },
        sportPickerItem: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'transparent',
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 16,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        sportPickerItemSelected: {
          borderColor: colors.primary,
          backgroundColor: colors.primary + '12',
        },
        sportPickerEmoji: {
          fontSize: 16,
          marginRight: 6,
        },
        sportPickerLabel: {
          fontSize: 13,
          color: colors.text,
          fontWeight: '600',
        },
        sportPickerLabelSelected: {
          color: colors.primary,
          fontWeight: '700',
        },
        sportsPickerDone: {
          backgroundColor: colors.primary,
          paddingVertical: 12,
          borderRadius: 24,
          marginTop: 16,
          marginHorizontal: 20,
          alignItems: 'center',
        },
        sportsPickerDoneText: {
          color: colors.buttonText || '#fff',
          fontSize: 14,
          fontWeight: '700',
        },
        // ── Sign Out Confirmation Modal (bottom-sheet pattern) ──
        signOutModalOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end',
        },
        signOutModalContent: {
          backgroundColor: colors.background,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 32 : 20,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        signOutHandle: {
          alignSelf: 'center',
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
          marginBottom: 8,
        },
        signOutHeader: {
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 16,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        signOutIconContainer: {
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: '#DC3545' + '15',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: '#DC3545' + '40',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        },
        signOutTitle: {
          fontSize: 17,
          fontWeight: '700',
          color: colors.text,
          textAlign: 'center',
        },
        signOutBody: {
          paddingHorizontal: 20,
          paddingTop: 16,
        },
        signOutDescription: {
          fontSize: 14,
          color: colors.secondaryText,
          textAlign: 'center',
          lineHeight: 20,
          marginBottom: 20,
        },
        signOutButtons: {
          flexDirection: 'row',
          gap: 10,
        },
        signOutCancelButton: {
          flex: 1,
          borderRadius: 24,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          paddingVertical: 12,
          alignItems: 'center',
          backgroundColor: 'transparent',
        },
        signOutCancelText: {
          color: colors.secondaryText,
          fontSize: 14,
          fontWeight: '700',
        },
        signOutConfirmButton: {
          flex: 1,
          borderRadius: 24,
          backgroundColor: '#DC3545',
          paddingVertical: 12,
          alignItems: 'center',
          justifyContent: 'center',
        },
        signOutConfirmText: {
          color: '#FFFFFF',
          fontSize: 14,
          fontWeight: '700',
        },
      }),
    [colors],
  );

  const fetchUserData = useCallback(async () => {
    if (!_id) {
      console.log('Invalid user ID');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch(`${API_BASE_URL}/user/${_id}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
      });
      const text = await response.text();
      if (!response.ok) {
        console.error(`Fetch failed with status ${response.status}:`, text);
        throw new Error(`Fetch failed with status ${response.status}`);
      }
      let data;
      try {
        data = JSON.parse(text);
      } catch (jsonError) {
        console.error('Failed to parse JSON. Response text:', text);
        throw jsonError;
      }

      if (data.user) {
        setUserData(data.user);
        setSelectedImage(data.user.profilePicUrl);
      } else {
        console.log('User not found');
      }
    } catch (error) {
      console.error('Error during fetch:', error);
    }
  }, [_id, setUserData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Stats and "Up Next" are derived from the shared events list, so it has to
    // be refreshed too or a pull-to-refresh reports the same stale counts.
    await Promise.all([fetchUserData(), fetchEvents(), loadSocialCounts(), fetchEventStats()]);
    setRefreshing(false);
  }, [fetchUserData, fetchEvents, loadSocialCounts, fetchEventStats]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  // Refresh the events list whenever this screen comes into focus. The provider
  // only fetches once on mount — which happens before login, so without this
  // the counts and "Up Next" would stay empty for the whole session and would
  // never pick up events created or deleted elsewhere in the app.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchEvents();
      loadSocialCounts();
      fetchEventStats();
    });
    return unsubscribe;
  }, [navigation, fetchEvents, loadSocialCounts, fetchEventStats]);

  const handleChoosePhoto = () => {
    const options: ImagePicker.ImageLibraryOptions = {
      mediaType: 'photo',
      includeBase64: true,
      maxWidth: 800,
      maxHeight: 800,
      quality: 0.7,
    };

    ImagePicker.launchImageLibrary(options, (response: ImagePickerResponse) => {
      if (response.assets) {
        const firstAsset = response.assets[0];
        if (firstAsset && firstAsset.base64) {
          uploadImageToLambda(
            firstAsset.base64,
            firstAsset.fileName || 'photo.jpg',
          );
        }
      }
    });
  };

  const handleTakePhoto = () => {
    const options: ImagePicker.CameraOptions = {
      mediaType: 'photo',
      includeBase64: true,
      maxWidth: 800,
      maxHeight: 800,
      quality: 0.7,
    };

    ImagePicker.launchCamera(options, (response: ImagePickerResponse) => {
      if (response.assets) {
        const firstAsset = response.assets[0];
        if (firstAsset && firstAsset.base64) {
          uploadImageToLambda(
            firstAsset.base64,
            firstAsset.fileName || 'photo.jpg',
          );
        }
      }
    });
  };

  const openPhotoPreview = () => {
    if (selectedImage) {
      setPhotoPreviewVisible(true);
    }
  };

  const openAvatarMenu = () => {
    if (uploadingImage) {
      return;
    }

    const viewLabel = selectedImage
      ? t('profile.viewPhoto', {defaultValue: 'View photo'})
      : null;
    const galleryLabel = t('profile.chooseFromLibrary', {
      defaultValue: 'Choose from Library',
    });
    const cameraLabel = t('profile.takePhoto', {defaultValue: 'Take Photo'});
    const cancelLabel = t('common.cancel', {defaultValue: 'Cancel'});
    const title = t('profile.profilePhoto', {defaultValue: 'Profile photo'});

    if (Platform.OS === 'ios') {
      const options = [
        ...(viewLabel ? [viewLabel] : []),
        galleryLabel,
        cameraLabel,
        cancelLabel,
      ];
      const cancelButtonIndex = options.length - 1;
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          title,
        },
        buttonIndex => {
          const label = options[buttonIndex];
          if (label === viewLabel) {
            openPhotoPreview();
          } else if (label === galleryLabel) {
            handleChoosePhoto();
          } else if (label === cameraLabel) {
            handleTakePhoto();
          }
        },
      );
      return;
    }

    const buttons: {
      text: string;
      onPress?: () => void;
      style?: 'cancel' | 'default' | 'destructive';
    }[] = [];
    if (viewLabel) {
      buttons.push({text: viewLabel, onPress: openPhotoPreview});
    }
    buttons.push(
      {text: galleryLabel, onPress: handleChoosePhoto},
      {text: cameraLabel, onPress: handleTakePhoto},
      {text: cancelLabel, style: 'cancel'},
    );
    Alert.alert(title, undefined, buttons);
  };

  useFocusEffect(
    useCallback(() => {
      avatarScale.setValue(0.92);
      avatarOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(avatarScale, {
          toValue: 1,
          friction: 7,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(avatarOpacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    }, [avatarOpacity, avatarScale]),
  );

  const uploadImageToLambda = async (
    base64Image: string,
    fileName: string | undefined,
  ) => {
    setUploadingImage(true);
    try {
      const lambdaResponse = await axios.post(IMAGE_UPLOAD_URL, {
        image: base64Image,
        fileName: fileName,
      });

      const imageUrl = lambdaResponse.data.url;
      setSelectedImage(imageUrl);
      await updateUserProfilePic(imageUrl);
      analyticsService.trackUpdateProfilePhoto().catch(() => {});
    } catch (error: any) {
      console.error('Error uploading image to Lambda:', error);
      if (error?.response?.status === 413) {
        Alert.alert(
          t('profile.imageTooLarge'),
          t('profile.imageTooLargeMessage'),
        );
      } else {
        Alert.alert(
          t('profile.uploadFailed'),
          t('profile.uploadFailedMessage'),
        );
      }
    } finally {
      setUploadingImage(false);
    }
  };

  const updateUserProfilePic = async (imageUrl: string) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      await axios.put(
        `${API_BASE_URL}/user/profile-pic`,
        {
          userId: _id,
          profilePicUrl: imageUrl,
        },
        {
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json',
          },
        },
      );
      if (!userData) {
        return;
      }
      const updatedUserData = {
        ...userData,
        profilePicUrl: imageUrl,
      };
      setUserData(updatedUserData);
      AsyncStorage.setItem('@profilePicUrl', imageUrl).catch(error => {
        console.error(
          'Error saving profile picture URL to AsyncStorage: ',
          error,
        );
      });
    } catch (error) {
      console.error('Error updating user data: ', error);
    }
  };

  const handleSignOut = () => {
    setSignOutModalVisible(true);
  };

  const confirmSignOut = async () => {
    if (isSigningOut) {
      return;
    }
    setIsSigningOut(true);
    try {
      try {
        const notifService = require('../../services/NotificationService').default;
        await notifService.unregisterDevice();
      } catch {}
      await AsyncStorage.multiRemove([
        'userToken',
        'cachedUserData',
        'cachedEvents',
        '@profilePicUrl',
        '@app_language',
        'locationEnabled',
        'proximityVisibility',
        'cachedUserLocation',
        'cachedUserLocationTimestamp',
      ]);
      setUserData(null);
      setSignOutModalVisible(false);
      navigation.reset({
        index: 0,
        routes: [{name: 'LandingPage'}],
      });
    } finally {
      setIsSigningOut(false);
    }
  };

  const toggleSport = (sportId: string) => {
    setFavoriteSports(prev => {
      const newSports = prev.includes(sportId)
        ? prev.filter(s => s !== sportId)
        : [...prev, sportId];
      saveFavoriteSports(newSports);
      return newSports;
    });
  };

  const getFavoriteSportsDisplay = () => {
    return INTERESTS_OPTIONS.filter(s => favoriteSports.includes(s.id));
  };

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

  return (
    <SafeAreaView style={themedStyles.safeArea} edges={['top']}>
      {/* Compact top bar — tab label lives in the bottom nav */}
      <View style={themedStyles.header}>
        <HamburgerMenu />
      </View>

      <ScrollView
        style={themedStyles.container}
        contentContainerStyle={themedStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }>
        {/* ── Profile Header (compact) ── */}
        <View style={themedStyles.profileSection}>
          <Animated.View
            style={[
              themedStyles.avatarContainer,
              {
                opacity: avatarOpacity,
                transform: [{scale: avatarScale}],
              },
            ]}>
            <View style={themedStyles.avatarGlow} pointerEvents="none" />
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={openAvatarMenu}
              accessibilityRole="button"
              accessibilityLabel="Profile photo">
              <View style={themedStyles.avatarRing}>
                {selectedImage ? (
                  <Image
                    source={{uri: selectedImage}}
                    style={themedStyles.avatar}
                  />
                ) : (
                  <View style={themedStyles.avatarPlaceholder}>
                    <Text style={themedStyles.avatarInitials}>
                      {getInitials(userData?.username)}
                    </Text>
                  </View>
                )}
                {uploadingImage && (
                  <View style={themedStyles.avatarUploadingOverlay}>
                    <ActivityIndicator color="#fff" />
                  </View>
                )}
              </View>
              <View style={themedStyles.avatarEditBadge}>
                <FontAwesomeIcon icon={faCamera} size={13} color="#fff" />
              </View>
            </TouchableOpacity>
          </Animated.View>

          <View style={themedStyles.nameRow}>
            <Text style={themedStyles.userName}>
              {userData?.name?.trim() || userData?.username}
            </Text>
            <TouchableOpacity
              style={themedStyles.editProfileChip}
              onPress={() => setEditProfileVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={t('profile.editProfile')}>
              <FontAwesomeIcon icon={faPen} size={12} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {!!userData?.name?.trim() && (
            <Text style={themedStyles.userHandle}>@{userData.username}</Text>
          )}

          <ProfileRatingBadges
            userId={_id}
            username={userData?.username}
            hostAverage={hostRatingAverage}
            hostCount={hostRatingCount}
            playerAverage={playerRatingAverage}
            playerCount={playerRatingCount}
          />

          {userData?.email ? (
            showEmail ? (
              <TouchableOpacity
                onPress={() => setShowEmail(false)}
                accessibilityRole="button"
                accessibilityLabel="Hide email"
                hitSlop={8}>
                <Text style={themedStyles.emailText}>{userData.email}</Text>
                <Text style={themedStyles.emailToggleText}>Hide email</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={themedStyles.emailToggle}
                onPress={() => setShowEmail(true)}
                accessibilityRole="button"
                accessibilityLabel="Show email"
                hitSlop={8}>
                <Text style={themedStyles.emailToggleText}>Show email</Text>
              </TouchableOpacity>
            )
          ) : null}
        </View>

        {/* ── Your Activity (2x2 stats) ── */}
        <View style={themedStyles.section}>
          <View style={themedStyles.sectionHeaderRow}>
            <Text style={themedStyles.sectionLabel}>
              {t('profile.yourActivity') || 'Your Activity'}
            </Text>
          </View>
          <View style={themedStyles.statsGrid}>
            <TouchableOpacity
              style={themedStyles.statCell}
              onPress={() =>
                navigation.navigate('Events', {
                  screen: 'EventList',
                  params: {profileFilter: 'created', userId: _id},
                })
              }>
              <View style={themedStyles.statCellIconRow}>
                <FontAwesomeIcon
                  icon={faCalendarPlus}
                  size={14}
                  color={colors.primary}
                />
                <Text style={themedStyles.statCellValue}>
                  {userStats.eventsCreated}
                </Text>
              </View>
              <Text style={themedStyles.statCellLabel}>
                {t('profile.created') || 'Created'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={themedStyles.statCell}
              onPress={() =>
                navigation.navigate('Events', {
                  screen: 'EventList',
                  params: {profileFilter: 'joined', userId: _id},
                })
              }>
              <View style={themedStyles.statCellIconRow}>
                <FontAwesomeIcon
                  icon={faCalendarCheck}
                  size={14}
                  color="#4CAF50"
                />
                <Text style={themedStyles.statCellValue}>
                  {userStats.eventsJoined}
                </Text>
              </View>
              <Text style={themedStyles.statCellLabel}>
                {t('profile.joined') || 'Joined'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={themedStyles.statCell}
              onPress={() => navigation.navigate('FriendsList')}>
              <View style={themedStyles.statCellIconRow}>
                <FontAwesomeIcon
                  icon={faUserGroup}
                  size={14}
                  color="#2196F3"
                />
                <Text style={themedStyles.statCellValue}>{friendsCount}</Text>
              </View>
              <Text style={themedStyles.statCellLabel}>
                {t('profile.friends') || 'Friends'}
              </Text>
            </TouchableOpacity>

            <View style={themedStyles.statCell}>
              <View style={themedStyles.statCellIconRow}>
                <FontAwesomeIcon
                  icon={faCalendarDays}
                  size={14}
                  color="#9C27B0"
                />
                <Text style={themedStyles.statCellValue}>
                  {memberSinceYear}
                </Text>
              </View>
              <Text style={themedStyles.statCellLabel}>
                {t('profile.memberSince') || 'Member since'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Upcoming ── */}
        <View style={themedStyles.section}>
          <View style={themedStyles.sectionHeaderRow}>
            <Text style={themedStyles.sectionLabel}>
              {t('profile.upcoming') || 'Upcoming'}
            </Text>
            {upcomingEvents.length > 0 && (
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('Events', {
                    screen: 'EventList',
                    params: {profileFilter: 'upcoming', userId: _id},
                  })
                }>
                <Text style={themedStyles.sectionAction}>
                  {t('profile.seeAll') || 'See All'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {previewUpcomingEvents.length > 0 ? (
            <View style={themedStyles.upcomingList}>
              {previewUpcomingEvents.map(event => {
                const live = isEventLive(
                  event.date,
                  event.time,
                  event.durationMinutes,
                );
                return (
                  <TouchableOpacity
                    key={event._id}
                    style={themedStyles.upcomingEventCard}
                    onPress={() => openEvent(event)}>
                    <View style={themedStyles.upcomingDateBadge}>
                      <Text style={themedStyles.upcomingDateDay}>
                        {formatEventDate(event)}
                      </Text>
                      <Text style={themedStyles.upcomingDateTime}>
                        {formatEventTime(event)}
                      </Text>
                    </View>
                    <View style={themedStyles.upcomingEventInfo}>
                      <Text
                        style={themedStyles.upcomingEventName}
                        numberOfLines={1}>
                        {event.name}
                      </Text>
                      {live ? (
                        <View style={themedStyles.liveBadge}>
                          <View style={themedStyles.liveDot} />
                          <Text style={themedStyles.liveBadgeText}>
                            {t('events.happeningNow') || 'Happening Now'}
                          </Text>
                        </View>
                      ) : (
                        <View style={themedStyles.upcomingEventMeta}>
                          <View style={themedStyles.upcomingEventMetaIcon}>
                            <FontAwesomeIcon
                              icon={faLocationDot}
                              size={11}
                              color={colors.secondaryText}
                            />
                          </View>
                          <Text
                            style={themedStyles.upcomingEventMetaText}
                            numberOfLines={1}>
                            {(event as any).isVirtual
                              ? (() => {
                                  const badge =
                                    t('events.virtualLocationBadge') || 'Other';
                                  const loc = (event.location || '').trim();
                                  const generic =
                                    !loc ||
                                    loc.toLowerCase() === 'other' ||
                                    loc.toLowerCase() === 'online / other' ||
                                    loc.toLowerCase() === 'online/other';
                                  return generic ? badge : `${badge} · ${loc}`;
                                })()
                              : event.location}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View style={themedStyles.upcomingChevron}>
                      <FontAwesomeIcon
                        icon={faChevronRight}
                        size={13}
                        color={colors.secondaryText}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
              {upcomingEvents.length > previewUpcomingEvents.length && (
                <Text style={themedStyles.upcomingMoreText}>
                  {`+${
                    upcomingEvents.length - previewUpcomingEvents.length
                  } ${t('profile.moreUpcoming') || 'more'}`}
                </Text>
              )}
            </View>
          ) : (
            <View>
              <Text style={themedStyles.upcomingEmptyText}>
                {t('profile.noUpcoming') || 'No upcoming events'}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Events')}>
                <Text style={themedStyles.upcomingEmptyCta}>
                  {t('profile.browseEvents') || 'Browse Events'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Social ── */}
        <View style={themedStyles.section}>
          <View style={themedStyles.sectionHeaderRow}>
            <Text style={themedStyles.sectionLabel}>
              {t('profile.social') || 'Social'}
            </Text>
          </View>
          <View style={themedStyles.socialQuickActions}>
            <TouchableOpacity
              style={[
                themedStyles.socialActionCard,
                pendingRequestsCount > 0 && themedStyles.socialActionCardPending,
              ]}
              activeOpacity={0.75}
              onPress={() => navigation.navigate('FriendRequests')}>
              <View style={themedStyles.socialActionIcon}>
                <FontAwesomeIcon
                  icon={faUserClock}
                  size={16}
                  color={colors.primary}
                />
              </View>
              <View style={themedStyles.socialActionCopy}>
                <Text style={themedStyles.socialActionText}>
                  {t('profile.requests') || 'Requests'}
                </Text>
                <Text style={themedStyles.socialActionHint} numberOfLines={1}>
                  {pendingRequestsCount > 0
                    ? t('profile.requestsHintPending', {
                        count: pendingRequestsCount,
                      }) ||
                      `${pendingRequestsCount} waiting for you`
                    : t('profile.requestsHint') ||
                      'Friend requests and invites'}
                </Text>
              </View>
              <View style={themedStyles.socialActionTrail}>
                {pendingRequestsCount > 0 ? (
                  <View style={themedStyles.socialActionBadge}>
                    <Text style={themedStyles.socialActionBadgeText}>
                      {pendingRequestsCount > 99 ? '99+' : pendingRequestsCount}
                    </Text>
                  </View>
                ) : (
                  <FontAwesomeIcon
                    icon={faChevronRight}
                    size={12}
                    color={colors.secondaryText}
                  />
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={themedStyles.socialActionCard}
              activeOpacity={0.75}
              onPress={() => navigation.navigate('UserSearch')}>
              <View style={themedStyles.socialActionIcon}>
                <FontAwesomeIcon
                  icon={faUserPlus}
                  size={16}
                  color={colors.primary}
                />
              </View>
              <View style={themedStyles.socialActionCopy}>
                <Text style={themedStyles.socialActionText}>
                  {t('profile.findPeopleFull') || 'Find people'}
                </Text>
                <Text style={themedStyles.socialActionHint} numberOfLines={1}>
                  {t('profile.findPeopleHint') ||
                    'Search by name or username'}
                </Text>
              </View>
              <View style={themedStyles.socialActionTrail}>
                <FontAwesomeIcon
                  icon={faChevronRight}
                  size={12}
                  color={colors.secondaryText}
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Interests ── */}
        <View style={themedStyles.section}>
          <View style={themedStyles.sectionHeaderRow}>
            <Text style={themedStyles.sectionLabel}>
              {t('profile.interests') || 'Interests'}
            </Text>
            <TouchableOpacity onPress={() => setShowInterestsPicker(true)}>
              <Text style={themedStyles.sectionAction}>
                {t('common.edit') || 'Edit'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={themedStyles.sportsContainer}>
            {getFavoriteSportsDisplay().map(sport => (
              <View key={sport.id} style={themedStyles.sportTag}>
                <Text style={themedStyles.sportEmoji}>{sport.emoji}</Text>
                <Text style={themedStyles.sportTagText}>{sport.label}</Text>
              </View>
            ))}
            {getFavoriteSportsDisplay().length === 0 && (
              <TouchableOpacity
                style={themedStyles.addSportButton}
                onPress={() => setShowInterestsPicker(true)}>
                <FontAwesomeIcon
                  icon={faPlus}
                  size={12}
                  color={colors.secondaryText}
                />
                <Text style={themedStyles.addSportText}>
                  {t('profile.addInterests') || 'Add interests'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── My Groups (shortcut to the Groups tab) ── */}
        <View style={themedStyles.accountSection}>
          <Text style={themedStyles.accountSectionLabel}>
            {t('profile.myGroups') || 'My Groups'}
          </Text>
          <TouchableOpacity
            style={[themedStyles.menuRow, themedStyles.menuRowLast]}
            onPress={goToGroups}>
            <View
              style={[
                themedStyles.menuIcon,
                {backgroundColor: colors.primary + '15'},
              ]}>
              <FontAwesomeIcon
                icon={faUserGroup}
                size={14}
                color={colors.primary}
              />
            </View>
            <View style={themedStyles.menuContent}>
              <Text style={themedStyles.menuTitle}>
                {t('navigation.groups') || 'Groups'}
              </Text>
            </View>
            <FontAwesomeIcon
              icon={faChevronRight}
              size={13}
              color={colors.secondaryText}
              style={themedStyles.menuChevron}
            />
          </TouchableOpacity>
        </View>

        {/* ── Account Section ── */}
        <View style={themedStyles.accountSection}>
          <Text style={themedStyles.accountSectionLabel}>
            {t('profile.account') || 'Account'}
          </Text>

          <TouchableOpacity
            style={themedStyles.menuRow}
            onPress={() => navigation.navigate('Settings')}>
            <View
              style={[
                themedStyles.menuIcon,
                {backgroundColor: colors.secondaryText + '15'},
              ]}>
              <FontAwesomeIcon
                icon={faGear}
                size={14}
                color={colors.secondaryText}
              />
            </View>
            <View style={themedStyles.menuContent}>
              <Text style={themedStyles.menuTitle}>
                {t('navigation.settings') || 'Settings'}
              </Text>
            </View>
            <FontAwesomeIcon
              icon={faChevronRight}
              size={13}
              color={colors.secondaryText}
              style={themedStyles.menuChevron}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[themedStyles.menuRow, themedStyles.menuRowLast]}
            onPress={handleSignOut}>
            <View
              style={[
                themedStyles.menuIcon,
                {backgroundColor: '#DC3545' + '15'},
              ]}>
              <FontAwesomeIcon
                icon={faRightFromBracket}
                size={14}
                color="#DC3545"
              />
            </View>
            <View style={themedStyles.menuContent}>
              <Text style={[themedStyles.menuTitle, themedStyles.signOutText]}>
                {t('auth.signOut') || 'Sign Out'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Interests Picker Modal */}
      {showInterestsPicker && (
        <View style={themedStyles.sportsPickerOverlay}>
          <View style={themedStyles.sportsPickerCard}>
            <View style={themedStyles.sportsPickerHandle} />
            <Text style={themedStyles.sportsPickerTitle}>
              {t('profile.selectInterests') || 'Select Your Interests'}
            </Text>
            <ScrollView>
              <View style={themedStyles.sportsPickerBody}>
                <View style={themedStyles.sportsPickerGrid}>
                  {INTERESTS_OPTIONS.map(sport => {
                    const selected = favoriteSports.includes(sport.id);
                    return (
                      <TouchableOpacity
                        key={sport.id}
                        style={[
                          themedStyles.sportPickerItem,
                          selected && themedStyles.sportPickerItemSelected,
                        ]}
                        onPress={() => toggleSport(sport.id)}>
                        <Text style={themedStyles.sportPickerEmoji}>
                          {sport.emoji}
                        </Text>
                        <Text
                          style={[
                            themedStyles.sportPickerLabel,
                            selected && themedStyles.sportPickerLabelSelected,
                          ]}>
                          {sport.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
            <TouchableOpacity
              style={themedStyles.sportsPickerDone}
              onPress={() => setShowInterestsPicker(false)}>
              <Text style={themedStyles.sportsPickerDoneText}>
                {t('common.done') || 'Done'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Sign Out Confirmation Modal */}
      <Modal
        visible={signOutModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSignOutModalVisible(false)}>
        <TouchableOpacity
          style={themedStyles.signOutModalOverlay}
          activeOpacity={1}
          onPress={() => setSignOutModalVisible(false)}>
          <View
            style={themedStyles.signOutModalContent}
            onStartShouldSetResponder={() => true}>
            <View style={themedStyles.signOutHandle} />
            <View style={themedStyles.signOutHeader}>
              <View style={themedStyles.signOutIconContainer}>
                <FontAwesomeIcon
                  icon={faRightFromBracket}
                  size={22}
                  color="#DC3545"
                />
              </View>
              <Text style={themedStyles.signOutTitle}>
                {t('auth.signOut') || 'Sign Out'}
              </Text>
            </View>
            <View style={themedStyles.signOutBody}>
              <Text style={themedStyles.signOutDescription}>
                {t('profile.signOutConfirm') ||
                  'Are you sure you want to sign out?'}
              </Text>
              <View style={themedStyles.signOutButtons}>
                <TouchableOpacity
                  style={themedStyles.signOutCancelButton}
                  onPress={() => setSignOutModalVisible(false)}
                  disabled={isSigningOut}>
                  <Text style={themedStyles.signOutCancelText}>
                    {t('common.cancel') || 'Cancel'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={themedStyles.signOutConfirmButton}
                  onPress={confirmSignOut}
                  disabled={isSigningOut}>
                  {isSigningOut ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={themedStyles.signOutConfirmText}>
                      {t('auth.signOut') || 'Sign Out'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={photoPreviewVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoPreviewVisible(false)}>
        <Pressable
          style={themedStyles.photoPreviewBackdrop}
          onPress={() => setPhotoPreviewVisible(false)}>
          <TouchableOpacity
            style={themedStyles.photoPreviewClose}
            onPress={() => setPhotoPreviewVisible(false)}
            hitSlop={12}>
            <FontAwesomeIcon icon={faTimes} size={18} color="#fff" />
          </TouchableOpacity>
          {selectedImage ? (
            <Image
              source={{uri: selectedImage}}
              style={themedStyles.photoPreviewImage}
              resizeMode="cover"
            />
          ) : null}
        </Pressable>
      </Modal>
      <EditProfileModal
        visible={editProfileVisible}
        initialName={userData?.name || ''}
        initialUsername={userData?.username || ''}
        onCancel={() => setEditProfileVisible(false)}
        onSaved={async user => {
          setUserData(prev => ({
            ...(prev || { _id, username: user.username, email: user.email }),
            ...user,
            _id: user._id || _id,
            username: user.username,
            email: user.email || prev?.email || '',
            name: user.name,
            profilePicUrl: user.profilePicUrl || prev?.profilePicUrl,
          }));
          await AsyncStorage.setItem('cachedUserData', JSON.stringify(user));
          setEditProfileVisible(false);
        }}
      />
    </SafeAreaView>
  );
};

export default Profile;
