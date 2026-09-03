# Giaban

Ứng dụng báo giá và quản lý bán hàng cho Kho Sỉ Huy Thảo.

## Kiến trúc

- Frontend tĩnh: React 19, TypeScript và Vite.
- Hosting frontend: GitHub Pages với tên miền trong `public/CNAME`.
- Backend: Cloudflare Worker tại `cloudflare_worker.js`.
- Lưu trữ cloud: Workers KV qua binding `DB`.
- Dữ liệu catalog (`products`, `categories`, `settings`) được đọc công khai; dữ liệu kinh doanh yêu cầu phiên đăng nhập có thời hạn.

Phiên quản trị chỉ được lưu trong `sessionStorage`. Worker không trả hoặc chấp nhận root secret từ trình duyệt.

## Chạy local

Yêu cầu Node.js 20.19+ hoặc 22.12+.

```bash
npm install
npm run dev
```

Vite phục vụ ứng dụng tại `http://localhost:3000`.

## Kiểm tra

```bash
npm run test:worker
npm run typecheck
npm run check:unused
npm run build
npm run worker:dry-run
```

`npm run build` tạo frontend production trong `dist/`. `worker:dry-run` kiểm tra bundle và bindings nhưng không deploy.

## Cấu hình Worker

`wrangler.jsonc` là cấu hình triển khai có thể tái lập cho Worker hiện tại. Các bindings bắt buộc:

- KV: `DB`
- Rate limiter: `LOGIN_RATE_LIMITER`
- Biến thường: `ALLOWED_ORIGINS`
- Secrets: `TK_ADMIN`, `MK_ADMIN`, `SESSION_SIGNING_SECRET`

Không ghi secret vào source, file `.env`, hoặc biến `VITE_*`. Chỉ chạy `npx wrangler deploy --keep-vars` khi đã được phép thay đổi Worker production và các kiểm tra trên đều pass.

`npm run deploy` phát hành `dist/` lên GitHub Pages; đây là thao tác production riêng và không được chạy như một phần của build/kiểm tra thông thường.
