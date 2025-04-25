#!/bin/bash

# NeoSync iOS Prebuild Script
# This script helps eject the Expo app to a bare React Native project for Xcode use

# Colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to display steps
function show_step {
  echo -e "${GREEN}[STEP]${NC} $1"
}

# Function to display info
function show_info {
  echo -e "${YELLOW}[INFO]${NC} $1"
}

# Function to display error
function show_error {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the mobile directory
if [ ! -f "app.json" ]; then
  show_error "Please run this script from the mobile directory"
  exit 1
fi

show_info "This script will eject your Expo app to a bare React Native project."
show_info "This allows you to use Xcode directly for building and deploying."
show_info "This process cannot be easily reversed."
read -p "Are you sure you want to proceed? (y/n): " CONFIRM

if [[ "$CONFIRM" != "y" ]]; then
  show_info "Operation cancelled."
  exit 0
fi

# Backup important files
show_step "Backing up important files..."
mkdir -p backups
cp app.json backups/app.json.backup
cp package.json backups/package.json.backup
cp App.tsx backups/App.tsx.backup

# Run the prebuild command
show_step "Ejecting to bare React Native project..."
npx expo prebuild --platform ios

if [ $? -ne 0 ]; then
  show_error "Prebuild failed. Check the error messages above."
  exit 1
fi

# Install CocoaPods dependencies
if [ -d "ios" ]; then
  show_step "Installing CocoaPods dependencies..."
  cd ios
  pod install
  cd ..
else
  show_error "iOS directory not found. Prebuild may have failed."
  exit 1
fi

show_info "===================================================="
show_info "Prebuild completed successfully!"
show_info "You can now open the Xcode project with:"
show_info "open ios/NeoSync.xcworkspace"
show_info "===================================================="
show_info "Make sure to configure signing in Xcode:"
show_info "  - Team ID: R7UQ8J92N9"
show_info "  - Bundle ID: app.neosync.messenger"
show_info "===================================================="