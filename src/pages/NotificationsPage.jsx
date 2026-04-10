// src/pages/NotificationsPage.jsx
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Bell, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';

const NotificationsPage = () => {
  const { session, triggerNotificationRefresh } = useAuth(); // <-- AMBIL triggerNotificationRefresh
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    if (!session) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching notifications:', error);
      toast.error("Gagal memuat notifikasi.");
    } else {
      setNotifications(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (session) {
      fetchNotifications();

      const channel = supabase
        .channel(`public:notifications:page:${session.user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` },
          () => {
            fetchNotifications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [session]);

  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notification.id);
    }
    if (notification.link_to) {
      navigate(notification.link_to);
    }
  };

  const handleMarkAllAsRead = async () => {
    // Tambahkan pengecekan cepat untuk UX yang lebih baik
    const unreadNotificationsExist = notifications.some(n => !n.is_read);
    
    if (!unreadNotificationsExist) {
        toast.info("Semua notifikasi sudah dibaca.");
        return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', session.user.id)
      .eq('is_read', false);

    if (error) {
      toast.error("Gagal menandai semua notifikasi.");
    } else {
      toast.success("Semua notifikasi ditandai telah dibaca.");
      
      // PERBAIKAN: Update state lokal secara langsung agar real-time
      setNotifications(prevNotifs => 
        prevNotifs.map(n => ({ ...n, is_read: true }))
      );
      
      // BARU: Panggil trigger untuk memaksa Navbar/Sidebar refresh
      if (triggerNotificationRefresh) {
        triggerNotificationRefresh();
      }
    }
    setLoading(false);
  };

  const groupedNotifications = useMemo(() => {
    return notifications.reduce((acc, notification) => {
      const date = new Date(notification.created_at);
      let groupTitle;

      if (isToday(date)) {
        groupTitle = 'Hari Ini';
      } else if (isYesterday(date)) {
        groupTitle = 'Kemarin';
      } else {
        groupTitle = format(date, 'd MMMM yyyy', { locale: id });
      }

      if (!acc[groupTitle]) {
        acc[groupTitle] = [];
      }
      acc[groupTitle].push(notification);
      return acc;
    }, {});
  }, [notifications]);

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-3xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
          <Bell className="h-7 w-7" />
          Riwayat Notifikasi
        </h1>
        <Button onClick={handleMarkAllAsRead} disabled={loading} size="sm" className="w-full sm:w-auto">
            <CheckCheck className="h-4 w-4 mr-2" />
            Tandai Semua Telah Dibaca
        </Button>
      </div>
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 md:p-6">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
          ) : (
            <div className="space-y-6">
              {notifications.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">Tidak ada notifikasi.</p>
              ) : (
                Object.entries(groupedNotifications).map(([dateGroup, notifs]) => (
                  <div key={dateGroup}>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-3 sticky top-16 sm:top-0 bg-white py-2">{dateGroup}</h3>
                    <div className="space-y-3">
                      {notifs.map(n => (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={`flex items-start gap-4 p-3 border rounded-lg cursor-pointer transition-colors ${!n.is_read ? 'bg-blue-50 hover:bg-blue-100 border-blue-200' : 'bg-white hover:bg-gray-50'}`}
                        >
                          {!n.is_read && <div className="mt-1.5 h-2.5 w-2.5 rounded-full bg-blue-500 flex-shrink-0"></div>}
                          <div className={n.is_read ? 'pl-5' : ''}>
                            <p className={`text-sm ${!n.is_read ? 'font-semibold text-gray-800' : 'text-gray-700'}`}>{n.message}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: id })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationsPage;