import * as vscode from 'vscode';
import { getAuthToken, setAuthToken, clearAuthToken } from '../utils';
import { API_BASE_URL } from '../constants';

// Define the structure of the authentication response
interface AuthResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

// Function to handle user login
export async function loginUser(email: string, password: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error('Failed to login. Please check your credentials.');
    }

    const data: AuthResponse = await response.json();
    setAuthToken(data.token);
    vscode.window.showInformationMessage(`Welcome, ${data.user.name}!`);
  } catch (error) {
    vscode.window.showErrorMessage(`Login failed: ${error.message}`);
  }
}

// Function to handle user logout
export function logoutUser(): void {
  clearAuthToken();
  vscode.window.showInformationMessage('You have been logged out.');
}

// Function to check if the user is authenticated
export function isAuthenticated(): boolean {
  const token = getAuthToken();
  return !!token;
}

// Function to get the current user details
export async function getCurrentUser(): Promise<void> {
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('User is not authenticated.');
    }

    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user details.');
    }

    const data: AuthResponse['user'] = await response.json();
    vscode.window.showInformationMessage(`User: ${data.name}, Email: ${data.email}`);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to get user details: ${error.message}`);
  }
}
```

Note: This code assumes the existence of utility functions `getAuthToken`, `setAuthToken`, and `clearAuthToken` in `foundation/utils.ts`, and a constant `API_BASE_URL` in `foundation/constants.ts`. These functions handle token storage and retrieval, and the constant defines the base URL for API requests.