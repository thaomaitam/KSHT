import { Order, BankInfo, ShopTemplate } from '../businessService';
import { OrderItem } from '../hooks/useBusinessData';

// ============================================
// PDF Color Theme: "Trust & Professional"
// Navy - White - Gray Color Palette
// ============================================
const PDF_COLORS = {
    // Primary Brand Colors
    navyDark: '#0D47A1',      // Main title, headers
    navyMedium: '#1565C0',    // Table header background
    navyLight: '#1976D2',     // Accent text

    // Accent Colors
    accent: '#E53E3E',        // Important numbers (total)
    emerald: '#059669',       // Alternative footer color

    // Neutral Colors
    white: '#FFFFFF',
    grayLight: '#F7FAFC',     // Zebra stripe odd rows
    grayBorder: '#E0E0E0',    // Box borders
    grayBoxBg: '#F5F5F5',     // Box backgrounds
    zebraBlue: '#E3F2FD',     // Zebra stripe even rows

    // Text Colors
    textDark: '#1A202C',
    textMedium: '#4A5568',
    textLight: '#718096'
};

const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
};

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
});

const formatCurrency = (price: number): string => currencyFormatter.format(price);

const escapeHtml = (value: string): string => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export interface PickingSlipItem {
    name: string;
    variant: string;
    quantity: number;
    unitPrice: number;
    total: number;
}

export const openPrintWindow = (content: string): Window | null => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return null;

    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.focus();

    return printWindow;
};

export const generatePickingSlipContent = (
    items: PickingSlipItem[],
    total: number,
    today: string,
    phoneNumber: string
): string => {
    const itemsHtml = items.map((item, index) => `
        <div class="item-row">
            <div class="item-left">
                <p class="item-name">${index + 1}. ${escapeHtml(item.name)}</p>
                <p class="item-meta">${escapeHtml(item.variant)} | ${item.quantity} x ${formatCurrency(item.unitPrice)}</p>
            </div>
            <p class="item-total">${formatCurrency(item.total)}</p>
        </div>
    `).join('');

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Phiếu soạn hàng</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body {
                    font-family: Arial, sans-serif;
                    background: #f8fafc;
                    color: #0f172a;
                    padding: 24px;
                }
                .sheet {
                    max-width: 480px;
                    margin: 0 auto;
                    background: #ffffff;
                    border-radius: 24px;
                    overflow: hidden;
                    box-shadow: 0 20px 50px rgba(15, 23, 42, 0.15);
                    border: 1px solid #e2e8f0;
                }
                .sheet-header {
                    padding: 20px 24px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    border-bottom: 1px solid #e2e8f0;
                }
                .sheet-header h2 {
                    font-size: 20px;
                    font-weight: 700;
                    color: #1e293b;
                }
                .sheet-content {
                    padding: 24px;
                }
                .summary-header {
                    text-align: center;
                    margin-bottom: 24px;
                    padding-bottom: 16px;
                    border-bottom: 2px dashed #e2e8f0;
                }
                .summary-icon {
                    width: 48px;
                    height: 48px;
                    margin: 0 auto 12px;
                    border-radius: 9999px;
                    background: #dbeafe;
                    color: #2563eb;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 24px;
                }
                .summary-title {
                    font-size: 20px;
                    font-weight: 700;
                    color: #1e293b;
                    margin-bottom: 4px;
                }
                .summary-date {
                    font-size: 14px;
                    color: #64748b;
                }
                .items {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    margin-bottom: 24px;
                }
                .item-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 16px;
                    padding: 8px 0;
                    border-bottom: 1px solid #f1f5f9;
                }
                .item-row:last-child {
                    border-bottom: 0;
                }
                .item-left {
                    flex: 1;
                    min-width: 0;
                }
                .item-name {
                    font-size: 14px;
                    font-weight: 500;
                    color: #1e293b;
                    margin-bottom: 4px;
                    word-break: break-word;
                }
                .item-meta {
                    font-size: 12px;
                    color: #64748b;
                }
                .item-total {
                    font-size: 14px;
                    font-weight: 600;
                    color: #2563eb;
                    white-space: nowrap;
                }
                .total-box {
                    background: #f8fafc;
                    border-radius: 16px;
                    padding: 16px;
                    margin-bottom: 16px;
                }
                .total-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 16px;
                }
                .total-label {
                    font-size: 16px;
                    font-weight: 700;
                    color: #334155;
                }
                .total-value {
                    font-size: 24px;
                    font-weight: 700;
                    color: #2563eb;
                    white-space: nowrap;
                }
                .contact-box {
                    text-align: center;
                    padding-top: 16px;
                    border-top: 2px dashed #e2e8f0;
                    font-size: 14px;
                    color: #64748b;
                }
                .contact-box strong {
                    color: #334155;
                }
                @media print {
                    body {
                        padding: 0;
                        background: #ffffff;
                    }
                    .sheet {
                        box-shadow: none;
                        border: 0;
                        max-width: 100%;
                        border-radius: 0;
                    }
                }
            </style>
        </head>
        <body>
            <div class="sheet">
                <div class="sheet-header">
                    <h2>Xác nhận phiếu soạn hàng</h2>
                </div>
                <div class="sheet-content">
                    <div class="summary-header">
                        <div class="summary-icon">🛍️</div>
                        <div class="summary-title">PHIẾU SOẠN HÀNG</div>
                        <div class="summary-date">Ngày: ${today}</div>
                    </div>

                    <div class="items">
                        ${itemsHtml}
                    </div>

                    <div class="total-box">
                        <div class="total-row">
                            <span class="total-label">TỔNG CỘNG:</span>
                            <span class="total-value">${formatCurrency(total)}</span>
                        </div>
                    </div>

                    <div class="contact-box">
                        <p>📱 Số điện thoại liên hệ: <strong>${escapeHtml(phoneNumber)}</strong></p>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
};

