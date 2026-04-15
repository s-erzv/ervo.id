import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
import { toast } from 'react-hot-toast';
import { Loader2, Plus, Trash, Eye, FileText, Calendar, User, CreditCard, CheckCircle, Clock, AlertCircle, Send, Pencil, Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

const ExpenseReportsPage = () => {
  const { companyId, userProfile, session } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expenseItems, setExpenseItems] = useState([
    { type: 'bensin', description: '', amount: '' },
  ]);
  const [employees, setEmployees] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [adminPhone, setAdminPhone] = useState(null);
  
  const [submitterId, setSubmitterId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentTo, setPaymentTo] = useState('');
  
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  
  // State untuk pembayaran baru
  const [isRecordPaymentModalOpen, setIsRecordPaymentModalOpen] = useState(false);
  const [newPaymentAmount, setNewPaymentAmount] = useState('');
  const [newPaymentMethodId, setNewPaymentMethodId] = useState('');
  const [adminFee, setAdminFee] = useState(0); 

  // State baru untuk menyimpan riwayat deskripsi (untuk autosuggest)
  const [expenseDescriptionsHistory, setExpenseDescriptionsHistory] = useState([]);
  
  const expenseTypes = ['Bongkar', 'Bensin', 'Makan', 'Kasbon', 'Lainnya'];

  // FIX: Definisikan currentSubmitter menggunakan useMemo
  const currentSubmitter = useMemo(() => employees.find(emp => emp.id === submitterId), [employees, submitterId]);

  useEffect(() => {
    if (companyId) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  useEffect(() => {
    const fetchAdminPhone = async () => {
        if (!companyId) return;
        const { data: adminProfile, error } = await supabase
            .from('profiles')
            .select('phone')
            .eq('company_id', companyId)
            .eq('role', 'admin')
            .single();
        if (error) {
            console.error('Error fetching admin phone:', error);
        } else {
            setAdminPhone(adminProfile?.phone);
        }
    };
    fetchAdminPhone();
  }, [companyId]);
  
  const calculatePaymentStatus = (totalAmount, totalPaid) => {
    if (totalPaid >= totalAmount - 0.0001) return 'paid';
    if (totalPaid > 0) return 'partial';
    return 'pending';
  };

  const fetchData = async () => {
    setLoading(true);

    const { data: reportsData, error: reportsError } = await supabase
      .from('expense_reports')
      .select(`
        *,
        user:user_id(full_name, rekening),
        items:expense_report_items(*)
      `)
      .eq('company_id', companyId)
      .order('report_date', { ascending: false });
    
    // Fetch semua financial_transactions untuk laporan yang ada
    const reportIds = reportsData?.map(r => r.id) || [];
    const { data: transactionsData } = await supabase
        .from('financial_transactions')
        .select('source_id, amount, payment_method_id, description, id, transaction_date')
        .in('source_id', reportIds)
        .eq('source_table', 'expense_reports')
        .eq('type', 'expense');

    if (reportsError) {
      console.error('Error fetching expense reports:', reportsError);
      toast.error('Gagal memuat laporan pengeluaran.');
      setReports([]);
    } else {
      const paymentsByReport = (transactionsData || []).reduce((acc, tx) => {
          acc[tx.source_id] = acc[tx.source_id] || { total: 0, transactions: [] };
          acc[tx.source_id].total += parseFloat(tx.amount || 0);
          acc[tx.source_id].transactions.push(tx);
          return acc;
      }, {});
      
      // Ganti blok pemrosesan data di dalam fetchData dengan ini:
      const reportsWithStatus = reportsData.map(report => {
        const totalPaid = paymentsByReport[report.id]?.total || 0;
        const remainingDue = Math.max(0, report.total_amount - totalPaid); // Tambahkan Math.max agar tidak minus karena pembulatan
        
        return {
          ...report,
          total_paid: totalPaid,
          remaining_due: remainingDue,
          // Status WAJIB ambil dari DB report.status
          payment_status: report.status, 
          payment_transactions: paymentsByReport[report.id]?.transactions || [],
        };
      });

      setReports(reportsWithStatus);
    }

    const { data: employeesData, error: employeesError } = await supabase
      .from('profiles')
      .select('id, full_name, rekening, role')
      .eq('company_id', companyId)
      .order('full_name', { ascending: true });

    if (!employeesError) {
        setEmployees(employeesData);
    }
    
    const { data: methodsData, error: methodsError } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('company_id', companyId);

    if (!methodsError) {
        setPaymentMethods(methodsData);
    }
    
    // START FIX: Fetch description history
    const { data: historyData, error: historyError } = await supabase
        .from('expense_report_items')
        .select('description')
        .eq('type', 'lainnya')
        .neq('description', ''); // Ignore empty descriptions
    
    if (!historyError) {
        const uniqueDescriptions = Array.from(new Set((historyData || []).map(item => item.description)));
        setExpenseDescriptionsHistory(uniqueDescriptions);
    } else {
        console.error('Error fetching expense history:', historyError);
    }
    // END FIX

    setLoading(false);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...expenseItems];
    newItems[index][field] = value;
    
    // FIX: Kosongkan deskripsi jika jenisnya bukan 'lainnya'
    if (field === 'type' && value !== 'lainnya') {
        newItems[index].description = '';
    }
    
    setExpenseItems(newItems);
  };

  const handleAddItem = () => {
    setExpenseItems([...expenseItems, { type: 'bensin', description: '', amount: '' }]);
  };

  const handleRemoveItem = (index) => {
    const newItems = expenseItems.filter((_, i) => i !== index);
    setExpenseItems(newItems);
  };

  const calculateTotal = () => {
    return expenseItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  };
  
  const handlePaymentMethodChange = (value) => {
    setPaymentMethod(value);
    // Menggunakan currentSubmitter yang sudah di-memoized
    if (value === 'transfer' && currentSubmitter) {
        setPaymentTo(currentSubmitter.rekening || '');
    } else {
        setPaymentTo('');
    }
  };

  const handleTransferClick = (report) => {
    if (!adminPhone) {
        toast.error('Nomor telepon admin tidak ditemukan.');
        return;
    }
    
    const nama = report?.user?.full_name || 'Karyawan';
    const rekening = report?.user?.rekening || '-';
    const formattedAmount = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(Number(report?.remaining_due || 0));

    const tanggal = new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'long',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(report?.report_date || Date.now()));

    const metode = report?.payment_method || '-';

    const message = `Halo bang, saya mau ngajuin reimbursement untuk Laporan Pengeluaran berikut (sisa tagihan):
- Tanggal: ${tanggal}
- Karyawan: ${nama}
- Jumlah: ${formattedAmount}
- Rekening Tujuan: ${rekening}

Tolong diproses ya bang, dan konfirmasi kalau udah ditransfer. Makasih 🙏`;

    const whatsappUrl = `https://api.whatsapp.com/send?phone=${adminPhone}&text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };
  
  const handleOpenPaymentModal = (report) => {
      setSelectedReport(report);
      setNewPaymentAmount(report.remaining_due.toFixed(0));
      setAdminFee(0);
      setIsRecordPaymentModalOpen(true);
  };

 // 1. Perbaikan di dalam fungsi fetchData (Sekitar baris 90)

  const handleRecordPayment = async (e) => {
      e.preventDefault();

      // 1. Validasi Input Dasar
      if (!newPaymentMethodId || !selectedReport) {
        toast.error('Metode pembayaran dan laporan harus dipilih.');
        return;
      }

      const amount = parseFloat(newPaymentAmount) || 0;
      const fee = parseFloat(adminFee) || 0;
      const totalPayment = amount + fee;

      if (totalPayment <= 0) {
        toast.error('Jumlah pembayaran harus lebih dari Rp 0.');
        return;
      }

      // Pengecekan agar input tidak melebihi sisa tagihan (toleransi Rp 1)
      if (amount > selectedReport.remaining_due + 1) {
        toast.error(`Jumlah pokok (Rp${amount.toLocaleString('id-ID')}) melebihi sisa tagihan.`);
        return;
      }

      setLoading(true);
      setIsRecordPaymentModalOpen(false);

      try {
        // Membuat string waktu unik (jam:menit:detik) untuk menghindari error 409 Conflict (Unique Constraint)
        const now = new Date();
        const timeString = now.toLocaleTimeString('id-ID', { 
          hour: '2-digit', 
          minute: '2-digit', 
          second: '2-digit' 
        });

        // 2. Simpan transaksi keuangan ke tabel financial_transactions
        const { error: insertError } = await supabase
          .from('financial_transactions')
          .insert({
            company_id: companyId,
            type: 'expense',
            amount: totalPayment,
            description: `Pembayaran Reimbursement ${selectedReport.user?.full_name || 'karyawan'} (${timeString}) (Pokok: ${formatCurrency(amount)} + Fee: ${formatCurrency(fee)})`,
            payment_method_id: newPaymentMethodId,
            source_table: 'expense_reports',
            source_id: selectedReport.id,
            transaction_date: now.toISOString()
          });

        if (insertError) throw insertError;

        // 3. Logika Penentuan Status Lunas
        // Kita hitung total yang sudah dibayar (data lama + input baru)
        const currentTotalPaid = selectedReport.total_paid || 0;
        const totalPaidAfterThis = currentTotalPaid + amount;
        
        // Menggunakan toleransi Rp 100 untuk mengantisipasi selisih pembulatan (seperti -Rp 2 di gambar kamu)
        const isFullyPaidNow = totalPaidAfterThis >= (selectedReport.total_amount - 100);

        // 4. Update status di tabel expense_reports agar status di database berubah
        const { error: updateStatusError } = await supabase
          .from('expense_reports')
          .update({ 
            status: isFullyPaidNow ? 'paid' : 'pending' 
          })
          .eq('id', selectedReport.id);

        if (updateStatusError) {
          console.error("Gagal sinkron status ke database:", updateStatusError);
        }

        toast.success(isFullyPaidNow ? 'Pembayaran Lunas!' : 'Pembayaran Cicilan Berhasil Dicatat');

        // 5. WAJIB RE-FETCH DATA
        // Ini akan menarik data terbaru dari DB sehingga laporan otomatis pindah dari Tab Pending ke Tab Lunas
        await fetchData();

      } catch (error) {
        console.error('Error during payment confirmation:', error);
        toast.error('Gagal memproses pembayaran: ' + (error.message || 'Terjadi kesalahan'));
      } finally {
        setLoading(false);
        // Reset Form Input
        setNewPaymentAmount('');
        setNewPaymentMethodId('');
        setAdminFee(0);
        setSelectedReport(null);
      }
    };

// 3. Perbaikan Filter Tab (Sekitar baris 330 sebelum return)
// Pastikan filternya sesuai dengan string status yang ada di DB


  const handleEditReport = (report) => {
    setSelectedReport(report);
    // Pastikan item yang dimasukkan ke state memiliki format yang benar
    setExpenseItems(report.items.map(item => ({...item, amount: item.amount.toString() })));
    setSubmitterId(report.user_id);
    setPaymentMethod(report.payment_method);
    setPaymentTo(report.payment_to_account);
    setIsEditModalOpen(true);
  };

  const handleUpdateReport = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const totalAmount = expenseItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

    try {
      const payload = {
        reportId: selectedReport.id,
        expenseReport: {
          user_id: submitterId,
          total_amount: totalAmount,
          payment_method: paymentMethod,
          payment_to_account: paymentTo,
        },
        expenseItems: expenseItems.map(item => ({
          type: item.type,
          description: item.description,
          amount: parseFloat(item.amount) || 0,
        })),
      };

      const { data, error } = await supabase.functions.invoke('manage-expense-report', {
        method: 'PUT',
        body: payload,
      });

      if (error) throw error;
      
      const { error: updateStatusError } = await supabase
          .from('expense_reports')
          .update({ status: 'pending' })
          .eq('id', selectedReport.id);
          
      if (updateStatusError) {
          console.warn("Gagal update status report ke pending setelah edit:", updateStatusError);
      }


      toast.success('Laporan pengeluaran berhasil diperbarui!');
      setIsEditModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error updating expense report:', error.message);
      toast.error('Gagal memperbarui laporan: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus laporan ini? Semua transaksi pembayaran akan dibatalkan.')) return;
    setLoading(true);
    try {
      const payload = {
        reportId: reportId,
        companyId: companyId
      };
      
      const { data, error } = await supabase.functions.invoke('manage-expense-report', {
        method: 'DELETE',
        body: payload,
      });

      if (error) throw error;
      
      toast.success('Laporan berhasil dihapus dan transaksi dibatalkan!');
      fetchData();
    } catch (error) {
      console.error('Error deleting expense report:', error.message);
      toast.error('Gagal menghapus laporan: ' + error.message);
    } finally {
      setLoading(false);
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Final check for description requirement
    const hasRequiredDescription = expenseItems.every(item => 
        item.type !== 'lainnya' || (item.type === 'lainnya' && item.description && item.description.trim() !== '')
    );

    if (!hasRequiredDescription) {
        toast.error('Deskripsi Keperluan wajib diisi untuk jenis "Lainnya".');
        setIsSubmitting(false);
        return;
    }
    
    const totalAmount = expenseItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    
    const expenseReport = {
      company_id: companyId,
      user_id: submitterId,
      report_date: new Date().toISOString().slice(0, 10),
      total_amount: totalAmount,
      payment_method: paymentMethod,
      payment_to_account: paymentTo,
      status: 'pending', // Status awal harus pending
    };
    
    const payload = {
      expenseReport,
      expenseItems: expenseItems.map(item => ({
        type: item.type,
        // Kirim deskripsi kosong jika jenisnya bukan 'lainnya'
        description: item.type === 'lainnya' ? item.description : '',
        amount: parseFloat(item.amount) || 0,
      })),
    };

    try {
      const { data, error } = await supabase.functions.invoke('submit-expense-report', {
        body: payload,
      });

      if (error) throw error;

      toast.success('Laporan pengeluaran berhasil disubmit!');
      setExpenseItems([{ type: 'bensin', description: '', amount: '' }]);
      setSubmitterId('');
      setPaymentTo('');
      setPaymentMethod('');
      fetchData();
    } catch (error) {
      console.error('Error submitting expense report:', error.message);
      toast.error('Gagal submit laporan pengeluaran: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-white">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-[#011e4b] mx-auto" />
          <p className="text-gray-600 text-lg">Memuat data...</p>
        </div>
      </div>
    );
  }

 // Ganti bagian ini (di bagian bawah sebelum return JSX):
 const pendingReports = reports.filter(r => r.payment_status === 'pending');
const paidReports = reports.filter(r => r.payment_status === 'paid');


  return (
    <div className="min-h-screen">
      <div className="container mx-auto p-4 lg:p-8 max-w-7xl space-y-6"> 
        <div className="text-left mb-4 pt-4">
          <h1 className="text-2xl lg:text-4xl font-bold text-[#011e4b] mb-1 flex items-center justify-start gap-2"> 
            <FileText className="h-6 w-6 lg:h-10 lg:w-10" />
            Laporan Pengeluaran
          </h1>
          <p className="text-gray-600 text-sm lg:text-lg">Kelola pengajuan reimbursement dengan mudah dan efisien</p>
        </div>

        {/* Form Pengajuan */}
        <Card className="mb-6 border-0 shadow-lg bg-white"> 
          <CardHeader className="bg-[#011e4b] text-white rounded-t-lg p-4"> 
            <CardTitle className="text-lg lg:text-2xl flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Buat Laporan Baru
            </CardTitle>
            <CardDescription className="text-gray-200 text-xs lg:text-sm">
              Isi formulir untuk mengajukan pengeluaran
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 lg:p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Expense Items */}
              <div className="space-y-4">
                <Label className="text-base font-semibold text-[#011e4b] flex items-center gap-2">
                  <FileText className="h-4 w-4" /> 
                  Daftar Pengeluaran
                </Label>
                <div className="space-y-4">
                  {expenseItems.map((item, index) => {
                    const requiresDescription = item.type === 'lainnya'; // FIX: Check if description is required
                    return (
                      <Card key={index} className="border border-gray-200 bg-gray-50">
                        <CardContent className="p-3"> 
                          {/* FIX: Adjust grid layout based on whether description is shown */}
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            
                            {/* JENIS PENGELUARAN (1 Kolom) */}
                            <div className="space-y-1"> 
                              <Label className="text-xs font-medium text-gray-700">Jenis Pengeluaran</Label>
                              <Select
                                value={item.type}
                                onValueChange={(value) => handleItemChange(index, 'type', value)}
                              >
                                <SelectTrigger className="bg-white border-gray-300 focus:border-[#011e4b] h-9 text-sm">
                                  <SelectValue placeholder="Pilih jenis" />
                                </SelectTrigger>
                                <SelectContent>
                                  {expenseTypes.map(type => (
                                    <SelectItem key={type} value={type.toLowerCase()}>{type}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            
                            {/* DESKRIPSI KEPERLUAN (CONDITIONAL: 2 Kolom) */}
                            {requiresDescription && (
                              <div className="md:col-span-2 space-y-1">
                                <Label className="text-xs font-medium text-gray-700">
                                  Deskripsi Keperluan (Wajib diisi)
                                </Label>
                                {/* FIX: Tambahkan datalist untuk history */}
                                <Input
                                  type="text"
                                  placeholder="Harap gunakan deskripsi yang konsisten (cth: Uang minum)"
                                  value={item.description}
                                  onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                  className="bg-white border-gray-300 focus:border-[#011e4b] h-9 text-sm"
                                  required={requiresDescription}
                                  list={`description-history-${index}`} // Datalist ID
                                />
                                <datalist id={`description-history-${index}`}>
                                    {expenseDescriptionsHistory.map(desc => (
                                        <option key={desc} value={desc} />
                                    ))}
                                </datalist>
                              </div>
                            )}

                            {/* NOMINAL (Rp) (Sisanya) */}
                            <div className={`space-y-1 ${!requiresDescription ? 'md:col-span-3' : ''}`}> 
                              <Label className="text-xs font-medium text-gray-700">Nominal (Rp)</Label>
                              <div className="flex gap-2">
                                <Input
                                  type="number"
                                  placeholder="0"
                                  value={item.amount}
                                  onChange={(e) => handleItemChange(index, 'amount', e.target.value)}
                                  className="bg-white border-gray-300 focus:border-[#011e4b] h-9 text-sm"
                                  required
                                />
                                {expenseItems.length > 1 && (
                                  <Button 
                                    type="button" 
                                    variant="destructive" 
                                    size="icon" 
                                    onClick={() => handleRemoveItem(index)}
                                    className="shrink-0 h-9 w-9"
                                  >
                                    <Trash className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                      </CardContent>
                    </Card>
                  );
                  })}
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full border-[#011e4b] text-[#011e4b] hover:bg-[#011e4b] hover:text-white transition-colors h-9 text-sm" 
                  onClick={handleAddItem}
                >
                  <Plus className="h-4 w-4 mr-2" /> Tambah Item
                </Button>
              </div>
              
              {/* Total */}
              <Card className="border-[#011e4b] bg-gradient-to-r from-[#011e4b] to-[#00376a] text-white">
                <CardContent className="p-4"> 
                  <div className="flex justify-between items-center">
                    <span className="text-base font-semibold">Total Pengeluaran:</span>
                    <span className="text-xl lg:text-3xl font-bold">
                      Rp{calculateTotal().toLocaleString('id-ID')}
                    </span>
                  </div>
                </CardContent>
              </Card>
              
              {/* Payment Details */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"> 
                <div className="space-y-2">
                  <Label className="text-base font-semibold text-[#011e4b] flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Karyawan Pengaju
                  </Label>
                  <Select
                    value={submitterId}
                    onValueChange={setSubmitterId}
                    required
                  >
                    <SelectTrigger className="bg-white border-gray-300 focus:border-[#011e4b] h-10 text-sm">
                      <SelectValue placeholder="Pilih nama karyawan" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map(employee => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-base font-semibold text-[#011e4b] flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Metode Pembayaran
                  </Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={handlePaymentMethodChange}
                    disabled={!submitterId}
                    required
                  >
                    <SelectTrigger className="bg-white border-gray-300 focus:border-[#011e4b] h-10 text-sm">
                      <SelectValue placeholder="Pilih metode pembayaran" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Tunai (Cash)</SelectItem>
                      <SelectItem value="transfer" disabled={!currentSubmitter?.rekening}>
                        Transfer ({currentSubmitter?.rekening || 'Rekening tidak tersedia'})
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-[#011e4b] text-white hover:bg-[#00376a] h-10 text-base font-semibold transition-all duration-200 shadow-lg hover:shadow-xl" 
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> 
                    Mengirim Laporan...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Kirim Laporan Pengeluaran
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        
        {/* History Section with Tabs */}
        <Card className="border-0 shadow-lg bg-white">
          <CardHeader className="bg-gradient-to-r from-gray-100 to-gray-50 rounded-t-lg border-b p-4">
            <CardTitle className="text-lg lg:text-2xl text-[#011e4b] flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Riwayat Laporan
            </CardTitle>
            <CardDescription className="text-gray-600 text-sm">
              Pantau status dan detail semua pengajuan
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 lg:p-6">
            <Tabs defaultValue="pending" className="space-y-4">
              <TabsList className="grid w-full grid-cols-2 h-10">
                <TabsTrigger value="pending" className="gap-1 text-sm">
                  <Clock className="h-4 w-4" /> Pending ({pendingReports.length})
                </TabsTrigger>
                <TabsTrigger value="paid" className="gap-1 text-sm">
                  <CheckCircle className="h-4 w-4" /> Lunas ({paidReports.length})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="pending" className="space-y-4">
                {pendingReports.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-base font-semibold text-gray-600 mb-1">Tidak Ada Laporan Pending</h3>
                    <p className="text-sm text-gray-500">Semua laporan sudah diselesaikan.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> 
                    {pendingReports.map((report) => (
                      <Card 
                        key={report.id} 
                        className="cursor-pointer hover:shadow-xl transition-all duration-300 border-l-4 border-l-amber-500 hover:-translate-y-1" 
                        onClick={() => { setSelectedReport(report); setIsDetailModalOpen(true); }}
                      >
                        <CardHeader className="pb-3 p-4"> 
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <CardTitle className="text-lg text-[#011e4b] mb-1">
                                Rp{report.total_amount.toLocaleString('id-ID')}
                              </CardTitle>
                              <div className="flex items-center gap-2 text-xs text-gray-600">
                                <User className="h-3 w-3" />
                                {report.user?.full_name || '-'}
                              </div>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 ${
                                report.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              <Clock className="h-3 w-3" /> {report.payment_status === 'partial' ? 'SEBAGIAN' : 'PENDING'}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0 p-4"> 
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-600 flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Tanggal
                              </span>
                              <span className="font-medium">
                                {new Date(report.report_date).toLocaleDateString('id-ID')}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-600 flex items-center gap-1">
                                <CreditCard className="h-3 w-3" />
                                Dibayar
                              </span>
                              <span className="font-bold text-sm text-green-600">
                                {formatCurrency(report.total_paid)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-600 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Sisa Tagihan
                              </span>
                              <span className="font-bold text-sm text-red-600">
                                {formatCurrency(report.remaining_due)}
                              </span>
                            </div>
                            <div className="flex justify-end mt-4 gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-[#011e4b] hover:bg-[#011e4b] hover:text-white text-xs px-2"
                                onClick={(e) => { e.stopPropagation(); setSelectedReport(report); setIsDetailModalOpen(true); }}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Detail
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="bg-green-600 hover:bg-green-700 text-white text-xs px-2"
                                onClick={(e) => { e.stopPropagation(); handleOpenPaymentModal(report); }} 
                              >
                                <Send className="h-4 w-4 mr-1" />
                                Bayar
                              </Button>
                              <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteReport(report.id); }}
                              >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="paid" className="space-y-4">
                 {paidReports.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="text-base font-semibold text-gray-600 mb-1">Tidak Ada Laporan Lunas</h3>
                    <p className="text-sm text-gray-500">Laporan yang sudah dibayar akan muncul di sini.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {paidReports.map((report) => (
                      <Card 
                        key={report.id} 
                        className="cursor-pointer hover:shadow-xl transition-all duration-300 border-l-4 border-l-green-500 hover:-translate-y-1" 
                        onClick={() => { setSelectedReport(report); setIsDetailModalOpen(true); }}
                      >
                        <CardHeader className="pb-3 p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <CardTitle className="text-lg text-[#011e4b] mb-1">
                                Rp{report.total_amount.toLocaleString('id-ID')}
                              </CardTitle>
                              <div className="flex items-center gap-2 text-xs text-gray-600">
                                <User className="h-3 w-3" />
                                {report.user?.full_name || '-'}
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3" /> LUNAS
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0 p-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-600 flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Tanggal
                              </span>
                              <span className="font-medium">
                                {new Date(report.report_date).toLocaleDateString('id-ID')}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-600 flex items-center gap-1">
                                <CreditCard className="h-3 w-3" />
                                Dibayar
                              </span>
                              <span className="font-bold text-sm text-green-600">
                                {formatCurrency(report.total_paid)}
                              </span>
                            </div>
                            <div className="flex justify-end mt-4 gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-[#011e4b] hover:bg-[#011e4b] hover:text-white text-xs px-2"
                                onClick={(e) => { e.stopPropagation(); setSelectedReport(report); setIsDetailModalOpen(true); }}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Detail
                              </Button>
                              <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteReport(report.id); }}
                              >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      
      {/* Detail Modal */}
      {selectedReport && (
        <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
          <DialogContent className="sm:max-w-4xl max-h-[95vh] overflow-y-auto p-4 sm:p-6">
            <DialogHeader className="border-b pb-3">
              <DialogTitle className="text-lg lg:text-2xl text-[#011e4b] flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Detail Laporan
              </DialogTitle>
              <DialogDescription className="text-gray-600 text-sm">
                Informasi lengkap pengajuan dari <strong>{selectedReport.user?.full_name || '-'}</strong>
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4"> 
              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="border-[#011e4b] bg-gradient-to-br from-[#011e4b] to-[#00376a] text-white col-span-2 lg:col-span-1">
                  <CardContent className="p-3 text-center">
                    <div className="text-xs opacity-90 mb-1">Total Nominal</div>
                    <div className="text-lg lg:text-2xl font-bold">
                      Rp{selectedReport.total_amount.toLocaleString('id-ID')}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-gray-200">
                  <CardContent className="p-3 text-center">
                    <User className="h-5 w-5 text-[#011e4b] mx-auto mb-1" />
                    <div className="text-xs text-gray-600 mb-1">Pengaju</div>
                    <div className="font-semibold text-sm text-[#011e4b] truncate">
                      {selectedReport.user?.full_name || '-'}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-gray-200">
                  <CardContent className="p-3 text-center">
                    <Calendar className="h-5 w-5 text-[#011e4b] mx-auto mb-1" />
                    <div className="text-xs text-gray-600 mb-1">Tanggal</div>
                    <div className="font-semibold text-sm text-[#011e4b]">
                      {new Date(selectedReport.report_date).toLocaleDateString('id-ID')}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-gray-200 hidden lg:block"> 
                  <CardContent className="p-3 text-center">
                    <div className="mb-1">
                        {selectedReport.payment_status === 'paid' ? (
                            <CheckCircle className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                            <Clock className="h-5 w-5 text-amber-600 mx-auto" />
                        )}
                    </div>
                    <div className="text-xs text-gray-600 mb-1">Status Bayar</div>
                    <div className={`font-semibold text-sm ${
                        selectedReport.payment_status === 'paid' ? 'text-green-600' : 
                        selectedReport.payment_status === 'partial' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {selectedReport.payment_status.toUpperCase()}
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Items Detail */}
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-[#011e4b] flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Rincian Pengeluaran
                </h3>
                
                {/* Mobile View - Cards */}
                <div className="block md:hidden space-y-2">
                  {selectedReport.items.map((item, index) => (
                    <Card key={index} className="border-gray-200">
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs font-medium text-[#011e4b] uppercase">
                            {item.type}
                          </span>
                          <span className="text-base font-bold text-[#011e4b]">
                            Rp{item.amount.toLocaleString('id-ID')}
                          </span>
                        </div>
                        {item.description && (
                            <p className="text-gray-700 text-xs">{item.description}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
                
                {/* Desktop View - Table */}
                <div className="hidden md:block rounded-lg border border-gray-200 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-gray-50">
                      <TableRow className="text-sm">
                        <TableHead className="font-semibold text-[#011e4b] w-[120px]">Jenis</TableHead>
                        <TableHead className="font-semibold text-[#011e4b]">Deskripsi</TableHead>
                        <TableHead className="font-semibold text-[#011e4b] text-right w-[120px]">Nominal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-sm">
                      {selectedReport.items.map((item, index) => (
                        <TableRow key={index} className="hover:bg-gray-50">
                          <TableCell className="font-medium text-[#011e4b] uppercase">
                            {item.type}
                          </TableCell>
                          <TableCell className="text-gray-700">
                            {item.description || '-'}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-[#011e4b]">
                            Rp{item.amount.toLocaleString('id-ID')}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-[#011e4b] text-white font-semibold hover:bg-[#00376a] text-base">
                        <TableCell colSpan={2} className="text-right py-3">
                          Total Keseluruhan:
                        </TableCell>
                        <TableCell className="text-right py-3">
                          Rp{selectedReport.total_amount.toLocaleString('id-ID')}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
              
              {/* Payment History and Actions */}
              <div className="space-y-3">
                  <h3 className="text-base font-semibold text-[#011e4b] flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Riwayat Pembayaran & Status
                  </h3>
                  
                  <Card className="border-gray-200 p-3">
                      <div className="flex justify-between items-center text-sm font-semibold mb-2">
                          <span>Total Pengajuan:</span>
                          <span>{formatCurrency(selectedReport.total_amount)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm font-semibold text-green-600 mb-2">
                          <span>Sudah Dibayar:</span>
                          <span>{formatCurrency(selectedReport.total_paid)}</span>
                      </div>
                      <div className="flex justify-between items-center text-lg font-bold">
                          <span>Sisa Tagihan:</span>
                          <span className="text-red-600">{formatCurrency(selectedReport.remaining_due)}</span>
                      </div>
                      
                      <Separator className="my-3" />
                      
                      {selectedReport.payment_transactions.length > 0 && (
                          <div className="space-y-2">
                              <h4 className="text-sm font-medium text-gray-700">Transaksi Tercatat:</h4>
                              {selectedReport.payment_transactions.map((tx, index) => (
                                  <div key={tx.id} className="flex justify-between items-center text-xs border-b pb-1">
                                      <span className="text-gray-600">{new Date(tx.transaction_date).toLocaleDateString()}</span>
                                      <span className="font-semibold">{formatCurrency(tx.amount)}</span>
                                  </div>
                              ))}
                          </div>
                      )}
                      
                      {/* Admin Actions */}
                      {userProfile?.role === 'admin' && selectedReport.payment_status !== 'paid' && (
                          <div className="mt-4 flex flex-col sm:flex-row gap-3">
                              <Button 
                                  className="bg-green-600 hover:bg-green-700 text-white flex-1 h-9 text-sm"
                                  onClick={() => handleTransferClick(selectedReport)}
                              >
                                  <Send className="h-4 w-4 mr-2" />
                                  Transfer & WA
                              </Button>
                              <Button 
                                  variant="outline" 
                                  className="border-[#011e4b] text-[#011e4b] hover:bg-[#011e4b] hover:text-white flex-1 h-9 text-sm"
                                  onClick={() => handleOpenPaymentModal(selectedReport)} // Buka modal pembayaran baru
                              >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Catat Pembayaran
                              </Button>
                          </div>
                      )}
                  </Card>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Modal Catat Pembayaran Baru (Mark As Paid) */}
      {selectedReport && (
          <Dialog open={isRecordPaymentModalOpen} onOpenChange={setIsRecordPaymentModalOpen}>
              <DialogContent className="sm:max-w-[400px]">
                  <DialogHeader>
                      <DialogTitle className="text-lg">Catat Pembayaran Reimbursement</DialogTitle>
                      <DialogDescription className="text-sm">
                          Pembayaran untuk <strong>{selectedReport.user?.full_name || '-'}</strong>.
                      </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleRecordPayment} className="grid gap-3 py-4">
                      <div className="space-y-1">
                          <Label className="text-sm">Total Tagihan Pokok</Label>
                          <p className="text-lg font-bold text-red-600">
                              {formatCurrency(selectedReport.remaining_due)}
                          </p>
                      </div>
                      
                      <Separator className="my-2" />
                      
                      <div className="space-y-1">
                          <Label className="text-sm" htmlFor="amount">Jumlah Dibayarkan (Pokok)</Label>
                          <Input
                              id="amount"
                              type="number"
                              placeholder={`Max: ${selectedReport.remaining_due.toFixed(0)}`}
                              value={newPaymentAmount}
                              onChange={(e) => setNewPaymentAmount(e.target.value)}
                              className="text-sm h-9"
                              max={selectedReport.remaining_due}
                              required
                          />
                      </div>
                      
                      <div className="space-y-1">
                          <Label className="text-sm" htmlFor="admin-fee">Biaya Admin (Opsional)</Label>
                          <Input
                              id="admin-fee"
                              type="number"
                              placeholder="0"
                              value={adminFee}
                              onChange={(e) => setAdminFee(e.target.value)}
                              className="text-sm h-9"
                          />
                      </div>
                      
                      <div className="space-y-1">
                          <Label className="text-sm">Total Keluar (Pokok + Fee):</Label>
                          <p className="text-xl font-bold text-[#011e4b]">
                              {formatCurrency(parseFloat(newPaymentAmount) + parseFloat(adminFee))}
                          </p>
                      </div>

                      <div className="space-y-1">
                          <Label className="text-sm">Metode Pembayaran Perusahaan</Label>
                          <Select
                              value={newPaymentMethodId}
                              onValueChange={setNewPaymentMethodId}
                              required
                          >
                              <SelectTrigger className="h-9 text-sm">
                                  <SelectValue placeholder="Pilih metode pembayaran" />
                              </SelectTrigger>
                              <SelectContent>
                                  {paymentMethods.map(method => (
                                      <SelectItem key={method.id} value={method.id}>
                                          {method.method_name} {method.type === 'transfer' && `(${method.account_name})`}
                                      </SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                      </div>
                  </form>
                  <DialogFooter>
                      <Button 
                          type="submit"
                          onClick={handleRecordPayment}
                          disabled={!newPaymentMethodId || isSubmitting || parseFloat(newPaymentAmount) <= 0}
                          className="w-full h-9 text-sm"
                      >
                          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 'Catat Pembayaran'}
                      </Button>
                  </DialogFooter>
              </DialogContent>
          </Dialog>
      )}
      
      {/* Modal Edit Laporan Pengeluaran */}
      {selectedReport && (
          <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
              <DialogContent className="sm:max-w-xl max-h-[95vh] overflow-y-auto p-4 sm:p-6">
                  <DialogHeader className="border-b pb-3">
                      <DialogTitle className="text-lg">Edit Laporan Pengeluaran</DialogTitle>
                      <DialogDescription className="text-sm">
                          Perbarui item pengeluaran dan detail laporan.
                      </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleUpdateReport} className="space-y-4">
                      <div className="space-y-3">
                          <Label className="text-base font-semibold text-[#011e4b] flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              Daftar Pengeluaran
                          </Label>
                          <div className="space-y-3">
                              {expenseItems.map((item, index) => {
                                const requiresDescription = item.type === 'lainnya'; // FIX: Check if description is required
                                return (
                                  <Card key={index} className="border border-gray-200 bg-gray-50">
                                      <CardContent className="p-3">
                                          {/* FIX: Adjust grid layout based on whether description is shown */}
                                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                              {/* JENIS PENGELUARAN (1 Kolom) */}
                                              <div className="space-y-1">
                                                  <Label className="text-xs font-medium text-gray-700">Jenis</Label>
                                                  <Select
                                                      value={item.type}
                                                      onValueChange={(value) => handleItemChange(index, 'type', value)}
                                                  >
                                                      <SelectTrigger className="bg-white border-gray-300 focus:border-[#011e4b] h-9 text-sm">
                                                          <SelectValue placeholder="Pilih jenis" />
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                          {expenseTypes.map(type => (
                                                              <SelectItem key={type} value={type.toLowerCase()}>{type}</SelectItem>
                                                          ))}
                                                      </SelectContent>
                                                  </Select>
                                              </div>
                                              
                                              {/* DESKRIPSI KEPERLUAN (CONDITIONAL: 2 Kolom) */}
                                              {requiresDescription && (
                                                <div className="md:col-span-2 space-y-1">
                                                    <Label className="text-xs font-medium text-gray-700">Deskripsi</Label>
                                                    <Input
                                                        type="text"
                                                        placeholder="Deskripsi..."
                                                        value={item.description}
                                                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                                        className="bg-white border-gray-300 focus:border-[#011e4b] h-9 text-sm"
                                                        required={requiresDescription}
                                                        list={`description-history-edit-${index}`} // Datalist ID
                                                    />
                                                    <datalist id={`description-history-edit-${index}`}>
                                                        {expenseDescriptionsHistory.map(desc => (
                                                            <option key={desc} value={desc} />
                                                        ))}
                                                    </datalist>
                                                </div>
                                              )}
                                              
                                              {/* NOMINAL (Rp) (Sisanya) */}
                                              <div className={`space-y-1 ${!requiresDescription ? 'md:col-span-3' : ''}`}>
                                                  <Label className="text-xs font-medium text-gray-700">Nominal (Rp)</Label>
                                                  <div className="flex gap-2">
                                                      <Input
                                                          type="number"
                                                          placeholder="0"
                                                          value={item.amount}
                                                          onChange={(e) => handleItemChange(index, 'amount', e.target.value)}
                                                          className="bg-white border-gray-300 focus:border-[#011e4b] h-9 text-sm"
                                                          required
                                                      />
                                                      {expenseItems.length > 1 && (
                                                          <Button 
                                                              type="button" 
                                                              variant="destructive" 
                                                              size="icon" 
                                                              onClick={() => handleRemoveItem(index)}
                                                              className="shrink-0 h-9 w-9"
                                                          >
                                                              <Trash className="h-4 w-4" />
                                                          </Button>
                                                      )}
                                                  </div>
                                              </div>
                                          </div>
                                      </CardContent>
                                  </Card>
                                );
                              })}
                          </div>
                          <Button 
                              type="button" 
                              variant="outline" 
                              className="w-full border-[#011e4b] text-[#011e4b] hover:bg-[#011e4b] hover:text-white transition-colors h-9 text-sm" 
                              onClick={handleAddItem}
                          >
                              <Plus className="h-4 w-4 mr-2" /> Tambah Item
                          </Button>
                      </div>
                      <Card className="border-[#011e4b] bg-gradient-to-r from-[#011e4b] to-[#00376a] text-white">
                          <CardContent className="p-4">
                              <div className="flex justify-between items-center">
                                  <span className="text-base font-semibold">Total Pengeluaran:</span>
                                  <span className="text-xl font-bold">
                                      Rp{calculateTotal().toLocaleString('id-ID')}
                                  </span>
                              </div>
                          </CardContent>
                      </Card>
                      <Button 
                          type="submit" 
                          className="w-full bg-[#011e4b] text-white hover:bg-[#00376a] h-10 text-base font-semibold" 
                          disabled={isSubmitting}
                      >
                          {isSubmitting ? (
                              <>
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> 
                                  Memperbarui Laporan...
                              </>
                          ) : (
                              <>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Perbarui Laporan
                              </>
                          )}
                      </Button>
                  </form>
              </DialogContent>
          </Dialog>
      )}
    </div>
  );
};

export default ExpenseReportsPage;