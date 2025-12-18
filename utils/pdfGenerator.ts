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

export const generatePDFContent = (order: Order, bankInfo: BankInfo | null, orderCount: number, shopTemplate?: ShopTemplate | null): string => {
    const today = new Date().toLocaleDateString('vi-VN');

    // Default shop info if not provided
    const shop = shopTemplate || {
        name: 'KHO SỈ HUY THẢO',
        address: '119/16A Mễ Cốc, Phường 15, Quận 8, TP.HCM',
        phone: '0964727949'
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
            <title>Đơn hàng #${orderCount}</title>
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
                                Ngân hàng: <span style="font-weight: 400;">${bankInfo?.bankName || 'SACOMBANK'}</span>
                            </p>
                            <p style="margin: 5px 0; font-size: 12px; color: ${PDF_COLORS.textDark}; font-weight: 700;">
                                Số TK: <span style="font-weight: 400;">${bankInfo?.accountNumber || '050122554391'}</span>
                            </p>
                            <p style="margin: 5px 0; font-size: 12px; color: ${PDF_COLORS.textDark}; font-weight: 700;">
                                Chủ TK: <span style="font-weight: 400;">${bankInfo?.accountName || 'NGUYỄN THANH HUY'}</span>
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
                        ${order.debt ? `
                        <tr style="background: ${PDF_COLORS.white};">
                            <td colspan="${colSpan}" style="border: 1px solid ${PDF_COLORS.grayBorder}; padding: 8px 15px; text-align: right; font-size: 13px; font-weight: 600; color: #F57C00; border-right: none; border-top: none;">Công nợ cũ:</td>
                            <td style="border: 1px solid ${PDF_COLORS.grayBorder}; padding: 8px 15px; text-align: right; font-size: 13px; color: #F57C00; border-left: 1px solid ${PDF_COLORS.grayBorder}; border-top: none;">+${formatPrice(order.debt)}</td>
                        </tr>
                        ` : ''}
                        <!-- Total Row - Using Accent Color (Cam đỏ) for payment attention -->
                        <tr style="background: ${PDF_COLORS.accent};">
                            <td colspan="${colSpan}" style="padding: 12px 15px; text-align: right; font-size: 16px; font-weight: 700; color: ${PDF_COLORS.white}; text-transform: uppercase; border-right: 1px solid rgba(255,255,255,0.3);">TỔNG CỘNG:</td>
                            <td style="padding: 12px 15px; text-align: right; font-size: 16px; color: ${PDF_COLORS.white}; font-weight: 700;">${formatPrice(order.total)}</td>
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
                    Cảm ơn quý khách! • Đơn hàng #${orderCount} • ${today}
                </div>
            </div>
        </body>
        </html>
    `;
};
