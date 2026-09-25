import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    proxy: {
      '/api/contemplados': {
        target: 'https://fragaebitelloconsorcios.com.br',
        changeOrigin: true,
        rewrite: () => '/api/json/contemplados',
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
