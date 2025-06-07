import { createVSCodeHttpClient } from './create-client';

// Mock the VSCode API
const mockVSCodeApi = {
  postMessage: jest.fn(),
  getState: jest.fn(),
  setState: jest.fn()
};

// Mock the global acquireVsCodeApi function
(global as any).acquireVsCodeApi = jest.fn(() => mockVSCodeApi);

// Mock the addEventListener for the window
const mockEventListeners: { [key: string]: ((event: any) => void)[] } = {};
const mockAddEventListener = jest.fn((event: string, callback: (event: any) => void) => {
  if (!mockEventListeners[event]) {
    mockEventListeners[event] = [];
  }
  mockEventListeners[event].push(callback);
});

global.window = {
  addEventListener: mockAddEventListener,
} as any;

describe('createVSCodeHttpClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddEventListener.mockClear();
    Object.keys(mockEventListeners).forEach(key => {
      mockEventListeners[key] = [];
    });
  });

  it('should create a client instance', () => {
    const client = createVSCodeHttpClient();
    
    expect(client).toBeDefined();
    expect(typeof client.get).toBe('function');
    expect(typeof client.post).toBe('function');
    expect(typeof client.put).toBe('function');
    expect(typeof client.delete).toBe('function');
    expect(typeof client.fetch).toBe('function');
  });

  it('should create a client with custom config', () => {
    const config = {
      baseUrl: '/api',
      vscode: mockVSCodeApi
    };
    
    const client = createVSCodeHttpClient(config);
    expect(client).toBeDefined();
  });

  it('should use acquireVsCodeApi when no vscode API provided', () => {
    createVSCodeHttpClient();
    expect((global as any).acquireVsCodeApi).toHaveBeenCalled();
  });

  it('should work with custom vscode API', () => {
    const client = createVSCodeHttpClient({
      vscode: mockVSCodeApi
    });
    expect(client).toBeDefined();
    // This test doesn't require message listener setup since we provide the vscode API directly
  });
}); 