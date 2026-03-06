#!/bin/bash

# Build, install, and launch BetterPlay on physical iPhone
# Usage: ./scripts/run-device.sh

DEVICE_ID="00008150-00015590027A401C"
BUNDLE_ID="com.oconnorpat.betterplay"
WORKSPACE="/Users/patty/Projects/BetterPlay/ios/BetterPlay.xcworkspace"
PROJECT_DIR="/Users/patty/Projects/BetterPlay"
METRO_PID_FILE="/tmp/betterplay-metro.pid"
DERIVED_DATA_DIR="$HOME/Library/Developer/Xcode/DerivedData"

# Function to check if Metro is already running
is_metro_running() {
    if [ -f "$METRO_PID_FILE" ]; then
        local pid=$(cat "$METRO_PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            # Check if it's actually a node/metro process
            if ps -p "$pid" -o comm= | grep -q "node"; then
                return 0
            fi
        fi
        # PID file exists but process is dead, clean up
        rm -f "$METRO_PID_FILE"
    fi
    
    # Also check if Metro is running on port 8081
    if lsof -i :8081 -sTCP:LISTEN > /dev/null 2>&1; then
        return 0
    fi
    
    return 1
}

# Start Metro bundler only if not already running
echo "🚇 Checking Metro bundler..."
if is_metro_running; then
    echo "   Metro is already running, skipping..."
else
    echo "   Starting Metro bundler in background..."
    cd "$PROJECT_DIR"
    npm start > /tmp/betterplay-metro.log 2>&1 &
    echo $! > "$METRO_PID_FILE"
    echo "   Metro PID: $(cat $METRO_PID_FILE)"
    # Give Metro a moment to start
    sleep 3
fi

echo "🔨 Building BetterPlay..."
xcodebuild build -workspace "$WORKSPACE" -scheme BetterPlay -configuration Debug -destination "generic/platform=iOS" -allowProvisioningUpdates -quiet

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

# Find the built app dynamically
echo "📍 Locating built app..."
APP_PATH=$(find "$DERIVED_DATA_DIR" -path "*BetterPlay*/Build/Products/Debug-iphoneos/BetterPlay.app" -type d 2>/dev/null | head -1)

if [ -z "$APP_PATH" ] || [ ! -d "$APP_PATH" ]; then
    echo "❌ Could not find built app in DerivedData"
    exit 1
fi

echo "   Found: $APP_PATH"

echo "📲 Installing on iPhone..."
xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH"

if [ $? -ne 0 ]; then
    echo "❌ Install failed"
    exit 1
fi

echo "🚀 Launching app..."
xcrun devicectl device process launch --device "$DEVICE_ID" "$BUNDLE_ID"

echo "✅ Done! BetterPlay is running on iPhone."
