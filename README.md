# NeoSync

A secure, end-to-end encrypted messaging application with a modern UI, available for both web and iOS.

## Features

- **End-to-End Encryption**: All messages are secured with quantum-secure encryption technology
- **Real-time Messaging**: WebSocket-based communication for instant message delivery
- **User Authentication**: Secure login and registration system
- **Message Status**: Read receipts and online status indicators
- **Responsive Design**: Works well on desktop and mobile devices
- **Cross-Platform**: Available as a web app and iOS app with the same secure core

## Tech Stack

- **Frontend**: React, TypeScript, TailwindCSS, shadcn/ui
- **Backend**: Node.js, Express
- **Database**: In-memory storage (can be extended to PostgreSQL)
- **Communication**: WebSockets for real-time updates
- **Encryption**: libsodium-wrappers
- **Mobile**: React Native, Expo

## Getting Started

### Web App

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/neosync.git
   cd neosync
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```

4. Open [http://localhost:5000](http://localhost:5000) to view the app in your browser.

### iOS App

1. Navigate to the mobile directory:
   ```
   cd mobile
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the Expo development server:
   ```
   npm start
   ```

4. Follow the instructions to open the app in Expo Go on your iOS device

For building and deploying to TestFlight or the App Store, see the [iOS Deployment Guide](mobile/IOS_DEPLOYMENT_GUIDE.md).

## Development

This project uses:
- React with TypeScript for the web frontend
- React Native with Expo for the iOS app
- Express for the backend
- TanStack Query for data fetching
- shadcn/ui components with TailwindCSS for styling
- End-to-end encryption using libsodium-wrappers
- Cross-platform authentication using both sessions and tokens

## License

MIT