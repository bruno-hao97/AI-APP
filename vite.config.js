import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(__dirname, 'public'),
  publicDir: false,
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    open: '/',
    host: true,
    allowedHosts: true,
  },
  preview: {
    port: 4173,
    host: true,
    allowedHosts: true,
  },
});
