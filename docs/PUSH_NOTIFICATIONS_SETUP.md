# Push Notifications Backend Setup Guide

This guide explains how to set up push notifications for the BetterPlay app with your existing MongoDB Atlas, Heroku, and AWS S3 stack.

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React Native  │────▶│  Heroku Backend │────▶│  Firebase FCM   │
│   (iOS/Android) │     │   (Node.js)     │     │      + APNs     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                      │                       │
         │                      │                       │
         └──────────────────────┼───────────────────────┘
                                │
                        ┌───────▼───────┐
                        │ MongoDB Atlas │
                        │   (Tokens &   │
                        │  Preferences) │
                        └───────────────┘
```

## Step 1: Firebase Project Setup

### 1.1 Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select existing project
3. Follow the setup wizard

### 1.2 Add iOS App to Firebase

1. In Firebase Console, click "Add app" → iOS
2. Enter your iOS bundle ID: `com.betterplay.app` (or your actual bundle ID)
3. Download the `GoogleService-Info.plist` file
4. Place it in `/ios/BetterPlay/GoogleService-Info.plist`

### 1.3 Configure APNs for iOS

1. Go to Project Settings → Cloud Messaging → iOS app configuration
2. You need to upload your APNs authentication key:

   **Option A: APNs Authentication Key (Recommended)**

   - Go to [Apple Developer Portal](https://developer.apple.com/account/resources/authkeys/list)
   - Create a new key with "Apple Push Notifications service (APNs)" enabled
   - Download the `.p8` file
   - Note the Key ID
   - Upload to Firebase Cloud Messaging settings

   **Option B: APNs Certificates**

   - Generate APNs certificates in Apple Developer Portal
   - Upload both Development and Production certificates to Firebase

### 1.4 Get Firebase Admin SDK Credentials

1. Go to Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download the JSON file (keep this secure!)

## Step 2: Xcode Configuration

### 2.1 Add Push Notification Capability

1. Open `ios/BetterPlay.xcworkspace` in Xcode
2. Select the BetterPlay target
3. Go to "Signing & Capabilities" tab
4. Click "+ Capability"
5. Add "Push Notifications"
6. Add "Background Modes" and check:
   - Background fetch
   - Remote notifications

### 2.2 Add GoogleService-Info.plist

1. Drag `GoogleService-Info.plist` into Xcode
2. Make sure "Copy items if needed" is checked
3. Add to the BetterPlay target

## Step 3: Backend Setup (Heroku/Node.js)

### 3.1 Install Dependencies

```bash
cd your-backend-project
npm install firebase-admin mongoose
```

### 3.2 Configure Firebase Admin SDK

Set these environment variables in Heroku:

```bash
heroku config:set FIREBASE_PROJECT_ID=your-project-id
heroku config:set FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
heroku config:set FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
```

### 3.3 Create MongoDB Schemas

**Device Token Schema** (`models/DeviceToken.js`):

```javascript
const mongoose = require('mongoose');

const deviceTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  deviceToken: {
    type: String,
    required: true,
    unique: true,
  },
  platform: {
    type: String,
    enum: ['ios', 'android'],
    required: true,
  },
  deviceType: {
    type: String,
    enum: ['apns', 'fcm'],
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for efficient queries
deviceTokenSchema.index({userId: 1, isActive: 1});

module.exports = mongoose.model('DeviceToken', deviceTokenSchema);
```

**Notification Preferences Schema** (`models/NotificationPreferences.js`):

```javascript
const mongoose = require('mongoose');

const notificationPreferencesSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  enabled: {
    type: Boolean,
    default: true,
  },
  friendRequests: {
    type: Boolean,
    default: true,
  },
  eventUpdates: {
    type: Boolean,
    default: true,
  },
  eventReminders: {
    type: Boolean,
    default: true,
  },
  communityNotes: {
    type: Boolean,
    default: true,
  },
  quietHoursEnabled: {
    type: Boolean,
    default: false,
  },
  quietHoursStart: {
    type: String,
    default: '22:00',
  },
  quietHoursEnd: {
    type: String,
    default: '07:00',
  },
});

