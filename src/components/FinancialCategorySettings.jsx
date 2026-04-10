import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Loader2, DownloadCloud, CheckCircle2, Trash2, AlertTriangle, Plus, Pencil, MoreVertical } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// --- DATA DEFAULT SESUAI PDF ---
export const DEFAULT_FINANCIAL_ACCOUNTS = [ 
  {
    name: "Pendapatan",
    type: "income",
    subcategories: ["Penjualan Online", "Penjualan Offline", "Pendaftaran Member", "Pendapatan Ongkos Kirim", "Pendapatan Lain-lain", "Potongan Penjualan", "Retur Penjualan", "Pendapatan Bunga"]
  },
  {
    name: "Harga Pokok Penjualan",
    type: "expense",
    subcategories: ["HPP", "Admin Marketplace", "Biaya MDR", "Biaya Ongkos Kirim Customer"]
  },
  {
    name: "Biaya Karyawan",
    type: "expense",
    subcategories: ["Penghasilan Merit", "Tunjangan Transportasi", "Tunjangan Keluarga", "Tunjangan Jabatan", "Tunjangan PPh 21", "Tunjangan Hari Raya", "Fasilitas Penginapan", "Fasilitas Posisi", "Lembur", "Bonus Tahunan Pegawai", "Insentif Kerja", "BPJS Ketenagakerjaan", "BPJS Kesehatan", "Biaya Asuransi", "Biaya Recruitment", "Biaya Freelance", "Biaya Seragam dan Nametag", "Biaya Pelatihan dan Pengembangan SDM", "Biaya Pesangon Imbalan Kerja (PSAK 24)", "Biaya Donasi"]
  },
  {
    name: "Biaya Kantor",
    type: "expense",
    subcategories: ["Biaya Perjalanan Dinas", "Biaya Konsumsi Kantor", "Biaya Server", "Biaya Bensin, Toll, dan Parkir", "Biaya Transportasi", "Biaya Ongkos Kirim Kantor", "Biaya Keamanan dan Kebersihan", "Biaya Perbaikan Pemeliharaan Aset dan Non Aset", "Biaya Penelitian dan Pengembangan"]
  },
  {
    name: "Biaya Marketing dan Pemasaran",
    type: "expense",
    subcategories: ["Biaya Promosi", "Biaya Entertainment", "Biaya Event dan Sponsorship", "Biaya Iklan", "Biaya Langganan", "Biaya Cetak", "Biaya Bahan Content"]
  },
  {
    name: "Biaya Sewa",
    type: "expense",
    subcategories: ["Biaya Sewa Alat", "Biaya Sewa Bangunan"]
  },
  {
    name: "Biaya Storage",
    type: "expense",
    subcategories: ["Biaya Logistik", "Biaya Pengemasan"]
  },
  {
    name: "Biaya Utilitas",
    type: "expense",
    subcategories: ["Biaya Listrik dan PDAM", "Biaya Internet dan Telekomunikasi"]
  },
  {
    name: "Biaya Perlengkapan",
    type: "expense",
    subcategories: ["Biaya Alat Tulis Kantor", "Biaya Packaging", "Biaya Rumah Tangga"]
  },
  {
    name: "Biaya Depresiasi",
    type: "expense",
    subcategories: ["Biaya Penyusutan"]
  },
  {
    name: "Biaya Usaha Lainnya",
    type: "expense",
    subcategories: ["Biaya Jasa Profesional", "Biaya Perizinan", "Biaya Usaha Lainnya"]
  },
  {
    name: "Biaya Lain",
    type: "expense",
    subcategories: ["Bagi Hasil", "Biaya Administrasi Bank", "Biaya Lainnya", "Sharing Profit"]
  }
];

