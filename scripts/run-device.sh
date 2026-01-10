#!/bin/bash

# Build, install, and launch BetterPlay on physical iPhone
# Usage: ./scripts/run-device.sh

DEVICE_ID="00008150-00015590027A401C"
BUNDLE_ID="com.oconnorpat.betterplay"
WORKSPACE="/Users/patty/Documents/Projects/BetterPlay/ios/BetterPlay.xcworkspace"
APP_PATH="/Users/patty/Library/Developer/Xcode/DerivedData/BetterPlay-cirdbgrfixtloihdxubzmtpoletd/Build/Products/Debug-iphoneos/BetterPlay.app"

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
