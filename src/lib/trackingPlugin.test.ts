import { describe, it, expect } from 'vitest';
import { googleTrackingPlugin } from './trackingPlugin';

describe('googleTrackingPlugin', () => {
  it('does nothing when ID is empty or undefined', () => {
    const plugin = googleTrackingPlugin();
    const transform = plugin.transformIndexHtml as (html: string) => any;
    const result = transform('<html><head></head><body></body></html>');
    expect(result).toBe('<html><head></head><body></body></html>');

    const pluginEmpty = googleTrackingPlugin('   ');
    const transformEmpty = pluginEmpty.transformIndexHtml as (html: string) => any;
    const resultEmpty = transformEmpty('<html><head></head><body></body></html>');
    expect(resultEmpty).toBe('<html><head></head><body></body></html>');
  });

  it('injects Google Analytics tags when ID is GA measurement ID (e.g. G-XXXXXXXXXX)', () => {
    const gaId = 'G-ABC1234567';
    const plugin = googleTrackingPlugin(gaId);
    const transform = plugin.transformIndexHtml as (html: string) => any;
    const result = transform('<html><head></head><body></body></html>');

    expect(typeof result).toBe('object');
    expect(result.tags).toHaveLength(2);

    const scriptLoader = result.tags[0];
    expect(scriptLoader.tag).toBe('script');
    expect(scriptLoader.attrs.src).toBe(`https://www.googletagmanager.com/gtag/js?id=${gaId}`);
    expect(scriptLoader.attrs.async).toBe(true);
    expect(scriptLoader.injectTo).toBe('head-prepend');

    const scriptConfig = result.tags[1];
    expect(scriptConfig.tag).toBe('script');
    expect(scriptConfig.children).toContain(`gtag('config', '${gaId}')`);
    expect(scriptConfig.injectTo).toBe('head-prepend');
  });

  it('injects Google Tag Manager tags when ID starts with GTM (e.g. GTM-XXXXXXX)', () => {
    const gtmId = 'GTM-TEST123';
    const plugin = googleTrackingPlugin(gtmId);
    const transform = plugin.transformIndexHtml as (html: string) => any;
    const result = transform('<html><head></head><body></body></html>');

    expect(typeof result).toBe('object');
    expect(result.tags).toHaveLength(2);

    const gtmScript = result.tags.find((t: any) => t.tag === 'script');
    expect(gtmScript).toBeDefined();
    expect(gtmScript.injectTo).toBe('head-prepend');
    expect(gtmScript.children).toContain('https://www.googletagmanager.com/gtm.js?id=');
    expect(gtmScript.children).toContain(gtmId);
    expect(gtmScript.children).not.toContain("gtag('config'");

    const gtmNoscript = result.tags.find((t: any) => t.tag === 'noscript');
    expect(gtmNoscript).toBeDefined();
    expect(gtmNoscript.injectTo).toBe('body-prepend');
    expect(gtmNoscript.children).toContain(`https://www.googletagmanager.com/ns.html?id=${gtmId}`);
  });

  it('handles lowercase gtm- prefixes correctly', () => {
    const gtmId = 'gtm-xyz789';
    const plugin = googleTrackingPlugin(gtmId);
    const transform = plugin.transformIndexHtml as (html: string) => any;
    const result = transform('<html><head></head><body></body></html>');

    expect(result.tags).toHaveLength(2);
    const gtmNoscript = result.tags.find((t: any) => t.tag === 'noscript');
    expect(gtmNoscript).toBeDefined();
    expect(gtmNoscript.children).toContain(`https://www.googletagmanager.com/ns.html?id=${gtmId}`);
  });

  it('automatically adds GTM- prefix when raw container ID is provided without GTM prefix', () => {
    const rawId = 'KLMN987';
    const plugin = googleTrackingPlugin(rawId);
    const transform = plugin.transformIndexHtml as (html: string) => any;
    const result = transform('<html><head></head><body></body></html>');

    expect(result.tags).toHaveLength(2);
    const gtmScript = result.tags.find((t: any) => t.tag === 'script');
    expect(gtmScript.children).toContain('https://www.googletagmanager.com/gtm.js?id=');
    expect(gtmScript.children).toContain('GTM-KLMN987');

    const gtmNoscript = result.tags.find((t: any) => t.tag === 'noscript');
    expect(gtmNoscript.children).toContain('https://www.googletagmanager.com/ns.html?id=GTM-KLMN987');
  });
});
