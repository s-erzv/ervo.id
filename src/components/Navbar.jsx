// src/components/Navbar.jsx
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { LogOut, UserCircle, LayoutDashboard, ListOrdered, Users, Package, Calendar, BarChart, Settings, Truck, Files, ReceiptText, Wallet, PiggyBank, Menu, Lock, Building2, DollarSign, Database, Bell, SquareUser, LibraryBig, FolderKey, MapPin, BarChart3, Sun, Moon, CreditCard, ShieldCheck, Globe } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';

const navItems = [
  // ── Shared
  { path: '/dashboard', name: 'Dashboard', icon: <LayoutDashboard />, roles: ['super_admin', 'super_admin-main', 'admin', 'user', 'dropship'] },
  { path: '/notifications', name: 'Notifikasi', icon: <Bell />, roles: ['super_admin', 'super_admin-main', 'admin', 'user'] },

  // ── Super Admin Platform (super_admin-main only)
  { type: 'section', label: 'Platform', roles: ['super_admin-main'] },
  { path: '/users', name: 'Semua Pengguna', icon: <Users />, roles: ['super_admin-main'] },
  { path: '/billing-account', name: 'Tenant & Langganan', icon: <Building2 />, roles: ['super_admin-main'] },

  // ── Super Admin Tenant Operations (super_admin with company)
  { type: 'section', label: 'Pengguna', roles: ['super_admin'] },
  { path: '/users', name: 'Manajemen Pengguna', icon: <Users />, roles: ['super_admin'] },
  { path: '/courier-dashboard', name: 'Dashboard Petugas', icon: <SquareUser />, roles: ['super_admin', 'admin'] },

  // ── Operations
  { type: 'section', label: 'Operasional', roles: ['super_admin', 'admin', 'user', 'dropship'] },
  { path: '/orders', name: 'Manajemen Pesanan', icon: <ListOrdered />, roles: ['super_admin', 'admin', 'user', 'dropship'] },
  { path: '/customers', name: 'Customers', icon: <Users />, roles: ['super_admin', 'admin', 'user', 'dropship'] },
  { name: 'Peta Pelanggan', path: '/maps', icon: <MapPin />, roles: ['super_admin', 'admin', 'user'], feature: 'maps' },
  { path: '/calendar', name: 'Kalender Pesanan', icon: <Calendar />, roles: ['super_admin', 'admin', 'user'], feature: 'calendar' },
  { path: '/central-orders', name: 'Procurement', icon: <Truck />, roles: ['super_admin', 'admin', 'user'], feature: 'procurement' },

  // ── Stok
  { type: 'section', label: 'Stok', roles: ['super_admin', 'admin', 'user'] },
  { path: '/stock', name: 'Stok Produk', icon: <Package />, roles: ['super_admin', 'admin', 'user'] },
  { path: '/stock-reconciliation', name: 'Update Stok', icon: <Files />, roles: ['super_admin', 'admin', 'user'] },

  // ── Keuangan
  { type: 'section', label: 'Keuangan', roles: ['super_admin', 'admin', 'user'] },
  { path: '/financial-management', name: 'Manajemen Keuangan', icon: <PiggyBank />, roles: ['super_admin', 'admin', 'user'], feature: 'financials' },
  { path: '/financials', name: 'Laporan Keuangan', icon: <Wallet />, roles: ['super_admin', 'admin', 'user'], feature: 'financials' },
  { path: '/expenses', name: 'Reimbursement', icon: <ReceiptText />, roles: ['super_admin', 'admin', 'user'], feature: 'reimbursement' },
  { path: '/salaries', name: 'Gaji & Bonus', icon: <DollarSign />, roles: ['admin'], feature: 'salaries' },

  // ── Laporan
  { type: 'section', label: 'Laporan', roles: ['super_admin', 'admin', 'user', 'dropship'] },
  { path: '/reports', name: 'Analisis', icon: <BarChart />, roles: ['super_admin', 'admin', 'user', 'dropship'], feature: 'reports' },
  { path: '/final-reports', name: 'Laporan Final', icon: <LibraryBig />, roles: ['super_admin', 'admin'], feature: 'reports' },
  { path: '/data-export', name: 'Data Center', icon: <Database />, roles: ['super_admin-main', 'admin'], feature: 'data_export' },

  // ── Settings
  { type: 'section', label: 'Sistem', roles: ['super_admin', 'admin'] },
  { path: '/settings', name: 'Pengaturan', icon: <Settings />, roles: ['super_admin', 'admin'] },
];



