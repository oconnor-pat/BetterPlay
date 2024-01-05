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
  Roster: {username: string};
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
  loginCancelButton: {
    height: 35,
    width: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerCancelButton: {
    height: 35,
    width: 100,
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
    backgroundColor: '#A9A9A9',
  },
  errorMessage: {
    color: '#b11313',
    marginTop: 10,
  },
  successMessage: {
    color: '#447bbe',
    marginTop: 10,
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

  //Error messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loginUsernameInputRef = useRef<TextInput>(null);
  const loginPasswordInputRef = useRef<TextInput>(null);

  const registerNameInputRef = useRef<TextInput>(null);
  const registerEmailInputRef = useRef<TextInput>(null);
  const registerUsernameInputRef = useRef<TextInput>(null);
  const registerPasswordInputRef = useRef<TextInput>(null);

  // Process login and registration
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  // Reset form states when navigating away from this screen
  useEffect(() => {
    setShowLoginForm(false);
    setShowRegisterForm(false);
    setErrorMessage(null);
    setSuccessMessage(null);
  }, [navigation]);

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
        'https://omhl-be-9801a7de15ab.herokuapp.com/auth/register',
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
        setSuccessMessage('User created successfully!');
        setErrorMessage(null);
        navigation.navigate('Roster', {username: registrationData.username});
      } else {
        if (responseData.message.includes('Email already in use')) {
          setErrorMessage('Email already in use. Please use another email.');
        } else {
          setErrorMessage(responseData.message);
        }
        setSuccessMessage(null);
      }
    } catch (error) {
      // Handle network errors or other exceptions
      console.error('Error during registration:', error as Error);
      setErrorMessage('Failed to create new user. Please try again.');
      setSuccessMessage(null);
    }
  };

  const handleLogin = async () => {
    try {
      // Make a POST request to the login endpoint on your server
      const response = await fetch(
        'https://omhl-be-9801a7de15ab.herokuapp.com/auth/login',
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
        setSuccessMessage('User logged in successfully!');
        setErrorMessage(null);
        navigation.navigate('Roster', {username: loginData.username});
      } else {
        setErrorMessage(responseData.message);
        setSuccessMessage(null);
      }
    } catch (error) {
      // Handle network errors or other exceptions
      console.error('Error during login:', (error as Error).message);
      setErrorMessage('Failed to login. Please try again.');
      setSuccessMessage(null);
    }
  };

  // Dismiss keyboard when user taps outside of a TextInput
  const dismissForms = () => {
    setShowLoginForm(false);
    setShowRegisterForm(false);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  // Close each form and reset state
  const cancelForm = () => {
    setShowLoginForm(false);
    setShowRegisterForm(false);
    setLoginData({username: '', password: ''});
    setRegistrationData({name: '', email: '', username: '', password: ''});
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 130 : 0}
      style={styles.container}>
      <TouchableWithoutFeedback onPress={dismissForms}>
        <View style={styles.container}>
          <Text style={styles.title}>Welcome!</Text>
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
                autoCapitalize="none"
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
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.loginButton}
                onPress={() => {
                  handleLogin();
                }}>
                <Text style={styles.buttonText}>Login</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.loginCancelButton}
                onPress={() => {
                  cancelForm();
                }}>
                <Text style={styles.buttonText}>Cancel</Text>
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
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder="Email"
                value={registrationData.email}
                onChangeText={text =>
                  setRegistrationData({...registrationData, email: text})
                }
                ref={registerEmailInputRef}
                autoCapitalize="none"
              />
              <TextInput
                style={styles.input}
                placeholder="Username"
                value={registrationData.username}
                onChangeText={text =>
                  setRegistrationData({...registrationData, username: text})
                }
                ref={registerUsernameInputRef}
                autoCapitalize="none"
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
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.registerButton}
                onPress={() => {
                  handleRegistration();
                }}>
                <Text style={styles.buttonText}>Register</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.registerCancelButton}
                onPress={() => {
                  cancelForm();
                }}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
          {errorMessage && (
            <Text style={styles.errorMessage}>{errorMessage}</Text>
          )}
          {successMessage && (
            <Text style={styles.successMessage}>{successMessage}</Text>
          )}
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

export default LandingPage;
