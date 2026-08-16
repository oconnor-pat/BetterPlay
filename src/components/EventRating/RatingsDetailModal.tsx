import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {faStar, faTimes} from '@fortawesome/free-solid-svg-icons';
import {useTheme} from '../ThemeContext/ThemeContext';
import {API_BASE_URL} from '../../config/api';

export type RatingKind = 'host' | 'player';

type Review = {
  id: string;
  score: number;
  eventScore?: number;
  comment?: string | null;
  createdAt: string;
  eventName?: string | null;
  rater: {
    id: string;
    username: string;
    profilePicUrl?: string;
  };
};

type DetailPayload = {
  kind: RatingKind;
  average: number | null;
  count: number;
  breakdown: Record<string, number>;
  reviews: Review[];
};

type Props = {
  visible: boolean;
  userId: string;
  kind: RatingKind | null;
  username?: string | null;
  onClose: () => void;
};

const StarRow = ({score, color, size = 12}: {score: number; color: string; size?: number}) => (
  <View style={styles.starsInline}>
    {[1, 2, 3, 4, 5].map(n => (
      <FontAwesomeIcon
        key={n}
        icon={faStar}
        size={size}
        color={n <= score ? color : '#9E9E9E'}
        style={n <= score ? undefined : {opacity: 0.3}}
      />
    ))}
  </View>
);

const RatingsDetailModal: React.FC<Props> = ({
  visible,
  userId,
  kind,
  username,
  onClose,
}) => {
  const {colors} = useTheme();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DetailPayload | null>(null);

  const accent = kind === 'host' ? '#F5A623' : '#4FC3F7';
  const title =
    kind === 'host'
      ? 'Host ratings'
      : kind === 'player'
        ? 'Player ratings'
        : 'Ratings';

  useEffect(() => {
    if (!visible || !kind || !userId) {
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setData(null);
      try {
        const token = await AsyncStorage.getItem('userToken');
        const response = await axios.get(
          `${API_BASE_URL}/user/${userId}/ratings/${kind}`,
          {headers: token ? {Authorization: `Bearer ${token}`} : {}},
        );
        if (!cancelled) {
          setData(response.data);
        }
      } catch {
        if (!cancelled) {
          setData({
            kind,
            average: null,
            count: 0,
            breakdown: {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
            reviews: [],
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, kind, userId]);

  const maxBucket = useMemo(() => {
    if (!data?.breakdown) {
      return 1;
    }
    return Math.max(1, ...Object.values(data.breakdown).map(Number));
  }, [data?.breakdown]);

  const renderReview = ({item}: {item: Review}) => {
    const initials = (item.rater.username || '?')
      .split(' ')
      .map(p => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    return (
      <View
        style={[
          styles.reviewCard,
          {backgroundColor: colors.background, borderColor: colors.border},
        ]}>
        <View style={styles.reviewHeader}>
          {item.rater.profilePicUrl ? (
            <Image
              source={{uri: item.rater.profilePicUrl}}
              style={styles.reviewAvatar}
            />
          ) : (
            <View
              style={[
                styles.reviewAvatar,
                styles.reviewAvatarFallback,
                {backgroundColor: colors.primary + '22'},
              ]}>
              <Text style={[styles.reviewAvatarText, {color: colors.primary}]}>
                {initials}
              </Text>
            </View>
          )}
          <View style={styles.reviewHeaderText}>
            <Text style={[styles.reviewName, {color: colors.text}]}>
              {item.rater.username}
            </Text>
            <Text style={[styles.reviewMeta, {color: colors.secondaryText}]}>
              {item.eventName ? `${item.eventName} · ` : ''}
              {item.createdAt
                ? new Date(item.createdAt).toLocaleDateString()
                : ''}
            </Text>
          </View>
          <StarRow score={item.score} color={accent} />
        </View>
        {!!item.comment && (
          <Text style={[styles.reviewComment, {color: colors.text}]}>
            {item.comment}
          </Text>
        )}
        {kind === 'host' && typeof item.eventScore === 'number' && (
          <Text style={[styles.reviewMeta, {color: colors.secondaryText}]}>
            Event also rated {item.eventScore}/5
          </Text>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <SafeAreaView
        style={[styles.safe, {backgroundColor: colors.card}]}
        edges={['top', 'bottom']}>
        <View style={[styles.header, {borderBottomColor: colors.border}]}>
          <View style={styles.headerTextBlock}>
            <Text style={[styles.title, {color: colors.text}]}>{title}</Text>
            {!!username && (
              <Text style={[styles.subtitle, {color: colors.secondaryText}]}>
                for {username}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <FontAwesomeIcon icon={faTimes} size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={data?.reviews || []}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <View style={styles.summaryBlock}>
                <View style={styles.summaryTop}>
                  <Text style={[styles.bigAverage, {color: colors.text}]}>
                    {data?.average != null ? data.average.toFixed(1) : '—'}
                  </Text>
                  <View>
                    <StarRow
                      score={Math.round(data?.average || 0)}
                      color={accent}
                      size={16}
                    />
                    <Text
                      style={[styles.countLabel, {color: colors.secondaryText}]}>
                      {data?.count || 0} rating
                      {(data?.count || 0) === 1 ? '' : 's'}
                    </Text>
                  </View>
                </View>

                <View style={styles.breakdown}>
                  {[5, 4, 3, 2, 1].map(star => {
                    const count = Number(data?.breakdown?.[String(star)] || 0);
                    const widthPct = (count / maxBucket) * 100;
                    return (
                      <View key={star} style={styles.breakdownRow}>
                        <Text
                          style={[
                            styles.breakdownStar,
                            {color: colors.secondaryText},
                          ]}>
                          {star}
                        </Text>
                        <FontAwesomeIcon
                          icon={faStar}
                          size={10}
                          color={accent}
                        />
                        <View
                          style={[
                            styles.barTrack,
                            {backgroundColor: colors.border},
                          ]}>
                          <View
                            style={[
                              styles.barFill,
                              {
                                width: `${widthPct}%`,
                                backgroundColor: accent,
                              },
                            ]}
                          />
                        </View>
                        <Text
                          style={[
                            styles.breakdownCount,
                            {color: colors.secondaryText},
                          ]}>
                          {count}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <Text style={[styles.reviewsHeading, {color: colors.text}]}>
                  Reviews
                </Text>
              </View>
            }
            ListEmptyComponent={
              <Text style={[styles.empty, {color: colors.secondaryText}]}>
                No ratings yet.
              </Text>
            }
            renderItem={renderReview}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safe: {flex: 1},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTextBlock: {flex: 1, paddingRight: 12},
  title: {fontSize: 20, fontWeight: '700'},
  subtitle: {fontSize: 13, marginTop: 2},
  centered: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  listContent: {padding: 20, paddingBottom: 40},
  summaryBlock: {marginBottom: 8},
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 18,
  },
  bigAverage: {fontSize: 44, fontWeight: '800', letterSpacing: -1},
  countLabel: {fontSize: 13, marginTop: 4},
  starsInline: {flexDirection: 'row', gap: 3},
  breakdown: {gap: 8, marginBottom: 22},
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  breakdownStar: {
    width: 12,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  breakdownCount: {
    width: 24,
    fontSize: 12,
    textAlign: 'right',
  },
  reviewsHeading: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  empty: {
    textAlign: 'center',
    marginTop: 12,
    fontSize: 14,
  },
  reviewCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 10,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  reviewAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: {
    fontSize: 12,
    fontWeight: '700',
  },
  reviewHeaderText: {flex: 1},
  reviewName: {fontSize: 14, fontWeight: '700'},
  reviewMeta: {fontSize: 12, marginTop: 2},
  reviewComment: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
  },
});

export default RatingsDetailModal;
