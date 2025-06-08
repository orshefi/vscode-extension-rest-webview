/**
 * HTTP method types supported by the protocol
 */
export type HttpMethod = 
  | 'GET' 
  | 'POST' 
  | 'PUT' 
  | 'DELETE' 
  | 'PATCH' 
  | 'HEAD' 
  | 'OPTIONS';

/**
 * Message types for the communication protocol
 */
export type MessageType = 
  | 'request'   // Client to server request
  | 'response'  // Server to client response
  | 'error';    // Error response

/**
 * HTTP status codes for response messages
 */
export type HttpStatusCode = 
  | 200 | 201 | 202 | 204  // 2xx Success
  | 400 | 401 | 403 | 404 | 405 | 408 | 409 | 422  // 4xx Client Error
  | 500 | 501 | 502 | 503;  // 5xx Server Error

/**
 * Core message protocol interface for VS Code messaging
 */
export interface MessageProtocol {
  /** Unique correlation ID for request/response matching */
  id: string;
  
  /** Message type */
  type: MessageType;
  
  /** HTTP method (for request messages) */
  method?: HttpMethod;
  
  /** Request URL path with query parameters */
  url?: string;
  
  /** HTTP headers */
  headers?: Record<string, string>;
  
  /** Request/response body (JSON or Base64 for binary) */
  body?: any;
  
  /** HTTP status code (for response messages) */
  status?: HttpStatusCode;
  
  /** Error message (for error messages) */
  error?: string;
  
  /** Error stack trace (for debugging) */
  stack?: string;
  
  /** Instance ID for routing between multiple servers/clients */
  instanceId?: string;
  
  /** Timestamp for debugging and lifecycle management */
  timestamp: number;
}

/**
 * Request message from webview to extension
 */
export interface RequestMessage extends MessageProtocol {
  type: 'request';
  method: HttpMethod;
  url: string;
}

/**
 * Response message from extension to webview
 */
export interface ResponseMessage extends MessageProtocol {
  type: 'response';
  status: HttpStatusCode;
}

/**
 * Error message for failed requests
 */
export interface ErrorMessage extends MessageProtocol {
  type: 'error';
  error: string;
  status: HttpStatusCode;
}

/**
 * Configuration options for transport
 */
export interface TransportOptions {
  /** Development mode settings */
  development?: {
    /** Enable hot reload */
    hotReload?: boolean;
    /** Logging level */
    logging?: 'debug' | 'info' | 'warn' | 'error' | 'none';
  };
  
  /** Request timeout in milliseconds */
  timeout?: number;
  
  /** Maximum message size in bytes */
  maxMessageSize?: number;
}

/**
 * Binary data wrapper for Base64 encoding
 */
export interface BinaryData {
  type: 'binary';
  data: string; // Base64 encoded
  mimeType?: string;
}

/**
 * Type guard for binary data
 */
export function isBinaryData(value: any): value is BinaryData {
  return typeof value === 'object' && 
         value !== null && 
         value.type === 'binary' && 
         typeof value.data === 'string';
}

/**
 * Type guard for request messages
 */
export function isRequestMessage(message: MessageProtocol): message is RequestMessage {
  return message.type === 'request' && 
         typeof message.method === 'string' && 
         typeof message.url === 'string';
}

/**
 * Type guard for response messages
 */
export function isResponseMessage(message: MessageProtocol): message is ResponseMessage {
  return message.type === 'response' && 
         typeof message.status === 'number';
}

/**
 * Type guard for error messages
 */
export function isErrorMessage(message: MessageProtocol): message is ErrorMessage {
  return message.type === 'error' && 
         typeof message.error === 'string' && 
         typeof message.status === 'number';
} 