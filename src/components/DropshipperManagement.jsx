// src/components/DropshipperManagement.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import { 
  Settings, Loader2, Save, UserPlus, Trash2, Pencil, 
  BarChart3, Users, Wallet, Calendar, ArrowUpRight,
  ExternalLink, CreditCard, Landmark, Package, Mail, Phone, Lock, ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Separator } from './ui/separator';
import { Badge } from '@/components/ui/badge';

const DropshipperManagement = ({ companyId }) => {
  const [dropshippers, setDropshippers] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  const [isModalAddOpen, setIsModalAddOpen] = useState(false);
  const [isModalEditOpen, setIsModalEditOpen] = useState(false);
  const [isModalStatsOpen, setIsModalStatsOpen] = useState(false);
  
  const [selectedDs, setSelectedDs] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const [dsStats, setDsStats] = useState({
    totalCommission: 0, totalOrders: 0, totalCustomers: 0, recentOrders: []
  });

  const [formData, setFormData] = useState({ fullName: '', email: '', password: '', phone: '', rekening: '' });
  const [commissions, setCommissions] = useState({}); 

  const formatRupiah = (val) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val || 0);

  useEffect(() => {
    if (companyId) {
      fetchDropshippers();
      fetchInitialData();
    }
  }, [companyId]);

  const fetchDropshippers = async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').eq('company_id', companyId).eq('role', 'dropship');
    setDropshippers(data || []);
    setLoading(false);
  };

  const fetchInitialData = async () => {
    const [resStatuses, resProducts] = await Promise.all([
      supabase.from('customer_statuses').select('status_name').eq('company_id', companyId).order('sort_order', { ascending: true }),
      supabase.from('products').select('id, name').eq('company_id', companyId).eq('is_active', true).order('name', { ascending: true })
    ]);
    setStatuses(resStatuses.data || []);
    setProducts(resProducts.data || []);
  };

  const handleCommissionChange = (status, prodId, field, value) => {
    setCommissions(prev => ({
      ...prev,
      [status]: {
        ...prev[status],
        [prodId]: { ...prev[status][prodId], [field]: value }
      }
    }));
  };

  const handleViewStats = async (ds) => {
    setSelectedDs(ds);
    setIsModalStatsOpen(true);
    setLoading(true);
    try {
        const { count: customerCount } = await supabase.from('customers').select('*', { count: 'exact', head: true }).eq('dropshipper_id', ds.id);
        const { data: orders, error } = await supabase.from('orders').select('id, created_at, grand_total, dropshipper_commission, status, invoice_number, customers(name)').eq('dropshipper_id', ds.id).order('created_at', { ascending: false });
        if (error) throw error;
        setDsStats({
            totalCommission: orders.reduce((sum, o) => sum + (parseFloat(o.dropshipper_commission) || 0), 0),
            totalOrders: orders.length,
            totalCustomers: customerCount || 0,
            recentOrders: orders.slice(0, 10)
        });
    } catch (err) { toast.error("Gagal memuat statistik"); } finally { setLoading(false); }
  };

  const handleAddDropshipper = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { data: authSession } = await supabase.auth.getSession();
      const response = await fetch('https://wzmgcainyratlwxttdau.supabase.co/functions/v1/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authSession.session?.access_token}` },
        body: JSON.stringify({ ...formData, role: 'dropship', companyId })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      await supabase.from('profiles').update({ rekening: formData.rekening }).eq('id', result.userId);

      const settingsToInsert = [];
      Object.entries(commissions).forEach(([status, prodMap]) => {
        Object.entries(prodMap).forEach(([prodId, config]) => {
          if (parseFloat(config.value) > 0) {
            settingsToInsert.push({
              company_id: companyId, dropshipper_id: result.userId, customer_status: status,
              product_id: prodId, commission_value: parseFloat(config.value) || 0, commission_type: config.type
            });
          }
        });
      });

      if (settingsToInsert.length > 0) await supabase.from('dropshipper_settings').insert(settingsToInsert);

      toast.success("Dropshipper & Matrix Komisi Aktif!");
      setIsModalAddOpen(false);
      resetForm();
      fetchDropshippers();
    } catch (error) { toast.error(error.message); } finally { setIsSaving(false); }
  };

  const handleEditClick = async (ds) => {
    setSelectedDs(ds);
    setFormData({ fullName: ds.full_name || '', email: '', password: '', phone: ds.phone || '', rekening: ds.rekening || '' });
    setLoading(true);
    try {
      const { data } = await supabase.from('dropshipper_settings').select('*').eq('dropshipper_id', ds.id);
      const matrix = {};
      statuses.forEach(s => {
        matrix[s.status_name] = {};
        products.forEach(p => {
          const found = data?.find(d => d.customer_status === s.status_name && d.product_id === p.id);
          matrix[s.status_name][p.id] = { value: found ? found.commission_value : 0, type: found ? found.commission_type : 'percentage' };
        });
      });
      setCommissions(matrix);
      setIsModalEditOpen(true);
    } catch (err) { toast.error("Gagal mengambil data komisi"); } finally { setLoading(false); }
  };

  const handleUpdateCommissions = async () => {
    setIsSaving(true);
    try {
      await supabase.from('profiles').update({ full_name: formData.fullName, phone: formData.phone, rekening: formData.rekening }).eq('id', selectedDs.id);

      const updates = [];
      Object.entries(commissions).forEach(([status, prodMap]) => {
        Object.entries(prodMap).forEach(([prodId, config]) => {
          if (prodId && prodId !== 'undefined') {
            updates.push({
              company_id: companyId, dropshipper_id: selectedDs.id, customer_status: status,
              product_id: prodId, commission_value: parseFloat(config.value) || 0, commission_type: config.type || 'percentage'
            });
          }
        });
      });

      const { error } = await supabase.from('dropshipper_settings').upsert(updates, { onConflict: 'dropshipper_id,customer_status,product_id' });
      if (error) throw error;

      toast.success("Data & Matrix Komisi diperbarui!");
      setIsModalEditOpen(false);
      fetchDropshippers();
    } catch (error) { toast.error(error.message); } finally { setIsSaving(false); }
  };

  const handleDeleteDs = async (id) => {
    if (!window.confirm("Hapus dropshipper ini? Akun login juga akan dihapus.")) return;
    try {
      await supabase.functions.invoke('delete-user', { method: 'DELETE', body: { userId: id } });
      toast.success("Dropshipper dihapus.");
      fetchDropshippers();
    } catch (e) { toast.error("Gagal menghapus."); }
  };

  const resetForm = () => {
    setFormData({ fullName: '', email: '', password: '', phone: '', rekening: '' });
    const matrix = {};
    statuses.forEach(s => {
      matrix[s.status_name] = {};
      products.forEach(p => { matrix[s.status_name][p.id] = { value: 0, type: 'percentage' }; });
    });
    setCommissions(matrix);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold flex items-center gap-2 text-[#10182b]"><Users className="h-5 w-5 text-blue-600" /> Manajemen Dropshipper Dropship</h3>
        <Button onClick={() => { resetForm(); setIsModalAddOpen(true); }} className="bg-[#10182b] text-white hover:bg-slate-800 rounded-xl px-6">
            <UserPlus className="h-4 w-4 mr-2" /> Tambah Dropshipper Baru
        </Button>
      </div>

      <Card className="border-0 shadow-sm overflow-hidden rounded-2xl bg-white">
        <Table>
          <TableHeader className="bg-slate-50/50">
            <TableRow className="text-[10px] uppercase font-bold text-slate-400">
              <TableHead className="pl-6">Nama Dropshipper</TableHead>
              <TableHead>Kontak WhatsApp</TableHead>
              <TableHead>Info Rekening</TableHead>
              <TableHead className="text-right pr-6">Aksi Kelola</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dropshippers.map(ds => (
              <TableRow key={ds.id} className="hover:bg-blue-50/30 transition-colors group">
                <TableCell className="font-bold text-slate-700 pl-6">{ds.full_name}</TableCell>
                <TableCell className="text-slate-500 font-medium">
                    <div className="flex items-center gap-2"><Phone className="h-3 w-3 text-slate-300" /> {ds.phone || '-'}</div>
                </TableCell>
                <TableCell>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                        <Landmark className="h-3 w-3 text-slate-400" />
                        {ds.rekening || <span className="text-slate-300 italic font-normal">Belum diisi</span>}
                    </div>
                </TableCell>
                <TableCell className="text-right pr-6 space-x-1">
                  <Button variant="ghost" size="icon" title="Dashboard Dropshipper" onClick={() => navigate(`/dropship-dashboard?as=${ds.id}`)} className="text-indigo-600 hover:bg-indigo-50"><ExternalLink className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="Statistik" onClick={() => handleViewStats(ds)} className="text-emerald-600 hover:bg-emerald-50"><BarChart3 className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="Edit Data & Matrix" onClick={() => handleEditClick(ds)} className="text-blue-600 hover:bg-blue-50"><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="Hapus" onClick={() => handleDeleteDs(ds.id)} className="text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {dropshippers.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center py-20 text-slate-400 italic">Belum ada dropshipper terdaftar.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* --- MODAL DASHBOARD PERFORMA (STATS) --- */}
      <Dialog open={isModalStatsOpen} onOpenChange={setIsModalStatsOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-emerald-600 text-white">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <BarChart3 className="h-6 w-6" /> Performa Dropshipper: {selectedDs?.full_name}
            </DialogTitle>
            <DialogDescription className="text-emerald-100 italic">Analisis kontribusi dan histori transaksi real-time.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
            {loading ? (
                <div className="py-20 flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin h-10 w-10 text-emerald-500" />
                    <p className="text-sm font-bold text-slate-400">Mengkalkulasi data...</p>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="p-4 border-none shadow-sm bg-white">
                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Total Komisi</p>
                            <p className="text-2xl font-black text-slate-800">{formatRupiah(dsStats.totalCommission)}</p>
                            <Wallet className="h-10 w-10 text-emerald-500/10 absolute right-4 bottom-4" />
                        </Card>
                        <Card className="p-4 border-none shadow-sm bg-white">
                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Total Pesanan</p>
                            <p className="text-2xl font-black text-slate-800">{dsStats.totalOrders} Order</p>
                        </Card>
                        <Card className="p-4 border-none shadow-sm bg-white">
                            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Pelanggan Aktif</p>
                            <p className="text-2xl font-black text-slate-800">{dsStats.totalCustomers} Orang</p>
                        </Card>
                    </div>

                    <div className="space-y-3 bg-white p-4 rounded-2xl shadow-sm">
                        <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Calendar className="h-4 w-4" /> 10 Transaksi Terakhir</h4>
                        <div className="border border-slate-100 rounded-xl overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow className="text-[10px] uppercase font-bold">
                                        <TableHead className="h-8">Tgl</TableHead>
                                        <TableHead className="h-8">Customer</TableHead>
                                        <TableHead className="h-8">Total</TableHead>
                                        <TableHead className="h-8 text-right pr-4">Komisi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {dsStats.recentOrders.map(o => (
                                        <TableRow key={o.id} className="text-[11px] hover:bg-slate-50">
                                            <TableCell className="text-slate-500">{format(new Date(o.created_at), 'dd/MM/yy')}</TableCell>
                                            <TableCell className="font-bold text-slate-700">{o.customers?.name}</TableCell>
                                            <TableCell>{formatRupiah(o.grand_total)}</TableCell>
                                            <TableCell className="text-right font-bold text-emerald-600 pr-4">+{formatRupiah(o.dropshipper_commission)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>
            )}
          </div>
          <DialogFooter className="p-4 bg-white border-t">
            <Button onClick={() => setIsModalStatsOpen(false)} className="w-full rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold">Tutup Dashboard</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL ADD */}
      <Dialog open={isModalAddOpen} onOpenChange={setIsModalAddOpen}>
        <DialogContent className="sm:max-w-4xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-[#10182b] text-white">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg"><UserPlus className="h-6 w-6 text-blue-400" /></div>
                <div>
                    <DialogTitle className="text-xl font-bold">Daftarkan Dropshipper Baru</DialogTitle>
                    <DialogDescription className="text-slate-400 italic">Buat akun login dan atur matrix bagi hasil produk.</DialogDescription>
                </div>
            </div>
          </DialogHeader>
          <form onSubmit={handleAddDropshipper} className="flex-1 overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2"><ChevronRight className="h-3 w-3 text-blue-500" /> Informasi Akun & Rekening</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-600">Nama Lengkap</Label><Input required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="rounded-xl bg-slate-50 border-slate-200 h-10" /></div>
                        <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-600">WhatsApp</Label><Input required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="rounded-xl bg-slate-50 border-slate-200 h-10" /></div>
                        <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-600">Email Login</Label><Input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="rounded-xl bg-slate-50 border-slate-200 h-10" /></div>
                        <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-600">Password</Label><Input required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="rounded-xl bg-slate-50 border-slate-200 h-10" /></div>
                        <div className="md:col-span-2 space-y-1.5">
                            <Label className="text-xs font-bold text-slate-600 flex items-center gap-2"><CreditCard className="h-3 w-3" /> Rekening / E-Wallet</Label>
                            <Input value={formData.rekening} onChange={e => setFormData({...formData, rekening: e.target.value})} placeholder="Misal: BCA 1234567 a.n Budi" className="rounded-xl bg-slate-50 border-slate-200 h-10" />
                        </div>
                    </div>
                </div>

                <Separator className="bg-slate-100" />
                
                <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2"><Package className="h-3 w-3 text-blue-500" /> Konfigurasi Matrix Komisi</h4>
                    <Tabs defaultValue={statuses[0]?.status_name} className="w-full border rounded-2xl overflow-hidden bg-white shadow-sm">
                        <TabsList className="w-full justify-start rounded-none h-12 bg-slate-50 border-b p-0 overflow-x-auto">
                            {statuses.map(s => <TabsTrigger key={s.status_name} value={s.status_name} className="h-full rounded-none px-6 text-[10px] font-black uppercase data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 transition-all">{s.status_name}</TabsTrigger>)}
                        </TabsList>
                        {statuses.map(s => (
                            <TabsContent key={s.status_name} value={s.status_name} className="m-0 bg-slate-50/30">
                                <div className="grid grid-cols-1 md:grid-cols-2 p-4 gap-4">
                                    {products.map(p => (
                                        <div key={p.id} className="bg-white border border-slate-100 p-4 rounded-xl flex items-center justify-between gap-4 shadow-sm hover:border-blue-200 transition-all">
                                            <div className="flex-1 min-w-0"><p className="text-xs font-bold text-slate-700 truncate">{p.name}</p></div>
                                            <div className="flex items-center gap-2">
                                                <div className="flex bg-slate-100 p-1 rounded-lg border">
                                                    <button type="button" onClick={() => handleCommissionChange(s.status_name, p.id, 'type', 'percentage')} className={cn("px-2.5 py-1 text-[9px] font-bold rounded-md transition-all", commissions[s.status_name]?.[p.id]?.type !== 'nominal' ? "bg-blue-600 text-white shadow-sm" : "text-slate-400")}> % </button>
                                                    <button type="button" onClick={() => handleCommissionChange(s.status_name, p.id, 'type', 'nominal')} className={cn("px-2.5 py-1 text-[9px] font-bold rounded-md transition-all", commissions[s.status_name]?.[p.id]?.type === 'nominal' ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400")}> Rp </button>
                                                </div>
                                                <div className="relative w-28">
                                                    <Input type="number" className="h-9 text-right font-black text-xs pr-6 rounded-lg" value={commissions[s.status_name]?.[p.id]?.value || ''} onChange={e => handleCommissionChange(s.status_name, p.id, 'value', e.target.value)} />
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-300 font-bold">{commissions[s.status_name]?.[p.id]?.type === 'nominal' ? '' : '%'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </TabsContent>
                        ))}
                    </Tabs>
                </div>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t flex justify-end gap-3 shrink-0">
                <Button type="button" variant="ghost" onClick={() => setIsModalAddOpen(false)} className="rounded-xl font-bold">Batal</Button>
                <Button type="submit" disabled={isSaving} className="bg-[#10182b] text-white rounded-xl px-10 font-bold hover:bg-slate-800 transition-all shadow-lg">{isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />} Aktifkan Dropshipper</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL EDIT */}
      <Dialog open={isModalEditOpen} onOpenChange={setIsModalEditOpen}>
        <DialogContent className="sm:max-w-4xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-blue-700 text-white">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg"><Settings className="h-6 w-6 text-white" /></div>
                <div>
                    <DialogTitle className="text-xl font-bold text-white">Edit Dropshipper & Matrix Komisi</DialogTitle>
                    <DialogDescription className="text-blue-100 italic">Perbarui data profil dan sesuaikan skema bagi hasil produk.</DialogDescription>
                </div>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/50">
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2"><ChevronRight className="h-3 w-3 text-blue-500" /> Profil & Data Rekening</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-600">Nama Lengkap</Label><Input value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="rounded-xl bg-white border-slate-200 h-10" /></div>
                        <div className="space-y-1.5"><Label className="text-xs font-bold text-slate-600">WhatsApp</Label><Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="rounded-xl bg-white border-slate-200 h-10" /></div>
                        <div className="md:col-span-1 space-y-1.5">
                            <Label className="text-xs font-bold text-slate-600 flex items-center gap-2"><CreditCard className="h-3 w-3" /> Info Rekening</Label>
                            <Input value={formData.rekening} onChange={e => setFormData({...formData, rekening: e.target.value})} className="rounded-xl bg-white border-slate-200 h-10" />
                        </div>
                    </div>
                </div>

                <Separator className="bg-slate-100" />
                
                <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2"><Package className="h-3 w-3 text-blue-500" /> Matrix Komisi (Update)</h4>
                    <Tabs defaultValue={statuses[0]?.status_name} className="w-full border rounded-2xl overflow-hidden bg-white shadow-sm">
                        <TabsList className="w-full justify-start rounded-none h-12 bg-slate-50 border-b p-0 overflow-x-auto">
                            {statuses.map(s => <TabsTrigger key={s.status_name} value={s.status_name} className="h-full rounded-none px-6 text-[10px] font-black uppercase data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 transition-all">{s.status_name}</TabsTrigger>)}
                        </TabsList>
                        {statuses.map(s => (
                            <TabsContent key={s.status_name} value={s.status_name} className="m-0 bg-slate-50/30">
                                <div className="grid grid-cols-1 md:grid-cols-2 p-4 gap-4">
                                    {products.map(p => (
                                        <div key={p.id} className="bg-white border border-slate-100 p-4 rounded-xl flex items-center justify-between gap-4 shadow-sm hover:border-blue-200 transition-all">
                                            <div className="flex-1 min-w-0"><p className="text-xs font-bold text-slate-700 truncate">{p.name}</p></div>
                                            <div className="flex items-center gap-2">
                                                <div className="flex bg-slate-100 p-1 rounded-lg border">
                                                    <button type="button" onClick={() => handleCommissionChange(s.status_name, p.id, 'type', 'percentage')} className={cn("px-2.5 py-1 text-[9px] font-bold rounded-md transition-all", commissions[s.status_name]?.[p.id]?.type !== 'nominal' ? "bg-blue-600 text-white shadow-sm" : "text-slate-400")}> % </button>
                                                    <button type="button" onClick={() => handleCommissionChange(s.status_name, p.id, 'type', 'nominal')} className={cn("px-2.5 py-1 text-[9px] font-bold rounded-md transition-all", commissions[s.status_name]?.[p.id]?.type === 'nominal' ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400")}> Rp </button>
                                                </div>
                                                <div className="relative w-28">
                                                    <Input type="number" className="h-9 text-right font-black text-xs pr-6 rounded-lg border-blue-100 focus:border-blue-500" value={commissions[s.status_name]?.[p.id]?.value || ''} onChange={e => handleCommissionChange(s.status_name, p.id, 'value', e.target.value)} />
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-300 font-bold">{commissions[s.status_name]?.[p.id]?.type === 'nominal' ? '' : '%'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </TabsContent>
                        ))}
                    </Tabs>
                </div>
            </div>
            <DialogFooter className="p-6 bg-white border-t flex justify-end gap-3 shrink-0">
                <Button variant="ghost" onClick={() => setIsModalEditOpen(false)} className="rounded-xl font-bold">Batalkan</Button>
                <Button onClick={handleUpdateCommissions} disabled={isSaving} className="bg-blue-700 text-white rounded-xl px-10 font-bold hover:bg-blue-800 transition-all shadow-lg">{isSaving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />} Simpan Perubahan Matrix</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DropshipperManagement;