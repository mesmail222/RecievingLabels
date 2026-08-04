import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 3010,
    open: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3011',
        changeOrigin: true,
      },
    },
  },
});
