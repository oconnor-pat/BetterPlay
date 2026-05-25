// Add members to an existing Group. Admin-only. Search by username,
// add one at a time via POST /groups/:id/members. Closes when the user
// taps Done.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faTimes,
  faSearch,
  faUserPlus,
  faCheck,
} from '@fortawesome/free-solid-svg-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useTheme} from '../ThemeContext/ThemeContext';
import {API_BASE_URL} from '../../config/api';
import {addGroupMember} from '../../services/GroupsService';
import {Group} from '../../types/group';

interface PickableUser {
  _id: string;
  username: string;
  name?: string;
  profilePicUrl?: string;
}

interface Props {
  visible: boolean;
  group: Group | null;
  onClose: () => void;
  onUpdated: (group: Group) => void;
}

const AddMembersModal: React.FC<Props> = ({
  visible,
  group,
  onClose,
  onUpdated,
}) => {
  const {colors, darkMode} = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PickableUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const memberIds = useMemo(
    () => new Set(group?.members?.map(m => m.userId) || []),
    [group],
  );

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      setAdding(null);
    }
  }, [visible]);

  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const res = await axios.get(`${API_BASE_URL}/users`, {
          params: {search: trimmed},
          headers: token ? {Authorization: `Bearer ${token}`} : {},
        });
        const list: PickableUser[] = (res.data?.users || []).map((u: any) => ({
          _id: String(u._id),
          username: u.username,
          name: u.name,
          profilePicUrl: u.profilePicUrl,
        }));
        setResults(list);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [query]);

  const handleAdd = useCallback(
    async (user: PickableUser) => {
      if (!group) return;
      setAdding(user._id);
      try {
        const updated = await addGroupMember(group._id, user._id);
        onUpdated(updated);
      } catch (err: any) {
        const message =
          err?.response?.data?.message || err?.message || 'Could not add';
        Alert.alert("Couldn't add member", message);
      } finally {
        setAdding(null);
      }
    },
    [group, onUpdated],
  );

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
        searchWrap: {paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8},
        searchBar: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: colors.inputBackground,
          borderRadius: 20,
          paddingHorizontal: 14,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        searchInput: {
          flex: 1,
          paddingVertical: 10,
          color: colors.text,
          fontSize: 15,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 10,
          paddingHorizontal: 16,
        },
        avatar: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: darkMode
            ? 'rgba(255,255,255,0.08)'
            : 'rgba(0,0,0,0.06)',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        avatarImage: {width: 40, height: 40},
        avatarInitials: {color: colors.text, fontWeight: '700', fontSize: 14},
        body: {flex: 1},
        rowName: {fontSize: 15, fontWeight: '600', color: colors.text},
        rowUsername: {
          fontSize: 12,
          color: colors.secondaryText,
          marginTop: 2,
        },
        rowBody: {flex: 1},
        addButton: {
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary + '22',
        },
        addButtonDone: {backgroundColor: colors.primary + '15'},
        emptyHint: {
          textAlign: 'center',
          color: colors.secondaryText,
          fontSize: 13,
          paddingVertical: 16,
        },
      }),
    [colors, darkMode],
  );

  const renderRow = ({item}: {item: PickableUser}) => {
    const alreadyMember = memberIds.has(item._id);
    const isAdding = adding === item._id;
    return (
      <TouchableOpacity
        style={styles.row}
        disabled={alreadyMember || isAdding}
        activeOpacity={0.7}
        onPress={() => handleAdd(item)}>
        <View style={styles.avatar}>
          {item.profilePicUrl ? (
            <Image source={{uri: item.profilePicUrl}} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarInitials}>
              {(item.username || '?').slice(0, 2).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowName} numberOfLines={1}>
            {item.name || item.username}
          </Text>
          <Text style={styles.rowUsername} numberOfLines={1}>
            @{item.username}
          </Text>
        </View>
        <View
          style={[styles.addButton, alreadyMember && styles.addButtonDone]}>
          {isAdding ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <FontAwesomeIcon
              icon={alreadyMember ? faCheck : faUserPlus}
              size={14}
              color={colors.primary}
            />
          )}
        </View>
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
          <Text style={styles.title}>Add members</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.action}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrap}>
          <View style={styles.searchBar}>
            <FontAwesomeIcon icon={faSearch} size={16} color={colors.secondaryText} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search by username"
              placeholderTextColor={colors.secondaryText}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            {searching ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : null}
          </View>
        </View>

        <FlatList
          style={styles.body}
          data={results}
          keyExtractor={r => r._id}
          renderItem={renderRow}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            query.trim().length >= 2 && !searching ? (
              <Text style={styles.emptyHint}>No users found.</Text>
            ) : query.trim().length > 0 && query.trim().length < 2 ? (
              <Text style={styles.emptyHint}>Keep typing…</Text>
            ) : (
              <Text style={styles.emptyHint}>
                Search by username to add anyone with an account.
              </Text>
            )
          }
        />
      </SafeAreaView>
    </Modal>
  );
};

export default AddMembersModal;
