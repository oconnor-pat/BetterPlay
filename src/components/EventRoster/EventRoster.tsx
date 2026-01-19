import React, {useState, useEffect, useMemo, useContext} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {RouteProp, useRoute} from '@react-navigation/native';
import {useTheme} from '../ThemeContext/ThemeContext';
import axios from 'axios';
import {useEventContext} from '../../Context/EventContext';
import UserContext, {UserContextType} from '../UserContext';
import {API_BASE_URL} from '../../config/api';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {useTranslation} from 'react-i18next';
import {RosterListSkeleton} from '../Skeleton';
import {
  faChevronDown,
  faChevronUp,
  faUserPlus,
  faUsers,
  faCheck,
  faTimes,
  faFutbol,
} from '@fortawesome/free-solid-svg-icons';

export interface Player {
  username: string;
  paidStatus: string;
  jerseyColor: string;
  position: string;
}

type EventRosterRouteProp = RouteProp<
  {
    EventRoster: {
      eventId: string;
      eventName: string;
      eventType: string;
      date?: string;
      time?: string;
      location?: string;
      totalSpots?: number;
      roster?: Player[];
      jerseyColors?: string[];
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
  Default: ['Player'],
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
const lightJerseyColors = ['White', 'Yellow'];

const isLightColor = (colorName: string) =>
  lightJerseyColors.includes(colorName);

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

const EventRoster: React.FC = () => {
  const route = useRoute<EventRosterRouteProp>();
  const {
    eventId,
    eventName,
    eventType,
    date,
    time,
    location,
    totalSpots = 10,
    roster: initialRoster,
    jerseyColors: initialJerseyColors,
  } = route.params;
  const {colors} = useTheme();
  const {updateRosterSpots} = useEventContext();
  const {userData} = useContext(UserContext) as UserContextType;
  const {t} = useTranslation();

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

  const [loading, setLoading] = useState(false);
  const [savingRoster, setSavingRoster] = useState(false);
  const [addPlayerExpanded, setAddPlayerExpanded] = useState(false);

  // Edit mode state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editPaidStatus, setEditPaidStatus] = useState('');
  const [editJerseyColor, setEditJerseyColor] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [editPaidStatusModalVisible, setEditPaidStatusModalVisible] =
    useState(false);
  const [editJerseyColorModalVisible, setEditJerseyColorModalVisible] =
    useState(false);
  const [editPositionModalVisible, setEditPositionModalVisible] =
    useState(false);

  // Check if current user is already on roster
  const isUserOnRoster = useMemo(() => {
    return roster.some(player => player.username === userData?.username);
  }, [roster, userData?.username]);

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
          padding: 16,
        },
        // Event Header
        eventHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        },
        eventEmoji: {
          fontSize: 32,
          marginRight: 10,
        },
        eventName: {
          fontSize: 24,
          fontWeight: 'bold',
          color: colors.text,
          flex: 1,
          flexWrap: 'wrap',
        },
        // Event Card
        eventCard: {
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 2},
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 3,
        },
        eventTypeRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 16,
        },
        eventTypeBadge: {
          backgroundColor: colors.primary + '20',
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 20,
        },
        eventTypeText: {
          color: colors.primary,
          fontSize: 14,
          fontWeight: '600',
        },
        eventDetailRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 8,
        },
        eventDetailIcon: {
          fontSize: 16,
          marginRight: 10,
          width: 24,
        },
        eventDetailText: {
          color: colors.text,
          fontSize: 15,
          flex: 1,
        },
        // Progress Bar
        progressSection: {
          marginTop: 16,
          paddingTop: 16,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        progressHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        },
        progressLabel: {
          fontSize: 14,
          color: colors.text,
          fontWeight: '500',
        },
        progressCount: {
          fontSize: 16,
          color: colors.primary,
          fontWeight: '700',
        },
        progressBarBg: {
          height: 10,
          backgroundColor: colors.border,
          borderRadius: 5,
          overflow: 'hidden',
        },
        progressBarFill: {
          height: '100%',
          backgroundColor: colors.primary,
          borderRadius: 5,
        },
        // Stats Section
        statsSection: {
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 16,
          marginBottom: 16,
        },
        statsSectionTitle: {
          fontSize: 16,
          fontWeight: '600',
          color: colors.text,
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
          fontSize: 24,
          fontWeight: '700',
          color: colors.primary,
        },
        statLabel: {
          fontSize: 12,
          color: colors.placeholder,
          marginTop: 4,
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
        // Add Player Section
        addPlayerSection: {
          backgroundColor: colors.card,
          borderRadius: 16,
          marginBottom: 16,
          overflow: 'hidden',
        },
        addPlayerHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16,
        },
        addPlayerHeaderLeft: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        addPlayerTitle: {
          fontSize: 16,
          fontWeight: '600',
          color: colors.text,
          marginLeft: 10,
        },
        addPlayerContent: {
          padding: 16,
          paddingTop: 0,
          borderTopWidth: 1,
          borderTopColor: colors.border,
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
          backgroundColor: colors.inputBackground,
          padding: 14,
          marginBottom: 12,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        },
        dropdownText: {
          color: colors.text,
          fontSize: 16,
        },
        placeholderText: {
          color: colors.placeholder,
          fontSize: 16,
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
        // Roster Section
        rosterSection: {
          marginBottom: 16,
        },
        sectionHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 12,
        },
        sectionTitle: {
          fontSize: 18,
          fontWeight: '600',
          color: colors.text,
          marginLeft: 8,
        },
        // Player Card
        playerCard: {
          backgroundColor: colors.card,
          flexDirection: 'row',
          alignItems: 'center',
          padding: 14,
          marginBottom: 10,
          borderRadius: 14,
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 1},
          shadowOpacity: 0.06,
          shadowRadius: 3,
          elevation: 2,
        },
        playerCardSelf: {
          borderWidth: 2,
          borderColor: colors.primary,
        },
        avatar: {
          width: 48,
          height: 48,
          borderRadius: 24,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 14,
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
        playerInfo: {
          flex: 1,
        },
        playerName: {
          fontSize: 16,
          fontWeight: '600',
          color: colors.text,
          marginBottom: 4,
        },
        playerActions: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        editButton: {
          backgroundColor: colors.primary + '15',
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 8,
        },
        editButtonText: {
          color: colors.primary,
          fontWeight: '600',
          fontSize: 13,
        },
        playerDetails: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 6,
        },
        playerBadge: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.background,
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 12,
        },
        playerBadgeText: {
          fontSize: 12,
          color: colors.text,
          marginLeft: 4,
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
          backgroundColor: colors.error + '15',
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 8,
          marginLeft: 10,
        },
        deleteButtonText: {
          color: colors.error,
          fontWeight: '600',
          fontSize: 13,
        },
        emptyState: {
          textAlign: 'center',
          color: colors.placeholder,
          fontSize: 16,
          marginTop: 30,
          marginBottom: 30,
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
          borderRadius: 16,
          padding: 20,
          maxHeight: '70%',
        },
        modalTitle: {
          fontSize: 18,
          fontWeight: '600',
          color: colors.text,
          textAlign: 'center',
          marginBottom: 16,
        },
        modalOption: {
          padding: 14,
          borderRadius: 10,
          marginBottom: 8,
          backgroundColor: colors.background,
          flexDirection: 'row',
          alignItems: 'center',
        },
        modalOptionSelected: {
          backgroundColor: colors.primary + '20',
          borderWidth: 1,
          borderColor: colors.primary,
        },
        modalOptionText: {
          color: colors.text,
          fontSize: 16,
          flex: 1,
        },
        modalOptionTextSelected: {
          color: colors.primary,
          fontWeight: '600',
        },
        modalOptionTextWithMargin: {
          color: colors.text,
          fontSize: 16,
          flex: 1,
          marginLeft: 12,
        },
        colorSwatch: {
          width: 24,
          height: 24,
          borderRadius: 12,
          marginRight: 12,
          borderWidth: 2,
          borderColor: colors.border,
        },
        modalClose: {
          marginTop: 8,
          padding: 14,
          backgroundColor: colors.primary,
          borderRadius: 12,
          alignItems: 'center',
        },
        modalCloseText: {
          color: colors.buttonText,
          fontWeight: '700',
          fontSize: 16,
        },
        modalScrollView: {
          maxHeight: 300,
        },
        progressRemaining: {
          fontSize: 14,
          color: colors.text,
          fontWeight: '500',
          marginTop: 8,
          textAlign: 'center',
        },
        statValueGreen: {
          fontSize: 24,
          fontWeight: '700',
          color: '#4CAF50',
        },
        statValueError: {
          fontSize: 24,
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

  // Fetch roster and event details from backend on mount for freshness
  useEffect(() => {
    const fetchEventData = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${API_BASE_URL}/events/${eventId}`);
        setRoster(response.data.roster || []);
        // Update jersey colors from backend if available
        if (
          response.data.jerseyColors &&
          response.data.jerseyColors.length === 2
        ) {
          setEventJerseyColors(response.data.jerseyColors);
        }
      } catch (error) {
        setRoster([]);
      }
      setLoading(false);
    };
    fetchEventData();
  }, [eventId]);

  // Persist roster to backend
  const persistRoster = async (updatedRoster: Player[]) => {
    try {
      await axios.put(`${API_BASE_URL}/events/${eventId}/roster`, {
        roster: updatedRoster,
      });
    } catch (error) {
      console.error('Error persisting roster:', error);
    }
  };

  // Add player
  const handleSave = async () => {
    if (!username || !paidStatus || !jerseyColor || !position) {
      setErrorMessage('Please fill out all fields.');
      return;
    }
    if (isUserOnRoster) {
      setErrorMessage('You are already on this roster.');
      return;
    }
    setSavingRoster(true);
    const newPlayer: Player = {username, paidStatus, jerseyColor, position};
    const updatedRoster = [...roster, newPlayer];
    setRoster(updatedRoster);
    await persistRoster(updatedRoster);
    updateRosterSpots(eventId, updatedRoster.length);

    setPaidStatus('');
    setJerseyColor('');
    setPosition('');
    setErrorMessage('');
    setAddPlayerExpanded(false);
    setSavingRoster(false);
  };

  // Delete player (only allow logged-in user to remove themselves)
  const handleDelete = async (index: number) => {
    const playerToDelete = roster[index];
    if (!userData?.username || playerToDelete.username !== userData.username) {
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
          const updatedRoster = roster.filter((_, i) => i !== index);
          setRoster(updatedRoster);
          await persistRoster(updatedRoster);
          updateRosterSpots(eventId, updatedRoster.length);
        },
      },
    ]);
  };

  // Open edit modal for current user
  const handleEdit = () => {
    const currentPlayer = roster.find(p => p.username === userData?.username);
    if (currentPlayer) {
      setEditPaidStatus(currentPlayer.paidStatus);
      setEditJerseyColor(currentPlayer.jerseyColor);
      setEditPosition(currentPlayer.position);
      setEditModalVisible(true);
    }
  };

  // Save edited player info
  const handleSaveEdit = async () => {
    if (!editPaidStatus || !editJerseyColor || !editPosition) {
      Alert.alert(t('roster.missingFields'), t('roster.missingFieldsMessage'));
      return;
    }
    const updatedRoster = roster.map(player =>
      player.username === userData?.username
        ? {
            ...player,
            paidStatus: editPaidStatus,
            jerseyColor: editJerseyColor,
            position: editPosition,
          }
        : player,
    );
    setRoster(updatedRoster);
    await persistRoster(updatedRoster);
    setEditModalVisible(false);
  };

  const renderPlayerCard = ({item, index}: {item: Player; index: number}) => {
    const isSelf = item.username === userData?.username;
    const jerseyColorHex = jerseyColors[item.jerseyColor] || jerseyColors.Other;
    const isLight = isLightColor(item.jerseyColor);

    return (
      <View
        style={[
          themedStyles.playerCard,
          isSelf && themedStyles.playerCardSelf,
        ]}>
        <View
          style={[
            themedStyles.avatar,
            {backgroundColor: jerseyColorHex},
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
        <View style={themedStyles.playerInfo}>
          <Text style={themedStyles.playerName}>
            {item.username} {isSelf && '(You)'}
          </Text>
          <View style={themedStyles.playerDetails}>
            {/* Position Badge */}
            <View style={themedStyles.playerBadge}>
              <FontAwesomeIcon icon={faFutbol} size={10} color={colors.text} />
              <Text style={themedStyles.playerBadgeText}>{item.position}</Text>
            </View>
            {/* Paid Status Badge */}
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
                color={item.paidStatus === 'Paid' ? '#4CAF50' : colors.error}
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
            {/* Jersey Color */}
            <View style={themedStyles.playerBadge}>
              <View
                style={[
                  themedStyles.jerseyIndicator,
                  {backgroundColor: jerseyColorHex},
                ]}
              />
              <Text style={themedStyles.playerBadgeText}>
                {item.jerseyColor}
              </Text>
            </View>
          </View>
        </View>
        {isSelf && (
          <View style={themedStyles.playerActions}>
            <TouchableOpacity
              style={themedStyles.editButton}
              onPress={handleEdit}>
              <Text style={themedStyles.editButtonText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={themedStyles.deleteButton}
              onPress={() => handleDelete(index)}>
              <Text style={themedStyles.deleteButtonText}>Leave</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const progressPercentage = Math.min((roster.length / totalSpots) * 100, 100);
  const spotsRemaining = Math.max(totalSpots - roster.length, 0);
  const sportEmoji = sportEmojis[eventType] || '🎯';

  return (
    <SafeAreaView style={themedStyles.safeArea} edges={['top']}>
      <ScrollView
        style={themedStyles.container}
        contentContainerStyle={themedStyles.scrollContent}>
        {/* Event Header */}
        <View style={themedStyles.eventHeader}>
          <Text style={themedStyles.eventEmoji}>{sportEmoji}</Text>
          <Text style={themedStyles.eventName} numberOfLines={2}>
            {eventName}
          </Text>
        </View>

        {/* Event Details Card */}
        <View style={themedStyles.eventCard}>
          <View style={themedStyles.eventTypeRow}>
            <View style={themedStyles.eventTypeBadge}>
              <Text style={themedStyles.eventTypeText}>{eventType}</Text>
            </View>
          </View>

          {date && (
            <View style={themedStyles.eventDetailRow}>
              <Text style={themedStyles.eventDetailIcon}>📅</Text>
              <Text style={themedStyles.eventDetailText}>{date}</Text>
            </View>
          )}
          {time && (
            <View style={themedStyles.eventDetailRow}>
              <Text style={themedStyles.eventDetailIcon}>🕐</Text>
              <Text style={themedStyles.eventDetailText}>{time}</Text>
            </View>
          )}
          {location && (
            <View style={themedStyles.eventDetailRow}>
              <Text style={themedStyles.eventDetailIcon}>📍</Text>
              <Text style={themedStyles.eventDetailText}>{location}</Text>
            </View>
          )}

          {/* Progress Bar */}
          <View style={themedStyles.progressSection}>
            <View style={themedStyles.progressHeader}>
              <Text style={themedStyles.progressLabel}>
                {t('roster.rosterSpots')}
              </Text>
              <Text style={themedStyles.progressCount}>
                {roster.length} / {totalSpots}
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
              {spotsRemaining > 0
                ? t('roster.spotsRemaining', {count: spotsRemaining})
                : t('roster.rosterFull')}
            </Text>
          </View>
        </View>

        {/* Stats Section */}
        {roster.length > 0 && (
          <View style={themedStyles.statsSection}>
            <Text style={themedStyles.statsSectionTitle}>
              📊 {t('roster.rosterStats')}
            </Text>
            <View style={themedStyles.statsRow}>
              <View style={themedStyles.statItem}>
                <Text style={themedStyles.statValue}>{roster.length}</Text>
                <Text style={themedStyles.statLabel}>
                  {t('roster.players')}
                </Text>
              </View>
              <View style={themedStyles.statItem}>
                <Text style={themedStyles.statValueGreen}>
                  {rosterStats.paidCount}
                </Text>
                <Text style={themedStyles.statLabel}>{t('roster.paid')}</Text>
              </View>
              <View style={themedStyles.statItem}>
                <Text style={themedStyles.statValueError}>
                  {rosterStats.unpaidCount}
                </Text>
                <Text style={themedStyles.statLabel}>{t('roster.unpaid')}</Text>
              </View>
            </View>

            {/* Team Breakdown */}
            {Object.keys(rosterStats.teamCounts).length > 1 && (
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
                                jerseyColors[color] || jerseyColors.Other,
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

        {/* Add Player Section (Collapsible) */}
        <View style={themedStyles.addPlayerSection}>
          <TouchableOpacity
            style={themedStyles.addPlayerHeader}
            onPress={() => setAddPlayerExpanded(!addPlayerExpanded)}
            activeOpacity={0.7}>
            <View style={themedStyles.addPlayerHeaderLeft}>
              <FontAwesomeIcon
                icon={faUserPlus}
                size={18}
                color={colors.primary}
              />
              <Text style={themedStyles.addPlayerTitle}>
                {isUserOnRoster
                  ? t('roster.alreadyJoined')
                  : t('roster.joinThisEvent')}
              </Text>
            </View>
            <FontAwesomeIcon
              icon={addPlayerExpanded ? faChevronUp : faChevronDown}
              size={16}
              color={colors.placeholder}
            />
          </TouchableOpacity>

          {addPlayerExpanded && (
            <View style={themedStyles.addPlayerContent}>
              {isUserOnRoster ? (
                <View style={themedStyles.alreadyJoinedBadge}>
                  <FontAwesomeIcon
                    icon={faCheck}
                    size={14}
                    color={colors.primary}
                  />
                  <Text style={themedStyles.alreadyJoinedText}>
                    {t('roster.youreOnTheRoster')}
                  </Text>
                </View>
              ) : (
                <>
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

                  {/* Paid Status Dropdown */}
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

                  {/* Jersey Color Dropdown */}
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
                                jerseyColors[jerseyColor] || jerseyColors.Other,
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
                      (spotsRemaining === 0 || savingRoster) &&
                        themedStyles.saveButtonDisabled,
                    ]}
                    onPress={handleSave}
                    disabled={spotsRemaining === 0 || savingRoster}>
                    {savingRoster ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.buttonText}
                      />
                    ) : (
                      <FontAwesomeIcon
                        icon={faUserPlus}
                        size={16}
                        color={colors.buttonText}
                      />
                    )}
                    <Text style={themedStyles.buttonText}>
                      {savingRoster
                        ? t('common.loading') || 'Joining...'
                        : spotsRemaining === 0
                        ? t('roster.rosterFull')
                        : t('roster.joinEvent')}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </View>

        {/* Rostered Players Section */}
        <View style={themedStyles.rosterSection}>
          <View style={themedStyles.sectionHeader}>
            <FontAwesomeIcon icon={faUsers} size={18} color={colors.primary} />
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
            <FlatList
              data={roster}
              renderItem={renderPlayerCard}
              keyExtractor={(_, idx) => idx.toString()}
              scrollEnabled={false}
            />
          )}
        </View>

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
                      jerseyColor === color && themedStyles.modalOptionSelected,
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
                          position === pos ? colors.primary : colors.placeholder
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
          onRequestClose={() => setEditModalVisible(false)}>
          <View style={themedStyles.modalOverlay}>
            <View style={themedStyles.modalContent}>
              <Text style={themedStyles.modalTitle}>
                ✏️ {t('roster.editYourInfo')}
              </Text>

              {/* Edit Paid Status */}
              <TouchableOpacity
                style={themedStyles.dropdown}
                onPress={() => setEditPaidStatusModalVisible(true)}>
                <Text
                  style={
                    editPaidStatus
                      ? themedStyles.dropdownText
                      : themedStyles.placeholderText
                  }>
                  {editPaidStatus || t('roster.selectPaidStatus')}
                </Text>
                <FontAwesomeIcon
                  icon={faChevronDown}
                  size={14}
                  color={colors.placeholder}
                />
              </TouchableOpacity>

              {/* Edit Jersey Color */}
              <TouchableOpacity
                style={themedStyles.dropdown}
                onPress={() => setEditJerseyColorModalVisible(true)}>
                <View style={themedStyles.jerseyDropdownRow}>
                  {editJerseyColor && (
                    <View
                      style={[
                        themedStyles.jerseyIndicatorLarge,
                        {
                          backgroundColor:
                            jerseyColors[editJerseyColor] || jerseyColors.Other,
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
                  icon={faChevronDown}
                  size={14}
                  color={colors.placeholder}
                />
              </TouchableOpacity>

              {/* Edit Position */}
              <TouchableOpacity
                style={themedStyles.dropdown}
                onPress={() => setEditPositionModalVisible(true)}>
                <Text
                  style={
                    editPosition
                      ? themedStyles.dropdownText
                      : themedStyles.placeholderText
                  }>
                  {editPosition || t('roster.selectPosition')}
                </Text>
                <FontAwesomeIcon
                  icon={faChevronDown}
                  size={14}
                  color={colors.placeholder}
                />
              </TouchableOpacity>

              {/* Save & Cancel Buttons */}
              <TouchableOpacity
                style={themedStyles.saveButton}
                onPress={handleSaveEdit}>
                <FontAwesomeIcon
                  icon={faCheck}
                  size={18}
                  color={colors.buttonText}
                />
                <Text style={themedStyles.buttonText}>
                  {t('roster.saveChanges')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  themedStyles.modalClose,
                  {backgroundColor: colors.border},
                ]}
                onPress={() => setEditModalVisible(false)}>
                <Text
                  style={[themedStyles.modalCloseText, {color: colors.text}]}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Edit Paid Status Modal */}
        <Modal
          visible={editPaidStatusModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setEditPaidStatusModalVisible(false)}>
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
                    editPaidStatus === status &&
                      themedStyles.modalOptionSelected,
                  ]}
                  onPress={() => {
                    setEditPaidStatus(status);
                    setEditPaidStatusModalVisible(false);
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
                      themedStyles.modalOptionTextWithMargin,
                      editPaidStatus === status &&
                        themedStyles.modalOptionTextSelected,
                    ]}>
                    {status}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={themedStyles.modalClose}
                onPress={() => setEditPaidStatusModalVisible(false)}>
                <Text style={themedStyles.modalCloseText}>
                  {t('common.close')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Edit Jersey Color Modal */}
        <Modal
          visible={editJerseyColorModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setEditJerseyColorModalVisible(false)}>
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
                      editJerseyColor === color &&
                        themedStyles.modalOptionSelected,
                    ]}
                    onPress={() => {
                      setEditJerseyColor(color);
                      setEditJerseyColorModalVisible(false);
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
                        editJerseyColor === color &&
                          themedStyles.modalOptionTextSelected,
                      ]}>
                      {color}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={themedStyles.modalClose}
                onPress={() => setEditJerseyColorModalVisible(false)}>
                <Text style={themedStyles.modalCloseText}>
                  {t('common.close')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Edit Position Modal */}
        <Modal
          visible={editPositionModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setEditPositionModalVisible(false)}>
          <View style={themedStyles.modalOverlay}>
            <View style={themedStyles.modalContent}>
              <Text style={themedStyles.modalTitle}>
                {t('roster.selectPosition')}
              </Text>
              <ScrollView style={themedStyles.modalScrollView}>
                {(positionOptions[eventType] || positionOptions.Default).map(
                  pos => (
                    <TouchableOpacity
                      key={pos}
                      style={[
                        themedStyles.modalOption,
                        editPosition === pos &&
                          themedStyles.modalOptionSelected,
                      ]}
                      onPress={() => {
                        setEditPosition(pos);
                        setEditPositionModalVisible(false);
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
                          themedStyles.modalOptionTextWithMargin,
                          editPosition === pos &&
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
                onPress={() => setEditPositionModalVisible(false)}>
                <Text style={themedStyles.modalCloseText}>
                  {t('common.close')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
};

export default EventRoster;
