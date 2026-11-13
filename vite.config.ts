import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { googleTrackingPlugin } from './src/lib/trackingPlugin.ts';

export { googleTrackingPlugin, googleAnalyticsPlugin } from './src/lib/trackingPlugin.ts';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const gtmId =
    env.GTM_ID ||
    process.env.GTM_ID ||
    env.VITE_GTM_ID ||
    process.env.VITE_GTM_ID ||
    env.VITE_GA_MEASUREMENT_ID ||
    process.env.VITE_GA_MEASUREMENT_ID;


  return {
    plugins: [
      react(),
      tailwindcss(),
      googleTrackingPlugin(gtmId),
    ],
    base: './',
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
    server: {
      port: 3000,
      open: true,
    },
  };
});

