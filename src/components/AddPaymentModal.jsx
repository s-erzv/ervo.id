import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import { Loader2, CreditCard, Banknote, Percent, DollarSign, Check, X } from 'lucide-react'; // Tambah X icon
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

const AddPaymentModal = ({ isOpen, onOpenChange, order, onPaymentAdded, onDiscountApplied }) => {
  const { session, user, companyId } = useAuth();

  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittingDiscount, setSubmittingDiscount] = useState(false);
  
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [paymentProofFile, setPaymentProofFile] = useState(null);
  
  // STATES UNTUK DISKON
  const [discountType, setDiscountType] = useState('amount'); // 'amount' or 'percent'
  const [discountValue, setDiscountValue] = useState('0');
  const [orderSubtotal, setOrderSubtotal] = useState(0); // Subtotal item sebelum diskon
  
  // Perlu menggunakan state lokal yang akan di-update dari fetch
  const [currentOrderGrandTotal, setCurrentOrderGrandTotal] = useState(order?.grand_total || 0);
  const [currentOrderPayments, setCurrentOrderPayments] = useState(order?.payments || []);
  const [currentOrderTransportCost, setCurrentOrderTransportCost] = useState(order?.transport_cost || 0);
  const [currentInvoice, setCurrentInvoice] = useState(null); // Data invoice terkini

  const calculatePaymentsTotal = (payments) => {
    return payments?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 0;
  };
  
  // USE MEMO menggunakan state lokal
  const totalPaid = useMemo(() => calculatePaymentsTotal(currentOrderPayments), [currentOrderPayments]);
  const grandTotal = currentOrderGrandTotal; 
  const remainingDue = Math.max(0, grandTotal - totalPaid);
  
  const selectedMethod = useMemo(() => {
    return paymentMethods.find(m => String(m.id) === String(paymentMethodId));
  }, [paymentMethods, paymentMethodId]);
  
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };
  
  const handleInputWheel = (e) => {
    e.target.blur();
  };
  
  // --- FETCHING DATA AWAL (METODE PEMBAYARAN, SUBTOTAL, INVOICE) ---
  const fetchOrderDetails = useCallback(async () => {
    if (!order?.id) return;

    // --- TAMBAHAN LOGIC: Jika ini virtual order untuk Payout, jangan fetch ke tabel orders ---
    if (String(order.id).startsWith('PAYOUT-') || order.isVirtual) {
        setOrderSubtotal(order.grand_total || 0);
        setCurrentOrderGrandTotal(order.grand_total || 0);
        setCurrentOrderPayments([]);
        setCurrentOrderTransportCost(0);
        setLoading(false); // Langsung set loading false
        return;
    }
    
    // PERBAIKAN: Fetch data yang dibutuhkan untuk memastikan state internal up to date
    const { data, error } = await supabase
        .from('orders')
        .select(`
            id, grand_total, transport_cost, payments(*),
            order_items(qty, price, product_id, purchase_price),
            invoices(*) 
        `)
        .eq('id', order.id)
        .single();
    
    if (error) {
        console.error('Error fetching order details for discount:', error);
        toast.error('Gagal memuat detail transaksi.');
        return;
    }
    
    // 1. Hitung Subtotal Item Murni (Harga Jual * Qty)
    const itemsTotal = data.order_items.reduce((sum, item) => sum + (Number(item.qty) * Number(item.price)), 0);
    setOrderSubtotal(itemsTotal);
    
    // 2. Ambil Data Invoice
    const invoiceArray = Array.isArray(data.invoices) ? data.invoices : [data.invoices].filter(Boolean);
    const invoiceData = invoiceArray[0] || null;

    // 3. Update state lokal untuk GrandTotal, Payments, TransportCost
    setCurrentOrderGrandTotal(Number(data.grand_total) || 0);
    setCurrentOrderPayments(data.payments || []);
    setCurrentOrderTransportCost(Number(data.transport_cost) || 0);
    
    if (invoiceData) {
        setCurrentInvoice(invoiceData);
        const existingDiscount = Number(invoiceData.total_discount) || 0;
        
        // 4. Set nilai diskon awal (default ke nominal)
        setDiscountType('amount');
        setDiscountValue(existingDiscount.toString());
    }
  }, [order?.id]);

  useEffect(() => {
    if (isOpen && companyId) {
      setLoading(true);
      fetchPaymentMethods().then(() => {
        fetchOrderDetails().then(() => {
            setLoading(false);
        });
      });
    }
    
    // Saat modal dibuka, pastikan state lokal GrandTotal diinisiasi dari prop (sebelum fetch)
    if (isOpen) {
        setCurrentOrderGrandTotal(order?.grand_total || 0);
        setCurrentOrderPayments(order?.payments || []);
        setCurrentOrderTransportCost(order?.transport_cost || 0);
    }
  }, [isOpen, companyId, fetchOrderDetails, order]);

  useEffect(() => {
    if (isOpen && remainingDue > 0) {
      setPaymentAmount(remainingDue.toString());
    } else {
      setPaymentAmount('0');
    }
  }, [isOpen, remainingDue]);

  const fetchPaymentMethods = async () => {
    let pmQuery = supabase.from('payment_methods').select('*').eq('is_active', true);
    if (companyId) pmQuery = pmQuery.eq('company_id', companyId);
    
    const { data: methodsData, error: methodsError } = await pmQuery;
    if (methodsError) {
      console.error('Error fetching payment methods:', methodsError);
      toast.error('Gagal memuat metode pembayaran.');
    } else {
      setPaymentMethods(methodsData || []);
      // Jika paymentMethodId belum ada, set default
      if (!paymentMethodId && methodsData?.length > 0) {
          setPaymentMethodId(methodsData[0].id);
      }
    }
  };
  
  // --- LOGIC PERHITUNGAN DISKON ---
  const calculateDiscountDetails = useMemo(() => {
      const baseAmount = orderSubtotal;
      const value = parseFloat(discountValue) || 0;

      let discountAmount = 0;
      if (discountType === 'percent') {
          if (value > 100) return { discountAmount: 0, newGrandTotal: grandTotal };
          discountAmount = (baseAmount * value) / 100;
      } else { // 'amount'
          if (value > baseAmount) discountAmount = baseAmount; 
          else discountAmount = value;
      }
      
      const currentTransportCost = currentOrderTransportCost;
      const newGrandTotal = baseAmount - discountAmount + currentTransportCost;
      
      return {
          baseAmount,
          discountAmount,
          newGrandTotal,
          currentGrandTotal: grandTotal,
      };
  }, [orderSubtotal, discountType, discountValue, grandTotal, currentOrderTransportCost]);

  const { baseAmount, discountAmount, newGrandTotal } = calculateDiscountDetails;
  
  // --- HANDLER APPLY DISKON ---
  const handleApplyDiscount = async () => {
    if (submittingDiscount) return;
    setSubmittingDiscount(true);
    
    // Cek apakah diskon benar-benar berubah
    const existingDiscount = Number(currentInvoice?.total_discount) || 0;
    if (Math.abs(discountAmount - existingDiscount) < 0.01) { // Toleransi float
        toast('Diskon tidak berubah.', { icon: 'ℹ️' });
        setSubmittingDiscount(false);
        return;
    }

    try {
        const totalPaidSnapshot = totalPaid;

        // 1. Update orders table (main total)
        const { error: orderError } = await supabase
            .from('orders')
            .update({ grand_total: newGrandTotal })
            .eq('id', order.id);
        if (orderError) throw orderError;
        
        // 2. Update invoices table (full financial detail)
        const { error: invoiceError } = await supabase
            .from('invoices')
            .update({ 
                subtotal: baseAmount,
                total_discount: discountAmount,
                grand_total: newGrandTotal,
                balance_due: newGrandTotal - totalPaidSnapshot, 
            })
            .eq('order_id', order.id);
        if (invoiceError) throw invoiceError;

        toast.success(`Diskon ${formatCurrency(discountAmount)} berhasil diterapkan! Total baru: ${formatCurrency(newGrandTotal)}`);
        
        // Sinyal ke OrderDetailsPage untuk update GrandTotal dan Invoice data
        if (onDiscountApplied) {
            onDiscountApplied(newGrandTotal, discountAmount);
        }
        
        // PERBAIKAN KRITIS: Fetch order details lagi untuk update state internal modal
        await fetchOrderDetails(); 
        
    } catch (error) {
        console.error('Error applying discount:', error);
        toast.error('Gagal menerapkan diskon.');
    } finally {
        setSubmittingDiscount(false);
    }
  };

  // NEW HANDLER: Hapus diskon
  const handleRemoveDiscount = async () => {
      // Set nilai diskon ke 0 dan tipe ke nominal
      setDiscountType('amount');
      setDiscountValue('0');
      // Panggil handler apply discount (yang akan menggunakan diskon 0)
      await handleApplyDiscount();
  };

  // --- HANDLER TAMBAH PEMBAYARAN ---
  const handleAddPayment = async () => {
    const amount = parseFloat(paymentAmount) || 0;

    if (amount <= 0 || !paymentMethodId) {
      toast.error('Jumlah dan metode pembayaran harus diisi.');
      return;
    }
    if (amount > remainingDue + 1) {
      toast.error('Jumlah pembayaran tidak bisa melebihi sisa tagihan.');
      return;
    }
    if (selectedMethod?.type === 'transfer' && !paymentProofFile) {
        toast.error('Mohon unggah bukti transfer.');
        return;
    }
    setSubmitting(true);
    
    let proofFilePath = null; 

    try {
        // 1. Upload Bukti Transfer (Tetap jalan untuk dokumentasi)
        if (selectedMethod?.type === 'transfer' && paymentProofFile) {
            const fileExt = paymentProofFile.name.split('.').pop();
            const filePath = `${order.company_id}/payments/${order.id}/${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('proofs')
                .upload(filePath, paymentProofFile);

            if (uploadError) throw uploadError;
            proofFilePath = filePath;
        }

      // --- LOGIC PERCABANGAN KRITIS ---
      
      if (order.isVirtual) {
        /**
         * KASUS A: PENCAIRAN DANA DROPSHIPPER
         * Kita TIDAK insert ke tabel 'payments' karena akan kena Foreign Key Error.
         * Kita langsung panggil callback sukses agar FinancialReportPage mencatat transaksi keuangannya.
         */
        
        // Kirim data pembayaran yang dipilih kembali ke parent (FinancialReportPage)
        // agar parent bisa mencatat financial_transaction dengan method_id yang benar.
        onPaymentAdded({
          amount: amount,
          paymentMethodId: paymentMethodId,
          proofUrl: proofFilePath
        });
        
      } else {
        /**
         * KASUS B: PEMBAYARAN PESANAN NORMAL
         * Tetap insert ke tabel 'payments' seperti biasa.
         */
        const { error: insertError } = await supabase
          .from('payments')
          .insert({
            order_id: order.id,
            amount: amount,
            payment_method_id: paymentMethodId,
            paid_at: new Date().toISOString(),
            company_id: order.company_id,
            received_by: user?.id,
            received_by_name: user?.full_name,
            proof_url: proofFilePath, 
          });

        if (insertError) throw insertError;
        
        const newTotalPaid = totalPaid + amount;
        const isNowPaid = newTotalPaid >= (grandTotal - 100);
        const newPaymentStatus = isNowPaid ? 'paid' : 'partial';

        // Update status di tabel orders
        const { error: updateError } = await supabase
          .from('orders')
          .update({ payment_status: newPaymentStatus })
          .eq('id', order.id);
        
        if (updateError) throw updateError;
        
        if (isNowPaid) {
          toast.success('Pembayaran Lunas!');
        } else {
          toast.success('Pembayaran partial berhasil dicatat.');
        }

        onPaymentAdded();
      }
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding payment:', error);
      toast.error('Gagal memproses pembayaran: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const paymentMethodsCash = paymentMethods.filter(m => m.type === 'cash');
  const paymentMethodsTransfer = paymentMethods.filter(m => m.type === 'transfer');

  const finalGrossProfit = (orderSubtotal - discountAmount) - (order?.order_items || []).reduce((sum, item) => 
      sum + (Number(item.qty) * (Number(item.purchase_price) || 0)), 0);
      
  const grossMargin = (finalGrossProfit / (baseAmount || 1)) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto"> 
        <DialogHeader>
          <DialogTitle>Tambah Pembayaran</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-4 py-4"> 
            
            {/* --- DISPLAY KEUANGAN ORDER --- */}
            <div className='grid grid-cols-2 gap-x-4 gap-y-2'>
                <div className='space-y-1'>
                    <Label className='text-xs text-muted-foreground'>Subtotal (Item)</Label>
                    <p className='font-medium text-sm'>{formatCurrency(orderSubtotal)}</p>
                </div>
                <div className='space-y-1'>
                    <Label className='text-xs text-muted-foreground'>Biaya Kirim</Label>
                    <p className='font-medium text-sm'>{formatCurrency(currentOrderTransportCost)}</p>
                </div>
                <div className='space-y-1'>
                    <Label className='text-xs text-muted-foreground'>Diskon Aktif</Label>
                    <p className='font-medium text-sm text-red-500'>- {formatCurrency(Number(currentInvoice?.total_discount) || 0)}</p>
                </div>
                <div className='space-y-1'>
                    <Label className='text-xs text-muted-foreground'>Grand Total Saat Ini</Label>
                    <p className='text-lg font-bold text-green-600'>{formatCurrency(grandTotal)}</p>
                </div>
            </div>
            
            <Separator />
            
            {/* --- INPUT DISKON --- */}
            <div className="space-y-3 p-3 border rounded-lg bg-gray-50">
                <Label className='text-sm font-semibold flex items-center'>Terapkan Diskon</Label>
                <div className="flex gap-2">
                    <Select value={discountType} onValueChange={setDiscountType}>
                        <SelectTrigger className="w-[100px] text-sm flex-shrink-0">
                            <SelectValue placeholder="Jenis" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="amount"> Nominal</SelectItem>
                            <SelectItem value="percent">Persentase</SelectItem>
                        </SelectContent>
                    </Select>
                    <Input
                        type="number"
                        placeholder={discountType === 'percent' ? "Nilai (%)" : "Jumlah Diskon (Rp)"}
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        onWheel={handleInputWheel}
                        className='text-sm'
                        min="0"
                        max={discountType === 'percent' ? "100" : orderSubtotal.toString()}
                    />
                </div>
                
                <div className='flex justify-between items-center text-sm pt-1'>
                    <p className='text-muted-foreground'>Diskon Baru:</p>
                    <p className={`font-semibold ${discountAmount > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                        - {formatCurrency(discountAmount)}
                    </p>
                </div>
                <div className='flex justify-between items-center text-base font-bold'>
                    <p>Grand Total Baru:</p>
                    <p className='text-blue-600'>{formatCurrency(newGrandTotal)}</p>
                </div>

                <Button 
                    type='button'
                    onClick={handleApplyDiscount}
                    className='w-full text-sm mt-2'
                    variant="secondary"
                    disabled={submittingDiscount}
                >
                    {submittingDiscount ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                    Terapkan Diskon ke Pesanan
                </Button>
                
                {/* NEW BUTTON: Hapus Diskon */}
                {(Number(currentInvoice?.total_discount) || 0) > 0 && (
                    <Button 
                        type='button'
                        onClick={handleRemoveDiscount}
                        className='w-full text-sm mt-1'
                        variant="destructive"
                        size="sm"
                        disabled={submittingDiscount}
                    >
                        <X className="h-4 w-4 mr-2" /> Hapus Diskon Aktif
                    </Button>
                )}
            </div>
            
            <Separator />
            
            {/* --- INPUT PEMBAYARAN --- */}
            <div className="space-y-2">
              <Label>Sisa Tagihan</Label>
              <p className="text-xl font-bold text-red-500">{formatCurrency(remainingDue)}</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="paymentAmount">Nominal</Label>
              <Input
                id="paymentAmount"
                type="number"
                placeholder="Jumlah pembayaran"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                onWheel={handleInputWheel}
                readOnly={remainingDue <= 0}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Metode Pembayaran</Label>
              <Select value={paymentMethodId} onValueChange={setPaymentMethodId} disabled={remainingDue <= 0}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih metode pembayaran" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethodsCash.length > 0 && (
                    <>
                      <div className="px-2 py-1 text-xs text-gray-500">Tunai</div>
                      {paymentMethodsCash.map((method) => (
                        <SelectItem key={method.id} value={String(method.id)}>
                          <div className="flex items-center gap-2">
                            <Banknote className="h-4 w-4" />
                            <span>{method.method_name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {paymentMethodsTransfer.length > 0 && (
                    <>
                      <Separator className="my-1" />
                      <div className="px-2 py-1 text-xs text-gray-500">Transfer</div>
                      {paymentMethodsTransfer.map((method) => (
                        <SelectItem key={method.id} value={String(method.id)}>
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            <span>{method.method_name} ({method.account_name})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            {selectedMethod?.type === 'transfer' && (
                <div className="space-y-2">
                    <Label htmlFor="paymentProof">Unggah Bukti Transfer</Label>
                    <Input
                        id="paymentProof"
                        type="file"
                        onChange={(e) => setPaymentProofFile(e.target.files[0])}
                        accept="image/*"
                        required
                    />
                </div>
            )}
            
          </div>
        )}
        <DialogFooter className='pt-4'>
            <Button type="button" onClick={handleAddPayment} disabled={submitting || remainingDue <= 0 || submittingDiscount}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tambahkan Pembayaran'}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddPaymentModal;