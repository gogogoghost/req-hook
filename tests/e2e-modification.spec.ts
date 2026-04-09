// Playwright test to verify fetch and XHR modification works
import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test.describe('response modification', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('about:blank');
    });

    test('fetch should support response modification', async ({ page }) => {
        // Route the request
        await page.route('http://localhost/api/test', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: '{"original": true}'
            });
        });

        // Load req-hook
        const scriptContent = readFileSync(resolve(__dirname, '../dist/req-hook.iife.js'), 'utf-8');
        await page.addScriptTag({ content: scriptContent });

        // Setup hook
        await page.evaluate(() => {
            (window as any).reqHook.init();
            (window as any).reqHook.add({
                url: /api\/test/,
                onAfterResponse: async ({ response }: any) => {
                    const data = await response.json();
                    data.modified = true;
                    return new Response(JSON.stringify(data), {
                        status: response.status,
                        headers: response.headers
                    });
                }
            });
        });

        // Make request and verify modification
        const result = await page.evaluate(async () => {
            const response = await fetch('http://localhost/api/test');
            const text = await response.text();
            return { text, status: response.status };
        });

        expect(result.text).toBe('{"original":true,"modified":true}');
        expect(result.status).toBe(200);
    });

    test('XHR should support response modification', async ({ page }) => {
        // Route the request
        await page.route('http://localhost/api/test', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: '{"original": true}'
            });
        });

        // Load req-hook
        const scriptContent = readFileSync(resolve(__dirname, '../dist/req-hook.iife.js'), 'utf-8');
        await page.addScriptTag({ content: scriptContent });

        // Setup hook
        await page.evaluate(() => {
            (window as any).reqHook.init();
            (window as any).reqHook.add({
                url: /api\/test/,
                onAfterResponse: async ({ response }: any) => {
                    const data = await response.json();
                    data.modified = true;
                    return new Response(JSON.stringify(data), {
                        status: response.status,
                        headers: response.headers
                    });
                }
            });
        });

        // Make XHR request and verify modification
        const result = await page.evaluate(async () => {
            return new Promise((resolve) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', 'http://localhost/api/test');
                xhr.onreadystatechange = function() {
                    if (xhr.readyState === 4) {
                        resolve({ text: xhr.responseText, status: xhr.status });
                    }
                };
                xhr.send();
            });
        });

        expect(result.text).toBe('{"original":true,"modified":true}');
        expect(result.status).toBe(200);
    });
});
