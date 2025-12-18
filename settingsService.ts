import { PHONE_NUMBER as DEFAULT_PHONE, CATEGORIES as DEFAULT_CATEGORIES } from './constants';
import { apiService } from './apiService';

const SETTINGS_KEY = 'giaban_settings';
const CATEGORIES_KEY = 'giaban_categories';

export interface CategoryItem {
    id: string;
    label: string;
    value: string;
}

export interface AppSettings {
    phoneNumber: string;
}

const defaultSettings: AppSettings = {
    phoneNumber: DEFAULT_PHONE,
};

export const settingsService = {
    // Get settings
    async getSettings(): Promise<AppSettings> {
        // Try API first if logged in
        if (apiService.getAdminSecret()) {
            const remote = await apiService.get<AppSettings>('settings');
            if (remote) {
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(remote));
                return remote;
            }
        }

        // Fallback to local
        const stored = localStorage.getItem(SETTINGS_KEY);
        if (stored) {
            try {
                return { ...defaultSettings, ...JSON.parse(stored) };
            } catch {
                return defaultSettings;
            }
        }
        return defaultSettings;
    },

    // Save settings
    async saveSettings(settings: AppSettings): Promise<void> {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        await apiService.save('settings', settings);
    },

    // Get phone number (helper, might need to be async or just return local cached)
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

    // Get Zalo link
    getZaloLink(): string {
        return `https://zalo.me/${this.getPhoneNumber()}`;
    },

    // Get categories
    async getCategories(): Promise<CategoryItem[]> {
        // Try API first
        if (apiService.getAdminSecret()) {
            const remote = await apiService.get<CategoryItem[]>('categories');
            if (remote) {
                localStorage.setItem(CATEGORIES_KEY, JSON.stringify(remote));
                return remote;
            }
        }

        const stored = localStorage.getItem(CATEGORIES_KEY);
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch {
                return DEFAULT_CATEGORIES.map(c => ({ id: c.id, label: c.label, value: c.value }));
            }
        }
        // Initialize with defaults
        const categories = DEFAULT_CATEGORIES.map(c => ({ id: c.id, label: c.label, value: c.value }));
        localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
        return categories;
    },

    // Save categories
    async saveCategories(categories: CategoryItem[]): Promise<void> {
        localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
        await apiService.save('categories', categories);
    },

    // Add category
    async addCategory(label: string): Promise<CategoryItem[]> {
        const categories = await this.getCategories();
        const value = label.toUpperCase().replace(/\s+/g, '_').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const newCategory: CategoryItem = {
            id: 'cat_' + Date.now(),
            label,
            value,
        };
        const newCategories = [...categories, newCategory];
        await this.saveCategories(newCategories);
        return newCategories;
    },

    // Update category
    async updateCategory(id: string, label: string): Promise<CategoryItem[]> {
        const categories = await this.getCategories();
        const index = categories.findIndex(c => c.id === id);
        if (index !== -1) {
            categories[index].label = label;
            await this.saveCategories(categories);
        }
        return categories;
    },

    // Delete category (except ALL)
    async deleteCategory(id: string): Promise<CategoryItem[]> {
        const categories = await this.getCategories();
        const filtered = categories.filter(c => c.id !== id && c.value !== 'ALL');

        // Always keep ALL at the beginning
        const allCategory = categories.find(c => c.value === 'ALL');
        let finalCategories;

        if (allCategory && !filtered.find(c => c.value === 'ALL')) {
            finalCategories = [allCategory, ...filtered];
        } else {
            finalCategories = filtered;
        }

        await this.saveCategories(finalCategories);
        return finalCategories;
    },

    // Reset to defaults
    resetToDefaults(): void {
        localStorage.removeItem(SETTINGS_KEY);
        localStorage.removeItem(CATEGORIES_KEY);
    }
};
