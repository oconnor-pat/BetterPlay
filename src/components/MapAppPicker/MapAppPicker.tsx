import React, {useMemo} from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {IconDefinition} from '@fortawesome/fontawesome-svg-core';
import {
  faChevronRight,
  faLocationArrow,
  faMap,
  faMapLocationDot,
} from '@fortawesome/free-solid-svg-icons';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../ThemeContext/ThemeContext';
import {AvailableMapApp, MapAppName} from '../../services/MapLauncher';

const APP_ICONS: Record<MapAppName, IconDefinition> = {
  'Apple Maps': faMap,
  'Google Maps': faMapLocationDot,
  Waze: faLocationArrow,
};

const APP_TINTS: Record<MapAppName, string> = {
  'Apple Maps': '#007AFF',
  'Google Maps': '#34A853',
  Waze: '#33CCFF',
};

interface Props {
  visible: boolean;
  apps: AvailableMapApp[];
  onSelect: (app: AvailableMapApp) => void;
  onClose: () => void;
}

const MapAppPicker: React.FC<Props> = ({visible, apps, onSelect, onClose}) => {
  const {colors} = useTheme();
  const {t} = useTranslation();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'flex-end',
        },
        sheet: {
          backgroundColor: colors.background,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 32 : 20,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        handle: {
          alignSelf: 'center',
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
          marginBottom: 8,
        },
        headerBlock: {
          paddingHorizontal: 16,
          paddingBottom: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        title: {
          color: colors.text,
          fontSize: 17,
          fontWeight: '700',
          textAlign: 'center',
        },
        subtitle: {
          color: colors.secondaryText,
          fontSize: 12,
          marginTop: 4,
          textAlign: 'center',
          letterSpacing: 0.4,
          textTransform: 'uppercase',
        },
        list: {
          paddingHorizontal: 16,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 14,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          gap: 12,
        },
        rowLast: {
          borderBottomWidth: 0,
        },
        iconContainer: {
          width: 36,
          height: 36,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
        },
        appName: {
          flex: 1,
          color: colors.text,
          fontSize: 15,
          fontWeight: '600',
        },
        footer: {
          paddingHorizontal: 16,
          paddingTop: 14,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        cancelButton: {
          borderRadius: 24,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          paddingVertical: 12,
          alignItems: 'center',
          backgroundColor: 'transparent',
        },
        cancelButtonText: {
          color: colors.secondaryText,
          fontSize: 14,
          fontWeight: '700',
        },
      }),
    [colors],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}>
        <View
          style={styles.sheet}
          onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />
          <View style={styles.headerBlock}>
            <Text style={styles.title}>
              {t('events.chooseMapApp') || 'Open with...'}
            </Text>
            <Text style={styles.subtitle}>Get Directions</Text>
          </View>
          <View style={styles.list}>
            {apps.map((app, idx) => {
              const icon = APP_ICONS[app.name] || faMap;
              const tint = APP_TINTS[app.name] || colors.primary;
              const isLast = idx === apps.length - 1;
              return (
                <TouchableOpacity
                  key={app.name}
                  style={[styles.row, isLast && styles.rowLast]}
                  onPress={() => onSelect(app)}>
                  <View
                    style={[
                      styles.iconContainer,
                      {backgroundColor: tint + '15'},
                    ]}>
                    <FontAwesomeIcon icon={icon} size={16} color={tint} />
                  </View>
                  <Text style={styles.appName}>{app.name}</Text>
                  <FontAwesomeIcon
                    icon={faChevronRight}
                    size={12}
                    color={colors.secondaryText}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>
                {t('common.cancel') || 'Cancel'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

export default MapAppPicker;
