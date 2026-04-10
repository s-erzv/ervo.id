import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from 'react-hot-toast';
import { Loader2, Plus, Trash, FileText, PiggyBank, Download, ListOrdered, Shield, ImageIcon, Check, ChevronsUpDown } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

// --- HELPER COMPRESSION ---
const MAX_FILE_SIZE = 1 * 1024 * 1024; 
const TARGET_SIZE_MB = 0.5;

const compressImage = (file, targetMB) => {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) return resolve(file);
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxDim = 1600;
                if (width > maxDim || height > maxDim) {
                    const ratio = Math.min(maxDim / width, maxDim / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                let quality = 0.8;
                let blob;
                do {
                    const dataUrl = canvas.toDataURL('image/jpeg', quality);
                    const parts = dataUrl.split(',');
                    const base64Data = parts[1];
                    const binaryString = atob(base64Data);
                    const uint8Array = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        uint8Array[i] = binaryString.charCodeAt(i);
                    }
                    blob = new Blob([uint8Array], { type: 'image/jpeg' });
                    if (blob.size / 1024 / 1024 <= targetMB || quality < 0.1) break;
                    quality -= 0.1;
                } while (quality > 0.05);
                const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + '.jpeg', {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                });
                resolve(compressedFile);
            };
        };
        reader.onerror = (error) => reject(error);
    });
};

const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', { 
        style: 'currency', 
        currency: 'IDR', 
        minimumFractionDigits: 0 
    }).format(amount);
};

