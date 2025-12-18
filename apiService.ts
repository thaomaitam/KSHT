const API_URL_KEY = 'giaban_api_url';
const ADMIN_SECRET_KEY = 'giaban_admin_secret';
const DEFAULT_API_URL = 'https://ksht-api.ngthanhhuy951.workers.dev';

export const apiService = {
    getApiUrl(): string {
        return localStorage.getItem(API_URL_KEY) || DEFAULT_API_URL;
    },

    getAdminSecret(): string {
        return localStorage.getItem(ADMIN_SECRET_KEY) || '';
    },

    setApiCredentials(url: string, secret: string) {
        localStorage.setItem(API_URL_KEY, url);
        localStorage.setItem(ADMIN_SECRET_KEY, secret);
    },

    async get<T>(key: string): Promise<T | null> {
        const apiUrl = this.getApiUrl();
        const adminSecret = this.getAdminSecret();

        // Helper to get from localStorage
        const getFromLocal = (): T | null => {
            try {
                const stored = localStorage.getItem(`giaban_${key}`);
                if (stored) {
                    return JSON.parse(stored);
                }
            } catch {
                // Parse error, return null
            }
            return null;
        };

        // If no Cloud configured, use localStorage only
        if (!apiUrl || !adminSecret) {
            return getFromLocal();
        }

        // Try Cloud first
        try {
            const response = await fetch(`${apiUrl}/api/data/${key}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-Secret': adminSecret
                }
            });

            if (response.ok) {
                const data = await response.json();
                // Cache to localStorage for offline access
                try {
                    localStorage.setItem(`giaban_${key}`, JSON.stringify(data));
                } catch {
                    // Storage quota exceeded, ignore
                }
                return data;
            }
        } catch (error) {
            console.warn(`API Get Warning ${key}, falling back to local:`, error);
        }

        // Fallback to localStorage
        return getFromLocal();
    },

    async save<T>(key: string, data: T): Promise<boolean> {
        // Always save to localStorage first as backup
        try {
            localStorage.setItem(`giaban_${key}`, JSON.stringify(data));
        } catch (e) {
            console.warn(`LocalStorage save failed for ${key}:`, e);
        }

        // Then try to save to Cloud if configured
        const apiUrl = this.getApiUrl();
        const adminSecret = this.getAdminSecret();
        if (!apiUrl || !adminSecret) return true; // Local save succeeded

        try {
            const response = await fetch(`${apiUrl}/api/data/${key}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-Secret': adminSecret
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                console.warn(`API Save Warning ${key}:`, response.statusText);
                return true; // Local save succeeded, Cloud failed but that's ok
            }

            return true;
        } catch (error) {
            console.warn(`API Save Warning ${key}:`, error);
            return true; // Local save succeeded
        }
    },

    async login(username: string, password: string): Promise<{ success: boolean; secret?: string }> {
        const apiUrl = this.getApiUrl();
        if (!apiUrl) return { success: false };

        try {
            const response = await fetch(`${apiUrl}/api/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            if (response.ok) {
                const data = await response.json();
                return { success: true, secret: data.secret };
            }
            return { success: false };
        } catch (error) {
            console.error('Login Error:', error);
            return { success: false };
        }
    }
};
