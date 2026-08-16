import React, {useState} from 'react';
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
import {faLock, faTimes, faUser} from '@fortawesome/free-solid-svg-icons';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../ThemeContext/ThemeContext';
import {linkSocialAccountToExisting} from '../../services/SocialAuthService';

type Props = {
  visible: boolean;
  orphanToken: string | null;
  isPrivateRelay?: boolean;
  /** When true, go straight to username/password (Settings). */
  startOnCredentials?: boolean;
  onCancel: () => void;
  /** Keep the newly created social account without linking. */
  onKeepNew: () => void;
  onLinked: (user: any, token: string) => void;
};

export default function LinkAccountModal({
  visible,
  orphanToken,
  isPrivateRelay,
  startOnCredentials,
  onCancel,
  onKeepNew,
  onLinked,
}: Props) {
  const {t} = useTranslation();
  const {colors} = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'ask' | 'credentials'>(
    startOnCredentials ? 'credentials' : 'ask',
  );

  React.useEffect(() => {
    if (visible) {
      setStep(startOnCredentials ? 'credentials' : 'ask');
      setError(null);
    }
  }, [visible, startOnCredentials]);

  const reset = () => {
    setUsername('');
    setPassword('');
    setLoading(false);
    setError(null);
    setStep('ask');
  };

  const handleClose = () => {
    reset();
    onCancel();
  };

  const handleKeepNew = () => {
    reset();
    onKeepNew();
  };

  const handleLink = async () => {
    if (!orphanToken) {
      return;
    }
    if (!username.trim() || !password) {
      setError(
        t('auth.linkMissingFields', {
          defaultValue: 'Enter your existing username and password.',
        }),
      );
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await linkSocialAccountToExisting(
        orphanToken,
        username.trim(),
        password,
      );
      if (!result.success) {
        setError(result.message);
        return;
      }
      reset();
      onLinked(result.user, result.token);
    } catch {
      setError(
        t('auth.linkFailed', {
          defaultValue: 'Could not link accounts. Please try again.',
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
    secondaryBtn: {
      borderRadius: 24,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    secondaryBtnText: {
      color: colors.text,
      fontWeight: '700',
      fontSize: 15,
    },
    ghostBtn: {
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 4,
    },
    ghostBtnText: {
      color: colors.secondaryText,
      fontSize: 14,
      fontWeight: '600',
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
      onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>
                {t('auth.linkAccountTitle', {
                  defaultValue: 'Already have an account?',
                })}
              </Text>
              <TouchableOpacity onPress={handleClose} hitSlop={12}>
                <FontAwesomeIcon
                  icon={faTimes}
                  size={18}
                  color={colors.secondaryText}
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.subtitle}>
              {isPrivateRelay
                ? t('auth.linkAccountRelayBody', {
                    defaultValue:
                      'Apple hid your email, so we created a new account. Sign in with your existing BetterPlay username and password to merge them.',
                  })
                : t('auth.linkAccountBody', {
                    defaultValue:
                      'If you already use BetterPlay, link this sign-in to your existing account so your events and profile stay together.',
                  })}
            </Text>

            {step === 'ask' ? (
              <>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => setStep('credentials')}>
                  <Text style={styles.primaryBtnText}>
                    {t('auth.linkToExisting', {
                      defaultValue: 'Link to existing account',
                    })}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={handleKeepNew}>
                  <Text style={styles.secondaryBtnText}>
                    {t('auth.keepNewAccount', {
                      defaultValue: 'Keep this new account',
                    })}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
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
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={username}
                      onChangeText={setUsername}
                      placeholder={t('landing.enterUsername')}
                      placeholderTextColor={colors.placeholder}
                    />
                  </View>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t('auth.password')}</Text>
                  <View style={styles.inputRow}>
                    <FontAwesomeIcon
                      icon={faLock}
                      size={14}
                      color={colors.placeholder}
                    />
                    <TextInput
                      style={styles.input}
                      secureTextEntry
                      autoCapitalize="none"
                      value={password}
                      onChangeText={setPassword}
                      placeholder={t('landing.enterPassword')}
                      placeholderTextColor={colors.placeholder}
                    />
                  </View>
                </View>
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <TouchableOpacity
                  style={styles.primaryBtn}
                  disabled={loading}
                  onPress={handleLink}>
                  {loading ? (
                    <ActivityIndicator color={colors.buttonText} />
                  ) : (
                    <Text style={styles.primaryBtnText}>
                      {t('auth.linkAccounts', {
                        defaultValue: 'Link accounts',
                      })}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.ghostBtn}
                  onPress={() => {
                    setError(null);
                    setStep('ask');
                  }}>
                  <Text style={styles.ghostBtnText}>{t('common.back')}</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
