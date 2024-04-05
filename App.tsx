import React, {useState} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import LandingPage from './src/components/Landingpage/LandingPage';
import {StatusBar} from 'react-native';
import UserContext from './src/components/UserContext';
import BottomNavigator from './src/components/BottomNavigator/BottomNavigator';

// Types
type UserData = {
  _id: string;
  username: string;
  email: string;
};

const Stack = createStackNavigator();

function App() {
  // State to manage the user data
  const [userData, setUserData] = useState<UserData | null>(null);

  return (
    <>
      <StatusBar backgroundColor="#02131D" barStyle="light-content" />
      <UserContext.Provider value={{userData, setUserData}}>
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
              name="BottomNavigator"
              component={BottomNavigator}
              options={{headerShown: false}}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </UserContext.Provider>
    </>
  );
}

export default App;
