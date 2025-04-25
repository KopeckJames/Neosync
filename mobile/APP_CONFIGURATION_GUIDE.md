# App Configuration Guide

This document provides a detailed explanation of the key configuration files for your NeoSync iOS app.

## app.json

This is the main Expo configuration file. Here are the key settings:

```json
{
  "expo": {
    "name": "NeoSync",               // App name displayed on home screen
    "slug": "neosync",               // Used for Expo URLs and paths
    "version": "1.0.0",              // App version (increment for updates)
    "orientation": "portrait",       // App orientation
    "icon": "./assets/icon.png",     // App icon
    "userInterfaceStyle": "dark",    // Default theme
    "splash": { ... },               // Splash screen configuration
    "ios": {
      "bundleIdentifier": "app.neosync.messenger",  // iOS bundle ID
      "buildNumber": "1",            // iOS build number (increment for each submission)
      "infoPlist": { ... }           // iOS-specific permissions and capabilities
    },
    "plugins": [ ... ],              // Expo plugins for native functionality
    "extra": {
      "eas": {
        "projectId": "neosync-messenger"  // EAS project identifier
      }
    },
    "runtimeVersion": {
      "policy": "appVersion"         // Updates based on app version
    },
    "updates": {
      "url": "https://u.expo.dev/neosync-messenger"  // OTA updates URL
    }
  }
}
```

### Key Settings to Update

1. **Version**: Increment this for each new release (`"version": "1.0.1"`)
2. **Build Number**: Increment for each App Store submission (`"buildNumber": "2"`)
3. **Bundle Identifier**: This must match what you registered in App Store Connect
4. **Permissions**: Update the `infoPlist` section based on features you use

## eas.json

This file defines build profiles for Expo Application Services:

```json
{
  "cli": {
    "version": ">= 3.13.3",
    "appVersionSource": "remote"
  },
  "build": {
    "development": { ... },  // For local testing
    "preview": { ... },      // For TestFlight testing
    "production": { ... }    // For App Store releases
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "1234567890",
        "appleTeamId": "ABCDEF123"
      }
    }
  }
}
```

### Key Settings to Update

1. **Apple ID**: Your Apple Developer account email
2. **App Store Connect App ID**: The numerical ID from App Store Connect
3. **Apple Team ID**: Your team identifier from Apple Developer portal

## Environment Variables

The build profiles in eas.json include environment variables that are injected during build:

```json
"env": {
  "APP_ENV": "development"  // or "staging" or "production"
}
```

Your app can access these using `process.env.APP_ENV` in React Native.

## API Configuration (src/config.ts)

This file should use the environment to determine which backend URL to use:

```typescript
const APP_ENV = process.env.APP_ENV || (__DEV__ ? 'development' : 'production');

const API_URLS = {
  development: 'http://localhost:5000',
  staging: 'https://staging-api.neosync.app',
  production: 'https://api.neosync.app'
};

export const API_URL = API_URLS[APP_ENV];
```

## Updating Configuration for Production

When you're ready for production deployment:

1. Update app.json:
   - Increment `version` and `buildNumber`
   - Ensure all permissions are correctly set
   - Update any URLs to production values

2. Update API endpoints in src/config.ts:
   - Ensure production URLs are correct
   - Remove any development-only code

3. Test thoroughly before submission:
   - Test in preview/TestFlight first
   - Verify all features with real data
   - Check performance and error handling