const Sidebar = () => {
  const { theme, toggleTheme } = useTheme();
  const { session, userRole, companyName, companyLogo, setActiveCompany, companyId, userProfile, signOut, notificationRefreshKey } = useAuth();
  const { hasFeature } = useSubscription();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [loadingPasswordChange, setLoadingPasswordChange] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(userRole === 'super_admin');
  
  const [unreadNotifications, setUnreadNotifications] = useState([]);
  const unreadCount = unreadNotifications.length;

  const isDropship = userRole === 'dropship';

  // Sidebar menu filter (sub-set dari menu user)
  const menuDropship = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Pesanan Saya', path: '/orders', icon: ListOrdered },
    { name: 'Customer Saya', path: '/customers', icon: Users },
    { name: 'Analisis', path: '/analysis', icon: BarChart3 },
  ];

  // State untuk Pending Reimbursement
  const [pendingExpensesCount, setPendingExpensesCount] = useState(0);

  // Effect untuk Notifikasi Umum — real-time
  useEffect(() => {
    if (!session) return;

    const fetchUnreadNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (!error) setUnreadNotifications(data || []);
    };

    fetchUnreadNotifications();

    // Handle real-time: INSERT = tambah langsung ke state; UPDATE = re-fetch (mungkin sudah dibaca)
    const channel = supabase
      .channel(`notif:${session.user.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` },
        (payload) => {
          if (payload.new && !payload.new.is_read) {
            setUnreadNotifications(prev => [payload.new, ...prev]);
          }
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` },
        (payload) => {
          if (payload.new?.is_read) {
            // Langsung hapus dari state tanpa re-fetch
            setUnreadNotifications(prev => prev.filter(n => n.id !== payload.new.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, notificationRefreshKey]); 
  
  // Effect untuk Menghitung Reimbursement Pending
  useEffect(() => {
    if (!companyId || !session?.user?.id) return;

    const fetchPendingExpenses = async () => {
      try {
        let query = supabase
          .from('expense_reports')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('status', 'pending');

        // PERBAIKAN LOGIC:
        // Jika user biasa, hanya hitung pengajuan milik user sendiri supaya sinkron dengan list.
        if (userRole === 'user') {
             query = query.eq('user_id', session.user.id);
        }
        // Jika admin/super_admin, tetap hitung semua (karena admin melihat semua pengajuan).

        const { count, error } = await query;

        if (!error) {
          setPendingExpensesCount(count || 0);
        }
      } catch (err) {
        console.error('Error fetching pending expenses:', err);
      }
    };

    fetchPendingExpenses();

    // Subscribe ke perubahan tabel expense_reports
    // Filter broad 'company_id' aman digunakan, filtering detail terjadi di 'fetchPendingExpenses'
    const expenseChannel = supabase
      .channel('public:expense_reports:navbar')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expense_reports',
          filter: `company_id=eq.${companyId}`
        },
        () => {
          fetchPendingExpenses();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(expenseChannel);
    };
  }, [companyId, userRole, session?.user?.id]); // Tambahkan dependency userRole dan session.user.id

  const handleNotificationClick = async (notification) => {
    // Optimistic: hapus dari state dulu
    setUnreadNotifications(prev => prev.filter(n => n.id !== notification.id));
    // Update DB (real-time subscription juga akan fire UPDATE dan hapus jika belum terhapus)
    await supabase.from('notifications').update({ is_read: true }).eq('id', notification.id);
    if (notification.link_to) navigate(notification.link_to);
  };

  useEffect(() => {
    const fetchCompanies = async () => {
      if (userRole === 'super_admin') {
        setLoadingCompanies(true);
        const { data, error } = await supabase.from('companies').select('id, name');
        if (error) {
          console.error('Error fetching companies:', error);
          toast.error('Gagal memuat daftar perusahaan.');
        } else {
          setCompanies(data || []);
        }
        setLoadingCompanies(false);
      }
    };
    fetchCompanies();
  }, [userRole]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('[Sidebar] signOut failed', err);
    } finally {
      if (setActiveCompany) setActiveCompany(null);
      try {
        for (const k of Object.keys(localStorage || {})) {
          if (!k) continue;
          const kl = k.toLowerCase();
          if (kl.includes('supabase') || kl.includes('sb:') || kl.includes('sb-') || kl.includes('gotrue')) {
            localStorage.removeItem(k);
          }
        }
      } catch (e) { /* ignore */ }
      navigate('/login', { replace: true });
      toast.success('Berhasil logout!');
    }
  };

  const handlePasswordChangeSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword) {
      toast.error('Kata sandi baru tidak boleh kosong.');
      return;
    }
    setLoadingPasswordChange(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoadingPasswordChange(false);
    if (error) {
      toast.error('Gagal memperbarui kata sandi: ' + error.message);
    } else {
      toast.success('Kata sandi berhasil diperbarui!');
      setIsChangePasswordModalOpen(false);
      setNewPassword('');
    }
  };

  if (!session) {
    return null;
  }

  const currentRole = userRole === 'super_admin' && !companyId ? 'super_admin-main' : userRole;
  const filteredItems = navItems.filter(item => {
    const hasRole = item.roles.includes(currentRole);
    const hasRequiredFeature = !item.feature || hasFeature(item.feature);
    return hasRole && hasRequiredFeature;
  });

  // Remove consecutive duplicate section headers and sections with no following links
  const dedupedItems = filteredItems.reduce((acc, item, idx) => {
    if (item.type === 'section') {
      const next = filteredItems[idx + 1];
      if (!next || next.type === 'section') return acc; // skip empty section
    }
    acc.push(item);
    return acc;
  }, []);

  const NavContent = ({ onLinkClick, isMobile = false }) => (
    <nav className="flex flex-col gap-1.5 px-3 py-4 h-full overflow-y-auto scrollbar-hide">
      <Link
        to="/dashboard"
        className={`flex h-10 items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-white/10 mb-4 ${isMobile ? '' : 'group'}`}
        onClick={onLinkClick}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/20 text-xs font-bold text-white">
          {companyLogo ? (
            <img src={companyLogo} alt="Company Logo" className="h-full w-full rounded-lg object-contain" />
          ) : (
            companyName ? companyName[0].toUpperCase() : 'A'
          )}
        </div>
        <span className={`${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} text-sm font-semibold text-white transition-opacity duration-300 whitespace-nowrap`}>
          {companyName || 'Nama Perusahaan'}
        </span>
      </Link>

      {userRole === 'super_admin' && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="flex w-full items-center justify-start gap-2 h-10 px-3 py-2 cursor-pointer bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
              disabled={loadingCompanies}
            >
              <Building2 className="h-4 w-4" />
              <span className="truncate">
                {companyId ? companies.find(c => c.id === companyId)?.name : "Pilih Perusahaan"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start">
            <DropdownMenuLabel>Pilih Perusahaan</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                setActiveCompany(null);
                navigate('/dashboard');
              }}
              className={!companyId ? 'bg-gray-100 font-medium cursor-pointer' : ''}
            >
              Kembali ke Dashboard Utama
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {companies.map((comp) => (
              <DropdownMenuItem
                key={comp.id}
                onClick={() => {
                  setActiveCompany(comp.id);
                  navigate('/dashboard');
                }}
                className={comp.id === companyId ? 'bg-gray-100 font-medium' : ''}
              >
                {comp.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {dedupedItems.map((item, idx) => {
        if (item.type === 'section') {
          return (
            <div key={`section-${idx}`} className={`px-3 pt-3 pb-1 ${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-300`}>
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/40 whitespace-nowrap">{item.label}</p>
            </div>
          );
        }

        const isNotifications = item.path === '/notifications';
        const isExpenses = item.path === '/expenses';

        return (
          <Link
            key={item.name}
            to={item.path}
            className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 py-2 transition-all duration-150 ease-in-out
              ${location.pathname === item.path
                ? 'bg-white text-[#011e4b] shadow-sm font-bold'
                : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
              } ${isMobile ? '' : 'group'}`}
            onClick={onLinkClick}
          >
            <div className="flex h-5 w-5 shrink-0 items-center justify-center">
              {item.icon}
            </div>
            <span className={`${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} text-sm font-medium transition-opacity duration-300 whitespace-nowrap`}>
              {item.name}
            </span>
            {isNotifications && unreadCount > 0 && (
              <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                {unreadCount}
              </span>
            )}
            {isExpenses && pendingExpensesCount > 0 && (
              <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                {pendingExpensesCount}
              </span>
            )}
          </Link>
        )
      })}

      <div className="mt-auto w-full border-t border-white/10 pt-2">
        {/* Dark / Light mode toggle */}
        <button
          onClick={toggleTheme}
          className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-blue-100/80 hover:bg-white/10 hover:text-white transition-colors duration-150 ${isMobile ? '' : 'group'}`}
          title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
        >
          <div className="flex h-5 w-5 items-center justify-center shrink-0">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </div>
          <span className={`${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} text-sm font-medium transition-opacity duration-300 whitespace-nowrap`}>
            {theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
          </span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex h-10 w-full items-center justify-start gap-3 rounded-lg px-3 py-2 
                        text-blue-100/80 hover:bg-white/10 hover:text-white transition-colors duration-150"
            >
              <div className="flex h-5 w-5 items-center justify-center">
                <UserCircle className="h-5 w-5" />
              </div>
              <span className={`${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} text-sm font-medium transition-opacity duration-300 whitespace-nowrap`}>
                Profile
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{session.user.email}</p>
                <p className="text-xs leading-none text-slate-500">
                  Role: {userRole}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setIsChangePasswordModalOpen(true)}>
              <Lock className="mr-2 h-4 w-4" />
              <span>Ganti Kata Sandi</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Keluar</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden sm:block">
        <aside className="group fixed inset-y-0 left-0 z-50 flex w-16 hover:w-64 flex-col border-r border-[#001638] bg-[#011e4b] shadow-lg transition-all duration-300 ease-in-out">
          <NavContent onLinkClick={() => { }} />
        </aside>
      </div>

      {/* Mobile Navbar with Hamburger Menu */}
      <header className="sm:hidden sticky top-0 z-40 flex h-16 shrink-0 items-center gap-4 border-b border-[#001638] bg-[#011e4b] px-4 shadow-md md:px-6">
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 md:hidden border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>

          <SheetContent side="left" className="flex flex-col bg-[#011e4b] border-r-[#001638]" aria-describedby={undefined}>
            <SheetHeader className="px-1">
              <SheetTitle className="text-white">Menu</SheetTitle>
            </SheetHeader>

            <NavContent onLinkClick={() => setIsSheetOpen(false)} isMobile={true} />
          </SheetContent>
        </Sheet>

        <div className="flex-1 text-center font-bold text-lg text-white">
          {companyName || 'Nama Perusahaan'}
        </div>
        
        <div className="ml-auto flex items-center gap-2">
          {/* Dark mode toggle - mobile */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-white hover:bg-white/10 hover:text-white"
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full text-white hover:bg-white/10 hover:text-white">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                    {unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Notifikasi Baru</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {unreadNotifications.length === 0 ? (
                <DropdownMenuItem disabled>Tidak ada notifikasi baru</DropdownMenuItem>
              ) : (
                unreadNotifications.map(n => (
                  <DropdownMenuItem key={n.id} onClick={() => handleNotificationClick(n)} className="flex flex-col items-start font-bold">
                    <p className="text-xs whitespace-normal">{n.message}</p>
                    <p className="text-xs mt-1 text-blue-600">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: id })}
                    </p>
                  </DropdownMenuItem>
                ))
              )}
               <DropdownMenuSeparator />
               <DropdownMenuItem onClick={() => navigate('/notifications')}>
                 Lihat Semua Notifikasi
               </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full text-white hover:bg-white/10 hover:text-white">
                <UserCircle className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{session.user.email}</p>
                  <p className="text-xs leading-none text-slate-500">
                    Role: {userRole}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsChangePasswordModalOpen(true)}>
                <Lock className="mr-2 h-4 w-4" />
                <span>Ganti Kata Sandi</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Keluar</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Change Password Modal */}
      <Dialog open={isChangePasswordModalOpen} onOpenChange={setIsChangePasswordModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ganti Kata Sandi</DialogTitle>
            <DialogDescription>
              Masukkan kata sandi baru Anda.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordChangeSubmit} className="space-y-4">
            <div>
              <Label htmlFor="newPassword">Kata Sandi Baru</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={loadingPasswordChange} className="w-full">
              {loadingPasswordChange ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 'Simpan Kata Sandi'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Sidebar;