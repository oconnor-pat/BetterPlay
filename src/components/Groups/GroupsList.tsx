// Groups tab home screen. Lists the groups the current user belongs to
// and is the primary entry point for creating one. Promoted to a
// top-level tab (from its previous home as a section inside Profile) so
// the "recurring crew" primitive — central to the app's reason for
// existing — is one tap away instead of buried.
//
// Navigation: each row pushes GroupDetail within the Groups stack.
// Creating a group opens GroupDetail for the new group immediately so
// the user lands on the management surface to add members.

import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faChevronRight,
  faGlobe,
  faLock,
  faPlus,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../ThemeContext/ThemeContext';
import {Group} from '../../types/group';
import {listMyGroups} from '../../services/GroupsService';
import CreateGroupModal from './CreateGroupModal';
import RosterAvatarStrip from '../shared/RosterAvatarStrip';

const GroupsList: React.FC = () => {
  const {colors} = useTheme();
  const {t} = useTranslation();
  const navigation = useNavigation<any>();

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);

  // Reload on focus so a group created/deleted on GroupDetail (or
  // elsewhere) is reflected when the user returns to the list.
  const loadGroups = useCallback(async () => {
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

  useFocusEffect(
    useCallback(() => {
      loadGroups();
    }, [loadGroups]),
  );

  const handleGroupCreated = useCallback(
    (group: Group) => {
      setCreateVisible(false);
      setGroups(prev => [group, ...prev.filter(g => g._id !== group._id)]);
      navigation.navigate('GroupDetail', {groupId: group._id});
    },
    [navigation],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 12,
        },
        title: {
          fontSize: 24,
          fontWeight: '800',
          color: colors.text,
        },
        newButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          backgroundColor: colors.primary,
          borderRadius: 20,
          paddingVertical: 8,
          paddingHorizontal: 14,
        },
        newButtonText: {
          color: '#FFFFFF',
          fontSize: 14,
          fontWeight: '700',
        },
        loadingWrap: {
          paddingVertical: 32,
          alignItems: 'center',
        },
        emptyCard: {
          margin: 16,
          padding: 20,
          borderRadius: 16,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.card,
          alignItems: 'center',
        },
        emptyIcon: {
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary + '15',
          marginBottom: 14,
        },
        emptyTitle: {
          fontSize: 17,
          fontWeight: '700',
          color: colors.text,
          marginBottom: 6,
          textAlign: 'center',
        },
        emptySubtitle: {
          fontSize: 13,
          color: colors.secondaryText,
          textAlign: 'center',
          lineHeight: 19,
          marginBottom: 16,
        },
        emptyCta: {
          backgroundColor: colors.primary,
          borderRadius: 22,
          paddingVertical: 11,
          paddingHorizontal: 22,
        },
        emptyCtaText: {
          color: '#FFFFFF',
          fontSize: 14,
          fontWeight: '700',
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        rowAvatars: {
          marginRight: 12,
          justifyContent: 'center',
        },
        rowContent: {
          flex: 1,
        },
        rowTitle: {
          fontSize: 16,
          fontWeight: '600',
          color: colors.text,
        },
        rowMetaRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginTop: 2,
        },
        rowSubtitle: {
          fontSize: 12,
          color: colors.secondaryText,
        },
      }),
    [colors],
  );

  const renderRow = ({item: g}: {item: Group}) => (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('GroupDetail', {groupId: g._id})}>
      <View style={styles.rowAvatars}>
        <RosterAvatarStrip
          members={g.members}
          maxVisible={3}
          size={28}
          overlap={10}
        />
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {g.name}
        </Text>
        <View style={styles.rowMetaRow}>
          <FontAwesomeIcon
            icon={g.privacy === 'public' ? faGlobe : faLock}
            size={10}
            color={colors.secondaryText}
          />
          <Text style={styles.rowSubtitle}>
            {g.memberCount} {g.memberCount === 1 ? 'member' : 'members'}
          </Text>
        </View>
      </View>
      <FontAwesomeIcon
        icon={faChevronRight}
        size={13}
        color={colors.secondaryText}
      />
    </TouchableOpacity>
  );

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      );
    }
    return (
      <View style={styles.emptyCard}>
        <View style={styles.emptyIcon}>
          <FontAwesomeIcon icon={faUsers} size={22} color={colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>
          {t('profile.startAGroup') || 'Start a group'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {t('profile.startAGroupSubtitle') ||
            'Keep the trivia crew (or hockey guys) together.'}
        </Text>
        <TouchableOpacity
          style={styles.emptyCta}
          activeOpacity={0.85}
          onPress={() => setCreateVisible(true)}>
          <Text style={styles.emptyCtaText}>
            {t('profile.newGroup') || 'New group'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('navigation.groups') || 'Groups'}</Text>
        <TouchableOpacity
          style={styles.newButton}
          activeOpacity={0.85}
          onPress={() => setCreateVisible(true)}>
          <FontAwesomeIcon icon={faPlus} size={12} color="#FFFFFF" />
          <Text style={styles.newButtonText}>
            {t('profile.newGroup') || 'New'}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={groups}
        keyExtractor={g => g._id}
        renderItem={renderRow}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={groups.length === 0 ? {flexGrow: 1} : undefined}
      />

      <CreateGroupModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onCreated={handleGroupCreated}
      />
    </SafeAreaView>
  );
};

export default GroupsList;
