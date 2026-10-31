import test from 'node:test';
import assert from 'node:assert/strict';
import { groupCategories, displayCategoryLabel, OTHER_GROUP } from '../../utils/categoryGroups.ts';

const cats = [
    { id: 'ALL', label: 'Tất cả', value: 'ALL' },
    { id: '1', label: 'BÚA', value: 'BUA' },
    { id: '2', label: 'CHÉN CƯỚC', value: 'CHEN_CUOC' },
    { id: '3', label: 'MỚI TOANH', value: 'NEW_CAT' },
    { id: '4', label: 'NHÁM', value: 'NHAM' },
];
const products = [
    { category: 'BUA', image: 'a.png' }, { category: 'BUA', image: 'b.png' },
    { category: 'NEW_CAT' }, { category: 'NHAM', image: 'n.png' }, { category: 'ORPHAN' },
];

test('maps known categories into configured groups with counts and first image', () => {
    const g = groupCategories(cats, products);
    assert.deepEqual(g.map(x => x.name), ['Sơn & hoàn thiện', 'Dụng cụ cầm tay', OTHER_GROUP]);
    const bua = g[1].items[0];
    assert.equal(bua.category.value, 'BUA');
    assert.equal(bua.count, 2);
    assert.equal(bua.image, 'a.png');
});

test('unmapped categories fall back to Khác so they never disappear', () => {
    const g = groupCategories(cats, products);
    const other = g.find(x => x.name === OTHER_GROUP);
    assert.ok(other);
    assert.deepEqual(other.items.map(i => i.category.value), ['NEW_CAT']);
});

test('hides ALL and categories with 0 products, and omits empty groups', () => {
    const values = groupCategories(cats, products).flatMap(x => x.items.map(i => i.category.value));
    assert.ok(!values.includes('ALL'));
    assert.ok(!values.includes('CHEN_CUOC'));
    assert.ok(!groupCategories(cats, products).some(x => x.name === 'Xây dựng & khác'));
});

test('no Khác group when everything is mapped', () => {
    const g = groupCategories(cats.filter(c => c.value !== 'NEW_CAT'), products);
    assert.ok(!g.some(x => x.name === OTHER_GROUP));
});

test('displayCategoryLabel uses Vietnamese sentence case', () => {
    assert.equal(displayCategoryLabel('MỎ HÀN / KHÒ'), 'Mỏ hàn / khò');
    assert.equal(displayCategoryLabel('Dây Bô'), 'Dây bô');
});
