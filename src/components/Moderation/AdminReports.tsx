/**
 * AdminReports.tsx
 *
 * The moderation queue, reachable only by users with `isAdmin` — the
 * first consumer of that flag, which until now existed on the model and
 * in UserContext without a screen behind it.
 *
 * The queue records verdicts rather than carrying them out. Marking a
 * report "actioned" is a note that something was done elsewhere, not an
 * automated ban; enforcement tooling is a bigger question than this
 * screen should be answering on its own.
 */

import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {faArrowLeft, faShieldHalved} from '@fortawesome/free-solid-svg-icons';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../ThemeContext/ThemeContext';
import UserContext, {UserContextType} from '../UserContext';
import {
  fetchAdminReports,
  updateReportStatus,
} from '../../services/ModerationService';
import {AdminReport, ReportStatus} from '../../types/moderation';

const FILTERS: (ReportStatus | 'all')[] = [
  'open',
  'actioned',
  'dismissed',
  'all',
];

const AdminReports: React.FC = () => {
  const {colors} = useTheme();
  const {t} = useTranslation();
  const navigation = useNavigation<any>();
  const {isAdmin} = useContext(UserContext) as UserContextType;

  const [filter, setFilter] = useState<ReportStatus | 'all'>('open');
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const {reports: rows} = await fetchAdminReports(filter);
      setReports(rows);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const decide = useCallback(
    async (report: AdminReport, status: ReportStatus) => {
      // While viewing "open", a decided report no longer belongs in the
      // list; under any other filter it stays put with its new status.
      setReports(prev =>
        filter === 'open'
          ? prev.filter(r => r._id !== report._id)
          : prev.map(r => (r._id === report._id ? {...r, status} : r)),
      );
      try {
        await updateReportStatus(report._id, status);
      } catch (err) {
        console.error('Failed to update report:', err);
        Alert.alert(t('moderation.reportUpdateFailed'));
        load();
      }
    },
    [filter, load, t],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {flex: 1, backgroundColor: colors.background},
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        backButton: {padding: 8, marginRight: 4},
        title: {fontSize: 16, fontWeight: '700', color: colors.text},
        filterRow: {
          flexDirection: 'row',
          gap: 8,
          paddingHorizontal: 16,
          paddingVertical: 12,
        },
        filterPill: {
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 14,
          backgroundColor: colors.inputBackground,
        },
        filterPillActive: {backgroundColor: colors.primary},
        filterText: {
          fontSize: 12,
          fontWeight: '600',
          color: colors.secondaryText,
        },
        filterTextActive: {color: '#fff'},
        card: {
          marginHorizontal: 16,
          marginBottom: 12,
          padding: 14,
          borderRadius: 12,
          backgroundColor: colors.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        cardTop: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        reasonBadge: {
          fontSize: 11,
          fontWeight: '700',
          color: colors.error,
          textTransform: 'uppercase',
        },
        targetBadge: {fontSize: 11, color: colors.secondaryText},
        parties: {fontSize: 14, color: colors.text, marginTop: 8},
        partyName: {fontWeight: '700'},
        snapshot: {
          marginTop: 10,
          padding: 10,
          borderRadius: 8,
          backgroundColor: colors.inputBackground,
          fontSize: 13,
          color: colors.text,
          fontStyle: 'italic',
        },
        details: {fontSize: 13, color: colors.secondaryText, marginTop: 8},
        statusLine: {fontSize: 11, color: colors.secondaryText, marginTop: 10},
        actions: {flexDirection: 'row', gap: 10, marginTop: 12},
        actionButton: {
          flex: 1,
          paddingVertical: 9,
          borderRadius: 9,
          alignItems: 'center',
          borderWidth: 1,
        },
        dismissButton: {borderColor: colors.border},
        dismissText: {
          fontSize: 13,
          fontWeight: '600',
          color: colors.secondaryText,
        },
        actionedButton: {borderColor: colors.error},
        actionedText: {fontSize: 13, fontWeight: '600', color: colors.error},
        empty: {alignItems: 'center', paddingTop: 60},
        emptyTitle: {
          fontSize: 15,
          fontWeight: '600',
          color: colors.text,
          marginTop: 12,
        },
        emptyBody: {
          fontSize: 13,
          color: colors.secondaryText,
          marginTop: 4,
          textAlign: 'center',
          paddingHorizontal: 40,
        },
      }),
    [colors],
  );

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{t('moderation.adminOnly')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderReport = ({item}: {item: AdminReport}) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.reasonBadge}>
          {t(`moderation.reason.${item.reason}`)}
        </Text>
        <Text style={styles.targetBadge}>
          {t(`moderation.target.${item.target}`)}
        </Text>
      </View>

      <Text style={styles.parties}>
        <Text style={styles.partyName}>
          {item.reportedUser?.username || t('moderation.deletedUser')}
        </Text>
        {'  ·  '}
        {t('moderation.reportedBy', {
          username: item.reporter?.username || t('moderation.deletedUser'),
        })}
      </Text>

      {item.contentSnapshot ? (
        <Text style={styles.snapshot} numberOfLines={4}>
          “{item.contentSnapshot}”
        </Text>
      ) : null}

      {item.details ? <Text style={styles.details}>{item.details}</Text> : null}

      <Text style={styles.statusLine}>
        {new Date(item.createdAt).toLocaleString()}
        {item.status !== 'open'
          ? `  ·  ${t(`moderation.status.${item.status}`)}`
          : ''}
      </Text>

      {item.status === 'open' && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.dismissButton]}
            onPress={() => decide(item, 'dismissed')}>
            <Text style={styles.dismissText}>{t('moderation.dismiss')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionedButton]}
            onPress={() => decide(item, 'actioned')}>
            <Text style={styles.actionedText}>
              {t('moderation.markActioned')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <FontAwesomeIcon icon={faArrowLeft} size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('moderation.reportsQueue')}</Text>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterPill, filter === f && styles.filterPillActive]}
            onPress={() => setFilter(f)}>
            <Text
              style={[
                styles.filterText,
                filter === f && styles.filterTextActive,
              ]}>
              {t(`moderation.filter.${f}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{marginTop: 40}} />
      ) : (
        <FlatList
          data={reports}
          keyExtractor={item => item._id}
          renderItem={renderReport}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <FontAwesomeIcon
                icon={faShieldHalved}
                size={28}
                color={colors.secondaryText}
              />
              <Text style={styles.emptyTitle}>
                {t('moderation.noReportsTitle')}
              </Text>
              <Text style={styles.emptyBody}>
                {t('moderation.noReportsBody')}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

export default AdminReports;
