import { PHONE_NUMBER as DEFAULT_PHONE, CATEGORIES as DEFAULT_CATEGORIES } from './constants.ts';
import { apiService } from './apiService.ts';
import { giabanClient, newIdempotencyKey, CloudWriteError } from './client/giabanClient.ts';
import { collectPages, parsePage } from './client/giabanPage.ts';
import { toCategoryWrite, toPhoneSettingsWrite } from './client/giabanPayloads.ts';

const SETTINGS_KEY = 'giaban_settings';
const CATEGORIES_KEY = 'giaban_categories';

export interface CategoryItem {
    id: string;
    label: string;
    value: string;
    revision?: number;
}

export interface AppSettings {
    phoneNumber: string;
    revision?: number;
}

export interface CategoryLoad {
    categories: CategoryItem[];
    truncated: boolean;
    source: 'network' | 'stale-cache' | 'empty';
}

const defaultSettings: AppSettings = {
    phoneNumber: DEFAULT_PHONE,
};

const ALL_CATEGORY: CategoryItem = { id: 'ALL', label: 'Tất cả', value: 'ALL' };

const withAll = (categories: CategoryItem[]): CategoryItem[] => {
    if (categories.some((category) => category.value === 'ALL')) return categories;
    return [ALL_CATEGORY, ...categories];
};

const cacheJson = (key: string, value: unknown) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // quota
    }
};

export const settingsService = {
    async getSettings(): Promise<AppSettings> {
        const admin = Boolean(apiService.getSessionToken());
        try {
            const remote = admin
                ? await giabanClient.getPhoneSettings()
                : await giabanClient.getPublicSettings();
            const settings = { phoneNumber: String(remote.phoneNumber || DEFAULT_PHONE), revision: Number(remote.revision) || 1 };
            cacheJson(SETTINGS_KEY, settings);
            return settings;
        } catch (error) {
            if (admin) throw error;
            const stored = localStorage.getItem(SETTINGS_KEY);
            if (stored) {
                try {
                    return { ...defaultSettings, ...JSON.parse(stored) };
                } catch {
                    return defaultSettings;
                }
            }
            return defaultSettings;
        }
    },

    async saveSettings(settings: AppSettings, idempotencyKey = newIdempotencyKey()): Promise<AppSettings> {
        if (!Number.isSafeInteger(settings.revision) || Number(settings.revision) < 1) {
            throw new CloudWriteError('Chưa tải được cài đặt; không lưu với revision giả.', { code: 'REVISION_REQUIRED' });
        }
        const saved = await giabanClient.updatePhoneSettings(
            toPhoneSettingsWrite({ phoneNumber: settings.phoneNumber }),
            settings.revision!,
            idempotencyKey,
        );
        const next = { phoneNumber: String(saved.phoneNumber), revision: Number(saved.revision) || 1 };
        cacheJson(SETTINGS_KEY, next);
        return next;
    },

    getPhoneNumber(): string {
        const stored = localStorage.getItem(SETTINGS_KEY);
        if (stored) {
            try {
                return JSON.parse(stored).phoneNumber || DEFAULT_PHONE;
            } catch {
                return DEFAULT_PHONE;
            }
        }
        return DEFAULT_PHONE;
    },

    getZaloLink(): string {
        return `https://zalo.me/${this.getPhoneNumber()}`;
    },

    async getCategoryLoad(): Promise<CategoryLoad> {
        const admin = Boolean(apiService.getSessionToken());
        try {
            const collected = admin
                ? await collectPages((cursor) => giabanClient.listCategories({ cursor }))
                : { items: parsePage(await giabanClient.getPublicCategories()).items, truncated: false };
            const categories = collected.items.map((row: any) => ({
                id: String(row.id),
                label: String(row.label),
                value: String(row.value),
                revision: Number(row.revision) || 1,
            }));
            const withSentinel = withAll(categories);
            cacheJson(CATEGORIES_KEY, withSentinel);
            return {
                categories: withSentinel,
                truncated: Boolean(collected.truncated),
                source: 'network',
            };
        } catch (error) {
            if (admin) throw error;
            const stored = localStorage.getItem(CATEGORIES_KEY);
            if (stored) {
                try {
                    return { categories: withAll(JSON.parse(stored)), truncated: true, source: 'stale-cache' };
                } catch {
                    // fall through
                }
            }
            return {
                categories: DEFAULT_CATEGORIES.map((category) => ({ id: category.id, label: category.label, value: category.value })),
                truncated: true,
                source: 'empty',
            };
        }
    },

    async getCategories(): Promise<CategoryItem[]> {
        return (await this.getCategoryLoad()).categories;
    },

    async addCategory(label: string): Promise<CategoryItem[]> {
        await giabanClient.createCategory(toCategoryWrite({ label }), newIdempotencyKey());
        return this.getCategories();
    },

    async updateCategory(id: string, label: string): Promise<CategoryItem[]> {
        const categories = await this.getCategories();
        const current = categories.find((category) => category.id === id);
        if (!current || current.value === 'ALL') return categories;
        await giabanClient.updateCategory(id, toCategoryWrite({ label, value: current.value }), current.revision || 1, newIdempotencyKey());
        return this.getCategories();
    },

    async deleteCategory(id: string): Promise<CategoryItem[]> {
        const current = (await this.getCategories()).find((category) => category.id === id);
        if (!current || current.value === 'ALL') return this.getCategories();
        await giabanClient.archiveCategory(id, newIdempotencyKey(), current.revision);
        return this.getCategories();
    },

    resetToDefaults(): void {
        localStorage.removeItem(SETTINGS_KEY);
        localStorage.removeItem(CATEGORIES_KEY);
    }
};
