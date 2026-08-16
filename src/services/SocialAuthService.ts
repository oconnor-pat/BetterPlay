import {Platform} from 'react-native';
import {API_BASE_URL} from '../config/api';

let Config: {
  GOOGLE_WEB_CLIENT_ID?: string;
  GOOGLE_IOS_CLIENT_ID?: string;
} = {};
try {
  Config = require('react-native-config').default || {};
} catch {
  // react-native-config may be unlinked in some builds
}

export type SocialProvider = 'apple' | 'google';

export type SocialAuthResult = {
  success: true;
  isNew: boolean;
  suggestLink?: boolean;
  isPrivateRelay?: boolean;
  user: any;
  token: string;
};

export type SocialAuthError = {
  success: false;
  cancelled?: boolean;
  message: string;
};

export type LinkAccountResult =
  | {success: true; user: any; token: string}
  | {success: false; message: string};

let googleConfigured = false;

const configureGoogleSignIn = () => {
  if (googleConfigured) {
    return;
  }
  // Lazy require so the app still boots if the native module isn't linked yet.
  const {GoogleSignin} = require('@react-native-google-signin/google-signin');
  const webClientId = Config.GOOGLE_WEB_CLIENT_ID;
  const iosClientId = Config.GOOGLE_IOS_CLIENT_ID;
  if (!webClientId && Platform.OS === 'android') {
    throw new Error(
      'Google Sign-In is not configured. Set GOOGLE_WEB_CLIENT_ID in .env and rebuild.',
    );
  }
  GoogleSignin.configure({
    webClientId: webClientId || undefined,
    iosClientId: iosClientId || undefined,
    offlineAccess: false,
  });
  googleConfigured = true;
};

async function exchangeSocialToken(
  provider: SocialProvider,
  idToken: string,
  name?: string,
): Promise<SocialAuthResult | SocialAuthError> {
  const response = await fetch(`${API_BASE_URL}/auth/social`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({provider, idToken, name}),
  });
  const data = await response.json();
  if (!response.ok || !data.success || !data.token) {
    return {
      success: false,
      message:
        data.detail ||
        data.message ||
        'Social sign-in failed. Please try again or use email/password.',
    };
  }
  return {
    success: true,
    isNew: !!data.isNew,
    suggestLink: !!data.suggestLink,
    isPrivateRelay: !!data.isPrivateRelay,
    user: data.user,
    token: data.token,
  };
}

export async function linkSocialAccountToExisting(
  orphanToken: string,
  username: string,
  password: string,
): Promise<LinkAccountResult> {
  const response = await fetch(`${API_BASE_URL}/auth/link-account`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${orphanToken}`,
    },
    body: JSON.stringify({username, password}),
  });
  const data = await response.json();
  if (!response.ok || !data.success || !data.token) {
    return {
      success: false,
      message: data.message || 'Could not link accounts. Please try again.',
    };
  }
  return {success: true, user: data.user, token: data.token};
}

export async function signInWithApple(): Promise<
  SocialAuthResult | SocialAuthError
> {
  if (Platform.OS !== 'ios') {
    return {
      success: false,
      message: 'Sign in with Apple is only available on iOS.',
    };
  }

  try {
    const appleAuth =
      require('@invertase/react-native-apple-authentication').default;

    if (!appleAuth.isSupported) {
      return {
        success: false,
        message: 'Sign in with Apple is not supported on this device.',
      };
    }

    const response = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
    });

    if (!response.identityToken) {
      return {
        success: false,
        message: 'Apple did not return an identity token. Please try again.',
      };
    }

    const nameParts = [
      response.fullName?.givenName,
      response.fullName?.familyName,
    ].filter(Boolean);
    const name = nameParts.length > 0 ? nameParts.join(' ') : undefined;

    return exchangeSocialToken('apple', response.identityToken, name);
  } catch (error: any) {
    if (error?.code === '1001' || error?.code === appleAuthCancelCode()) {
      return {success: false, cancelled: true, message: 'Cancelled'};
    }
    console.error('Apple sign-in error:', error);
    return {
      success: false,
      message: error?.message || 'Apple sign-in failed. Please try again.',
    };
  }
}

function appleAuthCancelCode(): string {
  try {
    const appleAuth =
      require('@invertase/react-native-apple-authentication').default;
    return appleAuth.Error?.CANCELED || '1001';
  } catch {
    return '1001';
  }
}

export async function signInWithGoogle(): Promise<
  SocialAuthResult | SocialAuthError
> {
  try {
    configureGoogleSignIn();
    const {GoogleSignin} = require('@react-native-google-signin/google-signin');

    await GoogleSignin.hasPlayServices({showPlayServicesUpdateDialog: true});
    const result = await GoogleSignin.signIn();

    if (result?.type === 'cancelled') {
      return {success: false, cancelled: true, message: 'Cancelled'};
    }

    // v13+ returns { type: 'success', data: User } where User has idToken.
    const userPayload = result?.data || result;
    let idToken = userPayload?.idToken;
    if (!idToken) {
      idToken = (await GoogleSignin.getTokens()).idToken;
    }

    if (!idToken) {
      return {
        success: false,
        message: 'Google did not return an ID token. Check OAuth client setup.',
      };
    }

    const name = userPayload?.user?.name || undefined;

    return exchangeSocialToken('google', idToken, name);
  } catch (error: any) {
    try {
      const {statusCodes} = require('@react-native-google-signin/google-signin');
      if (
        error?.code === statusCodes?.SIGN_IN_CANCELLED ||
        error?.code === 'SIGN_IN_CANCELLED'
      ) {
        return {success: false, cancelled: true, message: 'Cancelled'};
      }
    } catch {
      // ignore
    }
    console.error('Google sign-in error:', error);
    return {
      success: false,
      message:
        error?.message ||
        'Google sign-in failed. Please try again or use email/password.',
    };
  }
}

export const isGoogleSignInConfigured = (): boolean =>
  !!(Config.GOOGLE_WEB_CLIENT_ID || Config.GOOGLE_IOS_CLIENT_ID);
