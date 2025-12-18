import React from 'react';
import { Save, Download, Upload, Cloud, RefreshCw } from 'lucide-react';

interface BackupSettingsProps {
    handleBackup: () => Promise<void>;
    handleFileImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
    handleSyncToCloud: () => Promise<void>;
    handlePullFromCloud: () => Promise<void>;
    isSyncing: boolean;
    isPulling: boolean;
    fileInputRef: React.RefObject<HTMLInputElement>;
}

export const BackupSettings: React.FC<BackupSettingsProps> = ({
    handleBackup, handleFileImport, handleSyncToCloud, handlePullFromCloud,
    isSyncing, isPulling, fileInputRef
}) => {
    return (
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
                <Save size={20} className="text-primary-600" />
                <h2 className="font-semibold text-slate-800">Sao Lưu Và Khôi Phục</h2>
            </div>
            <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Local Backup */}
                    <div>
                        <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Dữ liệu Offline (File)</h3>
                        <p className="text-sm text-slate-500 mb-4">
                            Sao lưu toàn bộ dữ liệu ra file JSON để lưu trữ an toàn trên máy tính.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleBackup}
                                className="flex items-center justify-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors"
                            >
                                <Download size={18} />
                                <span>Tải file sao lưu (.json)</span>
                            </button>

                            <div className="relative">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".json"
                                    onChange={handleFileImport}
                                    className="hidden"
                                    id="restore-file"
                                />
                                <label
                                    htmlFor="restore-file"
                                    className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors cursor-pointer border border-slate-200"
                                >
                                    <Upload size={18} />
                                    <span>Khôi phục từ file...</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Cloud Sync */}
                    <div className="border-t md:border-t-0 md:border-l border-slate-100 pt-8 md:pt-0 md:pl-8">
                        <h3 className="text-sm font-bold text-slate-400 uppercase mb-4">Đồng bộ Cloud (Online)</h3>
                        <p className="text-sm text-slate-500 mb-4">
                            Đồng bộ dữ liệu giữa các thiết bị thông qua Cloudflare Backend.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleSyncToCloud}
                                disabled={isSyncing}
                                className="flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
                            >
                                <Cloud size={18} className={isSyncing ? 'animate-bounce' : ''} />
                                <span>{isSyncing ? 'Đang đồng bộ...' : 'Đẩy dữ liệu lên Cloud'}</span>
                            </button>

                            <button
                                onClick={handlePullFromCloud}
                                disabled={isPulling}
                                className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                            >
                                <RefreshCw size={18} className={isPulling ? 'animate-spin' : ''} />
                                <span>{isPulling ? 'Đang tải...' : 'Tải dữ liệu từ Cloud về'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
