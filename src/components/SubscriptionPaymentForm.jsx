import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import { Loader2, Clock, ExternalLink, RefreshCw, Zap, ShieldCheck, Lock, Star, Ticket } from 'lucide-react';

const fmt = (n) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

const MONTH_OPTIONS = [
  { value: 1,  label: '1 Bln',  discount: 0 },
  { value: 3,  label: '3 Bln',  discount: 5 },
  { value: 6,  label: '6 Bln',  discount: 10 },
  { value: 12, label: '12 Bln', discount: 15 },
];

function loadDuitkuScript(isSandbox) {
  return new Promise((resolve) => {
    if (window.checkout) { resolve(); return; }
    const id = 'duitku-pop-js';
    if (document.getElementById(id)) {
      document.getElementById(id).addEventListener('load', resolve); return;
    }
    const s = document.createElement('script');
    s.id = id;
    s.src = isSandbox
      ? 'https://app-sandbox.duitku.com/lib/js/duitku.js'
      : 'https://app-prod.duitku.com/lib/js/duitku.js';
    s.onload = resolve;
    document.body.appendChild(s);
  });
}

export default function SubscriptionPaymentForm({ onSuccess }) {
  const { companyId, userProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [plans, setPlans]                     = useState([]);
  const [selectedPlanId, setSelectedPlanId]   = useState(null);
  const [selectedMonths, setSelectedMonths]   = useState(1);
  const [customAmount, setCustomAmount]       = useState('');
  const [promoCode, setPromoCode]             = useState('');
  const [promoLoading, setPromoLoading]       = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [fetchingPlans, setFetchingPlans]     = useState(true);
  const [activeRequest, setActiveRequest]     = useState(null);
  const [fetchingRequest, setFetchingRequest] = useState(true);

  useEffect(() => { fetchPlans(); fetchActiveRequest(); }, [companyId]);

  const fetchPlans = async () => {
    setFetchingPlans(true);
    const { data } = await supabase
      .from('subscription_plans').select('*').eq('is_active', true).order('price');
    setPlans(data || []);
    const cur = userProfile?.companies?.subscription_plan_id;
    if (cur && data?.some(p => p.id === cur)) setSelectedPlanId(cur);
    else if (data?.length) setSelectedPlanId(data[0].id);
    setFetchingPlans(false);
  };

  const fetchActiveRequest = async () => {
    if (!companyId) return;
    setFetchingRequest(true);
    const { data } = await supabase
      .from('subscription_payments')
      .select('*, subscription_plans(name)')
      .eq('company_id', companyId).eq('status', 'pending')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    setActiveRequest(data ?? null);
    setFetchingRequest(false);
  };

  const handleClaimPromo = async () => {
    if (!promoCode.trim()) return toast.error('Masukkan kode promo terlebih dahulu.');
    setPromoLoading(true);
    try {
      const { data, error } = await supabase.rpc('claim_promo_code', {
        p_code: promoCode.trim().toUpperCase(),
        p_company_id: companyId
      });
      if (error) throw new Error(error.message);
      
      if (data && data.success) {
        toast.success(data.message);
        setPromoCode('');
        await refreshProfile();
        if (onSuccess) onSuccess();
      } else {
        toast.error(data?.message || 'Kode promo tidak valid.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Gagal klaim promo: ' + err.message);
    } finally {
      setPromoLoading(false);
    }
  };

  const handlePay = async (e) => {
    e.preventDefault();
    if (!selectedPlanId) return toast.error('Pilih paket terlebih dahulu.');
    setLoading(true);
    try {
      const plan = plans.find(p => p.id === selectedPlanId);
      let payloadCustomAmount = undefined;
      
      if (plan?.is_custom_pricing) {
        payloadCustomAmount = parseInt(String(customAmount).replace(/\D/g, ''), 10);
        if (!payloadCustomAmount || payloadCustomAmount < 1) {
          return toast.error('Masukkan nominal pembayaran yang valid.');
        }
      }

      const { data, error } = await supabase.functions.invoke('create-duitku-payment', {
        body: { 
          plan_id: selectedPlanId, 
          company_id: companyId, 
          months: selectedMonths,
          custom_amount: payloadCustomAmount
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.reference) throw new Error('Tidak ada reference dari Duitku.');

      const isProductionEnv = import.meta.env.VITE_DUITKU_IS_PRODUCTION === 'true';
      const isSandbox = isProductionEnv ? false : (data.is_sandbox ?? true);
      
      await loadDuitkuScript(isSandbox);
      if (!window.checkout) throw new Error('Duitku checkout SDK tidak tersedia.');

      await fetchActiveRequest();

      window.checkout.process(data.reference, {
        successEvent: () => navigate(`/payment/result?merchantOrderId=${data.order_id}&resultCode=00&reference=${data.reference}`),
        pendingEvent: () => navigate(`/payment/result?merchantOrderId=${data.order_id}&resultCode=01&reference=${data.reference}`),
        errorEvent:   () => navigate(`/payment/result?merchantOrderId=${data.order_id}&resultCode=02&reference=${data.reference}`),
        closeEvent:   () => { toast('Pembayaran ditutup.'); fetchActiveRequest(); },
      });

      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      toast.error('Gagal: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const resumePayment = async () => {
    if (!activeRequest?.duitku_reference) return toast.error('Referensi pembayaran tidak ditemukan.');
    setLoading(true);
    try {
      const isProductionEnv = import.meta.env.VITE_DUITKU_IS_PRODUCTION === 'true';
      const isSandbox = !isProductionEnv;
      
      await loadDuitkuScript(isSandbox);
      if (!window.checkout) throw new Error('Duitku checkout SDK tidak tersedia.');

      window.checkout.process(activeRequest.duitku_reference, {
        successEvent: () => navigate(`/payment/result?merchantOrderId=${activeRequest.duitku_order_id}&resultCode=00&reference=${activeRequest.duitku_reference}`),
        pendingEvent: () => navigate(`/payment/result?merchantOrderId=${activeRequest.duitku_order_id}&resultCode=01&reference=${activeRequest.duitku_reference}`),
        errorEvent:   () => navigate(`/payment/result?merchantOrderId=${activeRequest.duitku_order_id}&resultCode=02&reference=${activeRequest.duitku_reference}`),
        closeEvent:   () => { toast('Pembayaran ditutup.'); fetchActiveRequest(); },
      });
    } catch (err) {
      console.error(err);
      toast.error('Gagal memuat pembayaran: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetchingRequest || fetchingPlans) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#011e4b]" />
        <p className="text-slate-500 text-sm">Memuat informasi langganan...</p>
      </div>
    );
  }

  if (activeRequest) {
    return (
      <div className="space-y-4 animate-in fade-in">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 space-y-5 text-center">
          <div className="mx-auto bg-amber-100 w-12 h-12 rounded-full flex items-center justify-center">
            <Clock className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-amber-900">Pembayaran Menunggu</h3>
            <p className="text-sm text-amber-700 mt-1">
              Selesaikan pembayaran untuk mengaktifkan paket <span className="font-bold">{activeRequest.subscription_plans?.name}</span>.
            </p>
          </div>
          {activeRequest.payment_url && (
            <Button
              type="button"
              disabled={loading}
              className="w-full bg-[#011e4b] hover:bg-[#022a6b] rounded-xl h-12 font-bold gap-2"
              onClick={resumePayment}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Lanjutkan · {fmt(activeRequest.amount)}
            </Button>
          )}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={fetchActiveRequest} className="flex-1 rounded-xl h-10 gap-2 border-amber-200 text-amber-700 hover:bg-amber-100">
              <RefreshCw className="h-4 w-4" /> Cek Status
            </Button>
            <Button type="button" variant="ghost" onClick={() => setActiveRequest(null)} className="flex-1 rounded-xl h-10 text-amber-600 hover:bg-amber-100/50 hover:text-amber-700">
              Buat Baru
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const plan      = plans.find(p => p.id === selectedPlanId);
  const disc      = MONTH_OPTIONS.find(m => m.value === selectedMonths)?.discount ?? 0;
  const base      = plan ? Math.round(plan.price * selectedMonths) : 0;
  const total     = Math.round(base * (1 - disc / 100));
  const totalDays = (plan?.billing_cycle_days ?? 30) * selectedMonths;

  return (
    <form onSubmit={handlePay} className="space-y-6 animate-in fade-in">
      
      {/* Pilih Paket */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">1. Paket Langganan</p>
        <RadioGroup value={selectedPlanId} onValueChange={setSelectedPlanId} className="space-y-3">
          {plans.map((p) => (
            <div key={p.id}>
              <RadioGroupItem value={p.id} id={`plan-${p.id}`} className="peer sr-only" />
              <Label
                htmlFor={`plan-${p.id}`}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 cursor-pointer transition-all hover:border-[#011e4b]/50 peer-data-[state=checked]:border-[#011e4b] peer-data-[state=checked]:bg-[#011e4b]/5"
              >
                <div>
                  <p className="font-bold text-slate-900">{p.name}</p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {p.billing_cycle_days ? `${p.billing_cycle_days} hari / siklus` : 'Durasi fleksibel'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-[#011e4b] text-lg">
                    {p.is_custom_pricing ? 'Custom' : fmt(p.price)}
                  </p>
                  {!p.is_custom_pricing && <p className="text-xs text-slate-500">/ bulan</p>}
                </div>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Durasi */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">2. Durasi</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {MONTH_OPTIONS.map((opt) => {
            const isSel = selectedMonths === opt.value;
            return (
              <button
                key={opt.value} type="button"
                onClick={() => setSelectedMonths(opt.value)}
                className={`relative rounded-xl border p-3 text-center transition-all ${
                  isSel
                    ? 'border-[#011e4b] bg-[#011e4b] text-white shadow-md'
                    : 'border-slate-200 bg-white hover:border-[#011e4b]/30 hover:bg-slate-50'
                }`}
              >
                {opt.discount > 0 && (
                  <span className={`absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isSel ? 'bg-emerald-400 text-white' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    -{opt.discount}%
                  </span>
                )}
                <p className={`font-semibold text-sm ${isSel ? 'text-white' : 'text-slate-700'}`}>{opt.label}</p>
              </button>
            );
          })}
        </div>
      </div>

      {plan && plan.is_custom_pricing && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Nominal Kesepakatan</p>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-slate-500">Rp</span>
            <input
              type="text"
              placeholder="0"
              value={customAmount}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setCustomAmount(val ? new Intl.NumberFormat('id-ID').format(val) : '');
              }}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 font-semibold text-slate-900 outline-none focus:border-[#011e4b] transition-all"
            />
          </div>
        </div>
      )}

      {/* Ringkasan & Promo */}
      {plan && !plan.is_custom_pricing && (
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-600">Total Harga ({selectedMonths} bulan)</span>
              <span className="font-medium text-slate-800">{fmt(base)}</span>
            </div>
            
            {disc > 0 && (
              <div className="flex justify-between items-center text-sm text-emerald-600">
                <span className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5" /> Diskon {disc}%
                </span>
                <span className="font-medium">−{fmt(base - total)}</span>
              </div>
            )}
            
            <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
              <span className="font-semibold text-slate-900">Total Tagihan</span>
              <span className="text-xl font-bold text-[#011e4b]">{fmt(total)}</span>
            </div>
          </div>

          {/* Promo Code */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Ticket className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="Kode Promo (Opsional)"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium outline-none focus:border-[#011e4b] uppercase placeholder:normal-case"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={handleClaimPromo}
              disabled={promoLoading || !promoCode.trim()}
              className="px-6 rounded-xl font-semibold"
            >
              {promoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Klaim'}
            </Button>
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="pt-4">
        <Button
          type="submit"
          disabled={loading || !selectedPlanId}
          className="w-full h-12 bg-[#011e4b] hover:bg-[#022a6b] rounded-xl text-base font-bold shadow-md gap-2"
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-4 w-4" />}
          Lanjut Pembayaran
        </Button>
        
        {/* Trust */}
        <div className="flex items-center justify-center gap-4 py-4 text-xs font-medium text-slate-500">
          <div className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-emerald-500" /> SSL Encrypted</div>
          <div className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Duitku Verified</div>
        </div>
      </div>
    </form>
  );
}
