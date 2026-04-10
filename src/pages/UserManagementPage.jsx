import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'react-hot-toast';
import AddUserForm from '@/components/AddUserForm';
import AddAdminForm from '@/components/AddAdminForm';
import EditUserForm from '@/components/EditUserForm';
import { Loader2, Pencil, Trash2, Users } from 'lucide-react'; // CalendarCheck dihapus
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// --- UI KOMPONEN LANGGANAN DIHAPUS ---
// import { Switch } from '@/components/ui/switch'; 
// import SubscriptionExtensionForm from '../components/SubscriptionExtensionForm'; 
// -----------------------------

// Helper untuk format mata uang
const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(parseFloat(amount));
};

// Helper untuk format tanggal
const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};


const UserManagementPage = () => {
  const { session, userRole, companyId } = useAuth();

  const isSuperAdmin = userRole === 'super_admin';

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);
  const [isEditCompanyModalOpen, setIsEditCompanyModalOpen] = useState(false);
  const [companyToEdit, setCompanyToEdit] = useState(null);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyAddress, setNewCompanyAddress] = useState('');
  const [isCompanySubmitting, setIsCompanySubmitting] = useState(false);
  
  // --- STATE LANGGANAN DIHAPUS ---
  // const [isDialogOpen, setIsDialogOpen] = useState(false);
  // const [selectedUser, setSelectedUser] = useState(null);
  // -----------------------

  useEffect(() => {
    if (!session) return;
    fetchUsers();
    if (isSuperAdmin) {
      fetchCompanies();
    }
  }, [session, userRole, companyId, isSuperAdmin]);

  /* ------------------------- FETCHERS ------------------------- */

  const fetchUsers = async () => {
    setLoadingUsers(true);
    
    // Query yang sangat stabil (hanya profiles)
    const { data, error } = await supabase
        .from('profiles')
        .select('id,full_name,role,phone,rekening,base_salary,company_id') // Kolom langganan dihapus
        .order('role', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      toast.error(`Gagal mengambil data pengguna: ${error.message}`); 
      setUsers([]);
    } else {
        setUsers(data ?? []);
    }
    setLoadingUsers(false);
  };

  const fetchCompanies = async () => {
    setLoadingCompanies(true);
    // Query hanya mengambil info dasar perusahaan (langganan dipindahkan ke BillingAccountPage)
    const { data, error } = await supabase
      .from('companies')
      .select('id, name, created_at, google_sheets_link, address') 
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching companies:', error);
      toast.error('Gagal mengambil data perusahaan.');
      setCompanies(data ?? []);
    } else {
      setCompanies(data ?? []);
    }
    setLoadingCompanies(false);
  };

  /* ------------------------- HANDLERS ------------------------- */
  
  // Handlers Langganan Dihapus
  // const handleToggleCompanyLock = async (company) => { ... }
  // const handleEditCompanySubscription = (company) => { ... }
    
  const handleRoleChange = async (userId, newRole) => {
    if (userId === session.user.id) {
      toast.error('Anda tidak bisa mengubah peran diri sendiri.');
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) {
      console.error('Error updating user role:', error);
      toast.error('Gagal mengubah peran pengguna.');
    } else {
      toast.success('Peran pengguna berhasil diubah!');
      setUsers((prev) => prev.map(u => (u.id === userId ? { ...u, role: newRole } : u)));
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus pengguna ini?')) return;
    if (userId === session.user.id) {
      toast.error('Anda tidak bisa menghapus akun Anda sendiri.');
      return;
    }

    setLoadingUsers(true);
    try {
      const response = await fetch('https://wzmgcainyratlwxttdau.supabase.co/functions/v1/delete-user', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`, 
        },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      toast.success('Pengguna berhasil dihapus.');
      setUsers((prev) => prev.filter(u => u.id !== userId));
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Gagal menghapus pengguna: ' + error.message);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleEditUser = (user) => {
    setUserToEdit(user);
    setIsEditModalOpen(true);
  };

  const handleUserUpdated = (updatedUser) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === updatedUser.id ? { ...u, ...updatedUser } : u))
    );
    setIsEditModalOpen(false);
  };
  
  const handleDeleteCompany = async (id, name) => {
    const ok = window.confirm(
      `Hapus perusahaan “${name}”? Semua data terkait mungkin ikut terhapus sesuai aturan FK.`
    );
    if (!ok) return;

    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Gagal hapus perusahaan:', error);
      toast.error('Gagal menghapus perusahaan.');
    } else {
      toast.success('Perusahaan berhasil dihapus.');
      setCompanies((prev) => prev.filter((c) => c.id !== id));
      fetchUsers();
    }
  };

  const handleUserAdded = () => {
    fetchUsers();
    if (isSuperAdmin) fetchCompanies();
  };
  
  const openGoogleSheets = (link, companyId) => {
      if (link) {
        window.open(`${link}?company_id=${companyId}`, '_blank');
      } else {
        toast.error('Tautan Google Sheets tidak tersedia untuk perusahaan ini.');
      }
  };
  
  const handleEditCompany = (company) => {
      setCompanyToEdit(company);
      setNewCompanyName(company.name);
      setNewCompanyAddress(company.address || '');
      setIsEditCompanyModalOpen(true);
  };

  const handleCompanyUpdateSubmit = async (e) => {
      e.preventDefault();
      if (!companyToEdit) return;
      setIsCompanySubmitting(true);

      try {
          const { data, error } = await supabase
              .from('companies')
              .update({ 
                  name: newCompanyName, 
                  address: newCompanyAddress 
              })
              .eq('id', companyToEdit.id)
              .select()
              .single();

          if (error) throw error;

          toast.success(`Perusahaan ${newCompanyName} berhasil diperbarui.`);
          
          setCompanies((prev) => 
              prev.map(c => (c.id === companyToEdit.id ? { ...c, name: data.name, address: data.address } : c))
          );
          
          setIsEditCompanyModalOpen(false);
          setCompanyToEdit(null);
      } catch (error) {
          console.error('Error updating company:', error);
          toast.error('Gagal memperbarui perusahaan: ' + error.message);
      } finally {
          setIsCompanySubmitting(false);
      }
  };


  const filteredUsers = useMemo(() => {
    let result = users;

    if (isSuperAdmin && selectedCompanyId !== 'all') {
      result = result.filter(user => user.company_id === selectedCompanyId);
    }
    
    if (userRole === 'admin') {
      result = result.filter(user => 
          user.company_id === companyId && 
          user.role === 'user' 
      );
    }
    
    return result;
  }, [users, selectedCompanyId, userRole, companyId, isSuperAdmin]); 

  /* ------------------------- RENDER ------------------------- */

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold">Manajemen Pengguna</h2>
        {isSuperAdmin ? (
          <Button 
            onClick={() => setIsAddModalOpen(true)}
            className="w-full sm:w-auto bg-[#10182b] text-white hover:bg-[#10182b]/90"
          >
            + Tambah Admin
          </Button>
        ) : userRole === 'admin' ? (
          <Button 
            onClick={() => setIsAddModalOpen(true)}
            className="w-full sm:w-auto bg-[#10182b] text-white hover:bg-[#10182b]/90"
          >
            + Tambah Pengguna
          </Button>
        ) : null}
      </div>

      {isSuperAdmin ? (
        <AddAdminForm
          open={isAddModalOpen}
          onOpenChange={setIsAddModalOpen}
          onUserAdded={handleUserAdded}
        />
      ) : (
        <AddUserForm
          open={isAddModalOpen}
          onOpenChange={setIsAddModalOpen}
          onUserAdded={handleUserAdded}
        />
      )}
      
      {userToEdit && (
        <EditUserForm
          open={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          userToEdit={userToEdit}
          onUserUpdated={handleUserUpdated}
        />
      )}

      <Card className="mb-8 border-0 shadow-lg bg-white">
        <CardHeader className="bg-[#10182b] text-white rounded-t-lg">
          <CardTitle className='flex items-center gap-2'>
            <Users className="h-5 w-5" /> Daftar Pengguna
          </CardTitle>
          <CardDescription className="text-gray-200">Kelola daftar pengguna yang ada di sistem.</CardDescription>
        </CardHeader>
        <CardContent className='p-2 md:p-4'>
          {isSuperAdmin && (
              <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm font-medium text-gray-700">Filter Perusahaan:</span>
                  <Select
                      value={selectedCompanyId}
                      onValueChange={setSelectedCompanyId}
                      disabled={loadingCompanies}
                  >
                      <SelectTrigger className="w-[250px]">
                          <SelectValue placeholder="Pilih Perusahaan" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="all">Semua Perusahaan</SelectItem>
                          {companies.map(c => (
                              <SelectItem key={c.id} value={c.id}>
                                  {c.name}
                              </SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
              </div>
          )}
          {loadingUsers ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">Nama Lengkap</TableHead>
                    <TableHead className="min-w-[150px]">Peran</TableHead>
                    <TableHead className="min-w-[150px]">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => {
                     
                     return (
                        <TableRow key={user.id}>
                          <TableCell>{user.full_name ?? '-'}</TableCell>
                          <TableCell>
                            <Select
                              value={user.role}
                              onValueChange={(newRole) => handleRoleChange(user.id, newRole)}
                              disabled={user.id === session.user.id || user.role === 'super_admin' || user.role === 'admin'}
                            >
                              <SelectTrigger className="w-[160px]">
                                <SelectValue placeholder="Pilih Peran" />
                              </SelectTrigger>
                              <SelectContent>
                                {isSuperAdmin ? (
                                  <>
                                    <SelectItem value="super_admin">Super Admin</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="user">User</SelectItem>
                                  </>
                                ) : (
                                  <SelectItem value="user">User</SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          
                          <TableCell>
                            <div className="flex gap-2 items-center">
                                
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditUser(user)}
                                  disabled={userRole === 'admin' && (user.role === 'admin' || user.role === 'super_admin')}
                                >
                                  <Pencil className="h-4 w-4 text-blue-500" />
                                </Button>
                                 <Button
                                  variant="destructive"
                                  size="icon"
                                  onClick={() => handleDeleteUser(user.id)}
                                  disabled={user.id === session.user.id || (userRole === 'admin' && (user.role === 'admin' || user.role === 'super_admin'))}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                  })}
                  {filteredUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8"> 
                        Tidak ada data.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* COMPANIES TABLE – Manajemen Info Perusahaan */}
      {isSuperAdmin && (
        <Card className="border-0 shadow-lg bg-white">
          <CardHeader className="bg-gradient-to-r from-gray-100 to-gray-50 rounded-t-lg border-b">
            <CardTitle>Manajemen Info Perusahaan</CardTitle>
            <CardDescription className="text-gray-600">Kelola informasi dasar perusahaan.</CardDescription>
          </CardHeader>
          <CardContent className='p-2 md:p-4'>
            {loadingCompanies ? (
              <div className="flex justify-center items-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Nama Perusahaan</TableHead>
                      <TableHead className="min-w-[250px]">Alamat Perusahaan</TableHead>
                      <TableHead className="min-w-[150px]">Dibuat</TableHead>
                      <TableHead className="min-w-[120px]">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.name}</TableCell>
                        <TableCell>{c.address ?? '-'}</TableCell>
                        <TableCell>{new Date(c.created_at).toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {/* Aksi Edit/Delete Perusahaan Dikembalikan */}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditCompany(c)}
                                title="Edit Perusahaan"
                            >
                                <Pencil className="h-4 w-4 text-blue-500" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openGoogleSheets(c.google_sheets_link, c.id)}
                            >
                              Lihat Spreadsheet
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => handleDeleteCompany(c.id, c.name)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {companies.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Tidak ada perusahaan.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* NEW: Company Edit Modal */}
      <Dialog open={isEditCompanyModalOpen} onOpenChange={setIsEditCompanyModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Perusahaan: {companyToEdit?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCompanyUpdateSubmit} className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Nama Perusahaan</Label>
              <Input
                id="companyName"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyAddress">Alamat Perusahaan</Label>
              <Input
                id="companyAddress"
                value={newCompanyAddress}
                onChange={(e) => setNewCompanyAddress(e.target.value)}
                placeholder="Masukkan alamat"
              />
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditCompanyModalOpen(false)}>Batal</Button>
              <Button type="submit" disabled={isCompanySubmitting}>
                {isCompanySubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Simpan Perubahan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Modal Langganan Dihapus dari sini */}
      
    </div>
  );
};

export default UserManagementPage;