import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ENTRY = path.resolve(__dirname, '../backend/src/server.js');
const BACKEND_PORT = 5000;

// Is something already listening on the backend port? (Avoids spawning a
// duplicate API process on Vite restarts or when the backend is run
// separately.)
function isPortInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.setTimeout(600);
    socket.once('connect', () => {
      socket.end();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });
}

// Dev-only plugin: launches the Express API (backend/src/server.js) alongside
// the Vite dev server so the preview has a working /api backend without a
// second manual command. The backend's own src/env.js loads the right
// environment files, so we just inherit the current environment here.
function backendPlugin() {
  let child;
  return {
    name: 'rizvi-backend-dev-server',
    apply: 'serve',
    async configureServer() {
      if (await isPortInUse(BACKEND_PORT)) return; // already running

      child = spawn('node', [BACKEND_ENTRY], {
        stdio: 'inherit',
        env: process.env,
      });
      child.on('error', (err) => {
        console.error('[vite] failed to start backend API:', err.message);
      });

      const shutdown = () => {
        if (child && !child.killed) child.kill();
      };
      process.once('exit', shutdown);
      process.once('SIGINT', () => {
        shutdown();
        process.exit(0);
      });
      process.once('SIGTERM', () => {
        shutdown();
        process.exit(0);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), backendPlugin()],
  server: {
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: `http://localhost:${BACKEND_PORT}`,
        changeOrigin: true,
      },
    },
  },
});
