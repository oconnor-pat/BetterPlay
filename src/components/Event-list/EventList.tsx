import React, {useState} from 'react';
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
  },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#02131D',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 25,
    color: '#fff',
    textAlign: 'center',
    flex: 1,
  },
  card: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  cardText: {
    color: '#fff',
    marginBottom: 8,
  },
  addButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    zIndex: 1,
  },
  modalView: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#02131D',
  },
  modalInput: {
    backgroundColor: '#fff',
    padding: 8,
    marginBottom: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  saveButton: {
    backgroundColor: '#b11313',
    padding: 10,
    borderRadius: 5,
    marginVertical: 5,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
  },
  modalHeader: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 16,
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
    justifyContent: 'space-between',
    marginTop: 20,
  },
  confirmButton: {
    color: '#b11313',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 16,
    fontSize: 16,
  },
});

const EventList: React.FC = () => {
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
      // Reset temporary picker values
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

  const handleDeleteEvent = (eventId: string) => {
    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setEventData(prevData =>
              prevData.filter(event => event.id !== eventId),
            );
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
    <View style={styles.card}>
      <TouchableOpacity
        onPress={() => handleEventPress(item.id, item.eventType)}>
        <Text style={styles.cardText}>{item.name}</Text>
        <Text style={styles.cardText}>{item.location}</Text>
        <Text style={styles.cardText}>{item.time}</Text>
        <Text style={styles.cardText}>{item.date}</Text>
        <Text style={styles.cardText}>
          {item.rosterSpotsFilled}/{item.totalSpots} roster spots filled
        </Text>
      </TouchableOpacity>
      <View style={styles.iconContainer}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => handleEditEvent(item)}>
          <FontAwesomeIcon icon={faCog} size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => handleDeleteEvent(item.id)}>
          <FontAwesomeIcon icon={faTrash} size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <HamburgerMenu />
        <Text style={styles.title}>Event List</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}>
          <FontAwesomeIcon icon={faPlus} size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={eventData}
        renderItem={renderEventCard}
        keyExtractor={item => item.id}
      />

      <Modal animationType="slide" transparent={true} visible={modalVisible}>
        <View style={styles.modalView}>
          <Text style={styles.modalHeader}>Create New Event</Text>

          <TextInput
            style={styles.modalInput}
            placeholder="Event Name"
            value={newEvent.name}
            onChangeText={text => setNewEvent({...newEvent, name: text})}
          />
          <TextInput
            style={styles.modalInput}
            placeholder="Location/Facility"
            value={newEvent.location}
            onChangeText={text => setNewEvent({...newEvent, location: text})}
          />

          {/* Event Date selector */}
          <TouchableOpacity
            style={styles.modalInput}
            onPress={() => setShowDatePicker(true)}>
            <Text>{newEvent.date ? newEvent.date : 'Select Event Date'}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <View>
              <DateTimePicker
                value={date || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onDateChange}
                textColor="#fff"
              />
              <TouchableOpacity
                onPress={() => {
                  setNewEvent({...newEvent, date: date?.toDateString()});
                  setShowDatePicker(false);
                }}>
                <Text style={styles.confirmButton}>Confirm Date</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Event Time selector */}
          <TouchableOpacity
            style={styles.modalInput}
            onPress={() => setShowTimePicker(true)}>
            <Text>{newEvent.time ? newEvent.time : 'Select Event Time'}</Text>
          </TouchableOpacity>
          {showTimePicker && (
            <View>
              <DateTimePicker
                value={time || new Date()}
                mode="time"
                minuteInterval={15}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onTimeChange}
                textColor="#fff"
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
                <Text style={styles.confirmButton}>Confirm Time</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Roster Size selector using dynamic rosterSizeOptions */}
          <TouchableOpacity
            style={styles.modalInput}
            onPress={() => {
              setShowRosterSizePicker(true);
              setTempRosterSize(newEvent.totalSpots || '');
            }}>
            <Text>
              {newEvent.totalSpots ? newEvent.totalSpots : 'Select Roster Size'}
            </Text>
          </TouchableOpacity>
          {showRosterSizePicker && (
            <View>
              <Picker
                selectedValue={tempRosterSize}
                onValueChange={itemValue => setTempRosterSize(itemValue)}>
                {rosterSizeOptions.map(value => (
                  <Picker.Item
                    key={value}
                    label={value}
                    value={value}
                    color="#fff"
                  />
                ))}
              </Picker>
              <TouchableOpacity
                onPress={() => {
                  setNewEvent({...newEvent, totalSpots: tempRosterSize});
                  setShowRosterSizePicker(false);
                }}>
                <Text style={styles.confirmButton}>Confirm Roster Size</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Event Type selector */}
          <TouchableOpacity
            style={styles.modalInput}
            onPress={() => {
              setShowEventTypePicker(true);
              setTempEventType(newEvent.eventType || '');
            }}>
            <Text>
              {newEvent.eventType ? newEvent.eventType : 'Select Event Type'}
            </Text>
          </TouchableOpacity>
          {showEventTypePicker && (
            <View>
              <Picker
                selectedValue={tempEventType}
                onValueChange={itemValue => setTempEventType(itemValue)}>
                {['Hockey', 'Figure Skating', 'Soccer', 'Basketball'].map(
                  value => (
                    <Picker.Item
                      key={value}
                      label={value}
                      value={value}
                      color="#fff"
                    />
                  ),
                )}
              </Picker>
              <TouchableOpacity
                onPress={() => {
                  setNewEvent({...newEvent, eventType: tempEventType});
                  setShowEventTypePicker(false);
                }}>
                <Text style={styles.confirmButton}>Confirm Event Type</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveNewEvent}>
              <Text style={styles.buttonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={() => setModalVisible(false)}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default EventList;
