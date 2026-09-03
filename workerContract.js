export const PUBLIC_READ_KEYS = Object.freeze([
    'products',
    'categories',
    'settings',
]);

export const PRIVATE_DATA_KEYS = Object.freeze([
    'orders',
    'customers',
    'costPrices',
    'transactions',
    'bankInfo',
    'taxRate',
    'shopTemplates',
]);

export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
