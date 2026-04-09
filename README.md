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
  onAfterResponse: ({ url, response }) => {
    // Modify response data
    const modified = new Response('{"modified": true}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    return modified;
  }
});
```

### Script Tag (CDN)

```html
<script src="https://cdn.jsdelivr.net/npm/req-hook/dist/req-hook.iife.js"></script>
<script>
  window.reqHook.init();

  window.reqHook.add({
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
        headers: { 'Content-Type': 'application/json' }
      });
    }
  });
</script>
```

### Tampermonkey

```javascript
// ==UserScript==
// @name         My ReqHook Script
// @require      https://cdn.jsdelivr.net/npm/req-hook/dist/req-hook.iife.js
// @match        *://api.example.com/*
// ==/UserScript==

(function() {
    window.reqHook.init();
    window.reqHook.add({
        url: 'api.example.com',
        onBeforeRequest: ({ url, request }) => request,
        onAfterResponse: ({ url, response }) => response
    });
})();
```

## API

- `init({ mode?: 'local' | 'iframe', log?: LogConfig })` - Initialize the interceptor
- `add({ url, onBeforeRequest?, onAfterResponse? })` - Add interception rule
- `remove(url)` - Remove interception rule

