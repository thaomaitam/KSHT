import test from 'node:test';
import assert from 'node:assert/strict';
import { searchProducts, normalizeVietnamese } from '../../utils/searchUtils.ts';

const v = (...sizes: string[]) => sizes.map(size => ({ size, unit: 'cái', price: 1 }));
const P = (id: string, name: string, category: string, description = '', sizes: string[] = ['1']) =>
    ({ id, name, category, description, image: '', variants: v(...sizes) });

const products = [
    P('k1', 'Kìm cắt góc', 'KIM'),
    P('k2', 'KÌM ĐIỆN GF', 'KIM'),
    P('k3', 'Kìm bấm chữ C', 'KIM'),
    P('t1', 'Thùng đồ nghề mủ Hark Caput', 'THUNG_DO_NGHE'),
    P('t2', 'Thùng đồ nghề Inox', 'THUNG_DO_NGHE'),
    P('n1', 'Lăn Mini NT( thùng 100 cây)', 'ROLLER'),
    P('n2', 'Lăn sơn nước 23cm', 'ROLLER'),
    P('d1', 'Đồng hồ đo điện Hark Caput', 'ACCESSORY', 'Dụng cụ nghề điện'),
    P('v1', 'Tô vít hark caput 2 đầu trong', 'TO_VIT', 'Hark Caput. Mã YT-70504, YT-70506.'),
    P('v2', 'Tô vít Tăng NKD vàng đen', 'TO_VIT'),
    P('x1', 'Bay tốt Thái mỹ', 'ACCESSORY'),
    P('x2', 'CAO SU NON TOMBO MALAYSIA', 'ACCESSORY', 'vít ống nước'),
    P('x3', 'Mũi bắn vít kingtony', 'MUI_KHOAN_MUI_VIT'),
    P('m1', 'Mũi khoan kính loại 1 (65-100mm)', 'MUI_KHOAN_MUI_VIT', '', ['65', '100mm']),
    P('m2', 'Mũi khoan Inox Favi', 'MUI_KHOAN_MUI_VIT', '', ['8mm', '10mm', '12mm']),
    P('m3', 'Mũi khoan bê tông 10', 'MUI_KHOAN_MUI_VIT', '', ['10']),
    P('l1', 'Cần típ Hark Caput 1/2', 'CAN_TIP_MO_LET'),
    P('b1', 'BÚT LÔNG KIM', 'ACCESSORY'),
    P('th1', 'Thước thủy hít Hark Caput', 'THUOC'),
    P('e1', 'EKE MÁY LẠNH', 'ACCESSORY'),
];
const labels = new Map([
    ['KIM', 'KÌM'], ['THUNG_DO_NGHE', 'THÙNG ĐỒ NGHỀ'], ['ROLLER', 'RULO - LĂN SƠN'],
    ['ACCESSORY', 'PHỤ KIỆN XÂY DỰNG'], ['TO_VIT', 'TÔ VÍT'], ['MUI_KHOAN_MUI_VIT', 'MŨI KHOAN / MŨI VÍT'],
    ['CAN_TIP_MO_LET', 'CẦN TÍP / MỎ LẾT'], ['THUOC', 'THƯỚC'],
]);
const ids = (q: string, cat = 'ALL') => searchProducts(products, q, cat, labels).map(p => p.id);

test('normalization: case, diacritics, đ, NFD input', () => {
    assert.equal(normalizeVietnamese('ĐỒ NGHỀ'), 'do nghe');
    assert.equal(normalizeVietnamese('Ki\u0300m'), 'kim'); // decomposed accent
});

test('kim / kìm / KIM give the same kìm products (and the needle pen)', () => {
    const a = ids('kim');
    assert.deepEqual(ids('kìm'), a);
    assert.deepEqual(ids('KIM'), a);
    assert.ok(['k1', 'k2', 'k3'].every(id => a.includes(id)));
});

test('thung do nghe: AND across tokens, toolboxes first, word order free', () => {
    const r = ids('thung do nghe');
    assert.deepEqual(r.slice(0, 2).sort(), ['t1', 't2']);
    assert.ok(!r.includes('n1'), 'Lăn Mini (thùng 100 cây) lacks "do nghe"');
    assert.ok(!r.includes('th1'));
    assert.deepEqual(ids('do nghe thung').sort(), r.slice().sort());
});

test('to vit: word-prefix matching excludes tốt / TOMBO', () => {
    const r = ids('to vit');
    assert.ok(r.includes('v1') && r.includes('v2'));
    assert.ok(!r.includes('x1') && !r.includes('x2'));
    assert.equal(r[0].startsWith('v'), true);
});

test('rulo finds Lăn products via category name / synonym', () => {
    const r = ids('rulo');
    assert.ok(r.includes('n1') && r.includes('n2'));
    assert.ok(!r.includes('e1'), 'synonym lăn must not prefix-match lạnh');
});

test('kim ranks real kìm (category + name start) above the needle pen', () => {
    const r = ids('kim');
    assert.ok(r.indexOf('b1') > Math.max(r.indexOf('k1'), r.indexOf('k2'), r.indexOf('k3')));
});

test('joined word: tovit finds tô vít', () => {
    const r = ids('tovit');
    assert.ok(r.includes('v1') && r.includes('v2'));
    assert.ok(!r.includes('x3'));
});

test('synonym: tua vit maps to tô vít', () => {
    const r = ids('tua vit');
    assert.deepEqual(r.slice(0, 2).sort(), ['v1', 'v2']);
});

test('synonym: mo let finds cần típ', () => {
    assert.ok(ids('mo let').includes('l1'));
});

test('mui khoan 10 ranks exact 10 / 10mm first and drops 100mm-only', () => {
    const r = ids('mui khoan 10');
    assert.deepEqual(r.slice(0, 2).sort(), ['m2', 'm3']);
    assert.ok(!r.includes('m1'));
});

test('product code still works', () => {
    assert.deepEqual(ids('YT-70504'), ['v1']);
    assert.deepEqual(ids('yt70504'), ['v1']);
});

test('1-char non-numeric tokens are ignored; numeric kept', () => {
    assert.deepEqual(ids('kìm a'), ids('kìm'));
    assert.equal(ids('a').length, products.length);
});

test('typo fallback (edit distance 1, tokens >= 4) only when AND finds nothing', () => {
    assert.ok(ids('thuoc').includes('th1'));
    assert.ok(ids('thuocc').includes('th1'));
    assert.deepEqual(ids('kingtonyy'), ['x3']);
    assert.deepEqual(ids('qwzx'), []);
    assert.deepEqual(ids('xyz'), []); // 3 chars: no fuzzy
});

test('active query searches all categories regardless of selected category', () => {
    assert.ok(ids('búa', 'NHAM').length === 0);
    assert.ok(ids('kim', 'ROLLER').includes('k1'));
    assert.deepEqual(ids('', 'ROLLER').sort(), ['n1', 'n2']);
});

test('stable tie-break by name', () => {
    const r = searchProducts(products, 'hark', 'ALL', labels).map(p => p.name);
    const again = searchProducts([...products].reverse(), 'hark', 'ALL', labels).map(p => p.name);
    assert.deepEqual(r, again);
});
