import React, {useContext, useEffect, useRef} from 'react';
import {Platform, StyleSheet, View} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createStackNavigator} from '@react-navigation/stack';
import EventList from '../EventList/EventList';
import EventRoster from '../EventRoster/EventRoster';
import Profile from '../Profile/Profile';
import PublicProfile from '../Profile/PublicProfile';
import {VenueList, VenueDetail, SpaceDetail} from '../Venues';
import {UserSearch} from '../UserSearch';
import {FriendsList, FriendRequests} from '../Friends';
import {Notifications} from '../Notifications';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faCalendarAlt,
  faBuilding,
  faUser,
  faQuestion,
} from '@fortawesome/free-solid-svg-icons';
import {UserContextType} from '../UserContext';
import UserContext from '../UserContext';
import {IconDefinition} from '@fortawesome/fontawesome-svg-core';
import {useTheme} from '../ThemeContext/ThemeContext';
import {useNotifications} from '../../Context/NotificationContext';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const TabBarIconPill = ({
  icon,
  color,
  focused,
  pillColor,
}: {
  icon: IconDefinition;
  color: string;
  focused: boolean;
  pillColor: string;
}) => {
  return (
    <View
      style={[styles.iconPill, focused && {backgroundColor: pillColor}]}>
      <FontAwesomeIcon icon={icon} size={18} color={color} />
    </View>
  );
};

function createTabBarIcon(colors: {primary: string; secondaryText: string}) {
  return function tabBarIcon({
    route,
    focused,
  }: {
    route: {name: string};
    focused: boolean;
  }) {
    const iconMap: Record<string, IconDefinition> = {
      Events: faCalendarAlt,
      Venues: faBuilding,
      Profile: faUser,
    };
    const icon = iconMap[route.name] || faQuestion;
    const iconColor = focused ? colors.primary : colors.secondaryText;
    return (
      <TabBarIconPill
        icon={icon}
        color={iconColor}
        focused={focused}
        pillColor={colors.primary + '14'}
      />
    );
  };
}

const styles = StyleSheet.create({
  iconPill: {
    width: 56,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

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
      <Stack.Screen
        name="Notifications"
        component={Notifications}
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
      <Stack.Screen
        name="Notifications"
        component={Notifications}
        options={{headerShown: false}}
      />
    </Stack.Navigator>
  );
};

const BottomNavigator: React.FC = () => {
  const {userData} = useContext(UserContext) as UserContextType;
  const {colors} = useTheme();
  const {hasPermission, isInitialized, requestPermission} = useNotifications();
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
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

  const themedTabBarIcon = ({
    route,
    focused,
  }: {
    route: {name: string};
    focused: boolean;
  }) => createTabBarIcon(colors)({route, focused});

  const tabLabels: Record<string, string> = {
    Events: t('navigation.events') || 'Events',
    Venues: t('navigation.venues') || 'Venues',
    Profile: t('navigation.profile') || 'Profile',
  };

  const bottomInset = Platform.OS === 'ios' ? insets.bottom : 0;

  const screenOptions = ({route}: {route: any}) => ({
    headerShown: false,
    tabBarLabel: tabLabels[route.name] || route.name,
    tabBarLabelStyle: {
      fontSize: 11,
      fontWeight: '700' as const,
      letterSpacing: 0.3,
      marginTop: 2,
    },
    tabBarStyle: {
      backgroundColor: colors.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: 8,
      paddingBottom: bottomInset > 0 ? bottomInset : 10,
      height: 64 + bottomInset,
      elevation: 0,
      shadowOpacity: 0,
    },
    tabBarItemStyle: {
      paddingVertical: 0,
    },
    tabBarIcon: (props: {color: string; size: number; focused: boolean}) =>
      themedTabBarIcon({route, focused: props.focused}),
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.secondaryText,
  });

  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen name="Events" component={LocalEventsStack} />
      <Tab.Screen name="Venues" component={VenueStack} />
      <Tab.Screen name="Profile">
        {() => <ProfileStack userId={userId} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

export default BottomNavigator;
