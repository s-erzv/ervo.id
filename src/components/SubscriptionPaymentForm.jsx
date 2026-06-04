import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import { Loader2, Clock, ExternalLink, RefreshCw, Zap, ShieldCheck, Lock, Star } from 'lucide-react';

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
      : 'https://app.duitku.com/lib/js/duitku.js';
    s.onload = resolve;
    document.body.appendChild(s);
  });
}

export default function SubscriptionPaymentForm({ onSuccess }) {
  const { companyId, userProfile } = useAuth();
  const navigate = useNavigate();

  const [plans, setPlans]                     = useState([]);
  const [selectedPlanId, setSelectedPlanId]   = useState(null);
  const [selectedMonths, setSelectedMonths]   = useState(1);
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
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    setActiveRequest(data ?? null);
    setFetchingRequest(false);
  };

  const handlePay = async (e) => {
    e.preventDefault();
    if (!selectedPlanId) return toast.error('Pilih paket terlebih dahulu.');
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-duitku-payment', {
        body: { plan_id: selectedPlanId, company_id: companyId, months: selectedMonths },
      });
      if (error) throw new Error(error.message);
      if (!data?.reference) throw new Error('Tidak ada reference dari Duitku.');

      await loadDuitkuScript(data.is_sandbox ?? true);
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
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-[#011e4b]">Pembayaran Sedang Menunggu</p>
              <p className="text-sm text-slate-500 mt-0.5">
                Paket: <span className="font-semibold">{activeRequest.subscription_plans?.name}</span>
              </p>
            </div>
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 border shrink-0 gap-1">
              <Clock className="h-3 w-3" /> Pending
            </Badge>
          </div>
          {activeRequest.payment_url && (
            <Button
              className="w-full bg-[#011e4b] hover:bg-[#022a6b] rounded-xl h-11 font-bold gap-2"
              onClick={() => window.open(activeRequest.payment_url, '_blank')}
            >
              Lanjutkan · {fmt(activeRequest.amount)} <ExternalLink className="h-4 w-4" />
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchActiveRequest} className="flex-1 rounded-xl gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setActiveRequest(null)} className="text-slate-400 text-xs rounded-xl">
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
    <form onSubmit={handlePay} className="space-y-5 animate-in fade-in">

      {/* Pilih Paket */}
      <div className="space-y-2.5">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Paket Langganan</p>
        <RadioGroup value={selectedPlanId} onValueChange={setSelectedPlanId} className="space-y-2">
          {plans.map((p) => (
            <div key={p.id}>
              <RadioGroupItem value={p.id} id={`plan-${p.id}`} className="peer sr-only" />
              <Label
                htmlFor={`plan-${p.id}`}
                className="flex items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3.5 hover:border-[#011e4b]/30 peer-data-[state=checked]:border-[#011e4b] peer-data-[state=checked]:bg-[#011e4b]/[0.03] cursor-pointer transition-all"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800">{p.name}</p>
                  <p className="text-xs text-slate-400">
                    {p.billing_cycle_days ? `${p.billing_cycle_days} hari / bulan` : 'Durasi fleksibel'}
                  </p>
                </div>
                <p className="font-extrabold text-[#011e4b] text-base shrink-0">
                  {p.is_custom_pricing ? 'Custom' : fmt(p.price)}
                  {!p.is_custom_pricing && <span className="text-[11px] font-normal text-slate-400">/bln</span>}
                </p>
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Durasi */}
      <div className="space-y-2.5">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Durasi</p>
        <div className="grid grid-cols-4 gap-2">
          {MONTH_OPTIONS.map((opt) => {
            const optFinal = plan ? Math.round(plan.price * opt.value * (1 - opt.discount / 100)) : 0;
            const isSel    = selectedMonths === opt.value;
            return (
              <button
                key={opt.value} type="button"
                onClick={() => setSelectedMonths(opt.value)}
                className={`relative rounded-2xl border-2 py-3 px-1 text-center transition-all ${
                  isSel
                    ? 'border-[#011e4b] bg-[#011e4b] text-white shadow-lg shadow-[#011e4b]/20'
                    : 'border-slate-200 bg-white hover:border-[#011e4b]/40'
                }`}
              >
                {opt.discount > 0 && (
                  <span className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] font-black px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                    isSel ? 'bg-emerald-400 text-white' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    -{opt.discount}%
                  </span>
                )}
                <p className={`font-bold text-sm ${isSel ? 'text-white' : 'text-slate-700'}`}>{opt.label}</p>
                {plan && !plan.is_custom_pricing && (
                  <p className={`text-[10px] mt-0.5 ${isSel ? 'text-white/70' : 'text-slate-400'}`}>
                    {fmt(optFinal)}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Ringkasan */}
      {plan && !plan.is_custom_pricing && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 text-sm border-b border-slate-200">
            <span className="text-slate-500">{plan.name} × {selectedMonths} bulan</span>
            <span className="font-medium text-slate-700">{fmt(base)}</span>
          </div>
          {disc > 0 && (
            <div className="flex justify-between items-center px-4 py-3 text-sm bg-emerald-50 border-b border-slate-200">
              <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5" /> Diskon {disc}%
              </span>
              <span className="text-emerald-700 font-bold">−{fmt(base - total)}</span>
            </div>
          )}
          <div className="flex justify-between items-center px-4 py-4">
            <div>
              <p className="font-bold text-slate-800 text-sm">Total Bayar</p>
              <p className="text-xs text-slate-400">{totalDays} hari aktif</p>
            </div>
            <p className="text-2xl font-extrabold text-[#011e4b]">{fmt(total)}</p>
          </div>
        </div>
      )}

      {/* Trust */}
      <div className="flex items-center justify-center gap-5 py-1">
        {[
          { icon: Lock,        text: 'SSL Encrypted' },
          { icon: ShieldCheck, text: 'Duitku Verified' },
          { icon: Star,        text: 'Popup di halaman ini' },
        ].map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <p className="text-[11px] text-slate-500">{text}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <Button
        type="submit"
        disabled={loading || !selectedPlanId}
        className="w-full h-14 bg-[#011e4b] hover:bg-[#012d70] rounded-2xl text-base font-extrabold shadow-lg shadow-[#011e4b]/30 gap-2 transition-all hover:shadow-xl disabled:opacity-50"
      >
        {loading
          ? <><Loader2 className="h-5 w-5 animate-spin" /> Memproses...</>
          : <><Zap className="h-5 w-5" /> Bayar {plan && !plan.is_custom_pricing ? fmt(total) : 'Sekarang'}</>
        }
      </Button>

      <p className="text-center text-[11px] text-slate-400">
        Dengan melanjutkan, kamu menyetujui{' '}
        <a href="/terms" className="underline hover:text-slate-600">Syarat & Ketentuan</a> Ervo.
        Pembayaran diproses aman oleh <span className="font-semibold">Duitku</span>.
      </p>
    </form>
  );
}
