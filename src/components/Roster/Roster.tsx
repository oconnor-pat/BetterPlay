import React, {useState, useEffect} from 'react';
import {View, Text, FlatList, StyleSheet, TouchableOpacity} from 'react-native';
import {useNavigation, NavigationProp} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import CustomHeader from '../CustomHeader';
import {LandingPageParamList} from '../CustomHeader';

// Interfaces
interface RosterItem {
  id: string;
  username: string;
  attending: string;
  paid: string;
  nextSession: string;
}

interface User {
  _id: string;
  username: string;
}

export type RootStackParamList = {
  Profile: {_id: any};
  Roster: undefined;
};

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
    color: 'green',
  },

  notAttendingText: {
    color: 'red',
  },

  paidText: {
    color: 'green',
  },

  notPaidText: {
    color: 'red',
  },

  viewProfileButton: {
    backgroundColor: '#b11313',
    borderRadius: 5,
    padding: 8,
  },
  buttonText: {
    color: '#fff',
  },
  customHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});

// Function to get the roster data
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
    // Add mock data for the other fields
    const rosterWithMockData = data.users.map((user: User) => ({
      id: user._id,
      username: user.username,
      attending: 'Yes',
      paid: 'No',
      nextSession: 'Session 1',
    }));
    return rosterWithMockData;
  } catch (error) {
    console.error('Error fetching roster data:', error);
    throw error;
  }
};

const Roster: React.FC = () => {
  // Initialize roster state with empty array of RosterItem
  const [roster, setRoster] = useState<RosterItem[]>([]);

  // Get the navigation prop from the hook
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  // Get the navigation prop from the hook for the custom header
  const LaningPageNavigation =
    useNavigation<NavigationProp<LandingPageParamList>>();

  const handleViewProfile = (userId: string) => {
    // Navigate to the profile component with the user ID
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
        <Text style={styles.cell}>{item.attending}</Text>
        <Text style={styles.cell}>{item.paid}</Text>
        <Text style={styles.cell}>{item.nextSession}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <CustomHeader
        navigation={LaningPageNavigation}
        style={styles.customHeader}
      />
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
