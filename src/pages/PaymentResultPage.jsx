import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle2, XCircle, Clock, Loader2, ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PaymentResultPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { companyId, refreshProfile } = useAuth();

  const [status, setStatus] = useState('checking'); // checking | success | pending | failed
  const [paymentDetail, setPaymentDetail] = useState(null);
  const [attempts, setAttempts] = useState(0);

  // Duitku return URL params: merchantOrderId, resultCode, reference
  const merchantOrderId = searchParams.get('merchantOrderId');
  const resultCode      = searchParams.get('resultCode');
  const reference       = searchParams.get('reference');

  useEffect(() => {
    checkPaymentStatus();
  }, []);

  const checkPaymentStatus = async () => {
    setStatus('checking');

    try {
      // Cek dari DB dulu berdasarkan duitku_order_id atau terbaru dari company
      let query = supabase
        .from('subscription_payments')
        .select('*, subscription_plans(name, billing_cycle_days)')
        .order('created_at', { ascending: false })
        .limit(1);

      if (merchantOrderId) {
        query = supabase
          .from('subscription_payments')
          .select('*, subscription_plans(name, billing_cycle_days)')
          .eq('duitku_order_id', merchantOrderId)
          .single();
      } else if (companyId) {
        query = query.eq('company_id', companyId).single();
      }

      const { data: payment } = await query;
      setPaymentDetail(payment);

      // Cek berdasarkan resultCode dari Duitku di URL
      if (resultCode === '00' || payment?.status === 'approved') {
        setStatus('success');
        // Refresh profile agar subscription_end_date terbaru
        await refreshProfile?.();
      } else if (resultCode === '02' || payment?.status === 'rejected') {
        setStatus('failed');
      } else {
        // Masih pending — bisa jadi callback belum diproses
        setStatus('pending');
      }
    } catch (err) {
      console.error('Error checking payment:', err);
      setStatus(resultCode === '00' ? 'success' : resultCode === '02' ? 'failed' : 'pending');
    }

    setAttempts(prev => prev + 1);
  };

  const handleContinue = async () => {
    await refreshProfile?.();
    navigate('/dashboard', { replace: true });
  };

  const STATES = {
    checking: {
      icon: <Loader2 className="h-16 w-16 text-blue-500 animate-spin" />,
      title: 'Memverifikasi Pembayaran...',
      desc: 'Sedang memeriksa status transaksi Anda.',
      color: 'from-blue-50 to-white',
      border: 'border-blue-200',
    },
    success: {
      icon: <CheckCircle2 className="h-16 w-16 text-emerald-500" />,
      title: 'Pembayaran Berhasil!',
      desc: 'Langganan Anda telah diperpanjang secara otomatis. Terima kasih telah menggunakan Ervo ERP.',
      color: 'from-emerald-50 to-white',
      border: 'border-emerald-200',
    },
    pending: {
      icon: <Clock className="h-16 w-16 text-amber-500" />,
      title: 'Pembayaran Sedang Diproses',
      desc: 'Transaksi Anda sedang diverifikasi. Langganan akan aktif otomatis dalam beberapa menit setelah konfirmasi.',
      color: 'from-amber-50 to-white',
      border: 'border-amber-200',
    },
    failed: {
      icon: <XCircle className="h-16 w-16 text-red-500" />,
      title: 'Pembayaran Gagal',
      desc: 'Transaksi tidak berhasil diproses. Tidak ada biaya yang dikenakan. Silakan coba kembali.',
      color: 'from-red-50 to-white',
      border: 'border-red-200',
    },
  };

  const current = STATES[status] ?? STATES.checking;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className={`w-full max-w-md bg-gradient-to-b ${current.color} border ${current.border} rounded-2xl shadow-lg p-8 text-center space-y-6`}>

        {/* Icon */}
        <div className="flex justify-center">{current.icon}</div>

        {/* Text */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">{current.title}</h1>
          <p className="text-slate-500 text-sm leading-relaxed">{current.desc}</p>
        </div>

        {/* Detail transaksi */}
        {(reference || paymentDetail) && (
          <div className="bg-white/80 rounded-xl border border-slate-200 p-4 text-left space-y-2 text-sm">
            {reference && (
              <div className="flex justify-between">
                <span className="text-slate-500">Referensi</span>
                <span className="font-mono text-slate-800 font-semibold text-xs">{reference}</span>
              </div>
            )}
            {merchantOrderId && (
              <div className="flex justify-between">
                <span className="text-slate-500">Order ID</span>
                <span className="font-mono text-slate-700 text-xs">{merchantOrderId}</span>
              </div>
            )}
            {paymentDetail && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-500">Paket</span>
                  <span className="font-semibold text-slate-800">{paymentDetail.subscription_plans?.name ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Jumlah</span>
                  <span className="font-bold text-slate-800">
                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(paymentDetail.amount)}
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {status === 'success' && (
            <Button onClick={handleContinue} className="w-full h-12 bg-[#011e4b] hover:bg-[#022a6b] rounded-xl font-bold gap-2">
              Masuk ke Dashboard <ArrowRight className="h-4 w-4" />
            </Button>
          )}

          {status === 'pending' && (
            <>
              <Button onClick={checkPaymentStatus} variant="outline" className="w-full h-11 rounded-xl gap-2 border-amber-300 text-amber-700 hover:bg-amber-50">
                <RefreshCw className="h-4 w-4" /> Cek Status Lagi
              </Button>
              <Button onClick={handleContinue} variant="ghost" className="w-full text-slate-500 text-sm">
                Kembali ke Dashboard
              </Button>
              {attempts >= 3 && (
                <p className="text-xs text-slate-400">
                  Jika langganan belum aktif setelah 5 menit, hubungi{' '}
                  <a href="https://api.whatsapp.com/send?phone=6287762407811" className="text-[#011e4b] underline font-semibold">support</a>.
                </p>
              )}
            </>
          )}

          {status === 'failed' && (
            <>
              <Button onClick={() => navigate('/dashboard', { replace: true })} className="w-full h-12 bg-[#011e4b] hover:bg-[#022a6b] rounded-xl font-bold gap-2">
                Coba Lagi <ArrowRight className="h-4 w-4" />
              </Button>
              <p className="text-xs text-slate-400">
                Butuh bantuan?{' '}
                <a href="https://api.whatsapp.com/send?phone=6287762407811" className="text-[#011e4b] underline font-semibold">Hubungi support</a>
              </p>
            </>
          )}

          {status === 'checking' && (
            <p className="text-xs text-slate-400">Mohon tunggu sebentar...</p>
          )}
        </div>

        <p className="text-xs text-slate-300">Powered by Duitku Payment Gateway</p>
      </div>
    </div>
  );
}
