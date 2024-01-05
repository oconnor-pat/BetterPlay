import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import Profile from '../BetterPlay/src/components/Profile/Profile';
import Roster from '../BetterPlay/src/components/Roster/Roster';
//import Discover from './components/Discover/Discover';
import LandingPage from '../BetterPlay/src/components/Landingpage/LandingPage';

const Stack = createNativeStackNavigator();

function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="BetterPlay"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#02131D',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}>
        <Stack.Screen name="BetterPlay" component={LandingPage} />
        <Stack.Screen name="Roster" component={Roster} />
        <Stack.Screen name="Profile" component={Profile} />
        {/* <Stack.Screen name="Discover" component={Discover} /> */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;
