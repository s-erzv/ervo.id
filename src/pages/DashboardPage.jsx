import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RocketIcon, Users, ListOrdered } from 'lucide-react';
import { Loader2, Building2, BarChart, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, subDays, addDays } from 'date-fns'; 
import { startOfMonth, endOfMonth } from 'date-fns'; 
import AdminDashboard from '@/components/dashboards/AdminDashboard';
import UserDashboard from '@/components/dashboards/UserDashboard'; 
import DropshipDashboard from '@/components/dashboards/DropshipDashboard';


// Helper: Ambil tanggal awal 30 hari lalu
const getStartOf30Days = () => {
    return format(subDays(new Date(), 29), 'yyyy-MM-dd');
};
// Helper: Ambil tanggal hari ini
const getTodayDate = () => {
    return format(new Date(), 'yyyy-MM-dd');
};

const simulateStockPrediction = (productsData) => {
    const sellableProducts = (productsData || []).filter(p => p.stock > 0);
    const importantProducts = sellableProducts.slice(0, 5); 
    
    const alerts = [];
    
    importantProducts.forEach((product, index) => {
        const currentStock = Number(product.stock);
        const MIN_STOCK_LEVEL = Math.max(10, Math.floor(currentStock * 0.2) + (index * 2));
        const PREDICTED_DEMAND_7D = Math.max(5, Math.ceil(MIN_STOCK_LEVEL * 1.5) - (index * 5)); 
        
        if (currentStock < MIN_STOCK_LEVEL) {
            const recommendedOrderQty = PREDICTED_DEMAND_7D - currentStock + MIN_STOCK_LEVEL;
            alerts.push({
                product_id: product.id,
                product_name: product.name,
                current_stock: currentStock,
                min_stock_level: MIN_STOCK_LEVEL,
                predicted_demand: PREDICTED_DEMAND_7D,
                recommended_qty: Math.max(10, Math.ceil(recommendedOrderQty / 5) * 5),
            });
        }
    });

    return alerts;
};


