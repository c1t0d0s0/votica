import type { Plugin } from 'vite';

/**
 * Google Tag Manager (GTM) または Google Analytics (GA4) のトラッキングコードを
 * index.html に自動挿入する Vite プラグイン
 *
 * - G- から始まらない場合 (例: GTM-XXXXXXX, XXXXXXX): Google Tag Manager スニペットを埋め込み
 * - G- から始まる場合 (例: G-XXXXXXXXXX): Google Analytics 4 (gtag.js) を埋め込み
 * - ID が未指定の場合は何も挿入しない
 */
export function googleTrackingPlugin(trackingId?: string): Plugin {
  const trimmedId = trackingId?.trim();
  return {
    name: 'google-tracking',
    transformIndexHtml(html) {
      if (!trimmedId) return html;

      // G- で始まる場合は Google Analytics 4 (gtag.js)
      if (/^g-[a-z0-9]+/i.test(trimmedId)) {
        return {
          html,
          tags: [
            {
              tag: 'script',
              attrs: {
                async: true,
                src: `https://www.googletagmanager.com/gtag/js?id=${trimmedId}`,
              },
              injectTo: 'head-prepend',
            },
            {
              tag: 'script',
              children: `window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', '${trimmedId}');`,
              injectTo: 'head-prepend',
            },
          ],
        };
      }

      // デフォルト: Google Tag Manager
      const gtmId = /^gtm/i.test(trimmedId) ? trimmedId : `GTM-${trimmedId}`;
      return {
        html,
        tags: [
          {
            tag: 'script',
            children: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`,
            injectTo: 'head-prepend',
          },
          {
            tag: 'noscript',
            children: `<iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`,
            injectTo: 'body-prepend',
          },
        ],
      };
    },
  };
}

export const googleAnalyticsPlugin = googleTrackingPlugin;
