import React, {useState} from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import LandingPage from './src/components/Landingpage/LandingPage';
import BottomNavigator from './src/components/BottomNavigator/BottomNavigator';
import {StatusBar} from 'react-native';
import UserContext from './src/components/UserContext';
import {
  ThemeProvider,
  useTheme,
} from './src/components/ThemeContext/ThemeContext';

// Types
type UserData = {
  _id: string;
  username: string;
  email: string;
};

const Stack = createStackNavigator();

const AppContent = () => {
  const [userData, setUserData] = useState<UserData | null>(null);
  const {darkMode} = useTheme();

  return (
    <>
      <StatusBar
        backgroundColor={darkMode ? '#000' : '#02131D'}
        barStyle={darkMode ? 'light-content' : 'dark-content'}
      />
      <UserContext.Provider value={{userData, setUserData}}>
        <NavigationContainer theme={darkMode ? DarkTheme : DefaultTheme}>
          <Stack.Navigator
            initialRouteName="LandingPage"
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
            {userData && (
              <Stack.Screen
                name="BottomNavigator"
                component={BottomNavigator}
                options={{headerShown: false}}
              />
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </UserContext.Provider>
    </>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
