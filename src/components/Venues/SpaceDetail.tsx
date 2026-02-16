import React, {
  useState,
  useContext,
  useMemo,
  useEffect,
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
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Platform,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {SafeAreaView} from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faArrowLeft,
  faClock,
  faChevronLeft,
  faChevronRight,
  faPlus,
  faTrash,
  faEdit,
  faCalendarDay,
  faCalendarWeek,
  faRepeat,
  faGear,
  faChevronDown,
  faFilter,
  faStar,
} from '@fortawesome/free-solid-svg-icons';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import UserContext, {UserContextType} from '../UserContext';
import {useTheme} from '../ThemeContext/ThemeContext';
import axios from 'axios';
import {API_BASE_URL} from '../../config/api';
import {useTranslation} from 'react-i18next';
import {VenueStackParamList} from './VenueList';

type SpaceDetailRouteProp = RouteProp<VenueStackParamList, 'SpaceDetail'>;

interface TimeSlot {
  _id: string;
  startTime: string;
  endTime: string;
  date: string;
  isBooked: boolean;
  bookedBy?: string;
  bookedByUsername?: string;
  eventName?: string;
  price?: number;
  bookingId?: string;
}

// Helper function to format date
const formatDate = (date: Date): string => {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  };
  return date.toLocaleDateString('en-US', options);
};

// Helper function to format date string (YYYY-MM-DD) to display format without timezone issues
const formatDateString = (dateStr: string): string => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day); // month is 0-indexed
  return formatDate(date);
};

// Helper function to parse a YYYY-MM-DD string to a Date object without timezone issues
const parseDateString = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day); // month is 0-indexed
};

// Helper function to get local date string (YYYY-MM-DD) without timezone conversion
const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper function to format time
const formatTime = (time: string): string => {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

// Helper function to parse time string like "6:00 AM" or "11:00 PM" to 24-hour format
// For start times: rounds UP to next hour if minutes > 0 (5:30 AM → 6)
// For end times: rounds DOWN to current hour if minutes > 0 (10:30 PM → 22)
const parseTimeToHour = (timeStr: string, roundUp: boolean = false): number => {
  // Handle various formats: "6:00 AM", "6:00AM", "06:00 AM"
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) {
    return roundUp ? 6 : 22; // Default to 6 AM for start, 10 PM for end
  }

  let hour = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const isPM = match[3].toUpperCase() === 'PM';

  // Convert to 24-hour format
  if (isPM && hour !== 12) hour += 12;
  if (!isPM && hour === 12) hour = 0;

  // Round up for start times (so 5:30 AM becomes 6 AM - first full hour available)
  // Round down for end times (so 10:30 PM becomes 10 PM - last full hour slot)
  if (roundUp && minutes > 0) {
    hour += 1;
  }

  return hour;
};

// Generate time slots for a day based on operating hours
const generateDefaultTimeSlots = (
  date: Date,
  operatingHours?: string,
): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  // Use local date to avoid timezone issues
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  // Parse operating hours or use defaults (6 AM to 10 PM)
  let startHour = 6;
  let endHour = 22;

  if (operatingHours) {
    // Parse "6:00 AM - 11:00 PM" format
    const parts = operatingHours.split(' - ');
    if (parts.length === 2) {
      // Round up start time, round down end time to ensure slots fit within hours
      startHour = parseTimeToHour(parts[0].trim(), true);
      endHour = parseTimeToHour(parts[1].trim(), false);
      // Handle midnight (12:00 AM) as end of day
      if (endHour === 0) endHour = 24;
    }
  }

  // Generate hour-long time slots within operating hours
  for (let hour = startHour; hour < endHour; hour++) {
    const displayHour = hour % 24;
    const nextHour = (hour + 1) % 24;
    slots.push({
      _id: `slot-${dateStr}-${hour}`,
      startTime: `${displayHour.toString().padStart(2, '0')}:00`,
      endTime: `${nextHour.toString().padStart(2, '0')}:00`,
      date: dateStr,
      isBooked: false,
      bookedBy: undefined,
      bookedByUsername: undefined,
      eventName: undefined,
      price: 150,
    });
  }
  return slots;
};

// Venue type emoji mapping
const venueTypeEmojis: Record<string, string> = {
  'Hockey Rink': '🏒',
  'Basketball Court': '🏀',
  'Soccer Field': '⚽',
  'Tennis Court': '🎾',
  'Baseball Diamond': '⚾',
  'Football Field': '🏈',
  'Golf Course': '⛳',
  'Volleyball Court': '🏐',
  'Swimming Pool': '🏊',
  Gym: '💪',
  'Multi-Purpose': '🏟️',
};

