import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import * as XLSX from 'xlsx';
import {
  FileText, Download, Wallet,
  TrendingDown, TrendingUp, AlertCircle, Receipt,
  ArrowRightLeft, Search, RefreshCw, ChevronLeft, ChevronRight, MoreHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';

const COLORS = ['#2563eb', '#16a34a', '#eab308', '#9333ea', '#dc2626', '#0891b2', '#ea580c', '#475569'];

const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
};

export function FinancialDashboard({ rawTransactions = [], categories = [], paymentMethods = [] }) {
  const [transactionType, setTransactionType] = useState('expense');

  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  const [draftFilters, setDraftFilters] = useState({ start: firstDay, end: lastDay, category: 'all', subcategory: 'all', method: 'all' });
  const [appliedFilters, setAppliedFilters] = useState({ start: firstDay, end: lastDay, category: 'all', subcategory: 'all', method: 'all' });
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const handleApplyFilters = () => {
    setAppliedFilters({ ...draftFilters });
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
      const reset = { start: firstDay, end: lastDay, category: 'all', subcategory: 'all', method: 'all' };
      setDraftFilters(reset);
      setAppliedFilters(reset);
      setSelectedCategoryIds(chartDataFull.map(c => c.id));
      setCurrentPage(1);
  };

  useEffect(() => {
    setDraftFilters(prev => ({ ...prev, category: 'all', subcategory: 'all' }));
    setAppliedFilters(prev => ({ ...prev, category: 'all', subcategory: 'all' }));
  }, [transactionType]);

  const baseFilteredTransactions = useMemo(() => {
    return rawTransactions.filter(t => {
      if (t.type !== transactionType) return false;

      const tDate = t.date ? (typeof t.date === 'string' ? t.date.split('T')[0] : new Date(t.date).toISOString().split('T')[0]) : '';
      if (appliedFilters.start && tDate < appliedFilters.start) return false;
      if (appliedFilters.end && tDate > appliedFilters.end) return false;

      if (appliedFilters.category !== 'all' && t.category_id !== appliedFilters.category) return false;
      if (appliedFilters.subcategory !== 'all' && t.subcategory_id !== appliedFilters.subcategory) return false;
      if (appliedFilters.method !== 'all' && t.payment_method_id !== appliedFilters.method) return false;

      return true;
    });
  }, [rawTransactions, transactionType, appliedFilters]);

  const chartDataFull = useMemo(() => {
    const categoryMap = {};
    baseFilteredTransactions.forEach(t => {
      const amount = Number(t.amount) || 0;
      const catId = t.category_id || 'un-categorized';
      const catName = t.category || 'Tanpa Kategori';
      const subName = t.subcategory || 'Umum';

      if (!categoryMap[catId]) {
        categoryMap[catId] = { id: catId, name: catName, value: 0, count: 0, subCategories: {} };
      }
      categoryMap[catId].value += amount;
      categoryMap[catId].count += 1;

      if (!categoryMap[catId].subCategories[subName]) categoryMap[catId].subCategories[subName] = 0;
      categoryMap[catId].subCategories[subName] += amount;
    });

    return Object.values(categoryMap).sort((a, b) => b.value - a.value);
  }, [baseFilteredTransactions]);

  useEffect(() => {
    setSelectedCategoryIds(chartDataFull.map(c => c.id));
  }, [transactionType]);

  useEffect(() => {
    if (chartDataFull.length > 0) {
      setSelectedCategoryIds(prev => {
        const existingIds = chartDataFull.map(c => c.id);
        const newSelected = prev.filter(id => existingIds.includes(id));
        if (newSelected.length === 0 && prev.length > 0) return existingIds;
        return prev;
      });
    }
  }, [chartDataFull]);

  const toggleCategory = (catId) => {
    setSelectedCategoryIds(prev => {
      if (prev.includes(catId)) {
        return prev.filter(id => id !== catId);
      } else {
        return [...prev, catId];
      }
    });
  };

  const toggleAllCategories = (e) => {
    if (e) e.preventDefault();
    setSelectedCategoryIds(selectedCategoryIds.length === chartDataFull.length ? [] : chartDataFull.map(c => c.id));
  };

  const finalFilteredTransactions = useMemo(() => {
    return baseFilteredTransactions.filter(t => selectedCategoryIds.includes(t.category_id || 'un-categorized'));
  }, [baseFilteredTransactions, selectedCategoryIds]);

  const dashboardData = useMemo(() => {
    let totalAmount = 0;
    let maxExpense = 0;
    let adminFeeTotal = 0;

    finalFilteredTransactions.forEach(t => {
      const amount = Number(t.amount) || 0;
      totalAmount += amount;
      if (amount > maxExpense) maxExpense = amount;
      if (t.source === 'admin_fee' || t.description?.toLowerCase().includes('admin')) adminFeeTotal += amount;
    });

    const chartDataFiltered = chartDataFull.filter(c => selectedCategoryIds.includes(c.id));

    return { totalAmount, txCount: finalFilteredTransactions.length, maxExpense, adminFeeTotal, chartDataFiltered };
  }, [finalFilteredTransactions, chartDataFull, selectedCategoryIds]);

  const totalPages = Math.max(1, Math.ceil(finalFilteredTransactions.length / itemsPerPage));
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return finalFilteredTransactions.slice(start, start + itemsPerPage);
  }, [finalFilteredTransactions, currentPage]);

  const daysDifference = appliedFilters.start && appliedFilters.end
    ? Math.max(1, Math.ceil((new Date(appliedFilters.end) - new Date(appliedFilters.start)) / (1000 * 60 * 60 * 24)))
    : 30;

  const avgPerDay = dashboardData.txCount > 0 ? dashboardData.totalAmount / daysDifference : 0;
  const isExpense = transactionType === 'expense';

  const handleExport = () => {
    const exportData = finalFilteredTransactions.map(t => ({
        Tanggal: new Date(t.date).toLocaleString('id-ID'),
        Kategori: t.category,
        SubKategori: t.subcategory,
        Deskripsi: t.description,
        Jumlah: t.amount,
        Metode: t.method,
        Sumber: t.source,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transaksi");
    XLSX.writeFile(wb, `Laporan_${transactionType}_${appliedFilters.start}.xlsx`);
  };

  const renderCustomizedLabel = ({ cx, cy }) => {
    const isMobile = window.innerWidth < 768;
    return (
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
        <tspan x={cx} dy={isMobile ? "-8" : "-10"} fontSize={isMobile ? "10" : "12"} fill="#64748b" fontWeight="500">Total Terpilih</tspan>
        <tspan x={cx} dy={isMobile ? "18" : "22"} fontSize={isMobile ? "13" : "15"} fontWeight="bold" fill="#0f172a">{formatCurrency(dashboardData.totalAmount)}</tspan>
      </text>
    );
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percentage = dashboardData.totalAmount > 0 ? ((data.value / dashboardData.totalAmount) * 100).toFixed(1) : "0.0";

      return (
        <div className="bg-[#1a1c23] text-white p-4 rounded-xl shadow-2xl border border-slate-700/50 min-w-[240px] z-50">
          <p className="font-bold text-sm text-slate-100">{data.name}</p>
          <p className="text-xs text-slate-300 mt-1 mb-3 pb-3 border-b border-slate-700">
            Total: <span className="font-semibold text-white">{formatCurrency(data.value)}</span> ({percentage}%)
          </p>
          <p className="text-xs font-semibold mb-2 text-slate-400">Sub Kategori:</p>
          <ul className="space-y-1.5">
            {Object.entries(data.subCategories)
              .sort(([, a], [, b]) => b - a)
              .map(([sub, val]) => (
              <li key={sub} className="flex justify-between items-center text-xs">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-1 h-1 rounded-full bg-slate-500"></span>{sub}
                </span>
                <span className="font-medium text-slate-200">{formatCurrency(val)}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* HEADER & TOGGLE */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="w-full lg:w-auto">
          <h2 className="text-xl md:text-2xl font-bold flex items-center flex-wrap gap-2 text-slate-800">
            Dashboard {isExpense ? 'Pengeluaran' : 'Pemasukan'}
            <Badge className="text-[9px] md:text-[10px] font-medium bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100 px-2 py-0.5 rounded-full shadow-none shrink-0">Admin Only</Badge>
          </h2>
          <p className="text-xs md:text-sm text-slate-500 mt-1">Pantau dan analisis {isExpense ? 'pengeluaran' : 'pemasukan'} perusahaan.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto">
          <div className="text-[10px] md:text-xs text-slate-500 flex items-center gap-1.5 order-2 sm:order-1">
            Diperbarui: {new Date().toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'})}
            <RefreshCw className="h-3.5 w-3.5 cursor-pointer hover:text-slate-800 transition-colors" onClick={handleApplyFilters} />
          </div>
          <div className="flex bg-slate-100/80 p-1 rounded-xl border shadow-inner w-full sm:w-auto order-1 sm:order-2">
            <Button variant={isExpense ? "default" : "ghost"} size="sm" className={cn("flex-1 sm:flex-none h-8 text-[11px] md:text-xs font-semibold rounded-lg", isExpense ? "bg-[#011e4b] shadow-sm text-white hover:bg-[#022a6b]" : "text-slate-600")} onClick={() => setTransactionType('expense')}>Pengeluaran</Button>
            <Button variant={!isExpense ? "default" : "ghost"} size="sm" className={cn("flex-1 sm:flex-none h-8 text-[11px] md:text-xs font-semibold rounded-lg", !isExpense ? "bg-[#011e4b] shadow-sm text-white hover:bg-[#022a6b]" : "text-slate-600")} onClick={() => setTransactionType('income')}>Pemasukan</Button>
          </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <Card className="border shadow-sm bg-white rounded-2xl">
        <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                    <Label className="text-[11px] md:text-xs font-semibold text-slate-600">Periode Tanggal</Label>
                    <div className="flex items-center gap-1 bg-white border rounded-lg p-1 shadow-sm w-full">
                        <Input type="date" value={draftFilters.start} onChange={(e) => setDraftFilters({...draftFilters, start: e.target.value})} className="h-8 text-[10px] md:text-xs border-0 shadow-none focus-visible:ring-0 p-0 px-1 md:px-2 w-full" />
                        <span className="text-slate-400 text-[10px]">→</span>
                        <Input type="date" value={draftFilters.end} onChange={(e) => setDraftFilters({...draftFilters, end: e.target.value})} className="h-8 text-[10px] md:text-xs border-0 shadow-none focus-visible:ring-0 p-0 px-1 md:px-2 w-full" />
                    </div>
                </div>
                <div className="space-y-1.5 lg:col-span-2">
                    <Label className="text-[11px] md:text-xs font-semibold text-slate-600">Kategori</Label>
                    <Select value={draftFilters.category} onValueChange={(v) => setDraftFilters({...draftFilters, category: v, subcategory: 'all'})}>
                        <SelectTrigger className="h-9 md:h-10 text-[11px] md:text-xs shadow-sm bg-white w-full rounded-lg"><SelectValue placeholder="Semua Kategori" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Kategori</SelectItem>
                            {categories.filter(c => c.type === transactionType).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5 lg:col-span-2">
                    <Label className="text-[11px] md:text-xs font-semibold text-slate-600">Sub Kategori</Label>
                    <Select value={draftFilters.subcategory} onValueChange={(v) => setDraftFilters({...draftFilters, subcategory: v})} disabled={draftFilters.category === 'all'}>
                        <SelectTrigger className="h-9 md:h-10 text-[11px] md:text-xs shadow-sm bg-white w-full rounded-lg"><SelectValue placeholder="Semua Sub" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Sub Kategori</SelectItem>
                            {categories.find(c => c.id === draftFilters.category)?.financial_subcategories?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5 lg:col-span-3">
                    <Label className="text-[11px] md:text-xs font-semibold text-slate-600">Metode Pembayaran</Label>
                    <Select value={draftFilters.method} onValueChange={(v) => setDraftFilters({...draftFilters, method: v})}>
                        <SelectTrigger className="h-9 md:h-10 text-[11px] md:text-xs shadow-sm bg-white w-full rounded-lg"><SelectValue placeholder="Semua Metode" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Metode</SelectItem>
                            {paymentMethods.map(m => <SelectItem key={m.id} value={m.id}>{m.method_name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex gap-2 sm:col-span-2 lg:col-span-2 w-full">
                    <Button onClick={handleApplyFilters} className="h-9 md:h-10 flex-1 bg-[#011e4b] text-white hover:bg-[#022a6b] text-[11px] md:text-xs shadow-sm rounded-lg"><Search className="w-3.5 h-3.5 mr-1 md:mr-2"/> Filter</Button>
                    <Button onClick={handleResetFilters} variant="outline" className="h-9 md:h-10 px-3 text-[11px] md:text-xs shadow-sm rounded-lg">Reset</Button>
                </div>
            </div>
        </CardContent>
      </Card>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="shadow-sm border rounded-2xl hover:shadow-md transition-all">
          <CardContent className="p-4 flex flex-col justify-center">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Wallet className="h-5 w-5" /></div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Total {isExpense ? 'Pengeluaran' : 'Pemasukan'}</p>
                <p className="text-lg font-bold text-slate-800 leading-tight">{formatCurrency(dashboardData.totalAmount)}</p>
                <p className="text-[10px] text-slate-400 mt-1">{daysDifference} hari terakhir</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border rounded-2xl hover:shadow-md transition-all">
          <CardContent className="p-4 flex flex-col justify-center">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><Receipt className="h-5 w-5" /></div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Transaksi</p>
                <p className="text-lg font-bold text-slate-800 leading-tight">{dashboardData.txCount}</p>
                <p className="text-[10px] text-slate-400 mt-1">Total transaksi</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border rounded-2xl hover:shadow-md transition-all">
          <CardContent className="p-4 flex flex-col justify-center">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><ArrowRightLeft className="h-5 w-5" /></div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Rata-rata / Hari</p>
                <p className="text-lg font-bold text-slate-800 leading-tight">{formatCurrency(avgPerDay)}</p>
                <p className="text-[10px] text-slate-400 mt-1">{isExpense ? 'Pengeluaran' : 'Pemasukan'} harian</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm border rounded-2xl hover:shadow-md transition-all">
          <CardContent className="p-4 flex flex-col justify-center">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-50 text-amber-500 rounded-xl"><AlertCircle className="h-5 w-5" /></div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">{isExpense ? 'Pengeluaran' : 'Pemasukan'} Terbesar</p>
                <p className="text-lg font-bold text-slate-800 leading-tight">{formatCurrency(dashboardData.maxExpense)}</p>
                <p className="text-[10px] text-slate-400 mt-1">Nilai tertinggi</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {isExpense && (
          <Card className="shadow-sm border rounded-2xl bg-rose-50/30 hover:shadow-md transition-all">
            <CardContent className="p-4 flex flex-col justify-center">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-100 text-rose-600 rounded-xl"><TrendingDown className="h-5 w-5" /></div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Biaya Admin</p>
                  <p className="text-lg font-bold text-slate-800 leading-tight">{formatCurrency(dashboardData.adminFeeTotal)}</p>
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">
                    {dashboardData.totalAmount > 0 ? ((dashboardData.adminFeeTotal / dashboardData.totalAmount) * 100).toFixed(1) : "0.0"}% dari total
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* CHARTS & CATEGORIES ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* CHART AREA */}
        <Card className="lg:col-span-2 border shadow-sm bg-white rounded-2xl overflow-hidden">
          <CardHeader className="border-b px-4 md:px-6 py-4 bg-white z-10 relative">
            <CardTitle className="text-xs md:text-sm font-bold text-slate-800 flex items-center gap-2">
               Distribusi {isExpense ? 'Pengeluaran' : 'Pemasukan'} berdasarkan Kategori
            </CardTitle>
            <p className="text-[10px] md:text-xs text-slate-500 font-normal mt-1">Sesuaikan grafik dengan pilihan ceklis di samping.</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-col md:flex-row min-h-[400px] md:h-[400px]">

              <div className="w-full md:w-1/2 h-[300px] md:h-full relative flex items-center justify-center p-4 min-w-0">
                {dashboardData.chartDataFiltered.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dashboardData.chartDataFiltered}
                        cx="50%"
                        cy="50%"
                        innerRadius={window.innerWidth < 768 ? 65 : 85}
                        outerRadius={window.innerWidth < 768 ? 100 : 130}
                        paddingAngle={1}
                        dataKey="value"
                        stroke="none"
                        label={({ midAngle, innerRadius, outerRadius, percent }) => {
                          const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                          const x = 0 + radius * Math.cos(-midAngle * Math.PI / 180);
                          const y = 0 + radius * Math.sin(-midAngle * Math.PI / 180);
                          return percent > 0.08 ? (<text x="50%" y="50%" dx={x} dy={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={window.innerWidth < 768 ? 9 : 11} fontWeight="600">{(percent * 100).toFixed(0)}%</text>) : null;
                        }}
                      >
                        {dashboardData.chartDataFiltered.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
                      {renderCustomizedLabel({cx: "50%", cy: "50%"})}
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                      <AlertCircle className="h-8 w-8 opacity-20" />
                      <p className="text-xs md:text-sm italic">Pilih kategori untuk melihat grafik</p>
                  </div>
                )}
              </div>

              <div className="w-full md:w-1/2 h-[200px] md:h-full overflow-y-auto border-t md:border-t-0 md:border-l border-slate-100 bg-white">
                  <div className="sticky top-0 bg-white/95 backdrop-blur z-10 px-4 md:px-6 py-2 md:py-3 border-b flex justify-between text-[10px] md:text-xs font-semibold text-slate-500">
                      <span>Kategori</span>
                      <span>Total</span>
                  </div>
                  <div className="p-2">
                      {dashboardData.chartDataFiltered.map((cat, idx) => {
                          const color = COLORS[idx % COLORS.length];
                          const percentage = dashboardData.totalAmount > 0 ? ((cat.value / dashboardData.totalAmount) * 100).toFixed(1) : "0.0";
                          return (
                              <div key={cat.id} className="flex flex-col gap-1 p-2 md:p-3 hover:bg-slate-50 rounded-xl transition-colors group">
                                  <div className="flex justify-between items-start">
                                      <div className="flex items-center gap-2 md:gap-3">
                                          <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: color }}></span>
                                          <span className="font-semibold text-[10px] md:text-xs text-slate-700 truncate max-w-[120px] md:max-w-[150px]" title={cat.name}>{cat.name}</span>
                                      </div>
                                      <div className="text-right flex flex-col items-end">
                                          <span className="text-slate-700 font-bold text-[10px] md:text-xs">{formatCurrency(cat.value)} <span className="text-slate-400 font-normal ml-1">({percentage}%)</span></span>
                                      </div>
                                  </div>
                              </div>
                          )
                      })}
                  </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CATEGORY CHECKBOXES PANEL */}
        <Card className="lg:col-span-1 border shadow-sm bg-white rounded-2xl flex flex-col h-[300px] md:h-[400px] lg:h-auto">
          <CardHeader className="border-b px-4 md:px-5 py-3 md:py-4 shrink-0">
            <div className="flex justify-between items-center">
                <div>
                    <CardTitle className="text-xs md:text-sm font-bold text-slate-800">Ceklis Kategori</CardTitle>
                    <p className="text-[9px] md:text-[10px] text-slate-500 font-normal mt-0.5">Filter data dashboard.</p>
                </div>
                <button onClick={toggleAllCategories} className="text-[#011e4b] text-[10px] md:text-xs hover:underline font-medium">
                  {selectedCategoryIds.length === chartDataFull.length ? 'Batal' : 'Semua'}
                </button>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto">
            <div className="flex flex-col divide-y divide-slate-100 p-2">
              {chartDataFull.map((cat, idx) => {
                const globalTotal = chartDataFull.reduce((sum, c) => sum + c.value, 0);
                const percentage = globalTotal > 0 ? ((cat.value / globalTotal) * 100).toFixed(1) : "0.0";
                const isChecked = selectedCategoryIds.includes(cat.id);

                return (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer group"
                    onClick={() => toggleCategory(cat.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          id={`cat-cb-${idx}`}
                          checked={isChecked}
                          onCheckedChange={() => toggleCategory(cat.id)}
                          className={cn("shrink-0", isChecked ? "bg-[#011e4b] border-[#011e4b]" : "")}
                        />
                      </div>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <label className="text-xs font-semibold cursor-pointer text-slate-700 truncate select-none">
                          {cat.name}
                        </label>
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0 pl-2 text-right">
                      <p className="text-[11px] font-bold text-slate-600">{formatCurrency(cat.value)}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{percentage}%</p>
                    </div>
                  </div>
                );
              })}
              {chartDataFull.length === 0 && <div className="p-10 text-center text-xs text-slate-400 italic">Tidak ada data untuk periode ini</div>}
            </div>
          </CardContent>
          <div className="px-5 py-3 border-t bg-slate-50 text-xs text-slate-500 flex justify-between items-center shrink-0 rounded-b-2xl">
              <span className="font-medium">{selectedCategoryIds.length} dari {chartDataFull.length} dipilih</span>
              <button onClick={() => setSelectedCategoryIds([])} className="text-red-600 hover:text-red-700 font-semibold hover:underline">Reset</button>
          </div>
        </Card>
      </div>

      {/* TABLE DATA */}
      <Card className="border shadow-sm bg-white rounded-2xl overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b px-6 py-4 bg-white">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                  <FileText className="h-4 w-4 text-slate-500" /> Daftar Transaksi ({isExpense ? 'Pengeluaran' : 'Pemasukan'})
              </CardTitle>
              <Button onClick={handleExport} variant="outline" size="sm" className="h-8 text-xs font-semibold shadow-sm rounded-lg"><Download className="h-3.5 w-3.5 mr-2" /> Export Excel</Button>
          </CardHeader>
          <CardContent className="p-0">
              <div className="overflow-x-auto min-h-[300px]">
                  <Table>
                      <TableHeader className="bg-slate-50 text-xs border-b border-slate-200">
                          <TableRow className="hover:bg-slate-50">
                              <TableHead className="w-[140px] font-bold text-slate-700 py-3 pl-6">Tanggal</TableHead>
                              <TableHead className="font-bold text-slate-700 py-3">Kategori</TableHead>
                              <TableHead className="font-bold text-slate-700 py-3">Sub Kategori</TableHead>
                              <TableHead className="font-bold text-slate-700 py-3">Deskripsi</TableHead>
                              <TableHead className="font-bold text-slate-700 py-3">Jumlah</TableHead>
                              <TableHead className="font-bold text-slate-700 py-3">Metode</TableHead>
                              <TableHead className="font-bold text-slate-700 py-3">Sumber</TableHead>
                              <TableHead className="text-center font-bold text-slate-700 py-3 pr-6">Bukti</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {paginatedTransactions.length === 0 && (
                              <TableRow><TableCell colSpan={8} className="text-center py-12 text-slate-400 text-sm">Tidak ada transaksi yang sesuai filter atau pilihan kategori.</TableCell></TableRow>
                          )}
                          {paginatedTransactions.map((t, idx) => {
                              const catIndex = chartDataFull.findIndex(c => c.id === (t.category_id || 'un-categorized'));
                              const dotColor = catIndex !== -1 ? COLORS[catIndex % COLORS.length] : COLORS[0];

                              return (
                              <TableRow key={t.id} className="text-xs hover:bg-slate-50/80 transition-colors">
                                  <TableCell className="text-slate-500 pl-6 font-medium">
                                    {new Date(t.date).toLocaleString('id-ID', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }).replace(',', '')}
                                  </TableCell>
                                  <TableCell>
                                      <div className="flex items-center gap-2">
                                          <span className="w-2 h-2 rounded-full shrink-0 shadow-sm" style={{backgroundColor: dotColor}}></span>
                                          <span className="font-semibold text-slate-700">{t.category}</span>
                                      </div>
                                  </TableCell>
                                  <TableCell className="text-slate-600 font-medium">{t.subcategory}</TableCell>
                                  <TableCell className="text-slate-600 max-w-[220px] truncate" title={t.description}>{t.description}</TableCell>
                                  <TableCell className={`font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(t.amount)}</TableCell>
                                  <TableCell className="text-slate-600 font-medium">{t.method}</TableCell>
                                  <TableCell className="text-[10px] font-medium text-slate-500 capitalize">{t.source?.replace(/_/g, ' ')}</TableCell>
                                  <TableCell className="text-center pr-6">
                                      {t.proofUrl ? <a href={t.proofUrl} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-[#011e4b] bg-slate-100 hover:bg-blue-50 p-1.5 rounded-lg inline-flex transition-colors"><FileText className="h-3.5 w-3.5" /></a> : <span className="text-slate-300">-</span>}
                                  </TableCell>
                              </TableRow>
                          )})}
                      </TableBody>
                  </Table>
              </div>

              {/* Pagination Footer */}
              <div className="border-t px-6 py-4 bg-white flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
                  <div className="mb-4 sm:mb-0">
                      Menampilkan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, finalFilteredTransactions.length)} dari {finalFilteredTransactions.length} transaksi
                  </div>
                  <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-700" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /></Button>

                      {[...Array(totalPages)].map((_, i) => {
                          const page = i + 1;
                          if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                              return (
                                  <Button key={page} variant={currentPage === page ? "default" : "ghost"} size="icon" className={cn("h-7 w-7 rounded-lg font-semibold", currentPage === page ? "bg-[#011e4b] text-white hover:bg-[#022a6b] shadow-sm" : "text-slate-600 hover:bg-slate-100")} onClick={() => setCurrentPage(page)}>
                                      {page}
                                  </Button>
                              );
                          } else if (page === currentPage - 2 || page === currentPage + 2) {
                              return <span key={page} className="px-1 text-slate-400"><MoreHorizontal className="h-4 w-4"/></span>;
                          }
                          return null;
                      })}

                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-700" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight className="h-4 w-4" /></Button>
                  </div>
              </div>
          </CardContent>
      </Card>
    </div>
  );
}
