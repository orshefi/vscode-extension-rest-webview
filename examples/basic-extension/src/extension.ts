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
      panel.webview.html = getWebviewContent(context, panel.webview);

      // Cleanup when panel is disposed
      panel.onDidDispose(() => {
        server.close();
      });
    }
  );

  context.subscriptions.push(disposable);
}

function getWebviewContent(context: vscode.ExtensionContext, webview: vscode.Webview): string {
  // Get path to bundled webview assets
  const webviewUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview.js'));
  
  try {
    // Read the bundled HTML file
    const htmlPath = path.join(context.extensionPath, 'dist', 'webview.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    
    // Replace the script tag to use the correct URI
    html = html.replace(
      '<script defer src="webview.js"></script>',
      `<script defer src="${webviewUri}"></script>`
    );
    
    return html;
  } catch (error) {
    console.error('Failed to load bundled webview:', error);
    
    // Fallback to basic HTML if bundled version fails
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>REST Webview Example</title>
</head>
<body>
    <div style="padding: 20px; color: var(--vscode-foreground);">
        <h1>Error Loading Webview</h1>
        <p>Failed to load the bundled webview. Please ensure the webview has been built with <code>npm run build:webview</code>.</p>
        <p>Error: ${error instanceof Error ? error.message : String(error)}</p>
    </div>
</body>
</html>`;
  }
}

export function deactivate() {
  console.log('VS Code REST Webview Example extension is now deactivated');
} 