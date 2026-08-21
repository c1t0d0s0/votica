import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function googleAnalyticsPlugin(gaId?: string): Plugin {
  const trimmedGaId = gaId?.trim();
  return {
    name: 'google-analytics',
    transformIndexHtml(html) {
      if (!trimmedGaId) return html;
      return {
        html,
        tags: [
          {
            tag: 'script',
            attrs: {
              async: true,
              src: `https://www.googletagmanager.com/gtag/js?id=${trimmedGaId}`,
            },
            injectTo: 'head-prepend',
          },
          {
            tag: 'script',
            children: `window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', '${trimmedGaId}');`,
            injectTo: 'head-prepend',
          },
        ],
      };
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const gaMeasurementId =
    env.VITE_GA_MEASUREMENT_ID ||
    process.env.VITE_GA_MEASUREMENT_ID ||
    env.GA_MEASUREMENT_ID ||
    process.env.GA_MEASUREMENT_ID;


  return {
    plugins: [
      react(),
      tailwindcss(),
      googleAnalyticsPlugin(gaMeasurementId),
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

