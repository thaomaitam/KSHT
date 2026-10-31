import type { Product } from '../types';

/**
 * Storefront keyword search (client-side).
 *
 * Rules: Unicode NFD accent stripping (+ đ→d), AND across query tokens over
 * name + variant sizes + description + Vietnamese category name, word-prefix
 * matching (short ≤2-char and numeric tokens must match a whole word), 1-char
 * non-numeric tokens ignored, joined-word matching ("tovit" → "tô vít"),
 * synonyms, and an edit-distance-1 fallback only when nothing matches.
 */

/** Phrases in one group are interchangeable. Write them unaccented or accented. */
export const SEARCH_SYNONYMS: string[][] = [
    ['rulo', 'lăn'],
    ['tua vít', 'tô vít'],
    ['mỏ lết', 'cần típ'],
    ['đồ nghề', 'dụng cụ'],
];

export const normalizeVietnamese = (str: string): string =>
    str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();

/** Normalized words; digit/letter runs are split ("10mm" → "10", "mm"). */
export const tokenize = (str: string): string[] =>
    normalizeVietnamese(str)
        .replace(/(\d)([a-z])/g, '$1 $2')
        .replace(/([a-z])(\d)/g, '$1 $2')
        .split(/[^a-z0-9]+/)
        .filter(Boolean);

const isNumeric = (t: string) => /^\d+$/.test(t);
const keepToken = (t: string) => t.length > 1 || isNumeric(t);

interface Indexed {
    name: string[];
    nameStr: string;
    sizes: string[];
    desc: string[];
    cat: string[];
    all: string[];
    joins: string[];
    sortKey: string;
}

const joinsOf = (words: string[]) => words.slice(1).map((w, i) => words[i] + w);

const indexCache = new WeakMap<Map<string, string>, WeakMap<Product, Indexed>>();
const noLabels = new Map<string, string>();

const indexProduct = (p: Product, labels: Map<string, string>): Indexed => {
    let byProduct = indexCache.get(labels);
    if (!byProduct) { byProduct = new WeakMap(); indexCache.set(labels, byProduct); }
    const hit = byProduct.get(p);
    if (hit) return hit;
    const name = tokenize(p.name);
    const sizes = tokenize(p.variants.map(v => v.size).join(' '));
    const desc = tokenize(p.description ?? '');
    const cat = tokenize(labels.get(p.category) ?? p.category.replace(/_/g, ' '));
    const idx: Indexed = {
        name, sizes, desc, cat,
        nameStr: ` ${name.join(' ')} `,
        all: [...name, ...sizes, ...desc, ...cat],
        joins: [...joinsOf(name), ...joinsOf(desc), ...joinsOf(cat)],
        sortKey: p.name.toLocaleLowerCase('vi'),
    };
    byProduct.set(p, idx);
    return idx;
};

const tokenMatches = (t: string, words: string[], joins: string[] = []): boolean => {
    if (isNumeric(t) || t.length <= 2) return words.includes(t);
    return words.some(w => w.startsWith(t)) || joins.some(j => j.startsWith(t));
};

/** Levenshtein distance ≤ 1 check. */
const withinOne = (a: string, b: string): boolean => {
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > 1) return false;
    let i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
        if (a[i] === b[j]) { i++; j++; continue; }
        if (++edits > 1) return false;
        if (a.length > b.length) i++;
        else if (b.length > a.length) j++;
        else { i++; j++; }
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
};

const fuzzyTokenMatches = (t: string, words: string[]): boolean =>
    tokenMatches(t, words) ||
    (t.length >= 4 && !isNumeric(t) && words.some(w => withinOne(t, w) || (w.length > t.length && withinOne(t, w.slice(0, t.length)))));

/**
 * A clause is satisfied when any alternative has all of its tokens matched.
 * Synonym alternatives the user did not type must match whole words, so
 * "lăn" (from "rulo") does not prefix-match "lạnh".
 */
