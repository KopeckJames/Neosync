# TestFlight Deployment Steps

This guide provides the exact steps needed to deploy the NeoSync app to TestFlight for testing.

## Prerequisites

You have:
- An Apple Developer account
- App created in App Store Connect (App ID: 6745059307)
- Apple Team ID (R7UQ8J92N9)

## Step 1: Install Dependencies

```bash
cd mobile
npm install --legacy-peer-deps
```

## Step 2: Create an EAS Build

For first-time EAS users:

```bash
npx eas login
```

Then initialize your project (this should be skipped if you've already configured it):

```bash
npx eas build:configure
```

## Step 3: Run the Build for TestFlight

Use the "preview" profile which is configured for internal testing:

```bash
npx eas build --platform ios --profile preview
```

This will:
1. Create a build on EAS servers
2. Generate all required iOS build files
3. Sign the app with your credentials
4. Output a link to monitor the build progress

## Step 4: Submit to TestFlight

After the build completes successfully, submit it to TestFlight:

```bash
npx eas submit --platform ios --profile preview
```

## Step 5: Invite Testers

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Select your app
3. Go to the "TestFlight" tab
4. Add testers:
   - Internal testers (limited to people in your team)
   - External testers (up to 10,000 people with email invitations)

## Troubleshooting Common Issues

### Build Fails with Dependency Issues
Try reinstalling with legacy peer dependencies:
```
npm install --legacy-peer-deps
```

### Certificate or Provisioning Profile Errors
Let EAS handle the credentials:
```
npx eas credentials --platform ios
```

### App Store Connect API Key Issues
If you encounter authentication issues, try:
```
npx eas credentials --platform ios --clear
```

### Testing Backend Connectivity
Ensure your app is configured to connect to the correct backend:
- For testing: Edit `src/config.ts` to point to your development or staging server
- For production: Update to your production server URL

## Updating the App

To submit an updated version:

1. Increment version number in app.json:
   ```json
   "version": "1.0.1"
   ```

2. Run the build and submit again:
   ```bash
   npx eas build --platform ios --profile preview
   npx eas submit --platform ios --profile preview
   ```

The updated version will appear in TestFlight shortly after approval.