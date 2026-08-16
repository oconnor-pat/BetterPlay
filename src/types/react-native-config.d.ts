declare module 'react-native-config' {
  export interface NativeConfig {
    GOOGLE_PLACES_API_KEY?: string;
    SENTRY_DSN?: string;
    IMAGE_UPLOAD_URL?: string;
    /** OAuth 2.0 Web client ID — required for Google ID tokens on Android. */
    GOOGLE_WEB_CLIENT_ID?: string;
    /** OAuth 2.0 iOS client ID for Google Sign-In. */
    GOOGLE_IOS_CLIENT_ID?: string;
    /**
     * Reversed iOS client ID (e.g. com.googleusercontent.apps.123-abc).
     * Must also be added under CFBundleURLSchemes in Info.plist.
     */
    GOOGLE_IOS_URL_SCHEME?: string;
  }

  export const Config: NativeConfig;
  export default Config;
}
