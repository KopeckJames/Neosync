# NeoSync Mobile Application

This directory contains the React Native iOS application for NeoSync, a quantum-secure messaging platform.

## Overview

The NeoSync mobile app enables iOS users to communicate with web users of the same platform. It shares the same backend infrastructure and encryption protocols as the web version, ensuring secure cross-platform communication.

## Features

- End-to-end encrypted messaging
- User authentication and registration
- Real-time messaging with WebSockets
- File and media sharing
- Group conversations
- Profile management
- Push notifications (when deployed)

## Development Setup

1. Install dependencies:
   ```
   cd mobile
   npm install
   ```

2. Install Expo CLI globally:
   ```
   npm install -g expo-cli
   ```

3. Start the development server:
   ```
   npm start
   ```

4. To run on iOS simulator:
   ```
   npm run ios
   ```

## App Store Preparation

To publish this app to the Apple App Store, follow these steps:

1. **Apple Developer Account**:
   - Register for an Apple Developer account ($99/year) at [developer.apple.com](https://developer.apple.com)

2. **App Store Connect Setup**:
   - Create a new app in App Store Connect
   - Configure app details, pricing, and availability

3. **App Icons and Assets**:
   - Prepare required app icons (various sizes)
   - Create screenshots for App Store listing
   - Prepare app preview videos (optional)

4. **App Store Information**:
   - Write compelling app description
   - Choose appropriate categories and keywords
   - Prepare privacy policy URL

5. **Build and Submit**:
   - Create a production build:
     ```
     expo build:ios
     ```
   - Use Xcode to archive and upload the build
   - Submit for review in App Store Connect

## Required Modifications for Production

1. **Push Notifications**:
   - Implement Apple Push Notification service (APNs)
   - Configure push notification certificates

2. **Deep Linking**:
   - Set up Universal Links for deep linking into the app

3. **App Store Guidelines Compliance**:
   - Ensure all functionality complies with App Store Review Guidelines
   - Add in-app privacy disclosures

4. **Backend Configuration**:
   - Update API endpoints to production URLs
   - Ensure proper SSL certificate setup
   - Configure proper rate limiting and API security

## Cross-Platform Compatibility

This app is designed to communicate seamlessly with the web version. All messages and media sent from the iOS app can be received on the web client and vice versa.

## Key Technical Components

- **Authentication**: SharedAuth context that works with AsyncStorage
- **Real-time Communication**: WebSocket implementation
- **Navigation**: React Navigation for screen management
- **State Management**: React Query for data fetching and caching
- **UI Components**: Custom React Native components with unified styling
- **End-to-End Encryption**: Same encryption library as web for compatibility