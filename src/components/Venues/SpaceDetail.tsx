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

// Helper function to format time
const formatTime = (time: string): string => {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

// Generate time slots for a day (empty slots - real bookings come from backend)
const generateDefaultTimeSlots = (date: Date): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  const dateStr = date.toISOString().split('T')[0];

  // Generate slots from 6 AM to 10 PM - all available by default
  for (let hour = 6; hour < 22; hour++) {
    slots.push({
      _id: `slot-${dateStr}-${hour}`,
      startTime: `${hour.toString().padStart(2, '0')}:00`,
      endTime: `${(hour + 1).toString().padStart(2, '0')}:00`,
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
  const {userData} = useContext(UserContext) as UserContextType;
  const {colors} = useTheme();
  const {t} = useTranslation();

  const {venueId, spaceId, spaceName, venueType} = route.params;
  const spaceEmoji = venueTypeEmojis[venueType] || '🏟️';

  // State
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Booking modal state
  const [showBookingModal, setShowBookingModal] = useState<boolean>(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [bookingEventName, setBookingEventName] = useState<string>('');
  const [bookingNotes, setBookingNotes] = useState<string>('');
  const [booking, setBooking] = useState<boolean>(false);

  // Inquiry modal state
  const [showInquiryModal, setShowInquiryModal] = useState<boolean>(false);
  const [inquiryMessage, setInquiryMessage] = useState<string>('');
  const [sendingInquiry, setSendingInquiry] = useState<boolean>(false);

  // Date picker (Android)
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

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
          borderWidth: 1,
          borderColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
        },
        slotCardBooked: {
          opacity: 0.7,
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
          backgroundColor: colors.secondaryText + '30',
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 8,
        },
        inquireButtonText: {
          color: colors.text,
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
          padding: 12,
          backgroundColor: colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        legendItem: {
          flexDirection: 'row',
          alignItems: 'center',
          marginHorizontal: 16,
        },
        legendDot: {
          width: 10,
          height: 10,
          borderRadius: 5,
          marginRight: 6,
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
      }),
    [colors],
  );

  // Fetch time slots for the selected date
  const fetchTimeSlots = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const dateStr = selectedDate.toISOString().split('T')[0];
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
        isBooked: !slot.available,
        bookedBy: slot.bookedBy,
        bookedByUsername: slot.bookedByUsername,
        eventName: slot.eventName,
        price: slot.price,
      }));
      setTimeSlots(transformedSlots);
    } catch (error) {
      console.error('Error fetching time slots:', error);
      // Generate mock data for development
      setTimeSlots(generateDefaultTimeSlots(selectedDate));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [venueId, spaceId, selectedDate]);

  useEffect(() => {
    setLoading(true);
    fetchTimeSlots();
  }, [fetchTimeSlots]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchTimeSlots();
  }, [fetchTimeSlots]);

  // Navigate to previous day
  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);

    // Don't go before today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (newDate >= today) {
      setSelectedDate(newDate);
    }
  };

  // Navigate to next day
  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);

    // Don't go more than 30 days in advance
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
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

  // Submit booking
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

    setBooking(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
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

      // Refresh time slots to get updated data from server
      fetchTimeSlots();

      setShowBookingModal(false);
      setSelectedSlot(null);
      setBookingEventName('');
      setBookingNotes('');
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

  // Render time slot card
  const renderSlotCard = ({item}: {item: TimeSlot}) => {
    const isMyBooking = item.bookedBy === userData?._id;

    return (
      <View
        style={[
          themedStyles.slotCard,
          item.isBooked && themedStyles.slotCardBooked,
        ]}>
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
                item.isBooked
                  ? themedStyles.slotStatusBooked
                  : themedStyles.slotStatusAvailable,
              ]}
            />
            <Text
              style={[
                themedStyles.slotStatusText,
                item.isBooked
                  ? themedStyles.slotStatusTextBooked
                  : themedStyles.slotStatusTextAvailable,
              ]}>
              {item.isBooked ? t('venues.booked') : t('venues.available')}
            </Text>
          </View>
          {item.isBooked && (
            <Text style={themedStyles.slotBookedBy}>
              {isMyBooking
                ? t('venues.yourBooking')
                : item.eventName ||
                  `${t('venues.bookedBy')} ${item.bookedByUsername}`}
            </Text>
          )}
        </View>

        {item.price && !item.isBooked && (
          <Text style={themedStyles.slotPrice}>${item.price}</Text>
        )}

        <View style={themedStyles.slotActions}>
          {!item.isBooked ? (
            <TouchableOpacity
              style={themedStyles.bookButton}
              onPress={() => handleBookSlot(item)}>
              <Text style={themedStyles.bookButtonText}>
                {t('venues.book')}
              </Text>
            </TouchableOpacity>
          ) : !isMyBooking ? (
            <TouchableOpacity
              style={themedStyles.inquireButton}
              onPress={() => handleInquireSlot(item)}>
              <Text style={themedStyles.inquireButtonText}>
                {t('venues.inquire')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  // Render booking modal
  const renderBookingModal = () => (
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
            <Text style={themedStyles.modalTitle}>{t('venues.bookSlot')}</Text>
            <Text style={themedStyles.modalSubtitle}>
              {spaceName} @ {formatDate(selectedDate)}
            </Text>

            {selectedSlot && (
              <View style={themedStyles.modalSlotInfo}>
                <Text style={themedStyles.modalSlotTime}>
                  {formatTime(selectedSlot.startTime)} -{' '}
                  {formatTime(selectedSlot.endTime)}
                </Text>
                {selectedSlot.price && (
                  <Text style={themedStyles.modalSlotDate}>
                    ${selectedSlot.price}
                  </Text>
                )}
              </View>
            )}

            <Text style={themedStyles.inputLabel}>{t('venues.eventName')}</Text>
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

            <TouchableOpacity
              style={themedStyles.submitButton}
              onPress={submitBooking}
              disabled={booking}>
              {booking ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={themedStyles.submitButtonText}>
                  {t('venues.confirmBooking')}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={themedStyles.cancelButton}
              onPress={() => setShowBookingModal(false)}>
              <Text style={themedStyles.cancelButtonText}>
                {t('common.cancel')}
              </Text>
            </TouchableOpacity>
          </ScrollView>
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

      {/* Date Selector */}
      <View style={themedStyles.dateSelector}>
        <TouchableOpacity
          style={themedStyles.dateNavButton}
          onPress={goToPreviousDay}>
          <FontAwesomeIcon icon={faChevronLeft} size={18} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={themedStyles.dateDisplay}
          onPress={() => setShowDatePicker(true)}>
          <Text style={themedStyles.dateText}>{formatDate(selectedDate)}</Text>
          <Text style={themedStyles.dateSubtext}>
            {selectedDate.getFullYear()}
          </Text>
          {isToday() && (
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
          maximumDate={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)}
        />
      )}

      {/* Time Slots List */}
      <FlatList
        data={timeSlots}
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
              icon={faClock}
              size={48}
              color={colors.secondaryText}
            />
            <Text style={themedStyles.emptyText}>{t('venues.noSlots')}</Text>
          </View>
        }
        contentContainerStyle={themedStyles.slotsListContent}
        showsVerticalScrollIndicator={false}
      />

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
            style={[themedStyles.legendDot, themedStyles.slotStatusBooked]}
          />
          <Text style={themedStyles.legendText}>{t('venues.booked')}</Text>
        </View>
      </View>

      {/* Modals */}
      {renderBookingModal()}
      {renderInquiryModal()}
    </SafeAreaView>
  );
};

export default SpaceDetail;
