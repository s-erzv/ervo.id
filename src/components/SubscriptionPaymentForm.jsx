import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'react-hot-toast';
import { Loader2, CheckCircle2, CreditCard, MessageSquare, Zap, Send, ExternalLink, Clock } from 'lucide-react';

const SubscriptionPaymentForm = ({ onSuccess }) => {
    const { companyId, userProfile } = useAuth();
    const [plans, setPlans] = useState([]);
    const [selectedPlanId, setSelectedPlanId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [fetchingPlans, setFetchingPlans] = useState(true);
    const [activeRequest, setActiveRequest] = useState(null);
    const [fetchingRequest, setFetchingRequest] = useState(true);

    useEffect(() => {
        fetchPlans();
        fetchActiveRequest();
    }, [companyId]);

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
            const currentPlanId = userProfile?.companies?.subscription_plan_id;
            if (currentPlanId && data.some(p => p.id === currentPlanId)) {
                setSelectedPlanId(currentPlanId);
            } else if (data?.length > 0) {
                setSelectedPlanId(data[0].id);
            }
        }
        setFetchingPlans(false);
    };

    const fetchActiveRequest = async () => {
        if (!companyId) return;
        setFetchingRequest(true);
        const { data, error } = await supabase
            .from('subscription_payments')
            .select('*, subscription_plans(name)')
            .eq('company_id', companyId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error fetching active request:', error);
        } else {
            setActiveRequest(data || null);
        }
        setFetchingRequest(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const selectedPlan = plans.find(p => p.id === selectedPlanId);
        
        if (!selectedPlanId) {
            toast.error('Silakan pilih paket langganan');
            return;
        }

        setLoading(true);
        try {
            const { error: paymentError } = await supabase
                .from('subscription_payments')
                .insert({
                    company_id: companyId,
                    plan_id: selectedPlanId,
                    amount: selectedPlan?.price || 0,
                    status: 'pending'
                });

            if (paymentError) throw paymentError;

            toast.success('Permintaan berhasil dikirim!');
            fetchActiveRequest();
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error('Error submitting subscription:', error);
            toast.error('Gagal mengirim permintaan: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (fetchingRequest || fetchingPlans) {
        return (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-[#015a97]" />
                <p className="text-slate-500 font-medium">Memuat informasi langganan...</p>
            </div>
        );
    }

    // Tampilan jika ada request PENDING
    if (activeRequest) {
        const hasPaymentLink = activeRequest.payment_proof_url && activeRequest.payment_proof_url.startsWith('http');
        
        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <Card className="border-blue-200 bg-blue-50/30 shadow-sm overflow-hidden rounded-2xl">
                    <CardHeader className="bg-white border-b border-blue-100 p-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <CardTitle className="text-lg font-bold text-[#011e4b]">Permintaan Sedang Diproses</CardTitle>
                                <CardDescription className="font-medium">Paket: {activeRequest.subscription_plans?.name}</CardDescription>
                            </div>
                            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 gap-1.5 px-3 py-1">
                                <Clock className="h-3.5 w-3.5" /> Menunggu Pembayaran
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        {hasPaymentLink ? (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center space-y-4 animate-in zoom-in-95">
                                <div className="h-14 w-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-xl font-bold text-emerald-900">Link Pembayaran Tersedia!</h4>
                                    <p className="text-sm text-emerald-700 font-medium">Admin telah mengirimkan link pembayaran resmi untuk tagihan Anda.</p>
                                </div>
                                <Button 
                                    className="w-full h-14 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-900/20 rounded-xl"
                                    onClick={() => window.open(activeRequest.payment_proof_url, '_blank')}
                                >
                                    Bayar Sekarang <ExternalLink className="ml-2 h-5 w-5" />
                                </Button>
                            </div>
                        ) : (
                            <div className="bg-white border border-blue-100 rounded-xl p-6 flex items-start gap-4">
                                <div className="h-12 w-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                                    <MessageSquare className="h-6 w-6 text-blue-600" />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="font-bold text-slate-800">Menunggu Link dari Admin</h4>
                                    <p className="text-sm text-slate-600 leading-relaxed">
                                        Permintaan Anda sudah masuk. Admin sedang menyiapkan link pembayaran. Link akan muncul di halaman ini segera setelah siap.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-center">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={fetchActiveRequest}
                                className="text-blue-600 hover:bg-blue-50 font-semibold"
                            >
                                <Loader2 className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Status
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const isSubmitDisabled = loading || !selectedPlanId;

    return (
        <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in">
            {/* Step 1: Plan Selection */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-[#011e4b] text-white flex items-center justify-center text-xs font-semibold">1</div>
                    <Label className="text-lg font-semibold text-slate-800">Pilih Paket Langganan</Label>
                </div>
                
                <RadioGroup 
                    value={selectedPlanId} 
                    onValueChange={setSelectedPlanId}
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
                                        {plan.is_custom_pricing ? 'Enterprise' : `Rp ${plan.price.toLocaleString('id-ID')}`}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
                                    <CreditCard className="h-4 w-4" />
                                    <span>
                                        {plan.billing_cycle_days 
                                            ? `${plan.billing_cycle_days} Hari Layanan` 
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
            </div>

            {/* Step 2: Confirmation Info */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-[#011e4b] text-white flex items-center justify-center text-xs font-semibold">2</div>
                    <Label className="text-lg font-semibold text-slate-800">Proses Pembayaran</Label>
                </div>
                
                <div className="p-6 bg-[#015a97]/5 rounded-xl border border-[#015a97]/20 space-y-4">
                    <div className="flex items-start gap-4">
                        <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center border border-[#015a97]/20 shrink-0">
                            <Zap className="h-5 w-5 text-[#015a97]" />
                        </div>
                        <div className="space-y-1">
                            <h4 className="font-semibold text-slate-800">Ajukan Perpanjangan</h4>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                Setelah Anda menekan tombol di bawah, Admin akan segera memproses permintaan Anda dan memberikan link pembayaran resmi langsung di aplikasi ini.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-4">
                        <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center border border-[#015a97]/20 shrink-0">
                            <CheckCircle2 className="h-5 w-5 text-[#015a97]" />
                        </div>
                        <div className="space-y-1">
                            <h4 className="font-semibold text-slate-800">Aktivasi Langsung</h4>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                Paket akan langsung diperpanjang secara otomatis setelah Anda menyelesaikan transaksi melalui link yang disediakan.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
                <Button 
                    type="submit" 
                    className="w-full bg-[#011e4b] text-white hover:bg-[#00376a] h-14 text-base font-semibold rounded-xl transition-all shadow-lg shadow-blue-900/10"
                    disabled={isSubmitDisabled}
                >
                    {loading ? (
                        <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Sedang Memproses...</>
                    ) : (
                        <><Send className="mr-2 h-5 w-5" /> Ajukan Perpanjangan Paket</>
                    )}
                </Button>
            </div>
        </form>
    );
};

// Internal Badge for consistency if not exported globally
const Badge = ({ children, variant = 'default', className = '' }) => {
    const variants = {
        default: 'bg-slate-100 text-slate-800',
        outline: 'border border-slate-200'
    };
    return (
        <span className={`inline-flex items-center rounded-full text-xs font-bold ${variants[variant]} ${className}`}>
            {children}
        </span>
    );
};

export default SubscriptionPaymentForm;
