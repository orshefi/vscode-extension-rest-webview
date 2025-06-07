// Protocol types and interfaces
export * from './protocol/types';

// Utilities
export * from './utils/correlation';

// Re-export commonly used types for convenience
export type {
  MessageProtocol,
  RequestMessage,
  ResponseMessage,
  ErrorMessage,
  HttpMethod,
  HttpStatusCode,
  MessageType,
  TransportOptions,
  BinaryData,
} from './protocol/types';

export {
  generateCorrelationId,
  CorrelationManager,
} from './utils/correlation'; 