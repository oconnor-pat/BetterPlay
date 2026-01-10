import React, {useState, useContext} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Modal} from 'react-native';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {faBars, faGear, faSignOut} from '@fortawesome/free-solid-svg-icons';
import {useNavigation, NavigationProp} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import UserContext from '../UserContext';
import {useTheme} from '../ThemeContext/ThemeContext';
import {useTranslation} from 'react-i18next';

const HamburgerMenu: React.FC = () => {
  const [menuVisible, setMenuVisible] = useState(false);
  const {setUserData} = useContext(UserContext);
  const navigation = useNavigation<NavigationProp<any>>();
  const {colors} = useTheme();
  const {t} = useTranslation();

  const handleMenuToggle = () => {
    setMenuVisible(!menuVisible);
  };

  const handleOptionPress = async (option: string) => {
    setMenuVisible(false);
    if (option === 'Sign Out') {
      // Clear the stored token and cached data to fully log out
      await AsyncStorage.multiRemove(['userToken', 'cachedUserData']);
      setUserData(null);
      navigation.reset({
        index: 0,
        routes: [{name: 'LandingPage'}],
      });
    } else if (option === 'Settings') {
      navigation.navigate('Settings');
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
          <View style={[styles.menuContainer, {backgroundColor: colors.card}]}>
            <TouchableOpacity
              style={[styles.menuOption, {borderBottomColor: colors.border}]}
              onPress={() => handleOptionPress('Settings')}>
              <FontAwesomeIcon icon={faGear} size={20} color={colors.text} />
              <Text style={[styles.menuText, {color: colors.text}]}>
                {t('menu.settings')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuOption, styles.lastOption]}
              onPress={() => handleOptionPress('Sign Out')}>
              <FontAwesomeIcon
                icon={faSignOut}
                size={20}
                color={colors.error}
              />
              <Text style={[styles.menuText, {color: colors.error}]}>
                {t('menu.signOut')}
              </Text>
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
    justifyContent: 'flex-start',
    paddingTop: 60,
  },
  menuContainer: {
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  menuOption: {
    padding: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lastOption: {
    borderBottomWidth: 0,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default HamburgerMenu;
