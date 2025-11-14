const { app, BrowserWindow, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const server = require('./server');

let tray = null;
let serverInstance = null;
const PORT = 6767;

// Create tray icon
function createTray() {
    const iconPath = path.join(__dirname, 'tray-icon.png');
    const trayIcon = nativeImage.createFromPath(iconPath);
    tray = new Tray(trayIcon);

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Open Dashboard',
            click: () => {
                require('electron').shell.openExternal(`http://0.0.0.0:${PORT}`);
            }
        },
        {
            label: 'Connection Status',
            id: 'connection-status',
            enabled: false
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(contextMenu);
    tray.setToolTip('BCS Analytics Server');

    // Update connection status periodically
    setInterval(() => {
        updateConnectionStatus();
    }, 2000);
}

function updateConnectionStatus() {
    if (!tray) return;

    const status = server.getConnectionStatus();
    const menu = Menu.buildFromTemplate([
        {
            label: 'Open Dashboard',
            click: () => {
                require('electron').shell.openExternal(`http://0.0.0.0:${PORT}`);
            }
        },
        {
            label: `Status: ${status}`,
            id: 'connection-status',
            enabled: false
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(menu);

    // Update tooltip
    tray.setToolTip(`BCS Analytics Server - ${status}`);
}

app.whenReady().then(() => {
    // Start Express server
    serverInstance = server.start(PORT, () => {
        console.log(`Server started on http://0.0.0.0:${PORT}`);
    });

    // Create tray icon
    createTray();

    // Prevent app from showing in dock (macOS) or taskbar (Windows)
    if (process.platform === 'darwin') {
        app.dock.hide();
    }
});

app.on('window-all-closed', (e) => {
    // Don't quit when windows are closed, keep running in tray
    e.preventDefault();
});

app.on('before-quit', () => {
    // Clean up server
    if (serverInstance && serverInstance.close) {
        serverInstance.close();
    }
});

