import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { toast } from 'react-hot-toast';
import { Loader2, Upload, CheckCircle2, AlertCircle, Landmark, CreditCard, Receipt } from 'lucide-react';
import { compressAndUpload } from '../lib/UploadUtils';

const SubscriptionPaymentForm = ({ onSuccess }) => {
    const { companyId } = useAuth();
    const [plans, setPlans] = useState([]);
    const [selectedPlanId, setSelectedPlanId] = useState(null);
    const [customAmount, setCustomAmount] = useState(''); // State baru untuk nominal custom
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [fetchingPlans, setFetchingPlans] = useState(true);
    const [isSubmitted, setIsSubmitted] = useState(false);

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        setFetchingPlans(true);
        const { data, error } = await supabase
            .from('subscription_plans')
            .select('*')
            .eq('is_active', true)
            .order('price', { ascending: true });

        if (error) {
            console.error('Error fetching plans:', error);
        } else {
            setPlans(data || []);
            if (data?.length > 0) setSelectedPlanId(data[0].id);
        }
        setFetchingPlans(false);
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const selectedPlan = plans.find(p => p.id === selectedPlanId);
        
        // Finalisasi nominal yang akan dibayar
        const finalAmount = selectedPlan?.is_custom_pricing 
            ? parseInt(customAmount) 
            : selectedPlan?.price;

        if (!selectedPlanId || !file) {
            toast.error('Pilih paket dan unggah bukti pembayaran');
            return;
        }

        if (!finalAmount || finalAmount <= 0) {
            toast.error('Nominal pembayaran tidak valid');
            return;
        }

        setLoading(true);
        try {
            // 1. Upload proof
            const proofUrl = await compressAndUpload(file, `subscriptions/${companyId}`);
            
            if (!proofUrl) throw new Error('Gagal mengunggah bukti pembayaran');

            // 2. Create payment record
            const { error: paymentError } = await supabase
                .from('subscription_payments')
                .insert({
                    company_id: companyId,
                    plan_id: selectedPlanId,
                    amount: finalAmount, // Menggunakan nominal final
                    payment_proof_url: proofUrl,
                    status: 'pending'
                });

            if (paymentError) throw paymentError;

            setIsSubmitted(true);
            toast.success('Bukti pembayaran berhasil dikirim! Menunggu verifikasi admin.');
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error('Error submitting subscription:', error);
            toast.error('Gagal mengirim bukti pembayaran: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (isSubmitted) {
        return (
            <Card className="border border-emerald-200 bg-emerald-50/50 shadow-sm rounded-2xl animate-in fade-in zoom-in-95">
                <CardContent className="pt-8 pb-8 text-center space-y-5">
                    <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-xl font-semibold text-emerald-900">Pembayaran Terkirim</h3>
                        <p className="text-sm font-medium text-emerald-700 max-w-sm mx-auto">
                            Terima kasih! Bukti pembayaran Anda telah kami terima. 
                            Tim Ervo akan melakukan verifikasi dalam waktu maksimal 1x24 jam.
                        </p>
                    </div>
                    <Button 
                        variant="outline" 
                        onClick={() => {
                            setIsSubmitted(false);
                            setFile(null);
                            setCustomAmount('');
                        }}
                        className="mt-2 font-medium text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                    >
                        Kirim Ulang Dokumen
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const selectedPlan = plans.find(p => p.id === selectedPlanId);
    
    // Safety guard untuk tombol submit
    const isSubmitDisabled = loading || !selectedPlanId || !file || 
        (selectedPlan?.is_custom_pricing && (!customAmount || parseInt(customAmount) <= 0));

    return (
        <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in">
            {/* Step 1: Plan Selection */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-[#011e4b] text-white flex items-center justify-center text-xs font-semibold">1</div>
                    <Label className="text-lg font-semibold text-slate-800">Pilih Paket Langganan</Label>
                </div>
                
                {fetchingPlans ? (
                    <div className="flex justify-center p-8 border border-slate-100 rounded-xl bg-slate-50"><Loader2 className="animate-spin text-slate-400" /></div>
                ) : (
                    <RadioGroup 
                        value={selectedPlanId} 
                        onValueChange={(val) => {
                            setSelectedPlanId(val);
                            setCustomAmount(''); // Reset input custom jika ganti paket
                        }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                        {plans.map((plan) => (
                            <div key={plan.id} className="relative">
                                <RadioGroupItem
                                    value={plan.id}
                                    id={plan.id}
                                    className="peer sr-only"
                                />
                                <Label
                                    htmlFor={plan.id}
                                    className="flex flex-col items-start justify-between rounded-xl border-2 border-slate-200 bg-white p-5 hover:bg-slate-50 hover:border-[#015a97]/40 peer-data-[state=checked]:border-[#011e4b] peer-data-[state=checked]:bg-[#015a97]/5 cursor-pointer transition-all duration-200"
                                >
                                    <div className="flex justify-between w-full items-center mb-2">
                                        <span className="font-semibold text-lg text-slate-800">{plan.name}</span>
                                        <span className={`font-semibold ${plan.is_custom_pricing ? 'text-amber-600 text-sm' : 'text-[#011e4b] text-lg'}`}>
                                            {plan.is_custom_pricing ? 'Sesuai Kesepakatan' : `Rp ${plan.price.toLocaleString('id-ID')}`}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
                                        <CreditCard className="h-4 w-4" />
                                        <span>
                                            {plan.billing_cycle_days 
                                                ? `Siklus Tagihan: ${plan.billing_cycle_days} Hari` 
                                                : 'Siklus Fleksibel'}
                                        </span>
                                    </div>
                                    
                                    <div className="absolute top-4 right-4 h-5 w-5 rounded-full border-2 border-slate-300 peer-data-[state=checked]:border-[#011e4b] peer-data-[state=checked]:bg-[#011e4b] flex items-center justify-center">
                                        <div className="h-2 w-2 rounded-full bg-white opacity-0 peer-data-[state=checked]:opacity-100" />
                                    </div>
                                </Label>
                            </div>
                        ))}
                    </RadioGroup>
                )}
            </div>

            {/* Step 2: Payment Info */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-[#011e4b] text-white flex items-center justify-center text-xs font-semibold">2</div>
                    <Label className="text-lg font-semibold text-slate-800">Informasi Pembayaran</Label>
                </div>
                
                <div className="p-5 bg-slate-50 rounded-xl border border-slate-200/60 space-y-4">
                    
                    {/* Logika Form Input Nominal Custom vs Tagihan Tetap */}
                    {selectedPlan?.is_custom_pricing ? (
                        <div className="space-y-3 mb-4 p-4 bg-white border border-amber-200 rounded-xl shadow-sm">
                            <Label className="text-sm font-semibold text-slate-800">Masukkan Nominal Sesuai Kesepakatan</Label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="text-slate-500 font-medium">Rp</span>
                                </div>
                                <Input 
                                    type="number"
                                    min="0"
                                    value={customAmount}
                                    onChange={(e) => setCustomAmount(e.target.value)}
                                    className="pl-10 h-11 border-slate-300 focus-visible:ring-amber-500 text-lg font-semibold"
                                    placeholder="Contoh: 5000000"
                                />
                            </div>
                            <p className="text-xs font-medium text-slate-500">
                                Silakan hubungi Tim Ervo jika Anda belum mengetahui nominal tagihan paket Enterprise Anda.
                            </p>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm mb-4">
                            <span className="font-medium text-slate-600">Total Tagihan:</span>
                            <span className="text-xl font-semibold text-[#011e4b]">
                                Rp {selectedPlan?.price?.toLocaleString('id-ID') || 0}
                            </span>
                        </div>
                    )}

                    <p className="font-medium text-slate-600 text-sm">Silakan transfer ke rekening tujuan berikut:</p>
                    
                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center gap-4">
                        <div className="h-12 w-12 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Landmark className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Bank BCA</p>
                            <p className="font-semibold text-xl tracking-wider text-slate-800">8831 234 567</p>
                            <p className="text-sm font-medium text-slate-600">a.n. PT Ervo Teknologi Indonesia</p>
                        </div>
                    </div>
                    
                    <div className="flex items-start gap-2.5 text-xs font-medium text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-100">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <p leading-relaxed>Pastikan nominal transfer sesuai dengan harga paket yang dipilih agar proses aktivasi otomatis dapat berjalan lancar.</p>
                    </div>
                </div>
            </div>

            {/* Step 3: Upload Proof */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-[#011e4b] text-white flex items-center justify-center text-xs font-semibold">3</div>
                    <Label className="text-lg font-semibold text-slate-800">Unggah Bukti Transfer</Label>
                </div>
                
                <div className="grid w-full items-center gap-2">
                    <div className="relative">
                        <Input 
                            id="proof" 
                            type="file" 
                            accept="image/*" 
                            onChange={handleFileChange}
                            className="cursor-pointer h-12 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-slate-50 file:text-[#011e4b] hover:file:bg-slate-100"
                        />
                    </div>
                    <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mt-1">
                        <Receipt className="h-3.5 w-3.5" /> Format file: JPG, PNG, WEBP (Maksimal 5MB)
                    </p>
                </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
                <Button 
                    type="submit" 
                    className="w-full bg-[#011e4b] text-white hover:bg-[#00376a] h-14 text-base font-semibold rounded-xl transition-all"
                    disabled={isSubmitDisabled}
                >
                    {loading ? (
                        <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Sedang Mengirim...</>
                    ) : (
                        <><Upload className="mr-2 h-5 w-5" /> Konfirmasi Pembayaran</>
                    )}
                </Button>
            </div>
        </form>
    );
};

export default SubscriptionPaymentForm;