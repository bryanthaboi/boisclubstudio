# BCS Analytics Server

Local Electron application that receives analytics data from the BCS Chrome Extension and serves a mobile-first PWA dashboard.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the application:
```bash
npm start
```

The server will run on `http://localhost:3000` and appear as a system tray icon.

## Features

- Receives analytics data from Chrome extension
- Serves mobile-first PWA dashboard
- System tray icon with connection status
- Single connection enforcement
- Heartbeat mechanism for connection tracking
- Browser notifications for metric changes

## Usage

1. Start the Electron app
2. Open the Chrome extension on YouTube Studio analytics page
3. Enable "Electron Backend" toggle in the analytics dashboard
4. Access the mobile dashboard at `http://localhost:3000` on your mobile device (same network)
5. Install as PWA on mobile device for easy access

## Configuration

The Chrome extension connects to `http://localhost:3000` by default. This can be changed in the extension settings.

