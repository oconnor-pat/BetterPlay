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
  TextInput,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {SafeAreaView} from 'react-native-safe-area-context';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faSearch,
  faTimes,
  faBuilding,
  faMapMarkerAlt,
  faClock,
  faPlus,
  faChevronDown,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';
import {useNavigation, NavigationProp} from '@react-navigation/native';
import {GooglePlacesAutocomplete} from 'react-native-google-places-autocomplete';
import HamburgerMenu from '../HamburgerMenu/HamburgerMenu';
import UserContext, {UserContextType} from '../UserContext';
import {useTheme} from '../ThemeContext/ThemeContext';
import axios from 'axios';
import Config from 'react-native-config';
import {API_BASE_URL} from '../../config/api';
import {useTranslation} from 'react-i18next';

// Google Places API key from environment variable
const GOOGLE_PLACES_API_KEY = Config.GOOGLE_PLACES_API_KEY || '';

export type VenueStackParamList = {
  VenueList: undefined;
  VenueDetail: {
    venueId: string;
    venueName: string;
    venueType: string;
    address: string;
    totalSpaces: number;
    operatingHours?: string;
  };
  SpaceDetail: {
    venueId: string;
    spaceId: string;
    spaceName: string;
    venueType: string;
    operatingHours?: string;
  };
};

// Venue types with emojis
const venueTypeOptions = [
  // Sports Facilities
  {label: 'Hockey Rink', emoji: '🏒', type: 'rink'},
  {label: 'Basketball Court', emoji: '🏀', type: 'court'},
  {label: 'Soccer Field', emoji: '⚽', type: 'field'},
  {label: 'Tennis Court', emoji: '🎾', type: 'court'},
  {label: 'Baseball Diamond', emoji: '⚾', type: 'diamond'},
  {label: 'Football Field', emoji: '🏈', type: 'field'},
  {label: 'Golf Course', emoji: '⛳', type: 'course'},
  {label: 'Volleyball Court', emoji: '🏐', type: 'court'},
  {label: 'Swimming Pool', emoji: '🏊', type: 'pool'},
  {label: 'Gym', emoji: '💪', type: 'gym'},
  // Bars & Restaurants
  {label: 'Bar', emoji: '🍺', type: 'bar'},
  {label: 'Brewery', emoji: '🍻', type: 'brewery'},
  {label: 'Restaurant', emoji: '🍽️', type: 'restaurant'},
  {label: 'Café', emoji: '☕', type: 'cafe'},
  // Entertainment
  {label: 'Bowling Alley', emoji: '🎳', type: 'bowling'},
  {label: 'Arcade', emoji: '🕹️', type: 'arcade'},
  {label: 'Theater', emoji: '🎭', type: 'theater'},
  {label: 'Music Venue', emoji: '🎵', type: 'music'},
  // Community
  {label: 'Community Center', emoji: '🏛️', type: 'community'},
  {label: 'Park', emoji: '🌳', type: 'park'},
  {label: 'Library', emoji: '📚', type: 'library'},
  {label: 'Co-Working Space', emoji: '💻', type: 'coworking'},
  // General
  {label: 'Multi-Purpose', emoji: '🏟️', type: 'multipurpose'},
  {label: 'Other', emoji: '📍', type: 'other'},
];

// Matches backend ISubVenue
interface SubVenue {
  id: string;
  name: string;
  type: string;
  capacity?: number;
}

// Matches backend IAddress
interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

// Matches backend ICoordinates
interface Coordinates {
  latitude: number;
  longitude: number;
}

// Matches backend IOperatingHours
interface OperatingHours {
  monday: {open: string; close: string} | null;
  tuesday: {open: string; close: string} | null;
  wednesday: {open: string; close: string} | null;
  thursday: {open: string; close: string} | null;
  friday: {open: string; close: string} | null;
  saturday: {open: string; close: string} | null;
  sunday: {open: string; close: string} | null;
}

