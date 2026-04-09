import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { init, add, remove } from '../src/index';

describe('intercepter.js', () => {
    let mockFetch: ReturnType<typeof vi.fn>;
    let mockXHR: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockFetch = vi.fn(() => Promise.resolve(new Response('original')));
        mockXHR = vi.fn();

        (globalThis as any).fetch = mockFetch;
        (globalThis as any).XMLHttpRequest = mockXHR;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('init', () => {
        it('should initialize without errors', () => {
            expect(() => init()).not.toThrow();
        });

        it('should not re-initialize if already initialized', () => {
            init();
            expect(() => init()).not.toThrow();
        });

        it('should accept log configuration', () => {
            expect(() => init({ log: { init: true, blocked: true, request: true, response: true } })).not.toThrow();
        });

    });

    describe('fetch interception', () => {
        it('should intercept fetch requests matching URL pattern', async () => {
            init();

            const beforeRequestSpy = vi.fn();
            const afterResponseSpy = vi.fn();

            add({
                url: /https:\/\/api\.example\.com\/test/,
                onBeforeRequest: beforeRequestSpy,
                onAfterResponse: afterResponseSpy
            });

            await globalThis.fetch('https://api.example.com/test');

            expect(beforeRequestSpy).toHaveBeenCalled();
            expect(afterResponseSpy).toHaveBeenCalled();
        });

        it('should allow onBeforeRequest to modify request', async () => {
            init();

            add({
                url: /https:\/\/api\.example\.com\/test/,
                onBeforeRequest: ({ url, request }) => {
                    expect(url).toBe('https://api.example.com/test');
                    return request;
                }
            });

            await globalThis.fetch('https://api.example.com/test');
        });

        it('should allow onAfterResponse to modify response', async () => {
            init();
            const modifiedResponse = new Response('modified');

            add({
                url: /https:\/\/api\.example\.com\/test/,
                onAfterResponse: () => modifiedResponse
            });

            const result = await globalThis.fetch('https://api.example.com/test');
            expect(await result.text()).toBe('modified');
        });

        it('should not intercept requests not matching any pattern', async () => {
            init();

            add({
                url: /https:\/\/api\.example\.com\/test/
            });

            // Should not throw even for non-matching URLs
            await globalThis.fetch('https://other-domain.com/other');
        });

        it('should work with string URL pattern', async () => {
            init();

            add({
                url: 'api.example.com'
            });

            await globalThis.fetch('https://api.example.com/test');
        });

        it('should pass correct request object to onBeforeRequest', async () => {
            init();
            let receivedRequest: Request | undefined;

            add({
                url: /api\.example\.com/,
                onBeforeRequest: ({ request }) => {
                    receivedRequest = request;
                    return request;
                }
            });

            await globalThis.fetch('https://api.example.com/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ test: true })
            });

            expect(receivedRequest).toBeInstanceOf(Request);
            expect(receivedRequest?.method).toBe('POST');
        });
    });

    describe('XMLHttpRequest interception', () => {
        it('should define XMLHttpRequest on global after init', () => {
            init();

            expect((globalThis as any).XMLHttpRequest).toBeDefined();
        });
    });

    describe('remove', () => {
        it('should remove a rule by RegExp pattern', () => {
            init();

            add({ url: /https:\/\/api\.example\.com\/test/ });

            expect(() => remove(/https:\/\/api\.example\.com\/test/)).not.toThrow();
        });

        it('should remove a rule by string pattern', () => {
            init();

            add({ url: 'api.example.com' });

            expect(() => remove('api.example.com')).not.toThrow();
        });

        it('should warn when removing non-existent rule', () => {
            init();

            const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            remove(/https:\/\/non-existent\.com/);

            expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('Rule not found'));
            consoleWarn.mockRestore();
        });
    });

    describe('log configuration', () => {
        it('should not throw with various log options', () => {
            init({
                log: {
                    init: true,
                    blocked: true,
                    request: true,
                    response: true
                }
            });

            add({
                url: /test/,
                onBeforeRequest: ({ url }) => {
                    return undefined;
                },
                onAfterResponse: ({ url }) => {
                    return undefined;
                }
            });
        });
    });
});
