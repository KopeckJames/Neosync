# NeoSync

A secure, end-to-end encrypted messaging application with a modern UI.

## Features

- **End-to-End Encryption**: All messages are secured with libsodium-wrappers encryption
- **Real-time Messaging**: WebSocket-based communication for instant message delivery
- **User Authentication**: Secure login and registration system
- **Message Status**: Read receipts and online status indicators
- **Responsive Design**: Works well on desktop and mobile devices

## Tech Stack

- **Frontend**: React, TypeScript, TailwindCSS, shadcn/ui
- **Backend**: Node.js, Express
- **Database**: In-memory storage (can be extended to PostgreSQL)
- **Communication**: WebSockets for real-time updates
- **Encryption**: libsodium-wrappers

## Getting Started

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

## Development

This project uses:
- React with TypeScript for the frontend
- Express for the backend
- TanStack Query for data fetching
- shadcn/ui components with TailwindCSS for styling
- End-to-end encryption using libsodium-wrappers

## License

MIT