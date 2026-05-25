// Edit a Group's name and privacy. Admin-only. PATCH /groups/:id.
// Used by GroupDetail's "Edit" header action.

import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {faTimes, faGlobe, faLock} from '@fortawesome/free-solid-svg-icons';
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
  const {colors} = useTheme();
  const [name, setName] = useState('');
  const [privacy, setPrivacy] = useState<GroupPrivacy>('private');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && group) {
      setName(group.name);
      setPrivacy(group.privacy);
      setSaving(false);
    }
  }, [visible, group]);

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
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        title: {fontSize: 17, fontWeight: '700', color: colors.text},
        action: {fontSize: 15, fontWeight: '700', color: colors.primary},
        actionDisabled: {color: colors.secondaryText},
        body: {paddingHorizontal: 16, paddingTop: 16},
        label: {
          fontSize: 12,
          fontWeight: '700',
          color: colors.secondaryText,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          marginBottom: 8,
        },
        nameInput: {
          backgroundColor: colors.inputBackground,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
          color: colors.text,
          fontSize: 17,
          fontWeight: '600',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        section: {marginTop: 22},
        privacyRow: {
          flexDirection: 'row',
          backgroundColor: colors.inputBackground,
          borderRadius: 12,
          padding: 4,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        privacyOption: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 10,
          borderRadius: 9,
          gap: 6,
        },
        privacyOptionActive: {backgroundColor: colors.card},
        privacyText: {
          fontSize: 13,
          fontWeight: '700',
          color: colors.secondaryText,
        },
        privacyTextActive: {color: colors.text},
      }),
    [colors],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} disabled={saving}>
            <FontAwesomeIcon icon={faTimes} size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Edit group</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving || !name.trim()}>
            {saving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text
                style={[
                  styles.action,
                  (!name.trim() || saving) && styles.actionDisabled,
                ]}>
                Save
              </Text>
            )}
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.body}>
          <View>
            <Text style={styles.label}>Group name</Text>
            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              maxLength={60}
              autoFocus
            />
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>Privacy</Text>
            <View style={styles.privacyRow}>
              <TouchableOpacity
                style={[
                  styles.privacyOption,
                  privacy === 'private' && styles.privacyOptionActive,
                ]}
                onPress={() => setPrivacy('private')}>
                <FontAwesomeIcon
                  icon={faLock}
                  size={12}
                  color={privacy === 'private' ? colors.text : colors.secondaryText}
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
                onPress={() => setPrivacy('public')}>
                <FontAwesomeIcon
                  icon={faGlobe}
                  size={12}
                  color={privacy === 'public' ? colors.text : colors.secondaryText}
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
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

export default EditGroupModal;
