// src/pages/CalendarPage.jsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Truck } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths } from 'date-fns';
import { id } from 'date-fns/locale';
import { toast } from 'react-hot-toast';

const getStatusColor = (status, isActualDelivery) => {
  if (isActualDelivery) return 'bg-blue-600 text-white font-semibold'; // Warna khusus buat yg beneran tgl kirim
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'sent':
      return 'bg-yellow-100 text-yellow-800';
    case 'draft':
      return 'bg-gray-200 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const CalendarPage = () => {
  const { companyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [ordersByDate, setOrdersByDate] = useState({});

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  });

  useEffect(() => {
    if (companyId) {
      fetchOrders(currentDate);
    }
  }, [companyId, currentDate]);

  const fetchOrders = async (date) => {
    setLoading(true);
    const startDate = startOfMonth(date);
    const endDate = endOfMonth(date);
    const startStr = format(startDate, 'yyyy-MM-dd');
    const endStr = format(endDate, 'yyyy-MM-dd');

    // Query ngambil data planned_date ATAU delivered_at yang masuk range bulan ini
    const { data, error } = await supabase
      .from('orders')
      .select('planned_date, delivered_at, status, customers(name)')
      .eq('company_id', companyId)
      .or(`planned_date.gte.${startStr},delivered_at.gte.${startStr}`)
      .or(`planned_date.lte.${endStr},delivered_at.lte.${endStr}`);

    if (error) {
      console.error('Error fetching orders:', error);
      toast.error('Gagal memuat data pesanan.');
      setOrdersByDate({});
      setLoading(false);
      return;
    }

    const grouped = {};

    data.forEach(order => {
      // 1. Masukin berdasarkan JADWAL ORDER (Planned Date)
      if (order.planned_date) {
        const pDate = format(new Date(order.planned_date), 'yyyy-MM-dd');
        if (!grouped[pDate]) grouped[pDate] = [];
        grouped[pDate].push({
          customerName: order.customers?.name,
          status: order.status,
          type: 'planned'
        });
      }

      // 2. Masukin berdasarkan REALISASI KIRIM (Delivered At)
      // Hanya tampilkan kalau statusnya sudah 'sent' atau 'completed'
      if (order.delivered_at && (order.status === 'sent' || order.status === 'completed')) {
        const dDate = format(new Date(order.delivered_at), 'yyyy-MM-dd');
        if (!grouped[dDate]) grouped[dDate] = [];
        grouped[dDate].push({
          customerName: order.customers?.name,
          status: order.status,
          type: 'actual' // Penanda kalau ini tgl pengiriman riil
        });
      }
    });

    setOrdersByDate(grouped);
    setLoading(false);
  };

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const handleToday = () => setCurrentDate(new Date());

  const today = new Date();

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-[#011e4b] flex items-center gap-3">
          <CalendarIcon className="h-8 w-8" />
          Kalender Order & Pengiriman
        </h1>
        <Button onClick={handleToday} variant="outline">Hari Ini</Button>
      </div>

      <Card className="border-0 shadow-lg bg-white">
        <CardHeader className="p-4 sm:p-6 flex-row items-center justify-between border-b">
          <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <CardTitle className="text-xl font-semibold text-[#011e4b]">
            {format(currentDate, 'MMMM yyyy', { locale: id })}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </CardHeader>

        <CardContent className="p-0">
          <div className="grid grid-cols-7 text-center text-sm font-medium text-gray-500 border-b">
            {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map(day => (
              <div key={day} className="py-2">{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 border-l border-t">
            {daysInMonth.map((day, index) => {
              const dayString = format(day, 'yyyy-MM-dd');
              const dayItems = ordersByDate[dayString] || [];
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isToday = isSameDay(day, today);

              return (
                <div 
                  key={index} 
                  className={`
                    h-44 p-1 border-r border-b transition-colors
                    ${isCurrentMonth ? 'bg-white' : 'text-gray-400 bg-gray-50'}
                    ${isToday ? 'bg-blue-50/50' : ''}
                  `}
                >
                  <div className={`text-xs font-bold mb-1 p-1 rounded-full w-6 h-6 flex items-center justify-center ${isToday ? 'bg-blue-600 text-white' : ''}`}>
                    {format(day, 'd')}
                  </div>
                  
                  <div className="space-y-1 overflow-y-auto max-h-[calc(100%-30px)] scrollbar-hide">
                    {loading ? (
                      index === 0 && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    ) : (
                      dayItems.map((item, idx) => (
                        <div 
                          key={idx} 
                          className={`
                            text-[10px] p-1 rounded-sm flex items-center gap-1 leading-tight
                            ${getStatusColor(item.status, item.type === 'actual')}
                          `}
                        >
                          {item.type === 'actual' && <Truck className="h-2.5 w-2.5 shrink-0" />}
                          <span className="truncate">
                            {item.type === 'actual' ? `Kirim: ${item.customerName}` : item.customerName}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      
      {/* Legend */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-sm font-bold text-[#011e4b] uppercase tracking-wider mb-3">Keterangan Label</h2>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 bg-gray-200 rounded-sm border border-gray-300"></div>
            <span className="text-xs font-medium">Jadwal Order (Draft)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 bg-yellow-100 rounded-sm border border-yellow-200"></div>
            <span className="text-xs font-medium">Order Proses Kirim</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 bg-green-100 rounded-sm border border-green-200"></div>
            <span className="text-xs font-medium">Order Selesai</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 bg-blue-600 rounded-sm flex items-center justify-center">
               <Truck className="h-2 w-2 text-white" />
            </div>
            <span className="text-xs font-bold text-blue-700">Realisasi Pengiriman (Riil)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;