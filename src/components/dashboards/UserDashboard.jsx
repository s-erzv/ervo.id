import { useEffect, useState, useCallback, useRef } from 'react';
import CryptoJS from 'crypto-js';
import { supabase } from '../../lib/supabase';
import WhatsappTemplateSettingsModal from '@/components/WhatsappTemplateSettingsModal';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Loader2, Package, MapPin, Clock, CheckCircle2, TruckIcon,
  AlertCircle, User, Phone, History, Banknote, Pencil, Trash2,
  Plus, Search, Image as ImageIcon, Info, Zap, ReceiptText,
  MessageSquareText, ListOrdered, Settings, ChevronLeft, ChevronRight, X
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import AddPaymentModal from '@/components/AddPaymentModal';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ─── KONSTANTA ─────────────────────────────────────────────────────────────── 
const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'fallback-key-proyek-rahasia';
const PAGE_SIZE = 12; // 3 kolom × 4 baris — cukup untuk satu layar
const LAST_ACTIVE_DASHBOARD_TAB = 'lastActiveDashboardTab';
const LAST_SEARCH_QUERY         = 'lastSearchQuery';
const LAST_DELIVERY_FILTER      = 'lastDeliveryFilter';
const LAST_PAYMENT_FILTER       = 'lastPaymentFilter';

// ─── KOMPONEN BUKTI PENGIRIMAN (tidak ada perubahan logika) ───────────────────
const ImageProof = ({ orderId, status, proofUrl }) => {
  const [publicUrl, setPublicUrl]     = useState(null);
  const [loadingProof, setLoadingProof] = useState(true);

  useEffect(() => {
    setLoadingProof(true);
    if (proofUrl) {
      const { data } = supabase.storage.from('proofs').getPublicUrl(proofUrl, {
        transform: { width: 800, height: 600, resize: 'contain' },
      });
      setPublicUrl(data?.publicUrl);
    }
    setLoadingProof(false);
  }, [proofUrl]);

  const H = 'min-h-[6rem] h-32';

  if (loadingProof)
    return <div className={`flex items-center justify-center w-full bg-gray-100 rounded-lg ${H}`}><Loader2 className="h-6 w-6 animate-spin text-[#10182b]" /></div>;

  if (publicUrl)
    return (
      <a href={publicUrl} target="_blank" rel="noopener noreferrer" className={`block w-full overflow-hidden rounded-lg border hover:opacity-90 transition-opacity ${H}`}>
        <img src={publicUrl} alt={`Bukti Kirim #${orderId.slice(0, 8)}`} className="object-cover w-full h-full" />
      </a>
    );

  if (!proofUrl && (status === 'draft' || status === 'sent'))
    return <div className={`flex flex-col items-center justify-center w-full bg-gray-100 rounded-lg p-3 text-gray-500 text-sm text-center ${H}`}><ImageIcon className="h-6 w-6 mb-1" />Belum Ada Bukti Kirim</div>;

  if (!proofUrl && status === 'completed')
    return <div className={`flex flex-col items-center justify-center w-full bg-gray-100 rounded-lg p-3 text-gray-500 text-sm text-center ${H}`}><ImageIcon className="h-6 w-6 mb-1" />Tidak Ada Bukti Pengiriman</div>;

  if (status === 'completed' && proofUrl && !publicUrl)
    return <div className={`flex flex-col items-center justify-center w-full bg-red-100 border border-red-300 rounded-lg p-3 text-red-600 text-sm text-center ${H}`}><AlertCircle className="h-6 w-6 mb-1" />Error memuat bukti kirim</div>;

  return null;
};

