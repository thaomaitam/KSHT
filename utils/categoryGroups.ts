// Frontend-only grouping of storefront categories for navigation.
// Unmapped categories automatically fall into the "Khác" group so a newly
// created category never disappears from the storefront.

export interface CategoryLike { id: string; label: string; value: string }
export interface ProductLike { category: string; image?: string }

export interface CategoryEntry<C extends CategoryLike = CategoryLike> {
    category: C;
    count: number;
    image?: string;
}
export interface CategoryGroup<C extends CategoryLike = CategoryLike> {
    name: string;
    items: CategoryEntry<C>[];
}

export const OTHER_GROUP = 'Khác';

export const CATEGORY_GROUPS: { name: string; values: string[] }[] = [
    { name: 'Sơn & hoàn thiện', values: ['PAINT_BRUSH', 'ROLLER', 'NHAM', 'BANG_KEO', 'CHAT_TAY_RUA_&_HOA_CHAT'] },
    { name: 'Dụng cụ cầm tay', values: ['BUA', 'KIM', 'TO_VIT', 'CAN_TIP_MO_LET', 'DUC', 'DAO', 'KEO,_LUOI_CAT_&_KHOA', 'THUOC', 'CUA_GO_LUOI_CUA'] },
    { name: 'Phụ kiện máy & hàn', values: ['MUI_KHOAN_MUI_VIT', 'DIA_CAT_CAT_GACH', 'DAU_KHOAN_PK_MAY', 'MO_HAN_KHO'] },
    { name: 'Xây dựng & khác', values: ['ACCESSORY', 'CHEN_CUOC', 'DAY_BO', 'DAY_DU', 'DUNG_CU_NONG_NGHIEP_&_VUON', 'THUNG_DO_NGHE'] },
];

/** Display label in Vietnamese sentence case ("MỎ HÀN / KHÒ" -> "Mỏ hàn / khò"). */
export const displayCategoryLabel = (label: string): string => {
    const lower = label.trim().toLocaleLowerCase('vi');
    return lower.charAt(0).toLocaleUpperCase('vi') + lower.slice(1);
};

/**
 * Group categories for navigation. Skips the synthetic "ALL" entry and
 * categories with 0 products; keeps config order inside each group and API
 * order inside "Khác". Empty groups are omitted.
 */
export function groupCategories<C extends CategoryLike>(
    categories: C[],
    products: ProductLike[],
    groups = CATEGORY_GROUPS,
): CategoryGroup<C>[] {
    const counts = new Map<string, number>();
    const images = new Map<string, string>();
    for (const p of products) {
        counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
        if (p.image && !images.has(p.category)) images.set(p.category, p.image);
    }
    const entries = new Map<string, CategoryEntry<C>>();
    for (const c of categories) {
        if (c.value === 'ALL') continue;
        const count = counts.get(c.value) ?? 0;
        if (count === 0 || entries.has(c.value)) continue;
        entries.set(c.value, { category: c, count, image: images.get(c.value) });
    }
    const result: CategoryGroup<C>[] = [];
    const used = new Set<string>();
    for (const g of groups) {
        const items = g.values.map(v => entries.get(v)).filter((e): e is CategoryEntry<C> => !!e);
        items.forEach(e => used.add(e.category.value));
        if (items.length) result.push({ name: g.name, items });
    }
    const rest = [...entries.values()].filter(e => !used.has(e.category.value));
    if (rest.length) result.push({ name: OTHER_GROUP, items: rest });
    return result;
}
