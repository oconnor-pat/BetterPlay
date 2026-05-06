// Google Places API (v1) helper. Wraps the four endpoints we need for the
// Venues tab:
//   - searchNearby   (places of a given type within radius)
//   - searchText     (free-text autocomplete-style search)
//   - getPlaceDetails (full info for a specific place ID)
//   - buildPhotoUrl  (constructs a photo URL from a Place's photo reference)
//
// All requests use field masks so we only pay for fields we actually render.
// See https://developers.google.com/maps/documentation/places/web-service/

let Config: {GOOGLE_PLACES_API_KEY?: string} = {};
try {
  Config = require('react-native-config').default || {};
} catch (e) {
  Config = {};
}

export const GOOGLE_PLACES_API_KEY = Config.GOOGLE_PLACES_API_KEY || '';
export const isPlacesApiConfigured = Boolean(
  GOOGLE_PLACES_API_KEY && GOOGLE_PLACES_API_KEY.length > 10,
);

const BASE_URL = 'https://places.googleapis.com/v1';

// Common shape returned by both Nearby Search and Text Search. Mirrors the
// minimal field mask we request below.
export interface PlaceSummary {
  id: string;
  name: string;
  formattedAddress?: string;
  shortFormattedAddress?: string;
  primaryType?: string;
  primaryTypeDisplayName?: string;
  types?: string[];
  location?: {latitude: number; longitude: number};
  rating?: number;
  userRatingCount?: number;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  currentOpeningHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
  };
  photos?: Array<{name: string; widthPx?: number; heightPx?: number}>;
}

// Place Details returns the same shape but typically with more fields.
export type PlaceDetails = PlaceSummary;

// Filter chips on the Venues tab. Each chip maps to one or more Google
// Places "primary types". We use `includedPrimaryTypes` (strict) rather
// than `includedTypes` (loose) so a Pool Supply Store doesn't show up
// under "Pools" just because Google tagged it with `swimming_pool` as a
// secondary signal — only the place's single primary type is matched.
//
// "All" is handled specially in the caller (no type filter).
export interface VenueCategory {
  id: string;
  label: string;
  emoji: string;
  // Strict match against Google's primary-type field. The result for this
  // chip is the union of places whose primary type is any of these values.
  primaryTypes: string[];
}

export const VENUE_CATEGORIES: VenueCategory[] = [
  {
    id: 'bar',
    label: 'Bars',
    emoji: '🍺',
    primaryTypes: ['bar', 'pub', 'wine_bar'],
  },
  {
    id: 'restaurant',
    label: 'Food',
    emoji: '🍽️',
    primaryTypes: ['restaurant', 'cafe'],
  },
  {
    id: 'rink',
    label: 'Rinks',
    emoji: '🏒',
    primaryTypes: ['ice_skating_rink'],
  },
  {
    id: 'gym',
    label: 'Gyms',
    emoji: '💪',
    primaryTypes: ['gym', 'fitness_center'],
  },
  {id: 'yoga', label: 'Yoga', emoji: '🧘', primaryTypes: ['yoga_studio']},
  {
    id: 'bowling',
    label: 'Bowling',
    emoji: '🎳',
    primaryTypes: ['bowling_alley'],
  },
  {
    id: 'park',
    label: 'Parks',
    emoji: '🌳',
    primaryTypes: ['park', 'national_park', 'dog_park'],
  },
  {
    id: 'court',
    label: 'Courts',
    emoji: '🏀',
    // sports_complex covers indoor/outdoor multi-court venues; stadium
    // catches dedicated facilities. athletic_field picks up open turf.
    primaryTypes: ['sports_complex', 'stadium', 'athletic_field'],
  },
  {id: 'golf', label: 'Golf', emoji: '⛳', primaryTypes: ['golf_course']},
  {
    id: 'pool',
    label: 'Pools',
    emoji: '🏊',
    primaryTypes: ['swimming_pool', 'water_park'],
  },
  {
    id: 'arcade',
    label: 'Arcade',
    emoji: '🕹️',
    primaryTypes: ['amusement_park', 'video_arcade'],
  },
  {
    id: 'music',
    label: 'Live Music',
    emoji: '🎵',
    primaryTypes: ['night_club', 'concert_hall'],
  },
  {id: 'library', label: 'Library', emoji: '📚', primaryTypes: ['library']},
  {
    id: 'community',
    label: 'Community',
    emoji: '🏛️',
    primaryTypes: ['community_center'],
  },
];

// Excluded primary types — places whose primary type is in either of
// these lists are dropped from every Nearby/Text search regardless of
// category. Two lists because Google's Places API (v1) only accepts
// "Table A" types in the `excludedPrimaryTypes` request parameter. Other
// types still surface as a place's `primaryType` in responses but can't
// be filtered server-side, so we filter them locally after the fetch.
//
// Add to whichever list is appropriate when a junk type slips through;
// don't widen preemptively — over-aggressive blocking eats real venues.

// Sent to Google as `excludedPrimaryTypes`. Two constraints:
//   1. Must be drawn from Table A of
//      https://developers.google.com/maps/documentation/places/web-service/place-types
//      (Table B types 400 with "Unsupported types: ...").
//   2. Max 50 entries per request.
//
// We keep this list to the highest-traffic noise types and let
// LOCAL_EXCLUDED_PRIMARY_TYPES (a superset, filtered post-fetch) handle
// the long tail.
const API_EXCLUDED_PRIMARY_TYPES = [
  // Retail / commerce — never the destination for a hangout. (15)
  'store',
  'sporting_goods_store',
  'home_goods_store',
  'shopping_mall',
  'department_store',
  'supermarket',
  'grocery_store',
  'convenience_store',
  'pharmacy',
  'drugstore',
  'liquor_store',
  'electronics_store',
  'clothing_store',
  'furniture_store',
  'hardware_store',
  // Services. (8)
  'real_estate_agency',
  'insurance_agency',
  'gas_station',
  'car_dealer',
  'car_rental',
  'car_repair',
  'car_wash',
  'storage',
  // Education / kids. (3 — `school` covers most secondary primary types.)
  'school',
  'primary_school',
  'secondary_school',
  // Lodging / residential. (6)
  'hotel',
  'motel',
  'lodging',
  'apartment_complex',
  'apartment_building',
  'mobile_home_park',
  // Health. (4)
  'hospital',
  'doctor',
  'dentist',
  'veterinary_care',
  // Finance. (2)
  'bank',
  'atm',
  // Transportation hubs. (5)
  'airport',
  'bus_station',
  'subway_station',
  'train_station',
  'transit_station',
  // Parking is a place type Google returns; not a venue. (1)
  'parking',
];

// Post-fetch filter — superset of the API list. Catches:
//   - Niche Table A types we couldn't fit in the 50-type API budget
//     (e.g. `bed_and_breakfast`, `medical_lab`, `bus_stop`, `taxi_stand`).
//   - Table B types Google returns as `primaryType` but rejects in
//     `excludedPrimaryTypes` (e.g. `general_contractor`, `summer_camp`,
//     `cemetery`, `funeral_home`).
const LOCAL_EXCLUDED_PRIMARY_TYPES = new Set<string>([
  ...API_EXCLUDED_PRIMARY_TYPES,
  // Lodging long tail.
  'inn',
  'bed_and_breakfast',
  'resort_hotel',
  'extended_stay_hotel',
  'guest_house',
  'hostel',
  'rv_park',
  'campground',
  // Services long tail.
  'accounting',
  'lawyer',
  // Education long tail.
  'university',
  'preschool',
  // Health long tail.
  'medical_lab',
  'physiotherapist',
  // Transportation long tail.
  'international_airport',
  'bus_stop',
  'light_rail_station',
  'transit_depot',
  'taxi_stand',
  'ferry_terminal',
  'park_and_ride',
  'truck_stop',
  // Table B (descriptive) types — API can't filter, but Google returns
  // these as `primaryType` for the relevant places.
  'general_contractor',
  'summer_camp',
  'cemetery',
  'funeral_home',
]);

// Field masks — only ask for what the cards actually render. Missing fields
// are silently dropped by Google instead of failing the request.
const SUMMARY_FIELDS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.shortFormattedAddress',
  'places.primaryType',
  'places.primaryTypeDisplayName',
  'places.types',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.currentOpeningHours.openNow',
  'places.currentOpeningHours.weekdayDescriptions',
  'places.photos',
].join(',');

const DETAILS_FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'shortFormattedAddress',
  'primaryType',
  'primaryTypeDisplayName',
  'types',
  'location',
  'rating',
  'userRatingCount',
  'websiteUri',
  'nationalPhoneNumber',
  'internationalPhoneNumber',
  'currentOpeningHours',
  'photos',
].join(',');

interface PlacesV1Response {
  places?: Array<Record<string, any>>;
}