// ─── KOMPONEN UTAMA ────────────────────────────────────────────────────────── 
const UserDashboard = ({ userId: propUserId, isAllOrdersMode = false }) => {
  const navigate     = useNavigate();
  const location     = useLocation();
  const { session, companyId, companyName, userId } = useAuth();
  const currentUserId = session?.user?.id;

  // ─── DATA STATE ────────────────────────────────────────────────────────────
  const [tasks, setTasks]       = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [loading, setLoading]   = useState(true);

  // ─── COUNT PER BUCKET (untuk badge tab & pagination) ──────────────────────
  // Masing-masing tab (active / history) punya total & halaman sendiri
  const [countActive,  setCountActive]  = useState(0);
  const [countHistory, setCountHistory] = useState(0);
  const [pageActive,   setPageActive]   = useState(1);
  const [pageHistory,  setPageHistory]  = useState(1);

  // ─── TAB & FILTER STATE ────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem(LAST_ACTIVE_DASHBOARD_TAB) || 'active');

  // Nilai awal dari localStorage agar filter tetap saat kembali ke halaman
  const [searchQuery,    setSearchQuery]    = useState(() => localStorage.getItem(LAST_SEARCH_QUERY)    || '');
  const [deliveryFilter, setDeliveryFilter] = useState(() => localStorage.getItem(LAST_DELIVERY_FILTER) || 'all');
  const [paymentFilter,  setPaymentFilter]  = useState(() => localStorage.getItem(LAST_PAYMENT_FILTER)  || 'all');
  const [courierFilter,  setCourierFilter]  = useState('all');

  // ─── DEBOUNCE SEARCH ───────────────────────────────────────────────────────
  // Search dikirim ke DB (ilike), bukan filter di memori JS
  // Debounce 400ms agar tidak hit DB tiap ketikan
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  const debounceRef = useRef(null);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(val);
      setPageActive(1);   // Reset pagination saat search berubah
      setPageHistory(1);
    }, 400);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setPageActive(1);
    setPageHistory(1);
  };

  // ─── WA & INVOICE STATE ───────────────────────────────────────────────────
  const [processingWA,    setProcessingWA]    = useState({});
  const [isSendingInvoice, setIsSendingInvoice] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen]           = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen]         = useState(false);
  const [activeTemplates, setActiveTemplates]                 = useState({});

  const dashboardTitle = isAllOrdersMode ? 'Semua Pesanan' : 'Dashboard Petugas';

  // ─── PERSIST FILTER KE LOCALSTORAGE ───────────────────────────────────────
  useEffect(() => { localStorage.setItem(LAST_ACTIVE_DASHBOARD_TAB, activeTab);   }, [activeTab]);
  useEffect(() => { localStorage.setItem(LAST_SEARCH_QUERY,    searchQuery);      }, [searchQuery]);
  useEffect(() => { localStorage.setItem(LAST_DELIVERY_FILTER, deliveryFilter);   }, [deliveryFilter]);
  useEffect(() => { localStorage.setItem(LAST_PAYMENT_FILTER,  paymentFilter);    }, [paymentFilter]);

  // ─── FETCH TEMPLATE WA ────────────────────────────────────────────────────
  const fetchActiveTemplates = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('whatsapp_templates')
      .select('template_name, template_text')
      .eq('company_id', companyId);
    if (data) {
      const map = {};
      data.forEach(t => { map[t.template_name] = t.template_text; });
      setActiveTemplates(map);
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId && session) fetchActiveTemplates();
  }, [companyId, session, fetchActiveTemplates]);

  // ─── ASSIGN SELF ──────────────────────────────────────────────────────────
  // PERBAIKAN: Dikeluarkan dari fetchData agar tidak recreate tiap fetch
  const handleAssignSelf = useCallback(async (orderId) => {
    const { error } = await supabase.from('order_couriers').upsert({
      order_id: orderId,
      courier_id: currentUserId,
      company_id: companyId,
    });
    if (error) {
      toast.error('Gagal mengambil tugas');
    } else {
      toast.success('Anda berhasil bergabung ke pengiriman ini!');
      // Trigger refetch manual
      setPageActive(p => p === 1 ? 0 : 1); // Trik kecil untuk trigger effect
    }
  }, [currentUserId, companyId]);

  // ─── FETCH UTAMA (DIOPTIMASI) ──────────────────────────────────────────────
  // RINGKASAN PERUBAHAN vs versi lama:
  //
  // SEBELUM:
  //   - select('*') → payload besar, ambil kolom yang tidak dipakai
  //   - Ambil SEMUA data sekaligus ke JS, lalu filter di memori
  //   - Filter courier pakai .some() di array JS
  //   - Search pakai .includes() di string JS
  //
  // SESUDAH:
  //   - SELECT kolom spesifik → payload jauh lebih kecil
  //   - Semua filter dijalankan di PostgreSQL via Supabase query
  //   - Pagination .range() → hanya PAGE_SIZE rows per request
  //   - Dua query paralel (Promise.all): satu untuk tab aktif, satu untuk riwayat
  //     sehingga count badge tab selalu akurat tanpa fetch ulang semua data
  const fetchData = useCallback(async () => {
    if (!companyId || !propUserId) return;
    setLoading(true);

    try {
      // ── Fetch kurir untuk dropdown (ringan, hanya id+name) ──
      const { data: couriersData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('company_id', companyId)
        .eq('role', 'user');
      setCouriers(couriersData || []);

      // ── Helper: bangun query dengan filter yang berlaku ──
      // bucketType: 'active' = belum selesai/lunas, 'history' = selesai & lunas
      // Kita panggil helper ini dua kali secara paralel untuk mendapat count per tab
      const buildBaseQuery = () => {
        // SELECT hanya kolom yang benar-benar dipakai di card UI
        // Ini mengurangi payload secara signifikan vs select('*')
        let q = supabase
          .from('orders')
          .select(`
            id,
            company_id,
            status,
            payment_status,
            planned_date,
            created_at,
            notes,
            grand_total,
            transport_cost,
            proof_of_delivery_url,
            invoice_number,
            customers!inner (name, address, phone),
            order_items (
              product_id, qty, price, item_type,
              products (name, is_returnable, company_id, empty_bottle_price)
            ),
            payments (
              id, amount,
              payment_method:payment_methods (id, method_name, type, account_name, account_number)
            ),
            order_couriers (courier_id),
            order_galon_items (
              id, purchased_empty_qty,
              products (id, name, empty_bottle_price)
            ),
            invoices (public_link)
          `, { count: 'exact' })
          .eq('company_id', companyId)
          .order('created_at', { ascending: false });

        // ── Filter courier — langsung di DB, tidak pakai .some() di JS ──
        // Gunakan inner join pada relasi order_couriers
        if (courierFilter !== 'all') {
          q = q.eq('order_couriers.courier_id', courierFilter);
        }

        // ── Filter delivery status ──
        if (deliveryFilter !== 'all') {
          q = q.eq('status', deliveryFilter);
        }

        // ── Filter payment status ──
        if (paymentFilter !== 'all') {
          if (paymentFilter === 'unpaid') {
            // 'unpaid' dan 'pending' sama-sama berarti belum bayar
            q = q.in('payment_status', ['unpaid', 'pending']);
          } else {
            q = q.eq('payment_status', paymentFilter);
          }
        }

        // ── Search: ilike di PostgreSQL — jauh lebih efisien dari .includes() JS ──
        // Cari berdasarkan nama customer (via relasi) atau invoice_number
        if (debouncedSearch.trim()) {
          const searchVal = debouncedSearch.trim();
          const term = `%${searchVal}%`;
          
          if (/^\d+$/.test(searchVal)) {
            // Jika numerik, cari berdasarkan nomor invoice
            q = q.eq('invoice_number', searchVal);
          } else {
            // Jika bukan numerik, cari berdasarkan nama customer
            q = q.ilike('customers.name', term);
          }
        }

        return q;
      };

      // ── Tentukan halaman yang aktif berdasarkan tab ──
      const currentPageActive  = pageActive  < 1 ? 1 : pageActive;
      const currentPageHistory = pageHistory < 1 ? 1 : pageHistory;

      // ── Dua query paralel: active tab & history tab ──
      // "active" = belum selesai ATAU belum lunas (status != completed OR payment belum paid)
      // "history" = selesai DAN lunas
      //
      // Kita jalankan dua query sekaligus agar keduanya selesai bersamaan
      // dan badge count di tab selalu akurat
      const [activeResult, historyResult] = await Promise.all([
        // Tab "Tugas Aktif": not (completed AND paid)
        buildBaseQuery()
          .or('status.neq.completed,payment_status.not.in.(paid)')
          .range(
            (currentPageActive - 1) * PAGE_SIZE,
            currentPageActive * PAGE_SIZE - 1
          ),
        // Tab "Riwayat": completed AND paid
        buildBaseQuery()
          .eq('status', 'completed')
          .in('payment_status', ['paid'])
          .range(
            (currentPageHistory - 1) * PAGE_SIZE,
            currentPageHistory * PAGE_SIZE - 1
          ),
      ]);

      if (activeResult.error)  throw activeResult.error;
      if (historyResult.error) throw historyResult.error;

      // ── Proses data: hitung total & remaining_due per order ──
      const processRow = (task) => {
        const itemsTotal = (task.order_items || []).reduce((sum, item) => sum + (item.qty * item.price), 0);
        const calculatedGrandTotal = (task.grand_total || 0) > 0
          ? task.grand_total
          : itemsTotal + (task.transport_cost || 0);
        const totalPaid = (task.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
        return {
          ...task,
          total:         calculatedGrandTotal,
          total_paid:    totalPaid,
          remaining_due: calculatedGrandTotal - totalPaid,
          // Ambil public_link dari relasi invoices
          invoice_public_link: task.invoices?.public_link || null,
        };
      };

      const activeTasks  = (activeResult.data  || []).map(processRow);
      const historyTasks = (historyResult.data  || []).map(processRow);

      // Gabungkan untuk tab yang aktif — UI tab menentukan mana yang ditampilkan
      setTasks({ active: activeTasks, history: historyTasks });
      setCountActive(activeResult.count  || 0);
      setCountHistory(historyResult.count || 0);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Gagal memuat data tugas.');
      setTasks({ active: [], history: [] });
    } finally {
      setLoading(false);
    }
  }, [
    companyId, propUserId,
    debouncedSearch, deliveryFilter, paymentFilter, courierFilter,
    pageActive, pageHistory,
  ]);

  // ─── TRIGGER FETCH ─────────────────────────────────────────────────────────
  // fetchData dipanggil ulang setiap kali filter / halaman berubah
  useEffect(() => {
    if (propUserId && companyId) fetchData();
  }, [propUserId, companyId, fetchData]);

  // Reset halaman ke 1 saat filter berubah (bukan saat halaman berubah)
  useEffect(() => {
    setPageActive(1);
    setPageHistory(1);
  }, [debouncedSearch, deliveryFilter, paymentFilter, courierFilter]);

  // ─── SCROLL PERSISTENCE ────────────────────────────────────────────────────
  const handleScrollToCard = useCallback(() => {
    if (location.hash) {
      const el = document.getElementById(location.hash.substring(1));
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash]);

  useEffect(() => {
    const timer = setTimeout(handleScrollToCard, 100);
    return () => clearTimeout(timer);
  }, [tasks, activeTab, handleScrollToCard]);

  // ─── DELETE ───────────────────────────────────────────────────────────────
  const handleDeleteClick = async (orderId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus pesanan ini?')) return;
    setLoading(true);
    try {
      const response = await fetch('https://wzmgcainyratlwxttdau.supabase.co/functions/v1/delete-order', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ orderId, companyId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete order');
      toast.success('Pesanan berhasil dihapus.');
      fetchData();
    } catch (error) {
      toast.error('Gagal menghapus pesanan: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── UPDATE STATUS ────────────────────────────────────────────────────────
  const updateOrderStatus = async (order, newStatus) => {
    if (order.status === 'completed') {
      toast.error('Pesanan sudah selesai dan tidak bisa diperbarui lagi.');
      return;
    }
    setLoading(true);
    try {
      if (newStatus === 'sent') {
        const soldItems = (order.order_items || []).filter(item => item.item_type === 'beli');
        const { data: existingMoves, error: existingErr } = await supabase
          .from('stock_movements')
          .select('id')
          .eq('order_id', order.id)
          .eq('type', 'keluar');

        if (existingErr) { toast.error('Gagal mengecek pergerakan stok.'); setLoading(false); return; }

        if (!existingMoves || existingMoves.length === 0) {
          for (const item of soldItems) {
            const { data: productData, error: productFetchError } = await supabase
              .from('products').select('stock').eq('id', item.product_id).single();
            if (productFetchError) throw productFetchError;

            await supabase.from('products')
              .update({ stock: productData.stock - item.qty })
              .eq('id', item.product_id);

            await supabase.from('stock_movements').insert({
              type: 'keluar', qty: item.qty,
              notes: `Produk keluar via Dashboard #${order.id.slice(0, 8)}`,
              order_id: order.id, user_id: userId,
              product_id: item.product_id, company_id: companyId,
            });
          }
        }
      }

      const { error } = await supabase.from('orders')
        .update({ status: newStatus, updated_by: userId })
        .eq('id', order.id);

      if (error) { toast.error('Gagal memperbarui status.'); }
      else { toast.success('Status berhasil diperbarui!'); fetchData(); }
    } catch (e) {
      toast.error('Terjadi kesalahan: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── CETAK INVOICE ────────────────────────────────────────────────────────
  const handleGeneratePrintInvoice = async (order) => {
    if (!order || !session) return;
    setIsSendingInvoice(true);
    toast.loading('Membuat invoice PDF...', { id: `invoice-toast-gen-${order.id}` });

    let publicProofUrl = null;
    if (order.proof_of_delivery_url) {
      try {
        const { data } = supabase.storage.from('proofs').getPublicUrl(order.proof_of_delivery_url);
        publicProofUrl = data?.publicUrl;
      } catch (e) { console.error('Failed to get public URL for proof:', e); }
    }

    try {
      const payload = {
        order_id: order.id,
        orderData: {
          ...order,
          company_id: order.company_id || companyId, 
          payments: order.payments,
          grand_total: order.total,
          remaining_due: order.remaining_due,
          order_galon_items: order.order_galon_items,
          proof_public_url: publicProofUrl,
        }
      };

      const response = await fetch('https://wzmgcainyratlwxttdau.supabase.co/functions/v1/create-invoice-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await response.text());

      const { pdfUrl } = await response.json();
      const uniquePdfUrl = `${pdfUrl}?t=${new Date().getTime()}`;

      // Update invoice link di state lokal tasks
      setTasks(prev => ({
        active:  prev.active.map(t  => t.id === order.id ? { ...t, invoice_public_link: uniquePdfUrl } : t),
        history: prev.history.map(t => t.id === order.id ? { ...t, invoice_public_link: uniquePdfUrl } : t),
      }));

      window.open(uniquePdfUrl, '_blank');
      toast.success('Invoice berhasil dibuat & dibuka untuk dicetak!', { id: `invoice-toast-gen-${order.id}` });
    } catch (err) {
      toast.error(err.message || 'Gagal membuat invoice.', { id: `invoice-toast-gen-${order.id}` });
    } finally {
      setIsSendingInvoice(false);
    }
  };

  // ─── KIRIM INVOICE WA ─────────────────────────────────────────────────────
  const handleShareInvoice = async (order) => {
    if (!order || !session || processingWA[order.id]) return;

    const cachedLink = order.invoice_public_link;
    if (!cachedLink) { toast.error('Harap CETAK INVOICE terlebih dahulu.'); return; }

    setProcessingWA(prev => ({ ...prev, [order.id]: true }));
    const tid = toast.loading('Mempersiapkan pesan WhatsApp...');

    try {
      const productsListWithPrice = (order.order_items || [])
        .map(item => `* ${item.products.name} (${item.qty} pcs) x ${formatCurrency(item.price)}`)
        .join('\n');

      const productsListSimple = (order.order_items || [])
        .map(item => `* ${item.products.name} (${item.qty} pcs)`)
        .join('\n');

      let paymentMethodDisplay = 'N/A';
      let methodToDisplay = null;

      if (order.payments?.length > 0) {
        methodToDisplay = order.payments[order.payments.length - 1].payment_method;
      }
      if (!methodToDisplay) {
        const { data: methods } = await supabase
          .from('payment_methods').select('*')
          .eq('company_id', companyId).eq('is_active', true);
        methodToDisplay = methods?.find(m => m.type === 'transfer') || methods?.[0];
      }
      if (methodToDisplay) {
        paymentMethodDisplay = methodToDisplay.type === 'transfer'
          ? `Transfer ${methodToDisplay.method_name} ${methodToDisplay.account_number} a.n ${methodToDisplay.account_name || ''}`
          : methodToDisplay.method_name;
      }

      const template = activeTemplates['payment_reminder'] || '';
      if (!template) throw new Error('Template WhatsApp belum diatur di pengaturan.');

      const whatsappMessage = template
        .replace(/{{customerName}}/g,         order.customers?.name || 'Pelanggan')
        .replace(/{{invoiceNo}}/g,             order.invoice_number || order.id.slice(0, 8))
        .replace(/{{totalHarga}}/g,            formatCurrency(order.total))
        .replace(/{{sisaTagihan}}/g,           formatCurrency(order.remaining_due))
        .replace(/{{productsList}}/g,          productsListSimple)
        .replace(/{{productsListWithPrice}}/g, productsListWithPrice)
        .replace(/{{invoiceLink}}/g,           cachedLink)
        .replace(/{{paymentMethod}}/g,         paymentMethodDisplay)
        .replace(/{{orderDate}}/g,             formatDate(order.planned_date || order.created_at))
        .replace(/{{companyName}}/g,           companyName || 'Perusahaan Kami');

      const phone = (order.customers?.phone || '').replace(/[^\d]/g, '');

      const { data: companyData } = await supabase
        .from('companies').select('fonnte_token').eq('id', companyId).single();

      let finalToken = null;
      if (companyData?.fonnte_token) {
        try {
          const bytes = CryptoJS.AES.decrypt(companyData.fonnte_token, ENCRYPTION_KEY);
          finalToken = bytes.toString(CryptoJS.enc.Utf8) || companyData.fonnte_token;
        } catch { finalToken = companyData.fonnte_token; }
      }

      if (finalToken && finalToken.trim() !== '' && phone) {
        const response = await fetch('https://api.fonnte.com/send', {
          method: 'POST',
          headers: { 'Authorization': finalToken },
          body: new URLSearchParams({ target: phone, message: whatsappMessage, countryCode: '62' }),
        });
        const result = await response.json();
        if (result.status === true) {
          toast.success('Pesan Terkirim Otomatis!', { id: tid });
        } else {
          throw new Error(result.reason || 'Token Fonnte bermasalah');
        }
      } else {
        toast.dismiss(tid);
        window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(whatsappMessage)}`, '_blank');
      }
    } catch (err) {
      toast.error(err.message, { id: tid });
    } finally {
      setTimeout(() => setProcessingWA(prev => ({ ...prev, [order.id]: false })), 2000);
    }
  };

  // ─── HELPERS ──────────────────────────────────────────────────────────────
  const formatCurrency = (amount) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount ?? 0);

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  const getStatusBadge = (status) => {
    const cfg = {
      draft:     { label: 'Menunggu', icon: Clock,        className: 'bg-gray-200 text-[#10182b]' },
      sent:      { label: 'Dikirim',  icon: TruckIcon,    className: 'bg-[#10182b] text-white' },
      completed: { label: 'Selesai',  icon: CheckCircle2, className: 'bg-green-500 text-white' },
    };
    const c = cfg[status] || cfg.draft;
    const Icon = c.icon;
    return <Badge className={`gap-1 ${c.className}`}><Icon className="h-3 w-3" />{c.label}</Badge>;
  };

  const getPaymentStatusBadge = (status) => {
    const cls = 'flex items-center gap-1 px-1.5 py-0.5 text-[12px] whitespace-nowrap';
    switch ((status || '').toLowerCase()) {
      case 'paid':    return <Badge className={`bg-green-500 text-white ${cls}`}><CheckCircle2 className="h-2.5 w-2.5" /> Lunas</Badge>;
      case 'unpaid':
      case 'pending': return <Badge className={`bg-red-500 text-white ${cls}`}><AlertCircle className="h-2.5 w-2.5" /> Pending</Badge>;
      case 'partial': return <Badge className={`bg-yellow-400 text-black ${cls}`}><AlertCircle className="h-2.5 w-2.5" /> Sebagian</Badge>;
      default:        return <Badge className={`bg-gray-200 text-[#10182b] capitalize ${cls}`}>{status || 'unknown'}</Badge>;
    }
  };

  // ─── PAGINATION HELPER ────────────────────────────────────────────────────
  const PaginationBar = ({ currentPage, totalCount, onPageChange }) => {
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-between px-2 py-4 border-t mt-4">
        <p className="text-xs text-slate-500">
          Halaman <span className="font-semibold text-[#10182b]">{currentPage}</span> dari{' '}
          <span className="font-semibold text-[#10182b]">{totalPages}</span>
          <span className="ml-2 text-slate-400">({totalCount} total)</span>
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline" size="sm"
            className="h-8 px-3 text-xs"
            disabled={currentPage <= 1 || loading}
            onClick={() => onPageChange(p => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Sebelumnya
          </Button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let page;
            if (totalPages <= 5)           page = i + 1;
            else if (currentPage <= 3)     page = i + 1;
            else if (currentPage >= totalPages - 2) page = totalPages - 4 + i;
            else                           page = currentPage - 2 + i;
            return (
              <Button
                key={page} variant={currentPage === page ? 'default' : 'outline'}
                size="sm" className={`h-8 w-8 p-0 text-xs ${currentPage === page ? 'bg-[#10182b] text-white' : ''}`}
                disabled={loading} onClick={() => onPageChange(page)}
              >{page}</Button>
            );
          })}
          <Button
            variant="outline" size="sm"
            className="h-8 px-3 text-xs"
            disabled={currentPage >= totalPages || loading}
            onClick={() => onPageChange(p => Math.min(totalPages, p + 1))}
          >
            Berikutnya <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </div>
    );
  };

  // ─── TASK CARD ────────────────────────────────────────────────────────────
  const TaskCard = ({ task, isCompleted = false }) => {
    const isCompletedStatus = task.status === 'completed';
    const editPath  = isCompletedStatus ? `/complete-delivery/${task.id}` : `/orders/edit/${task.id}`;
    const amICourier = task.order_couriers?.some(oc => oc.courier_id === currentUserId);
    const isPaid     = task.remaining_due <= 0.0001;
    const cardId     = `card-${task.id}`;

    return (
      <Card
        id={cardId}
        className={`border-2 shadow-lg transition-all ${isCompleted ? 'opacity-75' : 'cursor-pointer hover:border-[#10182b]'} border-gray-200 hover:shadow-xl`}
        onClick={() => {
          navigate(location.pathname + `#${cardId}`);
          navigate(`/orders/${task.id}#${cardId}`);
        }}
      >
        <CardHeader className="p-4 pb-3 relative">
          <div className="flex justify-between items-start gap-2">
            <div className="space-y-1">
              <CardTitle className="text-lg flex items-center gap-2 text-[#10182b] font-bold">
                <Package className="h-5 w-5 text-[#10182b]" />
                Pesanan #{String(task.id).slice(0, 8)}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-base text-gray-700 font-semibold">{task.customers?.name}</span>
              </CardDescription>
            </div>
            <div className="flex gap-1 absolute top-3 right-3" onClick={e => e.stopPropagation()}>
              {!isPaid && (
                <Button variant="ghost" size="icon" onClick={() => navigate(editPath)} disabled={loading} title="Edit Pesanan" className="h-8 w-8">
                  <Pencil className="h-4 w-4 text-blue-500" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(task.id)} disabled={loading} title="Hapus Pesanan" className="h-8 w-8 text-red-500 hover:text-white hover:bg-red-500">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-4 pt-0">
          <ImageProof orderId={task.id} status={task.status} proofUrl={task.proof_of_delivery_url} />

          <Separator />

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 mb-2">
              {getStatusBadge(task.status)}
              {getPaymentStatusBadge(task.payment_status)}
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-sm text-muted-foreground line-clamp-2" title={task.customers?.address}>
                {task.customers?.address || 'Alamat tidak tersedia'}
              </p>
            </div>
            {task.customers?.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium text-gray-700">{task.customers?.phone}</p>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Tanggal pesan: {formatDate(task.planned_date)}</p>
            </div>
          </div>

          {task.notes && (
            <div className="space-y-1 mt-4">
              <p className="text-sm font-medium flex items-center gap-2 text-[#10182b]">
                <Info className="h-4 w-4 text-yellow-600" /> Catatan Petugas
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-gray-700 italic">{task.notes}</p>
              </div>
            </div>
          )}

          <Separator className="my-4" />

          <div className="flex items-center justify-between">
            <span className="text-base font-bold flex items-center gap-1 text-[#10182b]">
              <Banknote className="h-5 w-5" /> Total
            </span>
            <div className="text-right">
              <span className="font-bold text-xl text-[#10182b]">{formatCurrency(task.total)}</span>
              {task.remaining_due > 0.0001 && (
                <p className="text-sm font-semibold text-red-600 mt-0.5">(Sisa: {formatCurrency(task.remaining_due)})</p>
              )}
            </div>
          </div>

          <div className="pt-4 flex flex-col gap-3 border-t mt-4">
            <div className="grid grid-cols-2 gap-3">
              {task.status === 'draft' && (
                <Button onClick={e => { e.stopPropagation(); updateOrderStatus(task, 'sent'); }} disabled={loading} className="w-full h-10 bg-[#10182b] text-white hover:bg-[#20283b] text-sm font-semibold">
                  <TruckIcon className="mr-2 h-4 w-4" /> Kirim
                </Button>
              )}
              {task.status === 'sent' && (
                <Button onClick={e => { e.stopPropagation(); navigate(`/complete-delivery/${task.id}`); }} disabled={loading} className="w-full h-10 bg-green-600 text-white hover:bg-green-700 text-sm font-semibold">
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Selesaikan
                </Button>
              )}
              {task.remaining_due > 0.0001 && (
                <Button onClick={e => { e.stopPropagation(); setSelectedOrderForPayment(task); setIsPaymentModalOpen(true); }} disabled={loading} className="w-full h-10 bg-yellow-600 text-white hover:bg-yellow-700 text-sm font-semibold">
                  <Banknote className="mr-2 h-4 w-4" /> Bayar
                </Button>
              )}
              {task.status === 'completed' && (
                <>
                  <Button onClick={e => { e.stopPropagation(); handleGeneratePrintInvoice(task); }} disabled={isSendingInvoice} variant="outline" className="w-full h-10 text-sm">
                    {isSendingInvoice ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ReceiptText className="mr-2 h-4 w-4" />} Cetak
                  </Button>
                  <Button
                    onClick={e => { e.stopPropagation(); handleShareInvoice(task); }}
                    disabled={isSendingInvoice || !task.invoice_public_link || processingWA[task.id]}
                    className={`w-full h-10 text-sm font-semibold text-white ${processingWA[task.id] ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}
                  >
                    {processingWA[task.id]
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Diproses</>
                      : <><MessageSquareText className="mr-2 h-4 w-4" /> Kirim WA</>}
                  </Button>
                </>
              )}
              {!amICourier && task.status !== 'completed' && (
                <Button onClick={e => { e.stopPropagation(); handleAssignSelf(task.id); }} variant="outline" className="w-full border-blue-500 text-blue-600 hover:bg-blue-50">
                  <Plus className="h-4 w-4 mr-2" /> Ambil Tugas
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  const activeTasks  = tasks.active  || [];
  const historyTasks = tasks.history || [];

  return (
    <div className="container mx-auto md:p-8 max-w-7xl space-y-8">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-[#10182b] flex items-center gap-3">
          {isAllOrdersMode ? <ListOrdered className="h-8 w-8" /> : <TruckIcon className="h-8 w-8" />}
          {dashboardTitle}
        </h1>
        <div className="flex flex-col gap-3 w-full sm:w-auto sm:flex-row">
          <Button onClick={() => navigate('/quick-order')} className="w-full sm:w-auto bg-yellow-600 text-white hover:bg-yellow-700 font-semibold">
            <Zap className="h-4 w-4 mr-2" /> Pesan Langsung
          </Button>
          <Button onClick={() => navigate('/orders/add')} className="w-full sm:w-auto bg-[#10182b] text-white hover:bg-[#20283b] font-semibold">
            <Plus className="h-4 w-4 mr-2" /> Tambah Pesanan
          </Button>
          <Button onClick={() => setIsTemplateModalOpen(true)} variant="outline" className="w-full sm:w-auto">
            <Settings className="h-4 w-4 mr-2" /> Atur Pesan WA
          </Button>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 border rounded-lg shadow-sm bg-white">
        {/* Search dengan debounce + tombol clear */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
          <Input
            type="text"
            placeholder="Cari nama pelanggan / nomor invoice"
            value={searchQuery}
            onChange={handleSearchChange}
            className="pl-10 pr-8 h-10 w-full"
          />
          {searchQuery && (
            <button onClick={clearSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Select value={deliveryFilter} onValueChange={(v) => { setDeliveryFilter(v); setPageActive(1); setPageHistory(1); }}>
          <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="Status Pengiriman" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Pengiriman</SelectItem>
            <SelectItem value="draft">Menunggu (Draft)</SelectItem>
            <SelectItem value="sent">Dikirim (Sent)</SelectItem>
            <SelectItem value="completed">Selesai (Completed)</SelectItem>
          </SelectContent>
        </Select>

        <Select value={paymentFilter} onValueChange={(v) => { setPaymentFilter(v); setPageActive(1); setPageHistory(1); }}>
          <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="Status Pembayaran" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Pembayaran</SelectItem>
            <SelectItem value="paid">Lunas</SelectItem>
            <SelectItem value="partial">Sebagian</SelectItem>
            <SelectItem value="unpaid">Belum Bayar</SelectItem>
          </SelectContent>
        </Select>

        <Select value={courierFilter} onValueChange={(v) => { setCourierFilter(v); setPageActive(1); setPageHistory(1); }}>
          <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="Filter Petugas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Petugas</SelectItem>
            {couriers.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* TABS */}
      {loading ? (
        <Card className="p-12 border-0 shadow-sm bg-white">
          <div className="flex flex-col justify-center items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-[#10182b]" />
            <p className="text-lg text-muted-foreground font-medium">Memuat data pesanan...</p>
          </div>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:w-[400px] bg-gray-100 p-1 rounded-xl text-[#10182b]">
            <TabsTrigger value="active" className="gap-2 p-2 data-[state=active]:bg-[#10182b] data-[state=active]:text-white data-[state=active]:shadow-lg rounded-lg font-semibold transition-all">
              <Clock className="h-4 w-4" /> Tugas Aktif ({countActive})
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 p-2 data-[state=active]:bg-[#10182b] data-[state=active]:text-white data-[state=active]:shadow-lg rounded-lg font-semibold transition-all">
              <History className="h-4 w-4" /> Riwayat ({countHistory})
            </TabsTrigger>
          </TabsList>

          {/* TAB: TUGAS AKTIF */}
          <TabsContent value="active" className="space-y-4">
            {activeTasks.length > 0 ? (
              <>
                <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {activeTasks.map(task => <TaskCard key={task.id} task={task} />)}
                </div>
                <PaginationBar currentPage={pageActive} totalCount={countActive} onPageChange={setPageActive} />
              </>
            ) : (
              <Card className="p-12 border-0 shadow-sm bg-white">
                <div className="flex flex-col items-center justify-center text-center space-y-3">
                  <Package className="h-12 w-12 text-[#10182b]" />
                  <h3 className="text-lg font-semibold text-[#10182b]">Tidak Ada Pesanan Aktif</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Semua pesanan yang difilter saat ini telah selesai atau belum dibuat.
                  </p>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* TAB: RIWAYAT */}
          <TabsContent value="history" className="space-y-4">
            {historyTasks.length > 0 ? (
              <>
                <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {historyTasks.map(task => <TaskCard key={task.id} task={task} isCompleted />)}
                </div>
                <PaginationBar currentPage={pageHistory} totalCount={countHistory} onPageChange={setPageHistory} />
              </>
            ) : (
              <Card className="p-12 border-0 shadow-sm bg-white">
                <div className="flex flex-col items-center justify-center text-center space-y-3">
                  <History className="h-12 w-12 text-[#10182b]" />
                  <h3 className="text-lg font-semibold text-[#10182b]">Belum Ada Riwayat</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Riwayat pesanan yang telah diselesaikan akan muncul di sini.
                  </p>
                </div>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      <AddPaymentModal
        isOpen={isPaymentModalOpen}
        onOpenChange={setIsPaymentModalOpen}
        order={selectedOrderForPayment}
        onPaymentAdded={fetchData}
      />
      <WhatsappTemplateSettingsModal
        isOpen={isTemplateModalOpen}
        onOpenChange={(open) => { setIsTemplateModalOpen(open); if (!open) fetchActiveTemplates(); }}
      />
    </div>
  );
};

export default UserDashboard;