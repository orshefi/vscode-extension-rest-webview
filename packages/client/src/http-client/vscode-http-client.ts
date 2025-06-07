import {
  MessageProtocol,
  RequestMessage,
  ResponseMessage,
  ErrorMessage,
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
    if (typeof this._body === 'string') {
      try {
        return JSON.parse(this._body);
      } catch {
        throw new Error('Response body is not valid JSON');
      }
    }
    return this._body;
  }

  async text(): Promise<string> {
    if (typeof this._body === 'string') {
      return this._body;
    }
    return JSON.stringify(this._body);
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
 * VS Code HTTP Client - provides fetch-like API for webview communication
 */
export class VSCodeHttpClient {
  private _vscode: VSCodeAPI;
  private _correlationManager: CorrelationManager;
  private _baseUrl: string;

  constructor(vscode?: VSCodeAPI, baseUrl: string = '') {
    // Use global vscode API if available, otherwise require it to be passed
    this._vscode = vscode || (globalThis as any).acquireVsCodeApi?.();
    if (!this._vscode) {
      throw new Error('VS Code API not available. Make sure this is running in a VS Code webview.');
    }

    this._baseUrl = baseUrl;
    this._correlationManager = new CorrelationManager();

    // Listen for messages from extension
    window.addEventListener('message', (event) => {
      this._handleMessage(event.data);
    });
  }

  /**
   * Make an HTTP request (fetch-like API)
   */
  async fetch(url: string, options: RequestOptions = {}): Promise<VSCodeHttpResponse> {
    const method = options.method || 'GET';
    const fullUrl = this._resolveUrl(url);
    const correlationId = generateCorrelationId();

    const requestMessage: RequestMessage = {
      id: correlationId,
      type: 'request',
      method,
      url: fullUrl,
      headers: options.headers,
      body: options.body,
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      // Add to correlation manager
      this._correlationManager.addPendingRequest(
        correlationId,
        (response) => {
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

      // Send message to extension
      this._vscode.postMessage(requestMessage);
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
   * Handle incoming messages from extension
   */
  private _handleMessage(message: MessageProtocol): void {
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
   * Cleanup resources
   */
  dispose(): void {
    this._correlationManager.clearAllRequests();
  }
} 