const SpaceDetail: React.FC = () => {
  const route = useRoute<SpaceDetailRouteProp>();
  const navigation = useNavigation();
  const userContext = useContext(UserContext) as UserContextType;
  const {userData} = userContext;
  const isAdmin = userContext?.isAdmin || false;
  const {colors} = useTheme();
  const {t} = useTranslation();

  const {venueId, spaceId, spaceName, venueType, operatingHours} = route.params;
  const spaceEmoji = venueTypeEmojis[venueType] || '🏟️';

  // State
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // View mode state (day or week)
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [weekSlots, setWeekSlots] = useState<Map<string, TimeSlot[]>>(
    new Map(),
  );

  // Booking modal state
  const [showBookingModal, setShowBookingModal] = useState<boolean>(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [bookingEventName, setBookingEventName] = useState<string>('');
  const [bookingNotes, setBookingNotes] = useState<string>('');
  const [booking, setBooking] = useState<boolean>(false);

  // Slot detail view modal (for week view)
  const [showSlotDetailModal, setShowSlotDetailModal] =
    useState<boolean>(false);
  const [viewingSlot, setViewingSlot] = useState<TimeSlot | null>(null);

  // Recurring booking state
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [recurringWeeks, setRecurringWeeks] = useState<number>(4);
  const recurringOptions = [4, 8, 12, 24];

  // Inquiry modal state
  const [showInquiryModal, setShowInquiryModal] = useState<boolean>(false);
  const [inquiryMessage, setInquiryMessage] = useState<string>('');
  const [sendingInquiry, setSendingInquiry] = useState<boolean>(false);

  // Date picker (Android)
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

  // Admin slot management state
  const [showAddSlotModal, setShowAddSlotModal] = useState<boolean>(false);
  const [showEditSlotModal, setShowEditSlotModal] = useState<boolean>(false);
  const [editingSlot, setEditingSlot] = useState<TimeSlot | null>(null);
  const [newSlotStartTime, setNewSlotStartTime] = useState<string>('09:00');
  const [newSlotEndTime, setNewSlotEndTime] = useState<string>('10:00');
  const [newSlotPrice, setNewSlotPrice] = useState<string>('150');
  const [savingSlot, setSavingSlot] = useState<boolean>(false);

  // Time picker state
  const [showStartTimePicker, setShowStartTimePicker] =
    useState<boolean>(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState<boolean>(false);

  // Admin mode toggle (hides admin controls unless enabled)
  const [adminModeEnabled, setAdminModeEnabled] = useState<boolean>(false);

  // Expanded slot state (for tap-to-expand functionality)
  const [expandedSlotId, setExpandedSlotId] = useState<string | null>(null);

  // Filter to show only user's bookings
  const [showMyBookingsOnly, setShowMyBookingsOnly] = useState<boolean>(false);

  // Color constants for booking ownership
  const COLORS = {
    myBooking: '#2196F3', // Blue for user's own bookings
    otherBooking: '#9E9E9E', // Gray for others' bookings
    available: colors.success || '#4CAF50', // Green for available
  };

  // Helper function to safely compare user IDs (handles ObjectId vs string comparison)
  const isCurrentUserBooking = useCallback(
    (slot: TimeSlot): boolean => {
      if (!slot.isBooked) return false;

      const currentUserId = userData?._id;
      const currentUsername = userData?.username;

      if (!currentUserId && !currentUsername) return false;

      // Check bookedBy - handle both string and object formats
      const bookedById =
        typeof slot.bookedBy === 'object'
          ? (slot.bookedBy as any)?._id || (slot.bookedBy as any)?.toString()
          : slot.bookedBy;

      // Compare IDs as strings
      if (
        currentUserId &&
        bookedById &&
        String(bookedById) === String(currentUserId)
      ) {
        return true;
      }

      // Fallback to username comparison (case-insensitive)
      if (currentUsername && slot.bookedByUsername) {
        return (
          slot.bookedByUsername.toLowerCase() === currentUsername.toLowerCase()
        );
      }

      return false;
    },
    [userData?._id, userData?.username],
  );

  // Available time options for slot creation
  const timeOptions = Array.from({length: 48}, (_, i) => {
    const hour = Math.floor(i / 2);
    const minute = i % 2 === 0 ? '00' : '30';
    return `${hour.toString().padStart(2, '0')}:${minute}`;
  });

  // Themed styles
  const themedStyles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.card,
        },
        backButton: {
          padding: 8,
          marginRight: 12,
        },
        headerContent: {
          flex: 1,
        },
        headerTitle: {
          fontSize: 20,
          fontWeight: '700',
          color: colors.text,
        },
        headerSubtitle: {
          fontSize: 14,
          color: colors.secondaryText,
          marginTop: 2,
        },
        dateSelector: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        dateNavButton: {
          padding: 12,
          borderRadius: 8,
          backgroundColor: colors.background,
        },
        dateDisplay: {
          alignItems: 'center',
        },
        dateText: {
          fontSize: 18,
          fontWeight: '700',
          color: colors.text,
        },
        dateSubtext: {
          fontSize: 13,
          color: colors.secondaryText,
          marginTop: 2,
        },
        todayBadge: {
          backgroundColor: colors.primary,
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 10,
          marginTop: 4,
        },
        todayText: {
          color: '#FFFFFF',
          fontSize: 11,
          fontWeight: '600',
        },
        slotsContainer: {
          flex: 1,
          padding: 16,
        },
        slotCard: {
          backgroundColor: colors.card,
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
          borderLeftWidth: 4,
          borderColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
        },
        slotCardAvailable: {
          borderLeftColor: colors.success || '#4CAF50',
        },
        slotCardMyBooking: {
          borderLeftColor: '#2196F3',
          backgroundColor: '#2196F3' + '08',
        },
        slotCardOtherBooking: {
          borderLeftColor: '#9E9E9E',
          backgroundColor: colors.card,
        },
        slotCardExpanded: {
          borderWidth: 1,
          borderColor: colors.primary,
        },
        slotCardBooked: {
          // Removed opacity - using color coding instead
        },
        slotTime: {
          width: 90,
        },
        slotTimeText: {
          fontSize: 16,
          fontWeight: '700',
          color: colors.text,
        },
        slotTimeRange: {
          fontSize: 12,
          color: colors.secondaryText,
          marginTop: 2,
        },
        slotInfo: {
          flex: 1,
          marginLeft: 12,
        },
        slotStatus: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        slotStatusDot: {
          width: 8,
          height: 8,
          borderRadius: 4,
          marginRight: 6,
        },
        slotStatusAvailable: {
          backgroundColor: colors.success || '#4CAF50',
        },
        slotStatusBooked: {
          backgroundColor: colors.error || '#F44336',
        },
        slotStatusText: {
          fontSize: 14,
          fontWeight: '600',
        },
        slotStatusTextAvailable: {
          color: colors.success || '#4CAF50',
        },
        slotStatusTextBooked: {
          color: colors.error || '#F44336',
        },
        slotBookedBy: {
          fontSize: 13,
          color: colors.secondaryText,
          marginTop: 4,
        },
        slotPrice: {
          fontSize: 16,
          fontWeight: '700',
          color: colors.primary,
        },
        slotActions: {
          marginLeft: 12,
        },
        bookButton: {
          backgroundColor: colors.primary,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 8,
        },
        bookButtonText: {
          color: '#FFFFFF',
          fontWeight: '600',
          fontSize: 14,
        },
        inquireButton: {
          backgroundColor: 'transparent',
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.primary,
        },
        inquireButtonText: {
          color: colors.primary,
          fontWeight: '600',
          fontSize: 14,
        },
        emptyContainer: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 60,
        },
        emptyText: {
          fontSize: 16,
          color: colors.secondaryText,
          textAlign: 'center',
          marginTop: 16,
        },
        legendContainer: {
          flexDirection: 'row',
          justifyContent: 'center',
          flexWrap: 'wrap',
          padding: 12,
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        legendItem: {
          flexDirection: 'row',
          alignItems: 'center',
          marginHorizontal: 8,
          marginVertical: 2,
        },
        legendDot: {
          width: 10,
          height: 10,
          borderRadius: 5,
          marginRight: 6,
        },
        legendMyBooking: {
          backgroundColor: '#2196F3',
        },
        legendOtherBooking: {
          backgroundColor: '#9E9E9E',
        },
        legendText: {
          fontSize: 12,
          color: colors.secondaryText,
        },
        // Modal styles
        modalOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'center',
          alignItems: 'center',
        },
        modalContent: {
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 24,
          width: '90%',
          maxHeight: '80%',
        },
        modalTitle: {
          fontSize: 22,
          fontWeight: '700',
          color: colors.text,
          marginBottom: 8,
          textAlign: 'center',
        },
        modalSubtitle: {
          fontSize: 14,
          color: colors.secondaryText,
          marginBottom: 20,
          textAlign: 'center',
        },
        modalSlotInfo: {
          backgroundColor: colors.background,
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
          alignItems: 'center',
        },
        modalSlotTime: {
          fontSize: 18,
          fontWeight: '700',
          color: colors.primary,
        },
        modalSlotDate: {
          fontSize: 14,
          color: colors.secondaryText,
          marginTop: 4,
        },
        inputLabel: {
          fontSize: 14,
          fontWeight: '600',
          color: colors.text,
          marginBottom: 6,
        },
        input: {
          backgroundColor: colors.background,
          borderRadius: 8,
          padding: 14,
          fontSize: 16,
          color: colors.text,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: 16,
        },
        textArea: {
          minHeight: 80,
          textAlignVertical: 'top',
        },
        submitButton: {
          backgroundColor: colors.primary,
          borderRadius: 8,
          padding: 16,
          alignItems: 'center',
          marginTop: 8,
        },
        submitButtonText: {
          color: '#FFFFFF',
          fontSize: 16,
          fontWeight: '600',
        },
        cancelButton: {
          padding: 16,
          alignItems: 'center',
        },
        cancelButtonText: {
          color: colors.secondaryText,
          fontSize: 16,
        },
        loadingIndicator: {
          marginTop: 40,
        },
        slotsListContent: {
          paddingVertical: 16,
        },
        // Admin mode toggle styles
        adminModeContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingHorizontal: 16,
          paddingVertical: 8,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        adminModeToggle: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.background,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
        },
        adminModeToggleActive: {
          backgroundColor: colors.primary + '20',
          borderColor: colors.primary,
        },
        adminModeText: {
          fontSize: 12,
          fontWeight: '600',
          color: colors.secondaryText,
          marginLeft: 6,
        },
        adminModeTextActive: {
          color: colors.primary,
        },
        // Expanded slot actions container
        slotExpandedActions: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
          marginTop: 12,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          gap: 8,
        },
        slotActionButton: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 8,
          gap: 6,
        },
        slotActionButtonPrimary: {
          backgroundColor: colors.primary,
        },
        slotActionButtonSecondary: {
          backgroundColor: colors.primary + '20',
        },
        slotActionButtonDanger: {
          backgroundColor: (colors.error || '#F44336') + '20',
        },
        slotActionButtonText: {
          fontSize: 13,
          fontWeight: '600',
        },
        slotActionButtonTextPrimary: {
          color: '#FFFFFF',
        },
        slotActionButtonTextSecondary: {
          color: colors.primary,
        },
        slotActionButtonTextDanger: {
          color: colors.error || '#F44336',
        },
        // Chevron indicator for expandable cards
        slotChevron: {
          marginLeft: 8,
        },
        // Filter and stats bar styles
        filterBar: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 10,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        filterButton: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.background,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
        },
        filterButtonActive: {
          backgroundColor: '#2196F3' + '20',
          borderColor: '#2196F3',
        },
        filterButtonText: {
          fontSize: 12,
          fontWeight: '600',
          color: colors.secondaryText,
          marginLeft: 6,
        },
        filterButtonTextActive: {
          color: '#2196F3',
        },
        statsContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        },
        statItem: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        statDot: {
          width: 8,
          height: 8,
          borderRadius: 4,
          marginRight: 4,
        },
        statText: {
          fontSize: 11,
          color: colors.secondaryText,
          fontWeight: '500',
        },
        // Admin slot management styles
        addSlotButton: {
          position: 'absolute',
          bottom: 80,
          right: 20,
          backgroundColor: colors.primary,
          width: 56,
          height: 56,
          borderRadius: 28,
          justifyContent: 'center',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 2},
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 5,
        },
        slotAdminActions: {
          flexDirection: 'row',
          alignItems: 'center',
          marginLeft: 8,
        },
        slotAdminButton: {
          padding: 8,
          marginLeft: 4,
        },
        timePickerContainer: {
          marginBottom: 16,
        },
        timePickerRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
        },
        timePickerColumn: {
          flex: 1,
          marginHorizontal: 4,
        },
        timePickerButton: {
          backgroundColor: colors.background,
          borderRadius: 8,
          padding: 14,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: 'center',
        },
        timePickerButtonText: {
          fontSize: 16,
          color: colors.text,
          fontWeight: '600',
        },
        timeOptionsContainer: {
          maxHeight: 200,
          backgroundColor: colors.background,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.border,
          marginTop: 4,
        },
        timeOption: {
          padding: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        timeOptionText: {
          fontSize: 16,
          color: colors.text,
          textAlign: 'center',
        },
        timeOptionSelected: {
          backgroundColor: colors.primary + '20',
        },
        deleteButton: {
          backgroundColor: colors.error || '#F44336',
          borderRadius: 8,
          padding: 16,
          alignItems: 'center',
          marginTop: 8,
        },
        deleteButtonText: {
          color: '#FFFFFF',
          fontSize: 16,
          fontWeight: '600',
        },
        // View mode toggle styles
        viewModeContainer: {
          flexDirection: 'row',
          justifyContent: 'center',
          paddingVertical: 8,
          backgroundColor: colors.card,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        viewModeButton: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 8,
          marginHorizontal: 4,
          borderRadius: 20,
          backgroundColor: colors.background,
        },
        viewModeButtonActive: {
          backgroundColor: colors.primary,
        },
        viewModeButtonText: {
          fontSize: 14,
          fontWeight: '600',
          color: colors.secondaryText,
          marginLeft: 6,
        },
        viewModeButtonTextActive: {
          color: '#FFFFFF',
        },
        // Week view styles
        weekContainer: {
          flex: 1,
        },
        weekHeader: {
          flexDirection: 'row',
          backgroundColor: colors.card,
          borderBottomWidth: 2,
          borderBottomColor: colors.border,
        },
        weekHeaderTime: {
          width: 60,
          paddingVertical: 10,
          alignItems: 'center',
          justifyContent: 'center',
          borderRightWidth: 1,
          borderRightColor: colors.border,
        },
        weekHeaderDay: {
          flex: 1,
          paddingVertical: 10,
          alignItems: 'center',
          justifyContent: 'center',
          borderRightWidth: 1,
          borderRightColor: colors.border,
        },
        weekHeaderDayText: {
          fontSize: 12,
          fontWeight: '600',
          color: colors.secondaryText,
        },
        weekHeaderDateText: {
          fontSize: 16,
          fontWeight: '700',
          color: colors.text,
          marginTop: 2,
        },
        weekHeaderToday: {
          backgroundColor: colors.primary + '25',
          borderBottomWidth: 3,
          borderBottomColor: colors.primary,
        },
        weekHeaderTodayText: {
          color: colors.primary,
        },
        weekGrid: {
          flexDirection: 'row',
        },
        weekTimeColumn: {
          width: 60,
          borderRightWidth: 1,
          borderRightColor: colors.border,
        },
        weekTimeCell: {
          height: 50,
          justifyContent: 'center',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        weekTimeCellText: {
          fontSize: 10,
          color: colors.secondaryText,
          fontWeight: '500',
        },
        weekDayColumn: {
          flex: 1,
          borderRightWidth: 1,
          borderRightColor: colors.border,
        },
        weekDayColumnToday: {
          backgroundColor: colors.primary + '08',
        },
        weekSlotCell: {
          height: 50,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 2,
        },
        weekSlotAvailable: {
          backgroundColor: (colors.success || '#4CAF50') + '15',
        },
        weekSlotBooked: {
          backgroundColor: (colors.error || '#F44336') + '30',
        },
        weekSlotMyBooking: {
          backgroundColor: '#2196F3' + '35',
        },
        weekSlotTextMyBooking: {
          color: '#2196F3',
        },
        weekSlotText: {
          fontSize: 10,
          fontWeight: '600',
          textAlign: 'center',
        },
        weekSlotTextAvailable: {
          color: colors.success || '#4CAF50',
        },
        weekSlotTextBooked: {
          color: colors.error || '#F44336',
        },
        weekSlotPrice: {
          fontSize: 9,
          color: colors.secondaryText,
          fontWeight: '500',
        },
        weekSlotPast: {
          backgroundColor: colors.border + '30',
        },
        // Recurring booking styles
        recurringContainer: {
          marginTop: 16,
          padding: 12,
          backgroundColor: colors.background,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.border,
        },
        recurringToggle: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        recurringToggleLeft: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        recurringToggleText: {
          fontSize: 16,
          fontWeight: '600',
          color: colors.text,
          marginLeft: 10,
        },
        recurringToggleSubtext: {
          fontSize: 12,
          color: colors.secondaryText,
          marginTop: 4,
          marginLeft: 28,
        },
        recurringSwitch: {
          transform: [{scaleX: 0.9}, {scaleY: 0.9}],
        },
        recurringOptions: {
          marginTop: 12,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        recurringOptionsLabel: {
          fontSize: 14,
          fontWeight: '600',
          color: colors.text,
          marginBottom: 8,
        },
        recurringOptionsRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        },
        recurringOptionButton: {
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 16,
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
        },
        recurringOptionButtonActive: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
        recurringOptionText: {
          fontSize: 14,
          fontWeight: '600',
          color: colors.secondaryText,
        },
        recurringOptionTextActive: {
          color: '#FFFFFF',
        },
        recurringSummary: {
          marginTop: 12,
          padding: 10,
          backgroundColor: colors.primary + '15',
          borderRadius: 8,
        },
        recurringSummaryText: {
          fontSize: 13,
          color: colors.text,
          textAlign: 'center',
        },
      }),
    [colors],
  );

  // Fetch time slots for the selected date
  const fetchTimeSlots = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const dateStr = getLocalDateString(selectedDate);
      const response = await axios.get(
        `${API_BASE_URL}/api/venues/${venueId}/spaces/${spaceId}/timeslots?date=${dateStr}`,
        {headers: {Authorization: `Bearer ${token}`}},
      );
      // Transform backend response to frontend format
      const slots = response.data.slots || response.data;
      const transformedSlots = slots.map((slot: any) => ({
        _id: slot.id || slot._id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        date: slot.date,
        isBooked: slot.available === false, // Only booked if explicitly set to false
        bookedBy: slot.bookedBy,
        bookedByUsername: slot.bookedByUsername,
        eventName: slot.eventName,
        price: slot.price || 150,
        bookingId: slot.bookingId,
      }));
      setTimeSlots(transformedSlots);
    } catch (error) {
      console.error('Error fetching time slots:', error);
      // Generate placeholder time slots based on venue operating hours
      setTimeSlots(generateDefaultTimeSlots(selectedDate, operatingHours));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [venueId, spaceId, selectedDate, operatingHours]);

  // Get the start of the week (Sunday) for a given date
  const getWeekStart = useCallback((date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Get array of dates for the week
  const getWeekDates = useCallback(
    (date: Date): Date[] => {
      const weekStart = getWeekStart(date);
      return Array.from({length: 7}, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
      });
    },
    [getWeekStart],
  );

  // Fetch time slots for the entire week
  const fetchWeekSlots = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const weekDates = getWeekDates(selectedDate);
      const startDate = getLocalDateString(weekDates[0]);
      const endDate = getLocalDateString(weekDates[6]);

      const response = await axios.get(
        `${API_BASE_URL}/api/venues/${venueId}/spaces/${spaceId}/timeslots?startDate=${startDate}&endDate=${endDate}`,
        {headers: {Authorization: `Bearer ${token}`}},
      );

      const slots = response.data.slots || response.data;
      const slotsByDate = new Map<string, TimeSlot[]>();

      // Initialize all dates with empty arrays
      weekDates.forEach(d => {
        slotsByDate.set(getLocalDateString(d), []);
      });

      // Group slots by date
      slots.forEach((slot: any) => {
        const transformedSlot: TimeSlot = {
          _id: slot.id || slot._id,
          startTime: slot.startTime,
          endTime: slot.endTime,
          date: slot.date,
          isBooked: slot.available === false, // Only booked if explicitly set to false
          bookedBy: slot.bookedBy,
          bookedByUsername: slot.bookedByUsername,
          eventName: slot.eventName,
          price: slot.price || 150,
          bookingId: slot.bookingId,
        };
        // Normalize the date - if the slot.date doesn't match any key in our map,
        // it might be off by a day due to timezone. Parse and re-format to local.
        let slotDateKey = slot.date;
        if (!slotsByDate.has(slotDateKey) && slot.date) {
          // Try parsing the date and converting to local
          const [year, month, day] = slot.date.split('-').map(Number);
          const slotDate = new Date(year, month - 1, day);
          slotDateKey = getLocalDateString(slotDate);
        }
        const existing = slotsByDate.get(slotDateKey) || [];
        slotsByDate.set(slotDateKey, [...existing, transformedSlot]);
      });

      setWeekSlots(slotsByDate);
    } catch (error) {
      console.error('Error fetching week slots:', error);
      // Generate placeholder slots for the week
      const weekDates = getWeekDates(selectedDate);
      const slotsByDate = new Map<string, TimeSlot[]>();
      weekDates.forEach(d => {
        slotsByDate.set(
          getLocalDateString(d),
          generateDefaultTimeSlots(d, operatingHours),
        );
      });
      setWeekSlots(slotsByDate);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [venueId, spaceId, selectedDate, operatingHours, getWeekDates]);

  useEffect(() => {
    setLoading(true);
    if (viewMode === 'week') {
      fetchWeekSlots();
    } else {
      fetchTimeSlots();
    }
  }, [fetchTimeSlots, fetchWeekSlots, viewMode]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (viewMode === 'week') {
      fetchWeekSlots();
    } else {
      fetchTimeSlots();
    }
  }, [fetchTimeSlots, fetchWeekSlots, viewMode]);

  // Navigate to previous day/week
  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - (viewMode === 'week' ? 7 : 1));

    // Don't go before today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (viewMode === 'week') {
      const weekStart = getWeekStart(newDate);
      if (weekStart >= today || getWeekStart(today) <= weekStart) {
        setSelectedDate(newDate);
      }
    } else if (newDate >= today) {
      setSelectedDate(newDate);
    }
  };

  // Navigate to next day/week
  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (viewMode === 'week' ? 7 : 1));

    // Allow navigation up to 6 months (180 days) to match 24-week recurring bookings
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 180);
    if (newDate <= maxDate) {
      setSelectedDate(newDate);
    }
  };

  // Check if selected date is today
  const isToday = () => {
    const today = new Date();
    return (
      selectedDate.getDate() === today.getDate() &&
      selectedDate.getMonth() === today.getMonth() &&
      selectedDate.getFullYear() === today.getFullYear()
    );
  };

  // Handle date change from picker
  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
    }
  };

  // Open booking modal for a slot
  const handleBookSlot = (slot: TimeSlot) => {
    if (slot.isBooked) {
      return;
    }
    setSelectedSlot(slot);
    setShowBookingModal(true);
  };

  // Open inquiry modal for a booked slot
  const handleInquireSlot = (slot: TimeSlot) => {
    setSelectedSlot(slot);
    setShowInquiryModal(true);
  };

  // Handle editing user's own booking
  const handleEditMyBooking = (slot: TimeSlot) => {
    setSelectedSlot(slot);
    setBookingEventName(slot.eventName || '');
    setBookingNotes('');
    setShowBookingModal(true);
  };

  // Handle canceling user's own booking
  const handleCancelMyBooking = (slot: TimeSlot) => {
    Alert.alert(
      t('venues.cancelBooking') || 'Cancel Booking',
      t('venues.cancelBookingConfirm') ||
        'Are you sure you want to cancel this booking?',
      [
        {text: t('common.cancel'), style: 'cancel'},
        {
          text: t('venues.cancelBooking') || 'Cancel Booking',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('userToken');
              // Use bookingId if available, otherwise fall back to slot._id
              const bookingIdToCancel = slot.bookingId || slot._id;
              await axios.patch(
                `${API_BASE_URL}/api/bookings/${bookingIdToCancel}/cancel`,
                {},
                {headers: {Authorization: `Bearer ${token}`}},
              );
              Alert.alert(
                t('common.success'),
                t('venues.bookingCanceled') || 'Booking canceled successfully',
              );
              // Refresh slots
              if (viewMode === 'week') {
                fetchWeekSlots();
              } else {
                fetchTimeSlots();
              }
            } catch (error: any) {
              console.error('Error canceling booking:', error);
              const errorMsg =
                error?.response?.data?.message ||
                error?.message ||
                'Failed to cancel booking. Please try again.';
              Alert.alert(t('common.error') || 'Error', errorMsg);
            }
          },
        },
      ],
    );
  };

  // Submit booking (or update existing booking)
  const submitBooking = async () => {
    if (!selectedSlot) {
      return;
    }

    if (!bookingEventName.trim()) {
      Alert.alert(
        t('common.error'),
        t('venues.eventNameRequired') || 'Event name is required',
      );
      return;
    }

    const isEditing =
      selectedSlot.isBooked && selectedSlot.bookedBy === userData?._id;

    setBooking(true);
    try {
      const token = await AsyncStorage.getItem('userToken');

      if (isEditing) {
        // Update existing booking
        await axios.put(
          `${API_BASE_URL}/api/venues/${venueId}/spaces/${spaceId}/bookings/${selectedSlot._id}`,
          {
            eventName: bookingEventName.trim(),
            notes: bookingNotes.trim(),
          },
          {headers: {Authorization: `Bearer ${token}`}},
        );

        Alert.alert(
          t('common.success'),
          t('venues.bookingUpdated') || 'Booking updated successfully',
        );

        // Update local state
        setTimeSlots(prev =>
          prev.map(s =>
            s._id === selectedSlot._id
              ? {...s, eventName: bookingEventName.trim()}
              : s,
          ),
        );
      } else if (isRecurring && recurringWeeks > 1) {
        // Book multiple slots for recurring booking
        const bookingPromises = [];
        const baseDate = parseDateString(selectedSlot.date);

        for (let week = 0; week < recurringWeeks; week++) {
          const bookingDate = new Date(baseDate);
          bookingDate.setDate(bookingDate.getDate() + week * 7);
          const dateStr = getLocalDateString(bookingDate);

          bookingPromises.push(
            axios.post(
              `${API_BASE_URL}/api/venues/${venueId}/spaces/${spaceId}/book`,
              {
                date: dateStr,
                startTime: selectedSlot.startTime,
                endTime: selectedSlot.endTime,
                eventName: bookingEventName.trim(),
                notes: bookingNotes.trim(),
                isRecurring: true,
                recurringWeeks: recurringWeeks,
              },
              {headers: {Authorization: `Bearer ${token}`}},
            ),
          );
        }

        const results = await Promise.allSettled(bookingPromises);
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        if (failed > 0) {
          Alert.alert(
            t('common.success'),
            t('venues.recurringPartialSuccess', {
              successful,
              total: recurringWeeks,
            }) ||
              `Booked ${successful} of ${recurringWeeks} weeks. Some dates may already be booked.`,
          );
        } else {
          Alert.alert(
            t('common.success'),
            t('venues.recurringBookingConfirmed', {weeks: recurringWeeks}) ||
              `Successfully booked ${recurringWeeks} weekly sessions!`,
          );
        }
      } else {
        // Single booking
        await axios.post(
          `${API_BASE_URL}/api/venues/${venueId}/spaces/${spaceId}/book`,
          {
            date: selectedSlot.date,
            startTime: selectedSlot.startTime,
            endTime: selectedSlot.endTime,
            eventName: bookingEventName.trim(),
            notes: bookingNotes.trim(),
          },
          {headers: {Authorization: `Bearer ${token}`}},
        );

        Alert.alert(t('common.success'), t('venues.bookingConfirmed'));
      }

      // Refresh time slots to get updated data from server
      if (viewMode === 'week') {
        fetchWeekSlots();
      } else {
        fetchTimeSlots();
      }

      setShowBookingModal(false);
      setSelectedSlot(null);
      setBookingEventName('');
      setBookingNotes('');
      setIsRecurring(false);
      setRecurringWeeks(4);
    } catch (error: any) {
      console.error('Error booking slot:', error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to book slot';
      Alert.alert(t('common.error'), errorMessage);
    } finally {
      setBooking(false);
    }
  };

  // Submit inquiry
  const submitInquiry = async () => {
    if (!selectedSlot || !inquiryMessage.trim()) {
      Alert.alert(t('common.error'), t('venues.inquiryRequired'));
      return;
    }

    setSendingInquiry(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      await axios.post(
        `${API_BASE_URL}/api/venues/${venueId}/spaces/${spaceId}/inquire`,
        {
          message: inquiryMessage.trim(),
          preferredDate: selectedSlot.date,
          preferredTime: selectedSlot.startTime,
        },
        {headers: {Authorization: `Bearer ${token}`}},
      );

      Alert.alert(t('common.success'), t('venues.inquirySent'));
      setShowInquiryModal(false);
      setSelectedSlot(null);
      setInquiryMessage('');
    } catch (error) {
      console.error('Error sending inquiry:', error);
      // For development
      Alert.alert(t('common.success'), t('venues.inquirySent'));
      setShowInquiryModal(false);
      setSelectedSlot(null);
      setInquiryMessage('');
    } finally {
      setSendingInquiry(false);
    }
  };

  // === ADMIN SLOT MANAGEMENT FUNCTIONS ===

  // Open add slot modal
  const handleAddSlot = () => {
    setNewSlotStartTime('09:00');
    setNewSlotEndTime('10:00');
    setNewSlotPrice('150');
    setShowAddSlotModal(true);
  };

  // Open edit slot modal
  const handleEditSlot = (slot: TimeSlot) => {
    setEditingSlot(slot);
    setNewSlotStartTime(slot.startTime);
    setNewSlotEndTime(slot.endTime);
    setNewSlotPrice(slot.price?.toString() || '150');
    setShowEditSlotModal(true);
  };

  // Delete a slot
  const handleDeleteSlot = (slot: TimeSlot) => {
    Alert.alert(
      t('venues.deleteSlot') || 'Delete Time Slot',
      t('venues.deleteSlotConfirm') ||
        `Are you sure you want to delete the ${formatTime(
          slot.startTime,
        )} - ${formatTime(slot.endTime)} slot?`,
      [
        {text: t('common.cancel'), style: 'cancel'},
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('userToken');
              await axios.delete(
                `${API_BASE_URL}/api/venues/${venueId}/spaces/${spaceId}/timeslots/${slot._id}`,
                {headers: {Authorization: `Bearer ${token}`}},
              );
              // Remove from local state
              setTimeSlots(prev => prev.filter(s => s._id !== slot._id));
              Alert.alert(
                t('common.success'),
                t('venues.slotDeleted') || 'Time slot deleted',
              );
            } catch (error) {
              console.error('Error deleting slot:', error);
              // For development - still remove from local state
              setTimeSlots(prev => prev.filter(s => s._id !== slot._id));
              Alert.alert(
                t('common.success'),
                t('venues.slotDeleted') || 'Time slot deleted',
              );
            }
          },
        },
      ],
    );
  };

  // Save new slot
  const saveNewSlot = async () => {
    if (newSlotStartTime >= newSlotEndTime) {
      Alert.alert(
        t('common.error'),
        t('venues.invalidTimeRange') || 'End time must be after start time',
      );
      return;
    }

    // Check for overlapping slots
    const hasOverlap = timeSlots.some(slot => {
      return (
        (newSlotStartTime >= slot.startTime &&
          newSlotStartTime < slot.endTime) ||
        (newSlotEndTime > slot.startTime && newSlotEndTime <= slot.endTime) ||
        (newSlotStartTime <= slot.startTime && newSlotEndTime >= slot.endTime)
      );
    });

    if (hasOverlap) {
      Alert.alert(
        t('common.error'),
        t('venues.slotOverlap') ||
          'This time slot overlaps with an existing slot',
      );
      return;
    }

    setSavingSlot(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const dateStr = getLocalDateString(selectedDate);

      const response = await axios.post(
        `${API_BASE_URL}/api/venues/${venueId}/spaces/${spaceId}/timeslots`,
        {
          date: dateStr,
          startTime: newSlotStartTime,
          endTime: newSlotEndTime,
          price: parseFloat(newSlotPrice) || 150,
        },
        {headers: {Authorization: `Bearer ${token}`}},
      );

      // Add to local state and sort by time
      const newSlot: TimeSlot = {
        _id: response.data._id || `slot-${dateStr}-${newSlotStartTime}`,
        startTime: newSlotStartTime,
        endTime: newSlotEndTime,
        date: dateStr,
        isBooked: false,
        price: parseFloat(newSlotPrice) || 150,
      };

      setTimeSlots(prev =>
        [...prev, newSlot].sort((a, b) =>
          a.startTime.localeCompare(b.startTime),
        ),
      );
      setShowAddSlotModal(false);
      Alert.alert(
        t('common.success'),
        t('venues.slotAdded') || 'Time slot added',
      );
    } catch (error) {
      console.error('Error adding slot:', error);
      // For development - still add to local state
      const dateStr = getLocalDateString(selectedDate);
      const newSlot: TimeSlot = {
        _id: `slot-${dateStr}-${newSlotStartTime}-${Date.now()}`,
        startTime: newSlotStartTime,
        endTime: newSlotEndTime,
        date: dateStr,
        isBooked: false,
        price: parseFloat(newSlotPrice) || 150,
      };
      setTimeSlots(prev =>
        [...prev, newSlot].sort((a, b) =>
          a.startTime.localeCompare(b.startTime),
        ),
      );
      setShowAddSlotModal(false);
      Alert.alert(
        t('common.success'),
        t('venues.slotAdded') || 'Time slot added',
      );
    } finally {
      setSavingSlot(false);
    }
  };

  // Save edited slot
  const saveEditedSlot = async () => {
    if (!editingSlot) return;

    if (newSlotStartTime >= newSlotEndTime) {
      Alert.alert(
        t('common.error'),
        t('venues.invalidTimeRange') || 'End time must be after start time',
      );
      return;
    }

    // Check for overlapping slots (excluding the current slot being edited)
    const hasOverlap = timeSlots.some(slot => {
      if (slot._id === editingSlot._id) return false;
      return (
        (newSlotStartTime >= slot.startTime &&
          newSlotStartTime < slot.endTime) ||
        (newSlotEndTime > slot.startTime && newSlotEndTime <= slot.endTime) ||
        (newSlotStartTime <= slot.startTime && newSlotEndTime >= slot.endTime)
      );
    });

    if (hasOverlap) {
      Alert.alert(
        t('common.error'),
        t('venues.slotOverlap') ||
          'This time slot overlaps with an existing slot',
      );
      return;
    }

    setSavingSlot(true);
    try {
      const token = await AsyncStorage.getItem('userToken');

      await axios.put(
        `${API_BASE_URL}/api/venues/${venueId}/spaces/${spaceId}/timeslots/${editingSlot._id}`,
        {
          startTime: newSlotStartTime,
          endTime: newSlotEndTime,
          price: parseFloat(newSlotPrice) || 150,
        },
        {headers: {Authorization: `Bearer ${token}`}},
      );

      // Update local state
      setTimeSlots(prev =>
        prev
          .map(slot =>
            slot._id === editingSlot._id
              ? {
                  ...slot,
                  startTime: newSlotStartTime,
                  endTime: newSlotEndTime,
                  price: parseFloat(newSlotPrice) || 150,
                }
              : slot,
          )
          .sort((a, b) => a.startTime.localeCompare(b.startTime)),
      );

      setShowEditSlotModal(false);
      setEditingSlot(null);
      Alert.alert(
        t('common.success'),
        t('venues.slotUpdated') || 'Time slot updated',
      );
    } catch (error) {
      console.error('Error updating slot:', error);
      // For development - still update local state
      setTimeSlots(prev =>
        prev
          .map(slot =>
            slot._id === editingSlot._id
              ? {
                  ...slot,
                  startTime: newSlotStartTime,
                  endTime: newSlotEndTime,
                  price: parseFloat(newSlotPrice) || 150,
                }
              : slot,
          )
          .sort((a, b) => a.startTime.localeCompare(b.startTime)),
      );
      setShowEditSlotModal(false);
      setEditingSlot(null);
      Alert.alert(
        t('common.success'),
        t('venues.slotUpdated') || 'Time slot updated',
      );
    } finally {
      setSavingSlot(false);
    }
  };

  // Render time slot card
  const renderSlotCard = ({item}: {item: TimeSlot}) => {
    // Check if this is the current user's booking
    const isMyBooking = isCurrentUserBooking(item);
    const isExpanded = expandedSlotId === item._id;

    // Determine card style based on booking status
    const getCardStyle = () => {
      if (!item.isBooked) return themedStyles.slotCardAvailable;
      if (isMyBooking) return themedStyles.slotCardMyBooking;
      return themedStyles.slotCardOtherBooking;
    };

    // Get status color
    const getStatusColor = () => {
      if (!item.isBooked) return COLORS.available;
      if (isMyBooking) return COLORS.myBooking;
      return COLORS.otherBooking;
    };

    // Get status text
    const getStatusText = () => {
      if (!item.isBooked) return t('venues.available');
      if (isMyBooking) return t('venues.yourBooking');
      return t('venues.booked');
    };

    // Toggle expanded state
    const toggleExpanded = () => {
      setExpandedSlotId(isExpanded ? null : item._id);
    };

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={toggleExpanded}
        style={[
          themedStyles.slotCard,
          getCardStyle(),
          isExpanded && themedStyles.slotCardExpanded,
        ]}>
        <View style={{flex: 1}}>
          {/* Main row - always visible */}
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <View style={themedStyles.slotTime}>
              <Text style={themedStyles.slotTimeText}>
                {formatTime(item.startTime)}
              </Text>
              <Text style={themedStyles.slotTimeRange}>
                to {formatTime(item.endTime)}
              </Text>
            </View>

            <View style={themedStyles.slotInfo}>
              <View style={themedStyles.slotStatus}>
                <View
                  style={[
                    themedStyles.slotStatusDot,
                    {backgroundColor: getStatusColor()},
                  ]}
                />
                <Text
                  style={[
                    themedStyles.slotStatusText,
                    {color: getStatusColor()},
                  ]}>
                  {getStatusText()}
                </Text>
              </View>
              {item.isBooked && item.eventName && (
                <Text style={themedStyles.slotBookedBy} numberOfLines={1}>
                  {item.eventName}
                </Text>
              )}
            </View>

            {/* Chevron indicator */}
            <View style={themedStyles.slotChevron}>
              <FontAwesomeIcon
                icon={faChevronDown}
                size={14}
                color={colors.secondaryText}
                style={{
                  transform: [{rotate: isExpanded ? '180deg' : '0deg'}],
                }}
              />
            </View>
          </View>

          {/* Expanded actions - only visible when tapped */}
          {isExpanded && (
            <View style={themedStyles.slotExpandedActions}>
              {!item.isBooked ? (
                <>
                  <TouchableOpacity
                    style={[
                      themedStyles.slotActionButton,
                      themedStyles.slotActionButtonPrimary,
                    ]}
                    onPress={() => handleBookSlot(item)}>
                    <Text
                      style={[
                        themedStyles.slotActionButtonText,
                        themedStyles.slotActionButtonTextPrimary,
                      ]}>
                      {t('venues.book')}
                    </Text>
                  </TouchableOpacity>
                  {/* Admin slot actions - only when admin mode is on */}
                  {isAdmin && adminModeEnabled && (
                    <>
                      <TouchableOpacity
                        style={[
                          themedStyles.slotActionButton,
                          themedStyles.slotActionButtonSecondary,
                        ]}
                        onPress={() => handleEditSlot(item)}>
                        <FontAwesomeIcon
                          icon={faEdit}
                          size={12}
                          color={colors.primary}
                        />
                        <Text
                          style={[
                            themedStyles.slotActionButtonText,
                            themedStyles.slotActionButtonTextSecondary,
                          ]}>
                          {t('venues.editSlot') || 'Edit Slot'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          themedStyles.slotActionButton,
                          themedStyles.slotActionButtonDanger,
                        ]}
                        onPress={() => handleDeleteSlot(item)}>
                        <FontAwesomeIcon
                          icon={faTrash}
                          size={12}
                          color={colors.error || '#F44336'}
                        />
                        <Text
                          style={[
                            themedStyles.slotActionButtonText,
                            themedStyles.slotActionButtonTextDanger,
                          ]}>
                          {t('common.delete') || 'Delete'}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </>
              ) : isMyBooking ? (
                <>
                  <TouchableOpacity
                    style={[
                      themedStyles.slotActionButton,
                      themedStyles.slotActionButtonSecondary,
                    ]}
                    onPress={() => handleEditMyBooking(item)}>
                    <FontAwesomeIcon
                      icon={faEdit}
                      size={12}
                      color={colors.primary}
                    />
                    <Text
                      style={[
                        themedStyles.slotActionButtonText,
                        themedStyles.slotActionButtonTextSecondary,
                      ]}>
                      {t('venues.editBooking') || 'Edit'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      themedStyles.slotActionButton,
                      themedStyles.slotActionButtonDanger,
                    ]}
                    onPress={() => handleCancelMyBooking(item)}>
                    <FontAwesomeIcon
                      icon={faTrash}
                      size={12}
                      color={colors.error || '#F44336'}
                    />
                    <Text
                      style={[
                        themedStyles.slotActionButtonText,
                        themedStyles.slotActionButtonTextDanger,
                      ]}>
                      {t('venues.cancelBooking') || 'Cancel'}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[
                    themedStyles.slotActionButton,
                    themedStyles.slotActionButtonSecondary,
                  ]}
                  onPress={() => handleInquireSlot(item)}>
                  <Text
                    style={[
                      themedStyles.slotActionButtonText,
                      themedStyles.slotActionButtonTextSecondary,
                    ]}>
                    {t('venues.inquire')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Render booking modal
  const renderBookingModal = () => {
    const isEditing =
      selectedSlot?.isBooked && selectedSlot?.bookedBy === userData?._id;

    // Calculate the end date for recurring bookings
    const getRecurringEndDate = () => {
      if (!selectedSlot) return '';
      const startDate = parseDateString(selectedSlot.date);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + (recurringWeeks - 1) * 7);
      return formatDate(endDate);
    };

    // Get button text for booking
    const getBookButtonText = () => {
      if (isEditing) {
        return t('venues.updateBooking') || 'Update Booking';
      }
      if (!isRecurring) {
        return t('venues.confirmBooking');
      }
      return (
        t('venues.confirmRecurringBooking') || 'Book {{weeks}} Weeks'
      ).replace('{{weeks}}', String(recurringWeeks));
    };

    return (
      <Modal
        visible={showBookingModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBookingModal(false)}>
        <TouchableOpacity
          style={themedStyles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowBookingModal(false)}>
          <TouchableOpacity
            activeOpacity={1}
            style={themedStyles.modalContent}
            onPress={e => e.stopPropagation()}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={themedStyles.modalTitle}>
                {isEditing
                  ? t('venues.editBooking') || 'Edit Booking'
                  : t('venues.bookSlot')}
              </Text>
              <Text style={themedStyles.modalSubtitle}>
                {spaceName} @{' '}
                {selectedSlot
                  ? formatDateString(selectedSlot.date)
                  : formatDate(selectedDate)}
              </Text>

              {selectedSlot && (
                <View style={themedStyles.modalSlotInfo}>
                  <Text style={themedStyles.modalSlotTime}>
                    {formatTime(selectedSlot.startTime)} -{' '}
                    {formatTime(selectedSlot.endTime)}
                  </Text>
                </View>
              )}

              <Text style={themedStyles.inputLabel}>
                {t('venues.eventName')}
              </Text>
              <TextInput
                style={themedStyles.input}
                placeholder={t('venues.eventNamePlaceholder')}
                placeholderTextColor={colors.secondaryText}
                value={bookingEventName}
                onChangeText={setBookingEventName}
              />

              <Text style={themedStyles.inputLabel}>{t('venues.notes')}</Text>
              <TextInput
                style={[themedStyles.input, themedStyles.textArea]}
                placeholder={t('venues.notesPlaceholder')}
                placeholderTextColor={colors.secondaryText}
                multiline
                numberOfLines={3}
                value={bookingNotes}
                onChangeText={setBookingNotes}
              />

              {/* Recurring Booking Option - only show for new bookings */}
              {!isEditing && (
                <View style={themedStyles.recurringContainer}>
                  <View style={themedStyles.recurringToggle}>
                    <View style={themedStyles.recurringToggleLeft}>
                      <FontAwesomeIcon
                        icon={faRepeat}
                        size={16}
                        color={
                          isRecurring ? colors.primary : colors.secondaryText
                        }
                      />
                      <Text style={themedStyles.recurringToggleText}>
                        {t('venues.repeatWeekly') || 'Repeat Weekly'}
                      </Text>
                    </View>
                    <Switch
                      value={isRecurring}
                      onValueChange={setIsRecurring}
                      trackColor={{
                        false: colors.border,
                        true: colors.primary + '50',
                      }}
                      thumbColor={
                        isRecurring ? colors.primary : colors.secondaryText
                      }
                      style={themedStyles.recurringSwitch}
                    />
                  </View>
                  <Text style={themedStyles.recurringToggleSubtext}>
                    {t('venues.repeatWeeklyDesc') ||
                      'Book the same time slot every week'}
                  </Text>

                  {isRecurring && (
                    <View style={themedStyles.recurringOptions}>
                      <Text style={themedStyles.recurringOptionsLabel}>
                        {t('venues.duration') || 'Duration'}
                      </Text>
                      <View style={themedStyles.recurringOptionsRow}>
                        {recurringOptions.map(weeks => (
                          <TouchableOpacity
                            key={weeks}
                            style={[
                              themedStyles.recurringOptionButton,
                              recurringWeeks === weeks &&
                                themedStyles.recurringOptionButtonActive,
                            ]}
                            onPress={() => setRecurringWeeks(weeks)}>
                            <Text
                              style={[
                                themedStyles.recurringOptionText,
                                recurringWeeks === weeks &&
                                  themedStyles.recurringOptionTextActive,
                              ]}>
                              {weeks}w
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <View style={themedStyles.recurringSummary}>
                        <Text style={themedStyles.recurringSummaryText}>
                          📅 {t('venues.bookingUntil') || 'Booking every'}{' '}
                          {selectedSlot
                            ? parseDateString(
                                selectedSlot.date,
                              ).toLocaleDateString('en-US', {weekday: 'long'})
                            : ''}{' '}
                          {t('venues.until') || 'until'} {getRecurringEndDate()}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              )}

              <TouchableOpacity
                style={themedStyles.submitButton}
                onPress={submitBooking}
                disabled={booking}>
                {booking ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={themedStyles.submitButtonText}>
                    {getBookButtonText()}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={themedStyles.cancelButton}
                onPress={() => {
                  setShowBookingModal(false);
                  setIsRecurring(false);
                  setRecurringWeeks(4);
                  setBookingEventName('');
                  setBookingNotes('');
                }}>
                <Text style={themedStyles.cancelButtonText}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  };

  // Render slot detail modal (for week view - read only)
  const renderSlotDetailModal = () => (
    <Modal
      visible={showSlotDetailModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowSlotDetailModal(false)}>
      <TouchableOpacity
        style={themedStyles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowSlotDetailModal(false)}>
        <TouchableOpacity
          activeOpacity={1}
          style={themedStyles.modalContent}
          onPress={e => e.stopPropagation()}>
          <Text style={themedStyles.modalTitle}>
            {viewingSlot?.isBooked
              ? t('venues.slotDetails') || 'Slot Details'
              : t('venues.availableSlot') || 'Available Slot'}
          </Text>
          <Text style={themedStyles.modalSubtitle}>
            {spaceName} @{' '}
            {viewingSlot ? formatDateString(viewingSlot.date) : ''}
          </Text>

          {viewingSlot && (
            <View style={themedStyles.modalSlotInfo}>
              <Text style={themedStyles.modalSlotTime}>
                {formatTime(viewingSlot.startTime)} -{' '}
                {formatTime(viewingSlot.endTime)}
              </Text>
              {viewingSlot.isBooked ? (
                <>
                  {viewingSlot.eventName && (
                    <Text
                      style={[
                        themedStyles.modalSlotDate,
                        {marginTop: 8, fontWeight: '600'},
                      ]}>
                      {viewingSlot.eventName}
                    </Text>
                  )}
                  {viewingSlot.bookedByUsername && (
                    <Text style={themedStyles.modalSlotDate}>
                      {t('venues.bookedBy') || 'Booked by'}{' '}
                      {viewingSlot.bookedByUsername}
                    </Text>
                  )}
                </>
              ) : null}
            </View>
          )}

          {viewingSlot && !viewingSlot.isBooked && (
            <Text
              style={{
                color: colors.secondaryText,
                textAlign: 'center',
                marginBottom: 16,
                fontSize: 14,
              }}>
              {t('venues.switchToDayView') ||
                'Switch to Day view to book this slot'}
            </Text>
          )}

          <TouchableOpacity
            style={themedStyles.cancelButton}
            onPress={() => setShowSlotDetailModal(false)}>
            <Text style={themedStyles.cancelButtonText}>
              {t('common.close') || 'Close'}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

  // Render inquiry modal
  const renderInquiryModal = () => (
    <Modal
      visible={showInquiryModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowInquiryModal(false)}>
      <TouchableOpacity
        style={themedStyles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowInquiryModal(false)}>
        <TouchableOpacity
          activeOpacity={1}
          style={themedStyles.modalContent}
          onPress={e => e.stopPropagation()}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={themedStyles.modalTitle}>
              {t('venues.inquireSlot')}
            </Text>
            <Text style={themedStyles.modalSubtitle}>
              {t('venues.inquireDescription')}
            </Text>

            {selectedSlot && (
              <View style={themedStyles.modalSlotInfo}>
                <Text style={themedStyles.modalSlotTime}>
                  {formatTime(selectedSlot.startTime)} -{' '}
                  {formatTime(selectedSlot.endTime)}
                </Text>
                <Text style={themedStyles.modalSlotDate}>
                  {formatDate(selectedDate)}
                </Text>
                {selectedSlot.bookedByUsername && (
                  <Text style={themedStyles.modalSlotDate}>
                    {t('venues.bookedBy')} {selectedSlot.bookedByUsername}
                  </Text>
                )}
              </View>
            )}

            <Text style={themedStyles.inputLabel}>
              {t('venues.yourMessage')}
            </Text>
            <TextInput
              style={[themedStyles.input, themedStyles.textArea]}
              placeholder={t('venues.inquiryPlaceholder')}
              placeholderTextColor={colors.secondaryText}
              multiline
              numberOfLines={4}
              value={inquiryMessage}
              onChangeText={setInquiryMessage}
            />

            <TouchableOpacity
              style={themedStyles.submitButton}
              onPress={submitInquiry}
              disabled={sendingInquiry}>
              {sendingInquiry ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={themedStyles.submitButtonText}>
                  {t('venues.sendInquiry')}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={themedStyles.cancelButton}
              onPress={() => setShowInquiryModal(false)}>
              <Text style={themedStyles.cancelButtonText}>
                {t('common.cancel')}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

  // Render Add Slot Modal (Admin only)
  const renderAddSlotModal = () => (
    <Modal
      visible={showAddSlotModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowAddSlotModal(false)}>
      <TouchableOpacity
        style={themedStyles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowAddSlotModal(false)}>
        <TouchableOpacity
          activeOpacity={1}
          style={themedStyles.modalContent}
          onPress={e => e.stopPropagation()}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={themedStyles.modalTitle}>
              {t('venues.addTimeSlot') || 'Add Time Slot'}
            </Text>
            <Text style={themedStyles.modalSubtitle}>
              {formatDate(selectedDate)}
            </Text>

            <View style={themedStyles.timePickerContainer}>
              <Text style={themedStyles.inputLabel}>
                {t('venues.startTime') || 'Start Time'}
              </Text>
              <TouchableOpacity
                style={themedStyles.timePickerButton}
                onPress={() => setShowStartTimePicker(!showStartTimePicker)}>
                <Text style={themedStyles.timePickerButtonText}>
                  {formatTime(newSlotStartTime)}
                </Text>
              </TouchableOpacity>
              {showStartTimePicker && (
                <ScrollView
                  style={themedStyles.timeOptionsContainer}
                  nestedScrollEnabled>
                  {timeOptions.map(time => (
                    <TouchableOpacity
                      key={`start-${time}`}
                      style={[
                        themedStyles.timeOption,
                        time === newSlotStartTime &&
                          themedStyles.timeOptionSelected,
                      ]}
                      onPress={() => {
                        setNewSlotStartTime(time);
                        setShowStartTimePicker(false);
                      }}>
                      <Text style={themedStyles.timeOptionText}>
                        {formatTime(time)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            <View style={themedStyles.timePickerContainer}>
              <Text style={themedStyles.inputLabel}>
                {t('venues.endTime') || 'End Time'}
              </Text>
              <TouchableOpacity
                style={themedStyles.timePickerButton}
                onPress={() => setShowEndTimePicker(!showEndTimePicker)}>
                <Text style={themedStyles.timePickerButtonText}>
                  {formatTime(newSlotEndTime)}
                </Text>
              </TouchableOpacity>
              {showEndTimePicker && (
                <ScrollView
                  style={themedStyles.timeOptionsContainer}
                  nestedScrollEnabled>
                  {timeOptions.map(time => (
                    <TouchableOpacity
                      key={`end-${time}`}
                      style={[
                        themedStyles.timeOption,
                        time === newSlotEndTime &&
                          themedStyles.timeOptionSelected,
                      ]}
                      onPress={() => {
                        setNewSlotEndTime(time);
                        setShowEndTimePicker(false);
                      }}>
                      <Text style={themedStyles.timeOptionText}>
                        {formatTime(time)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            <Text style={themedStyles.inputLabel}>
              {t('venues.price') || 'Price ($)'}
            </Text>
            <TextInput
              style={themedStyles.input}
              placeholder="150"
              placeholderTextColor={colors.secondaryText}
              value={newSlotPrice}
              onChangeText={setNewSlotPrice}
              keyboardType="numeric"
            />

            <TouchableOpacity
              style={themedStyles.submitButton}
              onPress={saveNewSlot}
              disabled={savingSlot}>
              {savingSlot ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={themedStyles.submitButtonText}>
                  {t('venues.addSlot') || 'Add Slot'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={themedStyles.cancelButton}
              onPress={() => setShowAddSlotModal(false)}>
              <Text style={themedStyles.cancelButtonText}>
                {t('common.cancel')}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

  // Render Edit Slot Modal (Admin only)
  const renderEditSlotModal = () => (
    <Modal
      visible={showEditSlotModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowEditSlotModal(false)}>
      <TouchableOpacity
        style={themedStyles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowEditSlotModal(false)}>
        <TouchableOpacity
          activeOpacity={1}
          style={themedStyles.modalContent}
          onPress={e => e.stopPropagation()}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={themedStyles.modalTitle}>
              {t('venues.editTimeSlot') || 'Edit Time Slot'}
            </Text>
            <Text style={themedStyles.modalSubtitle}>
              {formatDate(selectedDate)}
            </Text>

            <View style={themedStyles.timePickerContainer}>
              <Text style={themedStyles.inputLabel}>
                {t('venues.startTime') || 'Start Time'}
              </Text>
              <TouchableOpacity
                style={themedStyles.timePickerButton}
                onPress={() => setShowStartTimePicker(!showStartTimePicker)}>
                <Text style={themedStyles.timePickerButtonText}>
                  {formatTime(newSlotStartTime)}
                </Text>
              </TouchableOpacity>
              {showStartTimePicker && (
                <ScrollView
                  style={themedStyles.timeOptionsContainer}
                  nestedScrollEnabled>
                  {timeOptions.map(time => (
                    <TouchableOpacity
                      key={`edit-start-${time}`}
                      style={[
                        themedStyles.timeOption,
                        time === newSlotStartTime &&
                          themedStyles.timeOptionSelected,
                      ]}
                      onPress={() => {
                        setNewSlotStartTime(time);
                        setShowStartTimePicker(false);
                      }}>
                      <Text style={themedStyles.timeOptionText}>
                        {formatTime(time)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            <View style={themedStyles.timePickerContainer}>
              <Text style={themedStyles.inputLabel}>
                {t('venues.endTime') || 'End Time'}
              </Text>
              <TouchableOpacity
                style={themedStyles.timePickerButton}
                onPress={() => setShowEndTimePicker(!showEndTimePicker)}>
                <Text style={themedStyles.timePickerButtonText}>
                  {formatTime(newSlotEndTime)}
                </Text>
              </TouchableOpacity>
              {showEndTimePicker && (
                <ScrollView
                  style={themedStyles.timeOptionsContainer}
                  nestedScrollEnabled>
                  {timeOptions.map(time => (
                    <TouchableOpacity
                      key={`edit-end-${time}`}
                      style={[
                        themedStyles.timeOption,
                        time === newSlotEndTime &&
                          themedStyles.timeOptionSelected,
                      ]}
                      onPress={() => {
                        setNewSlotEndTime(time);
                        setShowEndTimePicker(false);
                      }}>
                      <Text style={themedStyles.timeOptionText}>
                        {formatTime(time)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            <Text style={themedStyles.inputLabel}>
              {t('venues.price') || 'Price ($)'}
            </Text>
            <TextInput
              style={themedStyles.input}
              placeholder="150"
              placeholderTextColor={colors.secondaryText}
              value={newSlotPrice}
              onChangeText={setNewSlotPrice}
              keyboardType="numeric"
            />

            <TouchableOpacity
              style={themedStyles.submitButton}
              onPress={saveEditedSlot}
              disabled={savingSlot}>
              {savingSlot ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={themedStyles.submitButtonText}>
                  {t('venues.saveChanges') || 'Save Changes'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={themedStyles.deleteButton}
              onPress={() => {
                if (editingSlot) {
                  setShowEditSlotModal(false);
                  handleDeleteSlot(editingSlot);
                }
              }}>
              <Text style={themedStyles.deleteButtonText}>
                {t('venues.deleteSlot') || 'Delete Slot'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={themedStyles.cancelButton}
              onPress={() => setShowEditSlotModal(false)}>
              <Text style={themedStyles.cancelButtonText}>
                {t('common.cancel')}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

  // Get unique hours across all days for week view
  const getWeekHours = useMemo(() => {
    const allHours = new Set<string>();
    weekSlots.forEach(slots => {
      slots.forEach(slot => {
        allHours.add(slot.startTime);
      });
    });
    // Also add hours from operating hours if available
    if (operatingHours) {
      const parts = operatingHours.split(' - ');
      if (parts.length === 2) {
        const startHour = parseTimeToHour(parts[0].trim(), true);
        const endHour = parseTimeToHour(parts[1].trim(), false);
        for (let h = startHour; h < endHour; h++) {
          allHours.add(`${h.toString().padStart(2, '0')}:00`);
        }
      }
    }
    return Array.from(allHours).sort();
  }, [weekSlots, operatingHours]);

  // Render week view
  const renderWeekView = () => {
    const weekDates = getWeekDates(selectedDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isDateToday = (date: Date) => {
      return (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
      );
    };

    const isDatePast = (date: Date) => {
      const dateOnly = new Date(date);
      dateOnly.setHours(0, 0, 0, 0);
      return dateOnly < today;
    };

    const getSlotForDateTime = (date: Date, hour: string): TimeSlot | null => {
      const dateStr = getLocalDateString(date);
      const slots = weekSlots.get(dateStr) || [];
      return slots.find(s => s.startTime === hour) || null;
    };

    return (
      <ScrollView
        style={themedStyles.weekContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }>
        {/* Week Header */}
        <View style={themedStyles.weekHeader}>
          <View style={themedStyles.weekHeaderTime}>
            <Text style={themedStyles.weekHeaderDayText}>
              {t('venues.time') || 'Time'}
            </Text>
          </View>
          {weekDates.map((date, idx) => {
            const isToday = isDateToday(date);
            const isPast = isDatePast(date);
            return (
              <View
                key={idx}
                style={[
                  themedStyles.weekHeaderDay,
                  isToday && themedStyles.weekHeaderToday,
                  isPast && {opacity: 0.5},
                ]}>
                <Text
                  style={[
                    themedStyles.weekHeaderDayText,
                    isToday && themedStyles.weekHeaderTodayText,
                  ]}>
                  {date.toLocaleDateString('en-US', {weekday: 'short'})}
                </Text>
                <Text
                  style={[
                    themedStyles.weekHeaderDateText,
                    isToday && themedStyles.weekHeaderTodayText,
                  ]}>
                  {date.getDate()}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Week Grid */}
        <View style={themedStyles.weekGrid}>
          {/* Time Column */}
          <View style={themedStyles.weekTimeColumn}>
            {getWeekHours.map(hour => (
              <View key={hour} style={themedStyles.weekTimeCell}>
                <Text style={themedStyles.weekTimeCellText}>
                  {formatTime(hour)}
                </Text>
              </View>
            ))}
          </View>

          {/* Day Columns */}
          {weekDates.map((date, dateIdx) => {
            const isToday = isDateToday(date);
            const isPast = isDatePast(date);
            return (
              <View
                key={dateIdx}
                style={[
                  themedStyles.weekDayColumn,
                  isToday && themedStyles.weekDayColumnToday,
                ]}>
                {getWeekHours.map(hour => {
                  const slot = getSlotForDateTime(date, hour);
                  const isBooked = slot?.isBooked === true;
                  const isMyBooking = slot ? isCurrentUserBooking(slot) : false;

                  // Determine cell style
                  const getCellStyle = () => {
                    if (isPast) return themedStyles.weekSlotPast;
                    if (!isBooked) return themedStyles.weekSlotAvailable;
                    if (isMyBooking) return themedStyles.weekSlotMyBooking;
                    return themedStyles.weekSlotBooked;
                  };

                  return (
                    <TouchableOpacity
                      key={`${dateIdx}-${hour}`}
                      style={[themedStyles.weekSlotCell, getCellStyle()]}
                      onPress={() => {
                        // Week view is read-only: show slot details
                        const dateStr = getLocalDateString(date);
                        const slotToView = slot || {
                          _id: `view-${dateStr}-${hour}`,
                          startTime: hour,
                          endTime: `${(parseInt(hour.split(':')[0]) + 1)
                            .toString()
                            .padStart(2, '0')}:00`,
                          date: dateStr,
                          isBooked: false,
                          price: 150,
                        };
                        setViewingSlot(slotToView);
                        setShowSlotDetailModal(true);
                      }}>
                      {isPast ? (
                        <Text
                          style={[
                            themedStyles.weekSlotText,
                            {color: colors.secondaryText},
                          ]}>
                          —
                        </Text>
                      ) : isBooked ? (
                        <Text
                          style={[
                            themedStyles.weekSlotText,
                            isMyBooking
                              ? themedStyles.weekSlotTextMyBooking
                              : themedStyles.weekSlotTextBooked,
                          ]}
                          numberOfLines={1}>
                          {isMyBooking
                            ? '★'
                            : slot?.eventName?.substring(0, 6) || 'Booked'}
                        </Text>
                      ) : (
                        <Text
                          style={[
                            themedStyles.weekSlotText,
                            themedStyles.weekSlotTextAvailable,
                          ]}>
                          –
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  // Format week range for display
  const getWeekRangeText = () => {
    const weekDates = getWeekDates(selectedDate);
    const startDate = weekDates[0];
    const endDate = weekDates[6];
    const startMonth = startDate.toLocaleDateString('en-US', {month: 'short'});
    const endMonth = endDate.toLocaleDateString('en-US', {month: 'short'});

    if (startMonth === endMonth) {
      return `${startMonth} ${startDate.getDate()} - ${endDate.getDate()}`;
    }
    return `${startMonth} ${startDate.getDate()} - ${endMonth} ${endDate.getDate()}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={themedStyles.container}>
        <View style={themedStyles.header}>
          <TouchableOpacity
            style={themedStyles.backButton}
            onPress={() => navigation.goBack()}>
            <FontAwesomeIcon icon={faArrowLeft} size={20} color={colors.text} />
          </TouchableOpacity>
          <View style={themedStyles.headerContent}>
            <Text style={themedStyles.headerTitle}>{spaceName}</Text>
          </View>
        </View>
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={themedStyles.loadingIndicator}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={themedStyles.container}>
      {/* Header */}
      <View style={themedStyles.header}>
        <TouchableOpacity
          style={themedStyles.backButton}
          onPress={() => navigation.goBack()}>
          <FontAwesomeIcon icon={faArrowLeft} size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={themedStyles.headerContent}>
          <Text style={themedStyles.headerTitle}>
            {spaceEmoji} {spaceName}
          </Text>
          <Text style={themedStyles.headerSubtitle}>
            {t('venues.selectTimeSlot')}
          </Text>
        </View>
      </View>

      {/* View Mode Toggle */}
      <View style={themedStyles.viewModeContainer}>
        <TouchableOpacity
          style={[
            themedStyles.viewModeButton,
            viewMode === 'day' && themedStyles.viewModeButtonActive,
          ]}
          onPress={() => setViewMode('day')}>
          <FontAwesomeIcon
            icon={faCalendarDay}
            size={14}
            color={viewMode === 'day' ? '#FFFFFF' : colors.secondaryText}
          />
          <Text
            style={[
              themedStyles.viewModeButtonText,
              viewMode === 'day' && themedStyles.viewModeButtonTextActive,
            ]}>
            {t('venues.dayView') || 'Day'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            themedStyles.viewModeButton,
            viewMode === 'week' && themedStyles.viewModeButtonActive,
          ]}
          onPress={() => setViewMode('week')}>
          <FontAwesomeIcon
            icon={faCalendarWeek}
            size={14}
            color={viewMode === 'week' ? '#FFFFFF' : colors.secondaryText}
          />
          <Text
            style={[
              themedStyles.viewModeButtonText,
              viewMode === 'week' && themedStyles.viewModeButtonTextActive,
            ]}>
            {t('venues.weekView') || 'Week'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Date/Week Selector */}
      <View style={themedStyles.dateSelector}>
        <TouchableOpacity
          style={themedStyles.dateNavButton}
          onPress={goToPreviousDay}>
          <FontAwesomeIcon icon={faChevronLeft} size={18} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={themedStyles.dateDisplay}
          onPress={() => setShowDatePicker(true)}>
          <Text style={themedStyles.dateText}>
            {viewMode === 'week'
              ? getWeekRangeText()
              : formatDate(selectedDate)}
          </Text>
          <Text style={themedStyles.dateSubtext}>
            {selectedDate.getFullYear()}
          </Text>
          {viewMode === 'day' && isToday() && (
            <View style={themedStyles.todayBadge}>
              <Text style={themedStyles.todayText}>{t('venues.today')}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={themedStyles.dateNavButton}
          onPress={goToNextDay}>
          <FontAwesomeIcon
            icon={faChevronRight}
            size={18}
            color={colors.text}
          />
        </TouchableOpacity>
      </View>

      {/* Date Picker (Android) */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          minimumDate={new Date()}
          maximumDate={new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)}
        />
      )}

      {/* Filter Bar with Stats - Day View Only */}
      {viewMode === 'day' && (
        <View style={themedStyles.filterBar}>
          <TouchableOpacity
            style={[
              themedStyles.filterButton,
              showMyBookingsOnly && themedStyles.filterButtonActive,
            ]}
            onPress={() => setShowMyBookingsOnly(!showMyBookingsOnly)}>
            <FontAwesomeIcon
              icon={faStar}
              size={12}
              color={showMyBookingsOnly ? '#2196F3' : colors.secondaryText}
            />
            <Text
              style={[
                themedStyles.filterButtonText,
                showMyBookingsOnly && themedStyles.filterButtonTextActive,
              ]}>
              {t('venues.myBookingsOnly') || 'My Bookings'}
            </Text>
          </TouchableOpacity>

          <View style={themedStyles.statsContainer}>
            <View style={themedStyles.statItem}>
              <View
                style={[
                  themedStyles.statDot,
                  {backgroundColor: COLORS.available},
                ]}
              />
              <Text style={themedStyles.statText}>
                {timeSlots.filter(s => !s.isBooked).length}
              </Text>
            </View>
            <View style={themedStyles.statItem}>
              <View
                style={[
                  themedStyles.statDot,
                  {backgroundColor: COLORS.myBooking},
                ]}
              />
              <Text style={themedStyles.statText}>
                {timeSlots.filter(s => isCurrentUserBooking(s)).length}
              </Text>
            </View>
            <View style={themedStyles.statItem}>
              <View
                style={[
                  themedStyles.statDot,
                  {backgroundColor: COLORS.otherBooking},
                ]}
              />
              <Text style={themedStyles.statText}>
                {
                  timeSlots.filter(s => s.isBooked && !isCurrentUserBooking(s))
                    .length
                }
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Content: Day View or Week View */}
      {viewMode === 'week' ? (
        renderWeekView()
      ) : (
        <FlatList
          data={
            showMyBookingsOnly
              ? timeSlots.filter(s => isCurrentUserBooking(s))
              : timeSlots
          }
          keyExtractor={item => item._id}
          renderItem={renderSlotCard}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={themedStyles.emptyContainer}>
              <FontAwesomeIcon
                icon={showMyBookingsOnly ? faStar : faClock}
                size={48}
                color={colors.secondaryText}
              />
              <Text style={themedStyles.emptyText}>
                {showMyBookingsOnly
                  ? t('venues.noMyBookings') || 'No bookings for this day'
                  : t('venues.noSlots')}
              </Text>
            </View>
          }
          contentContainerStyle={themedStyles.slotsListContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Legend */}
      <View style={themedStyles.legendContainer}>
        <View style={themedStyles.legendItem}>
          <View
            style={[themedStyles.legendDot, themedStyles.slotStatusAvailable]}
          />
          <Text style={themedStyles.legendText}>{t('venues.available')}</Text>
        </View>
        <View style={themedStyles.legendItem}>
          <View
            style={[themedStyles.legendDot, themedStyles.legendMyBooking]}
          />
          <Text style={themedStyles.legendText}>{t('venues.yourBooking')}</Text>
        </View>
        <View style={themedStyles.legendItem}>
          <View
            style={[themedStyles.legendDot, themedStyles.legendOtherBooking]}
          />
          <Text style={themedStyles.legendText}>{t('venues.booked')}</Text>
        </View>
      </View>

      {/* Admin Mode Toggle */}
      {isAdmin && (
        <View style={themedStyles.adminModeContainer}>
          <TouchableOpacity
            style={[
              themedStyles.adminModeToggle,
              adminModeEnabled && themedStyles.adminModeToggleActive,
            ]}
            onPress={() => setAdminModeEnabled(!adminModeEnabled)}>
            <FontAwesomeIcon
              icon={faGear}
              size={14}
              color={adminModeEnabled ? colors.primary : colors.secondaryText}
            />
            <Text
              style={[
                themedStyles.adminModeText,
                adminModeEnabled && themedStyles.adminModeTextActive,
              ]}>
              {t('venues.adminMode') || 'Admin Mode'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Admin: Add Slot Button - only visible when admin mode is enabled */}
      {isAdmin && adminModeEnabled && (
        <TouchableOpacity
          style={themedStyles.addSlotButton}
          onPress={handleAddSlot}>
          <FontAwesomeIcon icon={faPlus} size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Modals */}
      {renderBookingModal()}
      {renderInquiryModal()}
      {renderSlotDetailModal()}
      {isAdmin && renderAddSlotModal()}
      {isAdmin && renderEditSlotModal()}
    </SafeAreaView>
  );
};

export default SpaceDetail;
