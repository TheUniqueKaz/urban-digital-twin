import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import cesium from 'vite-plugin-cesium';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');

  return {
    plugins: [react(), cesium()],
    server: {
      port: 5173,
      proxy: {
        '/api': env.VITE_API_PROXY_TARGET ?? 'http://localhost:8080',
      },
    },
  };
});

