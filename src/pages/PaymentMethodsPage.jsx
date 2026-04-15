import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'react-hot-toast';
import { Loader2, PlusCircle, PenLine, Trash2, Banknote, CreditCard, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge'; 
import { Checkbox } from '@/components/ui/checkbox'; // Asumsi ini ada
import { ScrollArea } from '@/components/ui/scroll-area'; // Asumsi ini ada

// ==========================================================
// NEW COMPONENT: Permission Management Form
// ==========================================================
const PermissionForm = ({ method, users, onClose, onSave }) => {
    // Gunakan useMemo untuk memastikan selectedIds adalah array non-null dari awal
    const initialSelectedIds = useMemo(() => method.view_permissions || [], [method.view_permissions]);
    const [selectedIds, setSelectedIds] = useState(initialSelectedIds);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleCheckboxChange = (userId) => {
        setSelectedIds(prev => {
            if (prev.includes(userId)) {
                return prev.filter(id => id !== userId);
            } else {
                return [...prev, userId];
            }
        });
    };

    const handleSelectAll = (checked) => {
        if (checked) {
            setSelectedIds(users.map(u => u.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSave = async () => {
        setIsSubmitting(true);
        // Simpan array ID pengguna ke kolom view_permissions
        const { error } = await supabase
            .from('payment_methods')
            .update({ view_permissions: selectedIds })
            .eq('id', method.id);

        setIsSubmitting(false);

        if (error) {
            toast.error(`Gagal menyimpan izin: ${error.message}`);
        } else {
            toast.success(`Izin untuk ${method.method_name} berhasil diperbarui!`);
            onSave();
            onClose();
        }
    };

    const isAllSelected = selectedIds.length === users.length;

    return (
        <div className="grid gap-4 py-4">
            <h3 className="font-semibold text-lg">{method.method_name}</h3>
            <p className="text-sm text-muted-foreground">Pilih pengguna yang diizinkan melihat saldo dan riwayat transaksi untuk metode ini.</p>
            
            <div className="flex items-center space-x-2 border-b pb-2">
                 <Checkbox
                    id="selectAll"
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                 />
                 <label htmlFor="selectAll" className="text-sm font-medium leading-none cursor-pointer">
                    Pilih Semua ({users.length})
                 </label>
            </div>

            <ScrollArea className="h-[250px] pr-4">
                <div className="grid gap-2">
                    {users.map(user => (
                        <div key={user.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md">
                            <Label htmlFor={`user-${user.id}`} className="text-sm cursor-pointer">
                                {user.full_name} ({user.role})
                            </Label>
                            <Checkbox
                                id={`user-${user.id}`}
                                checked={selectedIds.includes(user.id)}
                                onCheckedChange={() => handleCheckboxChange(user.id)}
                            />
                        </div>
                    ))}
                </div>
            </ScrollArea>

            <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
                <Button onClick={handleSave} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 'Simpan Izin'}
                </Button>
            </DialogFooter>
        </div>
    );
};
// ==========================================================

const PaymentMethodsPage = () => {
  const { userProfile, companyId } = useAuth();
  const [methods, setMethods] = useState([]);
  const [companyUsers, setCompanyUsers] = useState([]); // State untuk menyimpan daftar user
  const [loading, setLoading] = useState(true);
  const [isMethodModalOpen, setIsMethodModalOpen] = useState(false); // Modal Add/Edit Method
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false); // Modal Permissions
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentMethod, setCurrentMethod] = useState(null);
  const [formState, setFormState] = useState({
    method_name: '',
    type: 'cash',
    account_name: '',
    account_number: '',
  });

  const isEditable = userProfile?.role === 'super_admin' || userProfile?.role === 'admin';

  useEffect(() => {
    if (isEditable) {
      fetchPaymentMethods();
      fetchCompanyUsers(); // Ambil daftar user saat halaman dimuat
    } else {
      setLoading(false);
    }
  }, [userProfile, companyId, isEditable]);

  const fetchPaymentMethods = async () => {
    setLoading(true);
    // Pastikan kita select kolom view_permissions
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*, view_permissions') 
      .eq('company_id', companyId)
      .order('type', { ascending: false });

    if (error) {
      console.error('Error fetching payment methods:', error);
      toast.error('Gagal memuat metode pembayaran.');
      setMethods([]);
    } else {
      setMethods(data);
    }
    setLoading(false);
  };
  
  const fetchCompanyUsers = async () => {
      // Ambil semua user di company ini (hanya yang aktif)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('company_id', companyId)
        // Filter user yang mungkin dibutuhkan (admin dan user, bukan super admin)
        .in('role', ['admin', 'user']); 

      if (error) {
        console.error('Error fetching company users:', error);
        setCompanyUsers([]);
      } else {
        setCompanyUsers(data || []);
      }
  };


  const handleOpenMethodModal = (method = null) => {
    setCurrentMethod(method);
    if (method) {
      setFormState({
        method_name: method.method_name,
        type: method.type,
        account_name: method.account_name || '',
        account_number: method.account_number || '',
      });
    } else {
      setFormState({
        method_name: '',
        type: 'cash',
        account_name: '',
        account_number: '',
      });
    }
    setIsMethodModalOpen(true);
  };

  const handleCloseMethodModal = () => {
    setIsMethodModalOpen(false);
    setCurrentMethod(null);
  };
  
  const handleOpenPermissionModal = (method) => {
      setCurrentMethod(method);
      setIsPermissionModalOpen(true);
  };
  
  const handleClosePermissionModal = () => {
      setIsPermissionModalOpen(false);
      setCurrentMethod(null);
  };


  const handleFormChange = (e) => {
    const { id, value } = e.target;
    setFormState((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const dataToSave = {
      company_id: companyId,
      ...formState,
      account_name: formState.type === 'transfer' ? formState.account_name : null,
      account_number: formState.type === 'transfer' ? formState.account_number : null,
    };
    
    // Pastikan view_permissions tidak diubah saat Edit/Add method utama
    if (currentMethod) {
        dataToSave.view_permissions = currentMethod.view_permissions;
    }


    let error;
    if (currentMethod) {
      // Update method
      ({ error } = await supabase
        .from('payment_methods')
        .update(dataToSave)
        .eq('id', currentMethod.id));
    } else {
      // Add new method
      ({ error } = await supabase
        .from('payment_methods')
        .insert(dataToSave));
    }

    if (error) {
      console.error('Error saving payment method:', error);
      toast.error('Gagal menyimpan metode pembayaran.');
    } else {
      toast.success(`Metode pembayaran berhasil ${currentMethod ? 'diperbarui' : 'ditambahkan'}!`);
      fetchPaymentMethods();
      handleCloseMethodModal();
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (methodId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus metode pembayaran ini?')) {
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', methodId);

    if (error) {
      console.error('Error deleting payment method:', error);
      toast.error('Gagal menghapus metode pembayaran.');
    } else {
      toast.success('Metode pembayaran berhasil dihapus!');
      fetchPaymentMethods();
    }
    setLoading(false);
  };
  
  const formatUserList = (permissions) => {
      if (!permissions || permissions.length === 0) {
          return <Badge variant="destructive" className="text-[10px] whitespace-nowrap">Izin Belum Diset</Badge>;
      }
      const names = permissions.map(id => companyUsers.find(u => u.id === id)?.full_name).filter(Boolean);
      return (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
              {names.length} pengguna ({names.slice(0, 2).join(', ')}{names.length > 2 ? '...' : ''})
          </span>
      );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#011e4b]" />
      </div>
    );
  }
  
  if (!isEditable) {
      return <div className="text-red-500">Akses ditolak. Hanya Admin dan Super Admin yang dapat mengelola metode pembayaran.</div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">Manajemen Metode Pembayaran</h1>
        <Button onClick={() => handleOpenMethodModal()} className="w-full sm:w-auto bg-[#011e4b] text-white hover:bg-[#011e4b]/90">
          <PlusCircle className="h-4 w-4 mr-2" />
          Tambah Metode
        </Button>
      </div>

      <Card className="border-0 shadow-lg bg-white">
        <CardHeader className="bg-[#011e4b] text-white rounded-t-lg">
          <CardTitle>Daftar Metode Pembayaran</CardTitle>
          <CardDescription className="text-gray-200">
            Kelola metode pembayaran yang tersedia dan izin akses Laporan Keuangan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {methods.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Banknote className="h-12 w-12 mx-auto mb-4" />
              <p>Belum ada metode pembayaran yang ditambahkan.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">Nama Metode</TableHead>
                    <TableHead className="min-w-[100px]">Tipe</TableHead>
                    <TableHead className="min-w-[150px]">Nama Akun</TableHead>
                    <TableHead className="min-w-[150px]">Nomor Akun</TableHead>
                    <TableHead className="min-w-[150px]">Izin Akses Laporan</TableHead> {/* NEW COLUMN */}
                    <TableHead className="text-right min-w-[100px]">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {methods.map((method) => (
                    <TableRow key={method.id}>
                      <TableCell className="font-medium">{method.method_name}</TableCell>
                      <TableCell>
                        <Badge variant={method.type === 'transfer' ? 'default' : 'secondary'}>
                          {method.type.charAt(0).toUpperCase() + method.type.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>{method.account_name || '-'}</TableCell>
                      <TableCell>{method.account_number || '-'}</TableCell>
                      <TableCell>
                          {formatUserList(method.view_permissions)}
                          <Button 
                              variant="link" 
                              size="sm" 
                              onClick={() => handleOpenPermissionModal(method)}
                              className="p-0 h-auto ml-2 text-blue-500 text-xs font-normal"
                          >
                            <Eye className="h-3 w-3 mr-1" /> Atur Izin
                          </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleOpenMethodModal(method)}
                          >
                            <PenLine className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDelete(method.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Add/Edit Method */}
      <Dialog open={isMethodModalOpen} onOpenChange={setIsMethodModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{currentMethod ? 'Edit' : 'Tambah'} Metode Pembayaran</DialogTitle>
            <DialogDescription>
              Lengkapi detail metode pembayaran.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="method_name">Nama Metode</Label>
              <Input
                id="method_name"
                value={formState.method_name}
                onChange={handleFormChange}
                placeholder="mis. Transfer BCA, Uang Tunai"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="type">Tipe</Label>
              <Select
                value={formState.type}
                onValueChange={(value) => setFormState((prev) => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih tipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Tunai (Cash)</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formState.type === 'transfer' && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="account_name">Nama Pemilik Akun</Label>
                  <Input
                    id="account_name"
                    value={formState.account_name}
                    onChange={handleFormChange}
                    placeholder="mis. PT. Tirta Segar"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="account_number">Nomor Rekening</Label>
                  <Input
                    id="account_number"
                    value={formState.account_number}
                    onChange={handleFormChange}
                    placeholder="mis. 1234567890"
                    required
                  />
                </div>
              </>
            )}
            <DialogFooter className="mt-4">
              <Button type="submit" disabled={isSubmitting} className="w-full bg-[#011e4b] text-white hover:bg-[#011e4b]/90">
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  'Simpan'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Modal Atur Izin Akses */}
      <Dialog open={isPermissionModalOpen} onOpenChange={setIsPermissionModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Atur Izin Lihat Metode</DialogTitle>
            <DialogDescription>
              {currentMethod?.method_name} ({currentMethod?.type})
            </DialogDescription>
          </DialogHeader>
          {currentMethod && (
              <PermissionForm 
                  method={currentMethod}
                  users={companyUsers}
                  onClose={handleClosePermissionModal}
                  onSave={fetchPaymentMethods} // Refresh data setelah save
              />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentMethodsPage;