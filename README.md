# VS Code REST Webview

A standalone NPM library that enables HTTP REST-like communication between VS Code extensions and webviews using VS Code's native messaging system as the transport layer.

## ✨ Features

- **Fastify Compatible**: Drop-in replacement using custom transport
- **Fetch-like Client API**: Familiar HTTP patterns for webviews  
- **Full HTTP Support**: Methods, headers, status codes, middleware
- **TypeScript First**: Complete type safety and IntelliSense
- **Framework Agnostic**: Works with React, Vue, vanilla JS
- **Development Tools**: Hot reload, configurable logging, debugging

## 🚀 Quick Start

### Extension Side (Server)

```typescript
import * as vscode from 'vscode';
import { createVSCodeFastify } from '@vscode-rest/server';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('myext.openWebview', () => {
    // Create webview panel
    const panel = vscode.window.createWebviewPanel(
      'myWebview',
      'My Extension',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    // Create Fastify server with VS Code transport
    const server = createVSCodeFastify({
      webview: panel.webview,
      options: {
        development: { logging: 'debug' }
      }
    });

    // Define API routes (standard Fastify!)
    server.get('/api/hello', async () => {
      return { message: 'Hello from extension!' };
    });

    server.post('/api/data', async (request) => {
      const body = request.body;
      return { received: body, timestamp: new Date() };
    });

    // Start listening for webview messages
    server.listen();

    // Set webview content
    panel.webview.html = getWebviewContent();

    // Cleanup on disposal
    panel.onDidDispose(() => server.close());
  });

  context.subscriptions.push(disposable);
}
```

### Webview Side (Client)

```html
<!DOCTYPE html>
<html>
<head>
    <title>My Extension Webview</title>
</head>
<body>
    <button onclick="fetchData()">Get Data</button>
    <div id="result"></div>

    <script>
        // Include the client library (you'd normally bundle this)
        // For now, we'll use the inline version from the example
        
        const vscode = acquireVsCodeApi();
        
        // Simple HTTP client (use @vscode-rest/client in production)
        class SimpleHttpClient {
            constructor() {
                this.pendingRequests = new Map();
                window.addEventListener('message', (event) => {
                    this.handleMessage(event.data);
                });
            }
            
            async fetch(url, options = {}) {
                const method = options.method || 'GET';
                const id = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
                
                const message = {
                    id, type: 'request', method, url,
                    headers: options.headers,
                    body: options.body,
                    timestamp: Date.now()
                };
                
                return new Promise((resolve, reject) => {
                    this.pendingRequests.set(id, { resolve, reject });
                    vscode.postMessage(message);
                });
            }
            
            handleMessage(message) {
                if (message.type === 'response' && this.pendingRequests.has(message.id)) {
                    const { resolve } = this.pendingRequests.get(message.id);
                    this.pendingRequests.delete(message.id);
                    resolve({
                        status: message.status,
                        json: () => Promise.resolve(message.body)
                    });
                }
            }
        }
        
        const client = new SimpleHttpClient();
        
        async function fetchData() {
            try {
                const response = await client.fetch('/api/hello');
                const data = await response.json();
                document.getElementById('result').textContent = JSON.stringify(data, null, 2);
            } catch (error) {
                console.error('Error:', error);
            }
        }
    </script>
</body>
</html>
```

## 📦 Packages

This is a monorepo with three main packages:

- **`@vscode-rest/server`**: Extension-side Fastify integration
- **`@vscode-rest/client`**: Webview-side HTTP client  
- **`@vscode-rest/shared`**: Shared protocol and utilities

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                VS Code Extension Host                        │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │   Fastify       │    │   VSCodeHttpTransportServer    │ │
│  │   Server        │────│   - Message routing            │ │
│  │   - Routes      │    │   - Request correlation        │ │
│  │   - Middleware  │    │   - Error handling             │ │
│  └─────────────────┘    └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                  │
                                  │ postMessage/onDidReceive
                                  │
┌─────────────────────────────────────────────────────────────┐
│                    Webview Process                          │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │   Web App       │    │   VSCodeHttpClient             │ │
│  │   - React/Vue   │────│   - HTTP API implementation    │ │
│  │   - Components  │    │   - Request/Response handling   │ │
│  └─────────────────┘    └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 🧪 Example

A complete working example is available in [`examples/basic-extension/`](examples/basic-extension/).

To run the example:

1. Open this workspace in VS Code
2. Navigate to `examples/basic-extension/` 
3. Press F5 to launch the Extension Development Host
4. In the new window, open Command Palette (Cmd/Ctrl+Shift+P)
5. Run "Open REST Webview Example"
6. Try the buttons to test the HTTP-like communication!

## 🔧 Development

### Building

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Development mode (watch)
npm run dev
```

### Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch
```

## 📋 API Reference

### Server Side

#### `createVSCodeFastify(config)`

Creates a Fastify instance with VS Code transport.

```typescript
interface VSCodeTransportConfig {
  webview: vscode.Webview;
  options?: {
    development?: {
      logging?: 'debug' | 'info' | 'warn' | 'error' | 'none';
      hotReload?: boolean;
    };
    timeout?: number;
  };
}
```

#### `createVSCodeTransport(config)`

Creates just the transport server (for advanced use cases).

### Client Side

#### `createVSCodeHttpClient(config?)`

Creates an HTTP client for webview communication.

```typescript
interface VSCodeClientConfig {
  baseUrl?: string;
  vscode?: VSCodeAPI; // Optional, auto-detected
}
```

#### `VSCodeHttpClient` Methods

- `fetch(url, options?)` - Make HTTP request
- `get(url, options?)` - GET request
- `post(url, body?, options?)` - POST request  
- `put(url, body?, options?)` - PUT request
- `delete(url, options?)` - DELETE request

## 🎯 Why This Library?

### Before (Manual Messaging)

```typescript
// Extension side - complex message handling
panel.webview.onDidReceiveMessage(message => {
  if (message.type === 'getData') {
    const data = getMyData();
    panel.webview.postMessage({ 
      type: 'dataResponse', 
      id: message.id, 
      data 
    });
  }
});

// Webview side - manual correlation
const id = Math.random().toString();
window.addEventListener('message', event => {
  if (event.data.type === 'dataResponse' && event.data.id === id) {
    handleData(event.data.data);
  }
});
vscode.postMessage({ type: 'getData', id });
```

### After (HTTP-like)

```typescript
// Extension side - familiar Fastify patterns
server.get('/api/data', async () => {
  return getMyData();
});

// Webview side - familiar fetch patterns  
const response = await client.fetch('/api/data');
const data = await response.json();
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Built with ❤️ for the VS Code extension community** 