// Matches backend IVenue
export interface Venue {
  _id: string;
  name: string;
  type: string;
  address: Address;
  coordinates: Coordinates;
  subVenues: SubVenue[];
  amenities: string[];
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  imageUrl?: string;
  operatingHours?: OperatingHours;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Helper to format address object as string
const formatAddress = (address: Address): string => {
  return `${address.city}, ${address.state}`;
};

// Helper to get today's operating hours
const getTodayHours = (hours?: OperatingHours): string | null => {
  if (!hours) return null;
  const days = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  const today = days[new Date().getDay()] as keyof OperatingHours;
  const todayHours = hours[today];
  if (!todayHours) return 'Closed';
  return `${todayHours.open} - ${todayHours.close}`;
};

const getVenueTypeEmoji = (venueType: string) => {
  const found = venueTypeOptions.find(
    opt => opt.label.toLowerCase() === venueType.toLowerCase(),
  );
  return found ? found.emoji : '🏟️';
};

const getSpaceLabel = (venueType: string) => {
  const found = venueTypeOptions.find(
    opt => opt.label.toLowerCase() === venueType.toLowerCase(),
  );
  if (!found) return 'Spaces';

  switch (found.type) {
    case 'rink':
      return 'Rinks';
    case 'court':
      return 'Courts';
    case 'field':
      return 'Fields';
    case 'diamond':
      return 'Diamonds';
    case 'course':
      return 'Holes/Courses';
    case 'pool':
      return 'Lanes/Pools';
    case 'gym':
      return 'Areas';
    case 'bar':
    case 'brewery':
    case 'restaurant':
    case 'cafe':
      return 'Rooms/Areas';
    case 'bowling':
      return 'Lanes';
    case 'arcade':
      return 'Stations';
    case 'theater':
    case 'music':
      return 'Stages/Rooms';
    case 'community':
    case 'coworking':
    case 'library':
      return 'Rooms';
    case 'park':
      return 'Areas';
    default:
      return 'Spaces';
  }
};

const VenueList: React.FC = () => {
  const {colors} = useTheme();
  const {t} = useTranslation();
  const navigation = useNavigation<NavigationProp<VenueStackParamList>>();
  const userContext = useContext(UserContext);
  const isAdmin = userContext?.isAdmin || false;

  // Debug: Log admin status
  useEffect(() => {
    console.log('VenueList - isAdmin:', isAdmin);
    console.log('VenueList - userData:', userContext?.userData);
  }, [isAdmin, userContext?.userData]);

  // State
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [selectedVenueType, setSelectedVenueType] = useState<string>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState<boolean>(false);

  // Admin-only state
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [showVenueTypePicker, setShowVenueTypePicker] =
    useState<boolean>(false);
  const [showOpenTimePicker, setShowOpenTimePicker] = useState<boolean>(false);
  const [showCloseTimePicker, setShowCloseTimePicker] =
    useState<boolean>(false);
  const [creatingVenue, setCreatingVenue] = useState<boolean>(false);
  const [newVenue, setNewVenue] = useState({
    name: '',
    venueType: '',
    address: '',
    totalSpaces: '',
    contactPhone: '',
    openTime: '',
    closeTime: '',
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
  });

  // Check if Google Places API key is configured
  const isApiKeyConfigured = Boolean(
    GOOGLE_PLACES_API_KEY && GOOGLE_PLACES_API_KEY.length > 10,
  );

  // Common operating hours options
  const timeOptions = [
    '5:00 AM',
    '5:30 AM',
    '6:00 AM',
    '6:30 AM',
    '7:00 AM',
    '7:30 AM',
    '8:00 AM',
    '8:30 AM',
    '9:00 AM',
    '9:30 AM',
    '10:00 AM',
    '10:30 AM',
    '11:00 AM',
    '11:30 AM',
    '12:00 PM',
    '12:30 PM',
    '1:00 PM',
    '1:30 PM',
    '2:00 PM',
    '2:30 PM',
    '3:00 PM',
    '3:30 PM',
    '4:00 PM',
    '4:30 PM',
    '5:00 PM',
    '5:30 PM',
    '6:00 PM',
    '6:30 PM',
    '7:00 PM',
    '7:30 PM',
    '8:00 PM',
    '8:30 PM',
    '9:00 PM',
    '9:30 PM',
    '10:00 PM',
    '10:30 PM',
    '11:00 PM',
    '11:30 PM',
    '12:00 AM',
  ];

  // Themed styles
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
          marginBottom: 20,
          paddingTop: 8,
          backgroundColor: colors.background,
          zIndex: 1,
        },
        title: {
          fontSize: 25,
          fontWeight: '700',
          color: colors.primary,
          textAlign: 'center',
          flex: 1,
          position: 'absolute',
          left: 0,
          right: 0,
          top: 8,
          zIndex: -1,
        },
        card: {
          backgroundColor: colors.card,
          borderRadius: 12,
          padding: 18,
          marginBottom: 18,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: colors.text,
          shadowOffset: {width: 0, height: 2},
          shadowOpacity: 0.08,
          shadowRadius: 6,
          elevation: 3,
        },
        cardHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 12,
        },
        venueEmoji: {
          fontSize: 32,
          marginRight: 12,
        },
        venueName: {
          fontSize: 18,
          fontWeight: '700',
          color: colors.text,
          flex: 1,
        },
        venueType: {
          fontSize: 13,
          color: colors.primary,
          fontWeight: '600',
          marginTop: 2,
        },
        venueAddress: {
          fontSize: 14,
          color: colors.secondaryText,
          marginTop: 8,
          flexDirection: 'row',
          alignItems: 'center',
        },
        spacesInfo: {
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 12,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        spacesText: {
          fontSize: 14,
          color: colors.text,
          marginLeft: 8,
        },
        spacesAvailable: {
          fontSize: 14,
          color: colors.success || '#4CAF50',
          fontWeight: '600',
          marginLeft: 'auto',
        },
        searchContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.card,
          borderRadius: 8,
          paddingHorizontal: 12,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: colors.border,
        },
        searchInput: {
          flex: 1,
          paddingVertical: 12,
          color: colors.text,
          fontSize: 16,
        },
        // Filter dropdown
        filterWrapper: {
          zIndex: 100,
          marginHorizontal: 16,
          marginBottom: 12,
        },
        filterButton: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.primary,
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 12,
        },
        filterButtonOpen: {
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
        },
        filterButtonLeft: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        },
        filterButtonEmoji: {
          fontSize: 18,
        },
        filterButtonText: {
          fontSize: 15,
          fontWeight: '700',
          color: '#fff',
        },
        filterList: {
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: colors.card,
          borderBottomLeftRadius: 12,
          borderBottomRightRadius: 12,
          maxHeight: 360,
          borderWidth: 1,
          borderTopWidth: 0,
          borderColor: colors.primary + '40',
          ...Platform.select({
            ios: {
              shadowColor: colors.primary,
              shadowOffset: {width: 0, height: 6},
              shadowOpacity: 0.25,
              shadowRadius: 12,
            },
            android: {
              elevation: 12,
            },
          }),
        },
        filterItem: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 13,
          paddingHorizontal: 16,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        filterItemLast: {
          borderBottomWidth: 0,
        },
        filterItemActive: {
          backgroundColor: colors.primary + '18',
        },
        filterItemEmoji: {
          fontSize: 18,
          width: 30,
          textAlign: 'center',
        },
        filterItemText: {
          fontSize: 15,
          color: colors.text,
          marginLeft: 10,
          flex: 1,
        },
        filterItemTextActive: {
          color: colors.primary,
          fontWeight: '700',
        },
        filterCheck: {
          fontSize: 14,
          color: colors.primary,
          fontWeight: '700',
        },
        filterOverlay: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99,
        },
        emptyContainer: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: 60,
        },
        emptyText: {
          fontSize: 16,
          color: colors.secondaryText,
          textAlign: 'center',
          marginTop: 16,
        },
        headerActions: {
          flexDirection: 'row',
          alignItems: 'center',
          zIndex: 2,
        },
        iconButton: {
          padding: 8,
          marginLeft: 8,
        },
        // Admin-only styles
        addButton: {
          position: 'absolute',
          bottom: 20,
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
          maxHeight: '85%',
        },
        modalTitle: {
          fontSize: 22,
          fontWeight: '700',
          color: colors.text,
          marginBottom: 20,
          textAlign: 'center',
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
        pickerButton: {
          backgroundColor: colors.background,
          borderRadius: 8,
          padding: 14,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: 16,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
        pickerButtonText: {
          fontSize: 16,
          color: colors.text,
        },
        pickerPlaceholder: {
          color: colors.secondaryText,
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
        venueTypeGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        },
        venueTypeOption: {
          width: '48%',
          backgroundColor: colors.background,
          borderRadius: 8,
          padding: 12,
          marginBottom: 8,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: colors.border,
        },
        venueTypeOptionSelected: {
          borderColor: colors.primary,
          backgroundColor: colors.primary + '20',
        },
        venueTypeEmoji: {
          fontSize: 24,
          marginBottom: 4,
        },
        venueTypeLabel: {
          fontSize: 12,
          color: colors.text,
          textAlign: 'center',
        },
        deleteButton: {
          position: 'absolute',
          top: 12,
          right: 12,
          padding: 8,
        },
        timePickerGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'flex-start',
          gap: 8,
        },
        timeOption: {
          paddingVertical: 10,
          paddingHorizontal: 14,
          backgroundColor: colors.background,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: 8,
        },
        timeOptionSelected: {
          borderColor: colors.primary,
          backgroundColor: colors.primary + '20',
        },
        timeOptionText: {
          fontSize: 14,
          color: colors.text,
        },
        hoursRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 16,
        },
        hoursColumn: {
          flex: 1,
          marginHorizontal: 4,
        },
        hoursLabel: {
          fontSize: 12,
          color: colors.secondaryText,
          marginBottom: 4,
        },
      }),
    [colors],
  );

  // Fetch venues from database
  const fetchVenues = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await axios.get(`${API_BASE_URL}/api/venues`, {
        headers: {Authorization: `Bearer ${token}`},
      });
      // Only show active venues
      const activeVenues = response.data.filter(
        (v: Venue) => v.isActive !== false,
      );
      setVenues(activeVenues);
    } catch (error) {
      console.error('Error fetching venues:', error);
      // Mock data for development - matches backend schema
      setVenues([
        {
          _id: '678123abc456def789012345',
          name: 'SportsCare Arena',
          type: 'Hockey Rink',
          address: {
            street: '1 Aspen Drive',
            city: 'Randolph',
            state: 'NJ',
            zipCode: '07869',
            country: 'USA',
          },
          coordinates: {
            latitude: 40.8590863,
            longitude: -74.6182844,
          },
          subVenues: [
            {
              id: 'rink1',
              name: 'Rink 1',
              type: 'rink',
              capacity: 20,
            },
            {
              id: 'rink2',
              name: 'Rink 2',
              type: 'rink',
              capacity: 20,
            },
          ],
          amenities: ['Locker Rooms', 'Pro Shop', 'Snack Bar'],
          operatingHours: {
            monday: {open: '6:00 AM', close: '11:00 PM'},
            tuesday: {open: '6:00 AM', close: '11:00 PM'},
            wednesday: {open: '6:00 AM', close: '11:00 PM'},
            thursday: {open: '6:00 AM', close: '11:00 PM'},
            friday: {open: '6:00 AM', close: '11:00 PM'},
            saturday: {open: '6:00 AM', close: '11:00 PM'},
            sunday: {open: '8:00 AM', close: '10:00 PM'},
          },
          contactPhone: '(973) 555-0123',
          contactEmail: 'info@sportscarearena.com',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchVenues();
  }, [fetchVenues]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchVenues();
  }, [fetchVenues]);

  // Filter venues
  const filteredVenues = useMemo(() => {
    return venues.filter(venue => {
      const addressString = formatAddress(venue.address);
      const matchesSearch =
        venue.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        addressString.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType =
        selectedVenueType === 'all' ||
        venue.type.toLowerCase() === selectedVenueType.toLowerCase();
      return matchesSearch && matchesType;
    });
  }, [venues, searchQuery, selectedVenueType]);

  // Admin: Create venue
  const handleCreateVenue = async () => {
    if (!newVenue.name || !newVenue.venueType || !newVenue.address) {
      Alert.alert(t('common.error'), t('venues.fillRequiredFields'));
      return;
    }

    setCreatingVenue(true);
    try {
      const token = await AsyncStorage.getItem('userToken');

      // Build operating hours string from open/close times
      const operatingHoursStr =
        newVenue.openTime && newVenue.closeTime
          ? `${newVenue.openTime} - ${newVenue.closeTime}`
          : '';

      // Parse address from Google Places format: "Venue Name, Street, City, State ZIP, Country"
      // Or simpler: "Venue Name, City, State, Country"
      const addressParts = newVenue.address.split(',').map(part => part.trim());

      // Find state and zip - usually in format "NJ" or "NJ 07869"
      let street = '';
      let city = '';
      let state = '';
      let zipCode = '';
      let country = 'USA';

      if (addressParts.length >= 4) {
        // Format: "Venue, Street, City, State, Country" or "Venue, Street, City, State ZIP, Country"
        street = addressParts[1] || '';
        city = addressParts[2] || '';
        const stateZipPart = addressParts[3] || '';
        const stateZipMatch = stateZipPart.match(/([A-Z]{2})\s*(\d{5})?/);
        if (stateZipMatch) {
          state = stateZipMatch[1];
          zipCode = stateZipMatch[2] || '';
        } else {
          state = stateZipPart;
        }
        if (addressParts[4]) country = addressParts[4];
      } else if (addressParts.length === 3) {
        // Format: "Venue, City, State"
        city = addressParts[1] || '';
        state = addressParts[2] || '';
      } else if (addressParts.length === 2) {
        city = addressParts[1] || '';
      }

      const response = await axios.post(
        `${API_BASE_URL}/api/venues`,
        {
          name: newVenue.name,
          type: newVenue.venueType,
          address: {
            street: street || newVenue.name,
            city: city || 'Unknown',
            state: state || 'Unknown',
            zipCode: zipCode || '00000',
            country: country,
          },
          coordinates: {
            latitude: newVenue.latitude || 0,
            longitude: newVenue.longitude || 0,
          },
          contactPhone: newVenue.contactPhone || '',
          operatingHours:
            newVenue.openTime && newVenue.closeTime
              ? {
                  monday: {open: newVenue.openTime, close: newVenue.closeTime},
                  tuesday: {open: newVenue.openTime, close: newVenue.closeTime},
                  wednesday: {
                    open: newVenue.openTime,
                    close: newVenue.closeTime,
                  },
                  thursday: {
                    open: newVenue.openTime,
                    close: newVenue.closeTime,
                  },
                  friday: {open: newVenue.openTime, close: newVenue.closeTime},
                  saturday: {
                    open: newVenue.openTime,
                    close: newVenue.closeTime,
                  },
                  sunday: {open: newVenue.openTime, close: newVenue.closeTime},
                }
              : undefined,
          subVenues: [],
          amenities: [],
          isActive: true,
        },
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );

      setVenues(prev => [...prev, response.data]);
      setModalVisible(false);
      setNewVenue({
        name: '',
        venueType: '',
        address: '',
        totalSpaces: '',
        contactPhone: '',
        openTime: '',
        closeTime: '',
        latitude: undefined,
        longitude: undefined,
      });
      Alert.alert(t('common.success'), t('venues.venueCreated'));
    } catch (error) {
      console.error('Error creating venue:', error);
      Alert.alert(t('common.error'), t('venues.createError'));
    } finally {
      setCreatingVenue(false);
    }
  };

  // Admin: Delete venue
  const handleDeleteVenue = async (venueId: string) => {
    Alert.alert(t('venues.deleteVenue'), t('venues.deleteConfirm'), [
      {text: t('common.cancel'), style: 'cancel'},
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('userToken');
            await axios.delete(`${API_BASE_URL}/api/venues/${venueId}`, {
              headers: {Authorization: `Bearer ${token}`},
            });
            setVenues(prev => prev.filter(v => v._id !== venueId));
          } catch (error) {
            console.error('Error deleting venue:', error);
            Alert.alert(t('common.error'), t('venues.deleteError'));
          }
        },
      },
    ]);
  };

  // Navigate to venue detail
  const handleVenuePress = (venue: Venue) => {
    navigation.navigate('VenueDetail', {
      venueId: venue._id,
      venueName: venue.name,
      venueType: venue.type,
      address: formatAddress(venue.address),
      totalSpaces: venue.subVenues?.length || 0,
      operatingHours: getTodayHours(venue.operatingHours) || undefined,
    });
  };

  // Render venue card
  const renderVenueCard = ({item}: {item: Venue}) => {
    const spaceLabel = getSpaceLabel(item.type);
    const totalSpaces = item.subVenues?.length || 0;
    const todayHours = getTodayHours(item.operatingHours);

    return (
      <TouchableOpacity
        style={themedStyles.card}
        onPress={() => handleVenuePress(item)}
        activeOpacity={0.7}>
        <View style={themedStyles.cardHeader}>
          <Text style={themedStyles.venueEmoji}>
            {getVenueTypeEmoji(item.type)}
          </Text>
          <View style={{flex: 1}}>
            <Text style={themedStyles.venueName}>{item.name}</Text>
            <Text style={themedStyles.venueType}>{item.type}</Text>
          </View>
        </View>

        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <FontAwesomeIcon
            icon={faMapMarkerAlt}
            size={14}
            color={colors.secondaryText}
          />
          <Text style={[themedStyles.venueAddress, {marginLeft: 6}]}>
            {formatAddress(item.address)}
          </Text>
        </View>

        {todayHours && (
          <View
            style={{flexDirection: 'row', alignItems: 'center', marginTop: 6}}>
            <FontAwesomeIcon
              icon={faClock}
              size={14}
              color={colors.secondaryText}
            />
            <Text style={[themedStyles.venueAddress, {marginLeft: 6}]}>
              {todayHours}
            </Text>
          </View>
        )}

        <View style={themedStyles.spacesInfo}>
          <FontAwesomeIcon icon={faBuilding} size={16} color={colors.primary} />
          <Text style={themedStyles.spacesText}>
            {totalSpaces} {spaceLabel}
          </Text>
          <Text style={themedStyles.spacesAvailable}>
            {t('venues.viewAvailability')}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Selected filter display info
  const selectedFilterInfo = useMemo(() => {
    if (selectedVenueType === 'all') {
      return {emoji: '🏟️', label: 'All Venues'};
    }
    const option = venueTypeOptions.find(o => o.label === selectedVenueType);
    return option
      ? {emoji: option.emoji, label: option.label}
      : {emoji: '🏟️', label: 'All Venues'};
  }, [selectedVenueType]);

  // All filter options
  const allFilterOptions = useMemo(() => {
    return [
      {emoji: '🏟️', label: 'All Venues', value: 'all'},
      ...venueTypeOptions.map(o => ({
        emoji: o.emoji,
        label: o.label,
        value: o.label,
      })),
    ];
  }, []);

  // Render filter dropdown
  const renderFilterDropdown = () => (
    <View style={themedStyles.filterWrapper}>
      <TouchableOpacity
        style={[
          themedStyles.filterButton,
          showFilterDropdown && themedStyles.filterButtonOpen,
        ]}
        onPress={() => setShowFilterDropdown(!showFilterDropdown)}
        activeOpacity={0.8}>
        <View style={themedStyles.filterButtonLeft}>
          <Text style={themedStyles.filterButtonEmoji}>
            {selectedFilterInfo.emoji}
          </Text>
          <Text style={themedStyles.filterButtonText}>
            {selectedFilterInfo.label}
          </Text>
        </View>
        <FontAwesomeIcon
          icon={faChevronDown}
          size={14}
          color="#fff"
          style={{
            transform: [{rotate: showFilterDropdown ? '180deg' : '0deg'}],
          }}
        />
      </TouchableOpacity>

      {showFilterDropdown && (
        <ScrollView
          style={themedStyles.filterList}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {allFilterOptions.map((option, index) => (
            <TouchableOpacity
              key={option.value}
              style={[
                themedStyles.filterItem,
                selectedVenueType === option.value &&
                  themedStyles.filterItemActive,
                index === allFilterOptions.length - 1 &&
                  themedStyles.filterItemLast,
              ]}
              onPress={() => {
                setSelectedVenueType(option.value);
                setShowFilterDropdown(false);
              }}>
              <Text style={themedStyles.filterItemEmoji}>{option.emoji}</Text>
              <Text
                style={[
                  themedStyles.filterItemText,
                  selectedVenueType === option.value &&
                    themedStyles.filterItemTextActive,
                ]}>
                {option.label}
              </Text>
              {selectedVenueType === option.value && (
                <Text style={themedStyles.filterCheck}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={themedStyles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={themedStyles.container}>
      {/* Header */}
      <View style={themedStyles.header}>
        <HamburgerMenu />
        <Text style={themedStyles.title}>{t('venues.title')}</Text>
        <View style={themedStyles.headerActions}>
          <TouchableOpacity
            style={themedStyles.iconButton}
            onPress={() => setShowSearch(!showSearch)}>
            <FontAwesomeIcon
              icon={showSearch ? faTimes : faSearch}
              size={20}
              color={colors.text}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      {showSearch && (
        <View style={themedStyles.searchContainer}>
          <FontAwesomeIcon
            icon={faSearch}
            size={18}
            color={colors.secondaryText}
          />
          <TextInput
            style={themedStyles.searchInput}
            placeholder={t('venues.searchPlaceholder')}
            placeholderTextColor={colors.secondaryText}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <FontAwesomeIcon
                icon={faTimes}
                size={18}
                color={colors.secondaryText}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Dismiss overlay when dropdown is open */}
      {showFilterDropdown && (
        <TouchableOpacity
          style={themedStyles.filterOverlay}
          activeOpacity={1}
          onPress={() => setShowFilterDropdown(false)}
        />
      )}

      {/* Filter Dropdown */}
      {renderFilterDropdown()}

      {/* Venue List */}
      <FlatList
        data={filteredVenues}
        keyExtractor={item => item._id}
        renderItem={renderVenueCard}
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
              icon={faBuilding}
              size={48}
              color={colors.secondaryText}
            />
            <Text style={themedStyles.emptyText}>{t('venues.noVenues')}</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: isAdmin ? 80 : 20}}
      />

      {/* Admin: FAB to Add Venue */}
      {isAdmin && (
        <TouchableOpacity
          style={themedStyles.addButton}
          onPress={() => setModalVisible(true)}>
          <FontAwesomeIcon icon={faPlus} size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Admin: Create Venue Modal */}
      {isAdmin && (
        <Modal
          visible={modalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setModalVisible(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{flex: 1}}>
            <View style={themedStyles.modalOverlay}>
              <View style={themedStyles.modalContent}>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled={true}>
                  <Text style={themedStyles.modalTitle}>
                    {t('venues.addVenue')}
                  </Text>

                  <Text style={themedStyles.inputLabel}>Venue/Facility *</Text>
                  <View style={{zIndex: 1000, marginBottom: 16}}>
                    {isApiKeyConfigured ? (
                      <GooglePlacesAutocomplete
                        placeholder="Search for venue..."
                        onPress={(data, details = null) => {
                          console.log('Selected venue:', data, details);
                          const venueName =
                            details?.name ||
                            data.structured_formatting?.main_text ||
                            data.description.split(',')[0];
                          const fullAddress = data.description;
                          setNewVenue(prev => ({
                            ...prev,
                            name: venueName,
                            address: fullAddress,
                            latitude: details?.geometry?.location?.lat,
                            longitude: details?.geometry?.location?.lng,
                          }));
                        }}
                        query={{
                          key: GOOGLE_PLACES_API_KEY,
                          language: 'en',
                          types: 'establishment',
                        }}
                        fetchDetails={true}
                        disableScroll={true}
                        listViewDisplayed="auto"
                        styles={{
                          container: {
                            flex: 0,
                          },
                          textInputContainer: {
                            backgroundColor: 'transparent',
                          },
                          textInput: {
                            backgroundColor: colors.background,
                            color: colors.text,
                            padding: 14,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: colors.border,
                            fontSize: 16,
                          },
                          listView: {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                            borderWidth: 1,
                            borderTopWidth: 0,
                            borderRadius: 8,
                            borderTopLeftRadius: 0,
                            borderTopRightRadius: 0,
                            maxHeight: 200,
                          },
                          row: {
                            backgroundColor: colors.card,
                            padding: 13,
                            minHeight: 44,
                          },
                          separator: {
                            height: 0.5,
                            backgroundColor: colors.border,
                          },
                          description: {
                            color: colors.text,
                          },
                        }}
                        textInputProps={{
                          placeholderTextColor: colors.secondaryText,
                        }}
                        onFail={error => {
                          console.warn(
                            'GooglePlacesAutocomplete error:',
                            error,
                          );
                        }}
                        enablePoweredByContainer={false}
                        debounce={200}
                      />
                    ) : (
                      <TextInput
                        style={themedStyles.input}
                        placeholder="Enter venue name"
                        placeholderTextColor={colors.secondaryText}
                        value={newVenue.name}
                        onChangeText={text =>
                          setNewVenue(prev => ({...prev, name: text}))
                        }
                      />
                    )}
                  </View>

                  {/* Show selected address */}
                  {newVenue.address ? (
                    <View
                      style={{
                        marginBottom: 16,
                        padding: 12,
                        backgroundColor: colors.background,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}>
                      <Text
                        style={{
                          color: colors.secondaryText,
                          fontSize: 12,
                          marginBottom: 4,
                        }}>
                        Selected Location
                      </Text>
                      <Text
                        style={{
                          color: colors.text,
                          fontSize: 14,
                          fontWeight: '500',
                        }}>
                        {newVenue.name}
                      </Text>
                      <Text
                        style={{
                          color: colors.secondaryText,
                          fontSize: 13,
                          marginTop: 2,
                        }}>
                        {newVenue.address}
                      </Text>
                    </View>
                  ) : null}

                  <Text style={themedStyles.inputLabel}>
                    {t('venues.venueType')} *
                  </Text>
                  <TouchableOpacity
                    style={themedStyles.pickerButton}
                    onPress={() => {
                      setModalVisible(false);
                      setTimeout(() => setShowVenueTypePicker(true), 300);
                    }}>
                    <Text
                      style={[
                        themedStyles.pickerButtonText,
                        !newVenue.venueType && themedStyles.pickerPlaceholder,
                      ]}>
                      {newVenue.venueType
                        ? `${getVenueTypeEmoji(newVenue.venueType)} ${
                            newVenue.venueType
                          }`
                        : t('venues.selectVenueType')}
                    </Text>
                    <FontAwesomeIcon
                      icon={faChevronDown}
                      size={14}
                      color={colors.secondaryText}
                    />
                  </TouchableOpacity>

                  <Text style={themedStyles.inputLabel}>
                    {t('venues.contactPhone')}
                  </Text>
                  <TextInput
                    style={themedStyles.input}
                    placeholder={t('venues.phonePlaceholder')}
                    placeholderTextColor={colors.secondaryText}
                    keyboardType="phone-pad"
                    value={newVenue.contactPhone}
                    onChangeText={text =>
                      setNewVenue(prev => ({...prev, contactPhone: text}))
                    }
                  />

                  <Text style={themedStyles.inputLabel}>
                    {t('venues.operatingHours')}
                  </Text>
                  <View style={themedStyles.hoursRow}>
                    <View style={themedStyles.hoursColumn}>
                      <Text style={themedStyles.hoursLabel}>Open</Text>
                      <TouchableOpacity
                        style={themedStyles.pickerButton}
                        onPress={() => {
                          setModalVisible(false);
                          setTimeout(() => setShowOpenTimePicker(true), 300);
                        }}>
                        <Text
                          style={[
                            themedStyles.pickerButtonText,
                            !newVenue.openTime &&
                              themedStyles.pickerPlaceholder,
                          ]}>
                          {newVenue.openTime || '6:00 AM'}
                        </Text>
                        <FontAwesomeIcon
                          icon={faChevronDown}
                          size={14}
                          color={colors.secondaryText}
                        />
                      </TouchableOpacity>
                    </View>
                    <View style={themedStyles.hoursColumn}>
                      <Text style={themedStyles.hoursLabel}>Close</Text>
                      <TouchableOpacity
                        style={themedStyles.pickerButton}
                        onPress={() => {
                          setModalVisible(false);
                          setTimeout(() => setShowCloseTimePicker(true), 300);
                        }}>
                        <Text
                          style={[
                            themedStyles.pickerButtonText,
                            !newVenue.closeTime &&
                              themedStyles.pickerPlaceholder,
                          ]}>
                          {newVenue.closeTime || '11:00 PM'}
                        </Text>
                        <FontAwesomeIcon
                          icon={faChevronDown}
                          size={14}
                          color={colors.secondaryText}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={themedStyles.submitButton}
                    onPress={handleCreateVenue}
                    disabled={creatingVenue}>
                    {creatingVenue ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={themedStyles.submitButtonText}>
                        {t('venues.createVenue')}
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={themedStyles.cancelButton}
                    onPress={() => setModalVisible(false)}>
                    <Text style={themedStyles.cancelButtonText}>
                      {t('common.cancel')}
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {/* Admin: Venue Type Picker Modal */}
      {isAdmin && (
        <Modal
          visible={showVenueTypePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowVenueTypePicker(false)}>
          <View style={themedStyles.modalOverlay}>
            <View style={[themedStyles.modalContent, {maxHeight: '70%'}]}>
              <Text style={themedStyles.modalTitle}>
                {t('venues.selectType')}
              </Text>
              <ScrollView>
                <View style={themedStyles.venueTypeGrid}>
                  {venueTypeOptions.map(option => (
                    <TouchableOpacity
                      key={option.label}
                      style={[
                        themedStyles.venueTypeOption,
                        newVenue.venueType === option.label &&
                          themedStyles.venueTypeOptionSelected,
                      ]}
                      onPress={() => {
                        setNewVenue(prev => ({
                          ...prev,
                          venueType: option.label,
                        }));
                        setShowVenueTypePicker(false);
                        setTimeout(() => setModalVisible(true), 300);
                      }}>
                      <Text style={themedStyles.venueTypeEmoji}>
                        {option.emoji}
                      </Text>
                      <Text style={themedStyles.venueTypeLabel}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Admin: Open Time Picker Modal */}
      {isAdmin && (
        <Modal
          visible={showOpenTimePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowOpenTimePicker(false)}>
          <View style={themedStyles.modalOverlay}>
            <View style={[themedStyles.modalContent, {maxHeight: '60%'}]}>
              <Text style={themedStyles.modalTitle}>Select Open Time</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={themedStyles.timePickerGrid}>
                  {timeOptions.map(time => (
                    <TouchableOpacity
                      key={time}
                      style={[
                        themedStyles.timeOption,
                        newVenue.openTime === time &&
                          themedStyles.timeOptionSelected,
                      ]}
                      onPress={() => {
                        setNewVenue(prev => ({...prev, openTime: time}));
                        setShowOpenTimePicker(false);
                        setTimeout(() => setModalVisible(true), 300);
                      }}>
                      <Text style={themedStyles.timeOptionText}>{time}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* Admin: Close Time Picker Modal */}
      {isAdmin && (
        <Modal
          visible={showCloseTimePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCloseTimePicker(false)}>
          <View style={themedStyles.modalOverlay}>
            <View style={[themedStyles.modalContent, {maxHeight: '60%'}]}>
              <Text style={themedStyles.modalTitle}>Select Close Time</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={themedStyles.timePickerGrid}>
                  {timeOptions.map(time => (
                    <TouchableOpacity
                      key={time}
                      style={[
                        themedStyles.timeOption,
                        newVenue.closeTime === time &&
                          themedStyles.timeOptionSelected,
                      ]}
                      onPress={() => {
                        setNewVenue(prev => ({...prev, closeTime: time}));
                        setShowCloseTimePicker(false);
                        setTimeout(() => setModalVisible(true), 300);
                      }}>
                      <Text style={themedStyles.timeOptionText}>{time}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
};

export default VenueList;
