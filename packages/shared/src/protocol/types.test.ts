import {
  isBinaryData,
  isRequestMessage,
  isResponseMessage,
  isErrorMessage,
  BinaryData,
  RequestMessage,
  ResponseMessage,
  ErrorMessage
} from './types';

describe('Protocol Types', () => {
  describe('isBinaryData', () => {
    it('should identify valid binary data', () => {
      const binaryData: BinaryData = {
        type: 'binary',
        data: 'SGVsbG8gV29ybGQ=', // "Hello World" in base64
        mimeType: 'text/plain'
      };

      expect(isBinaryData(binaryData)).toBe(true);
    });

    it('should reject invalid binary data', () => {
      expect(isBinaryData(null)).toBe(false);
      expect(isBinaryData(undefined)).toBe(false);
      expect(isBinaryData('string')).toBe(false);
      expect(isBinaryData({})).toBe(false);
      expect(isBinaryData({ type: 'not-binary', data: 'test' })).toBe(false);
      expect(isBinaryData({ type: 'binary' })).toBe(false); // missing data
    });
  });

  describe('isRequestMessage', () => {
    it('should identify valid request messages', () => {
      const requestMessage: RequestMessage = {
        id: 'test-id',
        type: 'request',
        method: 'GET',
        url: '/api/test',
        timestamp: Date.now()
      };

      expect(isRequestMessage(requestMessage)).toBe(true);
    });

    it('should reject invalid request messages', () => {
      const baseMessage = {
        id: 'test-id',
        timestamp: Date.now()
      };

      expect(isRequestMessage({ ...baseMessage, type: 'response' })).toBe(false);
      expect(isRequestMessage({ ...baseMessage, type: 'request' })).toBe(false); // missing method and url
      expect(isRequestMessage({ ...baseMessage, type: 'request', method: 'GET' })).toBe(false); // missing url
      expect(isRequestMessage({ ...baseMessage, type: 'request', url: '/test' })).toBe(false); // missing method
    });
  });

  describe('isResponseMessage', () => {
    it('should identify valid response messages', () => {
      const responseMessage: ResponseMessage = {
        id: 'test-id',
        type: 'response',
        status: 200,
        timestamp: Date.now()
      };

      expect(isResponseMessage(responseMessage)).toBe(true);
    });

    it('should reject invalid response messages', () => {
      const baseMessage = {
        id: 'test-id',
        timestamp: Date.now()
      };

      expect(isResponseMessage({ ...baseMessage, type: 'request' })).toBe(false);
      expect(isResponseMessage({ ...baseMessage, type: 'response' })).toBe(false); // missing status
      expect(isResponseMessage({ ...baseMessage, type: 'response', status: 'ok' as any })).toBe(false); // status should be number
    });
  });

  describe('isErrorMessage', () => {
    it('should identify valid error messages', () => {
      const errorMessage: ErrorMessage = {
        id: 'test-id',
        type: 'error',
        error: 'Something went wrong',
        status: 500,
        timestamp: Date.now()
      };

      expect(isErrorMessage(errorMessage)).toBe(true);
    });

    it('should reject invalid error messages', () => {
      const baseMessage = {
        id: 'test-id',
        timestamp: Date.now()
      };

      expect(isErrorMessage({ ...baseMessage, type: 'request' })).toBe(false);
      expect(isErrorMessage({ ...baseMessage, type: 'error' })).toBe(false); // missing error and status
      expect(isErrorMessage({ ...baseMessage, type: 'error', error: 'test' })).toBe(false); // missing status
      expect(isErrorMessage({ ...baseMessage, type: 'error', status: 500 })).toBe(false); // missing error
    });
  });
}); 