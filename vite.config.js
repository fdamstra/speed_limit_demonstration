import { defineConfig } from 'vite';

export default defineConfig({
  base: '/speed_limit_demonstration/',
  server: {
    port: 3000,
    open: true
  },
  build: {
    target: 'es2020'
  }
});