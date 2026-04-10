import { useState, useEffect } from 'react';
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
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'react-hot-toast';
import { Loader2, PlusCircle, Pencil, Trash2, ArrowUp, ArrowDown, Copy } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

const CustomerStatusSettings = () => {
  const { loading: authLoading, companyId } = useAuth();
  
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false); // State khusus untuk loading tombol aksi

  // State untuk Modal Tambah/Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(null);
  const [statusName, setStatusName] = useState('');
  const [defaultPercentage, setDefaultPercentage] = useState('');

  // State untuk Modal Duplikat
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [statusToDuplicate, setStatusToDuplicate] = useState(null);
  const [newDuplicateName, setNewDuplicateName] = useState('');

  const fetchStatuses = async (currentCompanyId) => {
    setLoading(true);
    if (!currentCompanyId) {
        setLoading(false);
        return;
    }

    const { data, error } = await supabase
      .from('customer_statuses')
      .select('status_name, company_id, sort_order, default_percentage')
      .eq('company_id', currentCompanyId)
      .order('sort_order', { ascending: true });
    
    if (error) {
      console.error('Error fetching customer statuses:', error);
      toast.error('Gagal mengambil data status.');
    } else {
      setStatuses(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && companyId) {
      fetchStatuses(companyId);
    } else if (!authLoading && !companyId) {
       setLoading(false);
    }
  }, [authLoading, companyId]);

  // --- FUNGSI CREATE / UPDATE ---
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setProcessing(true);
    
    if (!companyId || !statusName) {
      toast.error('Data tidak lengkap.');
      setProcessing(false);
      return;
    }
    
    const percentageValue = defaultPercentage === '' ? null : parseFloat(defaultPercentage);

    try {
      if (currentStatus) {
        // UPDATE
        const { error } = await supabase
          .from('customer_statuses')
          .update({ 
              status_name: statusName,
              default_percentage: percentageValue 
          })
          .eq('status_name', currentStatus.status_name) 
          .eq('company_id', companyId); 
          
        if (error) throw error;
        toast.success('Status berhasil diperbarui.');
      } else {
        // CREATE BARU
        const maxSortOrder = statuses.reduce((max, s) => s.sort_order > max ? s.sort_order : max, 0);
        const { error } = await supabase
          .from('customer_statuses')
          .insert([{ 
            status_name: statusName,
            company_id: companyId,
            sort_order: maxSortOrder + 1,
            default_percentage: percentageValue 
          }]);
        if (error) throw error;
        toast.success('Status berhasil ditambahkan.');
      }
      
      await fetchStatuses(companyId); 
      resetForm();
      
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Gagal menyimpan: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };
  
  // --- FUNGSI DUPLIKAT (LOGIC INTI) ---
  const handleDuplicateSubmit = async (e) => {
    e.preventDefault();
    if (!statusToDuplicate || !newDuplicateName) return;
    
    setProcessing(true);
    try {
        // 1. Cek apakah nama baru sudah ada
        const existing = statuses.find(s => s.status_name.toLowerCase() === newDuplicateName.toLowerCase());
        if (existing) {
            throw new Error('Nama status sudah ada. Gunakan nama lain.');
        }

        // 2. Buat Status Baru di customer_statuses
        const maxSortOrder = statuses.reduce((max, s) => s.sort_order > max ? s.sort_order : max, 0);
        
        const { error: insertStatusError } = await supabase
            .from('customer_statuses')
            .insert([{
                status_name: newDuplicateName,
                company_id: companyId,
                sort_order: maxSortOrder + 1,
                default_percentage: statusToDuplicate.default_percentage
            }]);
        
        if (insertStatusError) throw insertStatusError;

        // 3. Ambil semua harga produk yang terhubung dengan status LAMA
        const { data: oldPrices, error: fetchPricesError } = await supabase
            .from('product_prices')
            .select('product_id, price') // Kita hanya butuh product_id dan harganya
            .eq('company_id', companyId)
            .eq('customer_status', statusToDuplicate.status_name);

        if (fetchPricesError) throw fetchPricesError;

        // 4. Jika ada harga khusus, duplikat ke status BARU
        if (oldPrices && oldPrices.length > 0) {
            const newPricesPayload = oldPrices.map(p => ({
                company_id: companyId,
                product_id: p.product_id,
                customer_status: newDuplicateName, // Link ke status baru
                price: p.price
            }));

            const { error: insertPricesError } = await supabase
                .from('product_prices')
                .insert(newPricesPayload);

            if (insertPricesError) throw insertPricesError;
        }

        toast.success(`Berhasil menduplikasi "${statusToDuplicate.status_name}" ke "${newDuplicateName}" beserta harga produknya.`);
        await fetchStatuses(companyId);
        setIsDuplicateModalOpen(false);
        setStatusToDuplicate(null);
        setNewDuplicateName('');

    } catch (error) {
        console.error('Duplicate error:', error);
        toast.error('Gagal menduplikasi: ' + error.message);
    } finally {
        setProcessing(false);
    }
  };

  const openDuplicateModal = (status) => {
      setStatusToDuplicate(status);
      setNewDuplicateName(`${status.status_name} (Copy)`);
      setIsDuplicateModalOpen(true);
  };

  // --- FUNGSI REORDER & DELETE ---
  const handleReorder = async (index, direction) => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === statuses.length - 1)) return;

    const currentItem = statuses[index];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const neighborItem = statuses[newIndex];
    
    try {
        await Promise.all([
            supabase.from('customer_statuses').update({ sort_order: neighborItem.sort_order }).eq('status_name', currentItem.status_name).eq('company_id', companyId),
            supabase.from('customer_statuses').update({ sort_order: currentItem.sort_order }).eq('status_name', neighborItem.status_name).eq('company_id', companyId)
        ]);
        fetchStatuses(companyId);
    } catch (error) {
        toast.error('Gagal mengubah urutan.');
    }
  };

  const handleEditClick = (status) => {
    setCurrentStatus(status);
    setStatusName(status.status_name);
    setDefaultPercentage(status.default_percentage?.toString() ?? ''); 
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (statusName) => {
    if (!window.confirm('Yakin ingin menghapus status ini? Data pelanggan terkait mungkin akan error.')) return;
    setLoading(true);
    try {
      // Hapus harga produk terkait dulu (opsional, tergantung setting foreign key database, tapi aman dilakukan)
      await supabase.from('product_prices').delete().eq('customer_status', statusName).eq('company_id', companyId);

      const { error } = await supabase
        .from('customer_statuses')
        .delete()
        .eq('status_name', statusName)
        .eq('company_id', companyId);
        
      if (error) throw error;
      toast.success('Status dihapus.');
      fetchStatuses(companyId);
    } catch (error) {
      toast.error('Gagal menghapus: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCurrentStatus(null);
    setStatusName('');
    setDefaultPercentage('');
    setIsModalOpen(false);
  };

  if (authLoading || loading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg bg-white">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-[#10182b] text-white rounded-t-lg p-6">
        <CardTitle>Manajemen Status Pelanggan</CardTitle>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button
              className="bg-white text-[#10182b] hover:bg-gray-200"
              onClick={() => { resetForm(); setIsModalOpen(true); }}>
              <PlusCircle className="h-4 w-4 mr-2" /> Tambah Status
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{currentStatus ? 'Edit Status' : 'Tambah Status Baru'}</DialogTitle>
              <DialogDescription>
                {currentStatus ? 'Perbarui informasi status.' : 'Buat status baru.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="status-name">Nama Status</Label>
                <Input
                  id="status-name"
                  value={statusName}
                  onChange={(e) => setStatusName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="default-percentage">Persentase Harga Standar (Opsional)</Label>
                <div className='flex items-center'>
                    <Input
                        id="default-percentage"
                        type="number"
                        placeholder="Contoh: 100"
                        value={defaultPercentage}
                        onChange={(e) => setDefaultPercentage(e.target.value)}
                        className="w-full pr-8"
                        min="0"
                        step="0.01"
                    />
                    <span className="ml-[-25px] text-gray-500 font-semibold">%</span>
                </div>
                <p className='text-xs text-gray-500'>Digunakan untuk kalkulasi otomatis harga produk.</p>
              </div>
              <Button type="submit" className="w-full bg-[#10182b] text-white hover:bg-[#10182b]/90" disabled={processing}>
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : (currentStatus ? 'Simpan Perubahan' : 'Simpan')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      
      <CardContent>
        {statuses.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
             {!companyId ? 'Sesi habis, silakan login ulang.' : 'Belum ada status pelanggan.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Status</TableHead>
                  <TableHead className='text-right'>Persentase</TableHead>
                  <TableHead className='text-center'>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statuses.map((status, index) => (
                  <TableRow key={status.status_name + status.company_id}>
                    <TableCell className="font-medium">{status.status_name}</TableCell>
                    <TableCell className='text-right'>
                      {status.default_percentage !== null ? `${status.default_percentage}%` : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center space-x-1">
                        <Button
                            variant="ghost" size="icon"
                            onClick={() => handleReorder(index, 'up')}
                            disabled={index === 0}
                            title="Naikkan urutan"
                        >
                            <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost" size="icon"
                            onClick={() => handleReorder(index, 'down')}
                            disabled={index === statuses.length - 1}
                            title="Turunkan urutan"
                        >
                            <ArrowDown className="h-4 w-4" />
                        </Button>
                        
                        {/* TOMBOL DUPLIKAT BARU */}
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => openDuplicateModal(status)}
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                          title="Duplikat Status & Harga"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost" size="icon"
                          onClick={() => handleEditClick(status)}
                          title="Edit nama/persentase"
                        >
                          <Pencil className="h-4 w-4 text-orange-500" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => handleDeleteClick(status.status_name)}
                          title="Hapus status"
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

      {/* MODAL KHUSUS DUPLIKAT */}
      <Dialog open={isDuplicateModalOpen} onOpenChange={setIsDuplicateModalOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>Duplikat Status</DialogTitle>
                <DialogDescription>
                    Menyalin status <strong>{statusToDuplicate?.status_name}</strong> beserta seluruh pengaturan harga produk yang terhubung dengannya.
                </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleDuplicateSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="duplicate-name">Nama Status Baru</Label>
                    <Input 
                        id="duplicate-name"
                        value={newDuplicateName}
                        onChange={(e) => setNewDuplicateName(e.target.value)}
                        placeholder="Contoh: Dropshipper Luar Kota"
                        required
                    />
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDuplicateModalOpen(false)}>Batal</Button>
                    <Button type="submit" className="bg-[#10182b] text-white" disabled={processing}>
                        {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                        Duplikat Sekarang
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

    </Card>
  );
};

export default CustomerStatusSettings;