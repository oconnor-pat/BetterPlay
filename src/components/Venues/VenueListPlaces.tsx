// New Venues tab landing page — populated from Google Places (instead of
// our own venues collection). Cold-start in any city: no admin data entry
// required.
//
// PR 1 scope: list nearby places, filter chips, search bar with text search,
// tap a card → opens venue website in the system browser.
//
// PR 2 will replace the tap behavior with an in-app WebView + a slim venue
// detail page that shows "Happening here" Events scoped to the place.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Image,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faSearch,
  faTimes,
  faMapMarkerAlt,
  faGlobe,
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';
import {useTranslation} from 'react-i18next';
import HamburgerMenu from '../HamburgerMenu/HamburgerMenu';
import {useTheme} from '../ThemeContext/ThemeContext';
import locationService, {Coordinates} from '../../services/LocationService';
import {
  PlaceSummary,
  VENUE_CATEGORIES,
  buildPhotoUrl,
  getEmojiForPlace,
  getFriendlyTypeLabel,
  isPlacesApiConfigured,
  searchNearby,
  searchText,
} from '../../services/PlacesService';

// Default radius for the "near you" feed.
const DEFAULT_RADIUS_METERS = 8000; // ~5 miles
const SEARCH_DEBOUNCE_MS = 350;

const VenueListPlaces: React.FC = () => {
  const {colors, darkMode} = useTheme();
  const {t} = useTranslation();
  const navigation = useNavigation<any>();

  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<
    'unknown' | 'granted' | 'denied'
  >('unknown');
  const [places, setPlaces] = useState<PlaceSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');

  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<PlaceSummary[] | null>(
    null,
  );
  const [searching, setSearching] = useState<boolean>(false);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Location bootstrap ────────────────────────────────────────────────
  const ensureLocation = useCallback(async (): Promise<Coordinates | null> => {
    const cached = await locationService.getCachedLocation();
    if (cached) {
      setCoords(cached);
      setPermissionStatus('granted');
      return cached;
    }
    const granted = await locationService.requestPermission();
    if (!granted) {
      setPermissionStatus('denied');
      return null;
    }
    try {
      const fresh = await locationService.getCurrentPosition();
      setCoords(fresh);
      setPermissionStatus('granted');
      return fresh;
    } catch {
      setPermissionStatus('denied');
      return null;
    }
  }, []);

  // ── Nearby fetch ──────────────────────────────────────────────────────
  const fetchNearby = useCallback(
    async (location: Coordinates, categoryId: string) => {
      if (!isPlacesApiConfigured) {
        setErrorMessage(
          'Google Places API key is not configured. Set GOOGLE_PLACES_API_KEY in .env and rebuild.',
        );
        setPlaces([]);
        return;
      }
      setErrorMessage(null);
      const cat = VENUE_CATEGORIES.find(c => c.id === categoryId);
      const primaryTypes = cat ? cat.primaryTypes : undefined;
      try {
        const results = await searchNearby({
          latitude: location.latitude,
          longitude: location.longitude,
          radiusMeters: DEFAULT_RADIUS_METERS,
          primaryTypes,
          maxResultCount: 20,
        });
        setPlaces(results);
      } catch (err: any) {
        setErrorMessage(err?.message || 'Could not load nearby places');
        setPlaces([]);
      }
    },
    [],
  );

  // First load — bootstrap location, then fetch nearby places.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const loc = await ensureLocation();
      if (cancelled) {
        return;
      }
      if (loc) {
        await fetchNearby(loc, 'all');
      }
      if (!cancelled) {
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ensureLocation, fetchNearby]);

  // Refetch when category changes.
  useEffect(() => {
    if (!coords) {
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      await fetchNearby(coords, selectedCategoryId);
      if (!cancelled) {
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCategoryId, coords, fetchNearby]);

  // ── Search (debounced text search) ────────────────────────────────────
  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchText({
          query: trimmed,
          latitude: coords?.latitude,
          longitude: coords?.longitude,
          radiusMeters: 25000,
          maxResultCount: 10,
        });
        setSearchResults(results);
      } catch (err: any) {
        setErrorMessage(err?.message || 'Search failed');
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [searchQuery, coords]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const loc = coords || (await ensureLocation());
    if (loc) {
      await fetchNearby(loc, selectedCategoryId);
    }
    setRefreshing(false);
  }, [coords, ensureLocation, fetchNearby, selectedCategoryId]);

  // Card tap → slim venue detail page. The detail page handles the website,
  // Get Directions, call, and "Plan event here" actions. PR 2b will add an
  // in-app WebView there (currently "View Website" uses Linking externally).
  const handlePlacePress = useCallback(
    (place: PlaceSummary) => {
      navigation.navigate('VenuePlaceDetail', {place});
    },
    [navigation],
  );

  // ── Derived data ──────────────────────────────────────────────────────
  const visibleList: PlaceSummary[] = useMemo(() => {
    if (searchResults) {
      return searchResults;
    }
    if (!coords) {
      return places;
    }
    // Sort nearby results by distance from the user.
    return [...places].sort((a, b) => {
      const da = a.location
        ? locationService.haversineDistance(coords, a.location, 'mi')
        : Number.POSITIVE_INFINITY;
      const db = b.location
        ? locationService.haversineDistance(coords, b.location, 'mi')
        : Number.POSITIVE_INFINITY;
      return da - db;
    });
  }, [places, searchResults, coords]);

  // ── Styles ────────────────────────────────────────────────────────────
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
          paddingTop: 8,
          paddingBottom: 12,
        },
        title: {
          position: 'absolute',
          left: 0,
          right: 0,
          top: 8,
          textAlign: 'center',
          fontSize: 22,
          fontWeight: '700',
          color: colors.primary,
          zIndex: -1,
        },
        headerIcon: {
          padding: 8,
        },
        searchBar: {
          marginHorizontal: 16,
          marginBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.inputBackground,
          borderRadius: 20,
          paddingHorizontal: 14,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        searchInput: {
          flex: 1,
          paddingVertical: 10,
          marginLeft: 8,
          color: colors.text,
          fontSize: 15,
        },
        chipStripWrapper: {
          height: 44,
          marginBottom: 8,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        chipStrip: {
          flexGrow: 0,
          height: 44,
        },
        chipStripContent: {
          paddingHorizontal: 16,
          alignItems: 'center',
          gap: 8,
        },
        chip: {
          height: 30,
          paddingHorizontal: 12,
          borderRadius: 15,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: darkMode
            ? 'rgba(255,255,255,0.04)'
            : 'rgba(0,0,0,0.03)',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        },
        chipActive: {
          borderColor: colors.primary,
          backgroundColor: colors.primary + '22',
        },
        chipEmoji: {
          fontSize: 14,
        },
        chipText: {
          fontSize: 12,
          fontWeight: '600',
          color: colors.text,
          lineHeight: 14,
          includeFontPadding: false,
        },
        chipTextActive: {
          color: colors.primary,
        },
        sectionTitle: {
          fontSize: 12,
          fontWeight: '700',
          letterSpacing: 0.5,
          color: colors.secondaryText,
          textTransform: 'uppercase',
          paddingHorizontal: 16,
          paddingTop: 4,
          paddingBottom: 8,
        },
        list: {
          flex: 1,
        },
        listContent: {
          paddingBottom: 24,
          flexGrow: 1,
        },
        card: {
          backgroundColor: colors.card,
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        },
        cardThumb: {
          width: 56,
          height: 56,
          borderRadius: 12,
          backgroundColor: darkMode
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(0,0,0,0.04)',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        cardThumbImage: {
          width: 56,
          height: 56,
        },
        cardThumbEmoji: {
          fontSize: 28,
        },
        cardBody: {
          flex: 1,
        },
        cardTitleRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        },
        cardTitle: {
          fontSize: 16,
          fontWeight: '700',
          color: colors.text,
          flex: 1,
        },
        cardDistance: {
          fontSize: 12,
          fontWeight: '600',
          color: colors.secondaryText,
        },
        cardMeta: {
          fontSize: 12,
          color: colors.secondaryText,
          marginTop: 4,
        },
        cardStatus: {
          fontSize: 12,
          fontWeight: '700',
          marginTop: 4,
        },
        statusOpen: {
          color: colors.primary,
        },
        statusClosed: {
          color: colors.secondaryText,
        },
        empty: {
          alignItems: 'center',
          paddingVertical: 60,
          paddingHorizontal: 32,
        },
        emptyIcon: {
          marginBottom: 12,
        },
        emptyText: {
          fontSize: 14,
          color: colors.secondaryText,
          textAlign: 'center',
          marginBottom: 12,
        },
        emptyActionButton: {
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 20,
          backgroundColor: colors.primary,
        },
        emptyActionText: {
          color: '#FFFFFF',
          fontWeight: '700',
        },
      }),
    [colors, darkMode],
  );

  // ── Renderers ─────────────────────────────────────────────────────────
  const renderChip = (cat: {id: string; label: string; emoji?: string}) => {
    const isActive = selectedCategoryId === cat.id;
    return (
      <TouchableOpacity
        key={cat.id}
        style={[styles.chip, isActive && styles.chipActive]}
        onPress={() => setSelectedCategoryId(cat.id)}>
        {cat.emoji ? <Text style={styles.chipEmoji}>{cat.emoji}</Text> : null}
        <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
          {cat.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderCard = ({item}: {item: PlaceSummary}) => {
    const distanceMi =
      coords && item.location
        ? locationService.haversineDistance(coords, item.location, 'mi')
        : null;
    const photoName = item.photos && item.photos[0]?.name;
    const photoUrl = photoName
      ? buildPhotoUrl(photoName, {maxWidthPx: 120})
      : null;
    const openNow = item.currentOpeningHours?.openNow;
    const typeLabel = getFriendlyTypeLabel(item);
    const addressLine =
      item.shortFormattedAddress || item.formattedAddress || '';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handlePlacePress(item)}
        activeOpacity={0.7}>
        <View style={styles.cardThumb}>
          {photoUrl ? (
            <Image
              source={{uri: photoUrl}}
              style={styles.cardThumbImage}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.cardThumbEmoji}>{getEmojiForPlace(item)}</Text>
          )}
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.name || 'Unnamed venue'}
            </Text>
            {distanceMi !== null && (
              <Text style={styles.cardDistance}>
                {distanceMi < 0.1
                  ? '<0.1 mi'
                  : `${distanceMi.toFixed(distanceMi < 10 ? 1 : 0)} mi`}
              </Text>
            )}
          </View>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {typeLabel}
            {addressLine ? ` · ${addressLine}` : ''}
          </Text>
          {typeof openNow === 'boolean' && (
            <Text
              style={[
                styles.cardStatus,
                openNow ? styles.statusOpen : styles.statusClosed,
              ]}>
              {openNow ? 'Open now' : 'Closed'}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ── Empty / error states ──────────────────────────────────────────────
  const renderEmptyContent = () => {
    if (errorMessage) {
      return (
        <View style={styles.empty}>
          <FontAwesomeIcon
            icon={faExclamationTriangle}
            size={32}
            color={colors.secondaryText}
            style={styles.emptyIcon}
          />
          <Text style={styles.emptyText}>{errorMessage}</Text>
          <TouchableOpacity
            style={styles.emptyActionButton}
            onPress={onRefresh}>
            <Text style={styles.emptyActionText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (permissionStatus === 'denied') {
      return (
        <View style={styles.empty}>
          <FontAwesomeIcon
            icon={faMapMarkerAlt}
            size={32}
            color={colors.secondaryText}
            style={styles.emptyIcon}
          />
          <Text style={styles.emptyText}>
            We need your location to show venues near you. Enable location
            access in Settings, then tap Retry.
          </Text>
          <TouchableOpacity
            style={styles.emptyActionButton}
            onPress={async () => {
              await ensureLocation();
              if (coords) {
                await fetchNearby(coords, selectedCategoryId);
              }
            }}>
            <Text style={styles.emptyActionText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.empty}>
        <FontAwesomeIcon
          icon={faGlobe}
          size={32}
          color={colors.secondaryText}
          style={styles.emptyIcon}
        />
        <Text style={styles.emptyText}>
          {searchResults
            ? 'No matches. Try a different search.'
            : 'No places found nearby. Try a different filter.'}
        </Text>
      </View>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <HamburgerMenu />
        <Text style={styles.title}>{t('venues.title') || 'Venues'}</Text>
        <TouchableOpacity
          style={styles.headerIcon}
          onPress={() => {
            const next = !searchOpen;
            setSearchOpen(next);
            if (!next) {
              setSearchQuery('');
            }
          }}>
          <FontAwesomeIcon
            icon={searchOpen ? faTimes : faSearch}
            size={20}
            color={colors.text}
          />
        </TouchableOpacity>
      </View>

      {searchOpen && (
        <View style={styles.searchBar}>
          <FontAwesomeIcon
            icon={faSearch}
            size={16}
            color={colors.secondaryText}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search venues by name"
            placeholderTextColor={colors.secondaryText}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            returnKeyType="search"
          />
          {searching ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : searchQuery.length > 0 ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <FontAwesomeIcon
                icon={faTimes}
                size={16}
                color={colors.secondaryText}
              />
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {!searchResults && (
        <View style={styles.chipStripWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            alwaysBounceVertical={false}
            alwaysBounceHorizontal={false}
            bounces={false}
            directionalLockEnabled
            style={styles.chipStrip}
            contentContainerStyle={styles.chipStripContent}>
            {renderChip({id: 'all', label: 'All'})}
            {VENUE_CATEGORIES.map(c => renderChip(c))}
          </ScrollView>
        </View>
      )}

      {!searchResults && (
        <Text style={styles.sectionTitle}>
          {coords ? 'Near you' : 'Featured'}
        </Text>
      )}

      <FlatList
        style={styles.list}
        data={visibleList}
        keyExtractor={item => item.id}
        renderItem={renderCard}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            renderEmptyContent()
          )
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        automaticallyAdjustContentInsets={false}
      />
    </SafeAreaView>
  );
};

export default VenueListPlaces;
