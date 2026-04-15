import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RocketIcon, Users, ListOrdered, ArrowRight } from 'lucide-react';
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

// Curated professional color palette for the chart
const CHART_COLORS = [
    '#015a97', // Primary Blue
    '#0EA5E9', // Sky Blue
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#8B5CF6', // Violet
    '#F43F5E', // Rose
    '#64748B', // Slate
];

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
        setDataLoading(true);
        
        // 1. Ambil daftar tenant
        const { data: companiesData, error: companiesError } = await supabase.from('companies').select('id, name');
        if (companiesError) {
          console.error('Error fetching companies:', companiesError);
          setCompanies([]);
        } else {
          setCompanies(companiesData || []);
        }

        // 2. LOGIKA BARU: Ambil data pendapatan dari subscription_payments yang sudah di-ACC
        const { data: payments, error: paymentsError } = await supabase
          .from('subscription_payments')
          .select('company_id, amount, approved_at')
          .eq('status', 'approved') // Hanya ambil yang sudah disetujui admin
          .gte('approved_at', subDays(new Date(), 30).toISOString());

        if (paymentsError) {
          console.error('Error fetching subscription revenue:', paymentsError);
          setSalesData([]);
        } else {
          const allDates = Array.from({ length: 30 }, (_, i) => 
            format(subDays(new Date(), 29 - i), 'yyyy-MM-dd')
          );

          const processedRevenue = payments.reduce((acc, payment) => {
            if (!payment.approved_at) return acc;
            
            const date = format(new Date(payment.approved_at), 'yyyy-MM-dd');
            const company = companiesData?.find(c => c.id === payment.company_id)?.name || 'Unknown';
            
            if (!acc[date]) {
              acc[date] = { date: date };
            }
            // Tambahkan nominal subscription ke array perusahaan di tanggal tersebut
            acc[date][company] = (acc[date][company] || 0) + (Number(payment.amount) || 0);
            return acc;
          }, {});
          
          const finalRevenueData = allDates.map(date => {
            const dateData = processedRevenue[date] || { date };
            companiesData?.forEach(company => {
              if (!dateData[company.name]) {
                dateData[company.name] = 0;
              }
            });
            return dateData;
          });

          setSalesData(finalRevenueData);
        }

        setDataLoading(false);
        return;
      }
      
      if (!companyId) return;

      setDataLoading(true);
      try {
        await fetchData(userProfile.role, session.user.id, companyId, startDate, endDate);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setDataLoading(false);
      }
    };

    fetchDashboardData();
  }, [session, userProfile, loading, companyId, startDate, endDate]); 

 const fetchData = async (role, userId, currentCompanyId, sDate, eDate) => {
    try {
      const todayString = getTodayDate();
      
      const date1 = new Date(sDate);
      const date2 = new Date(eDate);
      const timeDiff = date2.getTime() - date1.getTime();
      const daysInPeriod = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;

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
        
        const { data: ordersToday } = await supabase
          .from('orders')
          .select('id, payment_status')
          .eq('company_id', currentCompanyId)
          .eq('planned_date', todayString);

        const { data: periodOrders, error: periodOrdersError } = await supabase
            .from('orders')
            .select(`
                id,
                order_items (qty, price, product_id),
                invoices (total_discount)
            `)
            .eq('company_id', currentCompanyId)
            .eq('status', 'completed') 
            .gte('delivered_at', sDate) 
            .lt('delivered_at', queryEndDate); 

        if (periodOrdersError) {
            console.error('Error fetching period orders for summary:', periodOrdersError);
        }
        
        let totalGrossRevenue = 0; 
        let totalDiscountApplied = 0;
        let totalCogs = 0;
        
        (periodOrders || []).forEach(order => {
            let orderGrossRevenue = 0;
            let orderCogs = 0;
            
            (order.order_items || []).forEach(item => {
                const sellingPrice = parseFloat(item.price) || 0;
                const quantity = parseInt(item.qty) || 0;
                const purchasePrice = productsMap[item.product_id]?.purchase_price || 0;
                
                orderGrossRevenue += sellingPrice * quantity;
                orderCogs += purchasePrice * quantity;
            });

            const invoice = Array.isArray(order.invoices) ? order.invoices[0] : order.invoices;
            const orderDiscount = Number(invoice?.total_discount) || 0; 
            
            totalGrossRevenue += orderGrossRevenue;
            totalDiscountApplied += orderDiscount;
            totalCogs += orderCogs;
        });

        const totalNetSale = totalGrossRevenue - totalDiscountApplied;
        
        const monthlySummary = {
            totalSale: Math.round(totalNetSale), 
            totalCogs: Math.round(totalCogs),
            totalGrossProfit: Math.round(totalNetSale - totalCogs), 
            totalOrders: (periodOrders || []).length, 
        };
        
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
            
            const invoice = Array.isArray(order.invoices) ? order.invoices[0] : order.invoices;
            const totalDiscount = Number(invoice?.total_discount) || 0; 
            
            let orderGrossRevenue = 0;
            let orderCogs = 0;
            
            (order.order_items || []).forEach(item => {
                const sellingPrice = parseFloat(item.price) || 0;
                const quantity = parseInt(item.qty) || 0;
                const purchasePrice = productsMap[item.product_id]?.purchase_price || 0;
                
                orderGrossRevenue += sellingPrice * quantity;
                orderCogs += purchasePrice * quantity;
            });

            const netRevenue = orderGrossRevenue - totalDiscount; 
            const finalProfit = netRevenue - orderCogs;
            
            profitByDate[date].Revenue += netRevenue; 
            profitByDate[date].COGS += orderCogs;
            profitByDate[date].Profit += finalProfit;
        });

        const dailyProfitData = Object.values(profitByDate).map(d => ({
            ...d,
            Revenue: Math.round(d.Revenue),
            COGS: Math.round(d.COGS),
            Profit: Math.round(d.Profit),
        }));
        
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
            .gte('created_at', sDate) 
            .lt('created_at', queryEndDate);

        if (dsError) throw dsError;

        const summary = {
            totalSales: dsOrders.reduce((sum, o) => sum + (Number(o.grand_total) || 0), 0),
            totalCommission: dsOrders.filter(o => o.status === 'completed').reduce((sum, o) => sum + (Number(o.dropshipper_commission) || 0), 0),
            pendingCommission: dsOrders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').reduce((sum, o) => sum + (Number(o.dropshipper_commission) || 0), 0),
            totalOrders: dsOrders.length,
            completedOrders: dsOrders.filter(o => o.status === 'completed').length
        };

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
            <div className="container mx-auto p-4 md:p-8 max-w-7xl animate-in fade-in slide-in-from-bottom-2">
                
                {/* Header Section */}
                <div className="mb-10">
                    <h1 className="text-3xl font-medium text-[#011e4b] flex items-center gap-3">
                        <Building2 className="h-8 w-8 text-[#015a97]" />
                        Pilih Perusahaan
                    </h1>
                    <p className="text-slate-500 mt-2 font-medium">
                        Pantau metrik dan kelola operasional tenant secara spesifik.
                    </p>
                </div>
                
                {/* Chart Section */}
                <Card className="mb-12 border border-slate-200/60 shadow-sm bg-white rounded-2xl overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
                        <CardTitle className="text-lg font-medium text-[#011e4b] flex items-center gap-2">
                            <BarChart className="h-5 w-5 text-[#015a97]" /> Tren Pendapatan Langganan (30 Hari Terakhir)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        {salesData && salesData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={320}>
                                <LineChart data={salesData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                    <XAxis 
                                        dataKey="date" 
                                        tick={{ fill: '#64748B', fontSize: 12 }}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(val) => format(new Date(val), 'dd MMM')}
                                        dy={10}
                                    />
                                    <YAxis 
                                      tick={{ fill: '#64748B', fontSize: 12 }}
                                      tickLine={false}
                                      axisLine={false}
                                      tickFormatter={(val) => `Rp ${(val / 1000000).toFixed(1)} Jt`}
                                      dx={-10}
                                  />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend 
                                        iconType="circle" 
                                        wrapperStyle={{ paddingTop: '20px', fontSize: '14px', fontWeight: 500 }}
                                    />
                                    {companies.map((company, index) => (
                                        <Line
                                            key={company.id}
                                            type="monotone"
                                            dataKey={company.name}
                                            stroke={CHART_COLORS[index % CHART_COLORS.length]}
                                            strokeWidth={3}
                                            dot={{ r: 0 }}
                                            activeDot={{ r: 6, strokeWidth: 0 }}
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex justify-center items-center h-48 text-slate-400 font-medium bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                Belum ada data pendapatan langganan untuk ditampilkan.
                            </div>
                        )}
                    </CardContent>
                </Card>
                
                {/* Company Selection Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {companies.map((company) => (
                    <Card 
                        key={company.id} 
                        className="group cursor-pointer border border-slate-200/60 shadow-sm hover:shadow-md hover:border-[#015a97]/30 transition-all duration-300 rounded-2xl bg-white"
                        onClick={() => setActiveCompany(company.id)}
                    >
                        <CardHeader className="p-6 pb-2">
                            <CardTitle className="text-xl font-medium text-slate-800 group-hover:text-[#011e4b] transition-colors">
                                {company.name}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 pt-4 flex justify-between items-center border-t border-slate-50 mt-2">
                            <span className="text-sm text-slate-500 font-medium">Ketuk untuk masuk</span>
                            <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-[#015a97] group-hover:text-white text-slate-400 transition-colors">
                                <ArrowRight className="h-4 w-4" />
                            </div>
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
          <Alert variant="destructive" className="max-w-md mx-auto mt-10 rounded-xl">
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!session || !userProfile) {
    return (
      <Alert variant="destructive" className="max-w-md mx-auto mt-10 rounded-xl">
        <RocketIcon className="h-4 w-4" />
        <AlertTitle>Autentikasi Gagal</AlertTitle>
        <AlertDescription>
          Gagal memuat sesi atau profil pengguna. Silakan coba login kembali.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="w-full bg-slate-50/30 min-h-screen">
      {renderDashboardComponent()} 
    </div>
  );
};

export default DashboardPage;