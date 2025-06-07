import { RequestMessage, ResponseMessage, ErrorMessage } from '../protocol/types';

/**
 * Generate a unique correlation ID for request/response matching
 */
export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Pending request tracking for correlation
 */
export interface PendingRequest {
  id: string;
  timestamp: number;
  resolve: (response: ResponseMessage) => void;
  reject: (error: ErrorMessage) => void;
  timeout?: ReturnType<typeof setTimeout>;
}

/**
 * Correlation manager for tracking pending requests
 */
export class CorrelationManager {
  private pendingRequests = new Map<string, PendingRequest>();
  private defaultTimeout: number;

  constructor(defaultTimeout: number = 30000) {
    this.defaultTimeout = defaultTimeout;
  }

  /**
   * Add a pending request to track
   */
  addPendingRequest(
    id: string,
    resolve: (response: ResponseMessage) => void,
    reject: (error: ErrorMessage) => void,
    timeout?: number
  ): void {
    const request: PendingRequest = {
      id,
      timestamp: Date.now(),
      resolve,
      reject,
    };

    // Set up timeout
    const timeoutMs = timeout ?? this.defaultTimeout;
    if (timeoutMs > 0) {
      request.timeout = setTimeout(() => {
        this.rejectRequest(id, {
          id,
          type: 'error',
          error: 'Request timeout',
          status: 408,
          timestamp: Date.now(),
        });
      }, timeoutMs);
    }

    this.pendingRequests.set(id, request);
  }

  /**
   * Resolve a pending request with a response
   */
  resolveRequest(id: string, response: ResponseMessage): boolean {
    const request = this.pendingRequests.get(id);
    if (!request) {
      return false;
    }

    this.clearRequest(id);
    request.resolve(response);
    return true;
  }

  /**
   * Reject a pending request with an error
   */
  rejectRequest(id: string, error: ErrorMessage): boolean {
    const request = this.pendingRequests.get(id);
    if (!request) {
      return false;
    }

    this.clearRequest(id);
    request.reject(error);
    return true;
  }

  /**
   * Clear a pending request (cleanup)
   */
  private clearRequest(id: string): void {
    const request = this.pendingRequests.get(id);
    if (request?.timeout) {
      clearTimeout(request.timeout);
    }
    this.pendingRequests.delete(id);
  }

  /**
   * Clear all pending requests (e.g., on disposal)
   */
  clearAllRequests(): void {
    const error: ErrorMessage = {
      id: '',
      type: 'error',
      error: 'Connection closed',
      status: 503,
      timestamp: Date.now(),
    };

    for (const [id, request] of this.pendingRequests) {
      if (request.timeout) {
        clearTimeout(request.timeout);
      }
      error.id = id;
      request.reject(error);
    }

    this.pendingRequests.clear();
  }

  /**
   * Get the number of pending requests
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Clean up expired requests based on timestamp
   */
  cleanupExpiredRequests(maxAge: number = 60000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, request] of this.pendingRequests) {
      if (now - request.timestamp > maxAge) {
        this.rejectRequest(id, {
          id,
          type: 'error',
          error: 'Request expired',
          status: 408,
          timestamp: now,
        });
        cleaned++;
      }
    }

    return cleaned;
  }
} 