// Google's v1 API returns displayName as `{ text, languageCode }` instead of
// a flat string. Normalize so callers don't have to care.
const normalizePlace = (raw: Record<string, any>): PlaceSummary => ({
  id: raw.id,
  name:
    typeof raw.displayName === 'object'
      ? raw.displayName?.text || ''
      : raw.displayName || '',
  formattedAddress: raw.formattedAddress,
  shortFormattedAddress: raw.shortFormattedAddress,
  primaryType: raw.primaryType,
  primaryTypeDisplayName:
    typeof raw.primaryTypeDisplayName === 'object'
      ? raw.primaryTypeDisplayName?.text
      : raw.primaryTypeDisplayName,
  types: raw.types,
  location: raw.location,
  rating: raw.rating,
  userRatingCount: raw.userRatingCount,
  websiteUri: raw.websiteUri,
  nationalPhoneNumber: raw.nationalPhoneNumber,
  internationalPhoneNumber: raw.internationalPhoneNumber,
  currentOpeningHours: raw.currentOpeningHours,
  photos: raw.photos,
});

const RATE_LIMIT_ERROR =
  'Hit Google Places API rate limit. Try again in a minute.';
const NOT_CONFIGURED_ERROR =
  'Google Places API key is not configured. Set GOOGLE_PLACES_API_KEY in .env.';

// Nearby Search — list places of given primary types within `radiusMeters`
// of `(latitude, longitude)`. Used by the Venues tab landing page.
//
// `primaryTypes` is an array of Google Places type strings (e.g. ['bar']).
// We pass them as `includedPrimaryTypes` (strict primary-type match) so
// secondary tags like a sporting goods store being implicitly tagged with
// `swimming_pool` don't pollute results.
//
// Pass undefined / [] to get a wide mix of nearby places (Google decides),
// in which case `EXCLUDED_PRIMARY_TYPES` still applies to filter noise.
export const searchNearby = async (params: {
  latitude: number;
  longitude: number;
  radiusMeters?: number; // defaults to 8000 (~5 mi)
  primaryTypes?: string[];
  maxResultCount?: number; // defaults to 20, max 20 per request
}): Promise<PlaceSummary[]> => {
  if (!isPlacesApiConfigured) {
    throw new Error(NOT_CONFIGURED_ERROR);
  }

  const {
    latitude,
    longitude,
    radiusMeters = 8000,
    primaryTypes,
    maxResultCount = 20,
  } = params;

  const body: Record<string, unknown> = {
    maxResultCount,
    locationRestriction: {
      circle: {
        center: {latitude, longitude},
        radius: radiusMeters,
      },
    },
    // Always exclude commerce / services / lodging — never a destination
    // for the discover-an-activity flow regardless of which chip is active.
    // Restricted to API-valid types; the broader local list is applied
    // post-fetch below.
    excludedPrimaryTypes: API_EXCLUDED_PRIMARY_TYPES,
  };
  if (primaryTypes && primaryTypes.length > 0) {
    body.includedPrimaryTypes = primaryTypes;
  }

  const response = await fetch(`${BASE_URL}/places:searchNearby`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': SUMMARY_FIELDS,
    },
    body: JSON.stringify(body),
  });

  if (response.status === 429) {
    throw new Error(RATE_LIMIT_ERROR);
  }
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(
      `Places searchNearby failed: ${response.status} ${errText}`,
    );
  }

  const json = (await response.json()) as PlacesV1Response;
  // Belt-and-suspenders + catches Table B types Google can't filter on
  // server-side (e.g. `general_contractor`, `summer_camp`).
  return (json.places || [])
    .map(normalizePlace)
    .filter(p => !p.primaryType || !LOCAL_EXCLUDED_PRIMARY_TYPES.has(p.primaryType));
};

// Text Search — free-text query, optionally biased to a location. Used by
// the Venues tab search bar (autocomplete-style) and for catch-all queries
// like "trivia near me".
export const searchText = async (params: {
  query: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  maxResultCount?: number;
}): Promise<PlaceSummary[]> => {
  if (!isPlacesApiConfigured) {
    throw new Error(NOT_CONFIGURED_ERROR);
  }
  const trimmed = params.query.trim();
  if (!trimmed) {
    return [];
  }

  const body: Record<string, unknown> = {
    textQuery: trimmed,
    maxResultCount: params.maxResultCount ?? 10,
  };
  if (
    typeof params.latitude === 'number' &&
    typeof params.longitude === 'number'
  ) {
    body.locationBias = {
      circle: {
        center: {latitude: params.latitude, longitude: params.longitude},
        radius: params.radiusMeters ?? 25000, // ~15 mi default for search
      },
    };
  }

  const response = await fetch(`${BASE_URL}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': SUMMARY_FIELDS,
    },
    body: JSON.stringify(body),
  });

  if (response.status === 429) {
    throw new Error(RATE_LIMIT_ERROR);
  }
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Places searchText failed: ${response.status} ${errText}`);
  }

  const json = (await response.json()) as PlacesV1Response;
  // Same noise filter as searchNearby — typed queries like "pool" can pull
  // in pool stores / contractors / supply businesses; drop the obvious junk.
  return (json.places || [])
    .map(normalizePlace)
    .filter(p => !p.primaryType || !LOCAL_EXCLUDED_PRIMARY_TYPES.has(p.primaryType));
};

