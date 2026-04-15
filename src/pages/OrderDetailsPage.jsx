// src/pages/OrderDetailsPage.jsx
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ArrowLeft, Trash2, CreditCard, Banknote, RefreshCcw, CheckCircle2, AlertCircle, ListOrdered, ReceiptText, Clock, TruckIcon, MessageSquareText, Pencil, X, Navigation, MapPin, Settings, DollarSign, ImageIcon } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import AddPaymentModal from '@/components/AddPaymentModal';
import CryptoJS from 'crypto-js';

// --- IMPORT MODAL BARU ---
import WhatsappTemplateSettingsModal from '@/components/WhatsappTemplateSettingsModal';

const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'fallback-key-proyek-rahasia';

const getDeliveryStatusBadge = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'draft':
      return <Badge className="bg-gray-200 text-[#011e4b] gap-1"><Clock className="h-3 w-3" /> Menunggu</Badge>;
    case 'sent':
      return <Badge className="bg-[#011e4b] text-white gap-1"><TruckIcon className="h-3 w-3" /> Dikirim</Badge>;
    case 'delivered':
    case 'completed':
      return <Badge className="bg-green-500 text-white gap-1"><CheckCircle2 className="h-3 w-3" /> Selesai</Badge>;
    default:
      return <Badge className="bg-gray-200 text-[#011e4b] capitalize">{status || 'unknown'}</Badge>;
  }
};

const getPaymentStatusBadge = (status) => {
  const badgeClass = "flex items-center gap-1 px-2 py-1 text-[12px] whitespace-nowrap font-semibold";
  
  switch ((status || '').toLowerCase()) {
    case 'paid':
      return <Badge className={`bg-green-500 text-white ${badgeClass}`}><CheckCircle2 className="h-3.5 w-3.5" /> Lunas</Badge>;
    case 'unpaid':
    case 'pending':
      return <Badge className={`bg-red-500 text-white ${badgeClass}`}><AlertCircle className="h-3.5 w-3.5" /> Pending</Badge>;
    case 'partial':
      return <Badge className={`bg-yellow-400 text-black ${badgeClass}`}><AlertCircle className="h-3.5 w-3.5" /> Sebagian</Badge>;
    default:
      return <Badge className={`bg-gray-200 text-[#011e4b] capitalize ${badgeClass}`}>{status || 'unknown'}</Badge>;
  }
};

const getActionLabel = (action) => {
    switch (action) {
        case 'CREATE': return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-[9px] px-1.5 h-4">Dibuat</Badge>;
        case 'UPDATE': return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[9px] px-1.5 h-4">Edit Order</Badge>;
        case 'UPDATE_PAYMENT': return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[9px] px-1.5 h-4">Edit Bayar</Badge>;
        case 'DELETE': return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-[9px] px-1.5 h-4">Dihapus</Badge>;
        default: return <Badge className="text-[9px] px-1.5 h-4">{action}</Badge>;
    }
};

const renderLogDetails = (log, formatCurrency) => {
  if (log.action === 'CREATE') return <p className="text-[10px] text-blue-600 font-medium">Pesanan dibuat pertama kali.</p>;
  if (log.action === 'DELETE') return <p className="text-[10px] text-red-600 font-medium">Pesanan dihapus dari sistem.</p>;

  // --- LOGIC BARU: DETEKSI EDIT PEMBAYARAN ---
  if (log.action === 'UPDATE_PAYMENT') {
    return (
      <div className="mt-1.5 p-2 bg-emerald-50 rounded-lg border border-dashed border-emerald-200 text-[10px]">
        <p className="font-bold text-emerald-700 mb-1 flex items-center gap-1">
          <DollarSign className="h-3 w-3" /> Nominal Pembayaran Diubah:
        </p>
        <div className="flex items-center gap-1">
          <span className="line-through text-red-400">{formatCurrency(log.old_data?.amount)}</span>
          <span className="text-slate-400">→</span>
          <span className="text-emerald-600 font-bold">{formatCurrency(log.new_data?.amount)}</span>
        </div>
      </div>
    );
  }

  const changes = [];
  const oldD = log.old_data || {};
  const newD = log.new_data || {};

  // 1. Cek Grand Total
  if (oldD.grand_total !== newD.grand_total) {
    changes.push(
      <div key="gt" className="flex items-center gap-1">
        <span className="text-slate-400">Total Tagihan:</span>
        <span className="line-through text-red-400">{formatCurrency(oldD.grand_total)}</span>
        <span>→</span>
        <span className="text-green-600 font-bold">{formatCurrency(newD.grand_total)}</span>
      </div>
    );
  }

  // 2. Cek Status Pengiriman
  if (oldD.status !== newD.status) {
    changes.push(
      <div key="st" className="flex items-center gap-1">
        <span className="text-slate-400">Status:</span>
        <Badge variant="outline" className="text-[9px] h-4 uppercase">{oldD.status}</Badge>
        <span>→</span>
        <Badge variant="outline" className="text-[9px] h-4 bg-blue-50 uppercase font-bold">{newD.status}</Badge>
      </div>
    );
  }

  // 3. Cek Catatan
  if (oldD.notes !== newD.notes) {
    changes.push(<div key="nt" className="text-slate-500 italic">"Catatan/Notes diperbarui"</div>);
  }

  return changes.length > 0 ? (
    <div className="mt-1.5 p-2 bg-slate-50 rounded-lg border border-dashed space-y-1 text-[10px]">
      {changes}
    </div>
  ) : <p className="text-[10px] text-slate-400 italic">Perubahan sistem internal.</p>;
};

const OrderDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, session, companyName, companyId, userProfile } = useAuth();

  const userId = user?.id ?? null;

  // --- states ---
  const [order, setOrder] = useState(null);
  const [payments, setPayments] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [opLoading, setOpLoading] = useState(false);
  const [error, setError] = useState(null);

  // States untuk edit pembayaran
  const [isEditing, setIsEditing] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editMethodId, setEditMethodId] = useState('');
  
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  
  const [invoiceData, setInvoiceData] = useState(null);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState(null);

  const [processingWA, setProcessingWA] = useState(false); 
  const [processingNearby, setProcessingNearby] = useState({}); 
  const [orderLogs, setOrderLogs] = useState([]); // State baru

// Di dalam fungsi fetchData (di dalam blok try, setelah setInvoiceData)
  

  // --- STATE BARU: REKOMENDASI TETANGGA & TEMPLATE WA ---
  const [nearbyCustomers, setNearbyCustomers] = useState([]);
  const [scanRadius, setScanRadius] = useState(1.5); 
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [activeTemplates, setActiveTemplates] = useState({});

  const mountedRef = useRef(true);
  const abortControllerRef = useRef(null);
  
  const calculatePaymentsTotal = useCallback((rows) => {
    if (!Array.isArray(rows)) return 0;
    return rows.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, []);
  
  const calculateTotal = (items) => {
    return items?.reduce((total, item) => total + (item.qty * item.price), 0) || 0;
  };
  
  const totalPaid = useMemo(() => calculatePaymentsTotal(payments), [payments, calculatePaymentsTotal]);

  
  const currentDiscount = useMemo(() => {
      return Number(invoiceData?.total_discount) || 0;
  }, [invoiceData]);

  const calculatedGrandTotal = useMemo(() => {
    if (!order) return 0;
    if (Number(order.grand_total) > 0) return Number(order.grand_total);
    const itemsTotal = calculateTotal(order.order_items);
    const transportCost = Number(order.transport_cost) || 0;
    const discount = currentDiscount; 
    const totalPurchaseCost = order.order_galon_items?.reduce((sum, item) => 
      sum + (Number(item.purchased_empty_qty) * Number(item.products?.empty_bottle_price || 0)), 0) || 0;
    return Math.max(0, itemsTotal - discount) + transportCost + totalPurchaseCost;
  }, [order, currentDiscount]);

  const remainingDue = Math.max(0, calculatedGrandTotal - totalPaid);
  const isPaid = remainingDue <= 0.0001; 

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const fetchActiveTemplates = async () => {
    const { data } = await supabase.from('whatsapp_templates').select('template_name, template_text').eq('company_id', companyId);
    if (data) {
      const map = {};
      data.forEach(t => { map[t.template_name] = t.template_text; });
      setActiveTemplates(map);
    }
  };

  // --- FUNGSI HELPER UNTUK KIRIM VIA FONNTE ---
  const sendViaFonnte = async (targetPhone, message) => {
    try {
      // AMBIL DATA TERBARU LANGSUNG DARI DB UNTUK MEMASTIKAN TOKEN TERSEDIA
      const { data: companyData, error: coErr } = await supabase
        .from('companies')
        .select('fonnte_token')
        .eq('id', companyId)
        .single();

      if (coErr || !companyData?.fonnte_token) {
        console.log("Token Fonnte tidak ditemukan di database.");
        return false;
      }

      const encryptedToken = companyData.fonnte_token;

      // 2. Dekripsi Token
      let finalToken = null;
      try {
        const bytes = CryptoJS.AES.decrypt(encryptedToken, ENCRYPTION_KEY);
        const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
        finalToken = decryptedText || encryptedToken; // Fallback jika tidak terenkripsi
      } catch (e) {
        console.error("Gagal dekripsi token:", e);
        finalToken = encryptedToken;
      }

      if (!finalToken || finalToken.trim() === "") return false;

      // 3. Tembak API Fonnte
      const response = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { 'Authorization': finalToken },
        body: new URLSearchParams({
          'target': targetPhone.replace(/[^\d]/g, ''),
          'message': message,
          'countryCode': '62'
        })
      });

      const result = await response.json();
      return result.status === true;
    } catch (err) {
      console.error("Fonnte API Error:", err);
      return false;
    }
  };

  

    // --- 1. HANDLE CONFIRM ORDER ---
    const handleConfirmOrder = async () => {
      if (!order || !order.order_items || !order.customers) {
        toast.error('Data belum lengkap.');
        return;
      }
      if (processingWA) return;

      setProcessingWA(true);
      const tid = toast.loading('Mengirim konfirmasi...');

      try {
        // --- 1. Persiapkan Rincian Produk Lengkap dengan Harga ---
        const productsListWithPrice = order.order_items
          .map(item => `* ${item.products.name} (${item.qty} pcs) x ${formatCurrency(item.price)}`)
          .join('\n');
        
        const totalHarga = formatCurrency(calculatedGrandTotal);
        const template = activeTemplates['order_confirmation'] || "";

        if (!template) throw new Error("Template konfirmasi belum diatur.");

        // --- 2. Mapping Variabel ---
        const finalMessage = template
            .replace(/{{customerName}}/g, order.customers.name || 'Bapak/Ibu')
            .replace(/{{orderDate}}/g, order.planned_date ? new Date(order.planned_date).toLocaleDateString('id-ID') : '-')
            .replace(/{{productsListWithPrice}}/g, productsListWithPrice)
            .replace(/{{productsList}}/g, productsListWithPrice) // Fallback jika user pakai var lama
            .replace(/{{totalHarga}}/g, totalHarga)
            .replace(/{{companyName}}/g, companyName);

        const phone = order.customers.phone;
        const isAutoSent = await sendViaFonnte(phone, finalMessage);

        if (isAutoSent) {
          toast.success('Konfirmasi Terkirim Otomatis!', { id: tid });
        } else {
          toast.dismiss(tid);
          window.open(`https://api.whatsapp.com/send?phone=${phone.replace(/[^\d]/g, '')}&text=${encodeURIComponent(finalMessage)}`, '_blank');
        }
      } catch (err) {
        toast.error('Gagal: ' + err.message, { id: tid });
      } finally {
        setTimeout(() => setProcessingWA(false), 3000);
      }
  };

    // --- 2. HANDLE SHARE INVOICE ---
    // --- 2. HANDLE SHARE INVOICE ---
  const handleShareInvoice = async () => {
      if (!order || !session || !invoiceData?.public_link) {
        toast.error('Cetak invoice dahulu.');
        return;
      }
      if (processingWA) return;

      setProcessingWA(true);
      const tid = toast.loading('Mengirim invoice...');

      try {
        // --- 1. Persiapkan Metode Pembayaran ---
        let paymentMethodDisplay = 'Transfer Bank / Tunai';
        const transferMethod = paymentMethods?.find(m => m.type === 'transfer' && m.is_active) || paymentMethods?.[0];
        
        if (transferMethod) {
            paymentMethodDisplay = `${transferMethod.method_name} ${transferMethod.account_number} a.n ${transferMethod.account_name || ''}`;
        }

        const productsListSimple = (order.order_items || [])
          .map(item => `* ${item.products.name} (${item.qty} pcs)`)
          .join('\n');
        
        // Ambil template dari state activeTemplates
        const template = activeTemplates['payment_reminder'] || "";
        if (!template) throw new Error("Template tagihan belum diatur.");

        // --- 2. Mapping Variabel (DISESUAIKAN DENGAN MODAL) ---
        const finalMessage = template
          .replace(/{{customerName}}/g, order.customers?.name || 'Bapak/Ibu')
          .replace(/{{orderDate}}/g, order.planned_date ? new Date(order.planned_date).toLocaleDateString('id-ID') : '-')
          .replace(/{{invoiceNo}}/g, order.invoice_number || order.id.slice(0,8)) // Ubah Num jadi No
          .replace(/{{totalHarga}}/g, formatCurrency(calculatedGrandTotal))
          .replace(/{{sisaTagihan}}/g, formatCurrency(remainingDue))
          .replace(/{{productsListWithPrice}}/g, productsListSimple) // Sesuaikan var di modal
          .replace(/{{invoiceLink}}/g, invoiceData.public_link)
          .replace(/{{paymentMethod}}/g, paymentMethodDisplay)
          .replace(/{{companyName}}/g, companyName || 'Toko Kami');

        // Bersihkan nomor telepon (hanya angka)
        const phone = (order.customers.phone || '').replace(/[^\d]/g, '');
        if (!phone) throw new Error("Nomor telepon pelanggan tidak valid.");

        const isAutoSent = await sendViaFonnte(phone, finalMessage);

        if (isAutoSent) {
          toast.success('Invoice Terkirim Otomatis!', { id: tid });
        } else {
          toast.dismiss(tid);
          // Fallback ke WA Web jika Fonnte gagal/tidak ada token
          window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(finalMessage)}`, '_blank');
          toast.success('Membuka WhatsApp...', { duration: 3000 });
        }
      } catch (err) {
        toast.error('Gagal: ' + err.message, { id: tid });
      } finally {
        setTimeout(() => setProcessingWA(false), 2000);
      }
  };

    // --- 3. HANDLE CONTACT NEIGHBOR (NEARBY) ---
    const handleContactNeighbor = async (neighbor) => {
      const neighborId = neighbor.id;
      if (processingNearby[neighborId]) return;

      setProcessingNearby(prev => ({ ...prev, [neighborId]: true }));
      const tid = toast.loading(`Menghubungi ${neighbor.name}...`);

      try {
          const template = activeTemplates['nearby_info'] || "";
          if (!template) throw new Error("Template 'Tetangga' belum diatur.");

          const finalMessage = template
              .replace(/{{customerName}}/g, neighbor.name)
              .replace(/{{companyName}}/g, companyName);

          const phone = neighbor.phone;
          const isAutoSent = await sendViaFonnte(phone, finalMessage);

          if (isAutoSent) {
              toast.success(`Pesan ke ${neighbor.name} Terkirim!`, { id: tid });
          } else {
              toast.dismiss(tid);
              window.open(`https://api.whatsapp.com/send?phone=${phone.replace(/[^\d]/g, '')}&text=${encodeURIComponent(finalMessage)}`, '_blank');
          }
      } catch (err) {
          toast.error('Gagal: ' + err.message, { id: tid });
      } finally {
          setTimeout(() => {
              setProcessingNearby(prev => ({ ...prev, [neighborId]: false }));
          }, 3000);
      }
  };  

  const handleViewRoute = () => {
    if (!order || !order.customers) {
      toast.error("Data pelanggan tidak tersedia.");
      return;
    }
    const { latitude, longitude, address } = order.customers;
    let url = '';
    if (latitude && longitude) {
      url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    } else if (address) {
      url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
    } else {
      toast.error("Pelanggan tidak memiliki alamat atau titik koordinat.");
      return;
    }
    window.open(url, '_blank');
  };

  const fetchNearbyRecommendations = async (lat, lng) => {
    if (!lat || !lng || !companyId) return;
    setLoadingNearby(true);
    try {
        const { data, error } = await supabase.rpc('get_nearby_customers', {
            p_lat: lat,
            p_lng: lng,
            p_radius_km: parseFloat(scanRadius),
            p_company_id: companyId,
            p_exclude_id: order?.customer_id
        });
        
        if (error) throw error;

        // TAMBAHKAN FILTER INI:
        // Agar dropshipper tidak melihat tetangga milik Dropshipper lain
        let filteredData = data || [];
        if (userProfile?.role === 'dropship') {
            // Asumsi RPC mengembalikan kolom dropshipper_id
            filteredData = filteredData.filter(nc => nc.dropshipper_id === userProfile.id);
        }

        setNearbyCustomers(filteredData);
    } catch (err) {
        console.error("Error fetching nearby:", err);
    } finally {
        setLoadingNearby(false);
    }
  };

  useEffect(() => {
    if (order?.customers?.latitude && order?.customers?.longitude && companyId) {
        fetchNearbyRecommendations(order.customers.latitude, order.customers.longitude);
    }
  }, [order, scanRadius, companyId]); 


  const isAbortErr = (e) => !!e && (
    e.name === 'AbortError' ||
    e.code === '20' ||
    /AbortError/i.test(e.message || '')
  );

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount ?? 0);
  };
  
  const fetchData = useCallback(async (showLoading = true) => {
    if (!id || !isAuthenticated) {
      if (mountedRef.current) setLoading(false);
      return;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    if (showLoading && mountedRef.current) setLoading(true);
    if (mountedRef.current) setError(null);

    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          customers (name, phone, address, latitude, longitude),
          order_couriers (courier:profiles!order_couriers_courier_id_fkey(id, full_name)),
          order_items (
            id, qty, price, item_type, product_id, purchase_price, 
            products(name, is_returnable, empty_bottle_price, image_url) 
          ),
          order_galon_items (*, products(id, name, empty_bottle_price, image_url)),
          invoices(*)
        `)
        .eq('id', id)
        .abortSignal(abortControllerRef.current.signal)
        .single();
      
      if (orderError) throw orderError;
      
      let proofPublicUrl;
      if (orderData.proof_of_delivery_url) {
        const { data: p } = supabase.storage.from('proofs').getPublicUrl(orderData.proof_of_delivery_url);
        proofPublicUrl = p?.publicUrl;
      }

      const invoiceArray = Array.isArray(orderData.invoices) ? orderData.invoices : [orderData.invoices].filter(Boolean);
      const invoice = invoiceArray[0] || null;
      
      // Di dalam fetchData, cari bagian Promise.all untuk payments
const [paymentsRes, methodsRes] = await Promise.all([
    supabase.from('payments')
      // PERBAIKAN: Gunakan 'received_by_id' secara eksplisit dan join profil tanpa !inner
      .select(`
        *, 
        received_by_name, 
        received_by:received_by(full_name), 
        payment_method:payment_methods(id, method_name, type, account_name, account_number)
      `)
      .eq('order_id', orderData.id) 
      .order('created_at', { ascending: false })
      .abortSignal(abortControllerRef.current.signal),
      
    supabase.from('payment_methods')
      .select('*')
      .eq('company_id', orderData.company_id) 
      .abortSignal(abortControllerRef.current.signal),
]);

      let paymentsWithUrls = paymentsRes.data || [];
      if (paymentsWithUrls.length > 0) {
        paymentsWithUrls = await Promise.all(
          paymentsWithUrls.map(async (p) => {
            if (!p.proof_url) return p;
            const { data: pub } = await supabase.storage.from('proofs').getPublicUrl(p.proof_url);
            return { ...p, proof_public_url: pub?.publicUrl };
          })
        );
      }

      if (mountedRef.current) {
        setOrder({ ...orderData, proof_public_url: proofPublicUrl || null });
        setPayments(paymentsWithUrls);
        setPaymentMethods(methodsRes.data || []);
        setInvoiceData(invoice);
      }
      const { data: logsData, error: logsError } = await supabase
        .from('order_logs')
        .select(`*, profiles(full_name)`)
        .eq('order_id', id)
        .order('created_at', { ascending: false });

      if (!logsError) {
        setOrderLogs(logsData || []);
      }

    } catch (err) {
      if (isAbortErr(err)) return;
      if (mountedRef.current) {
        setError({ message: err.message || 'Gagal memuat detail pesanan.' });
      }
    } finally {
      if (mountedRef.current && showLoading) setLoading(false);
    }
  }, [id, isAuthenticated]);

  const handleDataUpdate = useCallback(() => {
    fetchData(false);
    fetchActiveTemplates();
  }, [fetchData]);

  const handleDiscountApplied = useCallback((newGrandTotal, discountAmount) => {
    setOrder(prev => ({ ...prev, grand_total: newGrandTotal }));
    setInvoiceData(prev => ({ ...prev, total_discount: discountAmount, grand_total: newGrandTotal }));
    fetchData(false);
  }, [fetchData]);

  useEffect(() => {
    let timeoutId;
    if (id && isAuthenticated) {
      timeoutId = setTimeout(() => {
        fetchData(true);
        fetchActiveTemplates();
      }, 150);
    }
    return () => { if (timeoutId) clearTimeout(timeoutId); };
  }, [id, isAuthenticated, fetchData]);

  const derivedPaymentStatus = useMemo(() => {
    if (!order) return 'unpaid';
    if (order.payment_status) return order.payment_status.toLowerCase();
    if (totalPaid <= 0) return 'unpaid';
    if (totalPaid >= calculatedGrandTotal - 0.0001) return 'paid';
    return 'partial';
  }, [order?.payment_status, calculatedGrandTotal, totalPaid]);

  const paymentStatusMap = {
    paid: { variant: 'default', label: 'Lunas', icon: <CheckCircle2 className="h-3 w-3" /> },
    unpaid: { variant: 'destructive', label: 'Pending', icon: <AlertCircle className="h-3 w-3" /> },
    partial: { variant: 'secondary', label: 'Sebagian', icon: <AlertCircle className="h-3 w-3" /> },
  };
  const currentPaymentStatus = paymentStatusMap[derivedPaymentStatus];

  const normalizedMethods = useMemo(
    () => (paymentMethods || []).map(m => ({ id: m.id, method_name: m.method_name, type: m.type, account_name: m.account_name || null, account_number: m.account_number || null })),
    [paymentMethods]
  );

  const statusFromTotals = useCallback((paid, grand) => {
    if (paid <= 0) return 'unpaid';
    if (paid >= grand - 0.0001) return 'paid';
    return 'partial';
  }, []);

  const recomputeAndUpdateOrderStatus = useCallback(async (orderId, grandTotalFallback) => {
    const { data: rows, error: selErr } = await supabase.from('payments').select('amount').eq('order_id', orderId);
    if (selErr) throw selErr;
    const sum = (rows ?? []).reduce((s, r) => s + Number(r.amount || 0), 0);
    const gt = Number(order?.grand_total ?? grandTotalFallback ?? 0) || 0;
    const newStatus = statusFromTotals(sum, gt);
    const { error: updErr } = await supabase.from('orders').update({ payment_status: newStatus }).eq('id', orderId);
    if (updErr) throw updErr;
  }, [order?.grand_total, statusFromTotals]);

  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus pembayaran ini?')) return;
    if (!paymentId || !order) return;
    setOpLoading(true);
    try {
      const { error: delErr } = await supabase.from('payments').delete().eq('id', paymentId);
      if (delErr) throw delErr;
      await recomputeAndUpdateOrderStatus(order.id, calculatedGrandTotal);
      toast.success('Pembayaran dihapus.');
      handleDataUpdate();
    } catch (err) {
      if (!isAbortErr(err)) toast.error(err.message || 'Gagal menghapus pembayaran.');
    } finally { setOpLoading(false); }
  };
  
  const handleUpdatePayment = async (e) => {
    e.preventDefault();
    if (!editingPayment || !editAmount || !editMethodId) { toast.error('Data belum lengkap.'); return; }
    const newAmount = parseFloat(editAmount);
    const oldAmount = parseFloat(editingPayment.amount);
    const newTotalPaid = (totalPaid - oldAmount) + newAmount;
    if (newTotalPaid > calculatedGrandTotal) { toast.error('Total melebihi tagihan.'); return; }
    if (newAmount <= 0) { toast.error('Harus lebih dari nol.'); return; }

    setOpLoading(true);
    try {
      const { error: updateError } = await supabase
      .from('payments')
      .update({ 
        amount: newAmount, 
        payment_method_id: editMethodId,
        updated_by: userId, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', editingPayment.id);
      if (updateError) throw updateError;
      await recomputeAndUpdateOrderStatus(order.id, calculatedGrandTotal);
      toast.success('Diperbarui.');
      setIsEditing(false);
      handleDataUpdate();
    } catch (err) { toast.error(err.message); } finally { setOpLoading(false); }
  };
  
  const handleGeneratePrintInvoice = async () => {
    if (!order || !session) return;
    setIsSendingInvoice(true);
    toast.loading('Membuat invoice...', { id: 'invoice-toast-generate' });
    try {
      const payload = {
        order_id: order.id,
        orderData: { ...order, payments: payments, grand_total: calculatedGrandTotal, remaining_due: remainingDue, order_galon_items: order.order_galon_items, total_discount: currentDiscount }
      };
      const { data, error: invokeError } = await supabase.functions.invoke('create-invoice-pdf', {
        body: payload,
      });

      if (invokeError) throw new Error(invokeError.message || 'Gagal membuat PDF.');
      
      const { pdfUrl } = data;
      const uniquePdfUrl = `${pdfUrl}?t=${new Date().getTime()}`;
      setInvoiceData(prev => ({ ...prev, public_link: uniquePdfUrl }));
      window.open(uniquePdfUrl, '_blank');
      toast.success('Berhasil!', { id: 'invoice-toast-generate' });
    } catch (err) { toast.error(err.message, { id: 'invoice-toast-generate' }); } finally { setIsSendingInvoice(false); }
  };
  


  const handleOpenEditDialog = (payment) => {
    setEditingPayment(payment);
    setEditAmount(payment.amount.toString());
    setEditMethodId(payment.payment_method_id.toString());
    setIsEditing(true);
  };
  
  const handleOpenPaymentModal = (order) => {
    setSelectedOrderForPayment(order);
    setIsPaymentModalOpen(true);
  };

  if (loading) return <div className="flex justify-center items-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-[#011e4b]" /></div>;
  
  if (error) return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali</Button>
      <Card><CardHeader><CardTitle>Terjadi kesalahan</CardTitle></CardHeader><CardContent><p className="text-red-600">{error.message}</p><Button variant="outline" onClick={() => fetchData(true)} className="mt-4">Coba lagi</Button></CardContent></Card>
    </div>
  );

  const allItems = [...(order.order_items || [])];
  if (order.transport_cost > 0) allItems.push({ id: 'transport-cost', products: { name: 'Biaya Transportasi' }, qty: 1, price: order.transport_cost, item_type: 'biaya' });
  if (order.order_galon_items) {
    order.order_galon_items.forEach(g => {
      if (g.purchased_empty_qty > 0) allItems.push({ id: `pur-${g.product_id}`, products: { name: `Beli Kemasan (${g.products?.name})` }, qty: g.purchased_empty_qty, price: g.products?.empty_bottle_price || 0, item_type: 'pembelian' });
      if (g.returned_qty > 0) allItems.push({ id: `ret-${g.product_id}`, products: { name: `Kemasan Kembali (${g.products?.name})` }, qty: g.returned_qty, price: 0, item_type: 'pengembalian' });
      if (g.borrowed_qty > 0) allItems.push({ id: `bor-${g.product_id}`, products: { name: `Kemasan Dipinjam (${g.products?.name})` }, qty: g.borrowed_qty, price: 0, item_type: 'pinjam' });
    });
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl space-y-8">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 px-0"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali</Button>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-[#011e4b] flex items-center gap-3"><ListOrdered className="h-8 w-8" /> Detail Pesanan</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handleViewRoute} className="text-blue-600 hover:bg-blue-50 border-blue-200"><Navigation className="mr-2 h-4 w-4" /> Lihat Rute</Button>
          
          {/* TOMBOL PENGATURAN WA */}
          <Button variant="outline" onClick={() => setIsTemplateModalOpen(true)} className="text-[#011e4b] hover:bg-gray-100">
            <Settings className="mr-2 h-4 w-4" /> Atur Pesan WA
          </Button>

          {!isPaid && <Button variant="outline" onClick={() => navigate(`/orders/edit/${order.id}`)} className="text-[#011e4b] hover:bg-gray-100"><Pencil className="mr-2 h-4 w-4" /> Edit Pesanan</Button>}
          <Button variant="outline" onClick={() => fetchData(true)} className="text-[#011e4b] hover:bg-gray-100"><RefreshCcw className="mr-2 h-4 w-4" /> Refresh</Button>
          {(order.status === 'sent' || order.status === 'completed') && !isPaid && <Button onClick={() => handleOpenPaymentModal(order)} className="bg-green-500 hover:bg-green-600 text-white"><CreditCard className="mr-2 h-4 w-4" /> Tambah Pembayaran</Button>}
          <Button variant="outline" onClick={handleGeneratePrintInvoice} disabled={isSendingInvoice} className="text-[#011e4b] hover:bg-gray-100">{isSendingInvoice ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ReceiptText className="mr-2 h-4 w-4" />} Cetak Invoice</Button>
          <Button 
              variant="outline" 
              onClick={handleShareInvoice} 
              disabled={isSendingInvoice || !invoiceData?.public_link || processingWA} 
              className="text-green-600 border-green-600"
          >
              {processingWA ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquareText className="mr-2 h-4 w-4" />} 
              Kirim Invoice
          </Button>
        <Button 
            variant="outline" 
            onClick={handleConfirmOrder} 
            disabled={processingWA}
            className="text-[#011e4b] hover:bg-gray-100"
        >
            {processingWA ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareText className="mr-2 h-4 w-4" />} 
            Konfirmasi
        </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
            <Card className="border border-gray-200 shadow-sm transition-all hover:shadow-md">
                <CardHeader className="p-4"><CardTitle className="text-[#011e4b]">Pesanan #{order.invoice_number || order.id.slice(0, 8)}</CardTitle><CardDescription>Rincian lengkap pesanan.</CardDescription></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 pt-0">
                <div className="space-y-1"><p className="text-sm font-medium text-gray-500">Pelanggan</p><p className="font-semibold text-base text-[#011e4b]">{order.customers?.name}</p></div>
                <div className="space-y-1"><p className="text-sm font-medium text-gray-500">Status Pengiriman</p>{getDeliveryStatusBadge(order.status)}</div>
                <div className="space-y-1"><p className="text-sm font-medium text-gray-500">Status Pembayaran</p><Badge variant={currentPaymentStatus.variant} className={`flex items-center gap-1 font-semibold ${derivedPaymentStatus === 'unpaid' ? 'bg-red-500 hover:bg-red-500' : derivedPaymentStatus === 'paid' ? 'bg-green-500 hover:bg-green-500' : 'bg-yellow-400 hover:bg-yellow-400 text-black'}`}>{getPaymentStatusBadge(derivedPaymentStatus)}</Badge></div>
                <div className="space-y-1"><p className="text-sm font-medium text-gray-500">Total</p><p className="font-bold text-lg text-[#011e4b]">{formatCurrency(calculatedGrandTotal)}</p></div>
                </CardContent>
            </Card>

            <Card className="border border-gray-200 shadow-sm transition-all hover:shadow-md">
                <CardHeader className="p-4"><CardTitle className="text-[#011e4b]">Item Pesanan</CardTitle></CardHeader>
                <CardContent className="space-y-4 p-4 pt-0">
                    <div className="space-y-2">
                      {allItems.map((it, index) => (
                        <div key={it.id || index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-2 last:border-b-0 last:pb-0 gap-3">
                          <div className="flex items-center gap-3"> {/* Tambahkan flex wrapper */}
                            
                            {/* --- TAMBAHKAN BLOK GAMBAR INI --- */}
                            <div className="w-12 h-12 rounded-lg border bg-slate-50 overflow-hidden shrink-0 flex items-center justify-center">
                              {it.products?.image_url ? (
                                <img src={it.products.image_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <ImageIcon className="h-5 w-5 text-slate-300" />
                              )}
                            </div>
                            {/* ---------------------------------- */}

                            <div className="space-y-0.5">
                              <p className="font-medium text-[#011e4b]">{it.products?.name || 'Produk'}</p>
                              <p className="text-xs text-gray-500">
                                {it.item_type !== 'biaya' && it.item_type !== 'pembelian' && it.item_type !== 'pengembalian' && it.item_type !== 'pinjam' && `${Number(it.qty)} × `}
                                {formatCurrency(Number(it.price))} {it.item_type ? `• ${it.item_type}` : ''}
                              </p>
                            </div>
                          </div>
                          <div className="font-semibold mt-2 sm:mt-0 text-[#011e4b] pl-15 sm:pl-0">
                            {formatCurrency(Number(it.qty) * Number(it.price))}
                          </div>
                        </div>
                      ))}
                    </div>
                    {currentDiscount > 0 && <><Separator className='!mt-4'/><div className="flex items-center justify-between"><p className="font-medium text-red-600">Diskon Diterapkan</p><div className="font-bold text-base text-red-600">- {formatCurrency(currentDiscount)}</div></div></>}
                    <div className="flex items-center justify-between pt-2 border-t mt-2"><p className="text-lg font-bold text-[#011e4b]">Grand Total</p><p className="font-bold text-lg text-green-600">{formatCurrency(calculatedGrandTotal)}</p></div>
                    <div className="grid grid-cols-2 gap-4 border-t pt-4"><div><p className="text-sm text-gray-500">Total Dibayar</p><p className="font-semibold text-base text-[#011e4b]">{formatCurrency(totalPaid)}</p></div><div><p className="text-sm text-gray-500">Sisa Tagihan</p><p className="font-bold text-base text-red-500">{formatCurrency(remainingDue)}</p></div></div>
                </CardContent>
            </Card>

            <Card className="border border-gray-200 shadow-sm transition-all hover:shadow-md">
                <CardHeader className="p-4"><CardTitle className="text-[#011e4b]">Riwayat Pembayaran</CardTitle><CardDescription>Pembayaran tercatat.</CardDescription></CardHeader>
                <CardContent className="space-y-3 p-4 pt-0">
                    {payments.filter(p => p.amount > 0).length === 0 && <p className="text-sm text-gray-500">Belum ada pembayaran.</p>}
                    {payments.filter(p => p.amount > 0).map((p) => (
                        <div key={p.id} className="flex items-start justify-between border rounded-lg p-3 hover:bg-gray-50 transition-colors">
                        <div className="space-y-0.5 flex-1 pr-2"><p className="font-medium text-[#011e4b]">{formatCurrency(Number(p.amount))}</p><p className="text-xs text-gray-500">{new Date(p.paid_at || p.created_at).toLocaleString('id-ID')}</p><p className="text-xs text-gray-500 font-medium">Metode: {p.payment_method?.method_name}</p><p className="text-xs text-gray-500">Diterima oleh: {p.received_by?.full_name || p.received_by_name}</p>{p.proof_public_url && <a href={p.proof_public_url} target="_blank" rel="noreferrer" className="block mt-2"><img src={p.proof_public_url} alt="Bukti" className="w-24 h-auto rounded-md border hover:opacity-75 transition-opacity" /></a>}</div>
                        <div className="flex flex-col gap-1"><Button variant="ghost" size="icon" onClick={() => handleOpenEditDialog(p)} disabled={opLoading} className="h-8 w-8"><Pencil className="h-4 w-4" /></Button><Button variant="destructive" size="icon" onClick={() => handleDeletePayment(p.id)} disabled={opLoading} className="bg-red-500 hover:bg-red-600 h-8 w-8"><Trash2 className="h-4 w-4" /></Button></div>
                        </div>
                    ))}
                </CardContent>
            </Card>
            {/* --- KARTU HISTORI PERUBAHAN (FIXED) --- */}
        <Card className="border border-gray-200 shadow-sm transition-all hover:shadow-md">
            <CardHeader className="p-4 flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-[#011e4b] text-base">Audit Log (Histori)</CardTitle>
                    <CardDescription className="text-[10px]">Jejak digital pengeditan pesanan.</CardDescription>
                </div>
                <Clock className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
                {orderLogs.length === 0 && (
                    <div className="text-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin mx-auto text-slate-200" />
                        <p className="text-[10px] text-gray-400 italic mt-2">Memuat riwayat...</p>
                    </div>
                )}
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {orderLogs.map((log) => (
                        <div key={log.id} className="flex gap-3 border-l-2 border-slate-100 pl-4 pb-1 relative">
                            {/* Bullet point on the timeline */}
                            <div className={`absolute -left-[5px] top-0 w-2 h-2 rounded-full border-2 border-white ${
                                log.action === 'CREATE' ? 'bg-blue-500' : 'bg-amber-500'
                            }`} />
                            
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-[11px] font-bold text-slate-800">
                                        {log.profiles?.full_name || 'System'}
                                    </span>
                                    {getActionLabel(log.action)}
                                </div>
                                
                                <p className="text-[9px] text-slate-400 flex items-center gap-1 font-medium">
                                    <Clock className="h-2.5 w-2.5" />
                                    {new Date(log.created_at).toLocaleString('id-ID', { 
                                        day: 'numeric', month: 'short', year: 'numeric', 
                                        hour: '2-digit', minute: '2-digit' 
                                    })}
                                </p>
                                
                                {/* PANGGIL HELPER DIFF DI SINI */}
                                {renderLogDetails(log, formatCurrency)}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
        </div>

        <div className="space-y-6">
            <Card className="border-t-4 border-t-blue-600 shadow-md bg-white">
                <CardHeader className="p-4 bg-blue-50 border-b border-blue-100"><CardTitle className="text-sm font-bold text-blue-800 flex items-center gap-2"><MapPin className="h-4 w-4" /> Rekomendasi Searah</CardTitle><CardDescription className="text-xs text-blue-600">Pelanggan lain di sekitar.</CardDescription></CardHeader>
                <CardContent className="p-0">
                    <div className="p-3 border-b flex items-center gap-2 bg-white"><Label className="text-xs">Radius (KM):</Label><Input type="number" className="h-7 w-16 text-center text-xs" value={scanRadius} onChange={(e) => setScanRadius(e.target.value)} step="0.5" />{loadingNearby && <Loader2 className="h-3 w-3 animate-spin text-blue-500"/>}</div>
                    <div className="max-h-[400px] overflow-y-auto">
                        {!order?.customers?.latitude ? (<div className="p-4 text-center text-xs text-gray-400"><AlertCircle className="h-6 w-6 mx-auto mb-1 text-gray-300" />Belum ada titik peta.<Button variant="link" className="text-xs h-auto p-0 ml-1" onClick={() => navigate('/maps')}>Set di Peta</Button></div>) : nearbyCustomers.length === 0 ? (<div className="p-4 text-center text-xs text-gray-400">Tidak ada pelanggan lain.</div>) : (
                            <div className="divide-y">{nearbyCustomers.map((nc) => (
                              <div key={nc.id} className="p-3 hover:bg-gray-50 flex justify-between items-center group transition-colors">
                                <div>
                                  <p className="text-sm font-semibold text-[#011e4b]">{nc.name}</p>
                                  <div className="flex items-center gap-1 text-xs text-orange-600 font-medium">
                                    <Navigation className="h-3 w-3" />
                                    {nc.distance_km.toFixed(2)} km
                                  </div>
                                </div>
                                {/* PERBAIKAN DI SINI: Gunakan processingNearby[nc.id] */}
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className={`h-8 w-8 text-green-600 bg-green-50 hover:bg-green-100 ${processingNearby[nc.id] ? 'opacity-50' : ''}`} 
                                  onClick={() => handleContactNeighbor(nc)}
                                  disabled={processingNearby[nc.id]}
                                >
                                  {processingNearby[nc.id] ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <MessageSquareText className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                              ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
            {order.proof_public_url && (<Card className="border border-gray-200 shadow-sm transition-all hover:shadow-md"><CardHeader className="p-4"><CardTitle className="text-[#011e4b]">Bukti Pengiriman</CardTitle></CardHeader><CardContent className="p-4 pt-0"><a href={order.proof_public_url} target="_blank" rel="noreferrer"><img src={order.proof_public_url} alt="Bukti" className="w-48 h-auto rounded-md border" /></a></CardContent></Card>)}
        </div>
      </div>
      
      <Dialog open={isEditing} onOpenChange={setIsEditing}><DialogContent className="sm:max-w-[425px]"><DialogHeader><DialogTitle>Edit Pembayaran</DialogTitle></DialogHeader><form onSubmit={handleUpdatePayment} className="grid gap-4 py-4"><div className="space-y-2"><Label htmlFor="editAmount">Jumlah Pembayaran</Label><Input id="editAmount" type="number" step="any" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} required /></div><div className="space-y-2"><Label htmlFor="editMethodId">Metode Pembayaran</Label><Select value={editMethodId} onValueChange={setEditMethodId} required><SelectTrigger id="editMethodId" className="w-full"><SelectValue placeholder="Pilih Metode" /></SelectTrigger><SelectContent>{normalizedMethods.map(method => (<SelectItem key={method.id} value={String(method.id)}>{method.method_name}</SelectItem>))}</SelectContent></Select></div><DialogFooter className="mt-4"><DialogClose asChild><Button type="button" variant="outline">Batal</Button></DialogClose><Button type="submit" disabled={opLoading}>{opLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Simpan Perubahan'}</Button></DialogFooter></form></DialogContent></Dialog>
      
      <AddPaymentModal isOpen={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen} order={{ ...order, grand_total: calculatedGrandTotal }} onPaymentAdded={handleDataUpdate} onDiscountApplied={handleDiscountApplied} />

      {/* --- MODAL PENGATURAN WA --- */}
      <WhatsappTemplateSettingsModal 
        isOpen={isTemplateModalOpen} 
        onOpenChange={(open) => {
            setIsTemplateModalOpen(open);
            if (!open) fetchActiveTemplates(); 
        }} 
      />
    </div>
  );
};

export default OrderDetailsPage;