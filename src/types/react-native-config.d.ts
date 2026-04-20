declare module 'react-native-config' {
  export interface NativeConfig {
    GOOGLE_PLACES_API_KEY?: string;
    SENTRY_DSN?: string;
    IMAGE_UPLOAD_URL?: string;
  }

  export const Config: NativeConfig;
  export default Config;
}
