// Groups tab home screen. Lists the groups the current user belongs to
// and is the primary entry point for creating one. Promoted to a
// top-level tab (from its previous home as a section inside Profile) so
// the "recurring crew" primitive — central to the app's reason for
// existing — is one tap away instead of buried.
//
// Navigation: each row pushes GroupDetail within the Groups stack.
// Creating a group opens GroupDetail for the new group immediately so
// the user lands on the management surface to add members.

import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
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
import {Group, GroupLastMessage} from '../../types/group';
import {listMyGroups} from '../../services/GroupsService';
import {useSocket} from '../../Context/SocketContext';
import UserContext, {UserContextType} from '../UserContext';
import CreateGroupModal from './CreateGroupModal';
import RosterAvatarStrip from '../shared/RosterAvatarStrip';

const GroupsList: React.FC = () => {
  const {colors, darkMode} = useTheme();
  const {t} = useTranslation();
  const navigation = useNavigation<any>();
  const {subscribe} = useSocket();
  const {userData} = useContext(UserContext) as UserContextType;
  const currentUserId = userData?._id;

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

  // Live updates so the tab reads like a hub: bump unread + refresh the
  // preview when a message lands, and clear the badge when the thread is
  // read on any device.
  useEffect(() => {
    const unsubActivity = subscribe(
      'group:activity',
      (payload: {
        groupId: string;
        senderId: string;
        lastMessage: GroupLastMessage;
      }) => {
        if (!payload?.groupId) return;
        setGroups(prev => {
          const idx = prev.findIndex(g => g._id === payload.groupId);
          if (idx === -1) return prev;
          const fromMe = payload.senderId === currentUserId;
          const updated: Group = {
            ...prev[idx],
            lastMessage: payload.lastMessage,
            unreadCount: fromMe
              ? prev[idx].unreadCount || 0
              : (prev[idx].unreadCount || 0) + 1,
          };
          // Float the active conversation to the top.
          const rest = prev.filter(g => g._id !== payload.groupId);
          return [updated, ...rest];
        });
      },
    );
    const unsubRead = subscribe('group:read', (payload: {groupId: string}) => {
      if (!payload?.groupId) return;
      setGroups(prev =>
        prev.map(g => (g._id === payload.groupId ? {...g, unreadCount: 0} : g)),
      );
    });
    return () => {
      unsubActivity();
      unsubRead();
    };
  }, [subscribe, currentUserId]);

  // Optimistically clear a group's badge when opening it — the detail
  // screen marks it read on mount, and the socket `group:read` will
  // confirm; this just avoids a stale badge flash on the way in.
  const openGroup = useCallback(
    (groupId: string) => {
      setGroups(prev =>
        prev.map(g => (g._id === groupId ? {...g, unreadCount: 0} : g)),
      );
      navigation.navigate('GroupDetail', {groupId});
    },
    [navigation],
  );

  const previewText = useCallback(
    (g: Group): string | null => {
      const lm = g.lastMessage;
      if (!lm) return null;
      if (lm.kind === 'system') return lm.text;
      const who =
        lm.senderId === currentUserId ? 'You' : lm.username || 'Someone';
      // The server sends empty text for photo-only and retracted messages,
      // flagging which so the stand-in wording can be localized here.
      const body = lm.deleted
        ? t('groupChat.messageDeleted') || 'This message was deleted'
        : lm.text || (lm.hasImage ? t('groupChat.photo') || '📷 Photo' : '');
      return `${who}: ${body}`;
    },
    [currentUserId, t],
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
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: 14,
        },
        headerCopy: {
          flex: 1,
          paddingRight: 12,
        },
        title: {
          fontSize: 28,
          fontWeight: '800',
          color: colors.text,
          letterSpacing: -0.4,
        },
        subtitle: {
          marginTop: 4,
          fontSize: 13,
          fontWeight: '600',
          color: colors.secondaryText,
        },
        newButton: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: colors.primary,
          borderRadius: 22,
          paddingVertical: 10,
          paddingHorizontal: 14,
        },
        newButtonText: {
          color: '#FFFFFF',
          fontSize: 14,
          fontWeight: '700',
        },
        listContent: {
          paddingHorizontal: 16,
          paddingBottom: 24,
        },
        loadingWrap: {
          paddingVertical: 48,
          alignItems: 'center',
        },
        emptyCard: {
          marginTop: 24,
          padding: 24,
          borderRadius: 18,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.card,
          alignItems: 'center',
          overflow: 'hidden',
        },
        emptyGlow: {
          position: 'absolute',
          width: 140,
          height: 140,
          borderRadius: 70,
          top: -50,
          right: -40,
          backgroundColor: colors.primary + '20',
        },
        emptyIcon: {
          width: 64,
          height: 64,
          borderRadius: 32,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary + '18',
          marginBottom: 16,
        },
        emptyTitle: {
          fontSize: 18,
          fontWeight: '800',
          color: colors.text,
          marginBottom: 6,
          textAlign: 'center',
        },
        emptySubtitle: {
          fontSize: 13,
          color: colors.secondaryText,
          textAlign: 'center',
          lineHeight: 19,
          marginBottom: 18,
        },
        emptyCta: {
          backgroundColor: colors.primary,
          borderRadius: 22,
          paddingVertical: 12,
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
          paddingVertical: 14,
          paddingHorizontal: 14,
          marginBottom: 10,
          borderRadius: 16,
          backgroundColor: colors.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        rowUnread: {
          borderColor: colors.primary + '55',
          backgroundColor: darkMode
            ? colors.primary + '14'
            : colors.primary + '10',
        },
        rowAvatars: {
          marginRight: 12,
          justifyContent: 'center',
        },
        rowContent: {
          flex: 1,
          minWidth: 0,
        },
        rowTitle: {
          fontSize: 16,
          fontWeight: '700',
          color: colors.text,
        },
        rowTitleUnread: {
          fontWeight: '800',
        },
        rowMetaRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          marginTop: 3,
        },
        rowSubtitle: {
          fontSize: 12,
          color: colors.secondaryText,
          fontWeight: '600',
        },
        rowPreview: {
          fontSize: 13,
          color: colors.secondaryText,
          marginTop: 3,
        },
        rowPreviewUnread: {
          color: colors.text,
          fontWeight: '700',
        },
        rowTrail: {
          alignItems: 'flex-end',
          justifyContent: 'center',
          marginLeft: 8,
          gap: 8,
        },
        unreadBadge: {
          minWidth: 22,
          height: 22,
          borderRadius: 11,
          paddingHorizontal: 7,
          backgroundColor: '#FF3B30',
          alignItems: 'center',
          justifyContent: 'center',
        },
        unreadBadgeText: {
          color: '#FFFFFF',
          fontSize: 12,
          fontWeight: '800',
        },
      }),
    [colors, darkMode],
  );

  const renderRow = ({item: g}: {item: Group}) => {
    const preview = previewText(g);
    const unread = g.unreadCount || 0;
    return (
      <TouchableOpacity
        style={[styles.row, unread > 0 && styles.rowUnread]}
        activeOpacity={0.75}
        onPress={() => openGroup(g._id)}>
        <View style={styles.rowAvatars}>
          <RosterAvatarStrip
            members={g.members}
            maxVisible={3}
            size={32}
            overlap={11}
          />
        </View>
        <View style={styles.rowContent}>
          <Text
            style={[styles.rowTitle, unread > 0 && styles.rowTitleUnread]}
            numberOfLines={1}>
            {g.name}
          </Text>
          {preview ? (
            <Text
              style={[styles.rowPreview, unread > 0 && styles.rowPreviewUnread]}
              numberOfLines={1}>
              {preview}
            </Text>
          ) : (
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
          )}
        </View>
        <View style={styles.rowTrail}>
          {unread > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {unread > 99 ? '99+' : unread}
              </Text>
            </View>
          ) : (
            <FontAwesomeIcon
              icon={faChevronRight}
              size={12}
              color={colors.secondaryText}
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

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
        <View style={styles.emptyGlow} pointerEvents="none" />
        <View style={styles.emptyIcon}>
          <FontAwesomeIcon icon={faUsers} size={24} color={colors.primary} />
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

  const groupCountLabel =
    groups.length === 1
      ? '1 group'
      : `${groups.length} groups`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{t('navigation.groups') || 'Groups'}</Text>
          {!loading && groups.length > 0 ? (
            <Text style={styles.subtitle}>{groupCountLabel}</Text>
          ) : (
            <Text style={styles.subtitle}>
              {t('profile.groupsSubtitle') || 'Your crews and hangouts'}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.newButton}
          activeOpacity={0.85}
          onPress={() => setCreateVisible(true)}
          accessibilityLabel={t('profile.newGroup') || 'New group'}>
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
        contentContainerStyle={[
          styles.listContent,
          groups.length === 0 ? {flexGrow: 1} : null,
        ]}
      />

      <CreateGroupModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onCreated={handleGroupCreated}
        currentUserId={currentUserId || ''}
      />
    </SafeAreaView>
  );
};

export default GroupsList;
