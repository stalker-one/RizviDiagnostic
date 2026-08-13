// Electron main process for the Rizvi Diagnostic Center desktop app.
//
// What this does:
//   1. Loads backend/.env (same config the backend normally uses) so PORT,
//      JWT_SECRET, and the MongoDB Atlas connection all work exactly the
//      same as running the server with plain Node.
//   2. Starts the Express backend IN-PROCESS (no separate terminal/window,
//      no "live site" needed — everything runs locally on this PC).
//   3. Opens a native window pointed at http://localhost:<PORT>, which the
//      backend now also serves the built frontend from (see
//      backend/src/server.js), so the whole app — UI + API — is one process.
//
// Data storage: the backend always keeps a local JSON cache under
// backend/src/data, so the app keeps working with zero internet. If
// backend/.env has MONGODB_URI set (see atlas-credentials.env in the
// project root / README), every write is also synced to MongoDB Atlas in
// the background whenever this PC has internet access.
//
// Reliability notes (added after real-world "installs fine but won't open"
// reports):
//   - Only one copy of the app is ever allowed to run at once. Without this,
//     double-clicking the shortcut while a previous copy is still running in
//     the background (or double-clicking twice quickly on a slow PC) makes
//     the second copy fail to bind the port with no visible error at all —
//     it just silently never shows a window. Now the second launch simply
//     focuses the existing window instead.
//   - Every failure path shows a native error dialog with the real error
//     message AND writes it to a log file, instead of the window just never
//     appearing with no explanation.

const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, Menu, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');

// Packaged layout (asar disabled) is:
//   <install dir>/resources/app/main.js   <- this file, so __dirname here
//                                             is <install dir>/resources/app
//   <install dir>/backend/...             <- extraFiles, NOT under resources
//   <install dir>/frontend/dist/...
// So when packaged, BACKEND_ROOT must go up two levels (out of resources/app
// entirely). In dev (`npm start` / `electron .` run directly from the
// electron/ folder), main.js sits directly in electron/, which is a sibling
// of backend/ — only one level up. app.isPackaged tells us which case we're
// in; getting this wrong is exactly what caused the "Cannot find module
// .../resources/backend/src/server.js" error (it was going up only one
// level in the packaged build).
const BACKEND_ROOT = app.isPackaged
  ? path.join(__dirname, '..', '..', 'backend')
  : path.join(__dirname, '..', 'backend');

// ---- Auto-update ----
// Checks GitHub Releases (stalker-one/RizviDiagnostic) for a newer version
// than what's installed. Fully silent unless an update is actually found —
// no popups, no interruptions, just a check + background download. Only
// once the new version is fully downloaded does it ask the user to restart.
// In dev mode this is a no-op (electron-updater requires a packaged,
// installed app — there's nothing to "update" when running `npm start`).
function setupAutoUpdate() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => logToFile('[update] Checking for update...'));
  autoUpdater.on('update-available', (info) =>
    logToFile(`[update] Update available: v${info.version} — downloading...`)
  );
  autoUpdater.on('update-not-available', () => logToFile('[update] Already on the latest version.'));
  autoUpdater.on('error', (err) => logToFile(`[update] Error: ${err && err.message}`));

  autoUpdater.on('update-downloaded', async (info) => {
    logToFile(`[update] v${info.version} downloaded — prompting to restart.`);
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update ready',
      message: `Rizvi Diagnostic Center v${info.version} has been downloaded.`,
      detail: 'Restart now to install it? Your data is not affected.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });

  // Check once on launch, then every 4 hours while the app stays open —
  // covers the clinic PC that's left running all day.
  autoUpdater.checkForUpdates().catch((err) => logToFile(`[update] Initial check failed: ${err.message}`));
  setInterval(() => {
    autoUpdater.checkForUpdates().catch((err) => logToFile(`[update] Periodic check failed: ${err.message}`));
  }, 4 * 60 * 60 * 1000);
}

let mainWindow = null;

// ---- Diagnostics: every launch appends to a log file so a "won't open"
// report can actually be debugged instead of guessed at. On Windows this
// lands under %APPDATA%\Rizvi Diagnostic Center\logs\main.log.
function logToFile(line) {
  try {
    const logDir = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(
      path.join(logDir, 'main.log'),
      `[${new Date().toISOString()}] ${line}\n`
    );
  } catch (e) {
    // Logging must never itself crash startup.
  }
}

function showFatalError(title, err) {
  const message = err && err.stack ? err.stack : String(err);
  logToFile(`FATAL: ${title} — ${message}`);
  dialog.showErrorBox(
    title,
    `${message}\n\nA full log has been saved to:\n${path.join(app.getPath('userData'), 'logs', 'main.log')}`
  );
}

// Prevents a second instance from ever launching alongside a running one —
// the #1 cause of "the app just doesn't open" (the second process fails to
// bind the already-in-use port and quits with no visible message).
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
    // Load backend/.env explicitly — when packaged, __dirname changes but
    // this path is always resolved relative to this file, so it keeps
    // working.
    require('dotenv').config({ path: path.join(BACKEND_ROOT, '.env') });
    // server.js exports start(), which resolves once Express is actually
    // listening (after it has tried — and possibly given up on —
    // connecting to MongoDB Atlas). We await it so the window is never
    // opened too early.
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
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
      show: false,
    });

    Menu.setApplicationMenu(null); // clean, app-like window — no File/Edit/View menu bar

    mainWindow.once('ready-to-show', () => mainWindow.show());

    // If the page itself fails to load (e.g. the backend died right after
    // starting, or the port got blocked by a firewall a split second
    // later), show that too instead of a window that just stays blank.
    mainWindow.webContents.on(
      'did-fail-load',
      (event, errorCode, errorDescription) => {
        logToFile(`Page failed to load: ${errorCode} ${errorDescription}`);
        showFatalError(
          'Rizvi Diagnostic Center failed to load',
          new Error(`${errorDescription} (${errorCode}) while loading http://localhost:${port}`)
        );
      }
    );

    mainWindow.loadURL(`http://localhost:${port}`);

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }

  app.whenReady().then(async () => {
    try {
      logToFile('App ready — starting backend...');
      await startBackend();
      logToFile('Backend started — opening window...');
      createWindow();
      logToFile('Window opened successfully.');
      setupAutoUpdate();
    } catch (err) {
      // This is the fix for "installs successfully but never opens": before,
      // any error here (port already in use, a missing file, etc.) was an
      // unhandled rejection that Electron swallowed — no window, no dialog,
      // nothing. Now the real reason is always shown.
      showFatalError('Rizvi Diagnostic Center failed to start', err);
      app.quit();
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  // Belt-and-suspenders: catch anything that still slips through
  // uncaught so it's logged and shown rather than a silent exit.
  process.on('uncaughtException', (err) => {
    showFatalError('Unexpected error', err);
  });
}
