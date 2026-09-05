import React from 'react';
import { TrendingUp } from 'lucide-react';
import { ReportSummary } from '../../businessService';
import { NoticeBanner } from '../NoticeBanner';

interface ProfitTabProps {
    report: ReportSummary | null;
}

const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
};

export const ProfitTab: React.FC<ProfitTabProps> = ({ report }) => {
    if (!report) {
        return <NoticeBanner kind="info" message="Chưa có số liệu lợi nhuận từ máy chủ." />;
    }

    return (
        <div className="space-y-6">
            <NoticeBanner
                kind="info"
                title="Lợi nhuận do máy chủ tính"
                message="Không cộng lại từ đơn trên trình duyệt. Máy chủ chưa có báo cáo lợi nhuận từng đơn."
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-100">
                    <div className="text-sm text-slate-500">Doanh thu đã xác nhận</div>
                    <div className="text-2xl font-black mt-2">{formatPrice(report.confirmedSales)}</div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-100">
                    <div className="text-sm text-slate-500">Giá vốn (COGS)</div>
                    <div className="text-2xl font-black mt-2">{formatPrice(report.cogs)}</div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-emerald-100">
                    <div className="text-sm text-emerald-700 flex items-center gap-2"><TrendingUp size={16} /> Lợi nhuận</div>
                    <div className="text-2xl font-black text-emerald-600 mt-2">{formatPrice(report.profit)}</div>
                    <div className="text-xs text-slate-500 mt-2">{report.fromDate} → {report.toDate} · {report.timezone}</div>
                </div>
            </div>
        </div>
    );
};
