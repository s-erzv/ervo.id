import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Bar, Line, Legend } from "recharts";
import { ListOrdered, DollarSign, Loader2, Calculator, ShoppingCart, ArrowRight, BarChart, Wallet, ArrowUpCircle, Clock, CheckCircle, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

const DropshipDashboard = () => {
  const { userId: currentUserId, userProfile, companyId, userRole } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // LOGIC LOGIN AS (IMPERSONATION)
  const impersonatedId = searchParams.get('as');
  const isAdminSession = userRole === 'admin' || userRole === 'super_admin';
  const targetUserId = (isAdminSession && impersonatedId) ? impersonatedId : currentUserId;
  const isImpersonating = isAdminSession && !!impersonatedId;

  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [loading, setLoading] = useState(true);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);

  const [dashboardData, setDashboardData] = useState({
    summary: { totalSales: 0, totalCommission: 0, totalOrders: 0, avgCommPerOrder: 0 },
    balances: { pending: 0, available: 0, targetName: '' }, 
    dailyStats: [],
    recentOrders: []
  });

  const formatRupiah = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);

  const fetchDashboardData = useCallback(async () => {
    if (!targetUserId) return;
    setLoading(true);
    try {
      // 1. AMBIL SALDO REAL DARI TABEL PROFILE TARGET
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('balance_pending, balance_available, full_name')
        .eq('id', targetUserId)
        .single();

      if (profileError) throw profileError;

      // 2. AMBIL DATA ORDER UNTUK STATISTIK
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id, grand_total, dropshipper_commission, status, created_at, invoice_number,
          customers (name)
        `)
        .eq('dropshipper_id', targetUserId)
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      let totalSales = 0;
      let totalCommissionInPeriod = 0;
      const dailyMap = {};

      orders.forEach(order => {
        const comm = parseFloat(order.dropshipper_commission) || 0;
        const sale = parseFloat(order.grand_total) || 0;
        
        totalSales += sale;
        totalCommissionInPeriod += comm;

        const dateKey = format(new Date(order.created_at), 'yyyy-MM-dd');
        if (!dailyMap[dateKey]) dailyMap[dateKey] = { date: dateKey, Revenue: 0, Commission: 0 };
        dailyMap[dateKey].Revenue += sale;
        dailyMap[dateKey].Commission += comm;
      });

      setDashboardData({
        summary: { 
            totalSales, 
            totalCommission: totalCommissionInPeriod, 
            totalOrders: orders.length,
            avgCommPerOrder: orders.length > 0 ? totalCommissionInPeriod / orders.length : 0
        },
        balances: {
            pending: parseFloat(profile.balance_pending || 0),
            available: parseFloat(profile.balance_available || 0),
            targetName: profile.full_name
        },
        dailyStats: Object.values(dailyMap).sort((a, b) => new Date(a.date) - new Date(b.date)),
        recentOrders: orders.slice(0, 5)
      });
    } catch (err) {
      toast.error("Gagal memuat data dashboard");
    } finally {
      setLoading(false);
    }
  }, [targetUserId, startDate, endDate]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleWithdrawRequest = async () => {
    if (isImpersonating) return toast.error("Admin tidak dapat melakukan penarikan dana.");
    
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) return toast.error("Nominal tidak valid");
    
    if (amount > dashboardData.balances.pending) {
      return toast.error("Nominal melebihi Dana Tertunda Anda");
    }

    setIsSubmittingWithdraw(true);
    try {
      // 1. Simpan pengajuan
      const { error: requestError } = await supabase
        .from('payout_requests')
        .insert({
          dropshipper_id: targetUserId,
          company_id: companyId,
          amount: amount,
          status: 'pending',
          bank_account_info: { name: userProfile?.full_name }
        });

      if (requestError) throw requestError;

      // 2. KIRIM NOTIFIKASI KE ADMIN VIA ONESIGNAL
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('company_id', companyId)
        .in('role', ['admin', 'super_admin']);

      if (admins && admins.length > 0) {
        await supabase.functions.invoke('send-onesignal-push', {
          body: {
            user_ids: admins.map(a => a.id),
            title: "💰 Pengajuan Cair Dana!",
            message: `${userProfile?.full_name} meminta pencairan ${formatRupiah(amount)}`,
            data: { route: '/financials', type: 'payout_request' }
          }
        });
      }

      toast.success("Pengajuan dikirim! Admin telah dinotifikasi.");
      setIsWithdrawModalOpen(false);
      setWithdrawAmount('');
      fetchDashboardData(); 
    } catch (err) {
      toast.error("Gagal mengirim pengajuan");
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  if (loading && dashboardData.recentOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#10182b]" />
        <p className="text-muted-foreground text-sm italic">Memuat data dompet...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 container mx-auto md:p-8 max-w-7xl"> 
      
      {/* BANNER LOGIN AS (INDIGO) */}
      {isImpersonating && (
        <div className="bg-indigo-600 text-white px-5 py-3 rounded-2xl flex justify-between items-center shadow-lg border border-indigo-400">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 animate-pulse" />
            <p className="text-sm font-bold">Mode Pantau: Melihat Dashboard {dashboardData.balances.targetName}</p>
          </div>
          <Button size="sm" variant="secondary" className="h-8 text-[11px] font-bold" onClick={() => navigate('/settings')}>Kembali ke Pengaturan</Button>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Halo, {isImpersonating ? dashboardData.balances.targetName?.split(' ')[0] : userProfile?.full_name?.split(' ')[0]}!
          </h2>
          <p className="text-muted-foreground text-sm font-medium">Kelola komisi dan pantau performa jualan Anda.</p>
        </div>
        
        {/* Tombol Cairkan hanya untuk Dropshipper asli */}
        {!isImpersonating && (
          <Button onClick={() => setIsWithdrawModalOpen(true)} className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg px-6 rounded-xl">
              <ArrowUpCircle className="mr-2 h-4 w-4" /> Ajukan Pencairan
          </Button>
        )}
      </div>

      {/* 3 CARD UTAMA: DANA TERTUNDA, CAIR, TOTAL */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="relative overflow-hidden border-0 shadow-md bg-white ring-1 ring-slate-200 py-4 rounded-2xl">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <CardDescription className="text-xs font-bold uppercase tracking-wider text-slate-500">Dana Tertunda</CardDescription>
              <Clock className="h-4 w-4 text-emerald-500 opacity-60" />
            </div>
            <CardTitle className="text-2xl font-extrabold text-emerald-600">{formatRupiah(dashboardData.balances.pending)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] pl-6 text-muted-foreground italic font-medium">Komisi dalam antrean / sedang diajukan.</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-md bg-white ring-1 ring-slate-200 py-4 rounded-2xl">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <CardDescription className="text-xs font-bold uppercase tracking-wider text-slate-500">Dana Cair</CardDescription>
              <CheckCircle className="h-4 w-4 text-amber-500 opacity-60" />
            </div>
            <CardTitle className="text-2xl font-extrabold text-amber-600">{formatRupiah(dashboardData.balances.available)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] pl-6 text-muted-foreground italic font-medium">Komisi yang sudah dikirim admin ke rekening Anda.</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-0 shadow-md bg-slate-900 text-white py-4 rounded-2xl">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <CardDescription className="text-xs font-bold uppercase tracking-wider text-slate-300">Total Komisi</CardDescription>
              <Wallet className="h-4 w-4 text-white opacity-40" />
            </div>
            <CardTitle className="text-2xl font-extrabold">
                {formatRupiah(dashboardData.balances.pending + dashboardData.balances.available)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] pl-6 text-slate-400 italic font-medium">Akumulasi seluruh pendapatan Anda.</p>
          </CardContent>
        </Card>
      </div>

      {/* FILTER PERIODE */}
      <Card className="p-5 border-0 shadow-sm bg-slate-50/50 ring-1 ring-slate-200 rounded-2xl">
          <CardTitle className="text-sm font-bold mb-4 flex items-center gap-2 text-slate-700 uppercase tracking-tight">
              <BarChart className="h-4 w-4" /> Filter Analisis Periode
          </CardTitle>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase">Mulai</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 text-sm bg-white border-slate-200 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase">Sampai</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 text-sm bg-white border-slate-200 rounded-xl" />
            </div>
          </div>
      </Card>

      {/* STATS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Sales Periode" value={formatRupiah(dashboardData.summary.totalSales)} icon={<ShoppingCart className="h-4 w-4" />} />
        <StatCard title="Komisi Periode" value={formatRupiah(dashboardData.summary.totalCommission)} icon={<DollarSign className="h-4 w-4" />} />
        <StatCard title="Total Order" value={dashboardData.summary.totalOrders} icon={<ListOrdered className="h-4 w-4" />} />
        <StatCard title="Avg. Komisi" value={formatRupiah(dashboardData.summary.avgCommPerOrder)} icon={<Calculator className="h-4 w-4" />} />
      </div>

      {/* CHART & RECENT ORDERS */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2 border shadow-sm ring-1 ring-slate-200 rounded-2xl overflow-hidden">
          <CardHeader className="p-5 border-b bg-slate-50/30">
            <CardTitle className="text-base font-bold text-slate-800">Grafik Performa Komisi</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dashboardData.dailyStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), 'dd/MM')} style={{fontSize: '10px', fontWeight: 'bold'}} />
                <YAxis tickFormatter={(v) => v >= 1000 ? `${v/1000}k` : v} style={{fontSize: '10px', fontWeight: 'bold'}} />
                <Tooltip 
                  formatter={(v) => formatRupiah(v)}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Legend iconType="circle" />
                <Bar dataKey="Revenue" name="Omzet" fill="#1e293b" radius={[4, 4, 0, 0]} barSize={20} />
                <Line type="monotone" dataKey="Commission" name="Komisi" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border shadow-sm ring-1 ring-slate-200 rounded-2xl overflow-hidden">
          <CardHeader className="p-5 border-b bg-slate-50/30">
            <CardTitle className="text-base font-bold text-slate-800">Pesanan Terakhir</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pt-3">
            <div className="space-y-1">
              {dashboardData.recentOrders.map((order) => (
                <div key={order.id} onClick={() => navigate(`/orders/${order.id}`)} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 cursor-pointer transition-all group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-slate-900 group-hover:text-white transition-colors">
                      <ShoppingCart className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 leading-none">{order.customers?.name || 'Pelanggan'}</p>
                      <p className="text-[10px] text-slate-400 mt-1.5 font-bold">#{order.invoice_number || 'DRAFT'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-emerald-600">+{formatRupiah(order.dropshipper_commission)}</p>
                    <Badge variant="secondary" className="text-[9px] h-4 font-bold bg-slate-100 text-slate-600 border-0 uppercase">{order.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* MODAL AJUKAN PENCAIRAN */}
      <Dialog open={isWithdrawModalOpen} onOpenChange={setIsWithdrawModalOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Ajukan Pencairan</DialogTitle>
            <DialogDescription className="text-sm">
              Saldo tertunda yang bisa diajukan: <span className="font-bold text-slate-900">{formatRupiah(dashboardData.balances.pending)}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-xs font-bold uppercase text-slate-500">Nominal yang ingin dicairkan</Label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">Rp</div>
                <Input
                  id="amount"
                  type="number"
                  placeholder="Masukkan jumlah"
                  className="pl-11 h-12 text-lg font-bold rounded-2xl border-slate-200"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                />
              </div>
              <p className="text-[10px] text-slate-400 font-medium">*Dana akan diverifikasi admin sebelum masuk ke saldo 'Cair'.</p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsWithdrawModalOpen(false)} className="rounded-xl font-bold">Batal</Button>
            <Button onClick={handleWithdrawRequest} disabled={isSubmittingWithdraw} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold h-11 flex-1 sm:flex-none px-8">
              {isSubmittingWithdraw ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Kirim Pengajuan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const StatCard = ({ title, value, icon }) => (
  <Card className="border-0 shadow-none ring-1 ring-slate-200 rounded-2xl bg-white/60">
    <CardContent className="p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
            <p className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">{title}</p>
            <div className="text-slate-300">{icon}</div>
        </div>
        <p className="text-base font-bold text-slate-900">{value}</p>
    </CardContent>
  </Card>
);

export default DropshipDashboard;