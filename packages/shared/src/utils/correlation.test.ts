import { generateCorrelationId, CorrelationManager } from './correlation';

describe('Correlation Utilities', () => {
  describe('generateCorrelationId', () => {
    it('should generate unique correlation IDs', () => {
      const id1 = generateCorrelationId();
      const id2 = generateCorrelationId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
    });

    it('should generate IDs with timestamp prefix', () => {
      const id = generateCorrelationId();
      const timestampPart = id.split('-')[0];
      const timestamp = parseInt(timestampPart, 10);
      
      expect(timestamp).toBeGreaterThan(Date.now() - 1000); // Within last second
      expect(timestamp).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('CorrelationManager', () => {
    let manager: CorrelationManager;

    beforeEach(() => {
      manager = new CorrelationManager(1000); // 1 second timeout
    });

    afterEach(() => {
      manager.clearAllRequests();
    });

    it('should track pending requests', () => {
      const id = 'test-id';
      const resolve = jest.fn();
      const reject = jest.fn();

      manager.addPendingRequest(id, resolve, reject);
      
      expect(manager.getPendingCount()).toBe(1);
    });

    it('should resolve pending requests', async () => {
      const id = 'test-id';
      const resolve = jest.fn();
      const reject = jest.fn();
      const response = {
        id,
        type: 'response' as const,
        status: 200 as const,
        timestamp: Date.now()
      };

      manager.addPendingRequest(id, resolve, reject);
      const resolved = manager.resolveRequest(id, response);

      expect(resolved).toBe(true);
      expect(manager.getPendingCount()).toBe(0);
      
      // Wait for next tick since callbacks are called asynchronously
      await new Promise(resolve => process.nextTick(resolve));
      
      expect(resolve).toHaveBeenCalledWith(response);
      expect(reject).not.toHaveBeenCalled();
    });

    it('should reject pending requests', async () => {
      const id = 'test-id';
      const resolve = jest.fn();
      const reject = jest.fn();
      const error = {
        id,
        type: 'error' as const,
        error: 'Test error',
        status: 500 as const,
        timestamp: Date.now()
      };

      manager.addPendingRequest(id, resolve, reject);
      const rejected = manager.rejectRequest(id, error);

      expect(rejected).toBe(true);
      expect(manager.getPendingCount()).toBe(0);
      
      // Wait for next tick since callbacks are called asynchronously
      await new Promise(resolve => process.nextTick(resolve));
      
      expect(reject).toHaveBeenCalledWith(error);
      expect(resolve).not.toHaveBeenCalled();
    });

    it('should handle non-existent request IDs', () => {
      const response = {
        id: 'non-existent',
        type: 'response' as const,
        status: 200 as const,
        timestamp: Date.now()
      };

      const resolved = manager.resolveRequest('non-existent', response);
      expect(resolved).toBe(false);
    });
  });
}); 