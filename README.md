# BetterPlay 🏀⚽🏒

BetterPlay is a React Native mobile application designed to help users organize and join local sports pickup games and recreational activities. Whether you're looking to start a basketball game, join a soccer match, or find tennis partners, BetterPlay makes it easy to connect with your local sports community.

## 📱 App Overview

BetterPlay brings together sports enthusiasts by providing a comprehensive platform to:
- Create and manage sports events in your area
- Find and join pickup games that match your interests
- Connect with other players in your community
- Coordinate event details including location, time, and roster management

Perfect for casual athletes, recreational players, and anyone looking to stay active with organized local sports activities!

## ✨ Features

### 🔐 User Authentication
- Secure login and registration system
- Token-based authentication for protected routes
- Persistent user sessions

### 📅 Event Management
Create and manage sports events with comprehensive details:
- **Event Information**: Set event name, date, and time
- **Location Selection**: Integrated Google Places autocomplete for easy location search
- **Roster Management**: Configure team size (1-30 players)
- **Activity Type**: Choose from 12 different sports and activities
- **Edit & Delete**: Full control over your created events

### 🎯 Supported Sports & Activities
- Basketball 🏀
- Hockey 🏒
- Soccer ⚽
- Figure Skating ⛸️
- Tennis 🎾
- Golf ⛳
- Football 🏈
- Rugby 🏉
- Baseball ⚾
- Softball 🥎
- Lacrosse 🥍
- Volleyball 🏐

### 🗺️ Map Integration
- Interactive maps powered by Google Maps
- View event locations on an interactive map
- Navigation support for multiple apps:
  - Google Maps
  - Waze
  - Apple Maps

### 💬 Community Notes
- Share updates and communicate with the community
- Stay connected with other players

### 👤 User Profiles
- Personal profile management
- View and update your information

### 🎨 Theme Support
- Dark mode and light mode options
- Seamless theme switching
- Consistent experience across the app

### ⚙️ Settings
- Configure user preferences
- Customize your app experience

## 📸 Screenshots

_Screenshots coming soon!_

## 🛠️ Tech Stack

- **Framework**: [React Native](https://reactnative.dev) 0.73.1
- **Language**: TypeScript 5.0.4
- **Navigation**: React Navigation (Stack & Bottom Tabs)
- **Maps**: React Native Maps & Google Maps/Places API
- **State Management**: React Context API
- **HTTP Client**: Axios
- **Storage**: AsyncStorage
- **UI Components**: 
  - React Native Vector Icons
  - FontAwesome Icons
  - React Native Modal DateTimePicker
  - React Native Image Picker
- **Forms & Input**: React Native Picker, DateTimePicker
- **Styling**: React Native StyleSheet

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: Version 18 or higher
- **npm** or **Yarn**: Package manager
- **React Native Environment**: Complete the [React Native - Environment Setup](https://reactnative.dev/docs/environment-setup) for your target platform (iOS/Android)
- **iOS Development** (for iOS builds):
  - macOS
  - Xcode 12 or higher
  - CocoaPods
- **Android Development** (for Android builds):
  - Android Studio
  - Android SDK
  - Java Development Kit (JDK)
- **Backend API**: Access to the BetterPlay backend API (configured in `src/config/api.ts`)

## 🚀 Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/oconnor-pat/BetterPlay.git
   cd BetterPlay
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **iOS specific setup** (macOS only):
   ```bash
   cd ios
   pod install
   cd ..
   ```

## ▶️ Running the App

### Start Metro Bundler

First, start the Metro bundler:

```bash
npm start
```

### Run on iOS

In a new terminal window:

```bash
npm run ios
```

This will launch the app in the iPhone 17 Pro simulator (iOS 26.1).

### Run on Android

In a new terminal window:

```bash
npm run android
```

This will launch the app in the Pixel 9 Pro emulator. The command automatically starts the emulator if it's not running.

## ⚙️ Configuration

### Backend API Setup

The app connects to a backend API for data management. Configure the API endpoint in:

```typescript
// src/config/api.ts
export const API_BASE_URL = 'https://your-backend-url.com';
// For local development: 'http://localhost:8001'
```

### Google Maps/Places API

To use map features, you'll need to configure Google Maps API keys:

1. **iOS**: Add your API key to `ios/BetterPlay/AppDelegate.mm`
2. **Android**: Add your API key to `android/app/src/main/AndroidManifest.xml`

Refer to the [React Native Maps documentation](https://github.com/react-native-maps/react-native-maps) for detailed setup instructions.

## 📁 Project Structure

```
BetterPlay/
├── src/
│   ├── components/         # React components
│   │   ├── BottomNavigator/
│   │   ├── EventList/      # Event listing and creation
│   │   ├── EventRoster/    # Roster management
│   │   ├── Landingpage/    # Login/Registration
│   │   ├── Profile/        # User profile
│   │   ├── Settings/       # App settings
│   │   ├── Communitynotes/ # Community features
│   │   ├── HamburgerMenu/  # Navigation menu
│   │   └── ThemeContext/   # Theme management
│   ├── Context/            # React Context providers
│   │   └── EventContext.tsx
│   └── config/             # Configuration files
│       └── api.ts          # API configuration
├── android/                # Android native code
├── ios/                    # iOS native code
├── App.tsx                 # Root component
└── package.json            # Dependencies
```

## 🧪 Development

### Linting

Run ESLint to check code quality:

```bash
npm run lint
```

### Testing

Run the test suite:

```bash
npm test
```

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**: Follow the existing code style and conventions
4. **Test your changes**: Ensure the app builds and runs correctly
5. **Commit your changes**: `git commit -m 'Add some amazing feature'`
6. **Push to the branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**: Describe your changes and their benefits

### Code Style

- Follow TypeScript best practices
- Use meaningful variable and function names
- Add comments for complex logic
- Ensure proper error handling

## 📄 License

This project is private and proprietary. All rights reserved.

## 🙏 Acknowledgments

- Built with [React Native](https://reactnative.dev)
- Maps powered by [Google Maps Platform](https://developers.google.com/maps)
- Icons from [FontAwesome](https://fontawesome.com) and [React Native Vector Icons](https://github.com/oblador/react-native-vector-icons)

---

**Ready to play?** Download BetterPlay and start organizing your next game! 🎉
