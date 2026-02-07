import React, {useContext, useEffect, useRef} from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createStackNavigator} from '@react-navigation/stack';
import EventList from '../EventList/EventList';
import EventRoster from '../EventRoster/EventRoster';
import Profile from '../Profile/Profile';
import PublicProfile from '../Profile/PublicProfile';
import {VenueList, VenueDetail, SpaceDetail} from '../Venues';
import {UserSearch} from '../UserSearch';
import {FriendsList, FriendRequests} from '../Friends';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faMapMarkerAlt,
  faBuilding,
  faUser,
  faQuestion,
} from '@fortawesome/free-solid-svg-icons';
import {UserContextType} from '../UserContext';
import UserContext from '../UserContext';
import {IconDefinition} from '@fortawesome/fontawesome-svg-core';
import {useTheme} from '../ThemeContext/ThemeContext';
import {useNotifications} from '../../Context/NotificationContext';

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
      Local: faMapMarkerAlt,
      Venues: faBuilding,
      Profile: faUser,
    };
    const icon = iconMap[route.name] || faQuestion;
    const iconColor = focused ? colors.primary : colors.text;
    return <TabBarIcon icon={icon} color={iconColor} size={size} />;
  };
}

// Stack Navigator for Local Events screens
const LocalEventsStack = () => {
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
      <Stack.Screen
        name="EventRoster"
        component={EventRoster}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="PublicProfile"
        component={PublicProfile}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="UserSearch"
        component={UserSearch}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
};

// Stack Navigator for Venue-related screens
const VenueStack = () => {
  const {colors} = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {backgroundColor: colors.card},
        headerTintColor: colors.text,
      }}>
      <Stack.Screen
        name="VenueList"
        component={VenueList}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="VenueDetail"
        component={VenueDetail}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="SpaceDetail"
        component={SpaceDetail}
        options={{headerShown: false}}
      />
    </Stack.Navigator>
  );
};

// Stack Navigator for Profile screens
const ProfileStack = ({userId}: {userId: string}) => {
  const {colors} = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {backgroundColor: colors.card},
        headerTintColor: colors.text,
      }}>
      <Stack.Screen
        name="ProfileMain"
        component={Profile}
        options={{headerShown: false}}
        initialParams={{_id: userId}}
      />
      <Stack.Screen
        name="UserSearch"
        component={UserSearch}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="PublicProfile"
        component={PublicProfile}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="FriendsList"
        component={FriendsList}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="FriendRequests"
        component={FriendRequests}
        options={{headerShown: false}}
      />
    </Stack.Navigator>
  );
};

const BottomNavigator: React.FC = () => {
  const {userData} = useContext(UserContext) as UserContextType;
  const {colors} = useTheme();
  const {hasPermission, isInitialized, requestPermission} = useNotifications();
  const hasPromptedRef = useRef(false);

  // Request notification permission after login (once per session)
  useEffect(() => {
    if (
      isInitialized &&
      !hasPermission &&
      !hasPromptedRef.current &&
      userData
    ) {
      hasPromptedRef.current = true;
      // Small delay to let the user see the main screen first
      const timer = setTimeout(() => {
        requestPermission();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isInitialized, hasPermission, requestPermission, userData]);

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
      <Tab.Screen name="Local" component={LocalEventsStack} />
      <Tab.Screen name="Venues" component={VenueStack} />
      <Tab.Screen name="Profile">
        {() => <ProfileStack userId={userId} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

export default BottomNavigator;
