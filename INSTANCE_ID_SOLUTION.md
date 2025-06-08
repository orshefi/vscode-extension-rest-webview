# Instance ID Solution for Multiple Servers

## Problem
When multiple servers are created on the same webview (e.g., in CustomEditorProvider), instance ID mismatches occur where:
- Request comes from client with one instance ID
- Response comes back from a different server with a different instance ID
- Client rejects the response due to ID mismatch

## Solution: User-Provided Instance IDs

Instead of complex registry logic, allow users to provide unique `instanceId` values for each server.

### API Usage

#### Basic Usage (Backward Compatible)
```typescript
// Auto-generates instanceId like before
const server = createVSCodeTransport({
  webview: panel.webview
});
```

#### Multiple Servers with Custom IDs
```typescript
// CustomEditorProvider example
class MyCustomEditorProvider implements vscode.CustomEditorProvider {
  resolveCustomEditor(document: vscode.CustomDocument, webviewPanel: vscode.WebviewPanel) {
    // Use document URI as unique identifier
    const server = createVSCodeTransport({
      webview: webviewPanel.webview,
      options: {
        instanceId: `editor_${document.uri.toString()}`
      }
    });
    
    // Each editor has a predictable, unique server instance
  }
}
```

#### Multiple Servers on Same Webview
```typescript
// Different servers for different purposes
const apiServer = createVSCodeTransport({
  webview: panel.webview,
  options: { instanceId: 'api-server' }
});

const fileServer = createVSCodeTransport({
  webview: panel.webview,
  options: { instanceId: 'file-server' }
});
```

### Benefits

1. **No Instance ID Mismatches**: Each server has a predictable, user-controlled ID
2. **No Race Conditions**: Multiple servers don't interfere with each other
3. **Developer Control**: You decide what makes each server unique
4. **Backward Compatible**: Existing code works unchanged
5. **Much Simpler**: No complex registry or cleanup logic

### How It Works

1. **Server Side**: Each server responds with its own `instanceId`
2. **Client Side**: Already filters messages by `instanceId` 
3. **Result**: Only the intended client receives each response

This eliminates the registry complexity while giving developers full control over server identification. 