// Electron main process for the Rizvi Diagnostic Center desktop app.
const path = require('path');
const fs = require('fs');
const https = require('https');
const { spawn } = require('child_process');
const { app, BrowserWindow, Menu, dialog } = require('electron');

const BACKEND_ROOT = app.isPackaged
  ? path.join(__dirname, '..', '..', 'backend')
  : path.join(__dirname, '..', 'backend');

const GITHUB_OWNER = 'stalker-one';
const GITHUB_REPO = 'RizviDiagnostic';
const GITHUB_RELEASES_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const UPDATE_CHECK_INTERVAL = 4 * 60 * 60 * 1000;

let mainWindow = null;
let updateCheckTimer = null;
let updateInProgress = false;

function logToFile(line) {
  try {
    const logDir = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, 'main.log'), `[${new Date().toISOString()}] ${line}\n`);
  } catch (_) {}
}

function showFatalError(title, err) {
  const message = err && err.stack ? err.stack : String(err);
  logToFile(`FATAL: ${title} — ${message}`);
  dialog.showErrorBox(
    title,
    `${message}\n\nA full log has been saved to:\n${path.join(app.getPath('userData'), 'logs', 'main.log')}`
  );
}

function parseVersion(version) {
  const clean = String(version || '').trim().replace(/^v/i, '').split('-')[0];
  const parts = clean.split('.').map((part) => Number.parseInt(part, 10));
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

function compareVersions(a, b) {
  const av = parseVersion(a);
  const bv = parseVersion(b);
  for (let i = 0; i < 3; i += 1) {
    if (av[i] > bv[i]) return 1;
    if (av[i] < bv[i]) return -1;
  }
  return 0;
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Rizvi-Diagnostic-Center-Desktop',
      },
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`GitHub release check returned HTTP ${response.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(new Error(`Invalid GitHub release response: ${error.message}`));
        }
      });
    });
    request.setTimeout(20000, () => request.destroy(new Error('GitHub release check timed out')));
    request.on('error', reject);
  });
}

function downloadFile(url, destination, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error('Too many download redirects'));
      return;
    }

    const output = fs.createWriteStream(destination);
    const request = https.get(url, {
      headers: { 'User-Agent': 'Rizvi-Diagnostic-Center-Desktop' },
    }, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        output.close();
        try { fs.unlinkSync(destination); } catch (_) {}
        downloadFile(response.headers.location, destination, redirectCount + 1).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        output.close();
        try { fs.unlinkSync(destination); } catch (_) {}
        reject(new Error(`Installer download returned HTTP ${response.statusCode}`));
        return;
      }

      response.pipe(output);
      output.on('finish', () => {
        output.close(() => {
          try {
            if (fs.statSync(destination).size < 1024 * 100) {
              reject(new Error('Downloaded installer is unexpectedly small'));
            } else {
              resolve(destination);
            }
          } catch (error) {
            reject(error);
          }
        });
      });
    });

    request.setTimeout(10 * 60 * 1000, () => request.destroy(new Error('Installer download timed out')));
    request.on('error', (error) => {
      output.destroy();
      try { fs.unlinkSync(destination); } catch (_) {}
      reject(error);
    });
  });
}

function getWindowsInstallerAsset(release) {
  const assets = Array.isArray(release.assets) ? release.assets : [];
  return assets.find((asset) => /\.exe$/i.test(asset.name) && !/\.blockmap$/i.test(asset.name)) || null;
}

async function checkForLatestWindowsUpdate(showNoUpdate = false) {
  if (!app.isPackaged || updateInProgress) return;

  try {
    const currentVersion = app.getVersion();
    logToFile(`[update] Checking GitHub Releases. Installed=${currentVersion}`);
    const release = await requestJson(GITHUB_RELEASES_API);
    const latestVersion = String(release.tag_name || '').replace(/^v/i, '');

    if (!latestVersion) throw new Error('Latest GitHub release has no version tag');

    if (compareVersions(latestVersion, currentVersion) <= 0) {
      logToFile(`[update] No update. Installed=${currentVersion}, Latest=${latestVersion}`);
      if (showNoUpdate && mainWindow) {
        await dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Rizvi Diagnostic Center — Updates',
          message: 'You are using the latest version.',
          detail: `Installed version: v${currentVersion}\nLatest version: v${latestVersion}`,
          buttons: ['OK'],
        });
      }
      return;
    }

    const asset = getWindowsInstallerAsset(release);
    if (!asset || !asset.browser_download_url) {
      throw new Error(`Release v${latestVersion} has no Windows .exe installer asset.`);
    }

    const notes = String(release.body || '').trim();
    logToFile(`[update] New release found: v${latestVersion}, asset=${asset.name}`);

    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available — Rizvi Diagnostic Center',
      message: `A new version v${latestVersion} is available.`,
      detail: [
        `Current version: v${currentVersion}`,
        `Latest version: v${latestVersion}`,
        '',
        'Latest updates:',
        notes ? notes.slice(0, 5000) : 'Bug fixes, improvements and performance updates.',
        '',
        'Click Update Now to download and install the latest Windows application.',
      ].join('\n'),
      buttons: ['Update Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });

    if (result.response !== 0) return;

    updateInProgress = true;
    const tempDir = path.join(app.getPath('temp'), 'RizviDiagnosticCenter-update');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const installerPath = path.join(tempDir, asset.name.replace(/[^a-zA-Z0-9._-]/g, '_'));

    logToFile(`[update] Downloading ${asset.browser_download_url} to ${installerPath}`);
    await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Downloading Update',
      message: `Downloading Rizvi Diagnostic Center v${latestVersion}...`,
      detail: 'The application will restart after the installer is ready.',
      buttons: ['OK'],
    });

    await downloadFile(asset.browser_download_url, installerPath);
    logToFile(`[update] Installer downloaded: ${installerPath}`);

    const installResult = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: `Rizvi Diagnostic Center v${latestVersion} is ready to install.`,
      detail: 'The application will close and the new version will be installed. Your data is not deleted.',
      buttons: ['Install and Restart', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
    });

    if (installResult.response !== 0) {
      updateInProgress = false;
      return;
    }

    // NSIS supports /S for silent installation. The current process is closed
    // before launching it so Windows can replace the installed application.
    spawn(installerPath, ['/S'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref();

    app.quit();
  } catch (error) {
    updateInProgress = false;
    logToFile(`[update] Error: ${error && error.stack ? error.stack : error}`);
    if (showNoUpdate && mainWindow) {
      await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'Update Check Failed',
        message: 'Could not check for the latest Windows update.',
        detail: `${error.message}\n\nYou can try again later. Your current application remains unchanged.`,
        buttons: ['OK'],
      });
    }
  }
}

function setupAutoUpdate() {
  if (!app.isPackaged) return;
  checkForLatestWindowsUpdate(false);
  updateCheckTimer = setInterval(() => checkForLatestWindowsUpdate(false), UPDATE_CHECK_INTERVAL);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  async function startBackend() {
    require('dotenv').config({ path: path.join(BACKEND_ROOT, '.env') });
    const { start } = require(path.join(BACKEND_ROOT, 'src', 'server.js'));
    await start();
  }

  function createWindow() {
    const port = process.env.PORT || 5000;
    mainWindow = new BrowserWindow({
      width: 1360,
      height: 860,
      minWidth: 1024,
      minHeight: 640,
      title: process.env.CLINIC_NAME || 'Rizvi Diagnostic Center',
      icon: path.join(__dirname, 'build', 'Rizvi-Logo-favicon.png'),
      webPreferences: { contextIsolation: true, nodeIntegration: false },
      show: false,
    });

    Menu.setApplicationMenu(null);
    mainWindow.once('ready-to-show', () => mainWindow.show());
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      logToFile(`Page failed to load: ${errorCode} ${errorDescription}`);
      showFatalError('Rizvi Diagnostic Center failed to load', new Error(`${errorDescription} (${errorCode}) while loading http://localhost:${port}`));
    });
    mainWindow.loadURL(`http://localhost:${port}`);
    mainWindow.on('closed', () => { mainWindow = null; });
  }

  app.whenReady().then(async () => {
    try {
      logToFile(`App ready — version ${app.getVersion()} — starting backend...`);
      await startBackend();
      logToFile('Backend started — opening window...');
      createWindow();
      logToFile('Window opened successfully.');
      setupAutoUpdate();
    } catch (err) {
      showFatalError('Rizvi Diagnostic Center failed to start', err);
      app.quit();
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('before-quit', () => {
    if (updateCheckTimer) clearInterval(updateCheckTimer);
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  process.on('uncaughtException', (err) => showFatalError('Unexpected error', err));
}
