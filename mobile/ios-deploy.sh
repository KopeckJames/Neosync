#!/bin/bash

# NeoSync iOS Deployment Script
# This script helps with building and deploying the iOS app to TestFlight

# Colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
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

# Function to display header
function show_header {
  echo -e "${BLUE}$1${NC}"
}

# Check if we're in the mobile directory
if [ ! -f "app.json" ]; then
  show_error "Please run this script from the mobile directory"
  exit 1
fi

# Ensure dependencies are installed
function install_deps {
  show_step "Checking dependencies..."
  
  # Check if EAS CLI is installed
  if ! command -v eas &> /dev/null; then
    show_info "EAS CLI not found. Installing..."
    npm install -g eas-cli
  fi
  
  # Install project dependencies
  show_step "Installing project dependencies..."
  npm install --legacy-peer-deps
}

# Function to update version numbers
function update_version {
  show_header "UPDATE VERSION NUMBERS"
  echo "Current version info in app.json:"
  
  # Extract current values
  CURRENT_VERSION=$(grep -o '"version": "[^"]*"' app.json | cut -d'"' -f4)
  CURRENT_BUILD=$(grep -o '"buildNumber": "[^"]*"' app.json | cut -d'"' -f4)
  
  echo "Version: $CURRENT_VERSION"
  echo "Build Number: $CURRENT_BUILD"
  echo
  
  read -p "Update version number? (y/n): " UPDATE_VERSION
  if [[ "$UPDATE_VERSION" == "y" ]]; then
    read -p "Enter new version (e.g., 1.0.1): " NEW_VERSION
    
    # Only proceed if user entered something
    if [[ ! -z "$NEW_VERSION" ]]; then
      # Update version in app.json
      sed -i.bak "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" app.json
      show_info "Version updated to $NEW_VERSION"
    fi
  fi
  
  read -p "Update build number? (y/n): " UPDATE_BUILD
  if [[ "$UPDATE_BUILD" == "y" ]]; then
    read -p "Enter new build number (e.g., 2): " NEW_BUILD
    
    # Only proceed if user entered something
    if [[ ! -z "$NEW_BUILD" ]]; then
      # Update build number in app.json
      sed -i.bak "s/\"buildNumber\": \"$CURRENT_BUILD\"/\"buildNumber\": \"$NEW_BUILD\"/" app.json
      show_info "Build number updated to $NEW_BUILD"
    fi
  fi
  
  # Remove backup file
  rm -f app.json.bak
}

# Check credentials
function check_credentials {
  show_header "CHECKING EAS CREDENTIALS"
  npx eas credentials:list --platform ios
}

# Main menu
function show_menu {
  clear
  show_header "NEOSYNC iOS DEPLOYMENT"
  echo "======================================="
  echo "1. Install dependencies"
  echo "2. Update version numbers"
  echo "3. Test locally with Expo Go"
  echo "4. Build for iOS simulator"
  echo "5. Build for TestFlight (internal)"
  echo "6. Submit to TestFlight"
  echo "7. Build for App Store (production)"
  echo "8. Submit to App Store"
  echo "9. Check EAS build status"
  echo "10. View/manage credentials"
  echo "11. Exit"
  echo "======================================="
  
  read -p "Select an option (1-11): " option
  
  case $option in
    1)
      install_deps
      ;;
    2)
      update_version
      ;;
    3)
      show_step "Starting Expo development server..."
      npm start
      ;;
    4)
      show_step "Building for iOS simulator..."
      npx eas build --platform ios --profile development
      ;;
    5)
      show_step "Building for TestFlight (internal)..."
      npx eas build --platform ios --profile preview
      ;;
    6)
      show_step "Submitting to TestFlight..."
      npx eas submit --platform ios --profile preview
      ;;
    7)
      show_step "Building for App Store (production)..."
      npx eas build --platform ios --profile production
      ;;
    8)
      show_step "Submitting to App Store..."
      npx eas submit --platform ios --profile production
      ;;
    9)
      show_step "Checking EAS build status..."
      npx eas build:list
      ;;
    10)
      check_credentials
      ;;
    11)
      show_info "Exiting..."
      exit 0
      ;;
    *)
      show_error "Invalid option"
      ;;
  esac
  
  read -p "Press Enter to continue..."
  show_menu
}

# Start the script
install_deps
show_menu