type Alt = { tokens: string[]; exact: boolean };
type Clause = Alt[];

const synonymGroups = SEARCH_SYNONYMS.map(g => g.map(tokenize));

export const parseQuery = (query: string): { tokens: string[]; clauses: Clause[] } => {
    const tokens = tokenize(query).filter(keepToken);
    const clauses: Clause[] = [];
    for (let i = 0; i < tokens.length;) {
        let matched: Clause | null = null;
        let len = 1;
        for (const group of synonymGroups) {
            const phrase = group.find(ph => ph.every((w, k) => tokens[i + k] === w));
            if (phrase) {
                matched = group.map(ph => ({ tokens: ph, exact: ph !== phrase }));
                len = phrase.length;
                break;
            }
        }
        clauses.push(matched ?? [{ tokens: [tokens[i]], exact: false }]);
        i += len;
    }
    return { tokens, clauses };
};

const clausesMatch = (clauses: Clause[], words: string[], test: (t: string) => boolean) =>
    clauses.every(alts => alts.some(alt => alt.tokens.every(t => (alt.exact ? words.includes(t) : test(t)))));

const clauseCountIn = (clauses: Clause[], words: string[]) =>
    clauses.filter(alts => alts.some(alt => alt.tokens.every(t => (alt.exact ? words.includes(t) : tokenMatches(t, words))))).length;

const score = (idx: Indexed, tokens: string[], clauses: Clause[]): number => {
    let s = 1;
    const phrase = tokens.join(' ');
    if (idx.nameStr.includes(` ${phrase}`)) s += 100;
    if (idx.nameStr.startsWith(` ${phrase}`)) s += 30;
    if (clausesMatch(clauses, idx.name, t => tokenMatches(t, idx.name, joinsOf(idx.name)))) s += 50;
    else s += 5 * clauseCountIn(clauses, idx.name);
    if (tokens.some(t => isNumeric(t) && idx.sizes.includes(t)) || clausesMatch(clauses, idx.sizes, t => tokenMatches(t, idx.sizes))) s += 20;
    if (clauseCountIn(clauses, idx.cat) > 0) s += 15;
    if (tokens.some(t => /\d/.test(t)) && tokens.every(t => tokenMatches(t, idx.desc))) s += 10;
    return s;
};

const byName = (a: { idx: Indexed; product: Product }, b: { idx: Indexed; product: Product }) =>
    a.idx.sortKey.localeCompare(b.idx.sortKey, 'vi') || a.product.id.localeCompare(b.product.id);

/** True when the query has at least one usable token (search mode is active). */
export const isActiveQuery = (query: string): boolean => parseQuery(query).tokens.length > 0;

/**
 * Filter + rank products. With an active query the search covers ALL
 * categories; otherwise the selected category is applied.
 * `categoryLabels` maps category value → Vietnamese label for matching.
 */
export const searchProducts = (
    products: Product[],
    query: string,
    category: string,
    categoryLabels: Map<string, string> = noLabels,
): Product[] => {
    const { tokens, clauses } = parseQuery(query);
    if (tokens.length === 0) {
        return category === 'ALL' ? products : products.filter(p => p.category === category);
    }
    const rows = products.map(product => ({ product, idx: indexProduct(product, categoryLabels) }));
    let hits = rows.filter(r => clausesMatch(clauses, r.idx.all, t => tokenMatches(t, r.idx.all, r.idx.joins)));
    if (hits.length === 0 && tokens.some(t => t.length >= 4 && !isNumeric(t))) {
        hits = rows.filter(r => clausesMatch(clauses, r.idx.all, t => fuzzyTokenMatches(t, r.idx.all)));
    }
    return hits
        .map(r => ({ ...r, s: score(r.idx, tokens, clauses) }))
        .sort((a, b) => b.s - a.s || byName(a, b))
        .map(r => r.product);
};
