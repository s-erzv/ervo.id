import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ShoppingCart, TrendingDown, DollarSign, ListOrdered, 
  Calculator, Percent, BarChart, FileDown, Package, AlertTriangle, Activity, CheckCircle2
} from 'lucide-react'; 
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Bar,
  Area 
} from "recharts";
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const AdminDashboard = ({ profile, data, startDate, setStartDate, endDate, setEndDate }) => {
  const { companyId } = useAuth();
  
  // States bawaan asli
  const [selectedProductId, setSelectedProductId] = useState(data?.products?.[0]?.id);
  const selectedProduct = data?.products?.find(p => p.id === selectedProductId);
  const [couriers, setCouriers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);

  // States untuk rekomendasi stok asli
  const [stockRecommendations, setStockRecommendations] = useState([]); 
  const [loadingRecommendations, setLoadingRecommendations] = useState(true);
  
  const [isMobile, setIsMobile] = useState(false);
  
  // Ambil data bulanan asli
  const { totalSale = 0, totalCogs = 0, totalGrossProfit = 0, totalOrders = 0 } = data?.monthlySummary || {}; 

  // Kalkulasi asli
  const avgSalesPerOrder = totalOrders > 0 ? totalSale / totalOrders : 0;
  const avgProfitPerOrder = totalOrders > 0 ? totalGrossProfit / totalOrders : 0;

  // Format ulang tanggal untuk tampilan UI
  const formatDisplayDate = (dateString) => {
    try {
        if (!dateString) return 'N/A';
        return format(new Date(dateString), 'd MMM yyyy');
    } catch (e) {
        return 'Invalid Date';
    }
  };

  // Logic Fetch asli (TIDAK ADA YANG DIHAPUS)
  const fetchStockRecommendations = async () => {
    if (!companyId) return;
    setLoadingRecommendations(true);
    try {
        const { data, error } = await supabase
            .from('stock_recommendations_view')
            .select('*')
            .or('recommendation_status.eq.KURANG,recommendation_status.eq.SANGAT KURANG'); 

        if (error) throw error;
        
        setStockRecommendations(data || []);
    } catch (error) {
        console.error("Error fetching stock recommendations:", error);
        toast.error("Gagal memuat rekomendasi stok.");
        setStockRecommendations([]);
    } finally {
        setLoadingRecommendations(false);
    }
  };
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      handleResize(); 
    }
    
    const fetchCouriers = async () => {
      if (companyId) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('company_id', companyId)
          .eq('role', 'user');
        
        if (error) {
          console.error("Error fetching couriers:", error);
        } else {
          setCouriers(data);
        }
      }
    };
    
    fetchCouriers();
    fetchStockRecommendations();

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, [companyId]);

  // Logic Export Excel Asli
  const handleExportProfit = () => {
    if (!data.dailyProfitData || data.dailyProfitData.length === 0) {
        toast.error(`Tidak ada data keuntungan untuk diekspor pada periode ini.`);
        return;
    }

    const exportData = data.dailyProfitData.map(d => ({
        Tanggal: d.date,
        'Pendapatan (Sale)': d.Revenue,
        'HPP (COGS)': d.COGS,
        'Keuntungan Bersih': d.Profit,
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Keuntungan Harian");
    
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    
    saveAs(blob, `Laporan_Keuntungan_${startDate}_sd_${endDate}.xlsx`);
    
    toast.success("Laporan keuntungan berhasil diekspor!");
  };
  
  // Format Utility Asli
  const formatRupiah = (tick) => {
    if (tick >= 1000000) return `${(tick / 1000000).toFixed(1)} JT`;
    if (tick >= 1000) return `${(tick / 1000).toFixed(0)} K`;
    return tick;
  };
  
  // Custom Tooltip Asli + Styling Premium
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const formatter = new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        });

        return (
            <div className="bg-white p-4 border border-slate-200 shadow-xl rounded-xl space-y-2 min-w-[200px]">
                <p className="font-semibold text-slate-800 border-b border-slate-100 pb-2 mb-3">
                    {format(new Date(label), 'd MMMM yyyy')}
                </p>
                {payload.sort((a, b) => b.value - a.value).map((p, index) => (
                    (p.value !== 0 || p.name === 'Gross Profit') && (
                        <div key={index} className="flex justify-between items-center gap-6 text-sm">
                            <div className="flex items-center gap-2">
                               <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }}></div>
                               <span className="text-slate-600 font-medium">{p.name}</span>
                            </div>
                            <span className="font-semibold text-slate-900">{formatter.format(p.value)}</span>
                        </div>
                    )
                ))}
            </div>
        );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 space-y-6 animate-in fade-in slide-in-from-bottom-2"> 
      
      {/* Header & Date Filter Section - Layout Premium */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            Halo, {profile?.full_name}! 👋
          </h2>
          <p className="text-slate-500 font-medium">
            Ringkasan operasional bisnis Anda dari <span className="text-slate-800">{formatDisplayDate(startDate)}</span> hingga <span className="text-slate-800">{formatDisplayDate(endDate)}</span>.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            <div className="flex items-center bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                <div className="flex flex-col px-2">
                    <Label className="text-[10px] uppercase font-bold text-slate-500 mb-1">Mulai</Label>
                    <Input 
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="h-8 border-0 bg-transparent p-0 text-sm focus-visible:ring-0 shadow-none w-[120px] font-medium"
                    />
                </div>
                <div className="w-px h-8 bg-slate-200 mx-2"></div>
                <div className="flex flex-col px-2">
                    <Label className="text-[10px] uppercase font-bold text-slate-500 mb-1">Akhir</Label>
                    <Input 
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="h-8 border-0 bg-transparent p-0 text-sm focus-visible:ring-0 shadow-none w-[120px] font-medium"
                    />
                </div>
            </div>
            <Button 
                onClick={handleExportProfit} 
                className="h-[52px] px-6 bg-slate-900 text-white hover:bg-slate-800 font-medium rounded-lg shadow-sm transition-all flex items-center gap-2"
                disabled={!data.dailyProfitData || data.dailyProfitData.length === 0}
            >
                <FileDown className="h-4 w-4" /> Export Excel
            </Button>
        </div>
      </div>

      {/* Grid Layout KPI - Desain Bersih & Elegan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        
        <Card className="border border-slate-200/60 shadow-sm bg-white rounded-2xl overflow-hidden hover:shadow-md transition-all group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-6">
            <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total Sales</CardTitle>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <ShoppingCart className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="text-3xl font-bold text-slate-900">{formatRupiah(totalSale)}</div>
            <p className="text-sm text-slate-500 mt-2 font-medium flex items-center gap-1">
                Pendapatan kotor
            </p>
          </CardContent>
        </Card>
        
        <Card className="border border-slate-200/60 shadow-sm bg-white rounded-2xl overflow-hidden hover:shadow-md transition-all group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-6">
            <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total COGS</CardTitle>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg group-hover:bg-rose-600 group-hover:text-white transition-colors">
                <TrendingDown className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="text-3xl font-bold text-slate-900">{formatRupiah(totalCogs)}</div>
            <p className="text-sm text-slate-500 mt-2 font-medium">Harga Pokok Penjualan</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/60 shadow-sm bg-white rounded-2xl overflow-hidden hover:shadow-md transition-all group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-6">
            <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Gross Profit</CardTitle>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <DollarSign className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="text-3xl font-bold text-slate-900">{formatRupiah(totalGrossProfit)}</div>
            <p className="text-sm text-emerald-600 mt-2 font-medium flex items-center gap-1">
                <Activity className="h-3 w-3" /> Keuntungan kotor
            </p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/60 shadow-sm bg-white rounded-2xl overflow-hidden hover:shadow-md transition-all group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-6">
            <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Order Selesai</CardTitle>
            <div className="p-2 bg-slate-100 text-slate-600 rounded-lg group-hover:bg-slate-800 group-hover:text-white transition-colors">
                <ListOrdered className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="text-3xl font-bold text-slate-900">{totalOrders}</div>
            <p className="text-sm text-slate-500 mt-2 font-medium">Transaksi berhasil</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/60 shadow-sm bg-white rounded-2xl overflow-hidden hover:shadow-md transition-all group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-6">
            <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Avg Sales / Order</CardTitle>
            <div className="p-2 bg-cyan-50 text-cyan-600 rounded-lg group-hover:bg-cyan-600 group-hover:text-white transition-colors">
                <Calculator className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="text-3xl font-bold text-slate-900">{formatRupiah(avgSalesPerOrder)}</div>
            <p className="text-sm text-slate-500 mt-2 font-medium">Rata-rata pendapatan</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/60 shadow-sm bg-white rounded-2xl overflow-hidden hover:shadow-md transition-all group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-6">
            <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Avg Profit / Order</CardTitle>
            <div className="p-2 bg-teal-50 text-teal-600 rounded-lg group-hover:bg-teal-600 group-hover:text-white transition-colors">
                <Percent className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div className="text-3xl font-bold text-slate-900">{formatRupiah(avgProfitPerOrder)}</div>
            <p className="text-sm text-slate-500 mt-2 font-medium">Rata-rata profit</p>
          </CardContent>
        </Card>
      </div> 

      {/* Main Analysis Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* GRAFIK ANALISIS KEUNTUNGAN */}
        <Card className="xl:col-span-2 border border-slate-200/60 shadow-sm bg-white rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-slate-100 p-6">
                <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <BarChart className="h-5 w-5 text-blue-600" /> Grafik Penjualan & Profit
                </CardTitle>
                <CardDescription className="font-medium text-slate-500">
                    Tren harian dari {formatDisplayDate(startDate)} hingga {formatDisplayDate(endDate)}
                </CardDescription>
            </CardHeader>
            <CardContent className="h-[400px] p-6">
                {data.dailyProfitData && data.dailyProfitData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                            data={data.dailyProfitData}
                            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                        >
                            <defs>
                                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                                dataKey="date" 
                                tickFormatter={(dateStr) => format(new Date(dateStr), 'd MMM')} 
                                tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }}
                                tickLine={false}
                                axisLine={false}
                                dy={10}
                            /> 
                            <YAxis 
                                yAxisId="left"
                                tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={formatRupiah} 
                                width={60}
                            /> 
                            <YAxis 
                                yAxisId="right"
                                orientation="right" 
                                tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={formatRupiah} 
                                width={60}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                            <Legend 
                                wrapperStyle={{ paddingTop: '20px', fontSize: '13px', fontWeight: 600, color: '#475569' }}
                                iconType="circle"
                            />
                            
                            <Area yAxisId="left" type="monotone" dataKey="Revenue" name="Total Sales" fill="url(#colorSales)" stroke="#3b82f6" strokeWidth={2} />
                            <Bar yAxisId="left" dataKey="COGS" name="Total COGS" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={16} />
                            <Line 
                                yAxisId="right" 
                                type="monotone" 
                                dataKey="Profit" 
                                name="Gross Profit" 
                                stroke="#10b981" 
                                strokeWidth={3} 
                                dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} 
                                activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                        <BarChart className="h-12 w-12 mb-3 text-slate-300" />
                        <p className="font-semibold text-slate-700">Belum ada data penjualan.</p>
                        <p className="text-sm mt-1 text-center max-w-sm text-slate-500">Pastikan ada order dengan status 'Completed' pada rentang waktu yang dipilih.</p>
                    </div>
                )}
            </CardContent>
        </Card>

        {/* REKOMENDASI STOK (Menggunakan Logic Asli) */}
        <Card className="border border-slate-200/60 shadow-sm bg-white rounded-2xl overflow-hidden flex flex-col">
            <CardHeader className="border-b border-slate-100 p-6 bg-slate-50/50">
                <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Package className="h-5 w-5 text-amber-500" /> Peringatan Stok
                </CardTitle>
                <CardDescription className="font-medium text-slate-500">
                    Produk yang memerlukan restock segera.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-auto">
                {loadingRecommendations ? (
                    <div className="p-6 flex justify-center items-center h-full text-slate-400">
                        <Activity className="h-6 w-6 animate-pulse" />
                    </div>
                ) : stockRecommendations.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                        {stockRecommendations.map((item, idx) => (
                            <div key={idx} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center">
                                <div>
                                    <p className="font-semibold text-slate-800 text-sm">{item.product_name || 'Produk'}</p>
                                    <p className="text-xs font-medium text-slate-500 mt-0.5">Stok saat ini: <span className="text-slate-900 font-bold">{item.current_stock || 0}</span></p>
                                </div>
                                <Badge 
                                    variant={item.recommendation_status === 'SANGAT KURANG' ? 'destructive' : 'outline'}
                                    className={item.recommendation_status === 'KURANG' ? 'text-amber-600 border-amber-200 bg-amber-50' : ''}
                                >
                                    {item.recommendation_status}
                                </Badge>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-8 flex flex-col items-center justify-center h-full text-center space-y-3">
                        <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center">
                            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                        </div>
                        <div>
                            <p className="font-semibold text-slate-800 text-sm">Semua Stok Aman</p>
                            <p className="text-xs text-slate-500 mt-1">Tidak ada produk yang perlu restock saat ini.</p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default AdminDashboard;