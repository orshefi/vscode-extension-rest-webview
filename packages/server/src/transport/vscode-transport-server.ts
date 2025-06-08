import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { 
  MessageProtocol, 
  RequestMessage, 
  ResponseMessage, 
  ErrorMessage,
  TransportOptions,
  isRequestMessage
} from '@vscode-rest/shared';

/**
 * Global instance registry to prevent multiple servers on same webview
 */
const webviewServerRegistry = new WeakMap<vscode.Webview, VSCodeHttpTransportServer>();



/**
 * Mock HTTP request object that Fastify expects
 */
export class VSCodeHttpRequest extends EventEmitter {
  public method: string;
  public url: string;
  public headers: Record<string, string>;
  public httpVersion = '1.1';
  public httpVersionMajor = 1;
  public httpVersionMinor = 1;
  public complete = true;
  public connection = this;
  public socket = this;
  public body: any;

  constructor(message: RequestMessage) {
    super();
    this.method = message.method;
    this.url = message.url;
    this.headers = message.headers || {};
    this.body = message.body;
    
    // Set content-type header if not present and we have a body
    if (this.body !== undefined && !this.headers['content-type']) {
      this.headers['content-type'] = 'application/json';
    }
    
    // Emit 'data' and 'end' events for body handling
    process.nextTick(() => {
      if (this.body !== undefined) {
        // Convert body to JSON string for Fastify's body parser
        const bodyString = typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
        const bodyBuffer = Buffer.from(bodyString);
        
        // Set content-length header for proper parsing
        this.headers['content-length'] = bodyBuffer.length.toString();
        
        this.emit('data', bodyBuffer);
      }
      this.emit('end');
    });
  }

  // Socket-like interface for compatibility
  readable = true;
  writable = true;
  
  read() { return null; }
  write() { return true; }
  end() { return this; }
  destroy() { return this; }
  pause() { return this; }
  resume() { return this; }
  setEncoding() { return this; }
  setKeepAlive() { return this; }
  setNoDelay() { return this; }
  setTimeout() { return this; }
  ref() { return this; }
  unref() { return this; }
}

/**
 * Mock HTTP response object that Fastify expects
 */
export class VSCodeHttpResponse extends EventEmitter {
  public statusCode = 200;
  public statusMessage = 'OK';
  public headers: Record<string, string> = {};
  public headersSent = false;
  public finished = false;
  public socket = this;
  public connection = this;

  private _body: any[] = [];
  private _correlationId: string;
  private _webview: vscode.Webview;
  private _disposed = false;
  private _responseSent = false;
  private _instanceId: string;

  constructor(correlationId: string, webview: vscode.Webview, instanceId: string) {
    super();
    this._correlationId = correlationId;
    this._webview = webview;
    this._instanceId = instanceId;
  }

  setHeader(name: string, value: string): void {
    if (this.headersSent || this._disposed) {
      return; // Silently ignore if disposed
    }
    this.headers[name.toLowerCase()] = value;
  }

  getHeader(name: string): string | undefined {
    return this.headers[name.toLowerCase()];
  }

  hasHeader(name: string): boolean {
    return name.toLowerCase() in this.headers;
  }

  getHeaders(): Record<string, string> {
    return { ...this.headers };
  }

  getHeaderNames(): string[] {
    return Object.keys(this.headers);
  }

  removeHeader(name: string): void {
    if (!this._disposed) {
      delete this.headers[name.toLowerCase()];
    }
  }

  writeHead(statusCode: number, statusMessage?: string, headers?: Record<string, string>): void {
    if (this.headersSent || this._disposed || this._responseSent) {
      return; // Silently ignore to prevent race conditions
    }
    
    this.statusCode = statusCode;
    if (statusMessage) {
      this.statusMessage = statusMessage;
    }
    if (headers) {
      Object.assign(this.headers, headers);
    }
    this.headersSent = true;
  }

  write(chunk: any): boolean {
    if (this.finished || this._disposed || this._responseSent) {
      return false;
    }
    
    // Auto-send headers on first write if not already sent
    if (!this.headersSent) {
      this.headersSent = true;
    }
    
    this._body.push(chunk);
    return true;
  }

  end(chunk?: any): void {
    // Use atomic check-and-set to prevent double-ending
    if (this.finished || this._disposed || this._responseSent) {
      return;
    }

    // Mark as response sent atomically
    this._responseSent = true;

    if (chunk !== undefined) {
      this._body.push(chunk);
    }

    // Ensure headers are marked as sent before finishing
    if (!this.headersSent) {
      this.headersSent = true;
    }

    this.finished = true;
    this.emit('finish');

    // Send response back to webview - wrap in try/catch for safety
    try {
      const responseMessage: ResponseMessage = {
        id: this._correlationId,
        type: 'response',
        status: this.statusCode as any,
        headers: this.headers,
        body: this._body.length > 0 ? this._combineBody() : undefined,
        timestamp: Date.now(),
        ...(this._instanceId && { instanceId: this._instanceId }), // Add instance ID for routing
      };

      this._webview.postMessage(responseMessage);
    } catch (error) {
      // Webview might be disposed, silently ignore
      console.warn(`[VSCodeHttpResponse] Failed to send response for ${this._correlationId}:`, error);
    }
  }

  /**
   * Dispose of this response and prevent further operations
   */
  dispose(): void {
    if (this._disposed) {
      return;
    }
    
    this._disposed = true;
    this.finished = true;
    this.removeAllListeners();
  }

  private _combineBody(): any {
    if (this._body.length === 0) {
      return undefined;
    }

    // Combine all body chunks
    const combined = this._body.join('');
    
    // Try to parse as JSON if it looks like JSON
    if (combined.startsWith('{') || combined.startsWith('[')) {
      try {
        return JSON.parse(combined);
      } catch {
        // Fall back to string
      }
    }
    
    return combined;
  }

  // Additional methods for compatibility
  writeContinue(): void {}
  addTrailers(): void {}
  cork(): void {}
  uncork(): void {}
  flushHeaders(): void {}
  setTimeout(): this { return this; }
  ref(): this { return this; }
  unref(): this { return this; }
  
  // Stream-like methods
  pipe(): this { return this; }
  unpipe(): this { return this; }
  
  // Override EventEmitter methods to return this for chaining
  on(event: string | symbol, listener: (...args: any[]) => void): this {
    if (!this._disposed) {
      super.on(event, listener);
    }
    return this;
  }
  
  once(event: string | symbol, listener: (...args: any[]) => void): this {
    if (!this._disposed) {
      super.once(event, listener);
    }
    return this;
  }
  
  off(event: string | symbol, listener: (...args: any[]) => void): this {
    super.off(event, listener);
    return this;
  }
  
  // Writable stream properties
  writable = true;
  destroyed = false;
  
  // Additional Node.js HTTP response compatibility
  sendDate = true;
  strictContentLength = false;
}

/**
 * VS Code HTTP Transport Server - implements Node.js HTTP server interface for Fastify
 */
export class VSCodeHttpTransportServer extends EventEmitter {
  public listening = false;
  private _webview: vscode.Webview;
  private _options: TransportOptions;
  private _listening = false;
  private _disposed = false;
  private _disposables: vscode.Disposable[] = [];
  private _pendingResponses = new Set<VSCodeHttpResponse>();
  private _messageHandlerLock = false;
  private _instanceId: string;

