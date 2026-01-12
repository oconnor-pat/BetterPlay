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
  RefreshControl,
  Linking,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {SafeAreaView} from 'react-native-safe-area-context';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faArrowLeft,
  faPlus,
  faTrash,
  faMapMarkerAlt,
  faClock,
  faPhone,
  faEnvelope,
  faUsers,
  faCheck,
  faTimes,
  faLocationArrow,
  faCalendarAlt,
} from '@fortawesome/free-solid-svg-icons';
import {
  useNavigation,
  useRoute,
  RouteProp,
  NavigationProp,
} from '@react-navigation/native';
import UserContext, {UserContextType} from '../UserContext';
import {useTheme} from '../ThemeContext/ThemeContext';
import axios from 'axios';
import {API_BASE_URL} from '../../config/api';
import {useTranslation} from 'react-i18next';
import {VenueStackParamList} from './VenueList';

type VenueDetailRouteProp = RouteProp<VenueStackParamList, 'VenueDetail'>;

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

interface Space {
  _id: string;
  name: string;
  capacity: number;
  isAvailable: boolean;
  description?: string;
  amenities?: string[];
  timeSlots?: TimeSlot[];
}

interface VenueDetails {
  _id: string;
  name: string;
  address: string;
  venueType: string;
  spaces: Space[];
  totalSpaces: number;
  contactPhone?: string;
  contactEmail?: string;
  operatingHours?: string;
  amenities?: string[];
  createdBy: string;
  latitude?: number;
  longitude?: number;
}

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

const getSpaceIcon = (venueType: string) => {
  return venueTypeEmojis[venueType] || '🏟️';
};

const getSpaceLabel = (venueType: string, singular: boolean = false) => {
  const typeMap: Record<string, {singular: string; plural: string}> = {
    'Hockey Rink': {singular: 'Rink', plural: 'Rinks'},
    'Basketball Court': {singular: 'Court', plural: 'Courts'},
    'Soccer Field': {singular: 'Field', plural: 'Fields'},
    'Tennis Court': {singular: 'Court', plural: 'Courts'},
    'Baseball Diamond': {singular: 'Diamond', plural: 'Diamonds'},
    'Football Field': {singular: 'Field', plural: 'Fields'},
    'Golf Course': {singular: 'Course', plural: 'Courses'},
    'Volleyball Court': {singular: 'Court', plural: 'Courts'},
    'Swimming Pool': {singular: 'Pool', plural: 'Pools'},
    Gym: {singular: 'Area', plural: 'Areas'},
    'Multi-Purpose': {singular: 'Space', plural: 'Spaces'},
  };

  const labels = typeMap[venueType] || {singular: 'Space', plural: 'Spaces'};
  return singular ? labels.singular : labels.plural;
};

const VenueDetail: React.FC = () => {
  const route = useRoute<VenueDetailRouteProp>();
  const navigation = useNavigation<NavigationProp<VenueStackParamList>>();
  const userContext = useContext(UserContext);
  const {userData} = userContext as UserContextType;
  const isAdmin = userContext?.isAdmin || false;
  const {colors} = useTheme();
  const {t} = useTranslation();

  const {venueId, venueName, venueType, address, totalSpaces} = route.params;

  // State
  const [venue, setVenue] = useState<VenueDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Add space modal
  const [showAddSpace, setShowAddSpace] = useState<boolean>(false);
  const [newSpaceName, setNewSpaceName] = useState<string>('');
  const [newSpaceCapacity, setNewSpaceCapacity] = useState<string>('');
  const [addingSpace, setAddingSpace] = useState<boolean>(false);
  const [deletingVenue, setDeletingVenue] = useState<boolean>(false);

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
        venueInfo: {
          backgroundColor: colors.card,
          padding: 16,
          marginBottom: 8,
        },
        infoRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 12,
        },
        infoText: {
          fontSize: 14,
          color: colors.text,
          marginLeft: 10,
          flex: 1,
        },
        infoLink: {
          color: colors.primary,
          textDecorationLine: 'underline',
        },
        directionsButton: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary,
          borderRadius: 8,
          padding: 12,
          marginTop: 8,
        },
        directionsText: {
          color: '#FFFFFF',
          fontWeight: '600',
          marginLeft: 8,
        },
        sectionHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: colors.background,
        },
        sectionTitle: {
          fontSize: 18,
          fontWeight: '700',
          color: colors.text,
        },
        addButton: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.primary,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 20,
        },
        addButtonText: {
          color: '#FFFFFF',
          fontWeight: '600',
          marginLeft: 6,
        },
        spaceCard: {
          backgroundColor: colors.card,
          marginHorizontal: 16,
          marginBottom: 12,
          borderRadius: 12,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
        },
        spaceHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        },
        spaceName: {
          fontSize: 18,
          fontWeight: '700',
          color: colors.text,
        },
        spaceStatusRow: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        spaceStatus: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 12,
        },
        statusAvailable: {
          backgroundColor: (colors.success || '#4CAF50') + '20',
        },
        statusUnavailable: {
          backgroundColor: (colors.error || '#F44336') + '20',
        },
        statusText: {
          fontSize: 12,
          fontWeight: '600',
          marginLeft: 4,
        },
        statusTextAvailable: {
          color: colors.success || '#4CAF50',
        },
        statusTextUnavailable: {
          color: colors.error || '#F44336',
        },
        spaceDetails: {
          marginTop: 8,
        },
        spaceCapacity: {
          fontSize: 14,
          color: colors.secondaryText,
        },
        spaceCapacityRow: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        spaceCapacityText: {
          marginLeft: 8,
        },
        spaceDescription: {
          fontSize: 14,
          color: colors.text,
          marginTop: 8,
          fontStyle: 'italic',
        },
        viewSlotsButton: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary + '15',
          borderRadius: 8,
          padding: 12,
          marginTop: 12,
        },
        viewSlotsText: {
          color: colors.primary,
          fontWeight: '600',
          marginLeft: 8,
        },
        deleteButton: {
          padding: 8,
        },
        deleteVenueButton: {
          padding: 10,
          marginLeft: 8,
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
        emptyIcon: {
          fontSize: 48,
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
        listContent: {
          paddingBottom: 20,
        },
        keyboardAvoidingView: {
          flex: 1,
        },
      }),
    [colors],
  );

  // Fetch venue details
  const fetchVenueDetails = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await axios.get(
        `${API_BASE_URL}/api/venues/${venueId}`,
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );

      // Transform backend data to match our interface
      const backendData = response.data;
      const transformedVenue: VenueDetails = {
        _id: backendData._id,
        name: backendData.name,
        // Handle address as object or string
        address:
          typeof backendData.address === 'object'
            ? `${backendData.address.street}, ${backendData.address.city}, ${backendData.address.state} ${backendData.address.zipCode}`
            : backendData.address || address,
        venueType: backendData.type || venueType,
        // Transform subVenues to spaces
        spaces: (backendData.subVenues || []).map((sv: any) => ({
          _id: sv.id || sv._id,
          name: sv.name,
          capacity: sv.capacity || 20,
          isAvailable: true,
          description: sv.description || '',
        })),
        totalSpaces: backendData.subVenues?.length || 0,
        contactPhone: backendData.contactPhone,
        contactEmail: backendData.contactEmail,
        operatingHours: backendData.operatingHours?.monday
          ? `${backendData.operatingHours.monday.open} - ${backendData.operatingHours.monday.close}`
          : undefined,
        amenities: backendData.amenities,
        createdBy: backendData.createdBy || 'admin',
        latitude: backendData.coordinates?.latitude,
        longitude: backendData.coordinates?.longitude,
      };

      setVenue(transformedVenue);
    } catch (error) {
      console.error('Error fetching venue details:', error);
      // Mock data for development
      setVenue({
        _id: venueId,
        name: venueName,
        address: address,
        venueType: venueType,
        totalSpaces: totalSpaces,
        operatingHours: '6:00 AM - 11:00 PM',
        contactPhone: '(555) 123-4567',
        contactEmail: 'info@venue.com',
        createdBy: 'admin',
        spaces: [
          {
            _id: 's1',
            name: `${getSpaceLabel(venueType, true)} A`,
            capacity: 20,
            isAvailable: true,
            description: 'Full-size space with premium amenities',
          },
          {
            _id: 's2',
            name: `${getSpaceLabel(venueType, true)} B`,
            capacity: 20,
            isAvailable: true,
            description: 'Standard size, great for practice',
          },
          {
            _id: 's3',
            name: `Practice ${getSpaceLabel(venueType, true)}`,
            capacity: 10,
            isAvailable: false,
            description: 'Smaller space ideal for training',
          },
        ],
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [venueId, venueName, address, venueType, totalSpaces]);

  useEffect(() => {
    fetchVenueDetails();
  }, [fetchVenueDetails]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchVenueDetails();
  }, [fetchVenueDetails]);

  // Open maps for directions
  const openDirections = async () => {
    const encodedAddress = encodeURIComponent(venue?.address || address);
    try {
      if (Platform.OS === 'ios') {
        const googleMapsUrl = `comgooglemaps://?daddr=${encodedAddress}&directionsmode=driving`;
        const canOpenGoogle = await Linking.canOpenURL(googleMapsUrl);
        if (canOpenGoogle) {
          await Linking.openURL(googleMapsUrl);
        } else {
          await Linking.openURL(
            `http://maps.apple.com/?daddr=${encodedAddress}`,
          );
        }
      } else {
        await Linking.openURL(`google.navigation:q=${encodedAddress}`);
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('venues.directionsError'));
    }
  };

  // Call venue
  const callVenue = () => {
    if (venue?.contactPhone) {
      Linking.openURL(`tel:${venue.contactPhone}`);
    }
  };

  // Email venue
  const emailVenue = () => {
    if (venue?.contactEmail) {
      Linking.openURL(`mailto:${venue.contactEmail}`);
    }
  };

  // Delete venue handler
  const handleDeleteVenue = () => {
    Alert.alert(t('venues.deleteVenue'), t('venues.deleteConfirm'), [
      {text: t('common.cancel'), style: 'cancel'},
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          setDeletingVenue(true);
          try {
            const token = await AsyncStorage.getItem('userToken');
            await axios.delete(`${API_BASE_URL}/api/venues/${venueId}`, {
              headers: {Authorization: `Bearer ${token}`},
            });
            Alert.alert(t('common.success'), t('venues.venueDeleted'));
            navigation.goBack();
          } catch (error) {
            console.error('Error deleting venue:', error);
            Alert.alert(t('common.error'), t('venues.deleteError'));
          } finally {
            setDeletingVenue(false);
          }
        },
      },
    ]);
  };

  // Add space handler
  const handleAddSpace = async () => {
    if (!newSpaceName.trim()) {
      Alert.alert(t('common.error'), t('venues.spaceNameRequired'));
      return;
    }

    setAddingSpace(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const newSpaceId = `space_${Date.now()}`;
      const spaceType = getSpaceLabel(venueType, true); // "Rink", "Court", "Field", etc.
      const newSpaceData = {
        id: newSpaceId,
        name: newSpaceName.trim(),
        type: spaceType,
        capacity: parseInt(newSpaceCapacity, 10) || 20,
      };

      // Get current subVenues and add new one
      const currentSubVenues =
        venue?.spaces?.map(s => ({
          id: s._id,
          name: s.name,
          type: spaceType,
          capacity: s.capacity,
        })) || [];

      const updatedSubVenues = [...currentSubVenues, newSpaceData];

      // Update venue with new subVenues array
      await axios.put(
        `${API_BASE_URL}/api/venues/${venueId}`,
        {subVenues: updatedSubVenues},
        {headers: {Authorization: `Bearer ${token}`}},
      );

      // Update local state
      const newSpace: Space = {
        _id: newSpaceId,
        name: newSpaceData.name,
        capacity: newSpaceData.capacity,
        isAvailable: true,
      };

      if (venue) {
        setVenue({
          ...venue,
          spaces: [...(venue.spaces || []), newSpace],
        });
      }

      setShowAddSpace(false);
      setNewSpaceName('');
      setNewSpaceCapacity('');
      Alert.alert(t('common.success'), t('venues.spaceAdded'));
    } catch (error: any) {
      console.error('Error adding space:', error);
      console.log('Error response:', error?.response?.data);
      Alert.alert(
        t('common.error'),
        error?.response?.data?.message || t('venues.addSpaceError'),
      );
    } finally {
      setAddingSpace(false);
    }
  };

  // Delete space handler
  const handleDeleteSpace = async (spaceId: string) => {
    Alert.alert(t('venues.deleteSpace'), t('venues.deleteSpaceConfirm'), [
      {text: t('common.cancel'), style: 'cancel'},
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('userToken');
            const spaceType = getSpaceLabel(venueType, true);

            // Filter out the space to delete and update venue
            const updatedSubVenues = (venue?.spaces || [])
              .filter(s => s._id !== spaceId)
              .map(s => ({
                id: s._id,
                name: s.name,
                type: spaceType,
                capacity: s.capacity,
              }));

            await axios.put(
              `${API_BASE_URL}/api/venues/${venueId}`,
              {subVenues: updatedSubVenues},
              {headers: {Authorization: `Bearer ${token}`}},
            );

            if (venue) {
              setVenue({
                ...venue,
                spaces: (venue.spaces || []).filter(s => s._id !== spaceId),
              });
            }
            Alert.alert(t('common.success'), t('venues.spaceDeleted'));
          } catch (error) {
            console.error('Error deleting space:', error);
            Alert.alert(t('common.error'), t('venues.deleteSpaceError'));
          }
        },
      },
    ]);
  };

  // Navigate to space detail (time slots)
  const handleSpacePress = (space: Space) => {
    navigation.navigate('SpaceDetail', {
      venueId: venueId,
      spaceId: space._id,
      spaceName: space.name,
      venueType: venueType,
    });
  };

  // Render space card
  const renderSpaceCard = ({item}: {item: Space}) => {
    const spaceCanManage = isAdmin || venue?.createdBy === userData?._id;

    return (
      <TouchableOpacity
        style={themedStyles.spaceCard}
        onPress={() => handleSpacePress(item)}
        activeOpacity={0.7}>
        <View style={themedStyles.spaceHeader}>
          <Text style={themedStyles.spaceName}>
            {getSpaceIcon(venueType)} {item.name}
          </Text>
          <View style={themedStyles.spaceStatusRow}>
            <View
              style={[
                themedStyles.spaceStatus,
                item.isAvailable
                  ? themedStyles.statusAvailable
                  : themedStyles.statusUnavailable,
              ]}>
              <FontAwesomeIcon
                icon={item.isAvailable ? faCheck : faTimes}
                size={12}
                color={
                  item.isAvailable
                    ? colors.success || '#4CAF50'
                    : colors.error || '#F44336'
                }
              />
              <Text
                style={[
                  themedStyles.statusText,
                  item.isAvailable
                    ? themedStyles.statusTextAvailable
                    : themedStyles.statusTextUnavailable,
                ]}>
                {item.isAvailable ? t('venues.available') : t('venues.booked')}
              </Text>
            </View>
            {spaceCanManage && (
              <TouchableOpacity
                style={themedStyles.deleteButton}
                onPress={() => handleDeleteSpace(item._id)}>
                <FontAwesomeIcon
                  icon={faTrash}
                  size={16}
                  color={colors.error || '#F44336'}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={themedStyles.spaceDetails}>
          <View style={themedStyles.spaceCapacityRow}>
            <FontAwesomeIcon
              icon={faUsers}
              size={14}
              color={colors.secondaryText}
            />
            <Text
              style={[
                themedStyles.spaceCapacity,
                themedStyles.spaceCapacityText,
              ]}>
              {t('venues.capacity')}: {item.capacity}
            </Text>
          </View>

          {item.description && (
            <Text style={themedStyles.spaceDescription}>
              {item.description}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={themedStyles.viewSlotsButton}
          onPress={() => handleSpacePress(item)}>
          <FontAwesomeIcon
            icon={faCalendarAlt}
            size={16}
            color={colors.primary}
          />
          <Text style={themedStyles.viewSlotsText}>
            {t('venues.viewTimeSlots')}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // Render add space modal
  const renderAddSpaceModal = () => (
    <Modal
      visible={showAddSpace}
      transparent
      animationType="slide"
      onRequestClose={() => setShowAddSpace(false)}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={themedStyles.keyboardAvoidingView}>
        <TouchableOpacity
          style={themedStyles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAddSpace(false)}>
          <TouchableOpacity
            activeOpacity={1}
            style={themedStyles.modalContent}
            onPress={e => e.stopPropagation()}>
            <Text style={themedStyles.modalTitle}>
              {t('venues.addSpace', {type: getSpaceLabel(venueType, true)})}
            </Text>

            <Text style={themedStyles.inputLabel}>
              {t('venues.spaceName')} *
            </Text>
            <TextInput
              style={themedStyles.input}
              placeholder={`e.g., ${getSpaceLabel(venueType, true)} A`}
              placeholderTextColor={colors.secondaryText}
              value={newSpaceName}
              onChangeText={setNewSpaceName}
              returnKeyType="next"
            />

            <Text style={themedStyles.inputLabel}>{t('venues.capacity')}</Text>
            <TextInput
              style={themedStyles.input}
              placeholder={t('venues.capacityPlaceholder')}
              placeholderTextColor={colors.secondaryText}
              keyboardType="numeric"
              value={newSpaceCapacity}
              onChangeText={setNewSpaceCapacity}
              returnKeyType="done"
            />

            <TouchableOpacity
              style={themedStyles.submitButton}
              onPress={handleAddSpace}
              disabled={addingSpace}>
              {addingSpace ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={themedStyles.submitButtonText}>
                  {t('venues.addSpaceButton')}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={themedStyles.cancelButton}
              onPress={() => setShowAddSpace(false)}>
              <Text style={themedStyles.cancelButtonText}>
                {t('common.cancel')}
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
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
            <Text style={themedStyles.headerTitle}>{venueName}</Text>
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

  const isOwner = venue?.createdBy === userData?._id;
  const canManage = isAdmin || isOwner;

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
            {getSpaceIcon(venueType)} {venue?.name || venueName}
          </Text>
          <Text style={themedStyles.headerSubtitle}>{venueType}</Text>
        </View>
        {/* Delete venue button for admins */}
        {canManage && (
          <TouchableOpacity
            style={themedStyles.deleteVenueButton}
            onPress={handleDeleteVenue}
            disabled={deletingVenue}>
            {deletingVenue ? (
              <ActivityIndicator size="small" color="#FF3B30" />
            ) : (
              <FontAwesomeIcon icon={faTrash} size={20} color="#FF3B30" />
            )}
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={venue?.spaces || []}
        keyExtractor={item => item._id}
        renderItem={renderSpaceCard}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <>
            {/* Venue Info Card */}
            <View style={themedStyles.venueInfo}>
              <View style={themedStyles.infoRow}>
                <FontAwesomeIcon
                  icon={faMapMarkerAlt}
                  size={16}
                  color={colors.primary}
                />
                <Text style={themedStyles.infoText}>{venue?.address}</Text>
              </View>

              {venue?.operatingHours && (
                <View style={themedStyles.infoRow}>
                  <FontAwesomeIcon
                    icon={faClock}
                    size={16}
                    color={colors.primary}
                  />
                  <Text style={themedStyles.infoText}>
                    {venue.operatingHours}
                  </Text>
                </View>
              )}

              {venue?.contactPhone && (
                <TouchableOpacity
                  style={themedStyles.infoRow}
                  onPress={callVenue}>
                  <FontAwesomeIcon
                    icon={faPhone}
                    size={16}
                    color={colors.primary}
                  />
                  <Text style={[themedStyles.infoText, themedStyles.infoLink]}>
                    {venue.contactPhone}
                  </Text>
                </TouchableOpacity>
              )}

              {venue?.contactEmail && (
                <TouchableOpacity
                  style={themedStyles.infoRow}
                  onPress={emailVenue}>
                  <FontAwesomeIcon
                    icon={faEnvelope}
                    size={16}
                    color={colors.primary}
                  />
                  <Text style={[themedStyles.infoText, themedStyles.infoLink]}>
                    {venue.contactEmail}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={themedStyles.directionsButton}
                onPress={openDirections}>
                <FontAwesomeIcon
                  icon={faLocationArrow}
                  size={16}
                  color="#FFFFFF"
                />
                <Text style={themedStyles.directionsText}>
                  {t('venues.getDirections')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Spaces Section Header */}
            <View style={themedStyles.sectionHeader}>
              <Text style={themedStyles.sectionTitle}>
                {getSpaceLabel(venueType)} ({venue?.spaces?.length || 0})
              </Text>
              {canManage && (
                <TouchableOpacity
                  style={themedStyles.addButton}
                  onPress={() => setShowAddSpace(true)}>
                  <FontAwesomeIcon icon={faPlus} size={14} color="#FFFFFF" />
                  <Text style={themedStyles.addButtonText}>
                    {t('venues.add')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={themedStyles.emptyContainer}>
            <Text style={themedStyles.emptyIcon}>
              {getSpaceIcon(venueType)}
            </Text>
            <Text style={themedStyles.emptyText}>
              {t('venues.noSpaces', {
                type: getSpaceLabel(venueType).toLowerCase(),
              })}
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={themedStyles.listContent}
      />

      {renderAddSpaceModal()}
    </SafeAreaView>
  );
};

export default VenueDetail;
