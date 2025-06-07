// Transport server implementation
export { VSCodeHttpTransportServer, VSCodeHttpRequest, VSCodeHttpResponse } from './transport/vscode-transport-server';

// Factory functions
export { createVSCodeTransport, createVSCodeFastify, VSCodeTransportConfig } from './factory/create-transport';

// Re-export shared types for convenience
export type {
  MessageProtocol,
  RequestMessage,
  ResponseMessage,
  ErrorMessage,
  HttpMethod,
  HttpStatusCode,
  TransportOptions,
} from '@vscode-rest/shared'; 