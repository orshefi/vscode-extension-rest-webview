import {
  MessageProtocol,
  RequestMessage,
  ResponseMessage,
  HttpMethod,
  HttpStatusCode,
  generateCorrelationId,
  CorrelationManager,
  isResponseMessage,
  isErrorMessage,
} from '@vscode-rest/shared';

/**
 * VS Code API interface for webview messaging
 */
interface VSCodeAPI {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
}

/**
 * Global instance registry to prevent multiple clients in same context
 */
const globalClientRegistry = new Set<VSCodeHttpClient>();
let primaryClient: VSCodeHttpClient | null = null;

/**
 * Response-like object that mimics the Fetch API Response
 */
export class VSCodeHttpResponse {
  public readonly status: number;
  public readonly statusText: string;
  public readonly headers: Headers;
  public readonly ok: boolean;
  public readonly url: string;
  
  private _body: any;

  constructor(message: ResponseMessage, url: string) {
    this.status = message.status;
    this.statusText = this._getStatusText(message.status);
    this.headers = new Headers(message.headers || {});
    this.ok = message.status >= 200 && message.status < 300;
    this.url = url;
    this._body = message.body;
  }

  async json(): Promise<any> {
    if (this._body === undefined || this._body === null) {
      throw new Error('Response body is empty');
    }

    if (typeof this._body === 'object') {
      return this._body;
    }

    try {
      return JSON.parse(this._body);
    } catch (error) {
      throw new Error('Response is not valid JSON');
    }
  }

  async text(): Promise<string> {
    if (this._body === undefined || this._body === null) {
      return '';
    }
    return typeof this._body === 'string' ? this._body : JSON.stringify(this._body);
  }

  async blob(): Promise<Blob> {
    const text = await this.text();
    return new Blob([text], { type: 'application/json' });
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    const text = await this.text();
    const encoder = new TextEncoder();
    return encoder.encode(text).buffer;
  }

  clone(): VSCodeHttpResponse {
    const headersObj: Record<string, string> = {};
    this.headers.forEach((value, key) => headersObj[key] = value);
    
    return new VSCodeHttpResponse({
      id: '',
      type: 'response',
      status: this.status as HttpStatusCode,
      headers: headersObj,
      body: this._body,
      timestamp: Date.now(),
    }, this.url);
  }

  private _getStatusText(status: number): string {
    const statusTexts: Record<number, string> = {
      200: 'OK',
      201: 'Created',
      202: 'Accepted',
      204: 'No Content',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      405: 'Method Not Allowed',
      408: 'Request Timeout',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      500: 'Internal Server Error',
      501: 'Not Implemented',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
    };
    return statusTexts[status] || 'Unknown';
  }
}

/**
 * Error class for HTTP errors
 */
export class VSCodeHttpError extends Error {
  public readonly status: number;
  public readonly response: VSCodeHttpResponse;

  constructor(message: string, status: number, response: VSCodeHttpResponse) {
    super(message);
    this.name = 'VSCodeHttpError';
    this.status = status;
    this.response = response;
  }
}

/**
 * Request options for the HTTP client
 */
export interface RequestOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

/**
 * Configuration options for the HTTP client
 */
export interface ClientOptions {
  /** Custom instance ID to match server instance */
  instanceId?: string;
  /** Base URL for relative requests */
  baseUrl?: string;
}

/**
 * VS Code HTTP Client - provides fetch-like API for webview communication
 */
export class VSCodeHttpClient {
  private _vscode: VSCodeAPI;
  private _correlationManager: CorrelationManager;
  private _baseUrl: string;
  private _disposed = false;
  private _messageHandler: (event: MessageEvent) => void;
  private _pendingRequests = new Set<string>();
  private _instanceId: string;

