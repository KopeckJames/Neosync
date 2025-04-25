# NeoSync iOS App Troubleshooting Guide

This guide addresses common issues that may arise during the build and deployment process for the NeoSync iOS app.

## Dependency Resolution Issues

### expo-camera Installation Errors

If you encounter errors related to expo-camera while building with EAS:

1. **Install with legacy peer dependencies**:
   ```bash
   cd mobile
   npm install expo-camera --legacy-peer-deps
   ```

2. **Check the plugins configuration in app.json**:
   Make sure the plugins section is properly configured with detailed options:
   ```json
   "plugins": [
     ["expo-camera", {
       "cameraPermission": "Allow $(PRODUCT_NAME) to access your camera to take photos for sharing in conversations."
     }],
     // other plugins...
   ]
   ```

3. **Verify permissions in app.json**:
   Ensure that the iOS infoPlist section contains:
   ```json
   "infoPlist": {
     "NSCameraUsageDescription": "This app uses the camera to allow you to share photos in your conversations.",
     // other permissions...
   }
   ```

4. **Install a specific version compatible with your Expo SDK**:
   ```bash
   npm install expo-camera@~16.0.0 --legacy-peer-deps
   ```

### React Native Version Conflicts

If you encounter React Native version conflicts:

1. **Check your package.json for React and React Native versions**:
   ```bash
   cat package.json | grep "react\\|react-native"
   ```

2. **Reset your node_modules directory**:
   ```bash
   rm -rf node_modules
   npm install --legacy-peer-deps
   ```

3. **Use Expo Doctor to check for issues**:
   ```bash
   npx expo-doctor
   ```

## EAS Build Failures

### CLI Version Warnings

If you see warnings about EAS CLI versions:

1. **Update eas.json to specify the exact version**:
   ```json
   "cli": {
     "version": "16.3.3",
     "appVersionSource": "remote"
   }
   ```

2. **Install the specified EAS CLI version globally**:
   ```bash
   npm install -g eas-cli@16.3.3
   ```

### Build Process Errors

If the build process fails:

1. **Check build logs for specific errors**:
   ```bash
   npx eas build:logs
   ```

2. **Use verbose mode for more detailed output**:
   ```bash
   npx eas build --platform ios --profile production --verbose
   ```

3. **Clear EAS credentials cache**:
   ```bash
   npx eas credentials clear
   ```

4. **Check Expo's status page** for service issues:
   https://status.expo.dev/

## App Store Connect Submission Issues

### App Review Rejections

Common reasons for rejection and their solutions:

1. **Missing Privacy Policy URL**:
   - Add a privacy policy URL in App Store Connect
   - Ensure your privacy policy covers all data collection points

2. **Incomplete Permissions Descriptions**:
   - Ensure all permission usage descriptions are detailed and specific
   - Update the infoPlist section in app.json

3. **App Crashes or Freezes**:
   - Test thoroughly on real devices before submission
   - Use TestFlight to get feedback from testers

### Certificate and Provisioning Profile Issues

If you have issues with certificates:

1. **Let EAS handle credentials automatically**:
   ```bash
   npx eas credentials --platform ios
   ```

2. **Clear existing credentials**:
   ```bash
   npx eas credentials --platform ios --clear
   ```

3. **Generate new credentials in the Apple Developer Portal** and configure EAS to use them:
   ```bash
   npx eas credentials --platform ios --select
   ```

## iOS Simulator Testing Issues

If you're having trouble with iOS simulator builds:

1. **Clear Metro cache**:
   ```bash
   npx react-native start --reset-cache
   ```

2. **Rebuild the app with the development profile**:
   ```bash
   npx eas build --platform ios --profile development
   ```

3. **Install the build on the simulator**:
   ```bash
   npx eas build:run --platform ios
   ```

## Production Deployment Checklist

Before submitting to the App Store:

1. **Verify API endpoints** are set to production URLs
2. **Test push notifications** on real devices
3. **Check app performance** on older device models
4. **Review all App Store Connect metadata**:
   - Screenshots
   - App description
   - Keywords
   - Privacy policy
5. **Complete App Privacy questionnaire** in App Store Connect
6. **Test in-app purchases** if applicable

## Getting Help

If you continue to experience issues:

1. **Check Expo documentation**: https://docs.expo.dev/
2. **Search for solutions on the Expo forums**: https://forums.expo.dev/
3. **Review React Native issues on GitHub**: https://github.com/facebook/react-native/issues
4. **Contact Apple Developer Support** for App Store Connect issues: https://developer.apple.com/contact/