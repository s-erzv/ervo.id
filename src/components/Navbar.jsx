// src/components/Navbar.jsx
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
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
import { LogOut, UserCircle, LayoutDashboard, ListOrdered, Users, Package, Calendar, BarChart, Settings, Truck, Files, ReceiptText, Wallet, PiggyBank, Menu, Lock, Building2, DollarSign, Database, Bell, SquareUser, LibraryBig, FolderKey, MapPin, BarChart3 } from 'lucide-react';
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
  { path: '/dashboard', name: 'Dashboard', icon: <LayoutDashboard />, roles: ['super_admin', 'super_admin-main', 'admin', 'user', 'dropship'] },
  { path: '/notifications', name: 'Notifikasi', icon: <Bell />, roles: ['super_admin', 'super_admin-main', 'admin', 'user'] },
  { path: '/courier-dashboard', name: 'Dashboard Petugas', icon: <SquareUser />, roles: ['super_admin', 'admin'] }, 
  { path: '/orders', name: 'Manajemen Pesanan', icon: <ListOrdered />, roles: ['super_admin', 'admin', 'user', 'dropship'] },
  { path: '/customers', name: 'Customers', icon: <Users />, roles: ['super_admin', 'admin', 'user', 'dropship'] },
  { name: 'Peta Pelanggan', path: '/maps', icon: <MapPin />, roles: ['super_admin', 'admin', 'user'] },
  { path: '/stock', name: 'Stok', icon: <Package />, roles: ['super_admin', 'admin', 'user'] },
  { path: '/stock-reconciliation', name: 'Update Stok', icon: <Files />, roles: ['super_admin', 'admin', 'user'] },
  { path: '/central-orders', name: 'Procurement', icon: <Truck />, roles: ['super_admin', 'admin', 'user'] },
  { path: '/expenses', name: 'Reimbursement', icon: <ReceiptText />, roles: ['super_admin', 'admin', 'user'] },
  { path: '/salaries', name: 'Gaji & Bonus', icon: <DollarSign />, roles: ['admin'] },
  { path: '/financial-management', name: 'Manajemen Keuangan', icon: <PiggyBank />, roles: ['super_admin', 'admin', 'user'] },
  { path: '/financials', name: 'Keuangan', icon: <Wallet />, roles: ['super_admin', 'admin', 'user'] },
  { path: '/reports', name: 'Analisis', icon: <BarChart />, roles: ['super_admin', 'admin', 'user', 'dropship'] },
  { path: '/final-reports', name: 'Laporan Final', icon: <LibraryBig />, roles: ['super_admin', 'admin'] }, 
  { path: '/data-export', name: 'Data Center', icon: <Database />, roles: ['super_admin-main', 'admin'] },
  { path: '/calendar', name: 'Kalender Pesanan', icon: <Calendar />, roles: ['super_admin', 'admin', 'user'] },
  { path: '/settings', name: 'Pengaturan', icon: <Settings />, roles: ['super_admin', 'admin'] },
  { path: '/users', name: 'Manajemen Pengguna', icon: <Users />, roles: ['super_admin', 'super_admin-main'] },
  { path: '/billing-account', name: 'Manajemen Langganan', icon: <FolderKey />, roles: ['super_admin-main'] },
];



const Sidebar = () => {
  const { session, userRole, companyName, companyLogo, setActiveCompany, companyId, userProfile, signOut, notificationRefreshKey } = useAuth();
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

  // Effect untuk Notifikasi Umum
  useEffect(() => {
    if (!session) return;

    const fetchUnreadNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (!error) {
        setUnreadNotifications(data || []);
      }
    };

    fetchUnreadNotifications();

    const channel = supabase
      .channel('public:notifications:navbar')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${session.user.id}`
        },
        () => {
          fetchUnreadNotifications();
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
    if (notification.link_to) {
      navigate(notification.link_to);
    }
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notification.id);
    
    setUnreadNotifications(prev => prev.filter(n => n.id !== notification.id));
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
  const filteredItems = navItems.filter(item => item.roles.includes(currentRole));

  const NavContent = ({ onLinkClick, isMobile = false }) => (
    <nav className="flex flex-col gap-2 px-3 py-4 h-full overflow-y-auto scrollbar-hide">
      <Link
        to="/dashboard"
        className={`flex h-10 items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-gray-100 mb-4 ${isMobile ? '' : 'group'}`}
        onClick={onLinkClick}
      >
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
          {companyLogo ? (
            <img src={companyLogo} alt="Company Logo" className="h-full w-full rounded-md object-contain" />
          ) : (
            companyName ? companyName[0].toUpperCase() : 'A'
          )}
        </div>
        <span className={`${isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} text-sm font-semibold transition-opacity duration-300 whitespace-nowrap`}>
          {companyName || 'Nama Perusahaan'}
        </span>
      </Link>

      {userRole === 'super_admin' && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="flex w-full items-center justify-start gap-2 h-10 px-3 py-2 cursor-pointer"
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

      {filteredItems.map((item) => {
        const isNotifications = item.path === '/notifications';
        const isExpenses = item.path === '/expenses'; 

        return (
          <Link
            key={item.name}
            to={item.path}
            className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 py-2 transition-all duration-150 ease-in-out
              ${location.pathname === item.path
                ? 'bg-[#afcddd] text-[#011e4b] shadow-sm font-bold'
                : 'text-gray-600 hover:bg-[#afcddd]/30'
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
            {/* Tampilkan badge jika ini menu Reimbursement dan ada pending count */}
            {isExpenses && pendingExpensesCount > 0 && (
              <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                {pendingExpensesCount}
              </span>
            )}
          </Link>
        )
      })}

      <div className="mt-auto w-full border-t border-gray-200 pt-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex h-10 w-full items-center justify-start gap-3 rounded-lg px-3 py-2 
                        text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors duration-150"
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
                <p className="text-xs leading-none text-muted-foreground">
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
        <aside className="group fixed inset-y-0 left-0 z-50 flex w-16 hover:w-64 flex-col border-r border-gray-200 bg-white shadow-sm transition-all duration-300 ease-in-out">
          <NavContent onLinkClick={() => { }} />
        </aside>
      </div>

      {/* Mobile Navbar with Hamburger Menu */}
      <header className="sm:hidden sticky top-0 z-40 flex h-16 shrink-0 items-center gap-4 border-b bg-white px-4 shadow-sm md:px-6">
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 md:hidden"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>

          <SheetContent side="left" className="flex flex-col bg-white" aria-describedby={undefined}>
            <SheetHeader className="px-1">
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>

            <NavContent onLinkClick={() => setIsSheetOpen(false)} isMobile={true} />
          </SheetContent>
        </Sheet>

        <div className="flex-1 text-center font-bold text-lg">
          {companyName || 'Nama Perusahaan'}
        </div>
        
        <div className="ml-auto flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
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
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <UserCircle className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{session.user.email}</p>
                  <p className="text-xs leading-none text-muted-foreground">
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