  constructor(vscode?: VSCodeAPI, optionsOrBaseUrl?: ClientOptions | string) {
    // Use global vscode API if available, otherwise require it to be passed
    this._vscode = vscode || (globalThis as any).acquireVsCodeApi?.();
    if (!this._vscode) {
      throw new Error('VS Code API not available. Make sure this is running in a VS Code webview.');
    }

    // Handle both old string baseUrl parameter and new options object for backward compatibility
    let options: ClientOptions;
    if (typeof optionsOrBaseUrl === 'string') {
      options = { baseUrl: optionsOrBaseUrl };
    } else {
      options = optionsOrBaseUrl || {};
    }

    this._baseUrl = options.baseUrl || '';
    this._correlationManager = new CorrelationManager();
    
    // Use provided instanceId or generate one
    this._instanceId = options.instanceId || `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check for existing clients
    if (globalClientRegistry.size > 0) {
      console.warn('[VSCodeHttpClient] Warning: Multiple HTTP clients detected. This may cause message routing conflicts.');
      console.warn('[VSCodeHttpClient] Consider using a single client instance per webview.');
    }

    // Register this instance
    globalClientRegistry.add(this);
    
    // Set as primary if none exists or previous primary is disposed
    if (!primaryClient || primaryClient.isDisposed()) {
      primaryClient = this;
    }

    // Create bound message handler to prevent duplicates
    this._messageHandler = (event: MessageEvent) => {
      if (!this._disposed) {
        this._handleMessage(event.data);
      }
    };

    // Listen for messages from extension
    window.addEventListener('message', this._messageHandler);
  }

  /**
   * Make an HTTP request (fetch-like API)
   */
  async fetch(url: string, options: RequestOptions = {}): Promise<VSCodeHttpResponse> {
    if (this._disposed) {
      throw new Error('HTTP client has been disposed');
    }

    const method = options.method || 'GET';
    const fullUrl = this._resolveUrl(url);
    const correlationId = generateCorrelationId();

    // Track pending request
    this._pendingRequests.add(correlationId);

    const requestMessage: RequestMessage = {
      id: correlationId,
      type: 'request',
      method,
      url: fullUrl,
      headers: options.headers,
      body: options.body,
      timestamp: Date.now(),
      ...(this._instanceId && { instanceId: this._instanceId }), // Add instance ID for routing
    };

    return new Promise((resolve, reject) => {
      // Check if disposed before setting up the request
      if (this._disposed) {
        this._pendingRequests.delete(correlationId);
        reject(new Error('HTTP client has been disposed'));
        return;
      }

      // Add to correlation manager
      this._correlationManager.addPendingRequest(
        correlationId,
        (response) => {
          this._pendingRequests.delete(correlationId);
          
          if (this._disposed) {
            reject(new Error('HTTP client has been disposed'));
            return;
          }

          const httpResponse = new VSCodeHttpResponse(response, fullUrl);
          if (httpResponse.ok) {
            resolve(httpResponse);
          } else {
            reject(new VSCodeHttpError(
              `HTTP ${response.status}: ${httpResponse.statusText}`,
              response.status,
              httpResponse
            ));
          }
        },
        (error) => {
          this._pendingRequests.delete(correlationId);
          
          if (this._disposed) {
            reject(new Error('HTTP client has been disposed'));
            return;
          }

          reject(new VSCodeHttpError(error.error, error.status, 
            new VSCodeHttpResponse({
              id: error.id,
              type: 'response',
              status: error.status,
              body: { error: error.error },
              timestamp: error.timestamp,
            }, fullUrl)
          ));
        },
        options.timeout
      );

      // Send message to extension safely
      try {
        this._vscode.postMessage(requestMessage);
      } catch (error) {
        this._pendingRequests.delete(correlationId);
        this._correlationManager.rejectRequest(correlationId, {
          id: correlationId,
          type: 'error',
          error: error instanceof Error ? error.message : 'Failed to send message',
          status: 503,
          timestamp: Date.now(),
        });
      }
    });
  }

  /**
   * Convenience methods for common HTTP verbs
   */
  async get(url: string, options: Omit<RequestOptions, 'method'> = {}): Promise<VSCodeHttpResponse> {
    return this.fetch(url, { ...options, method: 'GET' });
  }

  async post(url: string, body?: any, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<VSCodeHttpResponse> {
    return this.fetch(url, { ...options, method: 'POST', body });
  }

  async put(url: string, body?: any, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<VSCodeHttpResponse> {
    return this.fetch(url, { ...options, method: 'PUT', body });
  }

  async delete(url: string, options: Omit<RequestOptions, 'method'> = {}): Promise<VSCodeHttpResponse> {
    return this.fetch(url, { ...options, method: 'DELETE' });
  }

  async patch(url: string, body?: any, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<VSCodeHttpResponse> {
    return this.fetch(url, { ...options, method: 'PATCH', body });
  }

  /**
   * Handle incoming messages from extension with thread safety and instance filtering
   */
  private _handleMessage(message: MessageProtocol): void {
    if (this._disposed) {
      return;
    }

    // If message has instanceId, check if it's for this client
    const messageWithInstanceId = message as MessageProtocol & { instanceId?: string };
    if (messageWithInstanceId.instanceId && messageWithInstanceId.instanceId !== this._instanceId) {
      return; // Not for this client instance
    }

    // If no instanceId but this isn't the primary client, let primary handle it
    if (!messageWithInstanceId.instanceId && primaryClient !== this && primaryClient && !primaryClient.isDisposed()) {
      return; // Let primary client handle
    }

    if (isResponseMessage(message)) {
      this._correlationManager.resolveRequest(message.id, message);
    } else if (isErrorMessage(message)) {
      this._correlationManager.rejectRequest(message.id, message);
    }
  }

  /**
   * Resolve relative URLs against base URL
   */
  private _resolveUrl(url: string): string {
    if (url.startsWith('/') || url.includes('://')) {
      return url;
    }
    return this._baseUrl ? `${this._baseUrl}/${url}`.replace(/\/+/g, '/') : url;
  }

  /**
   * Check if client is disposed
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
   * Check if this is the primary client
   */
  isPrimaryClient(): boolean {
    return primaryClient === this;
  }

  /**
   * Get count of pending requests
   */
  getPendingRequestCount(): number {
    return this._pendingRequests.size;
  }

  /**
   * Cleanup resources and prevent further operations
   */
  dispose(): void {
    if (this._disposed) {
      return;
    }

    this._disposed = true;

    // Remove from registry
    globalClientRegistry.delete(this);
    
    // Update primary client if this was primary
    if (primaryClient === this) {
      primaryClient = null;
      // Find next active client to be primary
      for (const client of globalClientRegistry) {
        if (!client.isDisposed()) {
          primaryClient = client;
          break;
        }
      }
    }

    // Remove message listener
    window.removeEventListener('message', this._messageHandler);

    // Clear all pending requests
    this._correlationManager.clearAllRequests();
    this._pendingRequests.clear();
  }
} 