module.exports = mongoose.model(
  'NotificationPreferences',
  notificationPreferencesSchema,
);
```

**Notification History Schema** (`models/Notification.js`):

```javascript
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: [
      'friend_request',
      'friend_accepted',
      'event_update',
      'event_reminder',
      'event_invitation',
      'community_note',
      'general',
    ],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  body: {
    type: String,
    required: true,
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  read: {
    type: Boolean,
    default: false,
  },
  readAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Compound index for efficient queries
notificationSchema.index({userId: 1, read: 1, createdAt: -1});

module.exports = mongoose.model('Notification', notificationSchema);
```

### 3.4 Create Notification Service

**services/notificationService.js**:

```javascript
const admin = require('firebase-admin');
const DeviceToken = require('../models/DeviceToken');
const NotificationPreferences = require('../models/NotificationPreferences');
const Notification = require('../models/Notification');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const notificationService = {
  /**
   * Register a device token for a user
   */
  async registerDevice(userId, deviceToken, platform, deviceType) {
    try {
      // Check if token already exists
      const existing = await DeviceToken.findOne({deviceToken});

      if (existing) {
        // Update existing token
        existing.userId = userId;
        existing.platform = platform;
        existing.deviceType = deviceType;
        existing.isActive = true;
        existing.updatedAt = new Date();
        await existing.save();
        return existing;
      }

      // Create new token
      const newToken = new DeviceToken({
        userId,
        deviceToken,
        platform,
        deviceType,
      });
      await newToken.save();

      // Ensure user has notification preferences
      await NotificationPreferences.findOneAndUpdate(
        {userId},
        {userId},
        {upsert: true, new: true},
      );

      return newToken;
    } catch (error) {
      console.error('Error registering device:', error);
      throw error;
    }
  },

  /**
   * Unregister a device token
   */
  async unregisterDevice(deviceToken) {
    try {
      await DeviceToken.findOneAndUpdate(
        {deviceToken},
        {isActive: false, updatedAt: new Date()},
      );
    } catch (error) {
      console.error('Error unregistering device:', error);
      throw error;
    }
  },

  /**
   * Send push notification to a user
   */
  async sendToUser(userId, notification, type = 'general') {
    try {
      // Check user preferences
      const preferences = await NotificationPreferences.findOne({userId});

      if (preferences && !preferences.enabled) {
        console.log(`Notifications disabled for user ${userId}`);
        return {success: false, reason: 'notifications_disabled'};
      }

      // Check specific preference based on type
      if (preferences) {
        const typePreferenceMap = {
          friend_request: 'friendRequests',
          friend_accepted: 'friendRequests',
          event_update: 'eventUpdates',
          event_reminder: 'eventReminders',
          event_invitation: 'eventUpdates',
          community_note: 'communityNotes',
        };

        const preferenceKey = typePreferenceMap[type];
        if (preferenceKey && !preferences[preferenceKey]) {
          console.log(`${type} notifications disabled for user ${userId}`);
          return {success: false, reason: 'type_disabled'};
        }
      }

      // Get user's active device tokens
      const tokens = await DeviceToken.find({userId, isActive: true});

      if (!tokens.length) {
        console.log(`No active device tokens for user ${userId}`);
        return {success: false, reason: 'no_tokens'};
      }

      // Save notification to history
      const notificationRecord = new Notification({
        userId,
        type,
        title: notification.title,
        body: notification.body,
        data: notification.data,
      });
      await notificationRecord.save();

      // Send to all user's devices
      const messages = tokens.map(token => ({
        token: token.deviceToken,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data
          ? Object.fromEntries(
              Object.entries(notification.data).map(([k, v]) => [k, String(v)]),
            )
          : undefined,
        apns: {
          payload: {
            aps: {
              badge: notification.badge || 1,
              sound: notification.sound || 'default',
            },
          },
        },
      }));

      const response = await admin.messaging().sendEach(messages);

      // Handle failed tokens
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const error = resp.error;
          if (
            error?.code === 'messaging/registration-token-not-registered' ||
            error?.code === 'messaging/invalid-registration-token'
          ) {
            // Mark token as inactive
            DeviceToken.findOneAndUpdate(
              {deviceToken: tokens[idx].deviceToken},
              {isActive: false, updatedAt: new Date()},
            ).exec();
          }
        }
      });

      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  },

  /**
   * Send notification to multiple users
   */
  async sendToUsers(userIds, notification, type = 'general') {
    const results = await Promise.allSettled(
      userIds.map(userId => this.sendToUser(userId, notification, type)),
    );

    return {
      total: userIds.length,
      successful: results.filter(
        r => r.status === 'fulfilled' && r.value?.success,
      ).length,
      failed: results.filter(r => r.status === 'rejected' || !r.value?.success)
        .length,
    };
  },

  /**
   * Get user's notification preferences
   */
  async getPreferences(userId) {
    let preferences = await NotificationPreferences.findOne({userId});

    if (!preferences) {
      preferences = new NotificationPreferences({userId});
      await preferences.save();
    }

    return preferences;
  },

  /**
   * Update user's notification preferences
   */
  async updatePreferences(userId, updates) {
    const preferences = await NotificationPreferences.findOneAndUpdate(
      {userId},
      {...updates, userId},
      {upsert: true, new: true},
    );
    return preferences;
  },

  /**
   * Get user's notification history
   */
  async getNotifications(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({userId}).sort({createdAt: -1}).skip(skip).limit(limit),
      Notification.countDocuments({userId}),
      Notification.countDocuments({userId, read: false}),
    ]);

    return {
      notifications,
      total,
      unreadCount,
      hasMore: skip + notifications.length < total,
    };
  },

  /**
   * Mark notifications as read
   */
  async markAsRead(userId, notificationIds) {
    const result = await Notification.updateMany(
      {_id: {$in: notificationIds}, userId},
      {read: true, readAt: new Date()},
    );
    return result.modifiedCount;
  },
};

