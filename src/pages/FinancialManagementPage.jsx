import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { FinancialDashboard } from '@/components/FinancialDashboard';
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
import {
  Loader2, Plus, Trash, PiggyBank, ListOrdered, Shield, ImageIcon,
  Check, ChevronsUpDown, Download, BarChart3, FileText
} from 'lucide-react';
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
                resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + '.jpeg', {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                }));
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
        <Card className="border shadow-sm bg-white rounded-2xl">
            <CardHeader className="bg-slate-50 border-b rounded-t-2xl py-4">
                <CardTitle className="text-lg font-bold text-slate-800">Pengaturan Izin Akses</CardTitle>
                <p className="text-sm text-slate-500 font-normal mt-1">Kelola siapa saja yang dapat mengakses halaman keuangan.</p>
            </CardHeader>
            <CardContent className="p-4 lg:p-6 space-y-6">
                <div className="flex gap-2">
                    <Select value={selectedUser} onValueChange={setSelectedUser}>
                        <SelectTrigger className="flex-1 h-10 rounded-xl"><SelectValue placeholder="Pilih staf untuk diberi akses" /></SelectTrigger>
                        <SelectContent>{allUsers.filter(u => !allowedUsers.find(au => au.id === u.id)).map(user => (<SelectItem key={user.id} value={user.id}>{user.full_name} ({user.role})</SelectItem>))}</SelectContent>
                    </Select>
                    <Button onClick={handleAddPermission} disabled={isSubmitting || !selectedUser} className="bg-[#011e4b] h-10 px-6 font-semibold rounded-xl">Tambah</Button>
                </div>
                <div className="rounded-xl border overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead className="font-semibold text-slate-700">Nama Pengguna</TableHead>
                                <TableHead className="text-right font-semibold text-slate-700">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {allowedUsers.length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-6 text-slate-400 text-sm">Belum ada user yang diizinkan.</TableCell></TableRow>}
                            {allowedUsers.map(user => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium text-slate-700">{user.full_name}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" onClick={() => handleRemovePermission(user.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"><Trash className="h-4 w-4" /></Button>
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

  // Date filter for list display only (client-side)
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
  const [listStartDate, setListStartDate] = useState(firstDayOfMonth);
  const [listEndDate, setListEndDate] = useState(lastDayOfMonth);

  // Combobox states
  const [openCat, setOpenCat] = useState(false);
  const [openSub, setOpenSub] = useState(false);

  // Modal states
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

    const { data: allFin, error } = await supabase
        .from('financial_transactions')
        .select(`*, payment_method:payment_method_id (method_name), category:category_id (name), subcategory:subcategory_id (name)`)
        .eq('company_id', companyId)
        .order('transaction_date', { ascending: false });

    if (error) toast.error("Gagal memuat transaksi.");

    setTransactions(allFin?.map(t => ({
        id: t.id,
        date: t.transaction_date,
        type: t.type,
        amount: t.amount,
        description: t.description,
        category: t.category?.name || 'Tanpa Kategori',
        category_id: t.category_id,
        subcategory: t.subcategory?.name || '-',
        subcategory_id: t.subcategory_id,
        method: t.payment_method?.method_name || '-',
        payment_method_id: t.payment_method_id,
        source: t.source_table || 'Manual',
        proofUrl: t.proof_url
    })) || []);
    setLoading(false);
  };

  useEffect(() => {
    const checkAccess = async () => {
        setPageLoading(true);
        if (isPrivileged) {
            setIsAllowed(true);
            setMainTab('dashboard');
            await fetchData();
        } else {
            const { data } = await supabase.from('financial_page_permissions').select('user_id').eq('company_id', companyId).eq('user_id', userProfile?.id).limit(1);
            if (data?.length > 0) { setIsAllowed(true); await fetchData(); }
            else setIsAllowed(false);
        }
        setPageLoading(false);
    };
    if (companyId && userProfile) checkAccess();
  }, [companyId, userProfile]);

  useEffect(() => {
    if (companyId && (mainTab === 'management' || mainTab === 'dashboard')) {
      fetchData();
    }
  }, [mainTab, companyId]);

  const handleFormChange = (f, v) => {
    setNewTransaction(p => {
        const up = { ...p, [f]: v };
        if (f === 'category_id') up.subcategory_id = '';
        return up;
    });
  };

  const handleQuickAddCategory = async () => {
      if (!quickCatName) return;
      setIsSubmitting(true);
      try {
          const { data, error } = await supabase.from('financial_categories').insert({
              company_id: companyId, name: quickCatName, type: activeTab
          }).select().single();
          if (error) throw error;
          await fetchCategories();
          handleFormChange('category_id', data.id);
          setIsQuickCatOpen(false); setQuickCatName(''); toast.success("Kategori ditambahkan!");
      } catch (e) { toast.error(e.message); } finally { setIsSubmitting(false); }
  };

  const handleQuickAddSub = async () => {
      if (!quickSubName || !newTransaction.category_id) return;
      setIsSubmitting(true);
      try {
          const { data, error } = await supabase.from('financial_subcategories').insert({
              category_id: newTransaction.category_id, name: quickSubName
          }).select().single();
          if (error) throw error;
          await fetchCategories();
          handleFormChange('subcategory_id', data.id);
          setIsQuickSubOpen(false); setQuickSubName(''); toast.success("Sub-kategori ditambahkan!");
      } catch (e) { toast.error(e.message); } finally { setIsSubmitting(false); }
  };

  const handleSubmitTransaction = async (e) => {
      e.preventDefault();
      setIsSubmitting(true);

      const amount = parseFloat(newTransaction.amount.replace(/\./g, ''));
      const fee = parseFloat(newTransaction.adminFee.replace(/\./g, '')) || 0;

      if (isNaN(amount) || amount <= 0) { toast.error("Jumlah tidak valid"); setIsSubmitting(false); return; }

      try {
        let proofUrl = null;
        let fileToUpload = newTransaction.proof;

        if (fileToUpload) {
          if (fileToUpload.type.startsWith('image/') && fileToUpload.size > MAX_FILE_SIZE) {
            toast.loading(`Kompresi gambar...`, { id: 'comp-fin' });
            fileToUpload = await compressImage(fileToUpload, TARGET_SIZE_MB);
            toast.success('Kompresi berhasil', { id: 'comp-fin' });
          }
          const filePath = `${companyId}/transactions/${Date.now()}_${fileToUpload.name}`;
          await supabase.storage.from('proofs').upload(filePath, fileToUpload);
          const { data } = supabase.storage.from('proofs').getPublicUrl(filePath);
          proofUrl = data.publicUrl;
        }

        const payload = [{
          company_id: companyId, type: newTransaction.type, amount, description: newTransaction.description,
          payment_method_id: newTransaction.payment_method_id, category_id: newTransaction.category_id || null,
          subcategory_id: newTransaction.subcategory_id || null, proof_url: proofUrl,
          source_table: 'manual_transaction', transaction_date: new Date()
        }];

        if (fee > 0) {
            payload.push({
                company_id: companyId, type: 'expense', amount: fee,
                description: `[Biaya Admin] ${newTransaction.description}`,
                payment_method_id: newTransaction.payment_method_id,
                source_table: 'admin_fee', transaction_date: new Date()
            });
        }

        const { error } = await supabase.from('financial_transactions').insert(payload);
        if (error) throw error;

        toast.success("Transaksi dicatat!");
        setNewTransaction({ type: activeTab, amount: '', adminFee: '0', description: '', payment_method_id: '', category_id: '', subcategory_id: '', proof: null });
        fetchData();
      } catch (error) { toast.error("Gagal: " + error.message); } finally { setIsSubmitting(false); }
  };

  // Client-side filtered transactions for list display
  const listTransactions = useMemo(() => {
    return transactions.filter(t => {
        const tDate = t.date ? t.date.split('T')[0] : '';
        if (listStartDate && tDate < listStartDate) return false;
        if (listEndDate && tDate > listEndDate) return false;
        return true;
    });
  }, [transactions, listStartDate, listEndDate]);

  const handleExportTransactions = () => {
    const exportData = listTransactions.map(t => ({
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
    XLSX.writeFile(wb, `Keuangan_${listStartDate}_sd_${listEndDate}.xlsx`);
  };

  if (pageLoading) return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-[#011e4b]" /></div>;
  if (!isAllowed) return <div className="container mx-auto p-8 text-center text-red-500">Akses ditolak.</div>;

  const filteredFinCategories = finCategories.filter(c => c.type === activeTab);
  const selectedCategoryData = finCategories.find(c => c.id === newTransaction.category_id);

  return (
    <div className="container mx-auto p-4 md:p-8 min-h-screen">

      <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4 border-b border-slate-200 pb-4">
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-[#011e4b]">
            <div className="p-1.5 md:p-2 bg-blue-100 rounded-xl">
              <PiggyBank className="h-4 w-4 md:h-5 md:w-5 text-[#011e4b]" />
            </div>
            Keuangan Perusahaan
          </h1>

          <TabsList className="bg-slate-100/50 border shadow-sm rounded-xl p-1 h-auto w-full lg:w-auto flex flex-row gap-1">
            {isPrivileged && (
              <TabsTrigger
                value="dashboard"
                className="flex-1 lg:flex-none text-[10px] md:text-xs gap-1 md:gap-1.5 px-2 md:px-4 py-2 font-bold data-[state=active]:bg-[#011e4b] data-[state=active]:text-white transition-all rounded-lg"
              >
                <BarChart3 className="h-3.5 w-3.5" /> <span>Dashboard</span>
              </TabsTrigger>
            )}
            <TabsTrigger
              value="management"
              className="flex-1 lg:flex-none text-[10px] md:text-xs gap-1 md:gap-1.5 px-2 md:px-4 py-2 font-bold data-[state=active]:bg-[#011e4b] data-[state=active]:text-white transition-all rounded-lg"
            >
              <ListOrdered className="h-3.5 w-3.5" /> <span>Kas</span>
            </TabsTrigger>
            {isPrivileged && (
              <TabsTrigger
                value="settings"
                className="flex-1 lg:flex-none text-[10px] md:text-xs gap-1 md:gap-1.5 px-2 md:px-4 py-2 font-bold data-[state=active]:bg-[#011e4b] data-[state=active]:text-white transition-all rounded-lg"
              >
                <Shield className="h-3.5 w-3.5" /> <span>Akses</span>
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <div className="mt-4">
          {/* DASHBOARD TAB */}
          {isPrivileged && (
            <TabsContent value="dashboard" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
              <FinancialDashboard
                rawTransactions={transactions}
                categories={finCategories}
                paymentMethods={paymentMethods}
              />
            </TabsContent>
          )}

          {/* KAS TAB */}
          <TabsContent value="management" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

              {/* Form Tambah Transaksi */}
              <Card className="border shadow-sm bg-white rounded-2xl overflow-hidden">
                <CardHeader className="bg-[#011e4b] text-white rounded-t-2xl py-5">
                  <CardTitle className="text-lg flex items-center gap-2 font-bold">
                    <Plus className="h-5 w-5 text-blue-300" /> Catat Transaksi Kas Manual
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 lg:p-8">
                  <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); handleFormChange('type', v); }}>
                    <TabsList className="grid w-full grid-cols-2 mb-8 bg-slate-100 p-1 rounded-xl h-12">
                      <TabsTrigger value="expense" className="text-sm font-semibold rounded-lg data-[state=active]:bg-red-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all">Pengeluaran</TabsTrigger>
                      <TabsTrigger value="income" className="text-sm font-semibold rounded-lg data-[state=active]:bg-green-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all">Pemasukan</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <form onSubmit={handleSubmitTransaction} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                      <div className="space-y-2">
                          <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Kategori Utama</Label>
                          <Popover open={openCat} onOpenChange={setOpenCat}>
                              <PopoverTrigger asChild>
                                  <Button variant="outline" role="combobox" aria-expanded={openCat} className="w-full justify-between font-medium bg-slate-50 h-11 border-slate-200 rounded-xl">
                                      {newTransaction.category_id
                                          ? filteredFinCategories.find((c) => c.id === newTransaction.category_id)?.name
                                          : <span className="text-slate-400 font-normal">Pilih Kategori...</span>}
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[300px] p-0 rounded-xl" align="start">
                                  <Command>
                                      <CommandInput placeholder="Cari kategori..." className="h-10 text-xs" />
                                      <CommandList>
                                          <CommandEmpty className="text-xs py-4 text-center text-slate-400">Kategori tidak ditemukan.</CommandEmpty>
                                          <CommandGroup>
                                              {filteredFinCategories.map((c) => (
                                                  <CommandItem key={c.id} value={c.name} onSelect={() => { handleFormChange('category_id', c.id); setOpenCat(false); }} className="text-sm font-medium">
                                                      <Check className={cn("mr-2 h-4 w-4", newTransaction.category_id === c.id ? "opacity-100 text-[#011e4b]" : "opacity-0")} />
                                                      {c.name}
                                                  </CommandItem>
                                              ))}
                                          </CommandGroup>
                                      </CommandList>
                                      <Separator />
                                      <div className="p-1">
                                          <Button type="button" variant="ghost" className="w-full justify-start text-[#011e4b] font-bold text-xs" onClick={() => { setOpenCat(false); setIsQuickCatOpen(true); }}>
                                              <Plus className="mr-2 h-4 w-4" /> Tambah Kategori Baru
                                          </Button>
                                      </div>
                                  </Command>
                              </PopoverContent>
                          </Popover>
                      </div>

                      <div className="space-y-2">
                          <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Sub Kategori</Label>
                          <Popover open={openSub} onOpenChange={setOpenSub}>
                              <PopoverTrigger asChild>
                                  <Button variant="outline" role="combobox" disabled={!newTransaction.category_id} aria-expanded={openSub} className="w-full justify-between font-medium bg-slate-50 h-11 border-slate-200 rounded-xl">
                                      {newTransaction.subcategory_id
                                          ? selectedCategoryData?.financial_subcategories?.find((s) => s.id === newTransaction.subcategory_id)?.name
                                          : <span className="text-slate-400 font-normal">Pilih Sub Kategori...</span>}
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[300px] p-0 rounded-xl" align="start">
                                  <Command>
                                      <CommandInput placeholder="Cari sub-kategori..." className="h-10 text-xs" />
                                      <CommandList>
                                          <CommandEmpty className="text-xs py-4 text-center text-slate-400">Sub-kategori tidak ditemukan.</CommandEmpty>
                                          <CommandGroup>
                                              {selectedCategoryData?.financial_subcategories?.map((s) => (
                                                  <CommandItem key={s.id} value={s.name} onSelect={() => { handleFormChange('subcategory_id', s.id); setOpenSub(false); }} className="text-sm font-medium">
                                                      <Check className={cn("mr-2 h-4 w-4", newTransaction.subcategory_id === s.id ? "opacity-100 text-[#011e4b]" : "opacity-0")} />
                                                      {s.name}
                                                  </CommandItem>
                                              ))}
                                          </CommandGroup>
                                      </CommandList>
                                      <Separator />
                                      <div className="p-1">
                                          <Button type="button" variant="ghost" className="w-full justify-start text-[#011e4b] font-bold text-xs" onClick={() => { setOpenSub(false); setIsQuickSubOpen(true); }}>
                                              <Plus className="mr-2 h-4 w-4" /> Tambah Sub Baru
                                          </Button>
                                      </div>
                                  </Command>
                              </PopoverContent>
                          </Popover>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Nominal Transaksi (Rp)</Label>
                        <Input type="text" placeholder="0" className="text-xl font-bold bg-slate-50 h-11 border-slate-200 rounded-xl"
                          value={newTransaction.amount}
                          onChange={(e) => handleFormChange('amount', e.target.value.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, "."))}
                          required />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Biaya Admin (Opsional)</Label>
                        <Input type="text" placeholder="0" className="font-semibold bg-slate-50 h-11 border-slate-200 rounded-xl"
                          value={newTransaction.adminFee}
                          onChange={(e) => handleFormChange('adminFee', e.target.value.replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, "."))} />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Metode Pembayaran</Label>
                        <Select value={newTransaction.payment_method_id} onValueChange={(v) => handleFormChange('payment_method_id', v)} required>
                          <SelectTrigger className="bg-slate-50 h-11 border-slate-200 font-medium rounded-xl"><SelectValue placeholder="Pilih rekening/kas" /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {paymentMethods.map(m => <SelectItem key={m.id} value={m.id} className="font-medium">{m.method_name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                          <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Upload Bukti</Label>
                          <Input
                            key={newTransaction.proof ? newTransaction.proof.name : 'empty'}
                            type="file"
                            className="bg-slate-50 cursor-pointer h-11 pt-2 border-slate-200 text-xs rounded-xl"
                            onChange={(e) => setNewTransaction(prev => ({...prev, proof: e.target.files[0]}))}
                            accept="image/*"
                          />
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Keterangan / Deskripsi</Label>
                      <Input type="text" placeholder="Misal: Pembayaran listrik gudang bulan berjalan..." className="bg-slate-50 h-11 border-slate-200 font-medium text-sm rounded-xl"
                        value={newTransaction.description}
                        onChange={(e) => handleFormChange('description', e.target.value)}
                        required />
                    </div>

                    <Button type="submit" className="w-full bg-[#011e4b] hover:bg-[#022a6b] text-white shadow-md font-bold h-12 text-sm mt-4 rounded-xl" disabled={isSubmitting}>
                      {isSubmitting ? <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Memproses...</> : 'Simpan Transaksi'}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Riwayat Transaksi */}
              <Card className="border shadow-sm bg-white rounded-2xl overflow-hidden">
                  <CardHeader className="flex flex-col md:flex-row md:items-center justify-between border-b p-4 md:p-6 gap-4">
                      <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800">
                        <FileText className="h-5 w-5 text-slate-500" /> Riwayat Transaksi
                      </CardTitle>
                      <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center bg-slate-50 rounded-lg border p-1.5">
                              <div className="flex flex-col px-2">
                                  <Label className="text-[10px] uppercase font-bold text-slate-500 mb-1">Mulai</Label>
                                  <Input type="date" value={listStartDate} onChange={(e) => setListStartDate(e.target.value)} className="h-7 border-0 bg-transparent p-0 text-xs focus-visible:ring-0 shadow-none w-[110px] font-medium" />
                              </div>
                              <div className="w-px h-8 bg-slate-200 mx-1"></div>
                              <div className="flex flex-col px-2">
                                  <Label className="text-[10px] uppercase font-bold text-slate-500 mb-1">Akhir</Label>
                                  <Input type="date" value={listEndDate} onChange={(e) => setListEndDate(e.target.value)} className="h-7 border-0 bg-transparent p-0 text-xs focus-visible:ring-0 shadow-none w-[110px] font-medium" />
                              </div>
                          </div>
                          <Button onClick={handleExportTransactions} variant="outline" size="sm" disabled={listTransactions.length === 0} className="rounded-lg">
                            <Download className="h-4 w-4 mr-2" /> Export Excel
                          </Button>
                      </div>
                  </CardHeader>
                  <CardContent className="p-0">
                      <div className="overflow-x-auto max-h-[500px]">
                          <Table>
                              <TableHeader>
                                  <TableRow className="bg-slate-50">
                                      <TableHead className="font-semibold text-slate-700">Tanggal</TableHead>
                                      <TableHead className="font-semibold text-slate-700">Kategori</TableHead>
                                      <TableHead className="font-semibold text-slate-700">Jumlah</TableHead>
                                      <TableHead className="font-semibold text-slate-700">Deskripsi</TableHead>
                                      <TableHead className="font-semibold text-slate-700">Metode & Bukti</TableHead>
                                      <TableHead className="font-semibold text-slate-700">Sumber</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {listTransactions.length === 0 && (
                                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400">Belum ada data untuk periode ini.</TableCell></TableRow>
                                  )}
                                  {listTransactions.map((t) => (
                                      <TableRow key={t.id} className="hover:bg-slate-50/80 transition-colors">
                                          <TableCell className="text-xs text-slate-500">{new Date(t.date).toLocaleDateString('id-ID')}</TableCell>
                                          <TableCell>
                                              <div className="flex flex-col">
                                                  <span className={`text-[10px] font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                                    {t.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                                                  </span>
                                                  <span className="font-semibold text-xs text-slate-800">{t.category}</span>
                                                  <span className="text-[10px] text-slate-500">{t.subcategory}</span>
                                              </div>
                                          </TableCell>
                                          <TableCell className={`font-bold text-xs ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                            {formatCurrency(t.amount)}
                                          </TableCell>
                                          <TableCell className="text-xs max-w-[200px] truncate text-slate-600" title={t.description}>{t.description}</TableCell>
                                          <TableCell>
                                              <div className="flex items-center gap-2">
                                                  <span className="text-xs text-slate-600">{t.method}</span>
                                                  {t.proofUrl && <a href={t.proofUrl} target="_blank" rel="noreferrer" className="text-[#011e4b] hover:text-blue-700"><ImageIcon className="h-4 w-4" /></a>}
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
            </div>
          </TabsContent>

          {/* AKSES TAB */}
          {isPrivileged && (
            <TabsContent value="settings" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
              <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                <PermissionSettings companyId={companyId} />
              </div>
            </TabsContent>
          )}
        </div>
      </Tabs>

      {/* MODAL QUICK ADD CATEGORY */}
      <Dialog open={isQuickCatOpen} onOpenChange={setIsQuickCatOpen}>
          <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-slate-800">Tambah Kategori ({activeTab === 'income' ? 'Pemasukan' : 'Pengeluaran'})</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                  <div className="space-y-2">
                      <Label className="font-semibold text-slate-700">Nama Kategori</Label>
                      <Input placeholder="Misal: Biaya Operasional" className="h-11 rounded-xl" value={quickCatName} onChange={(e) => setQuickCatName(e.target.value)} />
                  </div>
              </div>
              <DialogFooter>
                <Button onClick={handleQuickAddCategory} disabled={isSubmitting} className="w-full h-11 font-bold bg-[#011e4b] rounded-xl">
                  {isSubmitting ? <Loader2 className="animate-spin" /> : 'Simpan Kategori'}
                </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      {/* MODAL QUICK ADD SUB-CATEGORY */}
      <Dialog open={isQuickSubOpen} onOpenChange={setIsQuickSubOpen}>
          <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-slate-800">Tambah Sub Kategori untuk: <span className="text-[#011e4b]">{selectedCategoryData?.name}</span></DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                  <div className="space-y-2">
                      <Label className="font-semibold text-slate-700">Nama Sub Kategori</Label>
                      <Input placeholder="Misal: Listrik & Air" className="h-11 rounded-xl" value={quickSubName} onChange={(e) => setQuickSubName(e.target.value)} />
                  </div>
              </div>
              <DialogFooter>
                <Button onClick={handleQuickAddSub} disabled={isSubmitting} className="w-full h-11 font-bold bg-[#011e4b] rounded-xl">
                  {isSubmitting ? <Loader2 className="animate-spin" /> : 'Simpan Sub Kategori'}
                </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinancialManagementPage;
