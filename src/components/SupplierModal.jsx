import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import { Loader2, Trash2, Pencil } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const SupplierModal = ({ open, onOpenChange, onSuppliersUpdated }) => {
  const { companyId } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [newSupplierForm, setNewSupplierForm] = useState({ name: '', phone: '', location: '' });
  const [loading, setLoading] = useState(false);
  const [currentSupplier, setCurrentSupplier] = useState(null);
  
  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('company_id', companyId)
      .order('name', { ascending: true });

    if (error) {
      toast.error('Gagal mengambil data supplier.');
      console.error(error);
    } else {
      setSuppliers(data);
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    if (open) {
      fetchSuppliers();
    }
  }, [open, fetchSuppliers]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setNewSupplierForm({ ...newSupplierForm, [name]: value });
  };

  const handleAddOrUpdateSupplier = async (e) => {
    e.preventDefault();
    if (!newSupplierForm.name.trim()) {
      return toast.error('Nama supplier tidak boleh kosong.');
    }
    setLoading(true);

    try {
      if (currentSupplier) {
        const { error } = await supabase
          .from('suppliers')
          .update(newSupplierForm)
          .eq('id', currentSupplier.id);
        if (error) throw error;
        toast.success('Supplier berhasil diperbarui!');
      } else {
        const { error } = await supabase
          .from('suppliers')
          .insert({ ...newSupplierForm, company_id: companyId });
        if (error) throw error;
        toast.success('Supplier berhasil ditambahkan!');
      }

      setNewSupplierForm({ name: '', phone: '', location: '' });
      setCurrentSupplier(null);
      fetchSuppliers();
      onSuppliersUpdated();
    } catch (error) {
      toast.error('Gagal menyimpan data supplier.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSupplier = async (id) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus supplier ini?')) return;
    
    setLoading(true);
    const { error } = await supabase.from('suppliers').delete().eq('id', id);

    if (error) {
      toast.error('Gagal menghapus supplier. Pastikan tidak ada produk yang terhubung.');
      console.error(error);
    } else {
      toast.success('Supplier berhasil dihapus.');
      fetchSuppliers();
      onSuppliersUpdated();
    }
    setLoading(false);
  };
  
  const handleEditClick = (supplier) => {
      setCurrentSupplier(supplier);
      setNewSupplierForm({ name: supplier.name, phone: supplier.phone, location: supplier.location });
  };
  
  const handleCloseModal = (newOpenState) => {
      onOpenChange(newOpenState);
      if (!newOpenState) {
          setCurrentSupplier(null);
          setNewSupplierForm({ name: '', phone: '', location: '' });
      }
  };

  return (
    <Dialog open={open} onOpenChange={handleCloseModal}>
      <DialogContent className="w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 sm:max-w-[90vw] md:max-w-2xl lg:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Kelola Supplier</DialogTitle>
          <DialogDescription>
            Tambah, edit, atau hapus supplier untuk produk Anda.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <form onSubmit={handleAddOrUpdateSupplier} className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-sm sm:text-base">Nama Supplier</Label>
              <Input
                id="name"
                name="name"
                value={newSupplierForm.name}
                onChange={handleFormChange}
                placeholder="Nama Supplier"
                required
                className="text-sm mt-1"
              />
            </div>
            <div>
              <Label htmlFor="phone" className="text-sm sm:text-base">Nomor Telepon</Label>
              <Input
                id="phone"
                name="phone"
                value={newSupplierForm.phone}
                onChange={handleFormChange}
                placeholder="Nomor telepon"
                className="text-sm mt-1"
              />
            </div>
            <div>
              <Label htmlFor="location" className="text-sm sm:text-base">Alamat</Label>
              <Input
                id="location"
                name="location"
                value={newSupplierForm.location}
                onChange={handleFormChange}
                placeholder="Alamat Lengkap"
                className="text-sm mt-1"
              />
            </div>
            <DialogFooter className="mt-6">
              <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : currentSupplier ? 'Perbarui Supplier' : 'Tambah Supplier'}
              </Button>
            </DialogFooter>
          </form>

          <div className="mt-6 pt-4 border-t">
            <h4 className="font-semibold text-sm sm:text-base mb-3">Daftar Supplier</h4>
            {loading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
              </div>
            ) : suppliers.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                Belum ada supplier. Tambahkan supplier baru di form atas.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table className="text-xs sm:text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[100px] sm:min-w-auto">Nama</TableHead>
                      <TableHead className="min-w-[100px] sm:min-w-auto hidden sm:table-cell">Telepon</TableHead>
                      <TableHead className="min-w-[120px] sm:min-w-auto hidden md:table-cell">Lokasi</TableHead>
                      <TableHead className="text-right min-w-[80px] sm:min-w-auto">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers.map((supplier) => (
                      <TableRow key={supplier.id} className="hover:bg-gray-50">
                        <TableCell className="truncate font-medium">{supplier.name}</TableCell>
                        <TableCell className="truncate hidden sm:table-cell">{supplier.phone || '-'}</TableCell>
                        <TableCell className="truncate hidden md:table-cell">{supplier.location || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1 sm:gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 sm:h-9 sm:w-9"
                              onClick={() => handleEditClick(supplier)}
                              title="Edit"
                            >
                              <Pencil className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="icon"
                              className="h-8 w-8 sm:h-9 sm:w-9"
                              onClick={() => handleDeleteSupplier(supplier.id)}
                              title="Hapus"
                            >
                              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SupplierModal;