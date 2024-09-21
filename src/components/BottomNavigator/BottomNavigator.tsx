import React, {useContext} from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createStackNavigator} from '@react-navigation/stack';
import EventList from '../Event-list/EventList';
import EventRoster from '../Event-roster/EventRoster';
import Profile from '../Profile/Profile';
import CommunityNotes from '../Communitynotes/CommunityNotes';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faUsers,
  faUser,
  faStickyNote,
  faQuestion,
} from '@fortawesome/free-solid-svg-icons';
import {UserContextType} from '../UserContext';
import UserContext from '../UserContext';
import {IconDefinition} from '@fortawesome/fontawesome-svg-core';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Move TabBarIcon outside of BottomNavigator
const TabBarIcon = ({
  icon,
  color,
  size,
}: {
  icon: IconDefinition;
  color: string;
  size: number;
}) => {
  return <FontAwesomeIcon icon={icon} size={size} color={color} />;
};

// Screen options outside of BottomNavigator
const screenOptions = ({route}: {route: any}) => ({
  headerShown: false,
  tabBarLabel: () => null,
  tabBarStyle: {
    backgroundColor: '#02131D',
    borderTopColor: '#fff',
    paddingBottom: 10,
    paddingTop: 10,
  },
  tabBarIcon: (props: {color: string; size: number}) => {
    const iconMap: Record<string, IconDefinition> = {
      Event: faUsers,
      Profile: faUser,
      CommunityNotes: faStickyNote,
    };

    const icon = iconMap[route.name] || faQuestion;
    return <TabBarIcon icon={icon} color={props.color} size={props.size} />;
  },
});

// Stack Navigator for Event-related screens
const EventStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {backgroundColor: '#02131D'},
        headerTintColor: '#fff',
      }}>
      <Stack.Screen name="EventList" component={EventList} />
      <Stack.Screen name="EventRoster" component={EventRoster} />
    </Stack.Navigator>
  );
};

const BottomNavigator: React.FC = () => {
  const {userData} = useContext(UserContext) as UserContextType;

  if (!userData) {
    throw new Error('BottomNavigator must be used within a UserProvider');
  }

  const userId = userData?._id;

  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen name="Event" component={EventStack} />
      <Tab.Screen
        name="Profile"
        component={Profile}
        initialParams={{_id: userId}}
      />
      <Tab.Screen name="CommunityNotes" component={CommunityNotes} />
    </Tab.Navigator>
  );
};

export default BottomNavigator;
