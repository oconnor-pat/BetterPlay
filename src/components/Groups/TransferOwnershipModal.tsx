// Successor picker shown when the creator leaves a group. The creator
// picks any current member; that member becomes the new creator + admin,
// and the previous creator is then free to leave via the standard remove
// route (the parent component handles that follow-up step).

import React, {useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {faTimes} from '@fortawesome/free-solid-svg-icons';
import {useTheme} from '../ThemeContext/ThemeContext';
import {transferGroupOwnership} from '../../services/GroupsService';
import {Group, GroupMember} from '../../types/group';

interface Props {
  visible: boolean;
  group: Group | null;
  currentUserId: string;
  onClose: () => void;
  onTransferred: (group: Group, successorId: string) => void;
}

const TransferOwnershipModal: React.FC<Props> = ({
  visible,
  group,
  currentUserId,
  onClose,
  onTransferred,
}) => {
  const {colors, darkMode} = useTheme();
  const [submitting, setSubmitting] = useState<string | null>(null);

  const candidates = useMemo<GroupMember[]>(() => {
    if (!group) return [];
    return group.members.filter(m => m.userId !== currentUserId);
  }, [group, currentUserId]);

  const handlePick = async (member: GroupMember) => {
    if (!group) return;
    Alert.alert(
      'Hand off the group?',
      `${member.name || member.username || 'This member'} will become the new creator and admin. You can leave after that.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Hand off',
          style: 'default',
          onPress: async () => {
            setSubmitting(member.userId);
            try {
              const updated = await transferGroupOwnership(
                group._id,
                member.userId,
              );
              onTransferred(updated, member.userId);
            } catch (err: any) {
              const message =
                err?.response?.data?.message ||
                err?.message ||
                'Could not transfer ownership';
              Alert.alert("Couldn't hand off", message);
            } finally {
              setSubmitting(null);
            }
          },
        },
      ],
    );
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
        intro: {
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 8,
          fontSize: 14,
          color: colors.secondaryText,
          lineHeight: 20,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        avatar: {
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: darkMode
            ? 'rgba(255,255,255,0.08)'
            : 'rgba(0,0,0,0.06)',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        avatarImage: {width: 42, height: 42},
        avatarInitials: {color: colors.text, fontWeight: '700', fontSize: 15},
        body: {flex: 1},
        rowName: {fontSize: 15, fontWeight: '600', color: colors.text},
        rowUsername: {
          fontSize: 12,
          color: colors.secondaryText,
          marginTop: 2,
        },
        rowBody: {flex: 1},
        empty: {
          textAlign: 'center',
          paddingHorizontal: 24,
          paddingTop: 60,
          color: colors.secondaryText,
          fontSize: 13,
          lineHeight: 18,
        },
      }),
    [colors, darkMode],
  );

  const renderRow = ({item}: {item: GroupMember}) => {
    const isSubmitting = submitting === item.userId;
    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.7}
        disabled={!!submitting}
        onPress={() => handlePick(item)}>
        <View style={styles.avatar}>
          {item.profilePicUrl ? (
            <Image source={{uri: item.profilePicUrl}} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarInitials}>
              {(item.username || item.name || '?').slice(0, 2).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowName} numberOfLines={1}>
            {item.name || item.username || 'Member'}
          </Text>
          {item.username ? (
            <Text style={styles.rowUsername} numberOfLines={1}>
              @{item.username}
            </Text>
          ) : null}
        </View>
        {isSubmitting ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <FontAwesomeIcon icon={faTimes} size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Pick a new creator</Text>
          <View style={{width: 20}} />
        </View>
        <Text style={styles.intro}>
          You're the creator, so before you can leave you need to hand the
          group off to someone else.
        </Text>
        <FlatList
          style={styles.body}
          data={candidates}
          keyExtractor={m => m.userId}
          renderItem={renderRow}
          ListEmptyComponent={
            <Text style={styles.empty}>
              You're the only member. Delete the group instead of leaving it.
            </Text>
          }
        />
      </SafeAreaView>
    </Modal>
  );
};

export default TransferOwnershipModal;