module.exports = notificationService;
```

### 3.5 Create API Routes

**routes/notifications.js**:

```javascript
const express = require('express');
const router = express.Router();
const notificationService = require('../services/notificationService');
const auth = require('../middleware/auth'); // Your auth middleware

// Register device token
router.post('/register-device', auth, async (req, res) => {
  try {
    const {deviceToken, platform, deviceType} = req.body;

    await notificationService.registerDevice(
      req.user._id,
      deviceToken,
      platform,
      deviceType,
    );

    res.json({success: true, message: 'Device registered successfully'});
  } catch (error) {
    console.error('Error registering device:', error);
    res
      .status(500)
      .json({success: false, message: 'Failed to register device'});
  }
});

// Unregister device token
router.post('/unregister-device', auth, async (req, res) => {
  try {
    const {deviceToken} = req.body;

    await notificationService.unregisterDevice(deviceToken);

    res.json({success: true, message: 'Device unregistered successfully'});
  } catch (error) {
    console.error('Error unregistering device:', error);
    res
      .status(500)
      .json({success: false, message: 'Failed to unregister device'});
  }
});

// Get notification preferences
router.get('/preferences', auth, async (req, res) => {
  try {
    const preferences = await notificationService.getPreferences(req.user._id);
    res.json({success: true, preferences});
  } catch (error) {
    console.error('Error getting preferences:', error);
    res
      .status(500)
      .json({success: false, message: 'Failed to get preferences'});
  }
});

// Update notification preferences
router.put('/preferences', auth, async (req, res) => {
  try {
    const preferences = await notificationService.updatePreferences(
      req.user._id,
      req.body,
    );
    res.json({success: true, preferences});
  } catch (error) {
    console.error('Error updating preferences:', error);
    res
      .status(500)
      .json({success: false, message: 'Failed to update preferences'});
  }
});

// Get notification history
router.get('/history', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await notificationService.getNotifications(
      req.user._id,
      page,
      limit,
    );

    res.json({success: true, ...result});
  } catch (error) {
    console.error('Error getting notifications:', error);
    res
      .status(500)
      .json({success: false, message: 'Failed to get notifications'});
  }
});

