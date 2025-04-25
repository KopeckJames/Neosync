#!/bin/bash

# Simple build script for iOS development build
# This is a simplified version for troubleshooting

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

show_step "Installing development client..."
npx expo install expo-dev-client

show_step "Building for iOS simulator (simplified build)..."
npx eas build --platform ios --profile development --local

show_info "Done!"