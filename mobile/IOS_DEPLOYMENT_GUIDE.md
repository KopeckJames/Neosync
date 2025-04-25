# NeoSync iOS Deployment Guide

This guide provides instructions for deploying and testing the NeoSync iOS application.

## Prerequisites

1. An Apple Developer Account ($99/year)
2. Xcode installed on a Mac
3. Node.js and npm installed
4. Expo CLI installed (`npm install -g expo-cli`)
5. EAS CLI installed (`npm install -g eas-cli`)

## Option 1: Testing with Expo Go (Quick & Easy)

This approach lets you test the app on your device without going through the App Store review process.

1. **Install Expo Go app on your iOS device**
   - Download from the [App Store](https://apps.apple.com/us/app/expo-go/id982107779)

2. **Start the development server**
   ```bash
   cd mobile
   npm start
   ```

3. **Scan the QR code** with your iPhone camera
   - The app will open in Expo Go

4. **Connect to your backend**
   - Make sure your backend is running and accessible from your device
   - If testing locally, the backend should be on the same network as your device
   - For remote testing, deploy your backend to a public URL

## Option 2: Building for TestFlight

This approach creates a real iOS app that can be distributed through TestFlight.

1. **Log in to EAS**
   ```bash
   eas login
   ```

2. **Configure your project**
   - Update the `app.json` file with your app details:
     - `bundleIdentifier`: should be unique (e.g., com.yourcompany.neosync)
     - Update the permissions as needed

3. **Update the eas.json file**
   - Replace placeholder values:
     - `YOUR_APPLE_ID_EMAIL`: Your Apple Developer account email
     - `YOUR_APP_STORE_CONNECT_APP_ID`: The App ID from App Store Connect
     - `YOUR_APPLE_TEAM_ID`: Your Team ID from the Apple Developer portal

4. **Register your app on Apple Developer Portal and App Store Connect**
   - Create a new app entry in App Store Connect
   - Note the App ID for use in `eas.json`

5. **Build for iOS**
   ```bash
   cd mobile
   npm run build:ios
   ```
   This will start a build process in the EAS cloud

6. **Submit to TestFlight**
   ```bash
   npm run submit:ios
   ```

7. **Invite Testers**
   - Go to App Store Connect > Your App > TestFlight
   - Add internal or external testers
   - Testers will receive an email invitation to test your app

## Configuration Notes

### Backend URL Configuration

The app is configured to automatically detect if it's running in development or production:

- In development, it connects to your local server
- In production, it connects to your production server

To update the API URLs, edit `mobile/src/config.ts`:

```typescript
export const API_URL = __DEV__ 
  ? 'http://192.168.1.x:5000' // Your local IP address
  : 'https://your-production-server.com';

export const WS_URL = __DEV__
  ? 'ws://192.168.1.x:5000/ws'
  : 'wss://your-production-server.com/ws';
```

### App Store Submission Requirements

For a successful App Store submission, you'll need:

1. Privacy Policy URL
2. App Icon (1024x1024 PNG)
3. App Screenshots (for various iOS devices)
4. App Description and Keywords
5. Support URL
6. Marketing URL (optional)

## Troubleshooting

- **Build Errors**: Check the EAS build logs for details
- **TestFlight Rejections**: Common reasons include missing privacy policy, improper permissions, or crashes
- **Connection Issues**: Ensure backend URLs are correctly configured and accessible
- **Local Testing**: Make sure your device and development machine are on the same network

## Additional Resources

- [Expo Documentation](https://docs.expo.dev/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [TestFlight Documentation](https://developer.apple.com/testflight/)
- [App Store Guidelines](https://developer.apple.com/app-store/review/guidelines/)