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
        target: 'http://127.0.0.1:5322',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:5322',
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (err, _req, _res) => {
            if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
              // Ignore temporary socket reconnect attempts while server reboots
              return;
            }
            console.error('[vite socket proxy error]:', err.message);
          });
        },
      },
    },
  },
});
