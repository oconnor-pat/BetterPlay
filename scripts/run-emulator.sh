#!/bin/bash

# Build, install, and launch BetterPlay on Android emulator
# Usage: ./scripts/run-emulator.sh
# Mirrors the iOS run-device.sh workflow for Android

AVD_NAME="Medium_Phone_API_35"
PROJECT_DIR="/Users/patty/Projects/BetterPlay"
METRO_PID_FILE="/tmp/betterplay-metro.pid"

# GPS location: Roxbury Township, NJ
GPS_LAT="40.8855"
GPS_LON="-74.6473"

# Function to check if Metro is already running
is_metro_running() {
    if [ -f "$METRO_PID_FILE" ]; then
        local pid=$(cat "$METRO_PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            if ps -p "$pid" -o comm= | grep -q "node"; then
                return 0
            fi
        fi
        rm -f "$METRO_PID_FILE"
    fi

    if lsof -i :8081 -sTCP:LISTEN > /dev/null 2>&1; then
        return 0
    fi

    return 1
}

# Function to check if emulator is already running
is_emulator_running() {
    adb devices 2>/dev/null | grep -q "emulator"
}

# Start emulator if not already running
echo "📱 Checking Android emulator..."
if is_emulator_running; then
    echo "   Emulator is already running, skipping..."
else
    echo "   Starting $AVD_NAME emulator..."
    emulator -avd "$AVD_NAME" -no-snapshot-load > /tmp/betterplay-emulator.log 2>&1 &
    echo "   Waiting for emulator to boot..."
    adb wait-for-device
    # Wait for boot animation to finish
    while [ "$(adb shell getprop sys.boot_completed 2>/dev/null)" != "1" ]; do
        sleep 2
    done
    echo "   Emulator booted."
fi

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
    sleep 3
fi

# Reverse ports so emulator can reach host services
echo "🔗 Setting up adb reverse for Metro and API..."
adb reverse tcp:8081 tcp:8081
adb reverse tcp:8001 tcp:8001

# Set GPS location
echo "📍 Setting GPS to Roxbury Township, NJ..."
adb emu geo fix "$GPS_LON" "$GPS_LAT" > /dev/null 2>&1

# Build and install
echo "🔨 Building BetterPlay for Android..."
cd "$PROJECT_DIR"
npx react-native run-android

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Done! BetterPlay is running on Android emulator."
