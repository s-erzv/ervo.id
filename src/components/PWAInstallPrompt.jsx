import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PWAInstallPrompt = ({ onVisibilityChange }) => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setIsVisible(true);
            onVisibilityChange?.(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        if (isStandalone) {
            setIsVisible(false);
            onVisibilityChange?.(false);
        }

        const dismissed = sessionStorage.getItem('pwa_prompt_dismissed');
        if (dismissed) {
            setIsVisible(false);
            onVisibilityChange?.(false);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
        };
    }, [onVisibilityChange]);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        setDeferredPrompt(null);
        setIsVisible(false);
        onVisibilityChange?.(false);
    };

    const handleDismiss = () => {
        setIsVisible(false);
        onVisibilityChange?.(false);
        sessionStorage.setItem('pwa_prompt_dismissed', 'true');
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 transition-all duration-700 ease-in-out transform translate-y-0 opacity-100">
            <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-blue-50 flex flex-col items-center gap-3 max-w-[220px] text-center relative group hover:scale-105 transition-transform duration-300">
                <button
                    onClick={handleDismiss}
                    className="absolute -top-2 -right-2 bg-white text-gray-500 rounded-full p-1.5 shadow-md hover:bg-gray-50 transition-colors border border-gray-100"
                    aria-label="Tutup"
                >
                    <X className="h-3 w-3" />
                </button>

                <div className="relative">
                    <div className="bg-gradient-to-br from-[#011e4b] to-[#0336a0] p-3 rounded-2xl text-white shadow-lg shadow-blue-200 animate-pulse">
                        <Smartphone className="h-6 w-6" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1 border-2 border-white">
                        <Download className="h-2 w-2 text-white" />
                    </div>
                </div>

                <div>
                    <h4 className="text-sm font-bold text-gray-900 leading-tight">Install Ervo</h4>
                </div>

                <Button
                    onClick={handleInstallClick}
                    size="sm"
                    className="w-full bg-[#011e4b] hover:bg-[#022a6b] text-white text-xs font-semibold py-2 h-9 rounded-xl shadow-md transition-all active:scale-95"
                >
                    Tambah ke Utama
                </Button>
            </div>
        </div>
    );
};

export default PWAInstallPrompt;
