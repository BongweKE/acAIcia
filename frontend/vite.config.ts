import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/prompt_pills': 'http://localhost:8000',
      '/settings': 'http://localhost:8000',
      '/user': 'http://localhost:8000',
      '/feedback': 'http://localhost:8000',
      '/admin': 'http://localhost:8000',
      '/query': 'http://localhost:8000',
    },
  },
});
