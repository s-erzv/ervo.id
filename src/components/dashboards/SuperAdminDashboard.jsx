import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Building2, Users, TrendingUp, AlertCircle, CheckCircle2, Lock,
  Clock, CreditCard, BarChart2, ArrowRight, RefreshCw, ShieldCheck,
  XCircle, Eye, Loader2, Activity, BadgeCheck, Package
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import { format, subDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const formatCurrency = (amount) => {
  if (!amount) return 'Rp 0';
  if (amount >= 1000000) return `Rp ${(amount / 1000000).toFixed(1)} JT`;
  if (amount >= 1000) return `Rp ${(amount / 1000).toFixed(0)} K`;
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
};

const formatDate = (d) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

const SuperAdminDashboard = ({ profile, setActiveCompany }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [processingId, setProcessingId] = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [companiesRes, pendingRes, revenueRes] = await Promise.all([
        supabase.from('companies')
          .select('id, name, subscription_end_date, is_manually_locked, subscription_plans(name, price)')
          .order('name'),
        supabase.from('subscription_payments')
          .select('*, companies(name), subscription_plans(name, billing_cycle_days)')
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
        supabase.from('subscription_payments')
          .select('amount, approved_at, companies(name)')
          .eq('status', 'approved')
          .gte('approved_at', subDays(new Date(), 29).toISOString())
          .order('approved_at'),
      ]);

      setCompanies(companiesRes.data || []);
      setPendingPayments(pendingRes.data || []);

      // Build 30-day revenue chart
      const allDates = Array.from({ length: 30 }, (_, i) =>
        format(subDays(new Date(), 29 - i), 'yyyy-MM-dd')
      );
      const byDate = (revenueRes.data || []).reduce((acc, p) => {
        const d = format(new Date(p.approved_at), 'yyyy-MM-dd');
        acc[d] = (acc[d] || 0) + Number(p.amount || 0);
        return acc;
      }, {});
      setChartData(allDates.map(d => ({ date: d, revenue: byDate[d] || 0 })));

      // Recent 8 approved payments
      const { data: recent } = await supabase.from('subscription_payments')
        .select('*, companies(name), subscription_plans(name)')
        .in('status', ['approved', 'rejected'])
        .order('updated_at', { ascending: false })
        .limit(8);
      setRecentPayments(recent || []);
    } catch (err) {
      toast.error('Gagal memuat data platform.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleApprove = async (payment) => {
    if (!window.confirm(`Setujui pembayaran ${payment.companies?.name} — ${formatCurrency(payment.amount)}?`)) return;
    setProcessingId(payment.id);
    try {
      const newEndDate = new Date();
      newEndDate.setDate(newEndDate.getDate() + (payment.subscription_plans?.billing_cycle_days || 30));

      const { error } = await supabase.from('subscription_payments')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', payment.id);
      if (error) throw error;

      await supabase.from('companies')
        .update({ subscription_end_date: newEndDate.toISOString(), subscription_plan_id: payment.plan_id })
        .eq('id', payment.company_id);

      toast.success(`Pembayaran ${payment.companies?.name} disetujui!`);
      fetchAll();
    } catch (err) {
      toast.error('Gagal menyetujui pembayaran: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (payment) => {
    if (!window.confirm(`Tolak pembayaran dari ${payment.companies?.name}?`)) return;
    setProcessingId(payment.id);
    try {
      await supabase.from('subscription_payments').update({ status: 'rejected' }).eq('id', payment.id);
      toast.success('Pembayaran ditolak.');
      fetchAll();
    } catch (err) {
      toast.error('Gagal menolak.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleLock = async (company) => {
    const newLock = !company.is_manually_locked;
    const { error } = await supabase.from('companies').update({ is_manually_locked: newLock }).eq('id', company.id);
    if (error) return toast.error('Gagal mengubah status lock.');
    toast.success(`${company.name} ${newLock ? 'dikunci' : 'dibuka'}.`);
    fetchAll();
  };

  const now = new Date();
  const stats = useMemo(() => {
    const total = companies.length;
    const active = companies.filter(c => !c.is_manually_locked && c.subscription_end_date && new Date(c.subscription_end_date) > now).length;
    const expired = companies.filter(c => !c.is_manually_locked && (!c.subscription_end_date || new Date(c.subscription_end_date) <= now)).length;
    const locked = companies.filter(c => c.is_manually_locked).length;
    const mrr = recentPayments
      .filter(p => p.status === 'approved' && p.approved_at && new Date(p.approved_at) >= new Date(now.getFullYear(), now.getMonth(), 1))
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    return { total, active, expired, locked, mrr };
  }, [companies, recentPayments]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-[#011e4b]" />
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-400">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-700">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-50 flex items-center gap-3">
            <div className="p-2 bg-[#011e4b] rounded-xl"><ShieldCheck className="h-6 w-6 text-white" /></div>
            Platform Overview
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 ml-14 text-sm font-medium">
            Selamat datang, <span className="text-slate-700 dark:text-slate-200 font-semibold">{profile?.full_name}</span> — kontrol penuh platform Ervo ERP.
          </p>
        </div>
        <Button onClick={fetchAll} variant="outline" className="h-10 rounded-xl gap-2 self-start sm:self-auto">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="rounded-2xl border-slate-200/60 dark:border-slate-700 shadow-sm hover:shadow-md transition-all group">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg group-hover:bg-blue-100 transition-colors">
                <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-50">{stats.total}</p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wide">Total Tenant</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/60 dark:border-slate-700 shadow-sm hover:shadow-md transition-all group">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <Badge className="text-[9px] bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-0 font-bold">AKTIF</Badge>
            </div>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.active}</p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wide">Berlangganan</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/60 dark:border-slate-700 shadow-sm hover:shadow-md transition-all group">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
                <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              </div>
              <Badge className="text-[9px] bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-0 font-bold">EXPIRED</Badge>
            </div>
            <p className="text-2xl font-bold text-amber-500 dark:text-amber-400">{stats.expired}</p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wide">Kadaluarsa</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/60 dark:border-slate-700 shadow-sm hover:shadow-md transition-all group">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded-lg">
                <Lock className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              {pendingPayments.length > 0 && (
                <Badge className="text-[9px] bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-0 font-bold animate-pulse">
                  {pendingPayments.length} PENDING
                </Badge>
              )}
            </div>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.locked}</p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wide">Dikunci</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-md bg-gradient-to-br from-[#011e4b] to-[#0336a0] text-white col-span-2 md:col-span-1">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 bg-white/15 rounded-lg">
                <TrendingUp className="h-4 w-4 text-white" />
              </div>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(stats.mrr)}</p>
            <p className="text-xs font-medium text-white/60 mt-1 uppercase tracking-wide">Revenue Bulan Ini</p>
          </CardContent>
        </Card>
      </div>


      {/* Revenue Chart + Tenant List */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Revenue Chart */}
        <Card className="xl:col-span-2 rounded-2xl border-slate-200/60 dark:border-slate-700 shadow-sm overflow-hidden">
          <CardHeader className="border-b border-slate-100 dark:border-slate-700 p-6">
            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-[#011e4b] dark:text-blue-400" /> Revenue Langganan (30 Hari)
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400 font-medium">Pembayaran subscription yang disetujui</CardDescription>
          </CardHeader>
          <CardContent className="p-6 h-[280px]">
            {chartData.some(d => d.revenue > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#011e4b" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#011e4b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" tickFormatter={d => format(new Date(d), 'd MMM')}
                    tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} dy={8} />
                  <YAxis tickFormatter={v => formatCurrency(v)}
                    tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} width={65} />
                  <Tooltip
                    formatter={(v) => [formatCurrency(v), 'Revenue']}
                    labelFormatter={d => format(new Date(d), 'd MMMM yyyy', { locale: idLocale })}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#011e4b" strokeWidth={2.5}
                    fill="url(#revenueGrad)" dot={false} activeDot={{ r: 5, fill: '#011e4b' }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                <BarChart2 className="h-10 w-10 mb-2 text-slate-300" />
                <p className="text-sm font-medium text-slate-500">Belum ada revenue di 30 hari terakhir</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Payment Activity */}
        <Card className="rounded-2xl border-slate-200/60 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
          <CardHeader className="border-b border-slate-100 dark:border-slate-700 p-5 bg-slate-50/50 dark:bg-slate-800/30">
            <CardTitle className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Activity className="h-4 w-4 text-slate-500" /> Aktivitas Pembayaran
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-auto">
            {recentPayments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-400">
                <CreditCard className="h-8 w-8 mb-2 text-slate-300" />
                <p className="text-sm">Belum ada aktivitas pembayaran</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {recentPayments.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`h-2 w-2 rounded-full shrink-0 ${p.status === 'approved' ? 'bg-emerald-500' : 'bg-red-400'}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{p.companies?.name}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">{p.subscription_plans?.name}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{formatCurrency(p.amount)}</p>
                      <Badge className={`text-[8px] font-bold border-0 ${p.status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'}`}>
                        {p.status === 'approved' ? 'APPROVED' : 'REJECTED'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tenant Table */}
      <Card className="rounded-2xl border-slate-200/60 dark:border-slate-700 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-slate-100 dark:border-slate-700 p-5 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-slate-500" /> Semua Tenant
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400 font-medium">{companies.length} perusahaan terdaftar</CardDescription>
          </div>
          <Button onClick={() => navigate('/billing-account')} variant="outline" size="sm" className="h-8 text-xs rounded-lg gap-1">
            Kelola <ArrowRight className="h-3 w-3" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Perusahaan</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Paket</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Kadaluarsa</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {companies.map(c => {
                  const isExpired = !c.is_manually_locked && (!c.subscription_end_date || new Date(c.subscription_end_date) <= now);
                  const isActive = !c.is_manually_locked && c.subscription_end_date && new Date(c.subscription_end_date) > now;
                  const daysLeft = c.subscription_end_date
                    ? Math.ceil((new Date(c.subscription_end_date) - now) / (1000 * 60 * 60 * 24))
                    : null;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-lg bg-[#011e4b] flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {c.name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          {c.subscription_plans?.name || <span className="text-slate-400 italic">—</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-xs font-medium ${daysLeft !== null && daysLeft <= 7 && daysLeft > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'}`}>
                          {c.subscription_end_date ? (
                            <>
                              {formatDate(c.subscription_end_date)}
                              {daysLeft !== null && daysLeft > 0 && daysLeft <= 14 && (
                                <span className="ml-1 text-amber-500 font-bold">({daysLeft}h)</span>
                              )}
                            </>
                          ) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {c.is_manually_locked ? (
                          <Badge className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-0 font-semibold gap-1">
                            <Lock className="h-2.5 w-2.5" /> Dikunci
                          </Badge>
                        ) : isActive ? (
                          <Badge className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-0 font-semibold gap-1">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Aktif
                          </Badge>
                        ) : (
                          <Badge className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-0 font-semibold gap-1">
                            <Clock className="h-2.5 w-2.5" /> Kadaluarsa
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex gap-1.5 justify-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 text-xs rounded-lg"
                            onClick={() => { setActiveCompany(c.id); navigate('/dashboard'); }}
                          >
                            <Eye className="h-3 w-3 mr-1" /> Masuk
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className={`h-7 px-2.5 text-xs rounded-lg ${c.is_manually_locked ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' : 'border-red-200 text-red-600 hover:bg-red-50'}`}
                            onClick={() => handleToggleLock(c)}
                          >
                            {c.is_manually_locked ? <><CheckCircle2 className="h-3 w-3 mr-1" />Buka</> : <><Lock className="h-3 w-3 mr-1" />Kunci</>}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {companies.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-10 text-slate-400 text-sm">Belum ada tenant terdaftar</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

    </div>
  );
};

export default SuperAdminDashboard;
