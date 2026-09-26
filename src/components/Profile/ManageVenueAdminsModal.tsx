import React, {useCallback, useEffect, useState} from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {faXmark, faUserPlus, faTrash} from '@fortawesome/free-solid-svg-icons';
import {useTheme} from '../ThemeContext/ThemeContext';
import {API_BASE_URL} from '../../config/api';

type AdminRow = {
  userId: string;
  username?: string;
  name?: string;
  status: string;
};

type Props = {
  visible: boolean;
  venueUserId: string;
  venueName?: string;
  onClose: () => void;
};

const ManageVenueAdminsModal: React.FC<Props> = ({
  visible,
  venueUserId,
  venueName,
  onClose,
}) => {
  const {colors} = useTheme();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [pending, setPending] = useState<AdminRow[]>([]);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);

  const authHeaders = useCallback(async () => {
    const token = await AsyncStorage.getItem('userToken');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, []);

  const load = useCallback(async () => {
    if (!venueUserId) {
      return;
    }
    setLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(
        `${API_BASE_URL}/venues/${venueUserId}/admins`,
        {headers},
      );
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      setAdmins(Array.isArray(data.admins) ? data.admins : []);
      setPending(Array.isArray(data.pending) ? data.pending : []);
    } finally {
      setLoading(false);
    }
  }, [authHeaders, venueUserId]);

  useEffect(() => {
    if (visible) {
      load().catch(() => {});
    }
  }, [visible, load]);

  const invite = async () => {
    const u = username.trim();
    if (!u) {
      return;
    }
    setInviting(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(
        `${API_BASE_URL}/venues/${venueUserId}/admins/invite`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({username: u}),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert('Invite failed', data.message || 'Could not invite');
        return;
      }
      setUsername('');
      await load();
    } finally {
      setInviting(false);
    }
  };

  const remove = async (memberUserId: string) => {
    const headers = await authHeaders();
    await fetch(
      `${API_BASE_URL}/venues/${venueUserId}/admins/${memberUserId}`,
      {method: 'DELETE', headers},
    );
    await load();
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.card || colors.background,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      maxHeight: '80%',
      paddingBottom: 28,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 10,
    },
    title: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    sub: {
      paddingHorizontal: 18,
      color: colors.secondaryText,
      marginBottom: 12,
      fontSize: 13,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    name: {flex: 1, color: colors.text, fontWeight: '600'},
    meta: {color: colors.secondaryText, fontSize: 12},
    inviteRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 18,
      marginBottom: 12,
    },
    input: {
      flex: 1,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      backgroundColor: colors.inputBackground,
    },
    inviteBtn: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingHorizontal: 14,
      justifyContent: 'center',
    },
  });

  const rows = [
    ...admins.map(a => ({...a, status: 'active'})),
    ...pending.map(p => ({...p, status: 'pending'})),
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Venue staff</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <FontAwesomeIcon icon={faXmark} size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
          <Text style={styles.sub}>
            Invite managers for {venueName || 'this venue'}. They keep their
            personal login and post as the venue.
          </Text>
          <View style={styles.inviteRow}>
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor={colors.placeholder}
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
            />
            <TouchableOpacity
              style={styles.inviteBtn}
              onPress={invite}
              disabled={inviting}>
              {inviting ? (
                <ActivityIndicator color={colors.buttonText || '#fff'} />
              ) : (
                <FontAwesomeIcon
                  icon={faUserPlus}
                  size={16}
                  color={colors.buttonText || '#fff'}
                />
              )}
            </TouchableOpacity>
          </View>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{marginTop: 20}} />
          ) : (
            <FlatList
              data={rows}
              keyExtractor={item => `${item.status}-${item.userId}`}
              ListEmptyComponent={
                <Text style={[styles.sub, {marginTop: 8}]}>
                  No staff yet. Invite a teammate by username.
                </Text>
              }
              renderItem={({item}) => (
                <View style={styles.row}>
                  <View style={{flex: 1}}>
                    <Text style={styles.name}>
                      @{item.username || item.userId}
                    </Text>
                    <Text style={styles.meta}>
                      {item.name ? `${item.name} · ` : ''}
                      {item.status}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => remove(item.userId)}>
                    <FontAwesomeIcon
                      icon={faTrash}
                      size={14}
                      color={colors.error || '#c44'}
                    />
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

export default ManageVenueAdminsModal;
