import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // PORT comes from the root .env, shared with the server.
  const env = loadEnv(mode, fileURLToPath(new URL('..', import.meta.url)), '');
  const serverPort = env.PORT ?? '3001';

  return {
    plugins: [react()],
    // VITE_API_URL is read from the root .env too.
    envDir: '..',
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: `http://localhost:${serverPort}`,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  };
});
