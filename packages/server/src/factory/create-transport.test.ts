import { createVSCodeTransport } from './create-transport';

// Mock VS Code webview
const mockWebview = {
  postMessage: jest.fn(),
  onDidReceiveMessage: jest.fn(),
  asWebviewUri: jest.fn(),
  cspSource: 'test-csp',
  html: ''
};

describe('createVSCodeTransport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a transport server instance', () => {
    const transport = createVSCodeTransport({
      webview: mockWebview as any
    });
    
    expect(transport).toBeDefined();
    expect(typeof transport.listen).toBe('function');
    expect(typeof transport.close).toBe('function');
    expect(transport.listening).toBe(false);
  });

  it('should create transport with options', () => {
    const transport = createVSCodeTransport({
      webview: mockWebview as any,
      options: {
        development: {
          logging: 'debug',
          hotReload: true
        },
        timeout: 5000
      }
    });
    
    expect(transport).toBeDefined();
  });

  it('should accept webview configuration', () => {
    const transport = createVSCodeTransport({
      webview: mockWebview as any
    });
    
    expect(transport).toBeDefined();
    expect(transport.listening).toBe(false);
  });

  it('should accept custom instanceId', () => {
    const customInstanceId = 'editor-unique-123';
    const transport = createVSCodeTransport({
      webview: mockWebview as any,
      options: {
        instanceId: customInstanceId
      }
    });
    
    expect(transport).toBeDefined();
    expect(transport.getInstanceId()).toBe(customInstanceId);
  });

  it('should generate instanceId when not provided', () => {
    const transport = createVSCodeTransport({
      webview: mockWebview as any
    });
    
    expect(transport).toBeDefined();
    expect(transport.getInstanceId()).toMatch(/^server_\d+_[a-z0-9]+$/);
  });
}); 