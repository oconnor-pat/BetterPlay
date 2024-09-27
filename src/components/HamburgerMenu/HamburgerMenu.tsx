import React, {useState, useContext} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Modal} from 'react-native';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {faBars} from '@fortawesome/free-solid-svg-icons';
import {useNavigation, NavigationProp} from '@react-navigation/native';
import UserContext from '../UserContext';

const HamburgerMenu: React.FC = () => {
  const [menuVisible, setMenuVisible] = useState(false);
  const {setUserData} = useContext(UserContext); // Access UserContext to manage user state
  const navigation = useNavigation<NavigationProp<any>>(); // Use navigation to handle screen navigation

  const handleMenuToggle = () => {
    setMenuVisible(!menuVisible); // Toggle the visibility of the modal
  };

  const handleOptionPress = (option: string) => {
    setMenuVisible(false); // Close the menu after selecting an option
    if (option === 'Sign Out') {
      // Clear user data and navigate to the LandingPage
      setUserData(null);
      navigation.reset({
        index: 0,
        routes: [{name: 'LandingPage'}],
      });
    }
  };

  return (
    <View>
      {/* Hamburger Button */}
      <TouchableOpacity
        style={styles.hamburgerButton}
        onPress={handleMenuToggle}
        activeOpacity={0.6} // Ensure visual feedback when the button is pressed
      >
        <FontAwesomeIcon icon={faBars} size={24} color="#fff" />
      </TouchableOpacity>

      {/* Modal for Menu */}
      <Modal transparent={true} visible={menuVisible} animationType="slide">
        <TouchableOpacity style={styles.overlay} onPress={handleMenuToggle}>
          <View style={styles.menuContainer}>
            <TouchableOpacity
              style={styles.menuOption}
              onPress={() => handleOptionPress('Sign Out')}>
              <Text style={styles.menuText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  hamburgerButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
  },
  menuContainer: {
    backgroundColor: '#02131D',
    padding: 20,
    marginTop: 60,
    alignItems: 'center',
  },
  menuOption: {
    padding: 10,
    borderBottomColor: '#ccc',
    borderBottomWidth: 1,
  },
  menuText: {
    color: '#fff',
    fontSize: 18,
  },
});

export default HamburgerMenu;
