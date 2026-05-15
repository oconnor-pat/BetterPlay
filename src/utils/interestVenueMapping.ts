// Translates user interests (the IDs stored in `favoriteActivities` on the
// User model and selected via the Profile interests picker) into Google
// Places primary-type strings used by the Venues "All" feed.
//
// One interest can map to multiple primary types — e.g. "trivia" surfaces
// both `bar` and `pub`, since trivia nights happen at either. Multiple
// interests union their types in `primaryTypesForInterests` below.
//
// Interests with no good Places primary type (e.g. "cooking") map to an
// empty array. They stay on the user's profile unchanged but contribute
// nothing to the venue feed.
//
// IMPORTANT: keep the IDs in sync with `INTERESTS_OPTIONS` in Profile.tsx
// and `INTERESTS_MAP` in PublicProfile.tsx. Adding/renaming an interest
// requires updating all three.

export const INTEREST_TO_PRIMARY_TYPES: Record<string, string[]> = {
  // Sports — most map onto the same multi-court venues. Hockey is the
  // exception (dedicated rinks). Golf has its own type.
  basketball: ['sports_complex', 'stadium', 'athletic_field'],
  hockey: ['ice_skating_rink'],
  soccer: ['sports_complex', 'stadium', 'athletic_field'],
  football: ['sports_complex', 'stadium', 'athletic_field'],
  baseball: ['sports_complex', 'stadium', 'athletic_field'],
  tennis: ['sports_complex', 'stadium', 'athletic_field'],
  golf: ['golf_course'],
  volleyball: ['sports_complex', 'stadium', 'athletic_field'],

  // Social / entertainment & drinks. Uses the precise Places types added
  // in the Feb 2026 expansion (karaoke, live_music_venue, dance_hall,
  // brewery, brewpub, beer_garden, etc.) so each interest surfaces the
  // venue type that actually serves it rather than a generic bar bucket.
  // Where the precise type is uncommon enough that a small market might
  // turn up empty, a sensible fallback type is included.
  trivia: ['bar', 'pub'],
  'game-nights': ['bar', 'pub'],
  karaoke: ['karaoke', 'night_club'],
  'live-music': ['live_music_venue', 'concert_hall', 'night_club'],
  dance: ['dance_hall', 'night_club'],
  brewery: ['brewery', 'brewpub', 'beer_garden'],
  wine: ['wine_bar', 'winery'],
  coffee: ['coffee_shop', 'cafe', 'coffee_roastery'],
  'sports-bar': ['sports_bar', 'bar_and_grill'],

  // Outdoor / fitness. Hiking and cycling pick up the dedicated
  // Feb-2026 types first (hiking_area, cycling_park) with park fallback
  // for smaller markets where those types aren't yet populated.
  hiking: ['hiking_area', 'park', 'national_park'],
  cycling: ['cycling_park', 'park'],
  running: ['park', 'national_park'],
  yoga: ['yoga_studio'],
  swimming: ['swimming_pool', 'water_park'],

  // Indoor games.
  bowling: ['bowling_alley'],
  arcade: ['amusement_park', 'video_arcade'],
  gaming: ['amusement_park', 'video_arcade'],

  // Community.
  'book-club': ['library', 'cafe'],
  volunteering: ['community_center'],
  workshops: ['community_center', 'library'],

  // Cooking has no clean Places primary type — leaving it on the profile
  // for self-expression / friend matching but excluding from venue feed.
  cooking: [],
};

// Google's Places API caps `includedPrimaryTypes` at 50. With the current
// taxonomy the union of all 25 interests is well under that, but cap as a
// safety net so future additions don't quietly break the API call.
const INCLUDED_TYPES_LIMIT = 50;

// Returns the deduplicated union of primary types across the given
// interests. Returns an empty array if no interests are provided or none
// of them map to a venue type. Callers should treat an empty array as
// "no filter — fall back to default behavior."
export const primaryTypesForInterests = (interestIds: string[]): string[] => {
  if (!interestIds || interestIds.length === 0) {
    return [];
  }
  const set = new Set<string>();
  for (const id of interestIds) {
    const types = INTEREST_TO_PRIMARY_TYPES[id];
    if (!types) {
      continue;
    }
    for (const t of types) {
      set.add(t);
      if (set.size >= INCLUDED_TYPES_LIMIT) {
        return Array.from(set);
      }
    }
  }
  return Array.from(set);
};
