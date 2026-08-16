import React, {useEffect, useState} from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {faTimes, faUser, faIdCard} from '@fortawesome/free-solid-svg-icons';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../ThemeContext/ThemeContext';
import {API_BASE_URL} from '../../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = {
  visible: boolean;
  /** Required first-run sheet after social signup — cannot dismiss without saving. */
  required?: boolean;
  initialName?: string;
  initialUsername?: string;
  onCancel: () => void;
  onSaved: (user: any) => void;
};

export default function EditProfileModal({
  visible,
  required,
  initialName = '',
  initialUsername = '',
  onCancel,
  onSaved,
}: Props) {
  const {t} = useTranslation();
  const {colors} = useTheme();
  const [name, setName] = useState(initialName);
  const [username, setUsername] = useState(initialUsername);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName(initialName || '');
      setUsername(initialUsername || '');
      setError(null);
      setLoading(false);
    }
  }, [visible, initialName, initialUsername]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setError(
        t('profile.usernameRequired', {
          defaultValue: 'Please choose a username.',
        }),
      );
      return;
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(trimmedUsername)) {
      setError(
        t('profile.usernameInvalid', {
          defaultValue:
            'Username must be 3–20 characters (letters, numbers, underscores).',
        }),
      );
      return;
    }
    if (trimmedName && (trimmedName.length < 1 || trimmedName.length > 80)) {
      setError(
        t('profile.nameInvalid', {
          defaultValue: 'Name must be between 1 and 80 characters.',
        }),
      );
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        setError(
          t('settings.sessionExpired', {
            defaultValue: 'Session expired. Please sign in again.',
          }),
        );
        return;
      }
      const body: {username: string; name?: string} = {
        username: trimmedUsername,
      };
      if (trimmedName) {
        body.name = trimmedName;
      }
      const response = await fetch(`${API_BASE_URL}/users/me/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(
          data.message ||
            t('profile.updateFailed', {
              defaultValue: 'Could not update profile. Please try again.',
            }),
        );
        return;
      }
      onSaved(data.user);
    } catch {
      setError(
        t('profile.updateFailed', {
          defaultValue: 'Could not update profile. Please try again.',
        }),
      );
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 28,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      flex: 1,
      paddingRight: 12,
    },
    subtitle: {
      fontSize: 14,
      color: colors.secondaryText,
      lineHeight: 20,
      marginBottom: 16,
    },
    inputGroup: {marginBottom: 12},
    label: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.secondaryText,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      backgroundColor: colors.background,
    },
    input: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 8,
      color: colors.text,
      fontSize: 15,
    },
    primaryBtn: {
      backgroundColor: colors.primary,
      borderRadius: 24,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 8,
    },
    primaryBtnText: {
      color: colors.buttonText,
      fontWeight: '700',
      fontSize: 15,
    },
    error: {
      color: colors.error,
      fontSize: 13,
      marginBottom: 8,
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => {
        if (!required) {
          onCancel();
        }
      }}>
      <Pressable
        style={styles.overlay}
        onPress={() => {
          if (!required) {
            onCancel();
          }
        }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>
                {required
                  ? t('profile.completeProfileTitle', {
                      defaultValue: 'Finish setting up your profile',
                    })
                  : t('profile.editProfileTitle', {
                      defaultValue: 'Edit profile',
                    })}
              </Text>
              {!required && (
                <TouchableOpacity onPress={onCancel} hitSlop={12}>
                  <FontAwesomeIcon
                    icon={faTimes}
                    size={18}
                    color={colors.secondaryText}
                  />
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.subtitle}>
              {required
                ? t('profile.completeProfileBody', {
                    defaultValue:
                      'Pick a username people will recognize. You can change this later on your profile.',
                  })
                : t('profile.editProfileBody', {
                    defaultValue:
                      'Update how you appear to other players.',
                  })}
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                {t('landing.fullName')} ({t('common.optional', {defaultValue: 'optional'})})
              </Text>
              <View style={styles.inputRow}>
                <FontAwesomeIcon
                  icon={faIdCard}
                  size={14}
                  color={colors.placeholder}
                />
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder={t('landing.enterFullName')}
                  placeholderTextColor={colors.placeholder}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('auth.username')}</Text>
              <View style={styles.inputRow}>
                <FontAwesomeIcon
                  icon={faUser}
                  size={14}
                  color={colors.placeholder}
                />
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder={t('landing.chooseUsername')}
                  placeholderTextColor={colors.placeholder}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={styles.primaryBtn}
              disabled={loading}
              onPress={handleSave}>
              {loading ? (
                <ActivityIndicator color={colors.buttonText} />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {required
                    ? t('profile.continueToApp', {
                        defaultValue: 'Continue',
                      })
                    : t('common.save')}
                </Text>
              )}
            </TouchableOpacity>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