// Place Details — full info for a single place (used when opening a detail
// page in PR 2). For PR 1 we mostly rely on the data already embedded in
// search results; this is here so the helper module is complete.
export const getPlaceDetails = async (
  placeId: string,
): Promise<PlaceDetails> => {
  if (!isPlacesApiConfigured) {
    throw new Error(NOT_CONFIGURED_ERROR);
  }
  const response = await fetch(`${BASE_URL}/places/${placeId}`, {
    headers: {
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': DETAILS_FIELDS,
    },
  });

  if (response.status === 429) {
    throw new Error(RATE_LIMIT_ERROR);
  }
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Places getDetails failed: ${response.status} ${errText}`);
  }

  return normalizePlace(await response.json());
};

// Build a photo URL from a Place's photo reference (`photo.name`). The Photo
// endpoint returns the binary directly; we bake the API key + size hints
// into the URL so it can be dropped straight into an `<Image source>`.
//
// Note: we build the query string by hand instead of using URLSearchParams —
// React Native's Hermes runtime ships an incomplete polyfill where `.set()`
// throws "URLSearchParams.set is not implemented".
export const buildPhotoUrl = (
  photoName: string,
  opts?: {maxWidthPx?: number; maxHeightPx?: number},
): string => {
  const w = opts?.maxWidthPx ?? 600;
  const h = opts?.maxHeightPx;
  const parts = [
    `key=${encodeURIComponent(GOOGLE_PLACES_API_KEY)}`,
    `maxWidthPx=${w}`,
  ];
  if (h) {
    parts.push(`maxHeightPx=${h}`);
  }
  return `${BASE_URL}/${photoName}/media?${parts.join('&')}`;
};

// Pick a friendly venue-type label from the Place's primaryType /
// primaryTypeDisplayName / types[]. Falls back to the first decent-looking
// type, or "Venue" if nothing matches.
const TYPE_LABEL_OVERRIDES: Record<string, string> = {
  bar: 'Bar',
  pub: 'Pub',
  wine_bar: 'Wine Bar',
  restaurant: 'Restaurant',
  cafe: 'Café',
  ice_skating_rink: 'Ice Rink',
  gym: 'Gym',
  fitness_center: 'Fitness Center',
  yoga_studio: 'Yoga Studio',
  bowling_alley: 'Bowling Alley',
  park: 'Park',
  national_park: 'National Park',
  sports_complex: 'Sports Complex',
  stadium: 'Stadium',
  golf_course: 'Golf Course',
  swimming_pool: 'Pool',
  amusement_park: 'Amusement Park',
  video_arcade: 'Arcade',
  night_club: 'Night Club',
  concert_hall: 'Concert Hall',
  library: 'Library',
  community_center: 'Community Center',
};

export const getFriendlyTypeLabel = (place: PlaceSummary): string => {
  if (place.primaryTypeDisplayName) {
    return place.primaryTypeDisplayName;
  }
  if (place.primaryType && TYPE_LABEL_OVERRIDES[place.primaryType]) {
    return TYPE_LABEL_OVERRIDES[place.primaryType];
  }
  if (place.types) {
    for (const t of place.types) {
      if (TYPE_LABEL_OVERRIDES[t]) {
        return TYPE_LABEL_OVERRIDES[t];
      }
    }
  }
  return 'Venue';
};

// Pick an emoji to render on the card. Loose match against our category list
// + a fallback. Keeps cards visually scannable when Google doesn't return a
// photo for a place.
export const getEmojiForPlace = (place: PlaceSummary): string => {
  const types = new Set(
    [place.primaryType, ...(place.types || [])].filter(Boolean) as string[],
  );

  for (const cat of VENUE_CATEGORIES) {
    if (cat.primaryTypes.some(t => types.has(t))) {
      return cat.emoji;
    }
  }
  return '📍';
};
