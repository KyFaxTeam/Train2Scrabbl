/**
 * API Configuration
 */

// API base URL - uses environment variable or defaults to local dev server
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const API_ENDPOINTS = {
    health: `${API_BASE_URL}/api/health`,
    puzzle: `${API_BASE_URL}/api/training/puzzle`,
    generate: `${API_BASE_URL}/api/training/generate`,
    batch: `${API_BASE_URL}/api/training/batch`,
} as const;

/**
 * Fetch wrapper with error handling
 */
export async function apiFetch<T>(
    url: string,
    options?: RequestInit
): Promise<T> {
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options?.headers,
            },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: response.statusText }));
            throw new Error(error.detail || `HTTP ${response.status}`);
        }

        return response.json();
    } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error('Unable to connect to server. Is the backend running?');
        }
        throw error;
    }
}
