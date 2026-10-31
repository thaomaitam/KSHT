import React from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Tags, X, ChevronRight } from 'lucide-react';
import { CategoryGroup, displayCategoryLabel } from '../utils/categoryGroups';
import { CategoryItem } from '../settingsService';

type Groups = CategoryGroup<CategoryItem>[];

interface NavProps {
    groups: Groups;
    activeCategory: string;
    onSelect: (value: string) => void;
    totalCount: number;
}

const rowClass = (active: boolean) => `w-full min-h-[44px] flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left text-[15px] md:text-base transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 ${active
    ? 'bg-primary-600 text-white font-bold'
    : 'text-slate-700 dark:text-slate-200 hover:bg-primary-50 dark:hover:bg-slate-700'}`;

const CategoryList: React.FC<NavProps> = ({ groups, activeCategory, onSelect, totalCount }) => (
    <nav aria-label="Danh mục sản phẩm">
        <button type="button" onClick={() => onSelect('ALL')} aria-current={activeCategory === 'ALL' ? 'page' : undefined} className={`${rowClass(activeCategory === 'ALL')} font-bold`}>
            <span>Tất cả sản phẩm</span><span className={activeCategory === 'ALL' ? '' : 'text-slate-400'}>{totalCount}</span>
        </button>
        {groups.map(group => (
            <div key={group.name} className="mt-3">
                <div className="px-3 mb-1 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{group.name}</div>
                <ul>
                    {group.items.map(({ category, count }) => {
                        const active = category.value === activeCategory;
                        return (
                            <li key={category.value}>
                                <button type="button" onClick={() => onSelect(category.value)} aria-current={active ? 'page' : undefined} className={rowClass(active)}>
                                    <span>{displayCategoryLabel(category.label)}</span>
                                    <span className={active ? '' : 'text-slate-400'}>{count}</span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>
        ))}
    </nav>
);

/** Desktop: sticky grouped sidebar. */
export const CategorySidebar: React.FC<NavProps> = (props) => (
    <aside className="hidden md:block w-64 lg:w-72 flex-none">
        <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-2">
            <div className="px-3 py-2 text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100"><Tags size={18} /> Danh mục</div>
            <CategoryList {...props} />
        </div>
    </aside>
);

/** Mobile: compact header button (tag + current category + ▾) opening a bottom sheet with the grouped list. */
export const CategorySheetButton: React.FC<NavProps & { activeLabel: string; className?: string }> = ({ activeLabel, onSelect, className, ...props }) => {
    const [open, setOpen] = React.useState(false);
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const closeRef = React.useRef<HTMLButtonElement>(null);

    const close = React.useCallback(() => {
        setOpen(false);
        triggerRef.current?.focus();
    }, []);

    React.useEffect(() => {
        if (!open) return;
        closeRef.current?.focus();
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = prev;
            document.removeEventListener('keydown', onKey);
        };
    }, [open, close]);

    return (
        <div className={className}>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label={`Danh mục: ${activeLabel}. Bấm để đổi danh mục`}
                className="w-full min-h-[44px] flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-primary-600 bg-white dark:bg-slate-800 text-[15px] font-bold text-slate-800 dark:text-slate-100"
            >
                <Tags size={18} className="flex-none text-primary-600 dark:text-primary-400" aria-hidden />
                <span className="flex-1 min-w-0 truncate text-left text-primary-700 dark:text-primary-400">{activeLabel}</span>
                <ChevronDown size={18} className="flex-none text-primary-700 dark:text-primary-400" aria-hidden />
            </button>
            {/* Portal: the sticky header uses backdrop-filter, which would otherwise trap position:fixed */}
            {open && createPortal((
                <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={close}>
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Chọn danh mục"
                        className="w-full max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white dark:bg-slate-900 p-3 pb-6 shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-2 py-2 sticky top-0 bg-white dark:bg-slate-900">
                            <span className="text-lg font-bold text-slate-800 dark:text-slate-100">Chọn danh mục</span>
                            <button ref={closeRef} type="button" onClick={close} className="min-h-[44px] flex items-center gap-1 px-3 rounded-xl border border-slate-300 dark:border-slate-600 text-base text-slate-700 dark:text-slate-200">
                                <X size={18} /> Đóng
                            </button>
                        </div>
                        <CategoryList {...props} onSelect={v => { onSelect(v); close(); }} />
                    </div>
                </div>
            ), document.body)}
        </div>
    );
};

export const Breadcrumb: React.FC<{ label: string; onHome: () => void }> = ({ label, onHome }) => (
    <nav aria-label="Đường dẫn" className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
        <button type="button" onClick={onHome} className="hover:underline hover:text-primary-600">Trang chủ</button>
        <ChevronRight size={14} aria-hidden />
        <span aria-current="page" className="text-slate-700 dark:text-slate-200">{label}</span>
    </nav>
);
