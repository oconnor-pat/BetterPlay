import React, {useState, useEffect} from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  LinkingOptions,
} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import LandingPage from './src/components/Landingpage/LandingPage';
import BottomNavigator from './src/components/BottomNavigator/BottomNavigator';
import Settings from './src/components/Settings/Settings';
import ResetPassword from './src/components/ResetPassword/ResetPassword';
import {
  PrivacyPolicy,
  TermsOfService,
  YourData,
} from './src/components/LegalDocument';
import {StatusBar, ActivityIndicator, View, StyleSheet} from 'react-native';
import UserContext from './src/components/UserContext';
import {
  ThemeProvider,
  useTheme,
} from './src/components/ThemeContext/ThemeContext';
import {EventProvider} from './src/Context/EventContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_BASE_URL} from './src/config/api';

// Import i18n configuration
import './src/i18n';

// Types
type UserData = {
  _id: string;
  username: string;
  email: string;
};

type RootStackParamList = {
  LandingPage: undefined;
  BottomNavigator: undefined;
  Settings: undefined;
  ResetPassword: {token: string};
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
  YourData: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

// Deep linking configuration
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['betterplay://'],
  config: {
    screens: {
      ResetPassword: {
        path: 'reset-password',
        parse: {
          token: (token: string) => token,
        },
      },
      LandingPage: 'login',
      BottomNavigator: 'home',
      Settings: 'settings',
    },
  },
};

const AppContent = () => {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const {darkMode, colors} = useTheme();

  // Check for existing session on app startup
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        if (token) {
          // Validate token with backend and get user data
          const response = await fetch(`${API_BASE_URL}/auth/validate`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          // Check if response is OK and is JSON
          const contentType = response.headers.get('content-type');
          if (!response.ok || !contentType?.includes('application/json')) {
            console.warn('Invalid response from server, clearing token');
            await AsyncStorage.removeItem('userToken');
            return;
          }

          const data = await response.json();

          if (data.success && data.user) {
            setUserData(data.user);
          } else {
            // Token is invalid, clear it
            await AsyncStorage.removeItem('userToken');
          }
        }
      } catch (error) {
        console.error('Error restoring session:', error);
        // Clear potentially corrupted token
        await AsyncStorage.removeItem('userToken');
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const loadingBackgroundStyle = darkMode
    ? styles.darkBackground
    : styles.lightBackground;

  // Show loading screen while checking session
  if (isLoading) {
    return (
      <View style={[styles.centeredView, loadingBackgroundStyle]}>
        <ActivityIndicator size="large" color={colors?.primary || '#007AFF'} />
      </View>
    );
  }

  const backgroundStyle = darkMode
    ? styles.darkBackground
    : styles.lightBackground;

  return (
    <>
      <StatusBar
        backgroundColor={darkMode ? '#000' : '#02131D'}
        barStyle={darkMode ? 'light-content' : 'dark-content'}
      />
      <UserContext.Provider value={{userData, setUserData}}>
        <EventProvider>
          <NavigationContainer
            theme={darkMode ? DarkTheme : DefaultTheme}
            linking={linking}
            fallback={
              <View style={[styles.centeredView, backgroundStyle]}>
                <ActivityIndicator
                  size="large"
                  color={colors?.primary || '#007AFF'}
                />
              </View>
            }>
            <Stack.Navigator
              initialRouteName={userData ? 'BottomNavigator' : 'LandingPage'}
              screenOptions={{
                headerStyle: {
                  backgroundColor: darkMode ? '#000' : '#02131D',
                },
                headerTintColor: '#fff',
                headerTitleAlign: 'center',
                headerBackTitleVisible: false,
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }}>
              <Stack.Screen
                name="LandingPage"
                component={LandingPage}
                options={{headerShown: false}}
              />
              <Stack.Screen
                name="BottomNavigator"
                component={BottomNavigator}
                options={{headerShown: false, gestureEnabled: false}}
              />
              <Stack.Screen
                name="Settings"
                component={Settings}
                options={{
                  headerShown: true,
                  title: 'Settings',
                }}
              />
              <Stack.Screen
                name="ResetPassword"
                component={ResetPassword}
                options={{
                  headerShown: true,
                  title: 'Reset Password',
                }}
              />
              <Stack.Screen
                name="PrivacyPolicy"
                component={PrivacyPolicy}
                options={{headerShown: false}}
              />
              <Stack.Screen
                name="TermsOfService"
                component={TermsOfService}
                options={{headerShown: false}}
              />
              <Stack.Screen
                name="YourData"
                component={YourData}
                options={{headerShown: false}}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </EventProvider>
      </UserContext.Provider>
    </>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  darkBackground: {
    backgroundColor: '#000',
  },
  lightBackground: {
    backgroundColor: '#02131D',
  },
});

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
