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
            <div className="bg-white p-3 border shadow-lg text-sm rounded-md space-y-1">
                <p className="font-bold text-[#10182b]">{format(new Date(label), 'd MMM yyyy')}</p>
                {payload.sort((a, b) => b.value - a.value).map((p, index) => (
                    (p.value !== 0 || p.name === 'Gross Profit') && (
                        <p key={index} style={{ color: p.color }}>
                            {p.name}: <strong>{formatter.format(p.value)}</strong>
                        </p>
                    )
                ))}
            </div>
        );
    }
    return null;
  };

  return (
    <div className="space-y-6 container mx-auto md:p-8 max-w-7xl"> 
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight">
            Halo, {profile.full_name}! 
          </h2>
          <p className="text-muted-foreground text-sm">
            Selamat datang kembali. Berikut adalah ringkasan operasional harian perusahaan Anda.
          </p>
        </div>
      </div>
      
      <div className="mt-4 pt-4 space-y-6">
          
          {/* --- FILTER RENTANG WAKTU BARU --- */}
          <Card className="p-4 border-0 shadow-sm bg-gray-50">
              <CardTitle className="text-base mb-3 flex items-center gap-2">
                  <BarChart className="h-4 w-4" /> Analisis Keuntungan
              </CardTitle>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="space-y-1 col-span-2">
                      <Label className="text-xs">Dari Tanggal</Label>
                      <Input 
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="h-9 text-sm"
                          required
                      />
                  </div>
                  <div className="space-y-1 col-span-2">
                      <Label className="text-xs">Sampai Tanggal</Label>
                      <Input 
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="h-9 text-sm"
                          required
                      />
                  </div>
              </div>
              <CardDescription className="mt-3 text-xs">
                  Ringkasan di bawah ini menampilkan data dari {formatDisplayDate(startDate)} hingga {formatDisplayDate(endDate)}.
              </CardDescription>
          </Card>
          {/* --- END FILTER RENTANG WAKTU BARU --- */}


          {/* Grid Layout: Diubah ke lg:grid-cols-3 agar 6 kartu pas */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 md:gap-6">
            
            {/* CARD 1: TOTAL SALE (Revenue) */}
            <Card className="hover:shadow-lg transition-shadow duration-300 bg-[#10182b] text-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                <CardTitle className="text-sm font-medium">Total Sales </CardTitle>
                <ShoppingCart className="h-4 w-4 text-white/80" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{formatRupiah(totalSale)}</div>
                <p className="text-xs text-white/80">Pendapatan kotor dari barang terjual</p>
              </CardContent>
            </Card>
            
            {/* CARD 2: TOTAL COGS */}
            <Card className="hover:shadow-lg transition-shadow duration-300 bg-red-600 text-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                <CardTitle className="text-sm font-medium">Total COGS </CardTitle>
                <TrendingDown className="h-4 w-4 text-white/80" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{formatRupiah(totalCogs)}</div>
                <p className="text-xs text-white/80">Harga Pokok Penjualan</p>
              </CardContent>
            </Card>

            {/* CARD 3: TOTAL GROSS PROFIT */}
            <Card className="hover:shadow-lg transition-shadow duration-300 bg-green-600 text-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                <CardTitle className="text-sm font-medium">Gross Profit </CardTitle>
                <DollarSign className="h-4 w-4 text-white/80" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{formatRupiah(totalGrossProfit)}</div>
                <p className="text-xs text-white/80">Keuntungan Kotor </p>
              </CardContent>
            </Card>

            {/* CARD 4: TOTAL ORDER */}
            <Card className="hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                <CardTitle className="text-sm font-medium">Total Order Selesai </CardTitle>
                <ListOrdered className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{totalOrders}</div>
                <p className="text-xs text-muted-foreground">Order selesai dalam periode ini</p>
              </CardContent>
            </Card>

            {/* CARD 5 (NEW): RATA-RATA SALES / ORDER */}
            <Card className="hover:shadow-lg transition-shadow duration-300 bg-cyan-600 text-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                <CardTitle className="text-sm font-medium">Rata-rata Sales / Order</CardTitle>
                <Calculator className="h-4 w-4 text-white/80" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{formatRupiah(avgSalesPerOrder)}</div>
                <p className="text-xs text-white/80">Per order selesai</p>
              </CardContent>
            </Card>

            {/* CARD 6 (NEW): RATA-RATA PROFIT / ORDER */}
            <Card className="hover:shadow-lg transition-shadow duration-300 bg-emerald-600 text-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                <CardTitle className="text-sm font-medium">Rata-rata Profit / Order</CardTitle>
                <Percent className="h-4 w-4 text-white/80" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="text-2xl font-bold">{formatRupiah(avgProfitPerOrder)}</div>
                <p className="text-xs text-white/80">Per order selesai</p>
              </CardContent>
            </Card>
            
            {/* --- GRAFIK ANALISIS KEUNTUNGAN --- */}
            {!isMobile && (
              <Card className="hover:shadow-lg transition-shadow duration-300 col-span-full">
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4">
                    <div className="space-y-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <BarChart className="h-5 w-5" /> Analisis Keuntungan ({formatDisplayDate(startDate)} - {formatDisplayDate(endDate)})
                        </CardTitle>
                    </div>
                    <Button 
                        onClick={handleExportProfit} 
                        className="mt-3 sm:mt-0 flex items-center gap-2 w-full sm:w-auto bg-[#10182b] text-white hover:bg-[#10182b]/90"
                        disabled={!data.dailyProfitData || data.dailyProfitData.length === 0}
                    >
                        <FileDown className="h-4 w-4" /> Export Excel
                    </Button>
                </CardHeader>
                <CardContent className="h-[350px] p-4">
                    {data.dailyProfitData && data.dailyProfitData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                                data={data.dailyProfitData}
                                margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis 
                                    dataKey="date" 
                                    tickFormatter={(dateStr) => format(new Date(dateStr), 'd/MM')} 
                                    style={{ fontSize: '10px' }} 
                                /> 
                                <YAxis 
                                    yAxisId="left"
                                    stroke="#10182b"
                                    tickFormatter={formatRupiah} 
                                    style={{ fontSize: '10px' }} 
                                    width={60}
                                /> 
                                <YAxis 
                                    yAxisId="right"
                                    orientation="right" 
                                    stroke="#22c55e"
                                    tickFormatter={formatRupiah} 
                                    style={{ fontSize: '10px' }} 
                                    width={60}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '12px' }} />
                                
                                <Bar yAxisId="left" dataKey="Revenue" name="Total Sales" fill="#10182b" barSize={10} />
                                <Bar yAxisId="left" dataKey="COGS" name="Total COGS" fill="#ef4444" barSize={10} />
                                <Line 
                                    yAxisId="right" 
                                    type="monotone" 
                                    dataKey="Profit" 
                                    name="Gross Profit" 
                                    stroke="#22c55e" 
                                    strokeWidth={2} 
                                    dot={false} 
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <BarChart className="h-10 w-10 mb-2" />
                            <p>Tidak ada data penjualan yang selesai dalam periode ini.</p>
                            <p className='text-xs'>Pastikan ada order dengan status 'Completed' yang memiliki item dan delivered_at di rentang waktu tersebut.</p>
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