  constructor(webview: vscode.Webview, options: TransportOptions = {}) {
    super();
    this._webview = webview;
    this._options = options;
    this._instanceId = `server_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check for existing server on this webview
    const existingServer = webviewServerRegistry.get(webview);
    if (existingServer && !existingServer.isDisposed()) {
      console.warn('[VSCodeHttpTransportServer] Warning: Multiple servers detected on same webview. This may cause conflicts.');
      if (options.development?.logging === 'debug') {
        console.warn('[VSCodeHttpTransportServer] Consider using a single server instance per webview.');
      }
    }

    // Register this instance
    webviewServerRegistry.set(webview, this);
  }

  /**
   * Start listening for messages (Fastify calls this)
   */
  listen(port?: number, hostname?: string, backlog?: number, callback?: () => void): this {
    if (this._listening || this._disposed) {
      if (this._disposed) {
        if (callback) {
          process.nextTick(() => callback());
        }
        return this;
      }
      // Server is already listening - this is a common scenario
      // Instead of throwing an error, we'll handle it gracefully
      if (this._options.development?.logging === 'debug') {
        console.log(`[VSCodeHttpTransportServer:${this._instanceId}] Listen called on already listening server - ignoring`);
      }
      
      // Call callback to indicate we're ready (idempotent behavior)
      if (callback) {
        process.nextTick(callback);
      }
      return this;
    }

    this._listening = true;

    // Set up message listener with instance filtering
    const messageDisposable = this._webview.onDidReceiveMessage(
      (message: MessageProtocol) => this._handleMessage(message)
    );
    this._disposables.push(messageDisposable);

    // Log if in debug mode
    if (this._options.development?.logging === 'debug') {
      console.log(`[VSCodeHttpTransportServer:${this._instanceId}] Started listening for messages`);
    }

    // Call callback to indicate we're ready
    if (callback) {
      process.nextTick(callback);
    }

    this.emit('listening');
    return this;
  }

  /**
   * Stop listening and cleanup
   */
  close(callback?: () => void): this {
    if (!this._listening || this._disposed) {
      if (callback) process.nextTick(callback);
      return this;
    }

    this._listening = false;
    this._disposed = true;

    // Cleanup all pending responses
    for (const response of this._pendingResponses) {
      response.dispose();
    }
    this._pendingResponses.clear();

    // Cleanup disposables
    this._disposables.forEach(d => d.dispose());
    this._disposables = [];

    // Remove from registry if this is the registered instance
    const registeredServer = webviewServerRegistry.get(this._webview);
    if (registeredServer === this) {
      webviewServerRegistry.delete(this._webview);
    }

    // Remove all event listeners to prevent memory leaks
    this.removeAllListeners();

    if (this._options.development?.logging === 'debug') {
      console.log(`[VSCodeHttpTransportServer:${this._instanceId}] Stopped listening`);
    }

    this.emit('close');
    
    if (callback) {
      process.nextTick(callback);
    }

    return this;
  }

  /**
   * Handle incoming messages from webview with thread safety and instance filtering
   */
  private _handleMessage(message: MessageProtocol): void {
    // Prevent concurrent message handling
    if (this._messageHandlerLock || this._disposed || !this._listening) {
      return;
    }

    if (!isRequestMessage(message)) {
      return; // Ignore non-request messages
    }

    // Check if this server is the primary handler for this webview
    const registeredServer = webviewServerRegistry.get(this._webview);
    if (registeredServer !== this && registeredServer && !registeredServer.isDisposed()) {
      // Let the registered server handle this message
      return;
    }

    // Set lock to prevent concurrent execution
    this._messageHandlerLock = true;

    if (this._options.development?.logging === 'debug') {
      console.log(`[VSCodeHttpTransportServer:${this._instanceId}] Received request: ${message.method} ${message.url}`);
    }

    try {
      // Create mock HTTP request/response objects
      const req = new VSCodeHttpRequest(message);
      const res = new VSCodeHttpResponse(message.id, this._webview, this._instanceId);
      
      // Track the response for cleanup
      this._pendingResponses.add(res);
      
      // Clean up when response is finished
      res.once('finish', () => {
        this._pendingResponses.delete(res);
      });
      
      // Emit 'request' event that Fastify listens for
      this.emit('request', req, res);

    } catch (error) {
      if (this._options.development?.logging === 'debug') {
        console.error(`[VSCodeHttpTransportServer:${this._instanceId}] Error handling message:`, error);
      }
      
      // Send error response safely
      this._sendErrorResponse(message.id, error);
    } finally {
      // Always release the lock
      this._messageHandlerLock = false;
    }
  }

  /**
   * Safely send error response
   */
  private _sendErrorResponse(messageId: string, error: unknown): void {
    if (this._disposed) {
      return;
    }

    try {
      const errorMessage: ErrorMessage = {
        id: messageId,
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 500,
        timestamp: Date.now(),
        ...(this._instanceId && { instanceId: this._instanceId }),
      };

      this._webview.postMessage(errorMessage);
    } catch (postError) {
      // Webview might be disposed, silently ignore
      console.warn(`[VSCodeHttpTransportServer:${this._instanceId}] Failed to send error response:`, postError);
    }
  }

  /**
   * Get server address (for Fastify compatibility)
   */
  address(): { port: number; family: string; address: string } | null {
    return (this._listening && !this._disposed) ? { port: 0, family: 'IPv4', address: 'vscode-webview' } : null;
  }

  /**
   * Check if server is disposed
   */
  isDisposed(): boolean {
    return this._disposed;
  }

  /**
   * Get instance ID
   */
  getInstanceId(): string {
    return this._instanceId;
  }

  /**
   * Check if this is the primary server for the webview
   */
  isPrimaryServer(): boolean {
    const registeredServer = webviewServerRegistry.get(this._webview);
    return registeredServer === this;
  }

  /**
   * Get max listeners (for EventEmitter compatibility)
   */
  getMaxListeners(): number {
    return super.getMaxListeners();
  }

  /**
   * Set max listeners (for EventEmitter compatibility)  
   */
  setMaxListeners(n: number): this {
    return super.setMaxListeners(n);
  }

  // Additional HTTP server methods for compatibility
  timeout = 0;
  keepAliveTimeout = 5000;
  maxHeadersCount = null;
  headersTimeout = 60000;
  requestTimeout = 0;
} 