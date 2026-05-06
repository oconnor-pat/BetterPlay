// In-app browser for the Venues tab. Wraps a venue's website in a
// react-native-webview and overlays a sticky "Plan event from this page"
// button that captures the *current* URL as the event's sourceUrl — so if
// the user drills into a specific event listing on the venue's site, that
// deeper URL gets carried through into the Events create flow.
//
// Why a dedicated screen vs. just `Linking.openURL`:
//   1. Sticky CTA — we keep the "Plan event here" affordance one tap away
//      while the user browses, instead of losing them to Safari.
//   2. URL capture — we know exactly what page they were viewing when they
//      decided to plan something.
//   3. Familiar back navigation — system back maps to in-WebView back
//      first, then exits the screen.

import React, {useCallback, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  BackHandler,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {WebView, WebViewNavigation} from 'react-native-webview';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faArrowLeft,
  faChevronLeft,
  faChevronRight,
  faRotate,
  faExternalLink,
  faPlus,
} from '@fortawesome/free-solid-svg-icons';
import {
  useNavigation,
  useRoute,
  useFocusEffect,
  RouteProp,
  CommonActions,
} from '@react-navigation/native';
import {useTheme} from '../ThemeContext/ThemeContext';

// Route params come from VenuePlaceDetail's "View website" button.
//
// `initialUrl` is the URL we boot the WebView with (typically the venue's
// websiteUri). The other fields are forwarded into the Events create flow
// when the user taps the sticky CTA.
export interface VenueWebViewParams {
  initialUrl: string;
  venueId: string;
  venueName: string;
  venueAddress?: string;
  venueLatitude?: number;
  venueLongitude?: number;
}

type RouteParams = RouteProp<
  {VenueWebView: VenueWebViewParams},
  'VenueWebView'
>;

