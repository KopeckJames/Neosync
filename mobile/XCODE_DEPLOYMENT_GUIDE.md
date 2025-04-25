# Xcode Deployment Guide for NeoSync

This guide explains how to transition from Expo managed workflow to using Xcode directly for building and deploying the NeoSync iOS app.

## Step 1: Eject from Expo Managed Workflow

To use Xcode directly, we need to eject from the Expo managed workflow to a bare React Native project:

```bash
cd mobile
npx expo prebuild --platform ios
```

This will create an `ios` directory with all the native iOS code and Xcode project files.

## Step 2: Install CocoaPods Dependencies

After ejecting, you'll need to install the native dependencies using CocoaPods:

```bash
cd ios
pod install
```

## Step 3: Open the Project in Xcode

The ejection process creates an Xcode workspace file that you can open:

```bash
open NeoSync.xcworkspace
```

## Step 4: Configure the Xcode Project

1. **Set up signing & capabilities**:
   - Open Xcode and select your project in the Project Navigator
   - Select the "NeoSync" target
   - Go to the "Signing & Capabilities" tab
   - Sign in with your Apple Developer account
   - Select your Team (R7UQ8J92N9)
   - Make sure the Bundle Identifier matches (app.neosync.messenger)

2. **Configure app settings**:
   - Update display name, version, and build number if needed
   - Configure background modes for push notifications and VoIP
   - Set up app permissions for camera, photos, microphone

## Step 5: Build and Run

1. **Select a device or simulator**:
   - Choose an iOS device or simulator from the dropdown near the top of Xcode

2. **Build and run**:
   - Click the play button to build and run the app
   - Debug any build issues that occur during the native build process

## Step 6: Archive for Distribution

When you're ready to distribute your app:

1. **Create an archive**:
   - Select "Generic iOS Device" as the build target
   - Select Product > Archive from the menu

2. **Distribute via TestFlight**:
   - Once the archive is complete, the Organizer window will appear
   - Select your archive and click "Distribute App"
   - Choose "App Store Connect" as the distribution method
   - Follow the prompts to upload to TestFlight

3. **App Store submission**:
   - Once in TestFlight, test thoroughly
   - When ready, submit for App Store review from App Store Connect

## Additional Xcode Tips

### Managing Certificates and Provisioning

Xcode can manage certificates and provisioning profiles automatically:

1. In Xcode Preferences > Accounts, add your Apple ID
2. Click "Manage Certificates" to view and create signing certificates
3. Let Xcode handle provisioning profile creation when possible

### Debugging Native Code

With Xcode, you can now debug native iOS code:

1. Set breakpoints in Objective-C/Swift files
2. View native crash logs and detailed performance metrics
3. Use Instruments for advanced profiling

### Adding Native Libraries

You can now add iOS-specific libraries:

1. Add via CocoaPods by editing the Podfile
2. Add Swift packages via Xcode's Swift Package Manager
3. Directly integrate native frameworks

## Important Note on React Native Updates

After ejecting, React Native updates will need to be handled manually:

1. Update the React Native version in package.json
2. Run `pod install` in the ios directory to update native dependencies
3. Test thoroughly after each update

## Reverting to Expo

If you need to return to the Expo managed workflow:

1. Back up any native code changes you've made
2. Delete the ios and android directories
3. Reset your app.json and package.json files
4. Reinstall dependencies with `npm install`