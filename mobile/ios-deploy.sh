#!/bin/bash

# NeoSync iOS Deployment Script
# This script helps with building and deploying the iOS app to TestFlight

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

# Check if EAS CLI is installed
if ! command -v eas &> /dev/null; then
  show_info "EAS CLI not found. Installing..."
  npm install -g eas-cli
fi

# Display menu
echo -e "${GREEN}NeoSync iOS Deployment${NC}"
echo "======================================="
echo "1. Test locally with Expo Go"
echo "2. Build for iOS simulator"
echo "3. Build for TestFlight (internal)"
echo "4. Build for TestFlight (production)"
echo "5. Submit to App Store"
echo "6. Check EAS build status"
echo "7. Exit"
echo "======================================="

read -p "Select an option (1-7): " option

case $option in
  1)
    show_step "Starting Expo development server..."
    npm start
    ;;
  2)
    show_step "Building for iOS simulator..."
    eas build --platform ios --profile development
    ;;
  3)
    show_step "Building for TestFlight (internal)..."
    eas build --platform ios --profile preview
    ;;
  4)
    show_step "Building for TestFlight (production)..."
    eas build --platform ios --profile production
    ;;
  5)
    show_step "Submitting to App Store..."
    eas submit --platform ios --profile production
    ;;
  6)
    show_step "Checking EAS build status..."
    eas build:list
    ;;
  7)
    show_info "Exiting..."
    exit 0
    ;;
  *)
    show_error "Invalid option"
    exit 1
    ;;
esac

show_info "Done!"