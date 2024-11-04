// main.js
const { app, BrowserWindow } = require('electron');
const path = require('path');



function createWindow() {
  const mainWindow = new BrowserWindow({
    autoHideMenuBar: true,
    width: 1200,
    height: 800,
    center: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // 필요하면 추가
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'resources', 'index.html'));
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
