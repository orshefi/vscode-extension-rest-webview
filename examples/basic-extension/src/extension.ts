import * as vscode from 'vscode';
import { createVSCodeFastify } from '@vscode-rest/server';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
  console.log('VS Code REST Webview Example extension is now active!');

  const disposable = vscode.commands.registerCommand(
    'vscode-rest-webview-example.openWebview',
    () => {
      // Create webview panel
      const panel = vscode.window.createWebviewPanel(
        'restWebviewExample',
        'REST Webview Example',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );

      // Create Fastify server with VS Code transport
      const server = createVSCodeFastify({
        webview: panel.webview,
        options: {
          development: {
            logging: 'debug',
            hotReload: true,
          },
        },
      });

      // Define API routes
      server.get('/api/hello', async (request: any, reply: any) => {
        return { message: 'Hello from VS Code extension!', timestamp: new Date().toISOString() };
      });

      server.get('/api/users', async (request: any, reply: any) => {
        return {
          users: [
            { id: 1, name: 'Alice', email: 'alice@example.com' },
            { id: 2, name: 'Bob', email: 'bob@example.com' },
            { id: 3, name: 'Charlie', email: 'charlie@example.com' },
          ],
        };
      });

      server.post('/api/users', async (request: any, reply: any) => {
        const body = request.body as any;
        const newUser = {
          id: Date.now(),
          name: body.name || 'Unknown',
          email: body.email || 'unknown@example.com',
        };
        
        reply.status(201);
        return { user: newUser, message: 'User created successfully' };
      });

      server.get('/api/workspace', async (request: any, reply: any) => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        return {
          workspace: workspaceFolders?.[0]?.uri.fsPath || 'No workspace open',
          folders: workspaceFolders?.map(f => f.name) || [],
        };
      });

      // Error handling
      server.setErrorHandler((error: any, request: any, reply: any) => {
        console.error('Fastify error:', error);
        reply.status(500).send({
          error: 'Internal Server Error',
          message: error.message,
        });
      });

      // Start the server
      server.listen().then(() => {
        console.log('VS Code REST server is listening for webview messages');
      });

      // Set webview HTML content
      panel.webview.html = getWebviewContent(context);

      // Cleanup when panel is disposed
      panel.onDidDispose(() => {
        server.close();
      });
    }
  );

  context.subscriptions.push(disposable);
}

function getClientLibraryScript(context: vscode.ExtensionContext): string {
  try {
    // Read the shared library (CommonJS)
    const sharedPath = path.join(context.extensionPath, '../../packages/shared/dist/index.js');
    const sharedLib = fs.readFileSync(sharedPath, 'utf8');
    
    // Read the client library (UMD)
    const clientPath = path.join(context.extensionPath, '../../packages/client/dist/index.umd.js');
    const clientLib = fs.readFileSync(clientPath, 'utf8');
    
    // Create a standalone bundle that works in the webview
    return `
      // Setup shared library as a global
      (function() {
        const exports = {};
        const module = { exports: exports };
        ${sharedLib}
        window.VSCodeRestShared = exports;
      })();
      
      // Load client library with shared dependency available
      (function() {
        // Make shared available as a global for the UMD module
        window.shared = window.VSCodeRestShared;
        
        // Load the UMD module
        ${clientLib}
        
        // Clean up temporary global
        delete window.shared;
      })();
    `;
  } catch (error) {
    console.error('Failed to load client library:', error);
    return `
      console.error('Failed to load VS Code REST client library:', ${JSON.stringify(error instanceof Error ? error.message : String(error))});
      // Fallback: create a simple mock client
      window.VSCodeRestClient = {
        createVSCodeHttpClient: function() {
          return {
            fetch: function() { 
              return Promise.reject(new Error('Client library failed to load')); 
            }
          };
        }
      };
    `;
  }
}

function getWebviewContent(context: vscode.ExtensionContext): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>REST Webview Example</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            margin: 4px;
            cursor: pointer;
            border-radius: 2px;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .response {
            background-color: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-panel-border);
            padding: 12px;
            margin: 8px 0;
            border-radius: 4px;
            white-space: pre-wrap;
            font-family: var(--vscode-editor-font-family);
        }
        input, textarea {
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 4px 8px;
            margin: 4px;
            width: 200px;
        }
        .section {
            margin: 20px 0;
            padding: 16px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>VS Code REST Webview Example</h1>
        <p>This demonstrates HTTP-like communication between the webview and extension using the <strong>@vscode-rest/client</strong> package.</p>
        <p><em>Note: This example now uses the official client library instead of a custom implementation.</em></p>
        
        <div class="section">
            <h2>Simple GET Requests</h2>
            <button onclick="fetchHello()">GET /api/hello</button>
            <button onclick="fetchUsers()">GET /api/users</button>
            <button onclick="fetchWorkspace()">GET /api/workspace</button>
        </div>

        <div class="section">
            <h2>POST Request</h2>
            <input type="text" id="userName" placeholder="User name" />
            <input type="email" id="userEmail" placeholder="User email" />
            <button onclick="createUser()">POST /api/users</button>
        </div>

        <div class="section">
            <h2>Response</h2>
            <div id="response" class="response">Click a button to see the response...</div>
        </div>
    </div>

    <script>
        // Load the official VS Code REST client library
        ${getClientLibraryScript(context)}
        
        // Create the HTTP client using the @vscode-rest/client package
        const client = VSCodeRestClient.createVSCodeHttpClient();
        
        async function fetchHello() {
            try {
                const response = await client.get('/api/hello');
                const data = await response.json();
                displayResponse('GET /api/hello', response.status, data);
            } catch (error) {
                displayError('GET /api/hello', error);
            }
        }
        
        async function fetchUsers() {
            try {
                const response = await client.get('/api/users');
                const data = await response.json();
                displayResponse('GET /api/users', response.status, data);
            } catch (error) {
                displayError('GET /api/users', error);
            }
        }
        
        async function fetchWorkspace() {
            try {
                const response = await client.get('/api/workspace');
                const data = await response.json();
                displayResponse('GET /api/workspace', response.status, data);
            } catch (error) {
                displayError('GET /api/workspace', error);
            }
        }
        
                 async function createUser() {
             const name = document.getElementById('userName').value;
             const email = document.getElementById('userEmail').value;
             
             if (!name || !email) {
                 displayError('POST /api/users', new Error('Please fill in both name and email'));
                 return;
             }
             
             try {
                 const response = await client.post('/api/users', { name, email }, {
                     headers: { 'Content-Type': 'application/json' }
                 });
                 const data = await response.json();
                 displayResponse('POST /api/users', response.status, data);
                 
                 // Clear form
                 document.getElementById('userName').value = '';
                 document.getElementById('userEmail').value = '';
             } catch (error) {
                 displayError('POST /api/users', error);
             }
         }
        
        function displayResponse(endpoint, status, data) {
            const responseDiv = document.getElementById('response');
            responseDiv.textContent = \`\${endpoint} - Status: \${status}\\n\\n\${JSON.stringify(data, null, 2)}\`;
        }
        
        function displayError(endpoint, error) {
            const responseDiv = document.getElementById('response');
            responseDiv.textContent = \`\${endpoint} - Error: \${error.message}\`;
        }
    </script>
</body>
</html>`;
}

export function deactivate() {
  console.log('VS Code REST Webview Example extension is now deactivated');
} 