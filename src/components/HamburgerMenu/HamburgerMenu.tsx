import React, {useState, useContext, useEffect, useMemo, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Easing,
  Pressable,
} from 'react-native';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faBars,
  faCircleHalfStroke,
  faGear,
  faMoon,
  faSignOut,
  faSun,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';
import {useNavigation, NavigationProp} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import UserContext from '../UserContext';
import {useTheme, ThemeMode} from '../ThemeContext/ThemeContext';
import {useTranslation} from 'react-i18next';
import notificationService from '../../services/NotificationService';

const THEME_OPTIONS: Array<{
  mode: ThemeMode;
  icon: typeof faSun;
  labelKey: string;
  fallback: string;
}> = [
  {mode: 'system', icon: faCircleHalfStroke, labelKey: 'settings.system', fallback: 'System'},
  {mode: 'light', icon: faSun, labelKey: 'settings.light', fallback: 'Light'},
  {mode: 'dark', icon: faMoon, labelKey: 'settings.dark', fallback: 'Dark'},
];

const HamburgerMenu: React.FC = () => {
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPos, setMenuPos] = useState({top: 56, left: 12});
  const userContext = useContext(UserContext);
  const setUserData = userContext?.setUserData;
  const navigation = useNavigation<NavigationProp<any>>();
  const {colors, themeMode, setThemeMode} = useTheme();
  const {t} = useTranslation();
  const buttonRef = useRef<View>(null);

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const menuOpacity = useRef(new Animated.Value(0)).current;
  const menuScale = useRef(new Animated.Value(0.92)).current;
  const menuTranslateY = useRef(new Animated.Value(-10)).current;
  // 0 = bars, 1 = X — drives the hamburger morph.
  const iconProgress = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

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
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(menuScale, {
          toValue: 1,
          friction: 7,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.spring(menuTranslateY, {
          toValue: 0,
          friction: 8,
          tension: 110,
          useNativeDriver: true,
        }),
        Animated.timing(iconProgress, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      backdropOpacity.setValue(0);
      menuOpacity.setValue(0);
      menuScale.setValue(0.92);
      menuTranslateY.setValue(-10);
      iconProgress.setValue(0);
    }
  }, [
    menuVisible,
    backdropOpacity,
    menuOpacity,
    menuScale,
    menuTranslateY,
    iconProgress,
  ]);

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
        toValue: 0.94,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(menuTranslateY, {
        toValue: -8,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(iconProgress, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setMenuVisible(false);
    });
  };

  const handleMenuToggle = () => {
    if (menuVisible) {
      handleClose();
      return;
    }

    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.88,
        duration: 70,
        useNativeDriver: true,
      }),
      Animated.spring(buttonScale, {
        toValue: 1,
        friction: 5,
        tension: 160,
        useNativeDriver: true,
      }),
    ]).start();

    buttonRef.current?.measureInWindow((x, y, _width, height) => {
      setMenuPos({
        top: Math.round(y + height + 4),
        left: Math.max(10, Math.round(x)),
      });
      setMenuVisible(true);
    });
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
      setUserData?.(null);
      navigation.reset({
        index: 0,
        routes: [{name: 'LandingPage'}],
      });
    } else if (option === 'Settings') {
      navigation.navigate('Settings');
    }
  };

  const barsOpacity = iconProgress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0, 0],
  });
  const timesOpacity = iconProgress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });
  const iconRotate = iconProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        buttonWrap: {
          width: 40,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
        },
        iconStack: {
          width: 22,
          height: 22,
          alignItems: 'center',
          justifyContent: 'center',
        },
        iconLayer: {
          position: 'absolute',
        },
        overlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(0, 0, 0, 0.35)',
        },
        menuContainer: {
          position: 'absolute',
          width: 220,
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
          top: -6,
          left: 14,
          width: 12,
          height: 12,
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
        appearanceBlock: {
          paddingHorizontal: 10,
          paddingTop: 10,
          paddingBottom: 8,
        },
        appearanceLabel: {
          fontSize: 11,
          fontWeight: '700',
          color: colors.secondaryText,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: 8,
          marginLeft: 2,
        },
        themePicker: {
          flexDirection: 'row',
          gap: 4,
          backgroundColor: colors.inputBackground || colors.card,
          borderRadius: 10,
          padding: 3,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        themeOption: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          paddingVertical: 8,
          borderRadius: 8,
        },
        themeOptionActive: {
          backgroundColor: colors.background,
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 1},
          shadowOpacity: 0.12,
          shadowRadius: 2,
          elevation: 2,
        },
        themeOptionText: {
          fontSize: 10,
          fontWeight: '600',
          color: colors.secondaryText,
        },
        themeOptionTextActive: {
          color: colors.primary,
          fontWeight: '700',
        },
      }),
    [colors],
  );

  return (
    <View>
      <Animated.View style={{transform: [{scale: buttonScale}]}}>
        <Pressable
          ref={buttonRef}
          style={styles.buttonWrap}
          onPress={handleMenuToggle}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={menuVisible ? 'Close menu' : 'Open menu'}>
          <Animated.View
            style={[styles.iconStack, {transform: [{rotate: iconRotate}]}]}>
            <Animated.View style={[styles.iconLayer, {opacity: barsOpacity}]}>
              <FontAwesomeIcon icon={faBars} size={20} color={colors.text} />
            </Animated.View>
            <Animated.View style={[styles.iconLayer, {opacity: timesOpacity}]}>
              <FontAwesomeIcon icon={faTimes} size={20} color={colors.text} />
            </Animated.View>
          </Animated.View>
        </Pressable>
      </Animated.View>

      <Modal
        transparent
        visible={menuVisible}
        animationType="none"
        onRequestClose={handleClose}
        statusBarTranslucent>
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Animated.View style={[styles.overlay, {opacity: backdropOpacity}]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
          </Animated.View>

          <Animated.View
            style={[
              styles.menuContainer,
              {
                top: menuPos.top,
                left: menuPos.left,
                opacity: menuOpacity,
                transform: [
                  {translateY: menuTranslateY},
                  {scale: menuScale},
                ],
              },
            ]}>
            <View style={styles.caret} />

            <View style={styles.appearanceBlock}>
              <Text style={styles.appearanceLabel}>
                {t('settings.appearance') || 'Appearance'}
              </Text>
              <View style={styles.themePicker}>
                {THEME_OPTIONS.map(option => {
                  const active = themeMode === option.mode;
                  return (
                    <TouchableOpacity
                      key={option.mode}
                      style={[
                        styles.themeOption,
                        active && styles.themeOptionActive,
                      ]}
                      onPress={() => setThemeMode(option.mode)}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityState={{selected: active}}
                      accessibilityLabel={
                        t(option.labelKey) || option.fallback
                      }>
                      <FontAwesomeIcon
                        icon={option.icon}
                        size={13}
                        color={
                          active ? colors.primary : colors.secondaryText
                        }
                      />
                      <Text
                        style={[
                          styles.themeOptionText,
                          active && styles.themeOptionTextActive,
                        ]}>
                        {t(option.labelKey) || option.fallback}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.menuOption, styles.menuOptionDivider]}
              activeOpacity={0.7}
              onPress={() => handleOptionPress('Settings')}>
              <View
                style={[styles.iconContainer, styles.iconContainerPrimary]}>
                <FontAwesomeIcon
                  icon={faGear}
                  size={14}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.menuText}>{t('menu.settings')}</Text>
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
        </View>
      </Modal>
    </View>
  );
};

export default HamburgerMenu;
