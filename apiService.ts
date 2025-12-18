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
        if (!apiUrl) return null;

        try {
            const response = await fetch(`${apiUrl}/api/data/${key}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-Secret': this.getAdminSecret()
                }
            });

            if (!response.ok) {
                console.error(`API Get Error ${key}:`, response.statusText);
                return null;
            }

            return await response.json();
        } catch (error) {
            console.error(`API Get Error ${key}:`, error);
            return null;
        }
    },

    async save<T>(key: string, data: T): Promise<boolean> {
        const apiUrl = this.getApiUrl();
        if (!apiUrl) return false;

        try {
            const response = await fetch(`${apiUrl}/api/data/${key}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-Secret': this.getAdminSecret()
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                console.error(`API Save Error ${key}:`, response.statusText);
                return false;
            }

            return true;
        } catch (error) {
            console.error(`API Save Error ${key}:`, error);
            return false;
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
