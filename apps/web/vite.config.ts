import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@his-lite/shared-types': path.resolve(__dirname, '../../packages/shared-types/src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    hmr: { host: 'localhost', protocol: 'ws', port: 3000 },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        secure: false,
        timeout: 180_000,
        proxyTimeout: 180_000,
        rewrite: (path) => path.replace(/^\/api/, '/api/v1'),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});