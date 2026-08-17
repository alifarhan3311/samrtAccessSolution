import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5321,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5322',
        changeOrigin: true,
      },
    },
  },
});
