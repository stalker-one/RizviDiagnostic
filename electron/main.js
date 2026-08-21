// Electron main process for the Rizvi Diagnostic Center desktop app.
const path = require('path');
const fs = require('fs');
const https = require('https');
const { spawn } = require('child_process');
const { app, BrowserWindow, Menu, dialog } = require('electron');

const BACKEND_ROOT = app.isPackaged ? path.join(process.resourcesPath, 'backend') : path.join(__dirname, '..', 'backend');
const FRONTEND_DIST = app.isPackaged ? path.join(process.resourcesPath, 'frontend', 'dist') : path.join(__dirname, '..', 'frontend', 'dist');
const GITHUB_OWNER = 'stalker-one';
const GITHUB_REPO = 'RizviDiagnostic';
const WINDOWS_RELEASE_TAG = 'v1.1.0';
const GITHUB_WINDOWS_RELEASE_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/${WINDOWS_RELEASE_TAG}`;
const UPDATE_CHECK_INTERVAL = 60 * 1000;

let mainWindow = null;
let updateCheckTimer = null;
let updateInitialCheckTimer = null;
let updateInProgress = false;
let updateCheckRunning = false;

function logToFile(line) {
  try { const logDir = path.join(app.getPath('userData'), 'logs'); if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true }); fs.appendFileSync(path.join(logDir, 'main.log'), `[${new Date().toISOString()}] ${line}\n`); } catch (_) {}
}
function showFatalError(title, err) { const message = err && err.stack ? err.stack : String(err); logToFile(`FATAL: ${title} — ${message}`); dialog.showErrorBox(title, `${message}\n\nA full log has been saved to:\n${path.join(app.getPath('userData'), 'logs', 'main.log')}`); }
function parseVersion(version) { const clean = String(version || '').trim().replace(/^v/i, '').split('-')[0]; const parts = clean.split('.').map((part) => Number.parseInt(part, 10)); return [parts[0] || 0, parts[1] || 0, parts[2] || 0]; }
function compareVersions(a, b) { const av = parseVersion(a); const bv = parseVersion(b); for (let i = 0; i < 3; i += 1) { if (av[i] > bv[i]) return 1; if (av[i] < bv[i]) return -1; } return 0; }
function requestJson(url) { return new Promise((resolve, reject) => { const separator = url.includes('?') ? '&' : '?'; const requestUrl = `${url}${separator}_=${Date.now()}`; const request = https.get(requestUrl, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Rizvi-Diagnostic-Center-Desktop', 'Cache-Control': 'no-cache', Pragma: 'no-cache' } }, (response) => { let body = ''; response.setEncoding('utf8'); response.on('data', (chunk) => { body += chunk; }); response.on('end', () => { if (response.statusCode < 200 || response.statusCode >= 300) { reject(new Error(`GitHub Windows release check returned HTTP ${response.statusCode}`)); return; } try { resolve(JSON.parse(body)); } catch (error) { reject(new Error(`Invalid GitHub release response: ${error.message}`)); } }); }); request.setTimeout(15000, () => request.destroy(new Error('GitHub release check timed out'))); request.on('error', reject); }); }
function downloadFile(url, destination, redirectCount = 0) { return new Promise((resolve, reject) => { if (redirectCount > 5) return reject(new Error('Too many download redirects')); const output = fs.createWriteStream(destination); const request = https.get(url, { headers: { 'User-Agent': 'Rizvi-Diagnostic-Center-Desktop', 'Cache-Control': 'no-cache' } }, (response) => { if ([301,302,303,307,308].includes(response.statusCode) && response.headers.location) { output.close(); try { fs.unlinkSync(destination); } catch (_) {} downloadFile(response.headers.location, destination, redirectCount + 1).then(resolve).catch(reject); return; } if (response.statusCode !== 200) { output.close(); try { fs.unlinkSync(destination); } catch (_) {} reject(new Error(`Download returned HTTP ${response.statusCode}`)); return; } response.pipe(output); output.on('finish', () => output.close(() => { try { if (fs.statSync(destination).size < 100 * 1024) reject(new Error('Downloaded installer is unexpectedly small')); else resolve(destination); } catch (error) { reject(error); } })); }); request.setTimeout(10 * 60 * 1000, () => request.destroy(new Error('Installer download timed out'))); request.on('error', (error) => { output.destroy(); try { fs.unlinkSync(destination); } catch (_) {} reject(error); }); }); }
function getWindowsInstallerAsset(release, expectedVersion) {
  const assets = Array.isArray(release.assets) ? release.assets : [];
  if (expectedVersion) {
    const exactName = `Rizvi-Diagnostic-Center-Setup-${String(expectedVersion).replace(/^v/i, '')}.exe`.toLowerCase();
    const exact = assets.find((asset) => String(asset.name || '').toLowerCase() === exactName);
    if (exact) return exact;
  }
  const versioned = assets
    .map((asset) => { const match = /^Rizvi-Diagnostic-Center-Setup-(\d+\.\d+\.\d+)\.exe$/i.exec(String(asset.name || '')); return match ? { asset, version: match[1] } : null; })
    .filter(Boolean)
    .sort((a, b) => compareVersions(b.version, a.version));
  return versioned.length ? versioned[0].asset : (assets.find((asset) => /\.exe$/i.test(String(asset.name || '')) && !/\.blockmap$/i.test(String(asset.name || ''))) || null);
}
function getHighestInstallerVersion(release) {
  const assets = Array.isArray(release.assets) ? release.assets : [];
  return assets
    .map((asset) => { const match = /^Rizvi-Diagnostic-Center-Setup-(\d+\.\d+\.\d+)\.exe$/i.exec(String(asset.name || '')); return match ? match[1] : null; })
    .filter(Boolean)
    .sort(compareVersions)
    .pop() || '';
}
function getBuildVersionFromRelease(release) {
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const manifest = assets.find((asset) => String(asset.name || '').toLowerCase() === 'windows-version.json');
  if (!manifest?.browser_download_url) return Promise.resolve(null);
  return requestJson(manifest.browser_download_url).catch((error) => {
    logToFile(`[update] windows-version.json could not be read: ${error.message}; falling back to installer asset version.`);
    return null;
  });
}

async function checkForLatestWindowsUpdate(showNoUpdate = false) {
  if (!app.isPackaged || updateInProgress || updateCheckRunning) return;
  if (!mainWindow || mainWindow.isDestroyed()) return;
  updateCheckRunning = true;
  try {
    const currentVersion = app.getVersion();
    // Always query the single configured Windows release directly. Do not use a
    // cached release page or a browser URL, so an update is detected immediately.
    const release = await requestJson(GITHUB_WINDOWS_RELEASE_API);
    if (release.draft || release.prerelease) throw new Error('Windows release is not a stable published release');

    const manifest = await getBuildVersionFromRelease(release);
    // The manifest is preferred, but the updater can now work even when the
    // manifest is delayed/missing by deriving the version from the installer.
    const latestVersion = String(manifest?.version || getHighestInstallerVersion(release) || release.tag_name || '').trim().replace(/^v/i, '');
    if (!latestVersion) throw new Error('The Windows release has no detectable Windows installer version.');

    logToFile(`[update] Windows channel ${release.tag_name}: installed=${currentVersion}, latest=${latestVersion}, assets=${Array.isArray(release.assets) ? release.assets.length : 0}`);

    if (compareVersions(latestVersion, currentVersion) <= 0) {
      if (showNoUpdate && mainWindow && !mainWindow.isDestroyed()) await dialog.showMessageBox(mainWindow, { type: 'info', title: 'Updates', message: 'You are using the latest Windows version.', detail: `Installed: v${currentVersion}\nLatest: v${latestVersion}`, buttons: ['OK'] });
      return;
    }

    const asset = getWindowsInstallerAsset(release, latestVersion);
    if (!asset?.browser_download_url) throw new Error(`Windows release v${latestVersion} has no matching installer asset.`);

    const notes = String(manifest?.notes || release.body || '').trim();
    logToFile(`[update] Update available: ${currentVersion} -> ${latestVersion}; installer=${asset.name}`);

    // This modal is deliberately shown by the Electron main process, after the
    // BrowserWindow is ready, so it cannot be hidden behind the startup window.
    const result = await dialog.showMessageBox(mainWindow, { type: 'warning', title: 'Update Required — Rizvi Diagnostic Center', message: `New Windows version v${latestVersion} is available.`, detail: [`Current version: v${currentVersion}`, `Latest version: v${latestVersion}`, '', 'Latest updates:', notes ? notes.slice(0, 5000) : 'Bug fixes and improvements.', '', 'Please update to the latest version.'].join('\n'), buttons: ['Update Now', 'Later'], defaultId: 0, cancelId: 1, noLink: true });
    if (result.response !== 0) return;

    updateInProgress = true;
    const tempDir = path.join(app.getPath('temp'), 'RizviDiagnosticCenter-update');
    fs.mkdirSync(tempDir, { recursive: true });
    const installerPath = path.join(tempDir, asset.name.replace(/[^a-zA-Z0-9._-]/g, '_'));
    await downloadFile(asset.browser_download_url, installerPath);

    const installResult = await dialog.showMessageBox(mainWindow, { type: 'info', title: 'Update Ready', message: `v${latestVersion} is ready to install.`, detail: 'The application will close and install the latest Windows build. Your database and settings remain in your Windows user profile.', buttons: ['Install and Restart', 'Cancel'], defaultId: 0, cancelId: 1, noLink: true });
    if (installResult.response !== 0) { updateInProgress = false; return; }

    spawn(installerPath, ['/S'], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    app.quit();
  } catch (error) {
    updateInProgress = false;
    logToFile(`[update] Error: ${error && error.stack ? error.stack : error}`);
    if (showNoUpdate && mainWindow && !mainWindow.isDestroyed()) await dialog.showMessageBox(mainWindow, { type: 'warning', title: 'Update Check Failed', message: 'Could not check for the latest Windows update.', detail: error.message, buttons: ['OK'] });
  } finally {
    updateCheckRunning = false;
  }
}

function setupAutoUpdate() {
  if (!app.isPackaged || !mainWindow || mainWindow.isDestroyed()) return;
  const runInitialCheck = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    logToFile('[update] Startup update check triggered after window ready.');
    checkForLatestWindowsUpdate(false);
    if (updateInitialCheckTimer) clearTimeout(updateInitialCheckTimer);
    updateInitialCheckTimer = setTimeout(() => checkForLatestWindowsUpdate(false), 5000);
  };
  if (mainWindow.isVisible()) runInitialCheck();
  else mainWindow.once('ready-to-show', runInitialCheck);
  if (updateCheckTimer) clearInterval(updateCheckTimer);
  updateCheckTimer = setInterval(() => checkForLatestWindowsUpdate(false), UPDATE_CHECK_INTERVAL);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit(); else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });
  async function startBackend() {
    const envPath = path.join(BACKEND_ROOT, '.env'); if (fs.existsSync(envPath)) require('dotenv').config({ path: envPath, override: false });
    const dataDir = path.join(app.getPath('userData'), 'data'); fs.mkdirSync(dataDir, { recursive: true }); process.env.RIZVI_DATA_DIR = dataDir;
    logToFile(`Backend root: ${BACKEND_ROOT}`); logToFile(`Backend data directory: ${dataDir}`); logToFile(`MongoDB configured: ${Boolean(process.env.MONGODB_URI || process.env.MONGODB_URI_2 || process.env.MONGODB_URI_3)}`);
    const { start } = require(path.join(BACKEND_ROOT, 'src', 'server.js')); await start();
  }
  function createWindow() {
    const port = process.env.PORT || 5000; mainWindow = new BrowserWindow({ width: 1360, height: 860, minWidth: 1024, minHeight: 640, title: process.env.CLINIC_NAME || 'Rizvi Diagnostic Center', icon: path.join(__dirname, 'build', 'Rizvi-Logo-favicon.png'), webPreferences: { contextIsolation: true, nodeIntegration: false }, show: false });
    Menu.setApplicationMenu(null); mainWindow.once('ready-to-show', () => mainWindow.show()); mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => { logToFile(`Page failed to load: ${errorCode} ${errorDescription}`); showFatalError('Rizvi Diagnostic Center failed to load', new Error(`${errorDescription} (${errorCode}) while loading http://localhost:${port}`)); }); mainWindow.loadURL(`http://localhost:${port}`); mainWindow.on('closed', () => { mainWindow = null; });
  }
  app.whenReady().then(async () => { try { logToFile(`App ready — version ${app.getVersion()} — starting backend...`); await startBackend(); logToFile('Backend started — opening window...'); createWindow(); setupAutoUpdate(); } catch (err) { showFatalError('Rizvi Diagnostic Center could not start', err); app.quit(); } });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); }); app.on('before-quit', () => { if (updateCheckTimer) clearInterval(updateCheckTimer); if (updateInitialCheckTimer) clearTimeout(updateInitialCheckTimer); });
}
