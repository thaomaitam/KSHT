import React from 'react';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';

interface NoticeBannerProps {
    kind?: 'warning' | 'error' | 'info' | 'stale';
    title?: string;
    message: string;
    onRetry?: () => void;
}

const STYLES = {
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-sky-50 border-sky-200 text-sky-900',
    stale: 'bg-slate-100 border-slate-200 text-slate-700',
};

export const NoticeBanner: React.FC<NoticeBannerProps> = ({ kind = 'warning', title, message, onRetry }) => {
    const Icon = kind === 'stale' || kind === 'error' ? (kind === 'stale' ? WifiOff : AlertTriangle) : AlertTriangle;
    return (
        <div className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-3 ${STYLES[kind]}`} role="status">
            <Icon size={18} className="mt-0.5 shrink-0" />
            <div className="flex-1">
                {title && <p className="font-semibold mb-0.5">{title}</p>}
                <p>{message}</p>
            </div>
            {onRetry && (
                <button
                    type="button"
                    onClick={onRetry}
                    className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/80 border border-current/20 font-medium"
                >
                    <RefreshCw size={14} />
                    Thử lại
                </button>
            )}
        </div>
    );
};
