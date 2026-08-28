import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ENTRY = path.resolve(__dirname, '../backend/src/server.js');
const BACKEND_PORT = 5000;

function isPortInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.setTimeout(600);
    socket.once('connect', () => { socket.end(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => resolve(false));
  });
}

function backendPlugin() {
  let child;
  return {
    name: 'rizvi-backend-dev-server',
    apply: 'serve',
    async configureServer() {
      if (await isPortInUse(BACKEND_PORT)) return;
      child = spawn('node', [BACKEND_ENTRY], { stdio: 'inherit', env: process.env });
      child.on('error', (err) => console.error('[vite] failed to start backend API:', err.message));
      const shutdown = () => { if (child && !child.killed) child.kill(); };
      process.once('exit', shutdown);
      process.once('SIGINT', () => { shutdown(); process.exit(0); });
      process.once('SIGTERM', () => { shutdown(); process.exit(0); });
    },
  };
}

export default defineConfig({
  plugins: [react(), backendPlugin()],
  build: {
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: false,
    cssCodeSplit: true,
    reportCompressedSize: false,
    modulePreload: true,
    chunkSizeWarningLimit: 1200,
  },
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
