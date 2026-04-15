import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RocketIcon, Users, Package, ListOrdered, CheckCircle2, AlertCircle, LayoutDashboard as DashboardIcon, Truck, UserCircle2, DollarSign, BarChart, FileDown, Zap, ShoppingCart, TrendingDown, Loader2, Calculator, Percent } from 'lucide-react'; 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'; 
import UserManagementPage from '@/pages/UserManagementPage'; 
import UserDashboard from '@/components/dashboards/UserDashboard'; 
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
} from "recharts";
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const AdminDashboard = ({ profile, data, startDate, setStartDate, endDate, setEndDate }) => {
  const { companyId } = useAuth();
  const [selectedProductId, setSelectedProductId] = useState(data.products[0]?.id);
  const selectedProduct = data.products.find(p => p.id === selectedProductId);
  const [couriers, setCouriers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);

  const [stockRecommendations, setStockRecommendations] = useState([]); 
  const [loadingRecommendations, setLoadingRecommendations] = useState(true);
  
  const [isMobile, setIsMobile] = useState(false);
  
  // Ambil data bulanan yang baru
  const { totalSale, totalCogs, totalGrossProfit, totalOrders } = data.monthlySummary; 

  // --- HITUNG RATA-RATA PER ORDER ---
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
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

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
  
  const formatRupiah = (tick) => {
    if (tick >= 1000000) return `${(tick / 1000000).toFixed(1)} JT`;
    if (tick >= 1000) return `${(tick / 1000).toFixed(0)} K`;
    return tick;
  };
  
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const formatter = new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        });

        return (
            <div className="bg-white p-4 border border-slate-200 shadow-lg rounded-xl space-y-2">
                <p className="font-medium text-slate-800 border-b border-slate-100 pb-2 mb-2">
                    {format(new Date(label), 'd MMM yyyy')}
                </p>
                {payload.sort((a, b) => b.value - a.value).map((p, index) => (
                    (p.value !== 0 || p.name === 'Gross Profit') && (
                        <div key={index} className="flex justify-between items-center gap-6 text-sm">
                            <span style={{ color: p.color }} className="font-medium">{p.name}</span>
                            <span className="font-semibold text-slate-800">{formatter.format(p.value)}</span>
                        </div>
                    )
                ))}
            </div>
        );
    }
    return null;
  };

  return (
    <div className="space-y-6 container mx-auto md:p-8 max-w-7xl animate-in fade-in slide-in-from-bottom-2"> 
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-semibold text-[#011e4b] tracking-tight">
            Halo, {profile.full_name}! 
          </h2>
          <p className="text-slate-500 font-medium">
            Selamat datang kembali. Berikut adalah ringkasan operasional harian perusahaan Anda.
          </p>
        </div>
      </div>
      
      <div className="mt-4 pt-4 space-y-6">
          
          {/* --- FILTER RENTANG WAKTU BARU --- */}
          <Card className="p-5 border border-slate-200/60 shadow-sm bg-white rounded-2xl">
              <CardTitle className="text-lg font-medium text-[#011e4b] mb-4 flex items-center gap-2">
                  <BarChart className="h-5 w-5 text-[#015a97]" /> Analisis Keuntungan
              </CardTitle>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 items-end">
                  <div className="space-y-2 col-span-2">
                      <Label className="text-sm font-medium text-slate-600">Dari Tanggal</Label>
                      <Input 
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="h-11 text-base border-slate-200 focus-visible:ring-[#015a97]"
                          required
                      />
                  </div>
                  <div className="space-y-2 col-span-2">
                      <Label className="text-sm font-medium text-slate-600">Sampai Tanggal</Label>
                      <Input 
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="h-11 text-base border-slate-200 focus-visible:ring-[#015a97]"
                          required
                      />
                  </div>
              </div>
              <CardDescription className="mt-4 text-sm font-medium text-slate-500">
                  Menampilkan rentang data dari <span className="text-slate-700">{formatDisplayDate(startDate)}</span> hingga <span className="text-slate-700">{formatDisplayDate(endDate)}</span>.
              </CardDescription>
          </Card>


          {/* Grid Layout KPI */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 md:gap-6">
            
            {/* HERO CARD: TOTAL SALE */}
            <Card className="border-0 shadow-md bg-gradient-to-br from-[#011e4b] to-[#00376a] text-white rounded-2xl overflow-hidden relative group">
              <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-105 transition-transform duration-500">
                  <ShoppingCart size={100} />
              </div>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-6 relative z-10">
                <CardTitle className="text-sm font-medium text-[#afcddd] uppercase tracking-wide">Total Sales</CardTitle>
                <ShoppingCart className="h-5 w-5 text-[#afcddd]" />
              </CardHeader>
              <CardContent className="p-6 pt-0 relative z-10">
                <div className="text-3xl font-semibold">{formatRupiah(totalSale)}</div>
                <p className="text-sm text-white/80 mt-1 font-medium">Pendapatan kotor dari barang terjual</p>
              </CardContent>
            </Card>
            
            {/* CARD: TOTAL COGS */}
            <Card className="border border-slate-200/60 shadow-sm bg-white rounded-2xl border-l-4 border-l-rose-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-6">
                <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wide">Total COGS</CardTitle>
                <div className="p-2 bg-rose-50 rounded-lg">
                    <TrendingDown className="h-4 w-4 text-rose-500" />
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="text-3xl font-semibold text-slate-800">{formatRupiah(totalCogs)}</div>
                <p className="text-sm text-slate-500 mt-1 font-medium">Harga Pokok Penjualan</p>
              </CardContent>
            </Card>

            {/* CARD: TOTAL GROSS PROFIT */}
            <Card className="border border-slate-200/60 shadow-sm bg-white rounded-2xl border-l-4 border-l-emerald-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-6">
                <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wide">Gross Profit</CardTitle>
                <div className="p-2 bg-emerald-50 rounded-lg">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="text-3xl font-semibold text-slate-800">{formatRupiah(totalGrossProfit)}</div>
                <p className="text-sm text-slate-500 mt-1 font-medium">Keuntungan kotor berjalan</p>
              </CardContent>
            </Card>

            {/* CARD: TOTAL ORDER */}
            <Card className="border border-slate-200/60 shadow-sm bg-white rounded-2xl border-l-4 border-l-slate-400">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-6">
                <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wide">Order Selesai</CardTitle>
                <div className="p-2 bg-slate-50 rounded-lg">
                    <ListOrdered className="h-4 w-4 text-slate-500" />
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="text-3xl font-semibold text-slate-800">{totalOrders}</div>
                <p className="text-sm text-slate-500 mt-1 font-medium">Order terselesaikan pada periode ini</p>
              </CardContent>
            </Card>

            {/* CARD: RATA-RATA SALES / ORDER */}
            <Card className="border border-slate-200/60 shadow-sm bg-white rounded-2xl border-l-4 border-l-[#015a97]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-6">
                <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wide">Rata-rata Sales / Order</CardTitle>
                <div className="p-2 bg-[#015a97]/10 rounded-lg">
                    <Calculator className="h-4 w-4 text-[#015a97]" />
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="text-3xl font-semibold text-slate-800">{formatRupiah(avgSalesPerOrder)}</div>
                <p className="text-sm text-slate-500 mt-1 font-medium">Sales per order selesai</p>
              </CardContent>
            </Card>

            {/* CARD: RATA-RATA PROFIT / ORDER */}
            <Card className="border border-slate-200/60 shadow-sm bg-white rounded-2xl border-l-4 border-l-teal-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-6">
                <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wide">Rata-rata Profit / Order</CardTitle>
                <div className="p-2 bg-teal-50 rounded-lg">
                    <Percent className="h-4 w-4 text-teal-600" />
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="text-3xl font-semibold text-slate-800">{formatRupiah(avgProfitPerOrder)}</div>
                <p className="text-sm text-slate-500 mt-1 font-medium">Profit per order selesai</p>
              </CardContent>
            </Card>
            
            {/* --- GRAFIK ANALISIS KEUNTUNGAN --- */}
            {!isMobile && (
              <Card className="border border-slate-200/60 shadow-sm bg-white rounded-2xl col-span-full overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-lg font-medium text-[#011e4b] flex items-center gap-2">
                            <BarChart className="h-5 w-5 text-[#015a97]" /> Analisis Keuntungan
                        </CardTitle>
                        <CardDescription className="font-medium text-slate-500">
                            {formatDisplayDate(startDate)} - {formatDisplayDate(endDate)}
                        </CardDescription>
                    </div>
                    <Button 
                        onClick={handleExportProfit} 
                        className="mt-4 sm:mt-0 flex items-center gap-2 w-full sm:w-auto bg-[#011e4b] text-white hover:bg-[#00376a] font-medium rounded-lg"
                        disabled={!data.dailyProfitData || data.dailyProfitData.length === 0}
                    >
                        <FileDown className="h-4 w-4" /> Export Excel
                    </Button>
                </CardHeader>
                <CardContent className="h-[380px] p-6">
                    {data.dailyProfitData && data.dailyProfitData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                                data={data.dailyProfitData}
                                margin={{ top: 20, right: 10, left: 0, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis 
                                    dataKey="date" 
                                    tickFormatter={(dateStr) => format(new Date(dateStr), 'd MMM')} 
                                    tick={{ fill: '#64748B', fontSize: 12 }}
                                    tickLine={false}
                                    axisLine={false}
                                    dy={10}
                                /> 
                                <YAxis 
                                    yAxisId="left"
                                    tick={{ fill: '#64748B', fontSize: 12 }}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={formatRupiah} 
                                    width={60}
                                /> 
                                <YAxis 
                                    yAxisId="right"
                                    orientation="right" 
                                    tick={{ fill: '#64748B', fontSize: 12 }}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={formatRupiah} 
                                    width={60}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F1F5F9' }} />
                                <Legend 
                                    wrapperStyle={{ paddingTop: '20px', fontSize: '13px', fontWeight: 500 }}
                                    iconType="circle"
                                />
                                
                                <Bar yAxisId="left" dataKey="Revenue" name="Total Sales" fill="#011e4b" radius={[4, 4, 0, 0]} barSize={12} />
                                <Bar yAxisId="left" dataKey="COGS" name="Total COGS" fill="#F43F5E" radius={[4, 4, 0, 0]} barSize={12} />
                                <Line 
                                    yAxisId="right" 
                                    type="monotone" 
                                    dataKey="Profit" 
                                    name="Gross Profit" 
                                    stroke="#10B981" 
                                    strokeWidth={3} 
                                    dot={{ r: 3, fill: '#10B981', strokeWidth: 0 }} 
                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                            <BarChart className="h-12 w-12 mb-3 text-slate-300" />
                            <p className="font-medium text-slate-600">Tidak ada data penjualan yang selesai.</p>
                            <p className="text-sm mt-1 text-center max-w-sm">Pastikan ada order dengan status 'Completed' yang memiliki item dan dikirim pada rentang waktu ini.</p>
                        </div>
                    )}
                </CardContent>
              </Card>
            )} 
          </div> 
      </div>
    </div>
  );
};

export default AdminDashboard;