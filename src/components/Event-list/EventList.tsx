import React, {useState, useContext, useMemo} from 'react';
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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Picker} from '@react-native-picker/picker';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {faPlus, faTrash, faCog} from '@fortawesome/free-solid-svg-icons';
import {useNavigation, NavigationProp} from '@react-navigation/native';
import HamburgerMenu from '../HamburgerMenu/HamburgerMenu';
import UserContext, {UserContextType} from '../UserContext';
import {useTheme} from '../ThemeContext/ThemeContext';

export type RootStackParamList = {
  EventList: undefined;
  EventRoster: {
    eventId: string;
    eventType: string;
    updateRoster: (eventId: string, playerAdded: boolean) => void;
  };
  Profile: {_id: string};
};

interface Event {
  id: string;
  name: string;
  location: string;
  time: string;
  date: string;
  rosterSpotsFilled: number;
  totalSpots: number;
  eventType: string;
  createdBy: string;
}

// Dynamic array for roster sizes from 1 to 30
const rosterSizeOptions: string[] = Array.from({length: 30}, (_, i) =>
  (i + 1).toString(),
);

const initialEventData: Event[] = [
  {
    id: '1',
    name: 'Open Hockey Session',
    location: 'Sportscare Arena',
    time: '1:30-2:30pm',
    date: '09/15/2024',
    rosterSpotsFilled: 0,
    totalSpots: 20,
    eventType: 'Hockey',
    createdBy: '123', // sample creator id
  },
  {
    id: '2',
    name: 'Skating Practice',
    location: 'Main Rink',
    time: '3:00-4:00pm',
    date: '09/16/2024',
    rosterSpotsFilled: 0,
    totalSpots: 15,
    eventType: 'Figure Skating',
    createdBy: '456', // another user id
  },
];