export const generateImagePreviewContent = (
    title: string,
    imageDataUrl: string,
    imageAlt = 'Hoá đơn'
): string => `
    <!DOCTYPE html>
    <html>
    <head>
        <title>${escapeHtml(title)}</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                background: #1a1a2e;
                min-height: 100vh;
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 20px;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            .toolbar {
                position: fixed;
                top: 20px;
                right: 20px;
                display: flex;
                gap: 10px;
                z-index: 100;
            }
            .btn {
                padding: 12px 24px;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: all 0.2s;
            }
            .btn-print {
                background: #4CAF50;
                color: white;
            }
            .btn-print:hover { background: #45a049; }
            .hint {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(255,255,255,0.9);
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 13px;
                color: #333;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            .invoice-image {
                max-width: 100%;
                height: auto;
                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                border-radius: 8px;
                margin-top: 20px;
            }
            @media print {
                body { background: white; padding: 0; }
                .toolbar, .hint { display: none !important; }
                .invoice-image {
                    box-shadow: none;
                    border-radius: 0;
                    max-width: 100%;
                    margin: 0;
                }
            }
        </style>
    </head>
    <body>
        <div class="toolbar">
            <button class="btn btn-print" onclick="window.print()">
                🖨️ In PDF
            </button>
        </div>
        <img src="${imageDataUrl}" alt="${escapeHtml(imageAlt)}" class="invoice-image" />
        <div class="hint">
            💡 <strong>Tip:</strong> Chuột phải vào ảnh → Sao chép hình ảnh để gửi khách qua Zalo/Messenger
        </div>
    </body>
    </html>
`;

