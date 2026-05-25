// Modal for picking one of the current user's Groups to attach to an
// event during creation. Tapping a row returns the full Group object via
// onSelect — the parent merges its members into the event's invitedUsers
// and stores the groupId/groupName on the event payload.

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faTimes,
  faGlobe,
  faLock,
  faUsers,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import {useTheme} from '../ThemeContext/ThemeContext';
import {listMyGroups} from '../../services/GroupsService';
import {Group} from '../../types/group';
import RosterAvatarStrip from '../shared/RosterAvatarStrip';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (group: Group) => void;
}

const GroupPickerModal: React.FC<Props> = ({visible, onClose, onSelect}) => {
  const {colors, darkMode} = useTheme();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listMyGroups();
      setGroups(list);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      load();
    }
  }, [visible, load]);

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
        headerTitle: {
          fontSize: 17,
          fontWeight: '700',
          color: colors.text,
        },
        body: {flex: 1},
        loadingWrap: {flex: 1, alignItems: 'center', justifyContent: 'center'},
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        avatarsWrap: {
          // Natural-width avatar strip in the leading column. Variable
          // width is fine — each group's strip becomes its visual
          // fingerprint, same convention as the Profile "My Groups" row.
          marginRight: 12,
          justifyContent: 'center',
        },
        rowBody: {flex: 1},
        rowName: {
          fontSize: 15,
          fontWeight: '700',
          color: colors.text,
        },
        rowMeta: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginTop: 3,
        },
        rowMetaText: {
          fontSize: 12,
          color: colors.secondaryText,
          fontWeight: '600',
        },
        emptyWrap: {
          alignItems: 'center',
          paddingHorizontal: 24,
          paddingTop: 60,
        },
        emptyTitle: {
          fontSize: 16,
          fontWeight: '700',
          color: colors.text,
          marginTop: 14,
          textAlign: 'center',
        },
        emptySubtitle: {
          fontSize: 13,
          color: colors.secondaryText,
          marginTop: 6,
          textAlign: 'center',
          lineHeight: 18,
        },
        emptyIconWrap: {
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: darkMode
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(0,0,0,0.05)',
        },
      }),
    [colors, darkMode],
  );

  const renderGroup = ({item}: {item: Group}) => (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => onSelect(item)}>
      <View style={styles.avatarsWrap}>
        <RosterAvatarStrip
          members={item.members}
          maxVisible={3}
          size={28}
          overlap={10}
        />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.rowMeta}>
          <FontAwesomeIcon
            icon={item.privacy === 'public' ? faGlobe : faLock}
            size={10}
            color={colors.secondaryText}
          />
          <Text style={styles.rowMetaText}>
            {item.memberCount}{' '}
            {item.memberCount === 1 ? 'member' : 'members'}
          </Text>
        </View>
      </View>
      <FontAwesomeIcon icon={faChevronRight} size={13} color={colors.secondaryText} />
    </TouchableOpacity>
  );

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
          <Text style={styles.headerTitle}>Invite a group</Text>
          <View style={{width: 20}} />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            style={styles.body}
            data={groups}
            keyExtractor={g => g._id}
            renderItem={renderGroup}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIconWrap}>
                  <FontAwesomeIcon
                    icon={faUsers}
                    size={22}
                    color={colors.secondaryText}
                  />
                </View>
                <Text style={styles.emptyTitle}>No groups yet</Text>
                <Text style={styles.emptySubtitle}>
                  Create a group from your profile to make inviting your trivia
                  crew or hockey guys a one-tap affair.
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

export default GroupPickerModal;