const DashboardPage = () => {
  const { session, loading, userProfile, companyId, setActiveCompany } = useAuth(); 
  const [dataLoading, setDataLoading] = useState(true);
  const [companies, setCompanies] = useState([]);
  const [salesData, setSalesData] = useState([]);

  // --- STATE FILTER RENTANG WAKTU UTAMA ---
  const [startDate, setStartDate] = useState(getStartOf30Days()); // Default: 30 hari lalu
  const [endDate, setEndDate] = useState(getTodayDate()); // Default: Hari ini
  // ----------------------------------------

  const [dashboardData, setDashboardData] = useState({
    products: [],
    totalOrdersToday: 0,
    paidOrders: 0,
    unpaidOrders: 0,
    tasksToday: 0,
    dailyProfitData: [], 
    stockAlerts: [],
    monthlySummary: { 
        totalSale: 0, 
        totalCogs: 0, 
        totalGrossProfit: 0, 
        totalOrders: 0 
    },
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!session || !userProfile || loading) return;

      if (userProfile.role === 'super_admin' && !companyId) {
        // Logika Super Admin (Tetap)
        setDataLoading(true);
        const { data: companiesData, error: companiesError } = await supabase.from('companies').select('id, name');
        if (companiesError) {
          console.error('Error fetching companies:', companiesError);
          setCompanies([]);
        } else {
          setCompanies(companiesData || []);
        }

        const { data: sales, error: salesError } = await supabase
          .from('orders')
          .select('company_id, grand_total, created_at')
          .gte('created_at', subDays(new Date(), 30).toISOString());

        if (salesError) {
          console.error('Error fetching sales data:', salesError);
          setSalesData([]);
        } else {
          const allDates = Array.from({ length: 30 }, (_, i) => 
            format(subDays(new Date(), 29 - i), 'yyyy-MM-dd')
          );

          const processedSales = sales.reduce((acc, sale) => {
            const date = format(new Date(sale.created_at), 'yyyy-MM-dd');
            const company = companiesData.find(c => c.id === sale.company_id)?.name || 'Unknown';
            if (!acc[date]) {
              acc[date] = { date: date };
            }
            acc[date][company] = (acc[date][company] || 0) + (sale.grand_total || 0);
            return acc;
          }, {});
          
          const finalSalesData = allDates.map(date => {
            const dateData = processedSales[date] || { date };
            companiesData.forEach(company => {
              if (!dateData[company.name]) {
                dateData[company.name] = 0;
              }
            });
            return dateData;
          });

          setSalesData(finalSalesData);
        }

        setDataLoading(false);
        return;
      }
      
      if (!companyId) return;

      setDataLoading(true);
      try {
        // PASS FILTER RENTANG WAKTU KE FETCHDATA
        await fetchData(userProfile.role, session.user.id, companyId, startDate, endDate);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setDataLoading(false);
      }
    };

    fetchDashboardData();
  }, [session, userProfile, loading, companyId, startDate, endDate]); // DEPENDENCIES DIUBAH


  // FIX: Fungsi fetchData diubah untuk menerima rentang tanggal & menghitung diskon
 const fetchData = async (role, userId, currentCompanyId, sDate, eDate) => {
    try {
      const todayString = getTodayDate();
      
      // Hitung selisih hari untuk Chart Data
      const date1 = new Date(sDate);
      const date2 = new Date(eDate);
      const timeDiff = date2.getTime() - date1.getTime();
      const daysInPeriod = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;

      // FIX CRITICAL: Tambahkan 1 hari ke endDate agar mencakup seluruh hari terakhir
      const endDateObj = new Date(eDate + 'T00:00:00'); 
      const queryEndDate = format(addDays(endDateObj, 1), 'yyyy-MM-dd');

      if (role === 'super_admin' || role === 'admin') {
        const { data: productsData } = await supabase
          .from('products')
          .select('id, purchase_price, name, stock')
          .eq('company_id', currentCompanyId);
        
        const productsMap = (productsData || []).reduce((acc, p) => {
            acc[p.id] = { purchase_price: parseFloat(p.purchase_price) || 0, name: p.name };
            return acc;
        }, {});
        
        // Orders Hari Ini (tetap harian)
        const { data: ordersToday } = await supabase
          .from('orders')
          .select('id, payment_status')
          .eq('company_id', currentCompanyId)
          .eq('planned_date', todayString);


        // --- 1. KPI CARDS (MENGGUNAKAN TANGGAL DIKIRIM - delivered_at) ---
        // FIX KRITIS: Mengubah dasar penghitungan KPI Sales ke delivered_at (realisasi)
        const { data: periodOrders, error: periodOrdersError } = await supabase
            .from('orders')
            .select(`
                id,
                order_items (qty, price, product_id),
                invoices (total_discount)
            `)
            .eq('company_id', currentCompanyId)
            .eq('status', 'completed') // HANYA HITUNG ORDER YANG SELESAI
            .gte('delivered_at', sDate) // GANTI created_at DENGAN delivered_at
            .lt('delivered_at', queryEndDate); // GANTI created_at DENGAN delivered_at

        if (periodOrdersError) {
            console.error('Error fetching period orders for summary:', periodOrdersError);
        }
        
        let totalGrossRevenue = 0; // Penjualan Kotor (sebelum diskon)
        let totalDiscountApplied = 0;
        let totalCogs = 0;
        
        (periodOrders || []).forEach(order => {
            let orderGrossRevenue = 0;
            let orderCogs = 0;
            
            // Hitung Revenue Kotor & COGS
            (order.order_items || []).forEach(item => {
                const sellingPrice = parseFloat(item.price) || 0;
                const quantity = parseInt(item.qty) || 0;
                const purchasePrice = productsMap[item.product_id]?.purchase_price || 0;
                
                orderGrossRevenue += sellingPrice * quantity;
                orderCogs += purchasePrice * quantity;
            });

            // Ambil Diskon
            const invoice = Array.isArray(order.invoices) ? order.invoices[0] : order.invoices;
            const orderDiscount = Number(invoice?.total_discount) || 0; 
            
            // Akumulasi Total
            totalGrossRevenue += orderGrossRevenue;
            totalDiscountApplied += orderDiscount;
            totalCogs += orderCogs;
        });

        // Hitung FINAL KPI
        const totalNetSale = totalGrossRevenue - totalDiscountApplied;
        
        const monthlySummary = {
            totalSale: Math.round(totalNetSale), // NET SALE (HANYA DARI YANG SUDAH DIKIRIM)
            totalCogs: Math.round(totalCogs),
            totalGrossProfit: Math.round(totalNetSale - totalCogs), // FINAL GROSS PROFIT
            totalOrders: (periodOrders || []).length, // HANYA ORDER YANG SUDAH SELESAI
        };
        // ----------------------------------------------------------------------------------
        
        // --- 2. DAILY PROFIT CALCULATION FOR CHART (TIDAK BERUBAH) ---
        const { data: recentOrders } = await supabase
            .from('orders')
            .select(`
                delivered_at, 
                order_items (qty, price, product_id),
                invoices (total_discount)
            `)
            .eq('company_id', currentCompanyId)
            .eq('status', 'completed')
            .gte('delivered_at', sDate) 
            .lt('delivered_at', queryEndDate); 

        const profitByDate = {};
        
        // Loop untuk inisialisasi data harian
        let currentDate = new Date(sDate);
        for (let i = 0; i < daysInPeriod; i++) {
            const dateKey = format(new Date(currentDate), 'yyyy-MM-dd'); 
            profitByDate[dateKey] = { date: dateKey, Revenue: 0, COGS: 0, Profit: 0 };
            currentDate = addDays(currentDate, 1);
        }

        (recentOrders || []).forEach(order => {
            if (!order.delivered_at) return;
            const date = format(new Date(order.delivered_at), 'yyyy-MM-dd');
            if (!profitByDate[date]) return; 
            
            // Ambil Diskon
            const invoice = Array.isArray(order.invoices) ? order.invoices[0] : order.invoices;
            const totalDiscount = Number(invoice?.total_discount) || 0; 
            
            let orderGrossRevenue = 0;
            let orderCogs = 0;
            
            // Hitung Revenue Kotor & COGS
            (order.order_items || []).forEach(item => {
                const sellingPrice = parseFloat(item.price) || 0;
                const quantity = parseInt(item.qty) || 0;
                const purchasePrice = productsMap[item.product_id]?.purchase_price || 0;
                
                orderGrossRevenue += sellingPrice * quantity;
                orderCogs += purchasePrice * quantity;
            });

            // Hitung Net Revenue: Revenue Kotor - Diskon
            const netRevenue = orderGrossRevenue - totalDiscount; 
            
            // Hitung Final Profit: Net Revenue - COGS
            const finalProfit = netRevenue - orderCogs;
            
            profitByDate[date].Revenue += netRevenue; // Revenue yang dicatat adalah NET Revenue
            profitByDate[date].COGS += orderCogs;
            profitByDate[date].Profit += finalProfit;
        });

        const dailyProfitData = Object.values(profitByDate).map(d => ({
            ...d,
            Revenue: Math.round(d.Revenue),
            COGS: Math.round(d.COGS),
            Profit: Math.round(d.Profit),
        }));
        // ------------------------------------------------------------
        
        const stockAlerts = simulateStockPrediction(productsData); 
        const unpaidCount = ordersToday?.filter(o => o.payment_status !== 'paid').length || 0;

        setDashboardData({
            products: productsData || [],
            totalOrdersToday: ordersToday?.length || 0,
            paidOrders: ordersToday?.filter(o => o.payment_status === 'paid').length || 0,
            unpaidOrders: unpaidCount,
            dailyProfitData: dailyProfitData, 
            stockAlerts: stockAlerts,
            monthlySummary: monthlySummary, 
        });
        
      }

      if (role === 'user') {
        const { data: tasks } = await supabase
          .from('orders')
          .select('id')
          .eq('courier_id', userId)
          .eq('company_id', currentCompanyId)
          .eq('planned_date', todayString)
          .neq('status', 'completed');
          
        setDashboardData(prev => ({
          ...prev,
          tasksToday: tasks?.length || 0
        }));
      }

    if (role === 'dropship') {
      // Tambahkan jam agar mencakup seluruh hari terakhir (eDate)
      const queryEndDate = format(addDays(new Date(eDate), 1), 'yyyy-MM-dd');

      const { data: dsOrders, error: dsError } = await supabase
        .from('orders')
        .select(`
          id, 
          status, 
          grand_total, 
          dropshipper_commission, 
          invoice_number,
          delivered_at,
          created_at,
          customers(name)
        `)
        .eq('dropshipper_id', userId)
        .eq('company_id', currentCompanyId)
        // GUNAKAN delivered_at atau planned_date sesuai kebutuhan bisnis
        .gte('created_at', sDate) 
        .lt('created_at', queryEndDate);

      if (dsError) throw dsError;

      // Logic Summary & Stats tetap sama (tapi sekarang datanya sudah terfilter)
      const summary = {
        totalSales: dsOrders.reduce((sum, o) => sum + (Number(o.grand_total) || 0), 0),
        totalCommission: dsOrders.filter(o => o.status === 'completed').reduce((sum, o) => sum + (Number(o.dropshipper_commission) || 0), 0),
        pendingCommission: dsOrders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').reduce((sum, o) => sum + (Number(o.dropshipper_commission) || 0), 0),
        totalOrders: dsOrders.length,
        completedOrders: dsOrders.filter(o => o.status === 'completed').length
      };

      // Stats harian untuk grafik
      const statsMap = {};
      dsOrders.forEach(o => {
        const dateKey = format(new Date(o.created_at), 'dd MMM');
        if (!statsMap[dateKey]) statsMap[dateKey] = { date: dateKey, commission: 0 };
        if (o.status === 'completed') {
          statsMap[dateKey].commission += Number(o.dropshipper_commission) || 0;
        }
      });

      setDashboardData({
        summary,
        dailyStats: Object.values(statsMap),
        recentOrders: dsOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5)
      });
    }
    } catch (error) {
      console.error('Error in fetchData:', error);
      setDashboardData(prev => ({
        ...prev,
        products: [],
        dailyProfitData: [], 
        stockAlerts: [],
        monthlySummary: { totalSale: 0, totalCogs: 0, totalGrossProfit: 0, totalOrders: 0 },
      }));
    }
  };

  const renderDashboardComponent = () => { 
    if (userProfile.role === 'super_admin' && !companyId) { 
        return (
            <div className="container mx-auto p-4 md:p-8 max-w-7xl">
                <h1 className="text-3xl font-bold mb-6 flex items-center gap-3">
                    <Building2 className="h-8 w-8" />
                    Pilih Perusahaan
                </h1>
                
                <Card className="mb-8 border-0 shadow-lg bg-white">
                    <CardHeader className="bg-[#10182b] text-white rounded-t-lg">
                    <CardTitle className="text-xl flex items-center gap-2">
                        <BarChart className="h-6 w-6" /> Tren Penjualan 30 Hari Terakhir
                    </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                    {salesData && salesData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={salesData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            {companies.map((company, index) => (
                            <Line
                                key={company.id}
                                type="monotone"
                                dataKey={company.name}
                                stroke={`hsl(${(index * 137.508) % 360}, 70%, 50%)`}
                                strokeWidth={2}
                            />
                            ))}
                        </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex justify-center items-center h-40 text-muted-foreground">
                        Tidak ada data penjualan untuk ditampilkan.
                        </div>
                    )}
                    </CardContent>
                </Card>
                
                <p className="text-muted-foreground mb-8">
                    Silakan pilih perusahaan yang ingin Anda kelola atau pantau.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {companies.map((company) => (
                    <Card 
                        key={company.id} 
                        className="cursor-pointer hover:shadow-lg transition-shadow duration-200"
                        onClick={() => setActiveCompany(company.id)}
                    >
                        <CardHeader>
                        <CardTitle>{company.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                        <Button variant="outline">Masuk Dashboard</Button>
                        </CardContent>
                    </Card>
                    ))}
                </div>
            </div>
        );
    }

    switch (userProfile.role) {
      case 'super_admin':
      case 'admin':
        return (
            <AdminDashboard 
                profile={userProfile} 
                data={dashboardData} 
                startDate={startDate} 
                setStartDate={setStartDate} 
                endDate={endDate} 
                setEndDate={setEndDate} 
            />
        );
     case 'dropship':
        return <DropshipDashboard profile={userProfile} data={dashboardData} />;
      case 'user':
        return <UserDashboard userId={userProfile.id} />;
      default:
        return (
          <Alert variant="destructive">
            <RocketIcon className="h-4 w-4" />
            <AlertTitle>Akses Dibatasi</AlertTitle>
            <AlertDescription>
              Role Anda tidak dikenali atau tidak memiliki hak akses ke halaman ini.
            </AlertDescription>
          </Alert>
        );
    }
  };

  if (loading || dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!session || !userProfile) {
    return (
      <Alert variant="destructive">
        <RocketIcon className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Gagal memuat sesi atau profil pengguna. Silakan coba login kembali.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      {renderDashboardComponent()} 
    </div>
  );
};

export default DashboardPage;
