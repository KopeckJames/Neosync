// Configuration file for the mobile app

// Base API URL - this will be different in development vs production
// For development on physical devices, you would use your computer's local IP
// For development on simulators, you would use localhost
// For production, you would use your deployed server's URL
export const API_URL = __DEV__ 
  ? 'http://localhost:5000'  // Development - simulator
  // ? 'http://192.168.1.x:5000'  // Development - physical device (update with your IP)
  : 'https://neosync-api.replit.app';  // Production URL

// WebSocket URL for real-time communication
export const WS_URL = __DEV__
  ? 'ws://localhost:5000/ws'  // Development - simulator
  // ? 'ws://192.168.1.x:5000/ws'  // Development - physical device (update with your IP)
  : 'wss://neosync-api.replit.app/ws';  // Production URL