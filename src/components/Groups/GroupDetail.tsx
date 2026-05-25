// Group detail screen — shows the roster, privacy state, and (for
// admins) the full management surface added in PR 4: edit (rename +
// privacy), add members, per-member promote/demote/remove, leave with
// creator handoff, delete.
//
// Permission model recap:
// - Creator: can do everything an admin can, plus delete and transfer.
// - Admin: can edit, add members, promote/demote others, remove
//   anyone except the creator.
// - Member: read-only, plus the right to leave.

import React, {useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faArrowLeft,
  faGlobe,
  faLock,
  faTrash,
  faCrown,
  faPenToSquare,
  faUserPlus,
  faEllipsisH,
  faRightFromBracket,
} from '@fortawesome/free-solid-svg-icons';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useTheme} from '../ThemeContext/ThemeContext';
import {
  deleteGroup,
  getGroup,
  removeGroupMember,
  setGroupMemberRole,
} from '../../services/GroupsService';
import {Group, GroupMember} from '../../types/group';
import UserContext, {UserContextType} from '../UserContext';
import EditGroupModal from './EditGroupModal';
import AddMembersModal from './AddMembersModal';
import TransferOwnershipModal from './TransferOwnershipModal';

const GroupDetail: React.FC = () => {
  const {colors, darkMode} = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const {userData} = useContext(UserContext) as UserContextType;
  const currentUserId = userData?._id;
  const groupId: string | undefined = route.params?.groupId;

  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [addVisible, setAddVisible] = useState(false);
  const [transferVisible, setTransferVisible] = useState(false);

  const refresh = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const g = await getGroup(groupId);
      setGroup(g);
    } catch (err: any) {
      const message =
        err?.response?.data?.message || err?.message || 'Could not load group';
      Alert.alert('Group unavailable', message, [
        {text: 'OK', onPress: () => navigation.goBack()},
      ]);
    } finally {
      setLoading(false);
    }
  }, [groupId, navigation]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isCreator =
    !!group && !!currentUserId && group.createdBy === currentUserId;
  const myMembership = useMemo<GroupMember | undefined>(
    () => group?.members.find(m => m.userId === currentUserId),
    [group, currentUserId],
  );
  const isAdmin = myMembership?.role === 'admin';

  // Iterate the member list with creator + admins first, then everyone
  // else alphabetical by @username. Stable across renders so the list
  // doesn't reshuffle when a row is mutated.
  const sortedMembers = useMemo(() => {
    if (!group) return [];
    return [...group.members].sort((a, b) => {
      if (a.userId === group.createdBy) return -1;
      if (b.userId === group.createdBy) return 1;
      if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
      return (a.username || '').localeCompare(b.username || '');
    });
  }, [group]);

  // ── Mutating actions ───────────────────────────────────────────────
  const handleDelete = useCallback(() => {
    if (!group) return;
    Alert.alert(
      'Delete group?',
      `"${group.name}" will be removed for everyone. This can't be undone.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await deleteGroup(group._id);
              navigation.goBack();
            } catch (err: any) {
              const message =
                err?.response?.data?.message ||
                err?.message ||
                'Could not delete group';
              Alert.alert("Couldn't delete", message);
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }, [group, navigation]);

  // The "Leave group" flow handles three cases in one button:
  //  1. Member or non-creator admin → straight self-remove.
  //  2. Creator with other members → open TransferOwnership picker
  //     first; once the handoff lands, recurse with the (now non-
  //     creator) self-remove.
  //  3. Creator who is the only member → suggest delete instead.
  const performSelfRemove = useCallback(async () => {
    if (!group || !currentUserId) return;
    setBusy(true);
    try {
      await removeGroupMember(group._id, currentUserId);
      navigation.goBack();
    } catch (err: any) {
      const message =
        err?.response?.data?.message || err?.message || 'Could not leave group';
      Alert.alert("Couldn't leave", message);
    } finally {
      setBusy(false);
    }
  }, [group, currentUserId, navigation]);

  const handleLeave = useCallback(() => {
    if (!group || !currentUserId) return;
    if (isCreator) {
      const others = group.members.filter(m => m.userId !== currentUserId);
      if (others.length === 0) {
        Alert.alert(
          "You're the only member",
          'Delete the group instead of leaving it.',
        );
        return;
      }
      setTransferVisible(true);
      return;
    }
    Alert.alert('Leave group?', `You'll be removed from "${group.name}".`, [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Leave', style: 'destructive', onPress: performSelfRemove},
    ]);
  }, [group, currentUserId, isCreator, performSelfRemove]);

  const handleTransferComplete = useCallback(
    (updated: Group) => {
      setTransferVisible(false);
      setGroup(updated);
      // Immediately follow up with self-remove now that the user is no
      // longer the creator. Confirm before kicking the user out so they
      // realize the leave wasn't aborted.
      Alert.alert(
        'Handoff complete',
        'Leave the group now?',
        [
          {
            text: 'Stay',
            style: 'cancel',
            onPress: () => {
              // Stay in the group; just refresh local state so role
              // changes (now plain admin, not creator) reflect.
              refresh();
            },
          },
          {text: 'Leave', style: 'destructive', onPress: performSelfRemove},
        ],
      );
    },
    [performSelfRemove, refresh],
  );

  // Per-member admin menu — actions visible to admins on any row that
  // isn't the creator (creator role is special, transferred not toggled).
  const openMemberMenu = useCallback(
    (member: GroupMember) => {
      if (!group) return;
      const isMemberCreator = member.userId === group.createdBy;
      const isMemberAdmin = member.role === 'admin';
      const isSelf = member.userId === currentUserId;

      const options: {
        label: string;
        style?: 'destructive' | 'cancel';
        onPress: () => void;
      }[] = [];

      if (!isMemberCreator && !isSelf) {
        options.push({
          label: isMemberAdmin ? 'Demote to member' : 'Make admin',
          onPress: async () => {
            setBusy(true);
            try {
              const updated = await setGroupMemberRole(
                group._id,
                member.userId,
                isMemberAdmin ? 'member' : 'admin',
              );
              setGroup(updated);
            } catch (err: any) {
              Alert.alert(
                "Couldn't change role",
                err?.response?.data?.message || err?.message || '',
              );
            } finally {
              setBusy(false);
            }
          },
        });
        options.push({
          label: 'Remove from group',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Remove member?',
              `${member.name || member.username || 'This member'} will be removed from "${group.name}".`,
              [
                {text: 'Cancel', style: 'cancel'},
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: async () => {
                    setBusy(true);
                    try {
                      const updated = await removeGroupMember(
                        group._id,
                        member.userId,
                      );
                      setGroup(updated);
                    } catch (err: any) {
                      Alert.alert(
                        "Couldn't remove",
                        err?.response?.data?.message || err?.message || '',
                      );
                    } finally {
                      setBusy(false);
                    }
                  },
                },
              ],
            );
          },
        });
      }

      if (options.length === 0) return;
      options.push({label: 'Cancel', style: 'cancel', onPress: () => {}});

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: options.map(o => o.label),
            cancelButtonIndex: options.length - 1,
            destructiveButtonIndex: options.findIndex(
              o => o.style === 'destructive',
            ),
          },
          idx => options[idx]?.onPress?.(),
        );
      } else {
        // Android — Alert with up to 3 buttons works for our 2-action menu.
        Alert.alert(
          member.name || member.username || 'Member',
          undefined,
          options.map(o => ({
            text: o.label,
            style: o.style,
            onPress: o.onPress,
          })),
        );
      }
    },
    [group, currentUserId],
  );

  // ── Render ─────────────────────────────────────────────────────────
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {flex: 1, backgroundColor: colors.background},
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          backgroundColor: colors.card,
        },
        backBtn: {padding: 6, marginRight: 4},
        headerTitle: {
          flex: 1,
          fontSize: 17,
          fontWeight: '700',
          color: colors.text,
        },
        headerAction: {
          padding: 8,
          marginLeft: 4,
        },
        loadingWrap: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        },
        hero: {
          paddingHorizontal: 16,
          paddingTop: 20,
          paddingBottom: 16,
          backgroundColor: colors.card,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        groupName: {
          fontSize: 24,
          fontWeight: '700',
          color: colors.text,
          marginBottom: 8,
        },
        metaRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        },
        privacyPill: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: darkMode
            ? 'rgba(255,255,255,0.08)'
            : 'rgba(0,0,0,0.06)',
          borderRadius: 14,
          paddingHorizontal: 10,
          paddingVertical: 4,
        },
        privacyText: {
          fontSize: 12,
          fontWeight: '700',
          color: colors.secondaryText,
        },
        memberCountText: {
          fontSize: 13,
          color: colors.secondaryText,
          fontWeight: '600',
        },
        sectionRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingTop: 18,
          paddingBottom: 8,
        },
        sectionTitle: {
          fontSize: 12,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          color: colors.secondaryText,
        },
        sectionAction: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
        },
        sectionActionText: {
          color: colors.primary,
          fontSize: 13,
          fontWeight: '700',
        },
        memberRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 10,
          paddingHorizontal: 16,
        },
        avatar: {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: darkMode
            ? 'rgba(255,255,255,0.08)'
            : 'rgba(0,0,0,0.06)',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        avatarImage: {width: 44, height: 44},
        avatarInitials: {
          color: colors.text,
          fontWeight: '700',
          fontSize: 15,
        },
        memberBody: {flex: 1},
        memberName: {
          fontSize: 15,
          fontWeight: '600',
          color: colors.text,
        },
        memberUsername: {
          fontSize: 12,
          color: colors.secondaryText,
          marginTop: 2,
        },
        roleBadge: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          backgroundColor: colors.primary + '22',
          borderRadius: 10,
          paddingHorizontal: 8,
          paddingVertical: 3,
        },
        roleBadgeText: {
          color: colors.primary,
          fontSize: 11,
          fontWeight: '700',
        },
        kebabBtn: {
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
        },
        footer: {
          padding: 16,
          gap: 10,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          backgroundColor: colors.card,
        },
        leaveBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: darkMode
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(0,0,0,0.05)',
          borderRadius: 12,
          paddingVertical: 14,
        },
        leaveBtnText: {
          color: colors.text,
          fontSize: 15,
          fontWeight: '700',
        },
        destructiveBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: colors.error + '15',
          borderRadius: 12,
          paddingVertical: 14,
        },
        destructiveBtnText: {
          color: colors.error,
          fontSize: 15,
          fontWeight: '700',
        },
      }),
    [colors, darkMode],
  );

  const renderMember = ({item}: {item: GroupMember}) => {
    const isMemberCreator = group && item.userId === group.createdBy;
    const isMemberAdmin = item.role === 'admin';
    const isSelf = item.userId === currentUserId;
    const showKebab = isAdmin && !isMemberCreator && !isSelf;
    return (
      <View style={styles.memberRow}>
        <View style={styles.avatar}>
          {item.profilePicUrl ? (
            <Image source={{uri: item.profilePicUrl}} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarInitials}>
              {(item.username || item.name || '?').slice(0, 2).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={styles.memberBody}>
          <Text style={styles.memberName} numberOfLines={1}>
            {item.name || item.username || 'Member'}
            {isSelf ? ' (you)' : ''}
          </Text>
          {item.username ? (
            <Text style={styles.memberUsername} numberOfLines={1}>
              @{item.username}
            </Text>
          ) : null}
        </View>
        {isMemberAdmin ? (
          <View style={styles.roleBadge}>
            <FontAwesomeIcon icon={faCrown} size={10} color={colors.primary} />
            <Text style={styles.roleBadgeText}>
              {isMemberCreator ? 'Creator' : 'Admin'}
            </Text>
          </View>
        ) : null}
        {showKebab ? (
          <TouchableOpacity
            style={styles.kebabBtn}
            onPress={() => openMemberMenu(item)}
            disabled={busy}
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
            <FontAwesomeIcon
              icon={faEllipsisH}
              size={16}
              color={colors.secondaryText}
            />
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  if (loading && !group) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <FontAwesomeIcon icon={faArrowLeft} size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Group</Text>
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!group) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <FontAwesomeIcon icon={faArrowLeft} size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Group</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <FontAwesomeIcon icon={faArrowLeft} size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {group.name}
        </Text>
        {isAdmin ? (
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => setEditVisible(true)}
            hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
            <FontAwesomeIcon icon={faPenToSquare} size={18} color={colors.primary} />
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={sortedMembers}
        keyExtractor={item => item.userId}
        renderItem={renderMember}
        ListHeaderComponent={
          <View>
            <View style={styles.hero}>
              <Text style={styles.groupName}>{group.name}</Text>
              <View style={styles.metaRow}>
                <View style={styles.privacyPill}>
                  <FontAwesomeIcon
                    icon={group.privacy === 'public' ? faGlobe : faLock}
                    size={11}
                    color={colors.secondaryText}
                  />
                  <Text style={styles.privacyText}>
                    {group.privacy === 'public' ? 'Public' : 'Private'}
                  </Text>
                </View>
                <Text style={styles.memberCountText}>
                  {group.memberCount}{' '}
                  {group.memberCount === 1 ? 'member' : 'members'}
                </Text>
              </View>
            </View>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Members</Text>
              {isAdmin ? (
                <TouchableOpacity
                  style={styles.sectionAction}
                  onPress={() => setAddVisible(true)}
                  hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                  <FontAwesomeIcon
                    icon={faUserPlus}
                    size={12}
                    color={colors.primary}
                  />
                  <Text style={styles.sectionActionText}>Add</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        }
      />

      <View style={styles.footer}>
        {myMembership ? (
          <TouchableOpacity
            style={styles.leaveBtn}
            onPress={handleLeave}
            disabled={busy}>
            {busy ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <>
                <FontAwesomeIcon
                  icon={faRightFromBracket}
                  size={14}
                  color={colors.text}
                />
                <Text style={styles.leaveBtnText}>Leave group</Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}
        {isCreator ? (
          <TouchableOpacity
            style={styles.destructiveBtn}
            onPress={handleDelete}
            disabled={busy}>
            <FontAwesomeIcon icon={faTrash} size={14} color={colors.error} />
            <Text style={styles.destructiveBtnText}>Delete group</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <EditGroupModal
        visible={editVisible}
        group={group}
        onClose={() => setEditVisible(false)}
        onSaved={updated => {
          setEditVisible(false);
          setGroup(updated);
        }}
      />
      <AddMembersModal
        visible={addVisible}
        group={group}
        onClose={() => setAddVisible(false)}
        onUpdated={updated => setGroup(updated)}
      />
      <TransferOwnershipModal
        visible={transferVisible}
        group={group}
        currentUserId={currentUserId || ''}
        onClose={() => setTransferVisible(false)}
        onTransferred={handleTransferComplete}
      />
    </SafeAreaView>
  );
};

export default GroupDetail;
