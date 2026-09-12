import {
  buildPhotoUrl,
  getPlaceDetails,
  isPlacesApiConfigured,
} from '../services/PlacesService';

const venuePhotoCache = new Map<string, string | null>();

/**
 * Resolve a Google Places photo URL for a managed venue Place ID.
 * Cached so roster + public profile don't re-hit Places for the same pin.
 */
export async function resolveVenuePhotoUrl(
  placeId?: string | null,
  opts?: {maxWidthPx?: number},
): Promise<string | null> {
  if (!placeId || !isPlacesApiConfigured) {
    return null;
  }
  if (venuePhotoCache.has(placeId)) {
    return venuePhotoCache.get(placeId) ?? null;
  }
  try {
    const place = await getPlaceDetails(placeId);
    const photoName = place.photos?.[0]?.name;
    const url = photoName
      ? buildPhotoUrl(photoName, {maxWidthPx: opts?.maxWidthPx ?? 400})
      : null;
    venuePhotoCache.set(placeId, url);
    return url;
  } catch {
    venuePhotoCache.set(placeId, null);
    return null;
  }
}
