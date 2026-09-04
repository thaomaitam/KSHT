import { PHONE_NUMBER as DEFAULT_PHONE, CATEGORIES as DEFAULT_CATEGORIES } from './constants';
import { apiService } from './apiService';
import { giabanClient, newIdempotencyKey } from './client/giabanClient';

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
        try {
            const remote = apiService.getSessionToken()
                ? await giabanClient.getPhoneSettings()
                : await giabanClient.getPublicSettings();
            const settings = { phoneNumber: String(remote.phoneNumber || DEFAULT_PHONE), revision: Number(remote.revision) || 1 };
            cacheJson(SETTINGS_KEY, settings);
            return settings;
        } catch {
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

    async saveSettings(settings: AppSettings): Promise<void> {
        const current = await this.getSettings();
        const saved = await giabanClient.updatePhoneSettings(
            { phoneNumber: settings.phoneNumber },
            current.revision || 1,
            newIdempotencyKey(),
        );
        cacheJson(SETTINGS_KEY, { phoneNumber: saved.phoneNumber, revision: saved.revision });
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

    async getCategories(): Promise<CategoryItem[]> {
        try {
            const page = apiService.getSessionToken()
                ? await giabanClient.listCategories()
                : await giabanClient.getPublicCategories();
            const categories = giabanClient.itemsOf(page).map((row: any) => ({
                id: String(row.id),
                label: String(row.label),
                value: String(row.value),
                revision: Number(row.revision) || 1,
            }));
            const withSentinel = withAll(categories);
            cacheJson(CATEGORIES_KEY, withSentinel);
            return withSentinel;
        } catch {
            const stored = localStorage.getItem(CATEGORIES_KEY);
            if (stored) {
                try {
                    return withAll(JSON.parse(stored));
                } catch {
                    return DEFAULT_CATEGORIES.map((category) => ({ id: category.id, label: category.label, value: category.value }));
                }
            }
            return DEFAULT_CATEGORIES.map((category) => ({ id: category.id, label: category.label, value: category.value }));
        }
    },

    async addCategory(label: string): Promise<CategoryItem[]> {
        await giabanClient.createCategory({ label }, newIdempotencyKey());
        return this.getCategories();
    },

    async updateCategory(id: string, label: string): Promise<CategoryItem[]> {
        const categories = await this.getCategories();
        const current = categories.find((category) => category.id === id);
        if (!current || current.value === 'ALL') return categories;
        await giabanClient.updateCategory(id, { label, value: current.value }, current.revision || 1, newIdempotencyKey());
        return this.getCategories();
    },

    async deleteCategory(id: string): Promise<CategoryItem[]> {
        const current = (await this.getCategories()).find((category) => category.id === id);
        if (!current || current.value === 'ALL') return this.getCategories();
        await giabanClient.archiveCategory(id, newIdempotencyKey());
        return this.getCategories();
    },

    resetToDefaults(): void {
        localStorage.removeItem(SETTINGS_KEY);
        localStorage.removeItem(CATEGORIES_KEY);
    }
};
