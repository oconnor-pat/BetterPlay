import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import {NavigationProp, useNavigation} from '@react-navigation/native';

// Interfaces
type RootStackParamList = {
  Roster: undefined;
};

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#02131D',
  },
  formContainer: {
    width: '50%',
    padding: 20,
    borderWidth: 1,
    borderRadius: 5,
    backgroundColor: '#f2f2f2',
  },
  title: {
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    marginTop: 100,
    color: '#447bbe',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  loginButton: {
    marginRight: 10,
    height: 35,
    width: 100,
    borderRadius: 10,
    backgroundColor: '#447bbe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerButton: {
    height: 35,
    width: 100,
    borderRadius: 10,
    backgroundColor: '#b11313',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#fff',
  },
});

function LandingPage() {
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [registrationData, setRegistrationData] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
  });
  const [loginData, setLoginData] = useState({
    username: '',
    password: '',
  });

  const loginUsernameInputRef = useRef<TextInput>(null);
  const loginPasswordInputRef = useRef<TextInput>(null);

  const registerNameInputRef = useRef<TextInput>(null);
  const registerEmailInputRef = useRef<TextInput>(null);
  const registerUsernameInputRef = useRef<TextInput>(null);
  const registerPasswordInputRef = useRef<TextInput>(null);

  // Then use it like this:
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  useEffect(() => {
    if (showLoginForm) {
      if (loginUsernameInputRef.current) {
        loginUsernameInputRef.current.focus();
      }
    }
    if (showRegisterForm) {
      if (registerNameInputRef.current) {
        registerNameInputRef.current.focus();
      }
    }
  }, [showLoginForm, showRegisterForm]);

  const handleRegistration = async () => {
    try {
      // Makes a POST request to the registration endpoint on server
      const response = await fetch(
        'https://bew-584382a4b042.herokuapp.com/auth/register',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(registrationData),
        },
      );

      const responseData = await response.json();

      // Handle the response, e.g., show success message or error
      console.log(responseData);

      // If registration is successful, navigate to Roster
      if (responseData.success) {
        navigation.navigate('Roster');
      }
    } catch (error) {
      // Handle network errors or other exceptions
      console.error('Error during registration:', error as Error);
    }
  };

  const handleLogin = async () => {
    try {
      // Make a POST request to the login endpoint on your server
      const response = await fetch(
        'https://bew-584382a4b042.herokuapp.com/auth/login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(loginData),
        },
      );

      const responseData = await response.json();

      // Handle the response, e.g., store user token in AsyncStorage or show error
      console.log(responseData);

      // If registration is successful, navigate to Roster
      if (responseData.success) {
        navigation.navigate('Roster');
      }
    } catch (error) {
      // Handle network errors or other exceptions
      console.error('Error during login:', (error as Error).message);
    }
  };

  // Dismiss keyboard when user taps outside of a TextInput
  const dismissForms = () => {
    setShowLoginForm(false);
    setShowRegisterForm(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 130 : 0}
      style={styles.container}>
      <TouchableWithoutFeedback onPress={dismissForms}>
        <View style={styles.container}>
          <Text style={styles.title}>Welcome to Old Man Hockey!</Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => {
                setShowLoginForm(true);
                setShowRegisterForm(false);
              }}>
              <Text style={styles.buttonText}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.registerButton}
              onPress={() => {
                setShowLoginForm(false);
                setShowRegisterForm(true);
              }}>
              <Text style={styles.buttonText}>Register</Text>
            </TouchableOpacity>
          </View>

          {showLoginForm && (
            <View>
              <TextInput
                style={styles.input}
                placeholder="Username"
                value={loginData.username}
                onChangeText={text =>
                  setLoginData({...loginData, username: text})
                }
                ref={loginUsernameInputRef}
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                secureTextEntry
                value={loginData.password}
                onChangeText={text =>
                  setLoginData({...loginData, password: text})
                }
                ref={loginPasswordInputRef}
              />
              <TouchableOpacity
                style={styles.loginButton}
                onPress={() => {
                  handleLogin();
                }}>
                <Text style={styles.buttonText}>Login</Text>
              </TouchableOpacity>
            </View>
          )}

          {showRegisterForm && (
            <View>
              <TextInput
                style={styles.input}
                placeholder="Name"
                value={registrationData.name}
                onChangeText={text =>
                  setRegistrationData({...registrationData, name: text})
                }
                ref={registerNameInputRef}
              />
              <TextInput
                style={styles.input}
                placeholder="Email"
                value={registrationData.email}
                onChangeText={text =>
                  setRegistrationData({...registrationData, email: text})
                }
                ref={registerEmailInputRef}
              />
              <TextInput
                style={styles.input}
                placeholder="Username"
                value={registrationData.username}
                onChangeText={text =>
                  setRegistrationData({...registrationData, username: text})
                }
                ref={registerUsernameInputRef}
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                secureTextEntry
                value={registrationData.password}
                onChangeText={text =>
                  setRegistrationData({...registrationData, password: text})
                }
                ref={registerPasswordInputRef}
              />
              <TouchableOpacity
                style={styles.registerButton}
                onPress={() => {
                  handleRegistration();
                }}>
                <Text style={styles.buttonText}>Register</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

export default LandingPage;
