import * as vscode from 'vscode';
import Fastify from 'fastify';
import { TransportOptions } from '@vscode-rest/shared';
import { VSCodeHttpTransportServer } from '../transport/vscode-transport-server';

/**
 * Configuration for creating VS Code transport
 */
export interface VSCodeTransportConfig {
  /** VS Code webview instance */
  webview: vscode.Webview;
  
  /** Transport options */
  options?: TransportOptions;
}

/**
 * Create a VS Code HTTP transport server
 */
export function createVSCodeTransport(config: VSCodeTransportConfig): VSCodeHttpTransportServer {
  return new VSCodeHttpTransportServer(config.webview, config.options);
}

/**
 * Create a complete Fastify instance with VS Code transport
 * 
 * @example
 * ```typescript
 * const server = createVSCodeFastify({
 *   webview: panel.webview
 * });
 * 
 * server.get('/api/hello', async () => {
 *   return { message: 'Hello!' };
 * });
 * 
 * await server.listen();
 * ```
 */
export function createVSCodeFastify(config: VSCodeTransportConfig) {
  const transport = createVSCodeTransport(config);
  
  // Create Fastify instance with serverFactory
  const server = Fastify({
    serverFactory: (handler: any) => {
      // Remove any existing listeners first to prevent duplicates
      transport.removeAllListeners('request');
      // Add the new handler
      transport.on('request', handler);
      return transport as any; // Type assertion needed for compatibility
    },
    logger: config.options?.development?.logging === 'debug'
  });

  return server;
} 