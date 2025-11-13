# 🎬 Better YouTube Studio aka Boi's Club Studio
![Bois Club Studio Logo](/logo.png)
> **Transform your YouTube Studio experience** with a beautiful, modern analytics dashboard that reveals metrics YouTube collects but never shows you.

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-brightgreen.svg)](#-installation)
[![Electron App](https://img.shields.io/badge/Electron-App-blue.svg)](#-installation)
[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)

> **Version 1.0** - Initial release with all core features!

---

## ✨ Features

### 🎨 **Modern, Apple Glass-like Design**
Experience a beautifully redesigned YouTube Studio interface with:
- **Glassmorphism effects** - Frosted glass panels with subtle transparency
- **Smooth animations** - Fluid transitions and micro-interactions
- **Modern typography** - Clean, readable fonts with perfect spacing
- **Elegant color palette** - Carefully crafted gradients and shadows
- **Responsive layouts** - Adapts beautifully to any screen size

![UI Update Overview Gif](/uiupdates2.gif)

### 📊 **Live Analytics Dashboard**
Get real-time insights that YouTube Studio doesn't provide:

#### **Enhanced Metrics**
- **48-Hour View Trends** - See view patterns over the last 48 hours with interactive sparklines
- **60-Minute View Trends** - Real-time hourly view tracking with visual graphs
- **Total Estimated Revenue** - Aggregate revenue across all videos
- **Subscriber Net Change** - Track subscriber gains/losses per video
- **Watch Time Analytics** - Detailed watch time metrics per video
- **CTR (Click-Through Rate)** - See which thumbnails are performing best
- **Hot Streak Detection** - Visual badges when videos are trending (configurable thresholds)

#### **Smart Visualizations**
- **Interactive Sparklines** - Beautiful SVG graphs showing view trends
- **Glow Effects** - Sparklines pulse with a glow when view counts increase rapidly
- **Animated Badges** - Rotating radial borders on hot streak indicators
- **Real-time Updates** - Metrics refresh automatically as new data arrives

![Toast Notifications on Dashboard](/notification.gif)

### 🚀 **Quick Access Menu**
Navigate YouTube Studio faster with the convenient top menu:
- **Scheduled Posts** - Quick access to your scheduled content
- **Scheduled Shorts** - Separate view for scheduled short-form content
- **Public Posts** - View all published content
- **Public Shorts** - Browse your published shorts
- **Analytics** - Direct link to the enhanced analytics dashboard

![Quick Access Menu](/quickbar.gif)

### ⚙️ **Comprehensive Settings Panel**
Full control over your dashboard experience:

#### **Badge Visibility**
- Toggle likes, comments, and dislikes badges on/off
- Customize which metrics are visible at a glance

#### **Top Panel Controls**
- Show/hide revenue banner
- Control subscriber count display
- Manage other top-level metrics

#### **Hidden Elements**
- Configure which YouTube Studio elements to hide
- Clean up the interface to focus on what matters

#### **Electron Backend Integration** (Optional)
- Enable/disable backend connection (completely optional - extension works without it!)
- Set custom URL/port for the Electron server
- Control auto-connect behavior

#### **Hot Streak Configuration**
- Adjust the number of increases required (default: 5)
- Set the time window in minutes (default: 5 minutes)
- Fine-tune when hot streak badges appear


### 📱 **Electron Backend & Mobile Access** ⚠️ **OPTIONAL**

> **This feature is completely optional!** The main Chrome extension works great on its own. This is for analytics addicts who want to check their stats on their phone or access them remotely.

Access your analytics from anywhere (if you're an analytics addict like me):

- **Local Web Server** - Electron app serves a beautiful web dashboard
- **Mobile-Friendly** - Responsive design works perfectly on phones and tablets
- **Remote Access** - Open the port on your router to access from anywhere
- **Real-time Sync** - Live data updates as long as YouTube Studio is open
- **Connection Status** - Visual indicators show backend connection state
- **Auto-reconnect** - Automatically reconnects if connection is lost


### 🔔 **Smart Notifications**
- **Metric Change Alerts** - Get notified when likes, comments, or views spike
- **Toast Notifications** - Non-intrusive popups for important updates
- **Hot Streak Alerts** - Know immediately when a video starts trending

### 🛡️ **Auto-Refresh & Error Handling**
- **Smart Error Detection** - Automatically refreshes if YouTube Studio encounters errors
- **Seamless Recovery** - Handles network issues gracefully
- **Persistent State** - Settings and preferences survive page reloads

---

## 📦 Installation

### Chrome Extension

#### Step-by-Step Installation Guide

1. **Download the Latest Release**
   - Go to [Releases](https://github.com/bryanthaboi/boisclubstudio/releases)
   - Download `studio-quick-panel-extension.zip`
   - Extract the ZIP file to a folder on your computer (remember where you put it!)

2. **Open Chrome Extensions Page**
   - Open Google Chrome
   - In the address bar, type: `chrome://extensions/` and press Enter
   - Or: Click the three dots menu (⋮) → More tools → Extensions

3. **Enable Developer Mode**
   - Look for a toggle switch labeled "Developer mode" in the top-right corner
   - Click it to turn it ON (it should turn blue/highlighted)

4. **Load the Extension**
   - Click the "Load unpacked" button that appears at the top-left
   - A file browser window will open
   - Navigate to the folder where you extracted the ZIP file
   - Select the folder (make sure you select the folder itself, not a file inside it)
   - Click "Select Folder" (or "Open" on Mac)

5. **Verify Installation**
   - You should see "Better YouTube Studio aka Boi's Club Studio" appear in your extensions list
   - Make sure it's enabled (toggle switch should be ON/blue)
   - Navigate to [YouTube Studio](https://studio.youtube.com)
   - You should see the quick menu at the top of the page
   - Open the Analytics page to see the enhanced dashboard

#### Troubleshooting Installation
- **"Load unpacked" button not showing?** Make sure Developer mode is enabled
- **Extension not appearing?** Check that you selected the folder containing `manifest.json`, not a subfolder
- **Getting errors?** Make sure you downloaded the complete extension (all files should be in the folder)

### Electron Backend App ⚠️ **OPTIONAL - For Analytics Addicts Only!**

> **This is completely optional!** The Chrome extension works perfectly fine on its own. The Electron backend is only for people who want to:
> - View their analytics dashboard on mobile devices
> - Access their dashboard remotely (via port forwarding)
> - Have a dedicated local server running their analytics
>
> **If you just want the enhanced YouTube Studio experience, you can skip this entirely!**

#### Prerequisites
- **Node.js** (v16 or higher)
- **npm** (comes with Node.js)

#### Installation Steps

1. **Download the Latest Release**
   - Go to [Releases](https://github.com/bryanthaboi/boisclubstudio/releases)
   - Download the appropriate build for your OS:
     - Windows: `bcs-analytics-server-win-x64.exe`
     - macOS: `bcs-analytics-server-darwin-x64.dmg` or `.zip` *(Unsigned build - see note below)*
     - Linux: `bcs-analytics-server-linux-x64.AppImage` or `.tar.gz`
   
   **Note about Mac builds**: I build unsigned Mac apps (no Apple Developer certificate required). macOS will show a security warning the first time you open it. This is normal and safe - just right-click the app and select "Open", then click "Open" in the security dialog. Alternatively, go to System Preferences → Security & Privacy → General and click "Open Anyway".

2. **Run the Application**
   - **Windows**: Double-click the `.exe` file
   - **macOS**: 
     - For `.dmg`: Double-click to mount, then drag the app to Applications
     - For `.zip`: Extract and double-click the app
     - **First time only**: Right-click the app → "Open" → Click "Open" in the security dialog (unsigned app warning)
   - **Linux**: Make executable (`chmod +x`) and run, or extract and run

3. **Access the Dashboard**
   - The app will open a local web server (default: `http://localhost:6767`)
   - Open this URL in your browser
   - The dashboard will show "Not Connected" until the Chrome extension connects

4. **Connect the Extension**
   - Open YouTube Studio Analytics page
   - Click the Electron backend button in the dashboard
   - Or enable auto-connect in settings

#### Manual Installation (Development)

**Note**: Building Mac apps requires no special certificates for unsigned builds (which is what I do). Signed builds would require an Apple Developer account ($99/year), but unsigned builds work fine - they just show a security warning the first time. (I actually have a developer account but don't feel like getting it all set up on this repo).

If you prefer to build from source:

```bash
# Clone the repository
git clone https://github.com/bryanthaboi/boisclubstudio.git
cd boisclubstudio/electron-app

# Install dependencies
npm install

# Run the app
npm start
```

#### Remote Access Setup

To access your dashboard from other devices:

1. **Find Your Local IP**
   - Windows: Run `ipconfig` in Command Prompt
   - macOS/Linux: Run `ifconfig` in Terminal
   - Look for your local IP (e.g., `192.168.1.100`)

2. **Configure Router Port Forwarding**
   - Open your router's admin panel
   - Forward port `6767` (or your custom port) to your computer's local IP
   - Note: This exposes your dashboard to the internet - use with caution

3. **Update Extension Settings**
   - Open the settings panel in YouTube Studio
   - Set the Electron backend URL to: `http://YOUR_PUBLIC_IP:6767`
   - Or use a dynamic DNS service for a friendly URL

4. **Access Remotely**
   - From any device, navigate to `http://YOUR_PUBLIC_IP:6767`
   - The dashboard will work as long as YouTube Studio is open on your computer

---

## 🔌 Backend API Documentation

If you want to build your own server to ingest the analytics data, here's everything you need:

### API Endpoints

#### `GET /api/status`
Get the current connection status and latest data.

**Response:**
```json
{
  "connected": true,
  "connectionId": "unique-connection-id",
  "lastHeartbeat": 1234567890123,
  "data": {
    // See Data Structure below
  },
  "notifications": [
    // Array of notification objects
  ]
}
```

#### `POST /api/data`
Receive analytics data from the Chrome extension.

**Request Body:**
```json
{
  "connectionId": "unique-connection-id",
  "data": {
    // See Data Structure below
  },
  "notifications": [
    // Array of notification objects (optional)
  ]
}
```

**Response:**
```json
{
  "success": true,
  "connectionId": "unique-connection-id",
  "timestamp": 1234567890123
}
```

**Status Codes:**
- `200` - Success
- `400` - Bad request
- `401` - No active connection
- `409` - Another connection is already active

#### `POST /api/heartbeat`
Keep the connection alive. Should be called every 30 seconds.

**Request Body:**
```json
{
  "connectionId": "unique-connection-id"
}
```

**Response:**
```json
{
  "success": true,
  "connectionId": "unique-connection-id",
  "timestamp": 1234567890123
}
```

#### `GET /api/notifications`
Get pending notifications.

**Response:**
```json
{
  "notifications": [
    {
      "videoId": "dQw4w9WgXcQ",
      "title": "Video Title",
      "thumbnailUrl": "https://...",
      "type": "likes",
      "newCount": 150,
      "oldCount": 100
    }
  ]
}
```

#### `POST /api/notifications/clear`
Clear all pending notifications.

**Response:**
```json
{
  "success": true
}
```

### Data Structure

The main data payload sent to `/api/data` has the following structure:

```typescript
interface AnalyticsData {
  timestamp: number;                    // Unix timestamp in milliseconds
  subscriberCount: number | null;      // Total subscriber count
  subscriberHistory: Array<{            // Historical subscriber data
    timestamp: number;
    count: number;
  }>;
  totalWatchTime: number | null;        // Total watch time in seconds
  totalLikes: number;                   // Sum of all video likes
  totalComments: number;                // Sum of all video comments
  videos: Array<VideoData>;             // Array of video analytics
}

interface VideoData {
  videoId: string;                      // YouTube video ID
  title: string;                        // Video title
  thumbnailUrl: string;                  // Thumbnail image URL
  publishDate: string;                  // Formatted publish date
  views48h: number;                     // Views in last 48 hours
  views60m: number;                     // Views in last 60 minutes
  sparkline48h: Array<number> | null;   // 48h view data points for sparkline
  sparkline60m: Array<number> | null;   // 60m view data points for sparkline
  likeCount: number;                    // Total likes
  commentCount: number;                  // Total comments
  dislikeCount: number;                 // Total dislikes
  viewCount: number;                    // Total views
  earnings: number | null;              // Estimated earnings (if available)
  subscriberNetChange: number | null;   // Net subscriber change from this video
  watchTime: number | null;             // Watch time in seconds
  ctr: number | null;                   // Click-through rate (0-1)
}

interface Notification {
  videoId: string;                     // YouTube video ID
  title: string;                        // Video title
  thumbnailUrl: string | null;          // Thumbnail URL
  type: 'likes' | 'comments' | 'dislikes' | 'views';
  newCount: number;                     // New metric value
  oldCount: number;                     // Previous metric value
}
```

### Connection Management

- **Connection ID**: A unique identifier generated by the extension (UUID format)
- **Heartbeat Timeout**: 60 seconds - if no heartbeat is received, connection is considered lost
- **Heartbeat Interval**: Extension sends heartbeat every 30 seconds
- **Single Connection**: Only one active connection is allowed at a time (409 error if another tries to connect)

### Example Server Implementation

Here's a minimal Express.js server that accepts the data:

```javascript
const express = require('express');
const app = express();

app.use(express.json());

let latestData = null;
let connectionId = null;
let lastHeartbeat = null;

// POST /api/data
app.post('/api/data', (req, res) => {
  const { connectionId: newConnectionId, data, notifications } = req.body;
  
  // Handle connection
  if (newConnectionId) {
    connectionId = newConnectionId;
    lastHeartbeat = Date.now();
  }
  
  // Store data
  if (data) {
    latestData = data;
    console.log('Received data:', data);
  }
  
  res.json({ success: true, connectionId, timestamp: Date.now() });
});

// POST /api/heartbeat
app.post('/api/heartbeat', (req, res) => {
  const { connectionId: clientId } = req.body;
  if (clientId === connectionId) {
    lastHeartbeat = Date.now();
  }
  res.json({ success: true, connectionId, timestamp: Date.now() });
});

// GET /api/status
app.get('/api/status', (req, res) => {
  const isConnected = connectionId !== null && 
    (Date.now() - lastHeartbeat) < 60000;
  
  res.json({
    connected: isConnected,
    connectionId,
    lastHeartbeat,
    data: latestData
  });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

---

## 🎯 Usage Tips

### Getting Started
1. Install the Chrome extension
2. Navigate to YouTube Studio Analytics
3. The enhanced dashboard will appear automatically
4. Use the quick menu at the top to navigate between sections

### Customizing Your Dashboard
1. Click the settings button (⚙️) in the top-right of YouTube Studio
2. Toggle badges, panels, and hidden elements to your preference
3. Configure hot streak detection thresholds
4. (Optional) Set up Electron backend if you want mobile/remote access to your analytics

### Mobile Access (Optional - For Analytics Addicts)
1. Install and run the Electron backend app (completely optional!)
2. Note the local IP address of your computer
3. Configure port forwarding on your router (optional, for remote access)
4. Update the backend URL in extension settings (default: `http://localhost:6767`)
5. Open the dashboard URL on your mobile device

### Hot Streak Detection
- Videos get a "hot streak" badge when metrics increase rapidly
- Default: 5 increases within 5 minutes
- Customize in settings to match your content's typical patterns
- Works for views, likes, comments, and subscriber changes

---

## 🐛 Troubleshooting

### Extension Not Appearing
- Make sure you're on `studio.youtube.com`
- Check that the extension is enabled in `chrome://extensions/`
- Try refreshing the page
- Check the browser console for errors (F12)

### Backend Not Connecting
- Verify the Electron app is running
- Check the URL/port in settings matches the app
- Ensure firewall isn't blocking the connection
- Try disabling and re-enabling the backend in settings

### Data Not Updating
- Make sure you're on the Analytics page in YouTube Studio
- Check that YouTube Studio is actively loading data
- The extension only works when YouTube Studio is making API calls
- Try refreshing the page

### Sparklines Not Showing
- Ensure you have view data for the time period
- Check that the video has been published for at least 48 hours (for 48h sparkline)
- Try toggling the settings to refresh the display

---

## 💡 Feature Requests & Feedback

We'd love to hear your ideas! Here are some ways to contribute:

### 🎥 **YouTube Video**
Have a suggestion or found a bug? Mention it in the comments of my [YouTube video](https://youtube.com/@bryanthaboi2) about this extension!

### 🐛 **GitHub Issues**
- **Found a bug?** [Open an issue](https://github.com/bryanthaboi/boisclubstudio/issues) with details
- **Styling issue?** [Report it here](https://github.com/bryanthaboi/boisclubstudio/issues)
- **Want a new feature?** [Suggest it](https://github.com/bryanthaboi/boisclubstudio/issues)
- **Want to hide more elements?** [Let me know](https://github.com/bryanthaboi/boisclubstudio/issues)

### 📊 **Analytics Ideas**
Have ideas for additional metrics or visualizations? I'm always looking to expand the dashboard:
- [Share your ideas!](https://github.com/bryanthaboi/boisclubstudio/issues)

### 📝 **Main Page Suggestions**
I'm considering adding a persistent notepad to the main page. What else would be useful?
- Quick action buttons?
- Recent activity feed?
- Custom widgets?
- [Tell me what you want!](https://github.com/bryanthaboi/boisclubstudio/issues)

### 🎨 **Custom Logo Upload**
Want to be able to upload your own logo for the top menu? I can add that feature! Just [open a GitHub issue](https://github.com/bryanthaboi/boisclubstudio/issues) and let me know you'd like this feature. If there's enough interest, I'll implement it! If you're savvy enough, you can just replace the logo in the svg folder after you download the extension.

### 💻 **For Developers**
If you're a developer and have a really cool feature idea, feel free to make a pull request! I'm more than happy to review it, and if I agree with it, I'll merge it in. 

---

## 🛠️ Development

### Project Structure
```
boisclubstudio/
├── content.js              # Main content script
├── inject.js               # Network request interceptor
├── manifest.json           # Extension manifest
├── data/
│   └── queries.json        # YouTube API query templates
├── styles/
│   └── main.css           # Main stylesheet
├── icons/                  # Extension icons
└── electron-app/           # Electron backend
    ├── main.js            # Electron main process
    ├── server.js          # Express server
    └── public/            # Web dashboard files
```

### Building from Source

#### Chrome Extension
No build step required - just load the directory in Chrome.

#### Electron App
```bash
cd electron-app
npm install
npm start  # Development
```

For production builds, use [electron-builder](https://www.electron.build/) or [electron-forge](https://www.electronforge.io/).

---

## 📄 License

ISC License - See [LICENSE](/LICENSE.md) file for details.

---

## 🔗 Links

- [Releases](https://github.com/bryanthaboi/boisclubstudio/releases)
- [Issues](https://github.com/bryanthaboi/boisclubstudio/issues)
- [YouTube Channel](https://youtube.com/@bryanthaboi2) - Where I posted the video for this extension
- [Main YouTube Channel](https://youtube.com/@bryanthaboi) - Where I post Dragon Ball content