const VenueWebView: React.FC = () => {
  const {colors, darkMode} = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteParams>();
  const {
    initialUrl,
    venueId,
    venueName,
    venueAddress,
    venueLatitude,
    venueLongitude,
  } = route.params;

  const webViewRef = useRef<WebView>(null);
  const [currentUrl, setCurrentUrl] = useState<string>(initialUrl);
  const [pageTitle, setPageTitle] = useState<string>(venueName);
  const [loading, setLoading] = useState<boolean>(true);
  const [canGoBack, setCanGoBack] = useState<boolean>(false);
  const [canGoForward, setCanGoForward] = useState<boolean>(false);

  // System back / hardware back: prefer navigating the WebView back over
  // popping the screen, so the user can browse multi-page sites naturally.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') {
        return undefined;
      }
      const onBack = () => {
        if (canGoBack) {
          webViewRef.current?.goBack();
          return true;
        }
        return false;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [canGoBack]),
  );

  // ── Actions ───────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleBack = useCallback(() => {
    if (canGoBack) {
      webViewRef.current?.goBack();
    } else {
      navigation.goBack();
    }
  }, [canGoBack, navigation]);

  const handleForward = useCallback(() => {
    if (canGoForward) {
      webViewRef.current?.goForward();
    }
  }, [canGoForward]);

  const handleReload = useCallback(() => {
    webViewRef.current?.reload();
  }, []);

  const handleOpenExternal = useCallback(() => {
    Linking.openURL(currentUrl).catch(() => {});
  }, [currentUrl]);

  const handlePlanEvent = useCallback(() => {
    const params = {
      prefillEvent: {
        name: '',
        location: venueAddress || venueName,
        latitude: venueLatitude,
        longitude: venueLongitude,
        venueId,
        venueName,
        // The URL the user was *actually* viewing when they tapped — not
        // necessarily the venue's home page. If they drilled into an event
        // detail page on the venue's site, that's the link we carry over.
        sourceUrl: currentUrl,
      },
    };
    const parent = navigation.getParent();
    if (parent) {
      parent.dispatch(
        CommonActions.navigate({
          name: 'Events',
          params: {screen: 'EventList', params},
        }),
      );
    } else {
      navigation.navigate('Events', {screen: 'EventList', params});
    }
  }, [
    currentUrl,
    venueId,
    venueName,
    venueAddress,
    venueLatitude,
    venueLongitude,
    navigation,
  ]);

  // ── WebView callbacks ────────────────────────────────────────────────
  const onNavigationStateChange = useCallback((state: WebViewNavigation) => {
    if (state.url) {
      setCurrentUrl(state.url);
    }
    if (state.title) {
      setPageTitle(state.title);
    }
    setCanGoBack(state.canGoBack);
    setCanGoForward(state.canGoForward);
    setLoading(state.loading);
  }, []);

  // ── Styles ────────────────────────────────────────────────────────────
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {flex: 1, backgroundColor: colors.background},
        topBar: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 8,
          paddingVertical: 6,
          gap: 4,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        iconButton: {
          padding: 8,
          minWidth: 36,
          alignItems: 'center',
          justifyContent: 'center',
        },
        iconButtonDisabled: {
          opacity: 0.35,
        },
        titleBlock: {
          flex: 1,
          paddingHorizontal: 4,
        },
        titleText: {
          fontSize: 14,
          fontWeight: '700',
          color: colors.text,
        },
        urlText: {
          fontSize: 11,
          color: colors.secondaryText,
          marginTop: 1,
        },
        progressBar: {
          height: 2,
          backgroundColor: colors.primary,
          width: '100%',
        },
        webview: {
          flex: 1,
          backgroundColor: darkMode ? '#0d0d0d' : '#FFFFFF',
        },
        loadingOverlay: {
          ...StyleSheet.absoluteFillObject,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'transparent',
        },
        bottomBar: {
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          backgroundColor: colors.card,
        },
        planButton: {
          backgroundColor: colors.primary,
          paddingVertical: 14,
          borderRadius: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        },
        planButtonText: {
          color: '#FFFFFF',
          fontSize: 15,
          fontWeight: '700',
        },
      }),
    [colors, darkMode],
  );

  // Strip protocol + trailing slash for the URL preview line.
  const displayUrl = useMemo(() => {
    return currentUrl
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .replace(/^www\./, '');
  }, [currentUrl]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={handleClose}
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
          <FontAwesomeIcon icon={faArrowLeft} size={18} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.titleBlock}>
          <Text style={styles.titleText} numberOfLines={1}>
            {pageTitle || venueName}
          </Text>
          <Text style={styles.urlText} numberOfLines={1}>
            {displayUrl}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.iconButton, !canGoBack && styles.iconButtonDisabled]}
          onPress={handleBack}
          disabled={!canGoBack}
          hitSlop={{top: 8, bottom: 8, left: 4, right: 4}}>
          <FontAwesomeIcon icon={faChevronLeft} size={16} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.iconButton,
            !canGoForward && styles.iconButtonDisabled,
          ]}
          onPress={handleForward}
          disabled={!canGoForward}
          hitSlop={{top: 8, bottom: 8, left: 4, right: 4}}>
          <FontAwesomeIcon
            icon={faChevronRight}
            size={16}
            color={colors.text}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={handleReload}
          hitSlop={{top: 8, bottom: 8, left: 4, right: 4}}>
          <FontAwesomeIcon icon={faRotate} size={15} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={handleOpenExternal}
          hitSlop={{top: 8, bottom: 8, left: 4, right: 4}}>
          <FontAwesomeIcon
            icon={faExternalLink}
            size={14}
            color={colors.text}
          />
        </TouchableOpacity>
      </View>

      <View style={{flex: 1}}>
        <WebView
          ref={webViewRef}
          source={{uri: initialUrl}}
          style={styles.webview}
          onNavigationStateChange={onNavigationStateChange}
          startInLoadingState
          // Show our own indicator instead of the platform default so it
          // matches the rest of the app's loading affordances.
          renderLoading={() => (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
          allowsBackForwardNavigationGestures
          // Keep gestures inside the WebView from triggering parent
          // gestures (e.g. tab swipe).
          nestedScrollEnabled
          // Many small business sites set `X-Frame-Options: DENY`; that
          // mostly affects iframes, not top-level WebView, but we still
          // tell Chrome we're a normal mobile browser.
          userAgent={
            Platform.OS === 'ios'
              ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
              : 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
          }
        />
        {loading ? <View style={styles.progressBar} /> : null}
      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.planButton}
          activeOpacity={0.85}
          onPress={handlePlanEvent}>
          <FontAwesomeIcon icon={faPlus} size={14} color="#FFFFFF" />
          <Text style={styles.planButtonText}>Plan event from this page</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default VenueWebView;
