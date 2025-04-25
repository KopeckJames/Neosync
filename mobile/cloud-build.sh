#!/bin/bash

# Cloud build script for NeoSync iOS app
# This uses EAS cloud building services instead of local builds

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

# Display menu
echo -e "${GREEN}NeoSync iOS Cloud Build${NC}"
echo "======================================="
echo "1. Build for TestFlight (internal preview)"
echo "2. Submit to TestFlight"
echo "3. Build for App Store (production)"
echo "4. Submit to App Store"
echo "5. Check EAS build status"
echo "6. Exit"
echo "======================================="

read -p "Select an option (1-6): " option

case $option in
  1)
    show_step "Building for TestFlight (preview)..."
    npx eas build --platform ios --profile preview
    ;;
  2)
    show_step "Submitting to TestFlight..."
    npx eas submit --platform ios --profile preview
    ;;
  3)
    show_step "Building for App Store (production)..."
    npx eas build --platform ios --profile production
    ;;
  4)
    show_step "Submitting to App Store..."
    npx eas submit --platform ios --profile production
    ;;
  5)
    show_step "Checking EAS build status..."
    npx eas build:list
    ;;
  6)
    show_info "Exiting..."
    exit 0
    ;;
  *)
    show_error "Invalid option"
    exit 1
    ;;
esac

show_info "Done!"