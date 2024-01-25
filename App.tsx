import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import LandingPage from './src/components/Landingpage/LandingPage';
import BottomNavBar from './src/components/BottomNavigator/BottomNavBar';
import {StatusBar} from 'react-native';

const Stack = createStackNavigator();

function App() {
  return (
    <>
      <StatusBar backgroundColor="#02131D" barStyle="light-content" />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="LandingPage"
          screenOptions={{
            headerStyle: {
              backgroundColor: '#02131D',
            },
          }}>
          <Stack.Screen
            name="LandingPage"
            component={LandingPage}
            options={{headerShown: false}}
          />
          <Stack.Screen
            name="Roster"
            component={BottomNavBar}
            options={{headerBackTitle: 'Sign Out', headerTitle: ''}}
          />
          <Stack.Screen
            name="Profile"
            component={BottomNavBar}
            options={{headerBackTitle: 'Sign Out'}}
          />
          <Stack.Screen
            name="CommunityNotes"
            component={BottomNavBar}
            options={{headerBackTitle: 'Sign Out'}}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}

export default App;
