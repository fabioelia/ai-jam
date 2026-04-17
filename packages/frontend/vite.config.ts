import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 8020,
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://localhost:8010',
      '/socket.io': {
        target: 'http://localhost:8010',
        ws: true,
      },
    },
  },
});
