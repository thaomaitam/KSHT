import React from 'react';
import { Phone, Save } from 'lucide-react';
import { AppSettings } from '../../settingsService';

interface PhoneSettingsProps {
    settings: AppSettings;
    setSettings: (settings: AppSettings) => void;
    handleSavePhone: () => Promise<void>;
    saveSuccess: boolean;
}

export const PhoneSettings: React.FC<PhoneSettingsProps> = ({
    settings, setSettings, handleSavePhone, saveSuccess
}) => {
    return (
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
                <Phone size={20} className="text-primary-600" />
                <h2 className="font-semibold text-slate-800">Số điện thoại liên hệ</h2>
            </div>
            <div className="p-6">
                <p className="text-sm text-slate-500 mb-4">
                    Số điện thoại này sẽ hiển thị trong nút liên hệ và đơn hàng
                </p>
                <div className="flex gap-3">
                    <input
                        type="tel"
                        value={settings.phoneNumber}
                        onChange={(e) => setSettings({ ...settings, phoneNumber: e.target.value })}
                        className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Nhập số điện thoại (vd: 0901234567)"
                    />
                    <button
                        onClick={handleSavePhone}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${saveSuccess
                            ? 'bg-green-500 text-white'
                            : 'bg-primary-600 hover:bg-primary-700 text-white'
                            }`}
                    >
                        <Save size={18} />
                        <span>{saveSuccess ? 'Đã lưu!' : 'Lưu'}</span>
                    </button>
                </div>
            </div>
        </section>
    );
};
