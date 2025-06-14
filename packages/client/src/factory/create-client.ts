import { VSCodeHttpClient, ClientOptions } from '../http-client/vscode-http-client';

/**
 * Configuration for creating VS Code HTTP client
 */
export interface VSCodeClientConfig {
  /** Base URL for relative requests */
  baseUrl?: string;
  
  /** Custom instance ID to match server instance */
  instanceId?: string;
  
  /** VS Code API instance (optional, will use global if available) */
  vscode?: any;
}

/**
 * Create a VS Code HTTP client for webview communication
 * 
 * @example
 * ```typescript
 * const client = createVSCodeHttpClient();
 * const response = await client.get('/api/data');
 * const data = await response.json();
 * ```
 */
export function createVSCodeHttpClient(config: VSCodeClientConfig = {}): VSCodeHttpClient {
  const options: ClientOptions = {
    baseUrl: config.baseUrl,
    instanceId: config.instanceId
  };
  
  return new VSCodeHttpClient(config.vscode, options);
} 