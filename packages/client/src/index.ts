// HTTP client implementation
export { 
  VSCodeHttpClient, 
  VSCodeHttpResponse, 
  VSCodeHttpError,
  RequestOptions 
} from './http-client/vscode-http-client';

// Factory functions
export { createVSCodeHttpClient, VSCodeClientConfig } from './factory/create-client';

// Re-export shared types for convenience
export type {
  MessageProtocol,
  RequestMessage,
  ResponseMessage,
  ErrorMessage,
  HttpMethod,
  HttpStatusCode,
} from '@vscode-rest/shared'; 