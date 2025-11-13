import React, {useContext} from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createStackNavigator} from '@react-navigation/stack';
import EventList from '../EventList/EventList';
import EventRoster from '../EventRoster/EventRoster';
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
import {useTheme} from '../ThemeContext/ThemeContext';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

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

// Helper function to generate tabBarIcon renderer with theme colors
function createTabBarIcon(colors: {primary: string; text: string}) {
  // This function is stable and can be reused
  return function tabBarIcon({
    route,
    focused,
    size,
  }: {
    route: {name: string};
    focused: boolean;
    size: number;
  }) {
    const iconMap: Record<string, IconDefinition> = {
      Event: faUsers,
      Profile: faUser,
      CommunityNotes: faStickyNote,
    };
    const icon = iconMap[route.name] || faQuestion;
    const iconColor = focused ? colors.primary : colors.text;
    return <TabBarIcon icon={icon} color={iconColor} size={size} />;
  };
}

// Stack Navigator for Event-related screens
const EventStack = () => {
  const {colors} = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {backgroundColor: colors.card},
        headerTintColor: colors.text,
      }}>
      <Stack.Screen
        name="EventList"
        component={EventList}
        options={{headerShown: false}}
      />
      <Stack.Screen name="EventRoster" component={EventRoster} />
    </Stack.Navigator>
  );
};

const BottomNavigator: React.FC = () => {
  const {userData} = useContext(UserContext) as UserContextType;
  const {colors} = useTheme();

  if (!userData) {
    // Prevent crash during sign out navigation transition
    return null;
  }

  const userId = userData?._id;

  // Create a stable tabBarIcon renderer with current theme colors
  const themedTabBarIcon = ({
    route,
    focused,
    size,
  }: {
    route: {name: string};
    focused: boolean;
    size: number;
  }) => createTabBarIcon(colors)({route, focused, size});

  // Dynamic screen options using theme colors
  const screenOptions = ({route}: {route: any}) => ({
    headerShown: false,
    tabBarLabel: () => null,
    tabBarStyle: {
      backgroundColor: colors.card,
      borderTopColor: colors.border,
      paddingBottom: 10,
      paddingTop: 10,
    },
    tabBarIcon: (props: {color: string; size: number; focused: boolean}) =>
      themedTabBarIcon({route, focused: props.focused, size: props.size}),
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.text,
  });

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
