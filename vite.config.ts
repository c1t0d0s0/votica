import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function googleAnalyticsPlugin(gaId?: string): Plugin {
  return {
    name: 'google-analytics',
    transformIndexHtml(html) {
      if (!gaId) return html;
      return {
        html,
        tags: [
          {
            tag: 'script',
            attrs: {
              async: true,
              src: `https://www.googletagmanager.com/gtag/js?id=${gaId}`,
            },
            injectTo: 'head',
          },
          {
            tag: 'script',
            children: `window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', '${gaId}');`,
            injectTo: 'head',
          },
        ],
      };
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const gaMeasurementId = env.VITE_GA_MEASUREMENT_ID || process.env.VITE_GA_MEASUREMENT_ID;

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

