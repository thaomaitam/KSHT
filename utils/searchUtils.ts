import { Product } from '../types';

/**
 * Vietnamese diacritics mapping for normalization
 */
const VIETNAMESE_MAP: { [key: string]: string } = {
    'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
    'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
    'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
    'đ': 'd',
    'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
    'ê': 'e', 'ề': 'e', 'ế': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
    'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
    'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
    'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
    'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
    'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
    'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
    'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
};

/**
 * Normalize Vietnamese text by removing diacritics
 */
export const normalizeVietnamese = (str: string): string => {
    return str
        .toLowerCase()
        .split('')
        .map(char => VIETNAMESE_MAP[char] || char)
        .join('');
};

/**
 * Tokenize a string into words
 */
export const tokenize = (str: string): string[] => {
    return normalizeVietnamese(str)
        .split(/\s+/)
        .filter(token => token.length > 0);
};

/**
 * Check if all query tokens are found in the target string
 */
const matchesAllTokens = (target: string, queryTokens: string[]): boolean => {
    const normalizedTarget = normalizeVietnamese(target);
    return queryTokens.every(token => normalizedTarget.includes(token));
};

/**
 * Calculate relevance score for a product based on search query
 * Higher score = more relevant
 */
export const fuzzyScoreProduct = (product: Product, query: string): number => {
    if (!query.trim()) return 1; // No query = show all

    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return 1;

    let score = 0;

    // Name matching (highest priority, weight: 10)
    if (matchesAllTokens(product.name, queryTokens)) {
        score += 10;
    } else {
        // Partial name match (at least one token)
        const nameNormalized = normalizeVietnamese(product.name);
        const matchedTokens = queryTokens.filter(t => nameNormalized.includes(t));
        score += matchedTokens.length * 3;
    }

    // Description matching (weight: 2)
    if (matchesAllTokens(product.description, queryTokens)) {
        score += 2;
    } else {
        const descNormalized = normalizeVietnamese(product.description);
        const matchedTokens = queryTokens.filter(t => descNormalized.includes(t));
        score += matchedTokens.length * 0.5;
    }

    // Variant size matching (weight: 5) - useful for "3 inch", "15cm", etc.
    const variantSizes = product.variants.map(v => v.size).join(' ');
    if (matchesAllTokens(variantSizes, queryTokens)) {
        score += 5;
    } else {
        const sizesNormalized = normalizeVietnamese(variantSizes);
        const matchedTokens = queryTokens.filter(t => sizesNormalized.includes(t));
        score += matchedTokens.length * 2;
    }

    // Category matching (weight: 1)
    const categoryNormalized = normalizeVietnamese(product.category.replace(/_/g, ' '));
    if (queryTokens.some(t => categoryNormalized.includes(t))) {
        score += 1;
    }

    return score;
};

/**
 * Filter and sort products based on search query
 */
export const searchProducts = (products: Product[], query: string, category: string): Product[] => {
    // Score all products
    const scoredProducts = products.map(product => ({
        product,
        score: fuzzyScoreProduct(product, query),
        matchesCategory: category === 'ALL' || product.category === category
    }));

    // Filter by category and non-zero score
    const filtered = scoredProducts.filter(sp => sp.matchesCategory && sp.score > 0);

    // Sort by score (descending)
    filtered.sort((a, b) => b.score - a.score);

    return filtered.map(sp => sp.product);
};
