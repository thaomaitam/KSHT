import React from 'react';
import { Lock } from 'lucide-react';

export const SecuritySettings: React.FC = () => {
    const handleLogout = () => {
        sessionStorage.removeItem('giaban_admin_auth');
        window.location.hash = '#/';
        window.location.reload();
    };

    const handleResetApp = () => {
        if (confirm('BẠN CÓ CHẮC CHẮN? Hành động này sẽ xóa sạch dữ liệu lưu trên trình duyệt này và đăng xuất.')) {
            localStorage.clear();
            sessionStorage.clear();
            window.location.hash = '#/';
            window.location.reload();
        }
    };

    return (
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
                <Lock size={20} className="text-primary-600" />
                <h2 className="font-semibold text-slate-800">Bảo mật & Quyền sở hữu</h2>
            </div>
            <div className="p-6">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                    <h3 className="text-amber-800 font-bold flex items-center gap-2 mb-2">
                        <Lock size={18} />
                        Lưu ý về mật khẩu Admin
                    </h3>
                    <p className="text-amber-700 text-sm leading-relaxed">
                        Mật khẩu Admin được thiết lập trực tiếp trên <strong>Cloudflare Worker</strong> (biến môi trường <code>TK_ADMIN</code> và <code>MK_ADMIN</code>).
                        Để thay đổi mật khẩu hoặc quyền sở hữu, bạn cần truy cập vào trang quản trị Cloudflare của mình.
                    </p>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border border-slate-100 rounded-xl bg-slate-50">
                        <div>
                            <h4 className="font-medium text-slate-800">Đăng xuất khỏi thiết bị này</h4>
                            <p className="text-xs text-slate-500">Xóa phiên làm việc hiện tại trên trình duyệt này.</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors"
                        >
                            Đăng xuất
                        </button>
                    </div>

                    <div className="flex items-center justify-between p-4 border border-red-100 rounded-xl bg-red-50/30">
                        <div>
                            <h4 className="font-medium text-red-800">Xóa toàn bộ dữ liệu máy này</h4>
                            <p className="text-xs text-red-500">Xóa sạch localStorage (Sản phẩm, Cài đặt, Token). Không ảnh hưởng đến Cloud.</p>
                        </div>
                        <button
                            onClick={handleResetApp}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                        >
                            Reset App
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
};
