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

First, install the client library in your extension project:

```bash
npm install @vscode-rest/client
```

#### Option 1: Using a Build Tool (Recommended)

Create a webview TypeScript/JavaScript file:

```typescript
// src/webview/main.ts
import { VSCodeHttpClient } from '@vscode-rest/client';

const vscode = acquireVsCodeApi();
const client = new VSCodeHttpClient(vscode);

async function fetchData() {
    try {
        const response = await client.get('/api/hello');
        const data = await response.json();
        document.getElementById('result')!.textContent = JSON.stringify(data, null, 2);
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('result')!.textContent = 'Error: ' + (error as Error).message;
    }
}

async function postData() {
    try {
        const response = await client.post('/api/data', {
            message: 'Hello from webview!',
            timestamp: new Date().toISOString()
        });
        const data = await response.json();
        document.getElementById('result')!.textContent = JSON.stringify(data, null, 2);
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('result')!.textContent = 'Error: ' + (error as Error).message;
    }
}

// Make functions globally available
(globalThis as any).fetchData = fetchData;
(globalThis as any).postData = postData;
```

Bundle with webpack, rollup, or your preferred bundler. Here's a sample webpack config for the webview:

```javascript
// webpack.webview.config.js
const path = require('path');

module.exports = {
    entry: './src/webview/main.ts',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
        filename: 'main.js',
        path: path.resolve(__dirname, 'dist', 'webview'),
    },
    mode: 'development',
    devtool: 'source-map',
};
```

Then reference the bundled file:

```html
<!DOCTYPE html>
<html>
<head>
    <title>My Extension Webview</title>
</head>
<body>
    <button onclick="fetchData()">Get Hello</button>
    <button onclick="postData()">Post Data</button>
    <div id="result"></div>
    
    <!-- Reference your bundled script -->
    <script src="${scriptUri}"></script>
</body>
</html>
```

#### Option 2: Pre-bundled UMD (No Build Step)

You can also use a pre-built UMD bundle by copying it to your extension's resources:

```bash
# Copy the UMD bundle to your extension
cp node_modules/@vscode-rest/client/dist/index.umd.js src/webview/
```

Then reference it locally:

```html
<!DOCTYPE html>
<html>
<head>
    <title>My Extension Webview</title>
</head>
<body>
    <button onclick="fetchData()">Get Hello</button>
    <button onclick="postData()">Post Data</button>
    <div id="result"></div>

    <script src="${clientScriptUri}"></script>
    <script>
        const vscode = acquireVsCodeApi();
        const client = new VSCodeRest.VSCodeHttpClient(vscode);
        
        async function fetchData() {
            try {
                const response = await client.get('/api/hello');
                const data = await response.json();
                document.getElementById('result').textContent = JSON.stringify(data, null, 2);
            } catch (error) {
                console.error('Error:', error);
                document.getElementById('result').textContent = 'Error: ' + error.message;
            }
        }
        
        async function postData() {
            try {
                const response = await client.post('/api/data', {
                    message: 'Hello from webview!',
                    timestamp: new Date().toISOString()
                });
                const data = await response.json();
                document.getElementById('result').textContent = JSON.stringify(data, null, 2);
            } catch (error) {
                console.error('Error:', error);
                document.getElementById('result').textContent = 'Error: ' + error.message;
            }
        }
    </script>
</body>
</html>
```

#### Extension Code for Serving Scripts

In your extension, you'll need to serve the script with proper URIs:

```typescript
// In your extension activation
function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
    // Option 1: Bundled script
    const scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'dist', 'webview', 'main.js')
    );
    
    // Option 2: UMD script
    const clientScriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'src', 'webview', 'index.umd.js')
    );

    return `<!DOCTYPE html>
    <html>
    <head>
        <title>My Extension Webview</title>
    </head>
    <body>
        <button onclick="fetchData()">Get Hello</button>
        <button onclick="postData()">Post Data</button>
        <div id="result"></div>
        
        <script src="${scriptUri}"></script>
    </body>
    </html>`;
}

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

## 🆔 Multiple Servers & Instance IDs

When creating multiple servers (e.g., in CustomEditorProvider), you need to coordinate instance IDs between client and server to avoid message routing conflicts.

### Problem
Multiple servers can cause instance ID mismatches where:
- Request comes from client with one instance ID
- Response comes back from a different server with a different instance ID
- Client rejects the response due to ID mismatch

### Solution: Custom Instance IDs

#### Extension Side (Server)
```typescript
import { createVSCodeTransport } from '@vscode-rest/server';

class MyCustomEditorProvider implements vscode.CustomEditorProvider {
  async resolveCustomEditor(document: vscode.CustomDocument, webviewPanel: vscode.WebviewPanel) {
    // Create unique instance ID for this editor
    const instanceId = `editor_${document.uri.toString()}`;
    
    // Create server with custom instance ID
    const server = createVSCodeTransport({
      webview: webviewPanel.webview,
      options: {
        instanceId: instanceId
      }
    });
    
    // Pass the instanceId to the webview
    webviewPanel.webview.html = `
      <!DOCTYPE html>
      <html>
      <head>
        <script>
          window.SERVER_INSTANCE_ID = '${instanceId}';
        </script>
      </head>
      <body>
        <script src="client.js"></script>
      </body>
      </html>
    `;
  }
}
```

#### Webview Side (Client)
```typescript
import { VSCodeHttpClient } from '@vscode-rest/client';

// Get the instance ID that was passed from the extension
const instanceId = (window as any).SERVER_INSTANCE_ID;

// Create client with matching instance ID
const client = new VSCodeHttpClient(undefined, {
  instanceId: instanceId
});

// Now requests and responses will have matching instance IDs
const response = await client.get('/api/data');
```

#### Multiple Servers Example
```typescript
// Extension side - multiple servers for different purposes
const apiServer = createVSCodeTransport({
  webview: panel.webview,
  options: { instanceId: 'api-server' }
});

const fileServer = createVSCodeTransport({
  webview: panel.webview,
  options: { instanceId: 'file-server' }
});

// Webview side - corresponding clients
const apiClient = new VSCodeHttpClient(undefined, {
  instanceId: 'api-server'
});

const fileClient = new VSCodeHttpClient(undefined, {
  instanceId: 'file-server'
});
```

### Benefits
- ✅ No instance ID mismatches
- ✅ Multiple editors work independently  
- ✅ Predictable, debuggable instance IDs
- ✅ Full control over server/client pairing
- ✅ Backward compatible (auto-generates IDs if not provided)

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

#### `new VSCodeHttpClient(vscode?, options?)` or `createVSCodeHttpClient(config?)`

Creates an HTTP client for webview communication.

```typescript
// Constructor options
interface ClientOptions {
  /** Custom instance ID to match server instance */
  instanceId?: string;
  /** Base URL for relative requests */
  baseUrl?: string;
}

// Factory function config
interface VSCodeClientConfig {
  /** Base URL for relative requests */
  baseUrl?: string;
  /** Custom instance ID to match server instance */
  instanceId?: string;
  /** VS Code API instance (optional, will use global if available) */
  vscode?: any;
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

// Webview side - familiar fetch patterns using @vscode-rest/client
import { VSCodeHttpClient } from '@vscode-rest/client';

const client = new VSCodeHttpClient();
const response = await client.get('/api/data');
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