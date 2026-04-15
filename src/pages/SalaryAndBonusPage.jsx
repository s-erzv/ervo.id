import { useEffect, useState, useMemo } from 'react';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'react-hot-toast';
import { 
  Loader2, 
  DollarSign, 
  FileText, 
  Plus, 
  X, 
  Send, 
  Trash2, 
  Edit, 
  XCircle, 
  Download, 
  FileDown,
  Package,
  Info,
  Save,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter, 
  DialogDescription 
} from '@/components/ui/dialog'; 
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { logFinancialTransaction } from '@/lib/FinancialUtils'; 
import * as XLSX from 'xlsx';

const getTodayDate = () => new Date().toISOString().slice(0, 10);
const getStartOfMonth = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

const SalaryAndBonusPage = () => {
  const { companyId, session } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(getStartOfMonth());
  const [endDate, setEndDate] = useState(getTodayDate());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  
  // State Capaian
  const [employeeAchievements, setEmployeeAchievements] = useState([]);
  const [displayedAchievement, setDisplayedAchievement] = useState({ total_orders: 0, total_packages: 0, item_details: [] });
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // State Payout & Penyesuaian
  const [additionalItems, setAdditionalItems] = useState([{ type: 'Tambahan', description: '', amount: '' }]);
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [paymentAmountInput, setPaymentAmountInput] = useState(''); 
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false); 
  
  // State Riwayat & Edit
  const [allHistory, setAllHistory] = useState([]); 
  const [isLoadingHistory, setIsLoadingHistory] = useState(false); 
  const [editingPayoutId, setEditingPayoutId] = useState(null);
  const [historyFilter, setHistoryFilter] = useState('all');

  // --- CALCULATIONS ---
  const currentEmployee = useMemo(() => employees.find(e => e.id === selectedEmployeeId), [employees, selectedEmployeeId]);
  const fixedBaseSalary = useMemo(() => parseFloat(currentEmployee?.base_salary || 0), [currentEmployee]);
  
  const totalAdjustment = useMemo(() => {
    return additionalItems.reduce((sum, item) => {
      const amount = parseFloat(item.amount) || 0;
      return sum + (item.type === 'Tambahan' ? amount : -amount);
    }, 0);
  }, [additionalItems]);

  const totalLiability = useMemo(() => Math.max(0, fixedBaseSalary + totalAdjustment), [fixedBaseSalary, totalAdjustment]); 

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'all') return allHistory;
    return allHistory.filter(item => item.status === historyFilter);
  }, [allHistory, historyFilter]);

  // --- FETCHERS ---
  const fetchAllHistory = async () => {
    if (!companyId) return;
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('salary_payouts')
        .select(`*, profiles:employee_id (full_name, rekening, base_salary)`)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAllHistory(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleFetchAchievements = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_courier_achievements', {
        p_company_id: companyId,
        p_start_date: startDate,
        p_end_date: endDate,
      });
      if (error) throw error;
      setEmployeeAchievements(data || []);
      if (selectedEmployeeId) {
        const ach = (data || []).find(a => a.id === selectedEmployeeId);
        setDisplayedAchievement(ach || { total_orders: 0, total_packages: 0, item_details: [] });
      }
    } catch (err) {
      console.error(err);
      toast.error("Gagal memuat data capaian.");
    } finally {
      setLoading(false);
    }
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: employeesData } = await supabase.from('profiles').select('id, full_name, rekening, base_salary').eq('company_id', companyId).eq('role', 'user').order('full_name');
      const { data: methodsData } = await supabase.from('payment_methods').select('*').eq('company_id', companyId).eq('is_active', true);
      
      setEmployees(employeesData || []);
      setPaymentMethods(methodsData || []);
      await handleFetchAchievements();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (companyId) { fetchInitialData(); fetchAllHistory(); } }, [companyId]);

  useEffect(() => {
    if (selectedEmployeeId) {
      const ach = employeeAchievements.find(a => a.id === selectedEmployeeId);
      setDisplayedAchievement(ach || { total_orders: 0, total_packages: 0, item_details: [] });
    }
  }, [selectedEmployeeId]);

  // --- ACTIONS ---
  const handleRecordPayment = async (e, isDraft = false) => {
    if(e) e.preventDefault();
    const amountToPay = parseFloat(paymentAmountInput) || totalLiability;
    
    // Validasi dasar
    if (!selectedEmployeeId) return toast.error('Harap pilih karyawan.');
    if (!isDraft && (!paymentMethodId || amountToPay <= 0)) {
        return toast.error('Untuk pembayaran selesai, harap isi nominal dan metode pembayaran.');
    }

    setIsSubmitting(true);
    const toastId = toast.loading(isDraft ? 'Menyimpan draft...' : 'Memproses pembayaran...');

    try {
      const timestamp = new Date().getTime();
      const status = isDraft ? 'draft' : 'completed';

      // Hanya log transaksi finansial jika statusnya Completed
      if (!isDraft) {
          let amountToLog = amountToPay;
          let transactionType = 'expense';

          // Jika ini adalah update dari Completed ke Completed, hitung selisih
          const existingData = allHistory.find(p => p.id === editingPayoutId);
          if (editingPayoutId && existingData?.status === 'completed') {
            const oldAmount = parseFloat(existingData?.amount || 0);
            const delta = amountToPay - oldAmount;
            if (delta === 0) amountToLog = 0;
            else if (delta > 0) { amountToLog = delta; transactionType = 'expense'; }
            else { amountToLog = Math.abs(delta); transactionType = 'income'; }
          }

          if (amountToLog > 0) {
            await logFinancialTransaction({
              companyId,
              type: transactionType,
              categoryName: 'Biaya Karyawan',
              subcategoryName: 'Gaji Pokok / Merit',
              amount: amountToLog,
              description: `${editingPayoutId ? '[EDIT]' : 'Gaji'}: ${currentEmployee.full_name} (${startDate} s/d ${endDate}) [Ref:${timestamp}]`,
              transactionDate: new Date(),
              paymentMethodId,
              sourceTable: 'salary_payouts',
              sourceId: selectedEmployeeId,
            });
          }
      }

      const { error: upsertError } = await supabase.from('salary_payouts').upsert({
          id: editingPayoutId || undefined,
          employee_id: selectedEmployeeId,
          company_id: companyId,
          amount: amountToPay,
          status: status, // Kolom status baru
          payment_method_id: paymentMethodId || null,
          period: `${startDate} s/d ${endDate}`,
          description: `Detail: ${additionalItems.filter(i => i.description).map(i => `${i.type} (${i.description})`).join('; ')}`,
          metadata: additionalItems
      });

      if (upsertError) throw upsertError;

      toast.success(isDraft ? 'Draft berhasil disimpan!' : 'Gaji berhasil dibayarkan!', { id: toastId });
      cancelEdit();
      fetchAllHistory();
    } catch (error) {
      toast.error('Gagal: ' + error.message, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGeneratePDF = async (payout) => {
    setIsGenerating(true);
    const toastId = toast.loading("Menyiapkan Slip Gaji...");
    try {
      const { data, error } = await supabase.functions.invoke('generate-salary-pdf', {
        body: {
          employee: payout.profiles,
          achievement: displayedAchievement, 
          totalPayout: payout.amount,
          basePay: payout.profiles.base_salary,
          adjustments: payout.metadata || [],
          period: payout.period,
          companyId: companyId,
          startDate: payout.period.split(' s/d ')[0],
          endDate: payout.period.split(' s/d ')[1]
        }
      });

      if (error) throw error;
      window.open(data.pdfUrl, '_blank');
      toast.success("Slip Gaji siap!", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Gagal cetak PDF: " + err.message, { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEditClick = (payout) => {
    setEditingPayoutId(payout.id);
    setSelectedEmployeeId(payout.employee_id);
    const dates = payout.period.split(' s/d ');
    setStartDate(dates[0]);
    setEndDate(dates[1]);
    setPaymentAmountInput(payout.amount.toString());
    setPaymentMethodId(payout.payment_method_id || '');
    if (payout.metadata) setAdditionalItems(payout.metadata);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteClick = async (payout) => {
    if (!window.confirm(`Hapus catatan gaji ${payout.profiles?.full_name}?`)) return;
    setIsSubmitting(true);
    try {
      // Refund saldo HANYA jika statusnya completed
      if (payout.status === 'completed') {
          await logFinancialTransaction({
            companyId,
            type: 'income',
            categoryName: 'Biaya Karyawan',
            subcategoryName: 'Gaji Pokok / Merit',
            amount: payout.amount,
            description: `[REFUND] Pembatalan Gaji: ${payout.profiles?.full_name} (${payout.period})`,
            transactionDate: new Date(),
            paymentMethodId: payout.payment_method_id || paymentMethods[0]?.id,
            sourceTable: 'salary_payouts',
            sourceId: payout.employee_id,
          });
      }

      await supabase.from('salary_payouts').delete().eq('id', payout.id);
      toast.success('Data berhasil dihapus');
      fetchAllHistory();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelEdit = () => {
    setEditingPayoutId(null);
    setPaymentAmountInput('');
    setAdditionalItems([{ type: 'Tambahan', description: '', amount: '' }]);
    setSelectedEmployeeId('');
    setPaymentMethodId('');
  };

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredHistory.map(h => ({
      Karyawan: h.profiles?.full_name,
      Periode: h.period,
      Total: h.amount,
      Status: h.status === 'completed' ? 'Selesai' : 'Draft',
      Keterangan: h.description
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Gaji");
    XLSX.writeFile(wb, "Riwayat_Gaji.xlsx");
  };

  if (loading && employees.length === 0) return <div className="flex justify-center p-20"><Loader2 className="animate-spin h-10 w-10" /></div>;

  return (
    <div className="container mx-auto p-2 sm:p-4 md:p-8 max-w-7xl space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <DollarSign className="h-6 w-6 text-green-600" /> Gaji & Bonus
        </h1>
        {editingPayoutId && (
            <div className="flex gap-2">
                <Badge className="bg-orange-500 animate-pulse">MODE EDIT</Badge>
                {allHistory.find(p => p.id === editingPayoutId)?.status === 'draft' && <Badge variant="outline">DRAFT</Badge>}
            </div>
        )}
      </div>

      <Card className={`border-0 shadow-lg overflow-hidden ${editingPayoutId ? 'ring-2 ring-orange-500' : ''}`}>
        <CardHeader className={`${editingPayoutId ? 'bg-orange-600' : 'bg-[#011e4b]'} text-white p-4`}>
          <CardTitle className="text-base flex items-center gap-2">
            {editingPayoutId ? <Edit className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            {editingPayoutId ? 'Update Detail Gaji' : 'Hitung Gaji Baru'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Karyawan</Label>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Dari</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>Sampai</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>

          <Button onClick={handleFetchAchievements} variant="secondary" className="w-full">
            <Package className="h-4 w-4 mr-2" /> Refresh Data Capaian
          </Button>

          {selectedEmployeeId && (
            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-3">
              <Card className="bg-slate-50 p-3">
                <p className="text-[10px] text-slate-500 font-bold uppercase">Gaji Pokok</p>
                <p className="text-lg font-bold">{formatCurrency(fixedBaseSalary)}</p>
              </Card>
              <Card className="bg-blue-50 p-3 flex justify-between items-center cursor-pointer" onClick={() => setIsDetailModalOpen(true)}>
                <div>
                  <p className="text-[10px] text-blue-700 font-bold uppercase">Order</p>
                  <p className="text-lg font-bold">{displayedAchievement.total_orders}</p>
                </div>
                <Info className="h-4 w-4 text-blue-400" />
              </Card>
              <Card className="bg-green-50 p-3 flex justify-between items-center cursor-pointer" onClick={() => setIsDetailModalOpen(true)}>
                <div>
                  <p className="text-[10px] text-green-700 font-bold uppercase">Barang</p>
                  <p className="text-lg font-bold">{displayedAchievement.total_packages}</p>
                </div>
                <Package className="h-4 w-4 text-green-400" />
              </Card>
            </div>
          )}

          <Separator />

          <div className="space-y-3">
            <Label className="font-bold">Bonus & Potongan Manual</Label>
            {additionalItems.map((item, index) => (
              <div key={index} className="flex flex-col sm:flex-row gap-2 p-3 border rounded-lg bg-slate-50">
                <Input className="flex-1" placeholder="THR / Makan.." value={item.description} onChange={(e) => {
                  const n = [...additionalItems]; n[index].description = e.target.value; setAdditionalItems(n);
                }} />
                <div className="flex gap-2">
                  <Select value={item.type} onValueChange={(v) => {
                    const n = [...additionalItems]; n[index].type = v; setAdditionalItems(n);
                  }}>
                    <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Tambahan">(+)</SelectItem><SelectItem value="Potongan">(-)</SelectItem></SelectContent>
                  </Select>
                  <Input className="w-full sm:w-[130px]" type="number" placeholder="Rp" value={item.amount} onChange={(e) => {
                    const n = [...additionalItems]; n[index].amount = e.target.value; setAdditionalItems(n);
                  }} />
                  <Button variant="ghost" size="icon" onClick={() => setAdditionalItems(additionalItems.filter((_, i) => i !== index))} disabled={additionalItems.length === 1}>
                    <X className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => setAdditionalItems([...additionalItems, { type: 'Tambahan', description: '', amount: '' }])}>
              <Plus className="h-3 w-3 mr-1" /> Tambah Baris
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-900 text-white p-5 rounded-2xl shadow-xl">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between opacity-70"><span>Base:</span><span>{formatCurrency(fixedBaseSalary)}</span></div>
              <div className="flex justify-between opacity-70"><span>Adj:</span><span>{formatCurrency(totalAdjustment)}</span></div>
              <Separator className="bg-white/10" />
              <div className="flex justify-between text-xl font-black">
                <span>TOTAL:</span>
                <span className="text-green-400">{formatCurrency(paymentAmountInput || totalLiability)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <Input type="number" value={paymentAmountInput} onChange={(e) => setPaymentAmountInput(e.target.value)} className="bg-white text-black font-bold" placeholder="Nominal Bayar" />
              <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
                <SelectTrigger className="bg-white text-black"><SelectValue placeholder="Pilih Rekening (Wajib jika bayar)" /></SelectTrigger>
                <SelectContent>{paymentMethods.map(m => <SelectItem key={m.id} value={m.id}>{m.method_name}</SelectItem>)}</SelectContent>
              </Select>
              
              <div className="flex flex-col sm:flex-row gap-2">
                {editingPayoutId && <Button type="button" variant="outline" onClick={cancelEdit} className="flex-1 text-white border-white/20">Batal</Button>}
                
                <Button 
                    type="button" 
                    onClick={() => handleRecordPayment(null, true)} 
                    disabled={isSubmitting} 
                    variant="secondary"
                    className="flex-1"
                >
                  <Save className="h-4 w-4 mr-2" /> Simpan Draft
                </Button>

                <Button 
                    type="button" 
                    onClick={() => handleRecordPayment(null, false)} 
                    disabled={isSubmitting} 
                    className={`flex-1 ${editingPayoutId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600'}`}
                >
                  {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  Bayar & Selesai
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Tabs defaultValue="all" value={historyFilter} onValueChange={setHistoryFilter} className="w-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <TabsList>
                    <TabsTrigger value="all">Semua</TabsTrigger>
                    <TabsTrigger value="completed" className="text-green-600">Selesai</TabsTrigger>
                    <TabsTrigger value="draft" className="text-orange-600">Draft</TabsTrigger>
                </TabsList>
                <Button variant="outline" size="sm" onClick={handleExportExcel}><Download className="h-4 w-4 mr-2" /> Excel</Button>
            </div>

            <div className="bg-white border rounded-xl overflow-hidden shadow-sm mt-4">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b text-[10px] font-bold uppercase text-slate-500">
                    <tr>
                    <th className="p-4">Karyawan</th>
                    <th className="p-4">Periode</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4">Total</th>
                    <th className="p-4 text-right">Aksi</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {isLoadingHistory ? (
                    <tr><td colSpan="5" className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-slate-300" /></td></tr>
                    ) : filteredHistory.length === 0 ? (
                    <tr><td colSpan="5" className="p-10 text-center text-slate-400 italic">Tidak ada riwayat untuk filter ini</td></tr>
                    ) : filteredHistory.map(payout => (
                    <tr key={payout.id} className="hover:bg-slate-50">
                        <td className="p-4">
                            <div className="font-bold">{payout.profiles?.full_name}</div>
                            <div className="text-[10px] text-slate-400">ID: {payout.id.slice(0,8)}</div>
                        </td>
                        <td className="p-4 text-xs text-slate-500">{payout.period}</td>
                        <td className="p-4 text-center">
                            {payout.status === 'completed' ? (
                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">Selesai</Badge>
                            ) : (
                                <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">Draft</Badge>
                            )}
                        </td>
                        <td className="p-4 font-bold text-slate-700">{formatCurrency(payout.amount)}</td>
                        <td className="p-4 text-right space-x-1 whitespace-nowrap">
                        <Button variant="ghost" size="icon" onClick={() => handleGeneratePDF(payout)} title="Cetak Slip"><FileDown className="h-4 w-4 text-blue-600" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(payout)}><Edit className="h-4 w-4 text-orange-500" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(payout)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
            </div>
        </Tabs>
      </div>

      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Rincian Barang Terkirim</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {displayedAchievement.item_details?.map((item, i) => (
              <div key={i} className="flex justify-between p-2 border-b">
                <span className="text-sm">{item.product_name}</span>
                <Badge>{item.total_qty} Unit</Badge>
              </div>
            ))}
          </div>
          <DialogFooter><Button onClick={() => setIsDetailModalOpen(false)}>Tutup</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalaryAndBonusPage;