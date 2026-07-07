import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import AddUserForm from '@/components/AddUserForm';
import AddAdminForm from '@/components/AddAdminForm';
import EditUserForm from '@/components/EditUserForm';
import CompanyExtensionForm from '@/components/CompanyExtensionForm';
import { Loader2, Pencil, Trash2, Users, Building2, Search, UserPlus, ShieldCheck, RefreshCw, Phone, CreditCard, CalendarClock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const formatDate = (d) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

const ROLE_CONFIG = {
  super_admin: { label: 'Super Admin', bg: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' },
  admin:       { label: 'Admin',       bg: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' },
  user:        { label: 'Kurir/Staff', bg: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' },
  dropship:    { label: 'Dropshipper', bg: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' },
  courier:     { label: 'Kurir',       bg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' },
};

const UserManagementPage = () => {
  const { session, userRole, companyId } = useAuth();
  const isSuperAdmin = userRole === 'super_admin';

  const [users, setUsers]             = useState([]);
  const [companies, setCompanies]     = useState([]);
  const [loadingUsers, setLoadingUsers]         = useState(true);
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  const [selectedCompanyId, setSelectedCompanyId] = useState('all');
  const [searchQuery, setSearchQuery]             = useState('');
  const [activeTab, setActiveTab]                 = useState('users');

  const [isAddModalOpen,  setIsAddModalOpen]  = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [userToEdit, setUserToEdit]           = useState(null);

  const [isEditCompanyModalOpen, setIsEditCompanyModalOpen] = useState(false);
  const [companyToEdit,   setCompanyToEdit]   = useState(null);
  const [newCompanyName,  setNewCompanyName]  = useState('');
  const [newCompanyAddress, setNewCompanyAddress] = useState('');
  const [isCompanySubmitting, setIsCompanySubmitting] = useState(false);

  const [isSubModalOpen,  setIsSubModalOpen]  = useState(false);
  const [companyForSub,   setCompanyForSub]   = useState(null);

  useEffect(() => {
    if (!session) return;
    fetchUsers();
    if (isSuperAdmin) fetchCompanies();
  }, [session, userRole, companyId]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, phone, rekening, base_salary, company_id, companies(name)')
      .order('role', { ascending: false });
    if (error) { toast.error('Gagal mengambil data pengguna.'); setUsers([]); }
    else setUsers(data ?? []);
    setLoadingUsers(false);
  };

  const fetchCompanies = async () => {
    setLoadingCompanies(true);
    const { data, error } = await supabase
      .from('companies')
      .select('id, name, created_at, google_sheets_link, address, subscription_end_date, is_manually_locked, subscription_plan_id, subscription_plans(name, price, billing_cycle_days)')
      .order('created_at', { ascending: false });
    if (error) { toast.error('Gagal mengambil data perusahaan.'); }
    else setCompanies(data ?? []);
    setLoadingCompanies(false);
  };

  const handleRoleChange = async (userId, newRole) => {
    if (userId === session.user.id) return toast.error('Tidak bisa mengubah peran diri sendiri.');
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    if (error) return toast.error('Gagal mengubah peran.');
    toast.success('Peran berhasil diubah.');
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Hapus pengguna ini?')) return;
    if (userId === session.user.id) return toast.error('Tidak bisa menghapus akun sendiri.');
    setLoadingUsers(true);
    try {
      const { error } = await supabase.functions.invoke('delete-user', { method: 'DELETE', body: { userId } });
      if (error) throw new Error(error.message);
      toast.success('Pengguna berhasil dihapus.');
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      toast.error('Gagal menghapus: ' + err.message);
    } finally { setLoadingUsers(false); }
  };

  const handleDeleteCompany = async (id, name) => {
    if (!window.confirm(`Hapus perusahaan "${name}"? Semua data terkait akan ikut terhapus.`)) return;
    const { error } = await supabase.from('companies').delete().eq('id', id);
    if (error) return toast.error('Gagal menghapus perusahaan.');
    toast.success('Perusahaan berhasil dihapus.');
    setCompanies(prev => prev.filter(c => c.id !== id));
    fetchUsers();
  };

  const handleCompanyUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!companyToEdit) return;
    setIsCompanySubmitting(true);
    try {
      const { data, error } = await supabase
        .from('companies')
        .update({ name: newCompanyName, address: newCompanyAddress })
        .eq('id', companyToEdit.id).select().single();
      if (error) throw error;
      toast.success('Perusahaan berhasil diperbarui.');
      setCompanies(prev => prev.map(c => c.id === companyToEdit.id ? { ...c, ...data } : c));
      setIsEditCompanyModalOpen(false);
    } catch (err) {
      toast.error('Gagal memperbarui: ' + err.message);
    } finally { setIsCompanySubmitting(false); }
  };

  const filteredUsers = useMemo(() => {
    let result = users;
    if (isSuperAdmin && selectedCompanyId !== 'all') result = result.filter(u => u.company_id === selectedCompanyId);
    if (userRole === 'admin') result = result.filter(u => u.company_id === companyId && u.role !== 'super_admin' && u.role !== 'admin');
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(u => u.full_name?.toLowerCase().includes(q) || u.phone?.toLowerCase().includes(q) || u.companies?.name?.toLowerCase().includes(q));
    }
    return result;
  }, [users, selectedCompanyId, userRole, companyId, isSuperAdmin, searchQuery]);

  // Stats
  const stats = useMemo(() => ({
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    staff: users.filter(u => u.role === 'user').length,
    dropship: users.filter(u => u.role === 'dropship').length,
  }), [users]);

  const companyStats = useMemo(() => ({
    total: companies.length,
    active: companies.filter(c => !c.is_manually_locked && c.subscription_end_date && new Date(c.subscription_end_date) > new Date()).length,
    expired: companies.filter(c => !c.is_manually_locked && (!c.subscription_end_date || new Date(c.subscription_end_date) <= new Date())).length,
  }), [companies]);

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-700">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-3">
            <div className="p-2 bg-[#011e4b] rounded-xl"><Users className="h-5 w-5 text-white" /></div>
            Manajemen Pengguna
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 ml-12 text-sm">Kelola semua user dan perusahaan di platform Ervo.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { fetchUsers(); fetchCompanies(); }} variant="outline" className="h-10 rounded-xl gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button onClick={() => setIsAddModalOpen(true)} className="h-10 rounded-xl gap-2 bg-[#011e4b] hover:bg-[#022a6b]">
            <UserPlus className="h-4 w-4" /> {isSuperAdmin ? 'Tambah Admin' : 'Tambah User'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {isSuperAdmin ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total User', value: stats.total, color: 'text-[#011e4b] dark:text-blue-300', bg: 'bg-blue-50 dark:bg-blue-900/30' },
            { label: 'Admin Tenant', value: stats.admins, color: 'text-purple-600 dark:text-purple-300', bg: 'bg-purple-50 dark:bg-purple-900/30' },
            { label: 'Staff/Kurir', value: stats.staff, color: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-50 dark:bg-slate-700/50' },
            { label: 'Dropshipper', value: stats.dropship, color: 'text-emerald-600 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
          ].map(s => (
            <Card key={s.label} className="rounded-2xl border-slate-200/60 dark:border-slate-700 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${s.bg}`}>
                  <Users className={`h-4 w-4 ${s.color}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Tabs for super admin */}
      {isSuperAdmin ? (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 w-full sm:w-auto">
            <TabsTrigger value="users" className="rounded-lg  text-black data-[state=active]:bg-[#011e4b] data-[state=active]:text-white px-5 gap-2">
              <Users className="h-4 w-4" /> Pengguna <Badge className="ml-1 text-[9px] bg-white/20 text-current border-0">{stats.total}</Badge>
            </TabsTrigger>
            <TabsTrigger value="companies" className="rounded-lg text-black data-[state=active]:bg-[#011e4b] data-[state=active]:text-white px-5 gap-2">
              <Building2 className="h-4 w-4" /> Perusahaan <Badge className="ml-1 text-[9px] bg-white/20 text-current border-0">{companyStats.total}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="mt-6 animate-in fade-in slide-in-from-bottom-2">
            <UserTable
              users={filteredUsers}
              companies={companies}
              selectedCompanyId={selectedCompanyId}
              setSelectedCompanyId={setSelectedCompanyId}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              loading={loadingUsers}
              isSuperAdmin={isSuperAdmin}
              sessionUserId={session?.user?.id}
              userRole={userRole}
              onRoleChange={handleRoleChange}
              onEdit={(u) => { setUserToEdit(u); setIsEditModalOpen(true); }}
              onDelete={handleDeleteUser}
            />
          </TabsContent>

          {/* Companies Tab */}
          <TabsContent value="companies" className="mt-6 animate-in fade-in slide-in-from-bottom-2">
            <CompanyTable
              companies={companies}
              loading={loadingCompanies}
              companyStats={companyStats}
              onEdit={(c) => { setCompanyToEdit(c); setNewCompanyName(c.name); setNewCompanyAddress(c.address || ''); setIsEditCompanyModalOpen(true); }}
              onEditSub={(c) => { setCompanyForSub(c); setIsSubModalOpen(true); }}
              onDelete={handleDeleteCompany}
              openSheets={(link, id) => link ? window.open(`${link}?company_id=${id}`, '_blank') : toast.error('Link Google Sheets tidak tersedia.')}
            />
          </TabsContent>
        </Tabs>
      ) : (
        /* Admin biasa — hanya tabel user */
        <UserTable
          users={filteredUsers}
          companies={[]}
          selectedCompanyId={selectedCompanyId}
          setSelectedCompanyId={setSelectedCompanyId}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          loading={loadingUsers}
          isSuperAdmin={false}
          sessionUserId={session?.user?.id}
          userRole={userRole}
          onRoleChange={handleRoleChange}
          onEdit={(u) => { setUserToEdit(u); setIsEditModalOpen(true); }}
          onDelete={handleDeleteUser}
        />
      )}

      {/* Modals */}
      {isSuperAdmin ? (
        <AddAdminForm open={isAddModalOpen} onOpenChange={setIsAddModalOpen} onUserAdded={() => { fetchUsers(); fetchCompanies(); }} />
      ) : (
        <AddUserForm open={isAddModalOpen} onOpenChange={setIsAddModalOpen} onUserAdded={fetchUsers} />
      )}

      {userToEdit && (
        <EditUserForm open={isEditModalOpen} onOpenChange={setIsEditModalOpen} userToEdit={userToEdit}
          onUserUpdated={(u) => { setUsers(prev => prev.map(x => x.id === u.id ? { ...x, ...u } : x)); setIsEditModalOpen(false); }} />
      )}

      {/* Subscription Dialog */}
      <Dialog open={isSubModalOpen} onOpenChange={setIsSubModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-[#011e4b]" />
              Atur Langganan: {companyForSub?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <CompanyExtensionForm
              company={companyForSub}
              onSuccess={(updated) => {
                setIsSubModalOpen(false);
                setCompanies(prev => prev.map(c =>
                  c.id === companyForSub?.id ? { ...c, ...updated } : c
                ));
                fetchCompanies();
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditCompanyModalOpen} onOpenChange={setIsEditCompanyModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-bold text-slate-800 dark:text-slate-100">Edit Perusahaan</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCompanyUpdateSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="font-semibold text-slate-700 dark:text-slate-300">Nama Perusahaan</Label>
              <Input value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)} className="rounded-xl" required />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold text-slate-700 dark:text-slate-300">Alamat</Label>
              <Input value={newCompanyAddress} onChange={e => setNewCompanyAddress(e.target.value)} className="rounded-xl" placeholder="Alamat perusahaan" />
            </div>
            <DialogFooter className="mt-4 gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditCompanyModalOpen(false)} className="rounded-xl">Batal</Button>
              <Button type="submit" disabled={isCompanySubmitting} className="rounded-xl bg-[#011e4b] hover:bg-[#022a6b]">
                {isCompanySubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const UserTable = ({ users, companies, selectedCompanyId, setSelectedCompanyId, searchQuery, setSearchQuery, loading, isSuperAdmin, sessionUserId, userRole, onRoleChange, onEdit, onDelete }) => (
  <Card className="rounded-2xl border-slate-200/60 dark:border-slate-700 shadow-sm overflow-hidden">
    <CardHeader className="border-b border-slate-100 dark:border-slate-700 p-5 bg-slate-50/50 dark:bg-slate-800/30">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1">
          <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-500" /> Daftar Pengguna
          </CardTitle>
          <CardDescription className="text-slate-500 dark:text-slate-400 font-medium">{users.length} pengguna ditemukan</CardDescription>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          {isSuperAdmin && (
            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
              <SelectTrigger className="h-9 w-full sm:w-[200px] rounded-xl text-sm">
                <SelectValue placeholder="Semua Perusahaan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Perusahaan</SelectItem>
                {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari nama atau telepon..." className="pl-9 h-9 rounded-xl w-full sm:w-[220px] text-sm" />
          </div>
        </div>
      </div>
    </CardHeader>
    <CardContent className="p-0">
      {loading ? (
        <div className="flex justify-center items-center h-40"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
              <TableRow className="border-slate-100 dark:border-slate-700">
                <TableHead className="font-semibold text-slate-600 dark:text-slate-400 px-5">Pengguna</TableHead>
                {isSuperAdmin && <TableHead className="font-semibold text-slate-600 dark:text-slate-400">Perusahaan</TableHead>}
                <TableHead className="font-semibold text-slate-600 dark:text-slate-400">Peran</TableHead>
                <TableHead className="font-semibold text-slate-600 dark:text-slate-400">Kontak</TableHead>
                <TableHead className="text-center font-semibold text-slate-600 dark:text-slate-400 px-5">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(user => {
                const roleCfg = ROLE_CONFIG[user.role] || { label: user.role, bg: 'bg-slate-100 text-slate-600' };
                return (
                  <TableRow key={user.id} className="border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <TableCell className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-[#011e4b] flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {user.full_name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{user.full_name || '—'}</p>
                          {user.rekening && <p className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1"><CreditCard className="h-2.5 w-2.5" />{user.rekening}</p>}
                        </div>
                      </div>
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell className="py-3.5">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{user.companies?.name || <span className="text-slate-400 italic">—</span>}</span>
                      </TableCell>
                    )}
                    <TableCell className="py-3.5">
                      {isSuperAdmin && (user.role === 'super_admin' || user.role === 'admin') ? (
                        <Badge className={`text-[10px] font-semibold border-0 ${roleCfg.bg}`}>{roleCfg.label}</Badge>
                      ) : (
                        <Select value={user.role} onValueChange={r => onRoleChange(user.id, r)}
                          disabled={user.id === sessionUserId || user.role === 'super_admin' || (userRole === 'admin' && (user.role === 'admin' || user.role === 'super_admin'))}>
                          <SelectTrigger className="h-8 w-[140px] rounded-lg text-xs border-slate-200 dark:border-slate-600">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {isSuperAdmin ? (
                              <>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="user">Kurir/Staff</SelectItem>
                                <SelectItem value="dropship">Dropshipper</SelectItem>
                              </>
                            ) : (
                              <>
                                <SelectItem value="user">Kurir/Staff</SelectItem>
                                <SelectItem value="dropship">Dropshipper</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="py-3.5">
                      {user.phone ? (
                        <span className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1">
                          <Phone className="h-3 w-3 text-slate-400" />{user.phone}
                        </span>
                      ) : <span className="text-slate-400 text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-center px-5 py-3.5">
                      <div className="flex gap-1.5 justify-center">
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-lg border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200"
                          onClick={() => onEdit(user)} disabled={userRole === 'admin' && (user.role === 'admin' || user.role === 'super_admin')}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-lg border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200"
                          onClick={() => onDelete(user.id)} disabled={user.id === sessionUserId || (userRole === 'admin' && (user.role === 'admin' || user.role === 'super_admin'))}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {users.length === 0 && (
                <TableRow><TableCell colSpan={isSuperAdmin ? 5 : 4} className="text-center py-12 text-slate-400 text-sm">Tidak ada pengguna ditemukan.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </CardContent>
  </Card>
);

const CompanyTable = ({ companies, loading, companyStats, onEdit, onEditSub, onDelete, openSheets }) => (
  <div className="space-y-5">
    {/* Mini stats */}
    <div className="grid grid-cols-3 gap-4">
      {[
        { label: 'Total Tenant', value: companyStats.total, color: 'text-[#011e4b] dark:text-blue-300' },
        { label: 'Aktif', value: companyStats.active, color: 'text-emerald-600 dark:text-emerald-300' },
        { label: 'Expired/Kunci', value: companyStats.expired, color: 'text-amber-600 dark:text-amber-300' },
      ].map(s => (
        <Card key={s.label} className="rounded-2xl border-slate-200/60 dark:border-slate-700 shadow-sm">
          <CardContent className="p-4 text-center">
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">{s.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>

    <Card className="rounded-2xl border-slate-200/60 dark:border-slate-700 shadow-sm overflow-hidden">
      <CardHeader className="border-b border-slate-100 dark:border-slate-700 p-5 bg-slate-50/50 dark:bg-slate-800/30">
        <CardTitle className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-slate-500" /> Direktori Perusahaan
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center items-center h-32"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                <TableRow className="border-slate-100 dark:border-slate-700">
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 px-5">Perusahaan</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400">Paket</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400">Status</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400">Masa Aktif</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400">Dibuat</TableHead>
                  <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-center">Langganan</TableHead>
                  <TableHead className="text-center font-semibold text-slate-600 dark:text-slate-400 px-5">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map(c => {
                  const isExpired = !c.is_manually_locked && (!c.subscription_end_date || new Date(c.subscription_end_date) <= new Date());
                  const isActive = !c.is_manually_locked && c.subscription_end_date && new Date(c.subscription_end_date) > new Date();
                  return (
                    <TableRow key={c.id} className="border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <TableCell className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-[#011e4b] flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {c.name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">{c.name}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[200px]">{c.address || '—'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5">
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{c.subscription_plans?.name || <span className="italic text-slate-400">Custom</span>}</span>
                      </TableCell>
                      <TableCell className="py-3.5">
                        <Badge className={`text-[10px] font-semibold border-0 ${c.is_manually_locked ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                          {c.is_manually_locked ? 'SUSPENDED' : isActive ? 'ACTIVE' : 'EXPIRED'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3.5 text-sm text-slate-600 dark:text-slate-300">{formatDate(c.subscription_end_date)}</TableCell>
                      <TableCell className="py-3.5 text-xs text-slate-500 dark:text-slate-400">{formatDate(c.created_at)}</TableCell>
                      {/* Subscription column */}
                      <TableCell className="py-3.5 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-3 rounded-lg border-[#011e4b]/30 text-[#011e4b] dark:border-blue-400/30 dark:text-blue-300 hover:bg-[#011e4b] hover:text-white text-xs font-semibold gap-1.5 transition-colors"
                          onClick={() => onEditSub(c)}
                        >
                          <CalendarClock className="h-3.5 w-3.5" />
                          Atur
                        </Button>
                      </TableCell>
                      <TableCell className="px-5 py-3.5">
                        <div className="flex gap-1.5 justify-center">
                          <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-lg border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200" onClick={() => onEdit(c)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {c.google_sheets_link && (
                            <Button variant="outline" size="sm" className="h-8 px-2.5 rounded-lg border-slate-200 text-xs text-slate-500 hover:text-green-600" onClick={() => openSheets(c.google_sheets_link, c.id)}>
                              Sheets
                            </Button>
                          )}
                          <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-lg border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200" onClick={() => onDelete(c.id, c.name)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {companies.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-12 text-slate-400 text-sm">Tidak ada perusahaan.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  </div>
);

export default UserManagementPage;
