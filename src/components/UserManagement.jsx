import React, { useEffect, useState } from 'react';
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
import { toast } from 'react-hot-toast';
import AddUserForm from '@/components/AddUserForm';
import EditUserForm from '@/components/EditUserForm'; 
import { Loader2, Users, CalendarCheck, Pencil, Trash2, Phone, CreditCard, Banknote } from 'lucide-react';
import { Switch } from '@/components/ui/switch'; 
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'; 
import SubscriptionExtensionForm from './SubscriptionExtensionForm';

const UserManagementComponent = () => {
  const { session, userProfile } = useAuth(); 
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const isSuperAdmin = userProfile?.role === 'super_admin';

  useEffect(() => {
    if (session && userProfile) {
        fetchUsers();
    }
  }, [session, userProfile]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
        let query = supabase
            .from('profiles')
            .select(`id, full_name, role, phone, rekening, base_salary, company_id, subscription_end_date, is_manually_locked`);

        if (!isSuperAdmin && userProfile?.company_id) {
            query = query.eq('company_id', userProfile.company_id);
        }

        const { data, error } = await query.order('role', { ascending: false });
        if (error) throw error;
        setUsers(data ?? []);
    } catch (error) {
        console.error('Fetch Error:', error);
        toast.error('Gagal mengambil data pengguna');
    } finally {
        setLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Yakin hapus pengguna ini?')) return;
    try {
        const { error } = await supabase.functions.invoke('delete-user', {
            body: { userId }
        });
        if (error) throw error;
        toast.success('Pengguna berhasil dihapus');
        fetchUsers();
    } catch (err) {
        toast.error('Gagal menghapus pengguna');
    }
  };

  const handleToggleLock = async (user) => {
    if (!isSuperAdmin) return;
    const { error } = await supabase
        .from('profiles')
        .update({ is_manually_locked: !user.is_manually_locked })
        .eq('id', user.id);
    
    if (error) toast.error('Gagal mengubah status kunci');
    else fetchUsers();
  };

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-xl font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-[#011e4b]" /> 
            <span className="hidden sm:inline">Manajemen Pengguna</span>
            <span className="sm:hidden text-lg">User List</span>
        </h2>
        <Button onClick={() => setIsAddModalOpen(true)} className="bg-[#011e4b] text-white h-9">
          + <span className="hidden sm:inline ml-1">Tambah User</span>
        </Button>
      </div>

      <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="w-[200px]">Detail User</TableHead>
              <TableHead className="hidden md:table-cell">Kontak & Rekening</TableHead>
              <TableHead className="hidden lg:table-cell text-right">Gaji Pokok</TableHead>
              {isSuperAdmin && (
                <>
                  <TableHead className="text-center hidden sm:table-cell">Akses</TableHead>
                  <TableHead className="text-center">Kunci</TableHead>
                </>
              )}
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} className="hover:bg-slate-50/50 transition-colors">
                {/* Kolom Nama & Role (Mobile Friendly) */}
                <TableCell>
                  <div className="font-bold text-slate-900 leading-tight">{user.full_name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                        user.role === 'super_admin' ? 'bg-purple-100 text-purple-700' : 
                        user.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                        {user.role}
                    </span>
                    {/* Munculkan no HP di bawah nama khusus mobile */}
                    <span className="md:hidden text-[11px] text-slate-500 flex items-center">
                        <Phone className="w-3 h-3 mr-1" /> {user.phone || '-'}
                    </span>
                  </div>
                </TableCell>

                {/* Kolom Kontak & Rekening (Desktop Only) */}
                <TableCell className="hidden md:table-cell">
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center text-slate-600">
                      <Phone className="w-3.5 h-3.5 mr-2 text-slate-400" /> {user.phone || '-'}
                    </div>
                    <div className="flex items-center text-slate-600">
                      <CreditCard className="w-3.5 h-3.5 mr-2 text-slate-400" /> {user.rekening || '-'}
                    </div>
                  </div>
                </TableCell>

                {/* Kolom Gaji (Desktop Only) */}
                <TableCell className="hidden lg:table-cell text-right">
                   <div className="flex items-center justify-end font-medium text-slate-700">
                      <Banknote className="w-4 h-4 mr-1 text-green-500" />
                      {user.base_salary ? `Rp ${user.base_salary.toLocaleString('id-ID')}` : '-'}
                   </div>
                </TableCell>

                {/* Status Akses (Super Admin Only) */}
                {isSuperAdmin && (
                  <>
                    <TableCell className="text-center hidden sm:table-cell">
                      <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${user.is_manually_locked ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                        {user.is_manually_locked ? 'DIBATASI' : 'AKTIF'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch 
                        checked={user.is_manually_locked} 
                        onCheckedChange={() => handleToggleLock(user)}
                        disabled={user.role === 'super_admin'}
                      />
                    </TableCell>
                  </>
                )}

                <TableCell className="text-right space-x-1 sm:space-x-2">
                  <Button 
                    variant="outline" size="sm" className="h-8 w-8 p-0 border-slate-200"
                    onClick={() => { setSelectedUser(user); setIsEditModalOpen(true); }}
                    title="Edit User"
                  >
                    <Pencil className="h-3.5 w-3.5 text-blue-600" />
                  </Button>

                  {isSuperAdmin && user.role !== 'super_admin' && (
                    <Button 
                      variant="outline" size="sm" className="h-8 w-8 p-0 border-slate-200"
                      onClick={() => { setSelectedUser(user); setIsSubModalOpen(true); }}
                      title="Atur Masa Aktif"
                    >
                      <CalendarCheck className="h-3.5 w-3.5 text-orange-600" />
                    </Button>
                  )}

                  <Button 
                    variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => handleDeleteUser(user.id)}
                    disabled={user.id === session.user.id}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Modals */}
      <AddUserForm open={isAddModalOpen} onOpenChange={setIsAddModalOpen} onUserAdded={fetchUsers} />
      
      {selectedUser && (
        <>
          <EditUserForm 
            open={isEditModalOpen} 
            onOpenChange={setIsEditModalOpen} 
            user={selectedUser} 
            onUserUpdated={fetchUsers} 
          />
          <Dialog open={isSubModalOpen} onOpenChange={setIsSubModalOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <CalendarCheck className="w-5 h-5 text-orange-600" /> Atur Masa Aktif
                </DialogTitle>
              </DialogHeader>
              <SubscriptionExtensionForm 
                user={selectedUser} 
                onSuccess={() => { setIsSubModalOpen(false); fetchUsers(); }} 
              />
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
};

export default UserManagementComponent;