// Mark notifications as read
router.post('/mark-read', auth, async (req, res) => {
  try {
    const {notificationIds} = req.body;

    const updatedCount = await notificationService.markAsRead(
      req.user._id,
      notificationIds,
    );

    res.json({success: true, updatedCount});
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    res.status(500).json({success: false, message: 'Failed to mark as read'});
  }
});

// Get unread count
router.get('/unread-count', auth, async (req, res) => {
  try {
    const result = await notificationService.getNotifications(
      req.user._id,
      1,
      1,
    );
    res.json({success: true, unreadCount: result.unreadCount});
  } catch (error) {
    console.error('Error getting unread count:', error);
    res
      .status(500)
      .json({success: false, message: 'Failed to get unread count'});
  }
});

module.exports = router;
```

### 3.6 Mount Routes in Main App

In your main Express app (`app.js` or `server.js`):

```javascript
const notificationRoutes = require('./routes/notifications');

// ... other middleware ...

app.use('/api/notifications', notificationRoutes);
```

## Step 4: Usage Examples

### Sending Notifications from Backend

**Friend Request Example:**

```javascript
const notificationService = require('./services/notificationService');

// When user sends a friend request
async function handleFriendRequest(fromUser, toUserId) {
  await notificationService.sendToUser(
    toUserId,
    {
      title: 'New Friend Request',
      body: `${fromUser.username} wants to be your friend`,
      data: {
        type: 'friend_request',
        userId: fromUser._id.toString(),
      },
    },
    'friend_request',
  );
}
```

**Event Reminder Example:**

```javascript
// Scheduled job (using node-cron or similar)
const cron = require('node-cron');

cron.schedule('0 * * * *', async () => {
  // Find events starting in 1 hour
  const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);
  const events = await Event.find({
    startTime: {
      $gte: new Date(),
      $lte: oneHourFromNow,
    },
    reminderSent: {$ne: true},
  }).populate('attendees');

  for (const event of events) {
    const attendeeIds = event.attendees.map(a => a._id);

    await notificationService.sendToUsers(
      attendeeIds,
      {
        title: 'Event Starting Soon',
        body: `${event.title} starts in 1 hour!`,
        data: {
          type: 'event_reminder',
          id: event._id.toString(),
        },
      },
      'event_reminder',
    );

    // Mark reminder as sent
    event.reminderSent = true;
    await event.save();
  }
});
```

## Step 5: Testing

### Test on Physical Device

1. Build and run on a physical iOS device (simulator doesn't support push)
2. Grant notification permissions when prompted
3. Use Firebase Console to send a test message:
   - Go to Firebase Console → Cloud Messaging
   - Click "Send your first message"
   - Enter test message details
   - Target your app

### Test from Backend

```javascript
// Test endpoint (remove in production)
router.post('/test-notification', auth, async (req, res) => {
  try {
    const result = await notificationService.sendToUser(req.user._id, {
      title: 'Test Notification',
      body: 'This is a test push notification!',
      data: {
        type: 'general',
        test: 'true',
      },
    });
    res.json({success: true, result});
  } catch (error) {
    res.status(500).json({success: false, error: error.message});
  }
});
```

## Troubleshooting

### Common Issues

1. **No notifications received:**

   - Check APNs certificate/key is uploaded to Firebase
   - Verify Push Notifications capability is added in Xcode
   - Test on physical device (simulator doesn't work)
   - Check device token is being registered correctly

2. **Token registration fails:**

   - Ensure Firebase is properly initialized in AppDelegate
   - Check GoogleService-Info.plist is included in target

3. **Background notifications not working:**

   - Verify Background Modes are enabled
   - Check content-available is set in payload

4. **Invalid token errors:**
   - Tokens expire when user reinstalls app
   - Handle token refresh in your backend

## Security Considerations

1. **Never expose Firebase Admin credentials** in client code
2. **Validate user permissions** before sending notifications
3. **Rate limit** notification sending to prevent abuse
4. **Sanitize notification content** to prevent injection attacks
5. **Store tokens securely** and mark inactive tokens promptly

## Next Steps

1. Add Android support (FCM tokens work similarly)
2. Implement notification scheduling
3. Add rich notifications with images
4. Implement notification analytics
5. Add notification grouping/stacking
