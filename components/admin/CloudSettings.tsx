import React from 'react';
import { Cloud, RefreshCw } from 'lucide-react';

interface CloudSettingsProps {
    apiUrl: string;
    setApiUrl: (url: string) => void;
    handleSaveConnection: () => void;
    connectionSaveSuccess: boolean;
}

export const CloudSettings: React.FC<CloudSettingsProps> = ({
    apiUrl, setApiUrl, handleSaveConnection, connectionSaveSuccess
}) => {
    return (
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
                <Cloud size={20} className="text-primary-600" />
                <h2 className="font-semibold text-slate-800">Kết nối Cloudflare Backend</h2>
            </div>
            <div className="p-6">
                <p className="text-sm text-slate-500 mb-4">
                    Cấu hình kết nối đến Cloudflare Worker để đồng bộ dữ liệu
                </p>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">API URL (Worker URL)</label>
                        <input
                            type="url"
                            value={apiUrl}
                            onChange={(e) => setApiUrl(e.target.value)}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            placeholder="https://ksht-api.ngthanhhuy951.workers.dev"
                        />
                    </div>
                    <p className="text-xs text-slate-500">
                        Phiên API được tạo khi đăng nhập và chỉ lưu trong tab hiện tại; không cần nhập Admin Secret.
                    </p>
                    <div className="flex justify-end">
                        <button
                            onClick={handleSaveConnection}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${connectionSaveSuccess
                                ? 'bg-green-500 text-white'
                                : 'bg-primary-600 hover:bg-primary-700 text-white'
                                }`}
                        >
                            <RefreshCw size={18} />
                            <span>{connectionSaveSuccess ? 'Đã lưu!' : 'Lưu kết nối'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
};
