import React, {useState, useEffect} from 'react';
import {View, Text, FlatList, StyleSheet, TouchableOpacity} from 'react-native';
import {useNavigation, NavigationProp} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import CustomHeader from '../CustomHeader';

// Interfaces
interface RosterItem {
  id: string;
  username: string;
  attending: string;
  paid: string;
  nextSession: string;
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#02131D',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#447bbe',
    paddingVertical: 8,
    marginBottom: 8,
  },
  headerCell: {
    flex: 1,
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#ccc',
    paddingVertical: 8,
  },
  cell: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
  },
  attendingText: {
    flex: 1,
    color: 'green',
    textAlign: 'center',
  },
  notAttendingText: {
    flex: 1,
    color: 'red',
    textAlign: 'center',
  },
  paidText: {
    flex: 1,
    color: 'green',
    textAlign: 'center',
  },
  notPaidText: {
    flex: 1,
    color: 'red',
    textAlign: 'center',
  },
});

// Fetch roster data
const fetchRosterData = async () => {
  try {
    const response = await fetch(
      'https://omhl-be-9801a7de15ab.herokuapp.com/users',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.users.map((user: {_id: string; username: string}) => ({
      id: user._id,
      username: user.username,
      attending: 'Yes', // Mock data, adjust this based on real data
      paid: 'No', // Mock data, adjust this based on real data
      nextSession: 'Session 1', // Mock data, adjust this based on real data
    }));
  } catch (error) {
    console.error('Error fetching roster data:', error);
    throw error;
  }
};

const Roster: React.FC = () => {
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const navigation = useNavigation<NavigationProp<any>>();

  const handleViewProfile = (userId: string) => {
    navigation.navigate('Profile', {_id: userId});
  };

  useEffect(() => {
    fetchRosterData()
      .then(data => setRoster(data))
      .catch(error => console.error(error));
  }, []);

  const renderItem = ({item}: {item: RosterItem}) => (
    <TouchableOpacity onPress={() => handleViewProfile(item.id)}>
      <View style={styles.row}>
        <Text style={styles.cell}>{item.username}</Text>
        <Text
          style={
            item.attending.toLowerCase() === 'yes'
              ? styles.attendingText
              : styles.notAttendingText
          }>
          {item.attending}
        </Text>
        <Text
          style={
            item.paid.toLowerCase() === 'yes'
              ? styles.paidText
              : styles.notPaidText
          }>
          {item.paid}
        </Text>
        <Text style={styles.cell}>{item.nextSession}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <CustomHeader navigation={navigation} />
      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={styles.headerCell}>Username</Text>
        <Text style={styles.headerCell}>Attending</Text>
        <Text style={styles.headerCell}>Paid</Text>
        <Text style={styles.headerCell}>Next Session</Text>
      </View>

      {/* Roster data */}
      <FlatList
        data={roster}
        renderItem={renderItem}
        keyExtractor={item => item.id}
      />
    </SafeAreaView>
  );
};

export default Roster;
