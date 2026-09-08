import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [svelte(), basicSsl()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    https: true,
    hmr: false,
    watch: {
      ignored: [
        '**/src-tauri/target/**',
        '**/src-tauri/**/*.exe'
      ]
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        secure: false
      },
      '/ws': {
        target: 'ws://127.0.0.1:8080',
        ws: true,
        changeOrigin: true,
        secure: false
      },
      '/uploads': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    target: 'esnext'
  }
});
