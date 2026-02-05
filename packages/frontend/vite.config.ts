import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/cognito': {
        target: 'http://localhost:9229',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/cognito/, '')
      }
    }
  }
});
