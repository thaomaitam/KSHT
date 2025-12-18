import React from 'react';
import { ShoppingBag } from 'lucide-react';

export const Footer: React.FC = () => {
    return (
        <footer className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 mt-auto">
            <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col lg:flex-row gap-6 items-start">
                    {/* Company Info */}
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                            <ShoppingBag size={24} className="text-primary-600" />
                            <span className="text-xl font-bold text-slate-800 dark:text-slate-100">Kho Sỉ Huy Thảo</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 text-sm mb-2">
                            📍 119/16A Mễ Cốc, Phường 15, Quận 8, TP. Hồ Chí Minh 71800
                        </p>
                        <div className="text-slate-600 dark:text-slate-400 text-sm mb-3 space-y-1">
                            <p>📞 <a href="tel:0968844385" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">096.88.44.385</a> - Ms.Thảo</p>
                            <p>📞 <a href="tel:0964727949" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">0964.727.949</a> - Mr.Huy</p>
                        </div>
                        <p className="text-slate-500 dark:text-slate-500 text-xs">
                            © 2024 Giaban App. Chuyên cung cấp dụng cụ sơn chất lượng cao.
                        </p>
                    </div>
                    {/* Google Map */}
                    <div className="w-full lg:w-auto">
                        <iframe
                            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3920.168636043297!2d106.62734977457428!3d10.721473160205868!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31752b05aa037fab%3A0x19e09ad5c2bcaa2!2zS2hvIFPhu4kgSHV5IFRo4bqjbw!5e0!3m2!1svi!2s!4v1765289921148!5m2!1svi!2s"
                            width="300"
                            height="150"
                            style={{ border: 0, borderRadius: '12px' }}
                            allowFullScreen
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            className="shadow-md"
                            title="Kho Sỉ Huy Thảo Location"
                        />
                    </div>
                </div>
            </div>
        </footer>
    );
};
