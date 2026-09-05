import type { Product } from './types.ts';

export const PHONE_NUMBER = "0901234567";

export const CATEGORIES: { id: string; label: string; value: import('./types').Category }[] = [
  { id: '1', label: 'Tất cả', value: 'ALL' },
  { id: '2', label: 'Cọ sơn', value: 'PAINT_BRUSH' },
  { id: '3', label: 'Rulo - Lăn sơn', value: 'ROLLER' },
  { id: '4', label: 'Phụ kiện xây dựng', value: 'ACCESSORY' },
];

export const PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'Cọ Sơn Cán Gỗ Cao Cấp',
    category: 'PAINT_BRUSH',
    description: 'Lông cọ mềm, giữ sơn tốt, cán gỗ tự nhiên chắc chắn, thích hợp cho sơn dầu và sơn nước.',
    image: 'https://picsum.photos/id/112/500/500',
    isHot: true,
    variants: [
      { size: '1 inch', unit: 'Cây', price: 5500 },
      { size: '1.5 inch', unit: 'Cây', price: 7500 },
      { size: '2 inch', unit: 'Cây', price: 9500 },
      { size: '2.5 inch', unit: 'Cây', price: 12000 },
      { size: '3 inch', unit: 'Cây', price: 15000 },
    ]
  },
  {
    id: 'p2',
    name: 'Cọ Sơn Cán Nhựa Tổng Hợp',
    category: 'PAINT_BRUSH',
    description: 'Cán nhựa bền bỉ, dễ vệ sinh, giá thành kinh tế.',
    image: 'https://picsum.photos/id/106/500/500',
    variants: [
      { size: '1 inch', unit: 'Cây', price: 3500 },
      { size: '2 inch', unit: 'Cây', price: 6500 },
      { size: '3 inch', unit: 'Cây', price: 10500 },
      { size: '4 inch', unit: 'Cây', price: 14500 },
    ]
  },
  {
    id: 'p3',
    name: 'Rulo Lăn Sơn Dầu Pro',
    category: 'ROLLER',
    description: 'Bông lăn mịn, không rụng lông, tạo bề mặt sơn bóng đẹp.',
    image: 'https://picsum.photos/id/160/500/500',
    isHot: true,
    variants: [
      { size: '15cm', unit: 'Cây', price: 18000 },
      { size: '23cm', unit: 'Cây', price: 25000 },
      { size: 'Thay bông', unit: 'Cái', price: 12000 },
    ]
  },
  {
    id: 'p4',
    name: 'Rulo Lăn Chỉ (Mini)',
    category: 'ROLLER',
    description: 'Chuyên dùng cho các góc cạnh nhỏ hẹp, đường chỉ phào.',
    image: 'https://picsum.photos/id/175/500/500',
    variants: [
      { size: '6cm', unit: 'Cây', price: 8000 },
      { size: '10cm', unit: 'Cây', price: 11000 },
    ]
  },
  {
    id: 'p5',
    name: 'Bay Hồ Thép Carbon',
    category: 'ACCESSORY',
    description: 'Thép lá carbon đàn hồi tốt, cán gỗ cầm êm tay.',
    image: 'https://picsum.photos/id/250/500/500',
    variants: [
      { size: 'Bay vuông', unit: 'Cái', price: 22000 },
      { size: 'Bay nhọn', unit: 'Cái', price: 22000 },
    ]
  },
  {
    id: 'p6',
    name: 'Bàn Chà Nhám Cầm Tay',
    category: 'ACCESSORY',
    description: 'Dụng cụ hỗ trợ chà nhám tường phẳng, kẹp giấy nhám chắc chắn.',
    image: 'https://picsum.photos/id/366/500/500',
    variants: [
      { size: 'Tiêu chuẩn', unit: 'Cái', price: 15000 },
    ]
  },
];