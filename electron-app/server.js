const express = require('express');
const path = require('path');

const app = express();
let latestData = null;
let connectionId = null;
let lastHeartbeat = null;
let pendingNotifications = [];

// Disable CORS (as per plan)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

app.use(express.json());

// Serve static files with no-cache headers for development
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, path) => {
        // Disable caching for HTML, CSS, and JS files
        if (path.endsWith('.html') || path.endsWith('.css') || path.endsWith('.js')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

// Connection management
const HEARTBEAT_TIMEOUT = 60000; // 60 seconds
const HEARTBEAT_INTERVAL = 30000; // 30 seconds

function checkConnection() {
    if (connectionId && lastHeartbeat) {
        const timeSinceHeartbeat = Date.now() - lastHeartbeat;
        if (timeSinceHeartbeat > HEARTBEAT_TIMEOUT) {
            // Connection lost
            connectionId = null;
            lastHeartbeat = null;
            console.log('Connection lost - heartbeat timeout');
        }
    }
}

// Check connection status every 10 seconds
setInterval(checkConnection, 10000);

// API Endpoints

// GET /api/status - Connection status and latest data
app.get('/api/status', (req, res) => {
    const isConnected = connectionId !== null && (Date.now() - lastHeartbeat) < HEARTBEAT_TIMEOUT;

    res.json({
        connected: isConnected,
        connectionId: connectionId,
        lastHeartbeat: lastHeartbeat,
        data: latestData,
        notifications: pendingNotifications
    });
});

// POST /api/data - Receive analytics data from extension
app.post('/api/data', (req, res) => {
    const { connectionId: newConnectionId, data, notifications } = req.body;

    // Handle connection establishment
    if (newConnectionId) {
        if (connectionId && connectionId !== newConnectionId) {
            // Another connection is trying to connect
            return res.status(409).json({
                error: 'Another connection is already active',
                currentConnectionId: connectionId
            });
        }

        // Accept new connection or update existing
        connectionId = newConnectionId;
        lastHeartbeat = Date.now();
    } else if (connectionId) {
        // Update heartbeat for existing connection
        lastHeartbeat = Date.now();
    } else {
        // No connection established
        return res.status(401).json({ error: 'No active connection' });
    }

    // Store latest data
    if (data) {
        latestData = {
            ...data,
            receivedAt: Date.now()
        };
    }

    // Store notifications
    if (notifications && Array.isArray(notifications)) {
        pendingNotifications = [...pendingNotifications, ...notifications];
        // Keep only last 50 notifications
        if (pendingNotifications.length > 50) {
            pendingNotifications = pendingNotifications.slice(-50);
        }
    }

    res.json({
        success: true,
        connectionId: connectionId,
        timestamp: Date.now()
    });
});

// POST /api/heartbeat - Heartbeat from extension
app.post('/api/heartbeat', (req, res) => {
    const { connectionId: clientConnectionId } = req.body;

    if (!clientConnectionId) {
        return res.status(400).json({ error: 'Connection ID required' });
    }

    if (connectionId && connectionId !== clientConnectionId) {
        return res.status(409).json({
            error: 'Connection ID mismatch',
            currentConnectionId: connectionId
        });
    }

    if (!connectionId) {
        // First heartbeat establishes connection
        connectionId = clientConnectionId;
    }

    lastHeartbeat = Date.now();
    res.json({
        success: true,
        connectionId: connectionId,
        timestamp: Date.now()
    });
});

// GET /api/notifications - Get pending notifications
app.get('/api/notifications', (req, res) => {
    const notifications = [...pendingNotifications];
    // Clear notifications after reading (optional - you might want to keep them)
    // pendingNotifications = [];
    res.json({ notifications });
});

// Clear notifications endpoint
app.post('/api/notifications/clear', (req, res) => {
    pendingNotifications = [];
    res.json({ success: true });
});

// GET / - Serve dashboard HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function getConnectionStatus() {
    if (!connectionId) {
        return 'Not Connected';
    }

    const timeSinceHeartbeat = Date.now() - lastHeartbeat;
    if (timeSinceHeartbeat > HEARTBEAT_TIMEOUT) {
        return 'Disconnected';
    }

    return `Connected (${Math.floor(timeSinceHeartbeat / 1000)}s ago)`;
}

function start(port, callback) {
    const server = app.listen(port, '0.0.0.0', () => {
        console.log(`BCS Analytics Server running on http://0.0.0.0:${port}`);
        if (callback) callback();
    });

    return server;
}

module.exports = {
    start,
    getConnectionStatus
};

