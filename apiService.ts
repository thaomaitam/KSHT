import { PUBLIC_READ_KEYS, PRIVATE_DATA_KEYS } from './workerContract.js';
import { stripCostFromProduct } from './client/giabanPayloads.ts';

const API_URL_KEY = 'giaban_api_url';
const SESSION_TOKEN_KEY = 'giaban_admin_session_token';
const SESSION_EXPIRY_KEY = 'giaban_admin_session_expiry';
const ADMIN_AUTH_KEY = 'giaban_admin_auth';
const LEGACY_ADMIN_SECRET_KEY = 'giaban_admin_secret';
const DEFAULT_API_URL = 'https://ksht-api.ngthanhhuy951.workers.dev';
const PUBLIC_READ_KEY_SET = new Set(PUBLIC_READ_KEYS);
const PRIVATE_CACHE_KEYS = [
    ...PRIVATE_DATA_KEYS.map((key) => `giaban_${key}`),
    'giaban_admin_products',
];
const PUBLIC_PRODUCTS_KEY = 'giaban_products';
const CART_KEY = 'giaban_cart';

interface LoginResult {
    success: boolean;
    token?: string;
    expiresAt?: number;
}

const removeLegacyCredential = () => {
    localStorage.removeItem(LEGACY_ADMIN_SECRET_KEY);
};

const stripPublicProductCache = () => {
    const stored = localStorage.getItem(PUBLIC_PRODUCTS_KEY);
    if (!stored) return;
    try {
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) {
            localStorage.removeItem(PUBLIC_PRODUCTS_KEY);
            return;
        }
        localStorage.setItem(PUBLIC_PRODUCTS_KEY, JSON.stringify(parsed.map((product: any) => stripCostFromProduct(product))));
    } catch {
        localStorage.removeItem(PUBLIC_PRODUCTS_KEY);
    }
};

const clearPrivateCache = () => {
    for (const key of PRIVATE_CACHE_KEYS) localStorage.removeItem(key);
    stripPublicProductCache();
};

export const SESSION_ENDED_EVENT = 'giaban-session-ended';

const clearSession = () => {
    const hadSession = Boolean(sessionStorage.getItem(SESSION_TOKEN_KEY));
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_EXPIRY_KEY);
    sessionStorage.removeItem(ADMIN_AUTH_KEY);
    localStorage.removeItem(ADMIN_AUTH_KEY);
    removeLegacyCredential();
    clearPrivateCache();
    if (hadSession && typeof window !== 'undefined') window.dispatchEvent(new Event(SESSION_ENDED_EVENT));
};

const getSessionToken = (): string => {
    removeLegacyCredential();

    const token = sessionStorage.getItem(SESSION_TOKEN_KEY) || '';
    const expiresAt = Number(sessionStorage.getItem(SESSION_EXPIRY_KEY));
    if (!token || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) {
        clearSession();
        return '';
    }

    return token;
};

const getAuthorizationHeaders = (key?: string): Record<string, string> => {
    if (key && PUBLIC_READ_KEY_SET.has(key)) return {};

    const token = getSessionToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
};

const readLocal = <T>(key: string): T | null => {
    try {
        const stored = localStorage.getItem(`giaban_${key}`);
        return stored ? JSON.parse(stored) : null;
    } catch {
        return null;
    }
};

export const apiService = {
    getApiUrl(): string {
        return localStorage.getItem(API_URL_KEY) || DEFAULT_API_URL;
    },

    setApiUrl(url: string): void {
        localStorage.setItem(API_URL_KEY, url.trim().replace(/\/$/, ''));
    },

    getSessionToken,

    setSession(token: string, expiresAt: number): void {
        sessionStorage.removeItem(SESSION_TOKEN_KEY);
        sessionStorage.removeItem(SESSION_EXPIRY_KEY);
        sessionStorage.removeItem(ADMIN_AUTH_KEY);
        localStorage.removeItem(ADMIN_AUTH_KEY);
        removeLegacyCredential();
        if (!token || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) return;

        sessionStorage.setItem(SESSION_TOKEN_KEY, token);
        sessionStorage.setItem(SESSION_EXPIRY_KEY, String(expiresAt));
        sessionStorage.setItem(ADMIN_AUTH_KEY, 'true');
    },

    clearSession,

    clearPrivateCache,

    async getCloud<T>(key: string): Promise<T | null> {
        const apiUrl = this.getApiUrl();
        if (!apiUrl) return null;

        try {
            const response = await fetch(`${apiUrl}/api/data/${key}`, {
                method: 'GET',
                headers: getAuthorizationHeaders(key),
            });

            if (response.status === 401) clearSession();
            return response.ok ? await response.json() : null;
        } catch (error) {
            console.warn(`API Get Warning ${key}:`, error);
            return null;
        }
    },

    async get<T>(key: string): Promise<T | null> {
        const data = await apiService.getCloud<T>(key);
        if (data !== null) {
            try {
                localStorage.setItem(`giaban_${key}`, JSON.stringify(data));
            } catch {
                // Storage quota exceeded; the cloud result is still usable.
            }
            return data;
        }

        return readLocal<T>(key);
    },

    async login(username: string, password: string): Promise<LoginResult> {
        const apiUrl = this.getApiUrl();
        if (!apiUrl) return { success: false };

        try {
            const response = await fetch(`${apiUrl}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            if (!response.ok) return { success: false };

            const data = await response.json();
            if (typeof data.token !== 'string' || !Number.isSafeInteger(data.expiresAt)) {
                return { success: false };
            }
            return { success: true, token: data.token, expiresAt: data.expiresAt };
        } catch (error) {
            console.error('Login Error:', error);
            return { success: false };
        }
    },
};

export const PUBLIC_PRODUCTS_CACHE_KEY = PUBLIC_PRODUCTS_KEY;
export const ADMIN_PRODUCTS_CACHE_KEY = 'giaban_admin_products';
export const CART_CACHE_KEY = CART_KEY;
