#!/bin/bash

# Build, install, and launch BetterPlay on physical iPhone
# Usage: ./scripts/run-device.sh

DEVICE_ID="00008150-00015590027A401C"
BUNDLE_ID="com.oconnorpat.betterplay"
WORKSPACE="/Users/patty/Documents/Projects/BetterPlay/ios/BetterPlay.xcworkspace"
APP_PATH="/Users/patty/Library/Developer/Xcode/DerivedData/BetterPlay-cirdbgrfixtloihdxubzmtpoletd/Build/Products/Debug-iphoneos/BetterPlay.app"
PROJECT_DIR="/Users/patty/Documents/Projects/BetterPlay"

# Start Metro bundler in a new Terminal window
echo "🚇 Starting Metro bundler..."
osascript -e "tell application \"Terminal\" to do script \"cd '$PROJECT_DIR' && npm start\""

# Give Metro a moment to start
sleep 3

echo "🔨 Building BetterPlay..."
xcodebuild -workspace "$WORKSPACE" -scheme BetterPlay -configuration Debug -destination "id=$DEVICE_ID" -allowProvisioningUpdates -quiet

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "📲 Installing on iPhone..."
xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH"

if [ $? -ne 0 ]; then
    echo "❌ Install failed"
    exit 1
fi

echo "🚀 Launching app..."
xcrun devicectl device process launch --device "$DEVICE_ID" "$BUNDLE_ID"

echo "✅ Done! BetterPlay is running on iPhone."
