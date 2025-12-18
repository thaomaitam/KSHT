import { Order, BankInfo } from '../businessService';
import { OrderItem } from '../hooks/useBusinessData';

const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
};

export const generatePDFContent = (order: Order, bankInfo: BankInfo | null, orderCount: number): string => {
    const today = new Date().toLocaleDateString('vi-VN');

    let itemsHtml = '';
    order.items.forEach((item: OrderItem, index: number) => {
        itemsHtml += `
            <tr>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-size: 13px;">${index + 1}</td>
                <td style="border: 1px solid #ddd; padding: 8px; font-size: 13px; font-weight: 600;">${item.name}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-size: 13px;">${item.unit}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-size: 13px;">${item.quantity}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-size: 13px;">${item.quantity}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-size: 13px;">${formatPrice(item.unitPrice)}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-size: 13px; color: #1565C0;">${formatPrice(item.total)}</td>
            </tr>
        `;
    });

    const subtotal = order.items.reduce((sum: number, item: any) => sum + item.total, 0);

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
                    color: #333;
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
                <div style="text-align: center; margin-bottom: 15px;">
                    <h1 style="color: #E91E63; margin: 0 0 8px 0; font-size: 28px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">KHO SỈ HUY THẢO</h1>
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                        <p style="color: #64748b; font-size: 14px; margin: 0; display: flex; align-items: center; gap: 6px;">
                            <span style="color: #E91E63; font-size: 16px;">📍</span> 119/16A Mễ Cốc, Phường 15, Quận 8, TP.HCM
                        </p>
                        <p style="color: #64748b; font-size: 14px; margin: 0; display: flex; align-items: center; gap: 6px;">
                            <span style="color: #E91E63; font-size: 16px;">📞</span> 0964727949
                        </p>
                    </div>
                    <div style="border-bottom: 1px solid #1e293b; margin-top: 15px; width: 100%;"></div>
                </div>

                <div style="display: flex; gap: 10px; margin-bottom: 20px; margin-top: 15px;">
                    <div style="flex: 1; background: #F5F5F5; padding: 15px; border: 1px solid #ddd; border-radius: 10px;">
                        <p style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #000;">
                            KHÁCH HÀNG: ${order.customerName.toUpperCase()}${order.note ? ` (${order.note})` : ''}
                        </p>
                        <p style="margin: 5px 0; font-size: 12px; color: #333;">
                            <span style="color: #E84393;">📍</span> Địa chỉ: ${order.address || 'Chưa cập nhật'}
                        </p>
                        <p style="margin: 5px 0; font-size: 12px; color: #333;">
                            <span style="color: #4CAF50;">📞</span> SĐT: ${order.phone || 'Chưa cập nhật'}
                        </p>
                        <p style="margin: 5px 0; font-size: 12px; color: #333;">
                            <span style="color: #1976D2;">📅</span> Ngày: ${today}
                        </p>
                    </div>
                    
                    <div style="flex: 1; background: #E3F2FD; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
                        <p style="margin: 0; padding: 10px 15px; font-size: 13px; font-weight: 700; color: #1976D2; background: #E3F2FD; border-bottom: 1px solid #ddd;">
                            ≡ THÔNG TIN CHUYỂN KHOẢN
                        </p>
                        <div style="padding: 12px 15px;">
                            <p style="margin: 5px 0; font-size: 12px; color: #333; font-weight: 700;">
                                Ngân hàng: <span style="font-weight: 400;">${bankInfo?.bankName || 'SACOMBANK'}</span>
                            </p>
                            <p style="margin: 5px 0; font-size: 12px; color: #333; font-weight: 700;">
                                Số TK: <span style="font-weight: 400;">${bankInfo?.accountNumber || '050122554391'}</span>
                            </p>
                            <p style="margin: 5px 0; font-size: 12px; color: #333; font-weight: 700;">
                                Chủ TK: <span style="font-weight: 400;">${bankInfo?.accountName || 'NGUYỄN THANH HUY'}</span>
                            </p>
                        </div>
                    </div>
                </div>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 0; border: 1px solid #ddd;">
                    <thead>
                        <tr style="background: #333333;">
                            <th style="color: #fff; padding: 10px 6px; text-align: center; border-right: 1px solid #fff; font-size: 12px; width: 40px; font-weight: 700;">STT</th>
                            <th style="color: #fff; padding: 10px 6px; text-align: left; border-right: 1px solid #fff; font-size: 12px; font-weight: 700;">Tên hàng</th>
                            <th style="color: #fff; padding: 10px 6px; text-align: center; border-right: 1px solid #fff; font-size: 12px; width: 60px; font-weight: 700;">ĐVT</th>
                            <th style="color: #fff; padding: 10px 6px; text-align: center; border-right: 1px solid #fff; font-size: 12px; width: 40px; font-weight: 700;">SL</th>
                            <th style="color: #fff; padding: 10px 6px; text-align: center; border-right: 1px solid #fff; font-size: 12px; width: 50px; font-weight: 700;">Số kí</th>
                            <th style="color: #fff; padding: 10px 6px; text-align: center; border-right: 1px solid #fff; font-size: 12px; width: 80px; font-weight: 700;">Đơn giá</th>
                            <th style="color: #fff; padding: 10px 6px; text-align: center; font-size: 12px; width: 100px; font-weight: 700;">Thành tiền</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                        <tr>
                            <td colspan="6" style="border: 1px solid #ddd; padding: 8px 15px; text-align: right; font-size: 13px; font-weight: 700; color: #000; border-right: none;">Tạm tính:</td>
                            <td style="border: 1px solid #ddd; padding: 8px 15px; text-align: right; font-size: 13px; color: #000; font-weight: 700; border-left: 1px solid #ddd;">${formatPrice(subtotal)}</td>
                        </tr>
                        ${order.shippingFee ? `
                        <tr>
                            <td colspan="6" style="border: 1px solid #ddd; padding: 8px 15px; text-align: right; font-size: 13px; font-weight: 700; color: #666; border-right: none; border-top: none;">Phí vận chuyển:</td>
                            <td style="border: 1px solid #ddd; padding: 8px 15px; text-align: right; font-size: 13px; color: #666; border-left: 1px solid #ddd; border-top: none;">+${formatPrice(order.shippingFee)}</td>
                        </tr>
                        ` : ''}
                        ${order.discount ? `
                        <tr>
                            <td colspan="6" style="border: 1px solid #ddd; padding: 8px 15px; text-align: right; font-size: 13px; font-weight: 700; color: #e91e63; border-right: none; border-top: none;">Chiết khấu:</td>
                            <td style="border: 1px solid #ddd; padding: 8px 15px; text-align: right; font-size: 13px; color: #e91e63; border-left: 1px solid #ddd; border-top: none;">-${formatPrice(order.discount)}</td>
                        </tr>
                        ` : ''}
                        ${order.debt ? `
                        <tr>
                            <td colspan="6" style="border: 1px solid #ddd; padding: 8px 15px; text-align: right; font-size: 13px; font-weight: 700; color: #f57c00; border-right: none; border-top: none;">Công nợ cũ:</td>
                            <td style="border: 1px solid #ddd; padding: 8px 15px; text-align: right; font-size: 13px; color: #f57c00; border-left: 1px solid #ddd; border-top: none;">+${formatPrice(order.debt)}</td>
                        </tr>
                        ` : ''}
                        <tr style="background: #4CAF50;">
                            <td colspan="6" style="padding: 10px 15px; text-align: right; font-size: 15px; font-weight: 700; color: #fff; text-transform: uppercase; border-right: 1px solid #fff;">TỔNG CỘNG:</td>
                            <td style="padding: 10px 15px; text-align: right; font-size: 15px; color: #fff; font-weight: 700;">${formatPrice(order.total)}</td>
                        </tr>
                    </tbody>
                </table>

                <div style="text-align: center; color: #666; font-size: 12px; margin-top: 40px; padding-top: 10px; border-top: 1px solid #eee;">
                    Cảm ơn quý khách! • Đơn hàng #${orderCount} • ${today}
        </div>
    </body>
    </html>
    `;
};
