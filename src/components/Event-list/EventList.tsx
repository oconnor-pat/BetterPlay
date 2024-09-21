import React from 'react';
import {View, Text, FlatList, TouchableOpacity, StyleSheet} from 'react-native';
import {useNavigation, NavigationProp} from '@react-navigation/native';

// EventList.tsx
export type RootStackParamList = {
  EventList: undefined;
  EventRoster: {eventId: string};
  Profile: {_id: string};
};

// Example event data
const eventData = [
  {
    id: '1',
    name: 'Open Hockey Session',
    location: 'Sportscare Arena',
    time: '1:30-2:30pm',
    date: '09/15/2024',
  },
  {
    id: '2',
    name: 'Skating Practice',
    location: 'Main Rink',
    time: '3:00-4:00pm',
    date: '09/16/2024',
  },
];

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#02131D',
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
});

// EventList Component (Displays Event Cards)
const EventList: React.FC = () => {
  const navigation = useNavigation<NavigationProp<any>>();

  const handleEventPress = (eventId: string) => {
    // Navigate to the EventRoster when an event card is clicked
    navigation.navigate('EventRoster', {eventId});
  };

  const renderEventCard = ({item}: {item: any}) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleEventPress(item.id)}>
      <Text style={styles.cardText}>{item.name}</Text>
      <Text style={styles.cardText}>{item.location}</Text>
      <Text style={styles.cardText}>{item.time}</Text>
      <Text style={styles.cardText}>{item.date}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={eventData}
        renderItem={renderEventCard}
        keyExtractor={item => item.id}
      />
    </View>
  );
};

export default EventList;
