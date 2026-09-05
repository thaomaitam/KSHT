import React from 'react';
import { BarChart3, TrendingUp, DollarSign, ShoppingBag } from 'lucide-react';
import { ReportSummary } from '../../businessService';
import { NoticeBanner } from '../NoticeBanner';

interface ReportsTabProps {
    report: ReportSummary | null;
    truncated?: boolean;
}

const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
};

export const ReportsTab: React.FC<ReportsTabProps> = ({ report, truncated }) => {
    if (!report) {
        return <NoticeBanner kind="info" message="Chưa có số liệu báo cáo từ máy chủ." />;
    }

    const cards = [
        { label: 'Doanh thu đã xác nhận', value: report.confirmedSales, icon: ShoppingBag, hint: 'confirmedSales' },
        { label: 'Thu thực (ròng)', value: report.netReceipts, icon: DollarSign, hint: `Gross ${formatPrice(report.grossReceipts)} − hoàn ${formatPrice(report.refunds)}` },
        { label: 'Phải thu', value: report.receivables, icon: TrendingUp, hint: 'receivables' },
        { label: 'Lợi nhuận', value: report.profit, icon: BarChart3, hint: `COGS ${formatPrice(report.cogs)}` },
    ];

    return (
        <div className="space-y-6">
            <NoticeBanner
                kind="info"
                title={`Báo cáo máy chủ ${report.fromDate} → ${report.toDate}`}
                message={`Múi giờ ${report.timezone}. Không cộng từ danh sách đơn bị cắt trên trình duyệt.`}
            />
            {truncated && (
                <NoticeBanner kind="warning" message="Danh sách đơn/khách trên tab khác bị cắt; số liệu tab này vẫn lấy từ getReportSummary." />
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {cards.map((card) => (
                    <div key={card.label} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <card.icon size={24} />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-slate-500">{card.label}</div>
                            <div className="text-2xl font-black text-slate-800 mt-1">{formatPrice(card.value)}</div>
                            <div className="text-xs text-slate-500 font-medium mt-2">{card.hint}</div>
                        </div>
                    </div>
                ))}
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>Chiết khấu: <strong>{formatPrice(report.discounts)}</strong></div>
                <div>Phí vận chuyển: <strong>{formatPrice(report.shippingFees)}</strong></div>
                <div>Hoàn tiền: <strong>{formatPrice(report.refunds)}</strong></div>
            </div>
        </div>
    );
};
