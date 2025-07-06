import React, {useState, useContext} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Switch,
} from 'react-native';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {faBars} from '@fortawesome/free-solid-svg-icons';
import {useNavigation, NavigationProp} from '@react-navigation/native';
import UserContext from '../UserContext';
import {useTheme} from '../ThemeContext/ThemeContext';

const HamburgerMenu: React.FC = () => {
  const [menuVisible, setMenuVisible] = useState(false);
  const {setUserData} = useContext(UserContext);
  const navigation = useNavigation<NavigationProp<any>>();
  const {darkMode, toggleDarkMode} = useTheme();

  const handleMenuToggle = () => {
    setMenuVisible(!menuVisible);
  };

  const handleOptionPress = (option: string) => {
    setMenuVisible(false);
    if (option === 'Sign Out') {
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
        activeOpacity={0.6}>
        <FontAwesomeIcon icon={faBars} size={24} color="#fff" />
      </TouchableOpacity>

      {/* Modal for Menu */}
      <Modal transparent={true} visible={menuVisible} animationType="slide">
        <TouchableOpacity style={styles.overlay} onPress={handleMenuToggle}>
          <View>
            <TouchableOpacity
              style={styles.menuOption}
              onPress={() => handleOptionPress('Sign Out')}>
              <Text style={styles.menuText}>Sign Out</Text>
            </TouchableOpacity>
            <View style={styles.menuOption}>
              <Text style={styles.menuText}>Dark Mode</Text>
              <Switch
                value={darkMode}
                onValueChange={toggleDarkMode}
                thumbColor={darkMode ? '#fff' : '#02131D'}
                trackColor={{false: '#767577', true: '#81b0ff'}}
              />
            </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: 180,
  },
  menuText: {
    color: '#fff',
    fontSize: 18,
  },
});

export default HamburgerMenu;
