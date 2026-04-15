import React, { useState } from 'react';
import { LogOut, Lock, CalendarOff, Settings, CreditCard, History } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import SubscriptionPaymentForm from '../components/SubscriptionPaymentForm';

const SubscriptionExpiredPage = () => {
    const { userProfile, signOut, isSubscriptionExpired, isManuallyLocked, subscriptionEndDate } = useAuth();
    const [showPaymentForm, setShowPaymentForm] = useState(false);
    
    // Format tanggal
    const formattedEndDate = subscriptionEndDate ? new Date(subscriptionEndDate).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }) : 'Tidak ditentukan';

    // Tentukan pesan utama
    let mainTitle = "Akses Aplikasi Dibatasi";
    let mainMessage = "Perusahaan Anda telah dibatasi. Silakan hubungi Super Admin untuk membuka akses.";
    let icon = <Lock className="h-10 w-10 text-red-600 mb-4" />;
    
    if (isSubscriptionExpired) {
        mainTitle = "Masa Langganan Telah Berakhir";
        mainMessage = `Langganan akun Anda telah berakhir pada tanggal ${formattedEndDate}. Untuk melanjutkan layanan, silakan lakukan perpanjangan.`;
        icon = <CalendarOff className="h-10 w-10 text-yellow-600 mb-4" />;
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4 pb-20">
            <Card className="w-full max-w-lg shadow-xl border-t-4 border-red-600">
                <CardHeader className="text-center">
                    {!showPaymentForm && icon}
                    <CardTitle className="text-2xl font-bold text-gray-800">
                        {showPaymentForm ? "Perpanjang Langganan" : mainTitle}
                    </CardTitle>
                    <CardDescription className="text-md text-gray-600 mt-2">
                        {showPaymentForm 
                            ? "Pilih paket dan unggah bukti transfer untuk mengaktifkan kembali akun Anda." 
                            : mainMessage}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {!showPaymentForm ? (
                        <>
                            <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                                <p className="text-sm font-medium text-red-700">Detail Akun:</p>
                                <ul className="text-sm text-gray-700 mt-1 space-y-1">
                                    <li><span className="font-semibold">Perusahaan:</span> {userProfile?.companies?.name || '-'}</li>
                                    <li><span className="font-semibold">Nama:</span> {userProfile?.full_name || 'Admin'}</li>
                                    <li><span className="font-semibold">Role:</span> {userProfile?.role}</li>
                                    {isSubscriptionExpired && <li><span className="font-semibold">Kedaluwarsa:</span> {formattedEndDate}</li>}
                                </ul>
                            </div>

                            <div className="flex flex-col space-y-2 pt-4">
                                <Button 
                                    onClick={() => setShowPaymentForm(true)} 
                                    className="w-full bg-[#011e4b] hover:bg-[#00376a] text-white flex items-center justify-center h-12"
                                >
                                    <CreditCard className="h-4 w-4 mr-2" /> Bayar Sekarang
                                </Button>
                                <Button 
                                    variant="outline"
                                    onClick={() => window.location.href = 'https://api.whatsapp.com/send?phone=6285111301943'} 
                                    className="w-full border-green-600 text-green-700 hover:bg-green-50 flex items-center justify-center"
                                >
                                    <Settings className="h-4 w-4 mr-2" /> Hubungi Super Admin
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    onClick={signOut}
                                    className="w-full text-gray-500 hover:bg-gray-100 flex items-center justify-center"
                                >
                                    <LogOut className="h-4 w-4 mr-2" /> Logout
                                </Button>
                            </div>
                        </>
                    ) : (
                        <div className="space-y-6">
                            <SubscriptionPaymentForm />
                            <Button 
                                variant="ghost" 
                                onClick={() => setShowPaymentForm(false)}
                                className="w-full text-gray-500"
                            >
                                Kembali
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default SubscriptionExpiredPage;