const EventList: React.FC = () => {
  const {userData} = useContext(UserContext) as UserContextType;
  const {colors} = useTheme();

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
        },
        title: {
          fontSize: 25,
          color: colors.text,
          textAlign: 'center',
          flex: 1,
        },
        card: {
          backgroundColor: colors.card,
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: colors.text,
          shadowOffset: {width: 0, height: 2},
          shadowOpacity: 0.08,
          shadowRadius: 6,
          elevation: 3,
        },
        cardText: {
          color: colors.text,
          marginBottom: 8,
          fontSize: 16,
        },
        addButton: {
          paddingHorizontal: 20,
          paddingVertical: 10,
          zIndex: 1,
          backgroundColor: colors.primary,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
        },
        modalView: {
          flex: 1,
          justifyContent: 'center',
          padding: 20,
          backgroundColor: colors.background,
        },
        modalInput: {
          backgroundColor: colors.inputBackground || '#fff',
          color: colors.text,
          padding: 12,
          marginBottom: 16,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.border,
          fontSize: 16,
        },
        saveButton: {
          backgroundColor: colors.primary,
          padding: 12,
          borderRadius: 8,
          marginVertical: 5,
          flex: 1,
          alignItems: 'center',
          marginHorizontal: 8,
          minWidth: 100,
        },
        cancelButton: {
          backgroundColor: colors.error || '#b11313',
        },
        buttonText: {
          color: colors.buttonText || '#fff',
          textAlign: 'center',
          fontWeight: 'bold',
          fontSize: 16,
        },
        modalHeader: {
          color: colors.primary,
          fontSize: 20,
          marginBottom: 16,
          textAlign: 'center',
          fontWeight: 'bold',
        },
        iconContainer: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          marginTop: 10,
        },
        iconButton: {
          marginLeft: 10,
        },
        buttonContainer: {
          flexDirection: 'row',
          justifyContent: 'center',
          marginTop: 20,
          alignItems: 'center',
        },
        confirmButton: {
          color: colors.primary,
          textAlign: 'center',
          marginTop: 10,
          marginBottom: 16,
          fontSize: 16,
          fontWeight: 'bold',
        },
        picker: {
          backgroundColor: colors.inputBackground || '#fff',
          color: colors.text,
          borderRadius: 8,
          marginBottom: 16,
        },
      }),
    [colors],
  );

  const [eventData, setEventData] = useState(initialEventData);
  const [modalVisible, setModalVisible] = useState(false);
  const [newEvent, setNewEvent] = useState({
    name: '',
    location: '',
    time: '',
    date: '',
    totalSpots: '', // will be selected via modal
    eventType: '', // will be selected via modal
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState<Date | undefined>(new Date());

  // State for roster size and event type selectors
  const [showRosterSizePicker, setShowRosterSizePicker] = useState(false);
  const [tempRosterSize, setTempRosterSize] = useState(
    newEvent.totalSpots || '',
  );
  const [showEventTypePicker, setShowEventTypePicker] = useState(false);
  const [tempEventType, setTempEventType] = useState(newEvent.eventType || '');

  const navigation = useNavigation<NavigationProp<any>>();

  const onDateChange = (evt: any, selectedDate?: Date) => {
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const onTimeChange = (evt: any, selectedTime?: Date) => {
    if (selectedTime) {
      const roundedTime = new Date(
        Math.ceil(selectedTime.getTime() / (15 * 1000)) * 15 * 1000,
      );
      setTime(roundedTime);
    }
  };

  const handleSaveNewEvent = () => {
    if (
      newEvent.name &&
      newEvent.location &&
      newEvent.time &&
      newEvent.date &&
      newEvent.totalSpots &&
      newEvent.eventType
    ) {
      const id = (eventData.length + 1).toString();
      setEventData(prevData => [
        ...prevData,
        {
          id,
          name: newEvent.name,
          location: newEvent.location,
          time: newEvent.time,
          date: newEvent.date,
          totalSpots: parseInt(newEvent.totalSpots, 10),
          rosterSpotsFilled: 0,
          eventType: newEvent.eventType,
          createdBy: userData?._id || '', // set createdBy from userData
        },
      ]);
      setModalVisible(false);
      setNewEvent({
        name: '',
        location: '',
        time: '',
        date: '',
        totalSpots: '',
        eventType: '',
      });
      setTempRosterSize('');
      setTempEventType('');
    } else {
      Alert.alert('Missing Fields', 'Please fill in all fields.');
    }
  };

  const handleEventPress = (eventId: string, eventType: string) => {
    navigation.navigate('EventRoster', {eventId, eventType, updateRoster});
  };

  const updateRoster = (eventId: string, playerAdded: boolean) => {
    setEventData(prevData =>
      prevData.map(event =>
        event.id === eventId
          ? {
              ...event,
              rosterSpotsFilled:
                event.rosterSpotsFilled + (playerAdded ? 1 : -1),
            }
          : event,
      ),
    );
  };

  const handleDeleteEvent = (event: Event) => {
    if (event.createdBy !== (userData?._id || '')) {
      Alert.alert('Not Authorized', 'You can only delete events you created.');
      return;
    }
    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setEventData(prevData => prevData.filter(e => e.id !== event.id));
          },
        },
      ],
      {cancelable: true},
    );
  };

  const handleEditEvent = (event: Event) => {
    setNewEvent({
      name: event.name,
      location: event.location,
      time: event.time,
      date: event.date,
      totalSpots: event.totalSpots.toString(),
      eventType: event.eventType,
    });
    setModalVisible(true);
    setTempRosterSize(event.totalSpots.toString());
    setTempEventType(event.eventType);
  };

  const renderEventCard = ({item}: {item: Event}) => (
    <View style={themedStyles.card}>
      <TouchableOpacity
        onPress={() => handleEventPress(item.id, item.eventType)}>
        <Text style={themedStyles.cardText}>{item.name}</Text>
        <Text style={themedStyles.cardText}>{item.location}</Text>
        <Text style={themedStyles.cardText}>{item.time}</Text>
        <Text style={themedStyles.cardText}>{item.date}</Text>
        <Text style={themedStyles.cardText}>
          {item.rosterSpotsFilled}/{item.totalSpots} roster spots filled
        </Text>
      </TouchableOpacity>
      <View style={themedStyles.iconContainer}>
        <TouchableOpacity
          style={themedStyles.iconButton}
          onPress={() => handleEditEvent(item)}>
          <FontAwesomeIcon icon={faCog} size={20} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={themedStyles.iconButton}
          onPress={() => handleDeleteEvent(item)}>
          <FontAwesomeIcon icon={faTrash} size={20} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={themedStyles.container}>
      {/* Header */}
      <View style={themedStyles.header}>
        <HamburgerMenu />
        <Text style={themedStyles.title}>Event List</Text>
        <TouchableOpacity
          style={themedStyles.addButton}
          onPress={() => setModalVisible(true)}>
          <FontAwesomeIcon
            icon={faPlus}
            size={20}
            color={colors.buttonText || '#fff'}
          />
        </TouchableOpacity>
      </View>

      <FlatList
        data={eventData}
        renderItem={renderEventCard}
        keyExtractor={item => item.id}
      />

      <Modal animationType="slide" transparent={true} visible={modalVisible}>
        <View style={themedStyles.modalView}>
          <Text style={themedStyles.modalHeader}>Create New Event</Text>

          <TextInput
            style={themedStyles.modalInput}
            placeholder="Event Name"
            placeholderTextColor={colors.placeholder || '#888'}
            value={newEvent.name}
            onChangeText={text => setNewEvent({...newEvent, name: text})}
          />
          <TextInput
            style={themedStyles.modalInput}
            placeholder="Location/Facility"
            placeholderTextColor={colors.placeholder || '#888'}
            value={newEvent.location}
            onChangeText={text => setNewEvent({...newEvent, location: text})}
          />

          {/* Event Date selector */}
          <TouchableOpacity
            style={themedStyles.modalInput}
            onPress={() => setShowDatePicker(true)}>
            <Text
              style={{color: newEvent.date ? colors.text : colors.placeholder}}>
              {newEvent.date ? newEvent.date : 'Select Event Date'}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <View>
              <DateTimePicker
                value={date || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onDateChange}
                textColor={colors.text}
              />
              <TouchableOpacity
                onPress={() => {
                  setNewEvent({...newEvent, date: date?.toDateString()});
                  setShowDatePicker(false);
                }}>
                <Text style={themedStyles.confirmButton}>Confirm Date</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Event Time selector */}
          <TouchableOpacity
            style={themedStyles.modalInput}
            onPress={() => setShowTimePicker(true)}>
            <Text
              style={{color: newEvent.time ? colors.text : colors.placeholder}}>
              {newEvent.time ? newEvent.time : 'Select Event Time'}
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
              />
              <TouchableOpacity
                onPress={() => {
                  setNewEvent({
                    ...newEvent,
                    time: time?.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                  });
                  setShowTimePicker(false);
                }}>
                <Text style={themedStyles.confirmButton}>Confirm Time</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Roster Size selector using dynamic rosterSizeOptions */}
          <TouchableOpacity
            style={themedStyles.modalInput}
            onPress={() => {
              setShowRosterSizePicker(true);
              setTempRosterSize(newEvent.totalSpots || '');
            }}>
            <Text
              style={{
                color: newEvent.totalSpots ? colors.text : colors.placeholder,
              }}>
              {newEvent.totalSpots ? newEvent.totalSpots : 'Select Roster Size'}
            </Text>
          </TouchableOpacity>
          {showRosterSizePicker && (
            <View>
              <Picker
                selectedValue={tempRosterSize}
                onValueChange={itemValue => setTempRosterSize(itemValue)}
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
              <TouchableOpacity
                onPress={() => {
                  setNewEvent({...newEvent, totalSpots: tempRosterSize});
                  setShowRosterSizePicker(false);
                }}>
                <Text style={themedStyles.confirmButton}>
                  Confirm Roster Size
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Event Type selector */}
          <TouchableOpacity
            style={themedStyles.modalInput}
            onPress={() => {
              setShowEventTypePicker(true);
              setTempEventType(newEvent.eventType || '');
            }}>
            <Text
              style={{
                color: newEvent.eventType ? colors.text : colors.placeholder,
              }}>
              {newEvent.eventType ? newEvent.eventType : 'Select Event Type'}
            </Text>
          </TouchableOpacity>
          {showEventTypePicker && (
            <View>
              <Picker
                selectedValue={tempEventType}
                onValueChange={itemValue => setTempEventType(itemValue)}
                style={themedStyles.picker}
                dropdownIconColor={colors.text}>
                {['Hockey', 'Figure Skating', 'Soccer', 'Basketball'].map(
                  value => (
                    <Picker.Item
                      key={value}
                      label={value}
                      value={value}
                      color={colors.text}
                    />
                  ),
                )}
              </Picker>
              <TouchableOpacity
                onPress={() => {
                  setNewEvent({...newEvent, eventType: tempEventType});
                  setShowEventTypePicker(false);
                }}>
                <Text style={themedStyles.confirmButton}>
                  Confirm Event Type
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={themedStyles.buttonContainer}>
            <TouchableOpacity
              style={themedStyles.saveButton}
              onPress={handleSaveNewEvent}>
              <Text style={themedStyles.buttonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[themedStyles.saveButton, themedStyles.cancelButton]}
              onPress={() => setModalVisible(false)}>
              <Text style={themedStyles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default EventList;
