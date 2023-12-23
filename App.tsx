import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import Roster from '../OMHL/src/components/Roster/Roster';
// import Profile from '../OMHL/src/components/Profile/Profile';
//import Discover from './components/Discover/Discover';
import LandingPage from '../OMHL/src/components/Landingpage/LandingPage';

const Stack = createNativeStackNavigator();

function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="OMHL"
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
        <Stack.Screen name="Roster" component={Roster} />
        {/* <Stack.Screen name="Profile" component={Profile} /> */}
        {/* <Stack.Screen name="Discover" component={Discover} /> */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;
