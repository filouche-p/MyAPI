import { defineConfig } from 'vite';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        login: resolve(import.meta.dirname, 'src/pages/login.html'),
        register: resolve(import.meta.dirname, 'src/pages/register.html'),
        test: resolve(import.meta.dirname, 'src/pages/test.html'),
      },
    },
  },
  server: {
    host: true, // Needed for Docker to expose the port outside the container
    port: 80,
    proxy: {
      '/api': process.env.VITE_API_URL || 'http://localhost:8080',
      '/health': process.env.VITE_API_URL || 'http://localhost:8080',
      '/login': process.env.VITE_API_URL || 'http://localhost:8080',
      '/register': process.env.VITE_API_URL || 'http://localhost:8080',
      '/auth': process.env.VITE_API_URL || 'http://localhost:8080',
      '/api-docs': process.env.VITE_API_URL || 'http://localhost:8080'
    },
  },
});
