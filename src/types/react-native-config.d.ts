declare module 'react-native-config' {
  export interface NativeConfig {
    GOOGLE_PLACES_API_KEY?: string;
  }

  export const Config: NativeConfig;
  export default Config;
}
