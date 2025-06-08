import { createVSCodeHttpClient } from '@vscode-rest/client';
import './styles.css';

// Create the HTTP client using the @vscode-rest/client package
const client = createVSCodeHttpClient();

// Make functions available globally for onclick handlers
declare global {
    interface Window {
        fetchHello: () => Promise<void>;
        fetchUsers: () => Promise<void>;
        fetchWorkspace: () => Promise<void>;
        createUser: () => Promise<void>;
    }
}

window.fetchHello = async function fetchHello() {
    try {
        const response = await client.get('/api/hello');
        const data = await response.json();
        displayResponse('GET /api/hello', response.status, data);
    } catch (error) {
        displayError('GET /api/hello', error as Error);
    }
}

window.fetchUsers = async function fetchUsers() {
    try {
        const response = await client.get('/api/users');
        const data = await response.json();
        displayResponse('GET /api/users', response.status, data);
    } catch (error) {
        displayError('GET /api/users', error as Error);
    }
}

window.fetchWorkspace = async function fetchWorkspace() {
    try {
        const response = await client.get('/api/workspace');
        const data = await response.json();
        displayResponse('GET /api/workspace', response.status, data);
    } catch (error) {
        displayError('GET /api/workspace', error as Error);
    }
}

window.createUser = async function createUser() {
    const nameInput = document.getElementById('userName') as HTMLInputElement;
    const emailInput = document.getElementById('userEmail') as HTMLInputElement;
    
    const name = nameInput.value;
    const email = emailInput.value;
    
    if (!name || !email) {
        displayError('POST /api/users', new Error('Please fill in both name and email'));
        return;
    }
    
    try {
        const response = await client.post('/api/users', { name, email }, {
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        displayResponse('POST /api/users', response.status, data);
        
        // Clear form
        nameInput.value = '';
        emailInput.value = '';
    } catch (error) {
        displayError('POST /api/users', error as Error);
    }
}

function displayResponse(endpoint: string, status: number, data: any) {
    const responseDiv = document.getElementById('response');
    if (responseDiv) {
        responseDiv.textContent = `${endpoint} - Status: ${status}\n\n${JSON.stringify(data, null, 2)}`;
    }
}

function displayError(endpoint: string, error: Error) {
    const responseDiv = document.getElementById('response');
    if (responseDiv) {
        responseDiv.textContent = `${endpoint} - Error: ${error.message}`;
    }
} 