const FinancialCategorySettings = () => {
  const { user, companyId } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Modal States ---
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [editingSub, setEditingSub] = useState(null);
  const [selectedParentId, setSelectedParentId] = useState('');

  const [catFormData, setCatFormData] = useState({ name: '', type: 'expense' });
  const [subFormData, setSubFormData] = useState({ name: '' });

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('financial_categories')
        .select(`*, financial_subcategories (*)`)
        .eq('company_id', companyId)
        .order('type', { ascending: false })
        .order('name', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Gagal memuat kategori.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companyId) fetchCategories();
  }, [companyId]);

  const isMissingDefaults = useMemo(() => {
    if (!categories) return false;
    for (const defCat of DEFAULT_FINANCIAL_ACCOUNTS) {
      const existingCat = categories.find(
        c => c.name?.toLowerCase() === defCat.name.toLowerCase() && c.type === defCat.type
      );
      if (!existingCat) return true;
      for (const defSub of defCat.subcategories) {
        const existingSub = existingCat.financial_subcategories?.find(
          s => s.name?.toLowerCase() === defSub.toLowerCase()
        );
        if (!existingSub) return true;
      }
    }
    return false;
  }, [categories]);

  // --- Category Handlers ---
  const handleOpenCatModal = (cat = null) => {
    if (cat) {
      setEditingCat(cat);
      setCatFormData({ name: cat.name, type: cat.type });
    } else {
      setEditingCat(null);
      setCatFormData({ name: '', type: 'expense' });
    }
    setIsCatModalOpen(true);
  };

  const handleSubmitCategory = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingCat) {
        const { error } = await supabase
          .from('financial_categories')
          .update({ name: catFormData.name, type: catFormData.type })
          .eq('id', editingCat.id);
        if (error) throw error;
        toast.success("Kategori diperbarui");
      } else {
        const { error } = await supabase
          .from('financial_categories')
          .insert({ company_id: companyId, name: catFormData.name, type: catFormData.type });
        if (error) throw error;
        toast.success("Kategori ditambahkan");
      }
      setIsCatModalOpen(false);
      fetchCategories();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async (id, name) => {
    if (!confirm(`Yakin hapus kategori "${name}"?`)) return;
    const { error } = await supabase.from('financial_categories').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success("Kategori dihapus");
      fetchCategories();
    }
  };

  // --- Subcategory Handlers ---
  const handleOpenSubModal = (catId, sub = null) => {
    setSelectedParentId(catId);
    if (sub) {
      setEditingSub(sub);
      setSubFormData({ name: sub.name });
    } else {
      setEditingSub(null);
      setSubFormData({ name: '' });
    }
    setIsSubModalOpen(true);
  };

  const handleSubmitSubcategory = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingSub) {
        const { error } = await supabase
          .from('financial_subcategories')
          .update({ name: subFormData.name })
          .eq('id', editingSub.id);
        if (error) throw error;
        toast.success("Sub-kategori diperbarui");
      } else {
        const { error } = await supabase
          .from('financial_subcategories')
          .insert({ category_id: selectedParentId, name: subFormData.name });
        if (error) throw error;
        toast.success("Sub-kategori ditambahkan");
      }
      setIsSubModalOpen(false);
      fetchCategories();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSubcategory = async (id) => {
    if (!confirm("Hapus sub-kategori ini?")) return;
    const { error } = await supabase.from('financial_subcategories').delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success("Dihapus");
      fetchCategories();
    }
  };

  // --- Sync Handler ---
  const handleSyncDefaults = async () => {
    setSyncing(true);
    toast.loading('Menganalisa dan menginstall akun standar...', { id: 'sync-acc' });
    try {
      for (const defCat of DEFAULT_FINANCIAL_ACCOUNTS) {
        let catId;
        const { data: existingCatData } = await supabase
          .from('financial_categories')
          .select('id')
          .eq('company_id', companyId)
          .ilike('name', defCat.name)
          .eq('type', defCat.type)
          .maybeSingle();

        if (existingCatData) {
          catId = existingCatData.id;
        } else {
          const { data: newCat, error: catErr } = await supabase
            .from('financial_categories')
            .insert({ company_id: companyId, name: defCat.name, type: defCat.type })
            .select().single();
          if (catErr) throw catErr;
          catId = newCat.id;
        }

        if (catId) {
          const { data: existingSubs } = await supabase
            .from('financial_subcategories')
            .select('name')
            .eq('category_id', catId);
          const existingSubNames = existingSubs?.map(s => s.name.toLowerCase()) || [];
          const subsToInsert = defCat.subcategories
            .filter(subName => !existingSubNames.includes(subName.toLowerCase()))
            .map(subName => ({ category_id: catId, name: subName }));
          if (subsToInsert.length > 0) {
            const { error: subErr } = await supabase.from('financial_subcategories').insert(subsToInsert);
            if (subErr) throw subErr;
          }
        }
      }
      toast.success('Akun standar berhasil disinkronkan!', { id: 'sync-acc' });
      fetchCategories();
    } catch (error) {
      console.error(error);
      toast.error('Gagal sinkronisasi: ' + error.message, { id: 'sync-acc' });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold text-[#10182b]">Daftar Akun Keuangan (Chart of Accounts)</h3>
          <p className="text-sm text-gray-500">Gunakan kategori ini untuk mencatat setiap transaksi bisnis Anda.</p>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => handleOpenCatModal()} variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
            <Plus className="w-4 h-4 mr-2" /> Kategori Baru
          </Button>
          {isMissingDefaults ? (
            <Button onClick={handleSyncDefaults} disabled={syncing} className="bg-blue-600 hover:bg-blue-700 shadow-md">
              {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <DownloadCloud className="w-4 h-4 mr-2" />}
              {categories.length === 0 ? "Install Akun Standar" : "Lengkapi Akun Standar"}
            </Button>
          ) : (
            <Button variant="outline" disabled className="text-green-600 border-green-200 bg-green-50 opacity-100 cursor-default">
              <CheckCircle2 className="w-4 h-4 mr-2" /> Akun Standar Lengkap
            </Button>
          )}
        </div>
      </div>

      {isMissingDefaults && categories.length > 0 && (
        <Alert className="bg-yellow-50 border-yellow-200">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800">Akun Belum Lengkap</AlertTitle>
          <AlertDescription className="text-yellow-700">
            Beberapa kategori standar akuntansi belum ada. Klik tombol <strong>Lengkapi Akun Standar</strong> agar laporan keuangan otomatis berjalan maksimal.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4">
        {categories.map((cat) => (
          <Card key={cat.id} className={`border-l-4 shadow-sm ${cat.type === 'income' ? 'border-l-green-500' : 'border-l-red-500'}`}>
            <Accordion type="single" collapsible>
              <AccordionItem value={cat.id} className="border-b-0">
                <div className="flex items-center justify-between p-4 pr-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-base">{cat.name}</span>
                      <Badge variant={cat.type === 'income' ? 'outline' : 'destructive'} className={cat.type === 'income' ? 'text-green-600 border-green-600 bg-green-50' : ''}>
                        {cat.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-500">
                      {cat.financial_subcategories?.length || 0} Sub-akun
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleOpenSubModal(cat.id)} className="text-blue-600 hover:bg-blue-50">
                      <Plus className="w-4 h-4 mr-1" /> Sub
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleOpenCatModal(cat)} className="text-gray-400 hover:text-blue-600">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteCategory(cat.id, cat.name)} className="text-gray-400 hover:text-red-500 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <AccordionTrigger className="py-0 hover:no-underline ml-2"></AccordionTrigger>
                  </div>
                </div>

                <AccordionContent className="px-4 pb-4 pt-0">
                  <div className="pl-4 border-l-2 border-gray-100 space-y-2 mt-2">
                    {cat.financial_subcategories?.map(sub => (
                      <div key={sub.id} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded group hover:bg-gray-100 transition-colors">
                        <span>{sub.name}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleOpenSubModal(cat.id, sub)}>
                            <Pencil className="h-3 w-3 text-blue-600" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteSubcategory(sub.id)}>
                            <Trash2 className="h-3 w-3 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {(!cat.financial_subcategories || cat.financial_subcategories.length === 0) && (
                      <p className="text-xs text-gray-400 italic">Belum ada sub-akun. Klik "+ Sub" di atas untuk menambah.</p>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>
        ))}
      </div>

      {/* --- Dialog Kategori --- */}
      <Dialog open={isCatModalOpen} onOpenChange={setIsCatModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCat ? 'Edit Kategori' : 'Tambah Kategori Utama'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmitCategory} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Nama Kategori</Label>
              <Input value={catFormData.name} onChange={e => setCatFormData({ ...catFormData, name: e.target.value })} placeholder="Misal: Biaya Entertainment" required />
            </div>
            <div className="space-y-2">
              <Label>Tipe Akun</Label>
              <Select value={catFormData.type} onValueChange={v => setCatFormData({ ...catFormData, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Pemasukan (Income)</SelectItem>
                  <SelectItem value="expense">Pengeluaran (Expense)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600">{isSubmitting ? <Loader2 className="animate-spin" /> : 'Simpan Kategori'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- Dialog Sub-kategori --- */}
      <Dialog open={isSubModalOpen} onOpenChange={setIsSubModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingSub ? 'Edit Sub-akun' : 'Tambah Sub-akun'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmitSubcategory} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Nama Sub-akun</Label>
              <Input value={subFormData.name} onChange={e => setSubFormData({ name: e.target.value })} placeholder="Misal: Bensin & Tol" required />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600">{isSubmitting ? <Loader2 className="animate-spin" /> : 'Simpan Sub-akun'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinancialCategorySettings;