/**
 * @format
 */

import 'react-native-get-random-values'; // Must be first import for crypto support
import {AppRegistry} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, {EventType} from '@notifee/react-native';
import App from './App';
import {name as appName} from './app.json';

/**
 * Register background handler for Notifee
 * This MUST be at the top level of index.js to handle notification taps
 * when the app is in background/killed state
 */
notifee.onBackgroundEvent(async ({type, detail}) => {
  const {notification, pressAction} = detail;

  // Log for debugging
  console.log('Background notification event:', type, notification?.id);

  if (type === EventType.PRESS) {
    console.log('User pressed notification:', notification);
    // Navigation will be handled when the app opens via getInitialNotification
  }

  if (type === EventType.DISMISSED) {
    console.log('User dismissed notification:', notification?.id);
  }

  // Handle action press (if using notification actions)
  if (type === EventType.ACTION_PRESS && pressAction?.id) {
    console.log('User pressed action:', pressAction.id);
  }
});

/**
 * Register background message handler for Firebase Messaging
 * This handles incoming push notifications when the app is in background/killed state
 */
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('Background message received:', remoteMessage);
  // The notification will be displayed automatically by the system
  // No need to call notifee.displayNotification here for data-only messages
  // as Firebase handles notification display for messages with notification payload
});

AppRegistry.registerComponent(appName, () => App);
