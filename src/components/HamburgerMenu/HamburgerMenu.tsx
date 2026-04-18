import React, {useState, useContext, useEffect, useMemo, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faBars,
  faGear,
  faSignOut,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import {useNavigation, NavigationProp} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import UserContext from '../UserContext';
import {useTheme} from '../ThemeContext/ThemeContext';
import {useTranslation} from 'react-i18next';
import notificationService from '../../services/NotificationService';

const HamburgerMenu: React.FC = () => {
  const [menuVisible, setMenuVisible] = useState(false);
  const {setUserData} = useContext(UserContext);
  const navigation = useNavigation<NavigationProp<any>>();
  const {colors} = useTheme();
  const {t} = useTranslation();

  // Animation refs (origin: top-right corner of the popover)
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const menuOpacity = useRef(new Animated.Value(0)).current;
  const menuScale = useRef(new Animated.Value(0.9)).current;
  const menuTranslateY = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    if (menuVisible) {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(menuOpacity, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(menuScale, {
          toValue: 1,
          friction: 7,
          tension: 90,
          useNativeDriver: true,
        }),
        Animated.spring(menuTranslateY, {
          toValue: 0,
          friction: 8,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      backdropOpacity.setValue(0);
      menuOpacity.setValue(0);
      menuScale.setValue(0.9);
      menuTranslateY.setValue(-12);
    }
  }, [menuVisible, backdropOpacity, menuOpacity, menuScale, menuTranslateY]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(menuOpacity, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(menuScale, {
        toValue: 0.92,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(menuTranslateY, {
        toValue: -8,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setMenuVisible(false);
    });
  };

  const handleMenuToggle = () => {
    setMenuVisible(true);
  };

  const handleOptionPress = async (option: string) => {
    handleClose();
    if (option === 'Sign Out') {
      await notificationService.unregisterDevice();
      await AsyncStorage.multiRemove([
        'userToken',
        'cachedUserData',
        'cachedEvents',
        '@profilePicUrl',
        '@app_language',
        'locationEnabled',
        'proximityVisibility',
        'cachedUserLocation',
        'cachedUserLocationTimestamp',
      ]);
      setUserData(null);
      navigation.reset({
        index: 0,
        routes: [{name: 'LandingPage'}],
      });
    } else if (option === 'Settings') {
      navigation.navigate('Settings');
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        hamburgerButton: {
          paddingHorizontal: 16,
          paddingVertical: 10,
          backgroundColor: 'transparent',
        },
        overlay: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.35)',
        },
        overlayTouchable: {
          flex: 1,
        },
        menuContainer: {
          position: 'absolute',
          top: Platform.OS === 'ios' ? 56 : 16,
          right: 12,
          width: 240,
          backgroundColor: colors.background,
          borderRadius: 14,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          paddingVertical: 4,
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 8},
          shadowOpacity: 0.18,
          shadowRadius: 16,
          elevation: 8,
        },
        caret: {
          position: 'absolute',
          top: -7,
          right: 18,
          width: 14,
          height: 14,
          backgroundColor: colors.background,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderLeftWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          transform: [{rotate: '45deg'}],
        },
        menuOption: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 14,
          paddingVertical: 12,
        },
        menuOptionDivider: {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        iconContainer: {
          width: 30,
          height: 30,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        },
        iconContainerPrimary: {
          backgroundColor: colors.primary + '15',
        },
        iconContainerDanger: {
          backgroundColor: colors.error + '15',
        },
        menuText: {
          flex: 1,
          fontSize: 15,
          fontWeight: '600',
          color: colors.text,
        },
        menuTextDanger: {
          color: colors.error,
          fontWeight: '700',
        },
      }),
    [colors],
  );

  return (
    <View>
      {/* Hamburger Button */}
      <TouchableOpacity
        style={styles.hamburgerButton}
        onPress={handleMenuToggle}
        activeOpacity={0.6}>
        <FontAwesomeIcon icon={faBars} size={22} color={colors.text} />
      </TouchableOpacity>

      {/* Modal for Menu */}
      <Modal
        transparent
        visible={menuVisible}
        animationType="none"
        onRequestClose={handleClose}>
        <Animated.View
          style={[styles.overlay, {opacity: backdropOpacity}]}
          pointerEvents="auto">
          <TouchableOpacity
            style={styles.overlayTouchable}
            activeOpacity={1}
            onPress={handleClose}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.menuContainer,
            {
              opacity: menuOpacity,
              transform: [
                {translateY: menuTranslateY},
                {scale: menuScale},
              ],
            },
          ]}>
          <View style={styles.caret} />

          <TouchableOpacity
            style={styles.menuOption}
            activeOpacity={0.7}
            onPress={() => handleOptionPress('Settings')}>
            <View style={[styles.iconContainer, styles.iconContainerPrimary]}>
              <FontAwesomeIcon icon={faGear} size={14} color={colors.primary} />
            </View>
            <Text style={styles.menuText}>{t('menu.settings')}</Text>
            <FontAwesomeIcon
              icon={faChevronRight}
              size={12}
              color={colors.secondaryText}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuOption, styles.menuOptionDivider]}
            activeOpacity={0.7}
            onPress={() => handleOptionPress('Sign Out')}>
            <View style={[styles.iconContainer, styles.iconContainerDanger]}>
              <FontAwesomeIcon
                icon={faSignOut}
                size={14}
                color={colors.error}
              />
            </View>
            <Text style={[styles.menuText, styles.menuTextDanger]}>
              {t('menu.signOut')}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </Modal>
    </View>
  );
};

export default HamburgerMenu;
