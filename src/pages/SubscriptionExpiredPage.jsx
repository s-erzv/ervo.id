import React from 'react';
import { LogOut, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import SubscriptionPaymentForm from '../components/SubscriptionPaymentForm';

const SubscriptionExpiredPage = () => {
    const { userProfile, signOut, isSubscriptionExpired, isManuallyLocked, subscriptionEndDate } = useAuth();
    
    const formattedEndDate = subscriptionEndDate ? new Date(subscriptionEndDate).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }) : null;

    let mainTitle = "Berlangganan ERVO";
    let mainMessage = "Pilih paket yang sesuai untuk mulai menggunakan layanan ERVO.";
    
    if (isManuallyLocked) {
        mainTitle = "Akses Aplikasi Dibatasi";
        mainMessage = "Perusahaan Anda telah dibatasi. Silakan hubungi Super Admin untuk membuka akses.";
    } else if (isSubscriptionExpired) {
        mainTitle = "Masa Langganan Telah Berakhir";
        mainMessage = `Langganan Anda telah berakhir pada ${formattedEndDate}. Silakan perpanjang untuk melanjutkan.`;
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 sm:px-6">
            <div className="w-full max-w-[600px] mb-8 text-center space-y-4">
                <div className="inline-flex items-center justify-center p-4 bg-white rounded-[2rem] shadow-sm border border-slate-100 mb-2">
                    <img src="/logo.png" alt="ERVO" className="h-16 w-auto object-contain" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">ERVO Business</h1>
            </div>

            <Card className={`w-full max-w-[600px] shadow-lg border-t-4 ${isManuallyLocked ? 'border-red-600' : 'border-[#011e4b]'}`}>
                <CardHeader className="text-center pb-4 border-b border-slate-50">
                    <CardTitle className="text-xl font-bold text-slate-800">
                        {mainTitle}
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-500 mt-2">
                        {mainMessage}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-6 px-4">
                    {isManuallyLocked ? (
                        <div className="space-y-4 text-center">
                            <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                                <Settings className="h-8 w-8 text-red-500 mx-auto mb-3" />
                                <p className="text-sm text-red-700">Akses perusahaan <span className="font-bold">{userProfile?.companies?.name || '-'}</span> saat ini ditangguhkan.</p>
                            </div>
                            <Button 
                                variant="outline"
                                onClick={() => window.location.href = 'https://api.whatsapp.com/send?phone=6287762407811'} 
                                className="w-full border-slate-200 text-slate-700 hover:bg-slate-50 h-12 rounded-xl"
                            >
                                Hubungi Super Admin
                            </Button>
                        </div>
                    ) : (
                        <SubscriptionPaymentForm />
                    )}

                    <div className="pt-6 mt-6 border-t border-slate-100">
                        <Button 
                            variant="ghost" 
                            onClick={signOut}
                            className="w-full text-slate-500 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center rounded-xl h-12"
                        >
                            <LogOut className="h-4 w-4 mr-2" /> Keluar atau Ganti Akun
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default SubscriptionExpiredPage;
