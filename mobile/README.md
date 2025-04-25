# NeoSync Mobile App

This is the React Native-based iOS application for NeoSync, a quantum-secure messaging platform.

## Features

- End-to-end encrypted messaging
- Secure authentication
- Real-time updates via WebSockets
- Media sharing
- Profile management
- Dark mode UI

## Getting Started

### Prerequisites

- Node.js v16+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS device or simulator

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   cd mobile
   npm install
   ```

3. Start the development server:
   ```
   npm start
   ```

4. Open the app in Expo Go:
   - Scan the QR code with your iOS device camera
   - Or press 'i' in the terminal to open in iOS simulator

## Development

### Project Structure

```
mobile/
├── assets/           # App icons, splash screens
├── src/
│   ├── components/   # Reusable UI components
│   ├── contexts/     # React contexts (e.g., AuthContext)
│   ├── hooks/        # Custom React hooks
│   ├── navigation/   # Navigation configuration
│   ├── screens/      # App screens
│   ├── services/     # API services and utilities
│   ├── types/        # TypeScript types
│   └── config.ts     # App configuration
├── app.json         # Expo configuration
├── package.json     # Dependencies and scripts
└── tsconfig.json    # TypeScript configuration
```

### API Integration

The mobile app communicates with the NeoSync backend API. The API base URL is configured in `src/config.ts` and will automatically switch between development and production URLs based on the build environment.

### Authentication

Authentication is handled via tokens, which are securely stored using AsyncStorage. The `AuthContext` provides login, registration, and user state management throughout the app.

## Building for Production

See the `IOS_DEPLOYMENT_GUIDE.md` file for detailed instructions on:

1. Testing with Expo Go
2. Building for TestFlight
3. Submitting to the App Store

## Contributing

1. Create a feature branch (`git checkout -b feature/amazing-feature`)
2. Commit your changes (`git commit -m 'Add some amazing feature'`)
3. Push to the branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request