// --- KOMPONEN PENGATURAN IZIN ---
const PermissionSettings = ({ companyId }) => {
    const [allUsers, setAllUsers] = useState([]);
    const [allowedUsers, setAllowedUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchSettingsData = async () => {
        setLoading(true);
        try {
            const { data: usersData } = await supabase.from('profiles').select('id, full_name, role').eq('company_id', companyId).in('role', ['user', 'courier']);
            setAllUsers(usersData || []);
            const { data: permissionsData } = await supabase.from('financial_page_permissions').select('user_id, profiles(id, full_name)').eq('company_id', companyId);
            setAllowedUsers(permissionsData?.map(p => p.profiles).filter(Boolean) || []); 
        } catch (error) { toast.error("Gagal memuat izin."); } finally { setLoading(false); }
    };
    useEffect(() => { if (companyId) fetchSettingsData(); }, [companyId]);

    const handleAddPermission = async () => {
        if (!selectedUser) return toast.error("Pilih user.");
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from('financial_page_permissions').insert({ company_id: companyId, user_id: selectedUser });
            if (error) throw error;
            toast.success("Izin ditambahkan.");
            fetchSettingsData();
            setSelectedUser('');
        } catch (error) { toast.error("Gagal menambah izin."); } finally { setIsSubmitting(false); }
    };

    const handleRemovePermission = async (userId) => {
        if (!window.confirm("Hapus izin?")) return;
        try {
            await supabase.from('financial_page_permissions').delete().eq('company_id', companyId).eq('user_id', userId);
            toast.success("Izin dihapus.");
            fetchSettingsData();
        } catch (error) { toast.error("Gagal menghapus izin."); }
    };

    if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>;

    return (
        <Card className="border-0 shadow-lg bg-white">
            <CardHeader className="bg-gray-50 rounded-t-lg"><CardTitle>Pengaturan Izin Akses</CardTitle></CardHeader>
            <CardContent className="p-4 lg:p-6 space-y-6">
                <div className="flex gap-2">
                    <Select value={selectedUser} onValueChange={setSelectedUser}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Pilih user" /></SelectTrigger>
                        <SelectContent>{allUsers.filter(u => !allowedUsers.find(au => au.id === u.id)).map(user => (<SelectItem key={user.id} value={user.id}>{user.full_name} ({user.role})</SelectItem>))}</SelectContent>
                    </Select>
                    <Button onClick={handleAddPermission} disabled={isSubmitting || !selectedUser}>Tambah</Button>
                </div>
                <Separator />
                <div className="rounded-md border">
                    <Table>
                        <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {allowedUsers.map(user => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">{user.full_name}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="destructive" size="sm" onClick={() => handleRemovePermission(user.id)}><Trash className="h-4 w-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};

// --- HALAMAN UTAMA ---
const FinancialManagementPage = () => {
  const { companyId, userProfile } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('expense');
  const [mainTab, setMainTab] = useState('management'); 
  const [isAllowed, setIsAllowed] = useState(false); 
  const [pageLoading, setPageLoading] = useState(true); 

  const [finCategories, setFinCategories] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  
  // Filtering states
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
  
  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(lastDayOfMonth);

  // Combobox Popover states
  const [openCat, setOpenCat] = useState(false);
  const [openSub, setOpenSub] = useState(false);

  // Modal states untuk inline add
  const [isQuickCatOpen, setIsQuickCatOpen] = useState(false);
  const [isQuickSubOpen, setIsQuickSubOpen] = useState(false);
  const [quickCatName, setQuickCatName] = useState('');
  const [quickSubName, setQuickSubName] = useState('');

  const [newTransaction, setNewTransaction] = useState({
    type: 'expense', 
    amount: '', 
    adminFee: '0', 
    description: '', 
    payment_method_id: '',
    category_id: '', 
    subcategory_id: '', 
    proof: null, 
    source_type: 'manual_transaction'
  });

  const isPrivileged = userProfile?.role === 'admin' || userProfile?.role === 'super_admin';

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase.from('financial_categories').select('*, financial_subcategories(*)').eq('company_id', companyId);
    setFinCategories(data || []);
  }, [companyId]);

  const fetchData = async () => {
    setLoading(true);
    await fetchCategories();
    
    const { data: methods } = await supabase.from('payment_methods').select('*').eq('company_id', companyId).eq('is_active', true);
    setPaymentMethods(methods || []);

    let query = supabase
        .from('financial_transactions')
        .select(`
            *, 
            payment_method:payment_method_id (method_name), 
            category:category_id (name), 
            subcategory:subcategory_id (name)
        `)
        .eq('company_id', companyId)
        .order('transaction_date', { ascending: false });

    if (startDate) query = query.gte('transaction_date', startDate);
    if (endDate) query = query.lte('transaction_date', `${endDate}T23:59:59`);

    const { data: allFin, error } = await query;

    if (error) toast.error("Gagal memuat transaksi.");

    const formattedTransactions = allFin?.map(t => ({
        id: t.id, 
        date: t.transaction_date, 
        type: t.type, 
        amount: t.amount, 
        description: t.description, 
        category: t.category?.name || 'Tanpa Kategori', 
        subcategory: t.subcategory?.name || '-', 
        method: t.payment_method?.method_name || '-', 
        source: t.source_table || 'Manual', 
        proofUrl: t.proof_url 
    })) || [];

    setTransactions(formattedTransactions);
    setLoading(false);
  };

  useEffect(() => {
    const checkAccess = async () => {
        setPageLoading(true);
        if (isPrivileged) { setIsAllowed(true); await fetchData(); }
        else {
            const { data } = await supabase.from('financial_page_permissions').select('user_id').eq('company_id', companyId).eq('user_id', userProfile?.id).limit(1);
            if (data?.length > 0) { setIsAllowed(true); await fetchData(); }
            else setIsAllowed(false);
        }
        setPageLoading(false);
    };
    if (companyId && userProfile) checkAccess();
  }, [companyId, userProfile, startDate, endDate]);

  const handleFormChange = (f, v) => {
    setNewTransaction(p => {
        const up = { ...p, [f]: v };
        if (f === 'category_id') up.subcategory_id = '';
        return up;
    });
  };

  // --- Inline Add Handlers ---
  const handleQuickAddCategory = async () => {
      if (!quickCatName) return;
      setIsSubmitting(true);
      try {
          const { data, error } = await supabase.from('financial_categories').insert({
              company_id: companyId,
              name: quickCatName,
              type: activeTab
          }).select().single();
          if (error) throw error;
          await fetchCategories();
          handleFormChange('category_id', data.id);
          setIsQuickCatOpen(false);
          setQuickCatName('');
          toast.success("Kategori baru ditambahkan!");
      } catch (e) { toast.error(e.message); } finally { setIsSubmitting(false); }
  };

  const handleQuickAddSub = async () => {
      if (!quickSubName || !newTransaction.category_id) return;
      setIsSubmitting(true);
      try {
          const { data, error } = await supabase.from('financial_subcategories').insert({
              category_id: newTransaction.category_id,
              name: quickSubName
          }).select().single();
          if (error) throw error;
          await fetchCategories();
          handleFormChange('subcategory_id', data.id);
          setIsQuickSubOpen(false);
          setQuickSubName('');
          toast.success("Sub-kategori ditambahkan!");
      } catch (e) { toast.error(e.message); } finally { setIsSubmitting(false); }
  };

  const handleSubmitTransaction = async (e) => {
      e.preventDefault();
      setIsSubmitting(true);
      
      const amount = parseFloat(newTransaction.amount.replace(/\./g, ''));
      const fee = parseFloat(newTransaction.adminFee.replace(/\./g, '')) || 0;

      if (isNaN(amount) || amount <= 0) {
          toast.error("Jumlah tidak valid");
          setIsSubmitting(false);
          return;
      }

      try {
        let proofUrl = null;
        let fileToUpload = newTransaction.proof;

        if (fileToUpload) {
          if (fileToUpload.type.startsWith('image/') && fileToUpload.size > MAX_FILE_SIZE) {
            toast.loading(`Kompresi gambar...`, { id: 'compressing-fin' });
            fileToUpload = await compressImage(fileToUpload, TARGET_SIZE_MB);
            toast.success('Kompresi berhasil', { id: 'compressing-fin' });
          }
          const filePath = `${companyId}/transactions/${Date.now()}_${fileToUpload.name}`;
          await supabase.storage.from('proofs').upload(filePath, fileToUpload);
          const { data } = supabase.storage.from('proofs').getPublicUrl(filePath);
          proofUrl = data.publicUrl;
        }
        
        const payload = [{
          company_id: companyId, 
          type: newTransaction.type, 
          amount, 
          description: newTransaction.description, 
          payment_method_id: newTransaction.payment_method_id, 
          category_id: newTransaction.category_id || null, 
          subcategory_id: newTransaction.subcategory_id || null, 
          proof_url: proofUrl, 
          source_table: 'manual_transaction',
          transaction_date: new Date()
        }];

        if (fee > 0) {
            payload.push({
                company_id: companyId, 
                type: 'expense', 
                amount: fee,   
                description: `[Biaya Admin] ${newTransaction.description}`, 
                payment_method_id: newTransaction.payment_method_id, 
                source_table: 'admin_fee',
                transaction_date: new Date()
            });
        }

        const { error } = await supabase.from('financial_transactions').insert(payload);
        if (error) throw error;

        toast.success("Transaksi dicatat!");
        setNewTransaction({ type: activeTab, amount: '', adminFee: '0', description: '', payment_method_id: '', category_id: '', subcategory_id: '', proof: null, source_type: 'manual_transaction' });
        fetchData();
      } catch (error) { toast.error("Gagal: " + error.message); } finally { setIsSubmitting(false); }
  };

  const handleExportTransactions = () => {
    const exportData = transactions.map(t => ({
        Tanggal: new Date(t.date).toLocaleDateString('id-ID'),
        Tipe: t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
        Kategori: t.category,
        SubKategori: t.subcategory,
        Jumlah: t.amount,
        Deskripsi: t.description,
        Metode: t.method,
        Sumber: t.source,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transaksi");
    XLSX.writeFile(wb, `Keuangan_${startDate}_sd_${endDate}.xlsx`);
  };

  if (pageLoading) return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-[#10182b]" /></div>;
  if (!isAllowed) return <div className="container mx-auto p-8 text-center text-red-500">Akses ditolak.</div>;

  const filteredFinCategories = finCategories.filter(c => c.type === activeTab);
  const selectedCategoryData = finCategories.find(c => c.id === newTransaction.category_id);

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2"><PiggyBank className="h-6 w-6" /> Manajemen Keuangan</h1>
      
      <Tabs value={mainTab} onValueChange={setMainTab} className="mb-8">
        <TabsList className={`grid w-full ${isPrivileged ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <TabsTrigger value="management" className="gap-2"><ListOrdered className="h-4 w-4" /> Manajemen</TabsTrigger>
          {isPrivileged && <TabsTrigger value="settings" className="gap-2"><Shield className="h-4 w-4" /> Pengaturan Izin</TabsTrigger>}
        </TabsList>
        
        <TabsContent value="management" className="mt-6 space-y-8">
            <Card className="border-0 shadow-lg bg-white overflow-hidden">
              <CardHeader className="bg-[#10182b] text-white">
                <CardTitle className="text-xl flex items-center gap-2"><Plus className="h-5 w-5" /> Catat Transaksi Manual</CardTitle>
              </CardHeader>
              <CardContent className="p-4 lg:p-6">
                <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); handleFormChange('type', v); }}>
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="expense" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">Pengeluaran</TabsTrigger>
                    <TabsTrigger value="income" className="data-[state=active]:bg-green-600 data-[state=active]:text-white">Pemasukan</TabsTrigger>
                  </TabsList>
                </Tabs>

                <form onSubmit={handleSubmitTransaction} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    
                    {/* Kategori Utama Combobox */}
                    <div className="space-y-2 flex flex-col">
                        <Label>Kategori Utama</Label>
                        <Popover open={openCat} onOpenChange={setOpenCat}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={openCat}
                                    className="w-full justify-between font-normal"
                                >
                                    {newTransaction.category_id
                                        ? filteredFinCategories.find((c) => c.id === newTransaction.category_id)?.name
                                        : "Cari/Pilih Kategori..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-full p-0 pointer-events-auto" align="start">
                                <Command>
                                    <CommandInput placeholder="Cari kategori..." />
                                    <CommandList>
                                        <CommandEmpty>Kategori tidak ditemukan.</CommandEmpty>
                                        <CommandGroup>
                                            {filteredFinCategories.map((c) => (
                                                <CommandItem
                                                    key={c.id}
                                                    value={c.name}
                                                    onSelect={() => {
                                                        handleFormChange('category_id', c.id);
                                                        setOpenCat(false);
                                                    }}
                                                >
                                                    <Check className={cn("mr-2 h-4 w-4", newTransaction.category_id === c.id ? "opacity-100" : "opacity-0")} />
                                                    {c.name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                    <Separator />
                                    <div className="p-2">
                                        <Button 
                                            type="button"
                                            variant="ghost" 
                                            size="sm" 
                                            className="w-full justify-start text-blue-600 font-bold"
                                            onClick={() => { setOpenCat(false); setIsQuickCatOpen(true); }}
                                        >
                                            <Plus className="mr-2 h-4 w-4" /> Tambah Kategori Baru
                                        </Button>
                                    </div>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Sub Kategori Combobox */}
                    <div className="space-y-2 flex flex-col">
                        <Label>Sub Kategori</Label>
                        <Popover open={openSub} onOpenChange={setOpenSub}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    disabled={!newTransaction.category_id}
                                    aria-expanded={openSub}
                                    className="w-full justify-between font-normal"
                                >
                                    {newTransaction.subcategory_id
                                        ? selectedCategoryData?.financial_subcategories?.find((s) => s.id === newTransaction.subcategory_id)?.name
                                        : "Cari/Pilih Sub..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-full p-0 pointer-events-auto" align="start">
                                <Command>
                                    <CommandInput placeholder="Cari sub-kategori..." />
                                    <CommandList>
                                        <CommandEmpty>Sub-kategori tidak ditemukan.</CommandEmpty>
                                        <CommandGroup>
                                            {selectedCategoryData?.financial_subcategories?.map((s) => (
                                                <CommandItem
                                                    key={s.id}
                                                    value={s.name}
                                                    onSelect={() => {
                                                        handleFormChange('subcategory_id', s.id);
                                                        setOpenSub(false);
                                                    }}
                                                >
                                                    <Check className={cn("mr-2 h-4 w-4", newTransaction.subcategory_id === s.id ? "opacity-100" : "opacity-0")} />
                                                    {s.name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                    <Separator />
                                    <div className="p-2">
                                        <Button 
                                            type="button"
                                            variant="ghost" 
                                            size="sm" 
                                            className="w-full justify-start text-blue-600 font-bold"
                                            onClick={() => { setOpenSub(false); setIsQuickSubOpen(true); }}
                                        >
                                            <Plus className="mr-2 h-4 w-4" /> Tambah Sub Baru
                                        </Button>
                                    </div>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label>Nominal Pokok</Label>
                      <Input type="text" placeholder="0" value={newTransaction.amount}
                        onChange={(e) => handleFormChange('amount', e.target.value.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, "."))} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Biaya Admin (Opsional)</Label>
                      <Input type="text" placeholder="0" value={newTransaction.adminFee}
                        onChange={(e) => handleFormChange('adminFee', e.target.value.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, "."))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Metode Pembayaran</Label>
                      <Select value={newTransaction.payment_method_id} onValueChange={(v) => handleFormChange('payment_method_id', v)} required>
                        <SelectTrigger><SelectValue placeholder="Pilih metode" /></SelectTrigger>
                        <SelectContent>
                          {paymentMethods.map(m => <SelectItem key={m.id} value={m.id}>{m.method_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Upload Bukti</Label>
                        <Input type="file" onChange={(e) => setNewTransaction(prev => ({...prev, proof: e.target.files[0]}))} accept="image/*" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Keperluan/Deskripsi</Label>
                    <Input type="text" placeholder="Detail transaksi..." value={newTransaction.description} onChange={(e) => handleFormChange('description', e.target.value)} required />
                  </div>

                  <Button type="submit" className="w-full bg-[#10182b] text-white" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Catat Transaksi'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg bg-white">
                <CardHeader className="flex flex-col md:flex-row md:items-center justify-between border-b p-4 gap-4">
                    <CardTitle className="text-xl flex items-center gap-2"><FileText className="h-6 w-6" /> Riwayat Transaksi</CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2">
                            <Label className="text-xs">Dari:</Label>
                            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 w-36 text-xs" />
                        </div>
                        <div className="flex items-center gap-2">
                            <Label className="text-xs">Sampai:</Label>
                            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 w-36 text-xs" />
                        </div>
                        <Button onClick={handleExportTransactions} variant="outline" size="sm" disabled={transactions.length === 0}><Download className="h-4 w-4 mr-2" /> Export Excel</Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto max-h-[500px]">
                        <Table>
                            <TableHeader><TableRow className="bg-gray-50">
                                <TableHead>Tanggal</TableHead>
                                <TableHead>Kategori</TableHead>
                                <TableHead>Jumlah</TableHead>
                                <TableHead>Deskripsi</TableHead>
                                <TableHead>Metode & Bukti</TableHead>
                                <TableHead>Sumber</TableHead>
                            </TableRow></TableHeader>
                            <TableBody>
                                {transactions.length === 0 && (
                                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">Belum ada data.</TableCell></TableRow>
                                )}
                                {transactions.map((t) => (
                                    <TableRow key={t.id}>
                                        <TableCell className="text-xs">{new Date(t.date).toLocaleDateString('id-ID')}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className={`text-[10px] font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{t.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}</span>
                                                <span className="font-medium text-xs text-slate-800">{t.category}</span>
                                                <span className="text-[10px] text-slate-500">{t.subcategory}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-bold text-xs">{formatCurrency(t.amount)}</TableCell>
                                        <TableCell className="text-xs max-w-[200px] truncate" title={t.description}>{t.description}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs">{t.method}</span>
                                                {t.proofUrl && <a href={t.proofUrl} target="_blank" rel="noreferrer" className="text-blue-500"><ImageIcon className="h-4 w-4" /></a>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-[10px] italic text-slate-500 capitalize">{t.source?.replace(/_/g, ' ')}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="settings"><PermissionSettings companyId={companyId} /></TabsContent>
      </Tabs>

      {/* --- QUICK MODAL KATEGORI --- */}
      <Dialog open={isQuickCatOpen} onOpenChange={setIsQuickCatOpen}>
          <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Tambah Kategori Utama ({activeTab === 'income' ? 'Pemasukan' : 'Pengeluaran'})</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                  <div className="space-y-2">
                      <Label>Nama Kategori</Label>
                      <Input placeholder="Misal: Biaya Entertainment" value={quickCatName} onChange={(e) => setQuickCatName(e.target.value)} />
                  </div>
              </div>
              <DialogFooter>
                  <Button onClick={handleQuickAddCategory} disabled={isSubmitting} className="w-full bg-blue-600">{isSubmitting ? <Loader2 className="animate-spin" /> : 'Simpan Kategori'}</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      {/* --- QUICK MODAL SUB-KATEGORI --- */}
      <Dialog open={isQuickSubOpen} onOpenChange={setIsQuickSubOpen}>
          <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Tambah Sub Kategori untuk: {selectedCategoryData?.name}</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                  <div className="space-y-2">
                      <Label>Nama Sub Kategori</Label>
                      <Input placeholder="Misal: Bensin & Tol" value={quickSubName} onChange={(e) => setQuickSubName(e.target.value)} />
                  </div>
              </div>
              <DialogFooter>
                  <Button onClick={handleQuickAddSub} disabled={isSubmitting} className="w-full bg-blue-600">{isSubmitting ? <Loader2 className="animate-spin" /> : 'Simpan Sub Kategori'}</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinancialManagementPage;