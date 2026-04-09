# req-hook

[![npm](https://img.shields.io/npm/v/req-hook)](https://www.npmjs.com/package/req-hook)

Easily intercept `fetch` and `XMLHttpRequest` in your project or Tampermonkey.

## Install

```bash
npm install req-hook
```

## Usage

### ES Module

```javascript
import { init, add } from 'req-hook';

init();

add({
  url: 'api.example.com', // string or RegExp
  onBeforeRequest: ({ url, request }) => {
    // Modify request headers
    const headers = new Headers(request.headers);
    headers.set('Authorization', 'Bearer token');
    return new Request(request, { headers });
  },
  onAfterResponse: async ({ url, response }) => {
    const data = await response.json();
    data.modified = true;
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: response.headers
    });
  }
});
```

### Script Tag (CDN)

```html
<script src="https://cdn.jsdelivr.net/npm/req-hook@1.0.3/dist/req-hook.iife.js"></script>
<script>
  reqHook.init();

  reqHook.add({
    url: 'api.example.com', // string or RegExp
    onBeforeRequest: ({ url, request }) => {
      const headers = new Headers(request.headers);
      headers.set('X-Custom-Header', 'value');
      return new Request(request, { headers });
    },
    onAfterResponse: async ({ url, response }) => {
      const data = await response.json();
      data.modified = true;
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: response.headers
      });
    }
  });
</script>
```

### Tampermonkey

```javascript
// ==UserScript==
// @name         My ReqHook Script
// @require      https://cdn.jsdelivr.net/npm/req-hook@1.0.3/dist/req-hook.iife.js
// @match        *://api.example.com/*
// ==/UserScript==

(function() {
    reqHook.init();
    reqHook.add({
        url: 'api.example.com',
        onBeforeRequest: ({ url, request }) => request,
        onAfterResponse: ({ url, response }) => response
    });
})();
```

## API

### init(options?)

Initialize req-hook. Must be called before adding rules.

```javascript
init();                          // defaults
init({ mode: 'local' });         // use window.fetch/XHR directly
init({ mode: 'iframe' });         // get native fetch/XHR from iframe (for Tampermonkey)
init({ log: { init: true } });   // enable init logging
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | `'local' \| 'iframe'` | `'local'` | `'iframe'` mode gets native fetch/XHR from a hidden iframe, useful when other scripts have already overridden them |
| `log.init` | `boolean` | `true` | Log initialization messages |
| `log.blocked` | `boolean` | `true` | Log when something tries to override fetch/XHR |
| `log.request` | `boolean` | `true` | Log intercepted requests |
| `log.response` | `boolean` | `true` | Log intercepted responses |

### add({ url, onBeforeRequest?, onAfterResponse? })

Add a rule to intercept matching requests.

```javascript
add({
  url: 'api.example.com',        // string or RegExp
  onBeforeRequest: ({ url, request }) => {
    // Modify request before it goes out
    return request;              // return modified request or undefined
  },
  onAfterResponse: ({ url, request, response }) => {
    // Modify response before it reaches your code
    return response;             // return modified response or undefined
  }
});
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | `string \| RegExp` | URL pattern to match requests |
| `onBeforeRequest` | `(data) => Request \| XHRRequest \| undefined` | Called before request is sent. Return modified request to change it. |
| `onAfterResponse` | `(data) => Response \| XHRResponse \| undefined` | Called after response is received. Return modified response to change it. |

### remove(url)

Remove a rule by its URL pattern.

```javascript
remove('api.example.com');       // string
remove(/api\.example\.com/);      // RegExp
```