export const generatePDFContent = (order: Order, bankInfo: BankInfo | null, orderCount: number, shopTemplate?: ShopTemplate | null): string => {
    const today = new Date().toLocaleDateString('vi-VN');

    // Use provided shop template or show placeholder
    const shop = shopTemplate || {
        name: '[Chưa có mẫu cửa hàng]',
        address: '[Vui lòng tạo mẫu trong Cài đặt]',
        phone: ''
    };

    const hasSoCuon = order.items.some((item: OrderItem) => item.soCuon !== undefined && item.soCuon > 0);
    const hasSoKi = order.items.some((item: OrderItem) => item.soKi !== undefined && item.soKi > 0);

    let itemsHtml = '';
    order.items.forEach((item: OrderItem, index: number) => {
        // Zebra striping: odd rows white, even rows light blue
        const rowBg = index % 2 === 0 ? PDF_COLORS.white : PDF_COLORS.zebraBlue;
        itemsHtml += `
            <tr style="background: ${rowBg};">
                <td style="border: 1px solid ${PDF_COLORS.grayBorder}; padding: 10px 8px; text-align: center; font-size: 13px; color: ${PDF_COLORS.textDark};">${index + 1}</td>
                <td style="border: 1px solid ${PDF_COLORS.grayBorder}; padding: 10px 8px; font-size: 13px; font-weight: 600; color: ${PDF_COLORS.textDark};">${item.name}</td>
                <td style="border: 1px solid ${PDF_COLORS.grayBorder}; padding: 10px 8px; text-align: center; font-size: 13px; color: ${PDF_COLORS.textDark};">${item.unit}</td>
                <td style="border: 1px solid ${PDF_COLORS.grayBorder}; padding: 10px 8px; text-align: center; font-size: 13px; color: ${PDF_COLORS.textDark};">${item.quantity}</td>
                ${hasSoCuon ? `<td style="border: 1px solid ${PDF_COLORS.grayBorder}; padding: 10px 8px; text-align: center; font-size: 13px; color: ${PDF_COLORS.textDark};">${item.soCuon || ''}</td>` : ''}
                ${hasSoKi ? `<td style="border: 1px solid ${PDF_COLORS.grayBorder}; padding: 10px 8px; text-align: center; font-size: 13px; color: ${PDF_COLORS.textDark};">${item.soKi || ''}</td>` : ''}
                <td style="border: 1px solid ${PDF_COLORS.grayBorder}; padding: 10px 8px; text-align: right; font-size: 13px; color: ${PDF_COLORS.textDark};">${formatPrice(item.unitPrice)}</td>
                <td style="border: 1px solid ${PDF_COLORS.grayBorder}; padding: 10px 8px; text-align: right; font-size: 13px; color: ${PDF_COLORS.navyMedium}; font-weight: 600;">${formatPrice(item.total)}</td>
            </tr>
        `;
    });

    const subtotal = order.items.reduce((sum: number, item: any) => sum + item.total, 0);
    const colSpan = 5 + (hasSoCuon ? 1 : 0) + (hasSoKi ? 1 : 0);

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Phiếu xuất kho #${orderCount}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;600;700&display=swap');
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { 
                    font-family: 'Roboto', Arial, sans-serif; 
                    margin: 0; 
                    padding: 20px; 
                    background: #fff; 
                    color: ${PDF_COLORS.textDark};
                    font-size: 14px;
                }
                .container { 
                    max-width: 800px; 
                    margin: 0 auto; 
                    background: #fff; 
                    padding: 20px;
                }
                @media print {
                    body { background: #fff; padding: 0; }
                    .container { box-shadow: none; padding: 10px; }
                    -webkit-print-color-adjust: exact; 
                    print-color-adjust: exact;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <!-- Header with Shop Name -->
                <div style="text-align: center; margin-bottom: 15px;">
                    <h1 style="color: ${PDF_COLORS.navyDark}; margin: 0 0 8px 0; font-size: 28px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">${shop.name}</h1>
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                        <p style="color: ${PDF_COLORS.textMedium}; font-size: 14px; margin: 0; display: flex; align-items: center; gap: 6px;">
                            <span style="color: ${PDF_COLORS.navyMedium}; font-size: 16px;">📍</span> ${shop.address}
                        </p>
                        <p style="color: ${PDF_COLORS.textMedium}; font-size: 14px; margin: 0; display: flex; align-items: center; gap: 6px;">
                            <span style="color: ${PDF_COLORS.navyMedium}; font-size: 16px;">📞</span> ${shop.phone}
                        </p>
                    </div>
                    <div style="border-bottom: 2px solid ${PDF_COLORS.navyDark}; margin-top: 15px; width: 100%;"></div>
                </div>

                <!-- Customer & Bank Info Boxes -->
                <div style="display: flex; gap: 10px; margin-bottom: 20px; margin-top: 15px;">
                    <!-- Customer Info Box -->
                    <div style="flex: 1; background: ${PDF_COLORS.white}; padding: 15px; border: 1px solid ${PDF_COLORS.grayBorder}; border-radius: 10px;">
                        <p style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: ${PDF_COLORS.navyDark};">
                            KHÁCH HÀNG: ${order.customerName.toUpperCase()}
                        </p>
                        <p style="margin: 5px 0; font-size: 12px; color: ${PDF_COLORS.textDark};">
                            <span style="color: ${PDF_COLORS.navyMedium};">📍</span> Địa chỉ: ${order.address || 'Chưa cập nhật'}
                        </p>
                        <p style="margin: 5px 0; font-size: 12px; color: ${PDF_COLORS.textDark};">
                            <span style="color: ${PDF_COLORS.navyMedium};">📞</span> SĐT: ${order.phone || 'Chưa cập nhật'}
                        </p>
                        <p style="margin: 5px 0; font-size: 12px; color: ${PDF_COLORS.textDark};">
                            <span style="color: ${PDF_COLORS.navyMedium};">📅</span> Ngày: ${today}
                        </p>
                    </div>
                    
                    <!-- Bank Info Box -->
                    <div style="flex: 1; background: ${PDF_COLORS.white}; border: 1px solid ${PDF_COLORS.grayBorder}; border-radius: 10px; overflow: hidden;">
                        <p style="margin: 0; padding: 10px 15px; font-size: 13px; font-weight: 700; color: ${PDF_COLORS.navyDark}; background: ${PDF_COLORS.grayBoxBg}; border-bottom: 1px solid ${PDF_COLORS.grayBorder};">
                            ≡ THÔNG TIN CHUYỂN KHOẢN
                        </p>
                        <div style="padding: 12px 15px;">
                            <p style="margin: 5px 0; font-size: 12px; color: ${PDF_COLORS.textDark}; font-weight: 700;">
                                Ngân hàng: <span style="font-weight: 400;">${bankInfo?.bankName || '[Chưa cài đặt]'}</span>
                            </p>
                            <p style="margin: 5px 0; font-size: 12px; color: ${PDF_COLORS.textDark}; font-weight: 700;">
                                Số TK: <span style="font-weight: 400;">${bankInfo?.accountNumber || ''}</span>
                            </p>
                            <p style="margin: 5px 0; font-size: 12px; color: ${PDF_COLORS.textDark}; font-weight: 700;">
                                Chủ TK: <span style="font-weight: 400;">${bankInfo?.accountName || ''}</span>
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Products Table -->
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 0; border: 1px solid ${PDF_COLORS.grayBorder};">
                    <thead>
                        <tr style="background: ${PDF_COLORS.navyMedium};">
                            <th style="color: ${PDF_COLORS.white}; padding: 12px 8px; text-align: center; border-right: 1px solid rgba(255,255,255,0.2); font-size: 12px; width: 40px; font-weight: 700;">STT</th>
                            <th style="color: ${PDF_COLORS.white}; padding: 12px 8px; text-align: left; border-right: 1px solid rgba(255,255,255,0.2); font-size: 12px; font-weight: 700;">Tên hàng</th>
                            <th style="color: ${PDF_COLORS.white}; padding: 12px 8px; text-align: center; border-right: 1px solid rgba(255,255,255,0.2); font-size: 12px; width: 60px; font-weight: 700;">ĐVT</th>
                            <th style="color: ${PDF_COLORS.white}; padding: 12px 8px; text-align: center; border-right: 1px solid rgba(255,255,255,0.2); font-size: 12px; width: 50px; font-weight: 700;">SL</th>
                            ${hasSoCuon ? `<th style="color: ${PDF_COLORS.white}; padding: 12px 8px; text-align: center; border-right: 1px solid rgba(255,255,255,0.2); font-size: 12px; width: 60px; font-weight: 700;">Số cuộn</th>` : ''}
                            ${hasSoKi ? `<th style="color: ${PDF_COLORS.white}; padding: 12px 8px; text-align: center; border-right: 1px solid rgba(255,255,255,0.2); font-size: 12px; width: 60px; font-weight: 700;">Số kí</th>` : ''}
                            <th style="color: ${PDF_COLORS.white}; padding: 12px 8px; text-align: center; border-right: 1px solid rgba(255,255,255,0.2); font-size: 12px; width: 90px; font-weight: 700;">Đơn giá</th>
                            <th style="color: ${PDF_COLORS.white}; padding: 12px 8px; text-align: center; font-size: 12px; width: 100px; font-weight: 700;">Thành tiền</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                        <!-- Subtotal Row -->
                        <tr style="background: ${PDF_COLORS.grayLight};">
                            <td colspan="${colSpan}" style="border: 1px solid ${PDF_COLORS.grayBorder}; padding: 10px 15px; text-align: right; font-size: 13px; font-weight: 700; color: ${PDF_COLORS.textDark}; border-right: none;">Tạm tính:</td>
                            <td style="border: 1px solid ${PDF_COLORS.grayBorder}; padding: 10px 15px; text-align: right; font-size: 13px; color: ${PDF_COLORS.textDark}; font-weight: 700; border-left: 1px solid ${PDF_COLORS.grayBorder};">${formatPrice(subtotal)}</td>
                        </tr>
                        ${order.shippingFee ? `
                        <tr style="background: ${PDF_COLORS.white};">
                            <td colspan="${colSpan}" style="border: 1px solid ${PDF_COLORS.grayBorder}; padding: 8px 15px; text-align: right; font-size: 13px; font-weight: 600; color: ${PDF_COLORS.textMedium}; border-right: none; border-top: none;">Phí vận chuyển:</td>
                            <td style="border: 1px solid ${PDF_COLORS.grayBorder}; padding: 8px 15px; text-align: right; font-size: 13px; color: ${PDF_COLORS.textMedium}; border-left: 1px solid ${PDF_COLORS.grayBorder}; border-top: none;">+${formatPrice(order.shippingFee)}</td>
                        </tr>
                        ` : ''}
                        ${order.discount ? `
                        <tr style="background: ${PDF_COLORS.grayLight};">
                            <td colspan="${colSpan}" style="border: 1px solid ${PDF_COLORS.grayBorder}; padding: 8px 15px; text-align: right; font-size: 13px; font-weight: 600; color: ${PDF_COLORS.accent}; border-right: none; border-top: none;">Chiết khấu:</td>
                            <td style="border: 1px solid ${PDF_COLORS.grayBorder}; padding: 8px 15px; text-align: right; font-size: 13px; color: ${PDF_COLORS.accent}; border-left: 1px solid ${PDF_COLORS.grayBorder}; border-top: none;">-${formatPrice(order.discount)}</td>
                        </tr>
                        ` : ''}
                        ${order.outstanding ? `
                        <tr style="background: ${PDF_COLORS.white};">
                            <td colspan="${colSpan}" style="border: 1px solid ${PDF_COLORS.grayBorder}; padding: 8px 15px; text-align: right; font-size: 13px; font-weight: 600; color: #F57C00; border-right: none; border-top: none;">Còn phải thu:</td>
                            <td style="border: 1px solid ${PDF_COLORS.grayBorder}; padding: 8px 15px; text-align: right; font-size: 13px; color: #F57C00; border-left: 1px solid ${PDF_COLORS.grayBorder}; border-top: none;">${formatPrice(order.outstanding)}</td>
                        </tr>
                        ` : ''}
                        <!-- Total Row - Using Accent Color (Cam đỏ) for payment attention -->
                        <tr style="background: ${PDF_COLORS.accent};">
                            <td colspan="${colSpan}" style="padding: 12px 15px; text-align: right; font-size: 16px; font-weight: 700; color: ${PDF_COLORS.white}; text-transform: uppercase; border-right: 1px solid rgba(255,255,255,0.3);">TỔNG CỘNG:</td>
                            <td style="padding: 12px 15px; text-align: right; font-size: 16px; color: ${PDF_COLORS.white}; font-weight: 700;">${formatPrice(order.total)}</td>
                        </tr>
                        <!-- Amount in words -->
                        <tr style="background: ${PDF_COLORS.white};">
                            <td colspan="${colSpan + 1}" style="border: 1px solid ${PDF_COLORS.grayBorder}; padding: 10px 15px; text-align: left; font-size: 13px; font-style: italic; color: ${PDF_COLORS.textDark}; border-top: none;">
                                Cộng Thành Tiền (viết bằng chữ): ${order.totalAmountInWords || '................................................................................................................................................................................'}
                            </td>
                        </tr>
                    </tbody>
                </table>

                ${order.note ? `
                <!-- Note Section -->
                <div style="margin-top: 15px; padding: 12px 15px; background: ${PDF_COLORS.zebraBlue}; border-left: 4px solid ${PDF_COLORS.navyMedium}; border-radius: 5px;">
                    <p style="margin: 0; font-size: 13px; color: ${PDF_COLORS.navyDark}; font-weight: 700;">
                        Ghi chú: <span style="font-weight: 400; color: ${PDF_COLORS.textDark};">${order.note}</span>
                    </p>
                </div>
                ` : ''}

                <!-- Footer -->
                <div style="text-align: center; color: ${PDF_COLORS.textLight}; font-size: 12px; margin-top: 40px; padding-top: 10px; border-top: 1px solid ${PDF_COLORS.grayBorder};">
                    Cảm ơn quý khách! • Phiếu xuất kho #${orderCount} • ${today}
                </div>
            </div>
        </body>
        </html>
    `;
};

export const generateReceiptContent = (order: Order, orderCount: number, shopTemplate?: ShopTemplate | null, bankInfo?: BankInfo | null): string => {
    const today = new Date().toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    const shop = shopTemplate || {
        name: '[Chưa có mẫu cửa hàng]',
        address: '[Vui lòng tạo mẫu trong Cài đặt]',
        phone: ''
    };

    const bank = bankInfo || {
        bankName: '[Chưa cài đặt]',
        accountNumber: '',
        accountName: ''
    };

    let itemsHtml = '';
    order.items.forEach((item: OrderItem, index: number) => {
        itemsHtml += `
            <div style="padding: 6px 0; border-bottom: 1px solid #ddd;">
                <p style="margin: 0; font-weight: 500; color: #000; font-size: 12px;">
                    ${index + 1}. ${item.name}
                </p>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2px;">
                    <span style="color: #000; font-size: 11px;">
                        ${item.unit} | ${item.quantity} x ${formatPrice(item.unitPrice)}
                    </span>
                    <span style="font-weight: 700; color: #000; font-size: 12px; padding-right: 13px;">
                        ${formatPrice(item.total)}
                    </span>
                </div>
            </div>
        `;
    });

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Bill #${orderCount}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { 
                    font-family: 'Inter', -apple-system, sans-serif; 
                    background: #fff; 
                    color: #000;
                    line-height: 1.5;
                }
                .receipt { 
                    width: 80mm; 
                    margin: 0 auto; 
                    padding: 10px;
                    background: white;
                }
                @media print {
                    body { margin: 0; padding: 0; }
                    .receipt { width: 100%; padding: 5px; }
                    @page { margin: 0; }
                }
            </style>
        </head>
        <body>
            <div class="receipt">
                <!-- Header -->
                <div style="text-align: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px dashed #000;">
                    <h1 style="font-size: 18px; font-weight: 700; color: #000; margin-bottom: 4px; text-transform: uppercase;">${shop.name}</h1>
                    <p style="font-size: 11px; color: #000; margin-bottom: 2px;">${shop.address}</p>
                    <p style="font-size: 11px; color: #000;">SĐT: ${shop.phone}</p>
                    <p style="font-size: 10px; color: #000; margin-top: 4px; font-weight: 600;">STK: ${bank.accountNumber} - ${bank.bankName}</p>
                    <p style="font-size: 10px; color: #000; font-weight: 600;">Chủ TK: ${bank.accountName}</p>
                </div>

                <!-- Order Info -->
                <div style="text-align: center; margin-bottom: 10px;">
                    <h2 style="font-size: 15px; font-weight: 700; color: #000; margin-bottom: 2px;">PHIẾU XUẤT KHO</h2>
                    <p style="font-size: 11px; color: #000;">Ngày: ${today}</p>
                </div>

                <!-- Customer Info -->
                <div style="margin-bottom: 12px; padding: 10px; border: 1px solid #000; border-radius: 4px; text-align: center;">
                    <p style="font-size: 12px; color: #000; margin-bottom: 2px;"><strong>Khách hàng:</strong> ${order.customerName}</p>
                    ${order.phone ? `<p style="font-size: 11px; color: #000; margin-bottom: 2px;">SĐT: ${order.phone}</p>` : ''}
                    ${order.address ? `<p style="font-size: 11px; color: #000;">ĐC: ${order.address}</p>` : ''}
                </div>

                <!-- Items -->
                <div style="margin-bottom: 12px;">
                    ${itemsHtml}
                </div>

                <!-- Summary -->
                <div style="border-top: 2px solid #000; padding: 8px 0; margin-bottom: 10px;">
                    <!-- Subtotal -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="color: #000; font-size: 11px;">Tạm tính:</span>
                        <span style="font-size: 11px; color: #000; padding-right: 10px;">${formatPrice(order.items.reduce((sum: number, item: OrderItem) => sum + item.total, 0))}</span>
                    </div>
                    ${order.shippingFee ? `
                    <!-- Shipping Fee -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="color: #000; font-size: 11px;">Phí vận chuyển:</span>
                        <span style="font-size: 11px; color: #000; padding-right: 10px;">+${formatPrice(order.shippingFee)}</span>
                    </div>
                    ` : ''}
                    ${order.discount ? `
                    <!-- Discount -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="color: #E53E3E; font-size: 11px;">Chiết khấu:</span>
                        <span style="font-size: 11px; color: #E53E3E; padding-right: 10px;">-${formatPrice(order.discount)}</span>
                    </div>
                    ` : ''}
                    ${order.outstanding ? `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="color: #F57C00; font-size: 11px;">Còn phải thu:</span>
                        <span style="font-size: 11px; color: #F57C00; padding-right: 10px;">${formatPrice(order.outstanding)}</span>
                    </div>
                    ` : ''}
                    <!-- Total -->
                    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 6px; border-top: 1px solid #000;">
                        <span style="font-weight: 700; color: #000; font-size: 13px;">TỔNG CỘNG:</span>
                        <span style="font-size: 16px; font-weight: 700; color: #000; padding-right: 10px;">${formatPrice(order.total)}</span>
                    </div>
                </div>

                <!-- Amount in words -->
                <div style="margin-bottom: 12px; font-size: 11px; font-style: italic; color: #000; line-height: 1.6;">
                    Cộng Thành Tiền (viết bằng chữ): ${order.totalAmountInWords || '.................................................................................................................................................................'}
                </div>

                <!-- Notes -->
                ${order.note ? `
                <div style="margin-bottom: 12px; padding: 8px; border: 1px dashed #000; border-radius: 4px;">
                    <p style="font-size: 11px; color: #000;"><strong>Ghi chú:</strong> ${order.note}</p>
                </div>
                ` : ''}

                <!-- Signatures -->
                <div style="margin-top: 15px; margin-bottom: 50px; display: flex; justify-content: space-between;">
                    <div style="text-align: center; width: 45%;">
                        <p style="font-size: 11px; font-weight: 700;">Người Nhận Hàng</p>
                        <p style="font-size: 9px; font-style: italic;">(Ký, ghi rõ họ tên)</p>
                    </div>
                    <div style="text-align: center; width: 45%;">
                        <p style="font-size: 11px; font-weight: 700;">Người Viết Hoá Đơn</p>
                        <p style="font-size: 9px; font-style: italic;">(Ký, ghi rõ họ tên)</p>
                    </div>
                </div>

                <!-- Footer -->
                <div style="text-align: center; padding-top: 10px; border-top: 1px dashed #000;">
                    <p style="font-size: 11px; color: #000;">Cảm ơn quý khách đã ủng hộ!</p>
                    <p style="font-size: 10px; color: #000; margin-top: 4px;">Phiếu xuất kho #${orderCount}</p>
                </div>
            </div>
        </body>
        </html>
    `;
};
