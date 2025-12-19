import React, { useState } from 'react';
import { X, Lock, Eye, EyeOff } from 'lucide-react';
import { apiService } from '../apiService';

interface LoginModalProps {
    onSuccess: () => void;
    onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onSuccess, onClose }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [apiUrl, setApiUrl] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [needsApiUrl, setNeedsApiUrl] = useState(false);

    React.useEffect(() => {
        const currentUrl = apiService.getApiUrl();
        // If current URL is empty or default, we might want to show it?
        // Actually, if it's default, we don't need to ask. 
        // Only ask if it's somehow missing.
        if (!currentUrl) {
            setNeedsApiUrl(true);
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            // If we need API URL, temporarily set it to verify
            let urlToUse = apiService.getApiUrl();
            if (needsApiUrl) {
                // Basic validation
                if (!apiUrl.startsWith('http')) {
                    throw new Error('API URL phải bắt đầu bằng http:// hoặc https://');
                }
                urlToUse = apiUrl.replace(/\/$/, ''); // Remove trailing slash
                apiService.setApiCredentials(urlToUse, ''); // Temp save URL
            }

            // Login with backend
            const result = await apiService.login(username, password);

            if (result.success && result.secret) {
                // Store auth in localStorage (persists until logout)
                localStorage.setItem('giaban_admin_auth', 'true');
                // Save credentials permanently
                apiService.setApiCredentials(urlToUse, result.secret);
                onSuccess();
            } else {
                setError('Tài khoản hoặc mật khẩu không đúng');
            }
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi xác thực');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-primary-600 to-primary-500 px-6 py-8 text-center relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-white" />
                    </button>
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
                        <Lock size={32} className="text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-white">Đăng nhập Admin</h2>
                    <p className="text-white/80 text-sm mt-1">Vui lòng nhập thông tin đăng nhập</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm text-center">
                            {error}
                        </div>
                    )}

                    {needsApiUrl && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Cloudflare Worker URL</label>
                            <input
                                type="url"
                                required
                                value={apiUrl}
                                onChange={(e) => setApiUrl(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                placeholder="https://your-worker.workers.dev"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Nhập URL của Worker bạn đã deploy.
                            </p>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Tài khoản</label>
                        <input
                            type="text"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            placeholder="Nhập tài khoản..."
                            autoFocus={!needsApiUrl}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Mật khẩu</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 pr-12 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                placeholder="Nhập mật khẩu..."
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full px-4 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-6"
                    >
                        {isLoading ? 'Đang xác thực...' : 'Đăng nhập'}
                    </button>
                </form>
            </div>
        </div>
    );
};

// Auth check helper
export const isAdminAuthenticated = (): boolean => {
    return localStorage.getItem('giaban_admin_auth') === 'true';
};

export const logoutAdmin = (): void => {
    localStorage.removeItem('giaban_admin_auth');
};
