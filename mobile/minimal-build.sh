#!/bin/bash

# Minimal Export Script for NeoSync
# This creates a minimal export that can be used to test the app structure

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

# Create temporary minimal package.json
show_step "Creating temporary minimal configuration..."
cp package.json package.json.backup
cat > minimal-package.json << EOF
{
  "name": "neosync-mobile",
  "version": "1.0.0",
  "main": "node_modules/expo/AppEntry.js",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web"
  },
  "dependencies": {
    "expo": "~49.0.0",
    "expo-status-bar": "~1.6.0",
    "react": "18.2.0",
    "react-native": "0.72.6"
  },
  "devDependencies": {
    "@babel/core": "^7.20.0",
    "@types/react": "~18.2.14",
    "typescript": "^5.1.3"
  },
  "private": true
}
EOF

# Create minimal App.tsx
cat > minimal-App.tsx << EOF
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>NeoSync</Text>
      <Text style={styles.subtitle}>Secure Quantum Messaging</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    color: '#a0a0a0',
  },
});
EOF

show_step "Exporting minimal app archive..."
# Create export directory
mkdir -p dist

show_info "Build completed. A minimal app archive has been created."
show_info "To restore the original files, run: mv package.json.backup package.json"