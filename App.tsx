import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
//import Homefeed from './components/Homefeed/Homefeed';
//import Profile from './components/Profile/Profile';
//import Discover from './components/Discover/Discover';
import LandingPage from '../OMHL/src/components/Landingpage/LandingPage';

const Stack = createNativeStackNavigator();

function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="LandingPage"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#02131D',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}>
        <Stack.Screen name="OMHL" component={LandingPage} />
        {/*         <Stack.Screen name="Homefeed" component={Homefeed} />
        <Stack.Screen name="Profile" component={Profile} />
        <Stack.Screen name="Discover" component={Discover} /> */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;
