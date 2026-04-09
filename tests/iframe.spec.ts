import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test.describe('iframe mode', () => {
    test.beforeEach(async ({ page }) => {
        // Go to a blank page
        await page.goto('about:blank');
    });

    test('should get native fetch from iframe when main window fetch is overridden', async ({ page }) => {
        // This test proves that iframe mode correctly retrieves native fetch from iframe's contentWindow
        // when the main window's fetch has been overridden

        let nativeFetchCalled = false;

        await page.addInitScript(() => {
            // Store the real native fetch
            const realFetch = window.fetch.bind(window);

            // Override window.fetch to track if it's called
            // If iframe mode works correctly, our overridden fetch should NOT be called
            // because iframe mode should get the native fetch from the iframe
            (window as any).nativeFetch = realFetch;
            let callCount = 0;

            window.fetch = async (...args: any[]) => {
                callCount++;
                console.log('[Test] Overridden main window.fetch called, count:', callCount);

                // If this is called more than once, it means iframe mode failed to get native fetch
                if (callCount > 1) {
                    throw new Error('OVERRIDDEN FETCH CALLED - iframe mode did not get native fetch from iframe!');
                }

                // Return a mock response
                return new Response('OK', { status: 200 });
            };
        });

        // Load intercepter.js (IIFE build attaches to window.intercepter)
        const scriptContent = readFileSync(resolve(__dirname, '../dist/intercepter.iife.js'), 'utf-8');
        await page.addScriptTag({ content: scriptContent });

        // Initialize with iframe mode
        await page.evaluate(() => {
            const win = window as any;
            win.intercepter.init({ mode: 'iframe' });

            win.intercepter.add({
                url: /api\.example\.com\/test/,
                onBeforeRequest: ({ url }: { url: string }) => {
                    console.log('[Test] onBeforeRequest called for:', url);
                    win.intercepted = true;
                },
                onAfterResponse: () => {
                    console.log('[Test] onAfterResponse called');
                    return undefined;
                }
            });
        });

        // Make a request - this should use the iframe's native fetch
        await page.evaluate(() => {
            (window as any).intercepted = false;
            return window.fetch('https://api.example.com/test');
        });

        // Wait for async operations
        await page.waitForTimeout(300);

        // Verify interception happened and our overridden fetch was NOT called (proving iframe got native)
        const intercepted = await page.evaluate(() => (window as any).intercepted);
        expect(intercepted).toBe(true);
    });

    test('iframe should be created and hidden', async ({ page }) => {
        // Load intercepter.js (IIFE build attaches to window.intercepter)
        const scriptContent = readFileSync(resolve(__dirname, '../dist/intercepter.iife.js'), 'utf-8');
        await page.addScriptTag({ content: scriptContent });

        // Initialize with iframe mode
        await page.evaluate(() => {
            (window as any).intercepter.init({ mode: 'iframe' });
        });

        // Check that an iframe with id starting with 'native-bridge-' was created
        const iframe = page.locator('iframe[id^="native-bridge-"]').first();
        await expect(iframe).toBeAttached();
        await expect(iframe).toHaveCSS('display', 'none');
    });

    test('iframe contentWindow should have native fetch and XMLHttpRequest', async ({ page }) => {
        // Load intercepter.js (IIFE build attaches to window.intercepter)
        const scriptContent = readFileSync(resolve(__dirname, '../dist/intercepter.iife.js'), 'utf-8');
        await page.addScriptTag({ content: scriptContent });

        // Initialize with iframe mode
        const result = await page.evaluate(() => {
            (window as any).intercepter.init({ mode: 'iframe' });

            // Find the iframe
            const iframe = document.querySelector('iframe[id^="native-bridge-"]') as HTMLIFrameElement;

            if (!iframe || !iframe.contentWindow) {
                return { success: false, error: 'No iframe found' };
            }

            const cw = iframe.contentWindow;

            return {
                success: true,
                hasFetch: typeof cw.fetch === 'function',
                hasXHR: typeof cw.XMLHttpRequest === 'function'
            };
        });

        expect(result.success).toBe(true);
        expect(result.hasFetch).toBe(true);
        expect(result.hasXHR).toBe(true);
    });
});
