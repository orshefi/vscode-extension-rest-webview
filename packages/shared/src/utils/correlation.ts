import { ResponseMessage, ErrorMessage } from '../protocol/types';

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
  private disposed = false;

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
    if (this.disposed) {
      reject({
        id,
        type: 'error',
        error: 'Correlation manager has been disposed',
        status: 503,
        timestamp: Date.now(),
      });
      return;
    }

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
    if (this.disposed) {
      return false;
    }

    const request = this.pendingRequests.get(id);
    if (!request) {
      return false;
    }

    this.clearRequest(id);
    
    // Safely call resolve in next tick to prevent synchronous errors
    process.nextTick(() => {
      try {
        request.resolve(response);
      } catch (error) {
        console.warn(`[CorrelationManager] Error in resolve callback for ${id}:`, error);
      }
    });
    
    return true;
  }

  /**
   * Reject a pending request with an error
   */
  rejectRequest(id: string, error: ErrorMessage): boolean {
    if (this.disposed) {
      return false;
    }

    const request = this.pendingRequests.get(id);
    if (!request) {
      return false;
    }

    this.clearRequest(id);
    
    // Safely call reject in next tick to prevent synchronous errors
    process.nextTick(() => {
      try {
        request.reject(error);
      } catch (callbackError) {
        console.warn(`[CorrelationManager] Error in reject callback for ${id}:`, callbackError);
      }
    });
    
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
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    const error: ErrorMessage = {
      id: '',
      type: 'error',
      error: 'Connection closed',
      status: 503,
      timestamp: Date.now(),
    };

    // Create a copy of the requests to avoid concurrent modification
    const requestsCopy = new Map(this.pendingRequests);
    this.pendingRequests.clear();

    for (const [id, request] of requestsCopy) {
      if (request.timeout) {
        clearTimeout(request.timeout);
      }
      
      error.id = id;
      
      // Safely call reject in next tick
      process.nextTick(() => {
        try {
          request.reject(error);
        } catch (callbackError) {
          console.warn(`[CorrelationManager] Error in reject callback during disposal for ${id}:`, callbackError);
        }
      });
    }
  }

  /**
   * Get the number of pending requests
   */
  getPendingCount(): number {
    return this.disposed ? 0 : this.pendingRequests.size;
  }

  /**
   * Check if correlation manager is disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Clean up expired requests based on timestamp
   */
  cleanupExpiredRequests(maxAge: number = 60000): number {
    if (this.disposed) {
      return 0;
    }

    const now = Date.now();
    let cleaned = 0;

    // Create array of expired request IDs to avoid concurrent modification
    const expiredIds: string[] = [];
    for (const [id, request] of this.pendingRequests) {
      if (now - request.timestamp > maxAge) {
        expiredIds.push(id);
      }
    }

    // Reject expired requests
    for (const id of expiredIds) {
      const wasRejected = this.rejectRequest(id, {
        id,
        type: 'error',
        error: 'Request expired',
        status: 408,
        timestamp: now,
      });
      
      if (wasRejected) {
        cleaned++;
      }
    }

    return cleaned;
  }
} 