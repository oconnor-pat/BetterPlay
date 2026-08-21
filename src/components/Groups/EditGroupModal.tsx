// Edit a Group's name and privacy. Admin-only. PATCH /groups/:id.
// Used by GroupDetail's "Edit" header action.

import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faTimes,
  faGlobe,
  faLock,
  faPenToSquare,
} from '@fortawesome/free-solid-svg-icons';
import {useTheme} from '../ThemeContext/ThemeContext';
import {updateGroup} from '../../services/GroupsService';
import {Group, GroupPrivacy} from '../../types/group';

interface Props {
  visible: boolean;
  group: Group | null;
  onClose: () => void;
  onSaved: (group: Group) => void;
}

const EditGroupModal: React.FC<Props> = ({visible, group, onClose, onSaved}) => {
  const {colors, darkMode} = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [privacy, setPrivacy] = useState<GroupPrivacy>('private');
  const [saving, setSaving] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (visible && group) {
      setName(group.name);
      setPrivacy(group.privacy);
      setSaving(false);
    }
    if (!visible) {
      setKeyboardHeight(0);
    }
  }, [visible, group]);

  useEffect(() => {
    if (!visible) return;
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvent, e => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [visible]);

  const canSave = name.trim().length > 0 && !saving;
  const keyboardPad =
    keyboardHeight > 0 ? Math.max(0, keyboardHeight - insets.bottom) : 0;

  const handleSave = async () => {
    if (!group) return;
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Give your group a name.');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateGroup(group._id, {name: trimmed, privacy});
      onSaved(updated);
    } catch (err: any) {
      const message =
        err?.response?.data?.message || err?.message || 'Could not save changes';
      Alert.alert("Couldn't save", message);
    } finally {
      setSaving(false);
    }
  };

  const privacyHint =
    privacy === 'private'
      ? 'Only people you add can see this group and its chat.'
      : 'Anyone can find this group. You still control who joins.';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {flex: 1, backgroundColor: colors.background},
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
        },
        headerSide: {width: 40, alignItems: 'flex-start'},
        title: {
          flex: 1,
          textAlign: 'center',
          fontSize: 17,
          fontWeight: '800',
          color: colors.text,
        },
        flex: {flex: 1},
        bodyContent: {
          paddingHorizontal: 16,
          paddingTop: 4,
          paddingBottom: 24,
        },
        introCard: {
          borderRadius: 18,
          backgroundColor: colors.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: 18,
          marginBottom: 18,
          overflow: 'hidden',
        },
        introGlow: {
          position: 'absolute',
          width: 140,
          height: 140,
          borderRadius: 70,
          top: -50,
          right: -36,
          backgroundColor: colors.primary + '22',
        },
        introIcon: {
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary + '18',
          marginBottom: 12,
        },
        introTitle: {
          fontSize: 20,
          fontWeight: '800',
          color: colors.text,
          letterSpacing: -0.2,
          marginBottom: 6,
        },
        introSubtitle: {
          fontSize: 13,
          lineHeight: 19,
          color: colors.secondaryText,
          fontWeight: '500',
        },
        panel: {
          borderRadius: 16,
          backgroundColor: colors.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: 14,
          marginBottom: 14,
        },
        label: {
          fontSize: 12,
          fontWeight: '700',
          color: colors.secondaryText,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          marginBottom: 10,
        },
        nameInput: {
          backgroundColor: darkMode
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(0,0,0,0.04)',
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 13,
          color: colors.text,
          fontSize: 17,
          fontWeight: '700',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        privacyRow: {
          flexDirection: 'row',
          backgroundColor: darkMode
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(0,0,0,0.04)',
          borderRadius: 14,
          padding: 4,
        },
        privacyOption: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 11,
          borderRadius: 11,
          gap: 6,
        },
        privacyOptionActive: {backgroundColor: colors.primary},
        privacyText: {
          fontSize: 13,
          fontWeight: '700',
          color: colors.secondaryText,
        },
        privacyTextActive: {color: '#FFFFFF'},
        privacyHint: {
          marginTop: 10,
          fontSize: 12,
          lineHeight: 17,
          color: colors.secondaryText,
        },
        footer: {
          paddingHorizontal: 16,
          paddingTop: 16,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          backgroundColor: colors.background,
        },
        saveBtn: {
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary,
          borderRadius: 16,
          paddingVertical: 15,
        },
        saveBtnDisabled: {
          backgroundColor: darkMode
            ? 'rgba(255,255,255,0.08)'
            : 'rgba(0,0,0,0.06)',
        },
        saveBtnText: {
          color: '#FFFFFF',
          fontSize: 16,
          fontWeight: '800',
        },
        saveBtnTextDisabled: {
          color: colors.secondaryText,
        },
      }),
    [colors, darkMode],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerSide}>
            <TouchableOpacity onPress={onClose} disabled={saving}>
              <FontAwesomeIcon icon={faTimes} size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
          <Text style={styles.title}>Edit group</Text>
          <View style={styles.headerSide} />
        </View>

        <View style={[styles.flex, {paddingBottom: keyboardPad}]}>
          <ScrollView
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}>
            <View style={styles.introCard}>
              <View style={styles.introGlow} pointerEvents="none" />
              <View style={styles.introIcon}>
                <FontAwesomeIcon
                  icon={faPenToSquare}
                  size={18}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.introTitle}>
                {group?.name || 'Edit group'}
              </Text>
              <Text style={styles.introSubtitle}>
                Update the name or privacy — members and chat stay intact.
              </Text>
            </View>

            <View style={styles.panel}>
              <Text style={styles.label}>Group name</Text>
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                maxLength={60}
                autoFocus
                placeholder="Group name"
                placeholderTextColor={colors.secondaryText}
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
            </View>

            <View style={styles.panel}>
              <Text style={styles.label}>Privacy</Text>
              <View style={styles.privacyRow}>
                <TouchableOpacity
                  style={[
                    styles.privacyOption,
                    privacy === 'private' && styles.privacyOptionActive,
                  ]}
                  onPress={() => setPrivacy('private')}
                  activeOpacity={0.85}>
                  <FontAwesomeIcon
                    icon={faLock}
                    size={12}
                    color={
                      privacy === 'private' ? '#FFFFFF' : colors.secondaryText
                    }
                  />
                  <Text
                    style={[
                      styles.privacyText,
                      privacy === 'private' && styles.privacyTextActive,
                    ]}>
                    Private
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.privacyOption,
                    privacy === 'public' && styles.privacyOptionActive,
                  ]}
                  onPress={() => setPrivacy('public')}
                  activeOpacity={0.85}>
                  <FontAwesomeIcon
                    icon={faGlobe}
                    size={12}
                    color={
                      privacy === 'public' ? '#FFFFFF' : colors.secondaryText
                    }
                  />
                  <Text
                    style={[
                      styles.privacyText,
                      privacy === 'public' && styles.privacyTextActive,
                    ]}>
                    Public
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.privacyHint}>{privacyHint}</Text>
            </View>
          </ScrollView>

          <View
            style={[
              styles.footer,
              {paddingBottom: Math.max(20, insets.bottom + 8)},
            ]}>
            <TouchableOpacity
              style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!canSave}
              activeOpacity={0.85}>
              {saving ? (
                <ActivityIndicator
                  size="small"
                  color={canSave ? '#FFFFFF' : colors.secondaryText}
                />
              ) : (
                <Text
                  style={[
                    styles.saveBtnText,
                    !canSave && styles.saveBtnTextDisabled,
                  ]}>
                  Save changes
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default EditGroupModal;
