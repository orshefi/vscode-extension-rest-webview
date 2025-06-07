import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { 
  MessageProtocol, 
  RequestMessage, 
  ResponseMessage, 
  ErrorMessage,
  TransportOptions,
  isRequestMessage,
  generateCorrelationId 
} from '@vscode-rest/shared';

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

  constructor(correlationId: string, webview: vscode.Webview) {
    super();
    this._correlationId = correlationId;
    this._webview = webview;
  }

  setHeader(name: string, value: string): void {
    if (this.headersSent) {
      throw new Error('Cannot set headers after they are sent');
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
    delete this.headers[name.toLowerCase()];
  }

  writeHead(statusCode: number, statusMessage?: string, headers?: Record<string, string>): void {
    if (this.headersSent) {
      // Instead of throwing, silently return - this prevents Fastify error handling loops
      return;
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
    if (this.finished) {
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
    if (this.finished) {
      // Prevent double-ending the response
      return;
    }

    if (chunk !== undefined) {
      this._body.push(chunk);
    }

    // Ensure headers are marked as sent before finishing
    if (!this.headersSent) {
      this.headersSent = true;
    }

    this.finished = true;
    this.emit('finish');

    // Send response back to webview
    const responseMessage: ResponseMessage = {
      id: this._correlationId,
      type: 'response',
      status: this.statusCode as any,
      headers: this.headers,
      body: this._body.length > 0 ? this._combineBody() : undefined,
      timestamp: Date.now(),
    };

    this._webview.postMessage(responseMessage);
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
    super.on(event, listener);
    return this;
  }
  
  once(event: string | symbol, listener: (...args: any[]) => void): this {
    super.once(event, listener);
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
  private _disposables: vscode.Disposable[] = [];

  constructor(webview: vscode.Webview, options: TransportOptions = {}) {
    super();
    this._webview = webview;
    this._options = options;
  }

  /**
   * Start listening for messages (Fastify calls this)
   */
  listen(port?: number, hostname?: string, backlog?: number, callback?: () => void): this {
    if (this._listening) {
      throw new Error('Server is already listening');
    }

    this._listening = true;

    // Set up message listener
    const messageDisposable = this._webview.onDidReceiveMessage(
      (message: MessageProtocol) => this._handleMessage(message)
    );
    this._disposables.push(messageDisposable);

    // Log if in debug mode
    if (this._options.development?.logging === 'debug') {
      console.log('[VSCodeHttpTransportServer] Started listening for messages');
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
    if (!this._listening) {
      if (callback) process.nextTick(callback);
      return this;
    }

    this._listening = false;

    // Cleanup disposables
    this._disposables.forEach(d => d.dispose());
    this._disposables = [];

    if (this._options.development?.logging === 'debug') {
      console.log('[VSCodeHttpTransportServer] Stopped listening');
    }

    this.emit('close');
    
    if (callback) {
      process.nextTick(callback);
    }

    return this;
  }

  /**
   * Handle incoming messages from webview
   */
  private _handleMessage(message: MessageProtocol): void {
    if (!isRequestMessage(message)) {
      return; // Ignore non-request messages
    }

    if (this._options.development?.logging === 'debug') {
      console.log(`[VSCodeHttpTransportServer] Received request: ${message.method} ${message.url}`);
    }

    try {
      // Create mock HTTP request/response objects
      const req = new VSCodeHttpRequest(message);
      const res = new VSCodeHttpResponse(message.id, this._webview);
      
      // Emit 'request' event that Fastify listens for
      this.emit('request', req, res);

    } catch (error) {
      if (this._options.development?.logging === 'debug') {
        console.error(`[VSCodeHttpTransportServer] Error handling message:`, error);
      }
      
      // Send error response
      const errorMessage: ErrorMessage = {
        id: message.id,
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 500,
        timestamp: Date.now(),
      };

      this._webview.postMessage(errorMessage);
    }
  }

  /**
   * Get server address (for Fastify compatibility)
   */
  address(): { port: number; family: string; address: string } | null {
    return this._listening ? { port: 0, family: 'IPv4', address: 'vscode-webview' } : null;
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