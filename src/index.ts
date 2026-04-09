declare const unsafeWindow: Window & typeof globalThis | undefined;
declare const global: Window & typeof globalThis | undefined;

interface NativeWindow {
    XMLHttpRequest: typeof XMLHttpRequest;
    fetch: typeof fetch;
}

let initialized = false;
let nFetch: typeof fetch;
let nXHR: any;

type OnBeforeRequest = (data: { url: string; request: Request | XHRRequest }) => Request | XHRRequest | undefined;
type OnAfterResponse = (data: { url: string; request: Request | XHRRequest; response: Response | XHRResponse }) => Response | XHRResponse | undefined;

interface Rule {
    pattern: RegExp;
    onBeforeRequest?: OnBeforeRequest;
    onAfterResponse?: OnAfterResponse;
}

const rules: Rule[] = [];

const getGlobal = (): NativeWindow => {
    if (typeof unsafeWindow !== 'undefined') return unsafeWindow as NativeWindow;
    if (typeof globalThis !== 'undefined') return globalThis as unknown as NativeWindow;
    if (typeof window !== 'undefined') return window as unknown as NativeWindow;
    if (typeof global !== 'undefined') return global as unknown as NativeWindow;
    return self as unknown as NativeWindow;
};

class XHRRequest {
    url: string;
    method: string;
    headers: Headers;
    body: unknown;
    referrer: string;
    mode: RequestMode = 'cors';
    credentials: RequestCredentials = 'same-origin';
    cache: RequestCache = 'default';
    redirect: RequestRedirect = 'follow';
    referrerPolicy: ReferrerPolicy = 'no-referrer';
    integrity: string = '';
    destination: RequestDestination = '';
    clone(): XHRRequest {
        const cloned = new XHRRequest({});
        cloned.url = this.url;
        cloned.method = this.method;
        cloned.headers = new Headers(this.headers);
        cloned.body = this.body;
        cloned.referrer = this.referrer;
        cloned.mode = this.mode;
        cloned.credentials = this.credentials;
        cloned.cache = this.cache;
        cloned.redirect = this.redirect;
        cloned.referrerPolicy = this.referrerPolicy;
        cloned.integrity = this.integrity;
        cloned.destination = this.destination;
        return cloned;
    }

    constructor(xhr?: any) {
        this.url = xhr?._url || '';
        this.method = xhr?._method || 'GET';
        this.headers = new Headers();
        this.body = xhr?._body;
        this.referrer = '';
    }
}

class XHRResponse {
    url: string;
    status: number;
    statusText: string;
    headers: Headers;
    body: unknown;
    ok: boolean;
    redirected: boolean;
    type: ResponseType = 'basic';

    constructor(xhr: any, request: XHRRequest) {
        this.url = request.url;
        this.status = xhr.status || 200;
        this.statusText = xhr.statusText || 'OK';
        this.headers = new Headers();
        this.body = xhr.responseText;
        this.ok = this.status >= 200 && this.status < 300;
        this.redirected = false;
    }

    clone(): XHRResponse {
        return this;
    }

    async text(): Promise<string> {
        return String(this.body || '');
    }

    async json(): Promise<unknown> {
        return JSON.parse(String(this.body || '{}'));
    }

    async blob(): Promise<Blob> {
        return new Blob([String(this.body || '')]);
    }

    async arrayBuffer(): Promise<ArrayBuffer> {
        const encoder = new TextEncoder();
        return encoder.encode(String(this.body || '')).buffer;
    }
}

const logConfig = {
    init: true,
    blocked: true,
    request: true,
    response: true
};

export const init = function({ mode = 'local', log }: { mode?: 'local' | 'iframe'; log?: { init?: boolean; blocked?: boolean; request?: boolean; response?: boolean } } = {}) {
    if (initialized) return;

    if (log) {
        Object.assign(logConfig, log);
    }

    const target = getGlobal();

    if (mode === 'iframe') {
        const id = 'native-bridge-' + Math.random().toString(36).slice(2);
        let ifr = document.getElementById(id) as HTMLIFrameElement | null;
        if (!ifr) {
            ifr = document.createElement('iframe');
            ifr.id = id;
            ifr.style.display = 'none';
            document.documentElement.appendChild(ifr);
        }
        nFetch = ifr.contentWindow!.fetch;
        nXHR = (ifr.contentWindow as any).XMLHttpRequest;
    } else {
        nFetch = target.fetch;
        nXHR = (target as any).XMLHttpRequest;
    }

    initialized = true;
    if (logConfig.init) console.log('[ReqHook] Initialized (' + mode + ' mode)');
};

export const add = function({
    url,
    onBeforeRequest,
    onAfterResponse
}: {
    url: string | RegExp;
    onBeforeRequest?: OnBeforeRequest;
    onAfterResponse?: OnAfterResponse;
}) {
    if (!initialized) {
        console.warn('[ReqHook] Not initialized. Call init() first.');
        return;
    }

    const pattern = typeof url === 'string' ? new RegExp(url) : url;

    rules.push({ pattern, onBeforeRequest, onAfterResponse });

    if (rules.length === 1) {
        const hookedFetch = async function(...args: unknown[]) {
            let reqUrl = (typeof args[0] === 'string') ? args[0] : ((args[0] as any)?.url || '');
            const reqInit = args[1] as RequestInit | undefined;
            const nativeRequest = new Request(reqUrl, reqInit);
            let modifiedRequest: Request | XHRRequest | undefined;

            for (const rule of rules) {
                if (rule.pattern.test(reqUrl)) {
                    if (logConfig.request) console.log('[ReqHook] Request intercepted: ' + nativeRequest.method + ' ' + reqUrl);
                    if (rule.onBeforeRequest) {
                        const result = await rule.onBeforeRequest({ url: reqUrl, request: nativeRequest });
                        if (result !== undefined) {
                            modifiedRequest = result;
                        }
                    }
                }
            }

            const requestToUse = (modifiedRequest instanceof Request) ? modifiedRequest : nativeRequest;
            const response = await nFetch(requestToUse);

            for (const rule of rules) {
                if (rule.pattern.test(reqUrl)) {
                    if (rule.onAfterResponse) {
                        if (logConfig.response) console.log('[ReqHook] Response intercepted: ' + nativeRequest.method + ' ' + reqUrl);
                        const result = await rule.onAfterResponse({ url: reqUrl, request: nativeRequest, response });
                        if (result !== undefined) {
                            return result;
                        }
                    }
                }
            }
            return response;
        };

        const hookedXHR = function() {
            const xhr = new nXHR();
            let xhrRequest: XHRRequest | null = null;

            // Store modified response data
            let modifiedResponseText: string | null = null;
            let modifiedStatus: number | null = null;

            // Store references to underlying methods before proxying
            const xhrOpen = xhr.open.bind(xhr);
            const xhrSend = xhr.send.bind(xhr);

            const wrappedXHR: any = {
                _url: '',
                _method: 'GET',
                _body: undefined,
                readyState: 0,
                status: 0,
                statusText: '',
                responseText: '',
                response: '',
                headers: {},
                onreadystatechange: null,
                onload: null,
                onerror: null,
                onabort: null,
                ontimeout: null,
                timeout: 0,
                withCredentials: false,
                upload: xhr.upload,
                UNSENT: 0,
                OPENED: 1,
                HEADERS_RECEIVED: 2,
                LOADING: 3,
                DONE: 4
            };

            // Sync native XHR properties to wrapped XHR
            const syncFromNative = () => {
                wrappedXHR.readyState = xhr.readyState;
                wrappedXHR.status = modifiedStatus !== null ? modifiedStatus : xhr.status;
                wrappedXHR.statusText = xhr.statusText;
                wrappedXHR.responseText = modifiedResponseText !== null ? modifiedResponseText : xhr.responseText;
                wrappedXHR.response = modifiedResponseText !== null ? modifiedResponseText : xhr.response;
                wrappedXHR._url = wrappedXHR._url || xhr.responseURL || '';
            };

            // Handle readyState changes
            const handleReadyStateChange = async () => {
                syncFromNative();

                if (xhr.readyState === 4) {
                    const reqUrl = wrappedXHR._url;

                    for (const rule of rules) {
                        if (rule.pattern.test(reqUrl)) {
                            if (logConfig.request) console.log('[ReqHook] Request intercepted: ' + wrappedXHR._method + ' ' + reqUrl);
                            if (rule.onBeforeRequest && xhrRequest) {
                                const result = await rule.onBeforeRequest({ url: reqUrl, request: xhrRequest });
                                if (result !== undefined && result instanceof Request) {
                                    wrappedXHR._body = await result.clone().text().catch(() => wrappedXHR._body);
                                }
                            }
                        }
                    }

                    // Handle response interception FIRST, then call user's handlers
                    for (const rule of rules) {
                        if (rule.pattern.test(reqUrl)) {
                            if (rule.onAfterResponse) {
                                if (logConfig.response) console.log('[ReqHook] Response intercepted: ' + wrappedXHR._method + ' ' + reqUrl);

                                const request = xhrRequest || new XHRRequest(xhr);
                                const response = new XHRResponse(xhr, request);
                                const result = await rule.onAfterResponse({ url: reqUrl, request, response });

                                if (result !== undefined) {
                                    modifiedResponseText = await result.text();
                                    modifiedStatus = result.status;
                                }
                            }
                        }
                    }

                    // Sync modified values
                    syncFromNative();

                    // Call onload first
                    if (wrappedXHR.onload) {
                        wrappedXHR.onload.call(wrappedXHR);
                    }

                    // Then call onreadystatechange
                    if (wrappedXHR.onreadystatechange) {
                        wrappedXHR.onreadystatechange.call(wrappedXHR);
                    }
                } else {
                    if (wrappedXHR.onreadystatechange) {
                        wrappedXHR.onreadystatechange.call(wrappedXHR);
                    }
                }
            };

            // Intercept native xhr events
            xhr.onreadystatechange = handleReadyStateChange;
            xhr.onload = () => {
                syncFromNative();
                if (wrappedXHR.onload) wrappedXHR.onload.call(wrappedXHR);
            };
            xhr.onerror = () => {
                if (wrappedXHR.onerror) wrappedXHR.onerror.call(wrappedXHR);
            };
            xhr.onabort = () => {
                if (wrappedXHR.onabort) wrappedXHR.onabort.call(wrappedXHR);
            };
            xhr.ontimeout = () => {
                if (wrappedXHR.ontimeout) wrappedXHR.ontimeout.call(wrappedXHR);
            };

            wrappedXHR.open = function(m: string, u: string, ...r: unknown[]) {
                wrappedXHR._method = m;
                wrappedXHR._url = u;
                xhrOpen(m, u, ...r);
            };

            wrappedXHR.send = function(body?: unknown) {
                wrappedXHR._body = body;

                // Handle onBeforeRequest
                for (const rule of rules) {
                    if (rule.pattern.test(wrappedXHR._url)) {
                        if (logConfig.request) console.log('[ReqHook] Request intercepted: ' + wrappedXHR._method + ' ' + wrappedXHR._url);
                        if (rule.onBeforeRequest) {
                            xhrRequest = new XHRRequest(xhr);
                            xhrRequest.body = body;
                            const result = rule.onBeforeRequest({ url: wrappedXHR._url, request: xhrRequest });
                            if (result !== undefined && result instanceof Request) {
                                result.clone().text().then(text => {
                                    wrappedXHR._body = text;
                                    xhr.send(text);
                                }).catch(() => xhr.send(body));
                                return;
                            }
                        }
                    }
                }
                xhrSend(wrappedXHR._body);
            };

            wrappedXHR.setRequestHeader = (name: string, value: string) => xhr.setRequestHeader(name, value);
            wrappedXHR.getResponseHeader = (name: string) => xhr.getResponseHeader(name);
            wrappedXHR.getAllResponseHeaders = () => xhr.getAllResponseHeaders();
            wrappedXHR.abort = () => xhr.abort();
            wrappedXHR.overrideMimeType = (mime: string) => xhr.overrideMimeType(mime);
            wrappedXHR.toString = () => '[object XMLHttpRequest]';

            return wrappedXHR;
        };

        const silentLock = (obj: any, prop: string, value: unknown) => {
            try {
                Object.defineProperty(obj, prop, {
                    get: () => value,
                    set: () => {
                        if (logConfig.blocked) console.log('[ReqHook] Blocked attempt to override ' + prop);
                        return true;
                    },
                    configurable: true,
                    enumerable: true
                });
            } catch (e) {
                obj[prop] = value;
            }
        };

        const target = getGlobal();
        silentLock(target, 'fetch', hookedFetch);
        silentLock(target, 'XMLHttpRequest', hookedXHR);
    }

    if (logConfig.init) console.log('[ReqHook] Mounted');
};

export const remove = function(url: string | RegExp) {
    const pattern = typeof url === 'string' ? new RegExp(url) : url;
    const index = rules.findIndex(r => r.pattern.toString() === pattern.toString());
    if (index !== -1) {
        rules.splice(index, 1);
        console.log('[ReqHook] Rule removed');
    } else {
        console.warn('[ReqHook] Rule not found');
    }
};