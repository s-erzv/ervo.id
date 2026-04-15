import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'react-hot-toast';
import { 
  Loader2, Download, Plus, ListOrdered, Filter, TruckIcon, 
  CheckCircle2, AlertCircle, Zap, ChevronsUpDown, Clock, X, 
  MessageSquareText, MoreVertical, Printer, ExternalLink, 
  Pencil, Trash2, CreditCard, Settings,
  FileText, Search, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import CryptoJS from 'crypto-js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';
import { useNavigate, useSearchParams } from 'react-router-dom'; 
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import AddPaymentModal from '@/components/AddPaymentModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Separator } from '@/components/ui/separator';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// --- IMPORT MODAL BARU ---
import WhatsappTemplateSettingsModal from '@/components/WhatsappTemplateSettingsModal';

const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'fallback-key-proyek-rahasia';

// ─── KONSTANTA PAGINATION ────────────────────────────────────────────────────
const PAGE_SIZE = 20; // Jumlah baris per halaman

const getStatusBadge = (status) => {
  switch (status) {
    case 'draft':
      return <Badge className="bg-gray-200 text-[#011e4b] flex items-center gap-1 h-4 px-1.5 py-0.5 text-[10px] whitespace-nowrap"><Loader2 className="h-2.5 w-2.5 animate-spin" /> Menunggu</Badge>;
    case 'sent':
      return <Badge className="bg-[#011e4b] text-white flex items-center gap-1 h-4 px-1.5 py-0.5 text-[10px] whitespace-nowrap"><TruckIcon className="h-2.5 w-2.5" /> Dalam Pengiriman</Badge>;
    case 'completed':
      return <Badge className="bg-green-500 text-white flex items-center gap-1 h-4 px-1.5 py-0.5 text-[10px] whitespace-nowrap"><CheckCircle2 className="h-2.5 w-2.5" /> Selesai</Badge>;
    default:
      return <Badge className="bg-gray-200 text-[#011e4b] capitalize h-4 px-1.5 py-0.5 text-[10px] whitespace-nowrap">{status}</Badge>;
  }
};

const getPaymentStatusBadge = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'paid':
      return <Badge className="bg-green-500 text-white flex items-center gap-1 h-4 px-1.5 py-0.5 text-[10px] whitespace-nowrap"><CheckCircle2 className="h-2.5 w-2.5" /> Lunas</Badge>;
    case 'unpaid':
    case 'pending':
      return <Badge className="bg-red-500 text-white flex items-center gap-1 h-4 px-1.5 py-0.5 text-[10px] whitespace-nowrap"><AlertCircle className="h-2.5 w-2.5" /> Pending</Badge>;
    case 'partial':
      return <Badge className="bg-yellow-400 text-black flex items-center gap-1 h-4 px-1.5 py-0.5 text-[10px] whitespace-nowrap"><AlertCircle className="h-2.5 w-2.5" /> Sebagian</Badge>;
    default:
      return <Badge className="bg-gray-200 text-[#011e4b] capitalize h-4 px-1.5 py-0.5 text-[10px] whitespace-nowrap">{status || 'unknown'}</Badge>;
  }
};

const OrdersPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { userRole, companyId, session, companyName, userId } = useAuth();
  
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // ─── PAGINATION STATE ──────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // ─── SEARCH STATE + DEBOUNCE REF ───────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery);
  const debounceTimer = useRef(null);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(val);
      setCurrentPage(1); // Reset ke halaman 1 saat search berubah
    }, 400);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setCurrentPage(1);
  };

  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState(searchParams.get('payment_status') || 'all');
  const [courierFilter, setCourierFilter] = useState(searchParams.get('courier') || 'all');
  
  const [customerFilter, setCustomerFilter] = useState(
    searchParams.get('customer') ? searchParams.get('customer').split(',') : []
  );
  
  const [plannedDateStart, setPlannedDateStart] = useState(searchParams.get('planned_start') || '');
  const [plannedDateEnd, setPlannedDateEnd] = useState(searchParams.get('planned_end') || '');
  
  const [deliveryDateStart, setDeliveryDateStart] = useState(searchParams.get('delivery_start') || '');
  const [deliveryDateEnd, setDeliveryDateEnd] = useState(searchParams.get('delivery_end') || '');

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isCustomerFilterOpen, setIsCustomerFilterOpen] = useState(false);
  const [isCourierFilterOpen, setIsCourierFilterOpen] = useState(false);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState(null);

  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [activeTemplates, setActiveTemplates] = useState({});
  const [processingWA, setProcessingWA] = useState({});

  const sendViaFonnte = async (targetPhone, message) => {
    try {
      const { data: companyData, error: coErr } = await supabase
        .from('companies')
        .select('fonnte_token')
        .eq('id', companyId)
        .single();

      if (coErr || !companyData?.fonnte_token) return false;

      const encryptedToken = companyData.fonnte_token;
      let finalToken = null;
      try {
        const bytes = CryptoJS.AES.decrypt(encryptedToken, ENCRYPTION_KEY);
        const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
        finalToken = decryptedText || encryptedToken;
      } catch (e) {
        finalToken = encryptedToken;
      }

      if (!finalToken || finalToken.trim() === "") return false;

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

  const calculateGrossMargin = (grossProfit, order) => {
      const totalRevenueBeforeDiscount = calculateTotal(order.order_items);
      const invoice = Array.isArray(order.invoices) ? order.invoices[0] : order.invoices;
      const totalDiscount = Number(invoice?.total_discount) || 0;
      const totalNetRevenue = totalRevenueBeforeDiscount - totalDiscount;
      if (!totalNetRevenue || totalNetRevenue <= 0) return 0;
      return (grossProfit / totalNetRevenue) * 100;
  };

  const handleExportToExcel = () => {
    if (orders.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }

    const dataToExport = orders.map(order => {
      const grossProfit = calculateProfit(order);
      const totalRevenueBeforeDiscount = calculateTotal(order.order_items);
      const invoice = Array.isArray(order.invoices) ? order.invoices[0] : order.invoices;
      const totalDiscount = Number(invoice?.total_discount) || 0;
      const totalNetRevenue = totalRevenueBeforeDiscount - totalDiscount;
      const grossMargin = calculateGrossMargin(grossProfit, totalNetRevenue);

      const row = {
        "ID Pesanan": order.id,
        "Nomor Invoice": order.invoice_number,
        "Nama Pelanggan": order.customers?.name || '-',
        "Alamat": order.customers?.address || '-',
        "Telepon": order.customers?.phone || '-',
        "Tanggal Order": order.planned_date,
        "Status Pengiriman": order.status,
        "Status Pembayaran": order.payment_status,
        "Total Harga": order.grand_total || totalRevenueBeforeDiscount,
      };

      if (userRole === 'admin') {
        row["Gross Profit"] = grossProfit;
        row["Gross Margin (%)"] = grossMargin.toFixed(2) + "%";
        row["Komisi Dropship"] = order.dropshipper_commission || 0;
        row["Nama Dropshipper"] = order.dropshipper?.full_name || '-';
      }

      row["Petugas"] = order.order_couriers?.map(c => c.courier?.full_name).join(', ') || '-';
      row["Daftar Produk"] = order.order_items?.map(item => 
        `${item.products?.name} (${item.qty}x)`
      ).join('; ') || '-';

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Daftar Pesanan");
    
    const columnWidths = [
      { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 30 }, { wch: 15 },
      { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    ];
    if (userRole === 'admin') {
      columnWidths.push({ wch: 15 });
      columnWidths.push({ wch: 10 });
    }
    columnWidths.push({ wch: 20 });
    columnWidths.push({ wch: 50 });
    worksheet["!cols"] = columnWidths;

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/octet-stream' });
    const fileName = `Laporan_Pesanan_${new Date().toISOString().split('T')[0]}.xlsx`;
    saveAs(data, fileName);
    toast.success('Data berhasil diekspor ke Excel!');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const calculateTotal = (items) => items?.reduce((total, item) => total + (item.qty * item.price), 0) || 0;

  const updateOrderStatus = async (order, newStatus) => {
    setLoading(true);
    try {
      if (newStatus === 'sent') {
        const soldItems = (order.order_items || []).filter((item) => item.item_type === 'beli');
        
        const { data: existingMoves } = await supabase
          .from('stock_movements')
          .select('id')
          .eq('order_id', order.id)
          .eq('type', 'keluar');

        if (!existingMoves || existingMoves.length === 0) {
          for (const item of soldItems) {
            const { data: productData } = await supabase
                .from('products')
                .select('stock')
                .eq('id', item.product_id)
                .single();

            if (productData) {
              const newStock = productData.stock - item.qty;
              await supabase.from('products').update({ stock: newStock }).eq('id', item.product_id);
              await supabase.from('stock_movements').insert({
                  type: 'keluar',
                  qty: item.qty,
                  notes: `Produk keluar (Kirim Barang) #${order.invoice_number}`,
                  order_id: order.id,
                  user_id: userId,
                  product_id: item.product_id,
                  company_id: companyId,
              });
            }
          }
        }
      }

      const { error } = await supabase
        .from('orders')
        .update({ 
          status: newStatus,
          updated_by: userId
        })
        .eq('id', order.id);

      if (error) throw error;
      toast.success('Barang berhasil dikirim!');
      fetchOrdersAndCustomers();
    } catch (e) {
      toast.error('Gagal memproses pengiriman: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const updateUrl = useCallback((newFilters) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value && value !== 'all' && value !== '' && (Array.isArray(value) ? value.length > 0 : true)) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);

  // ─── FUNGSI FETCH UTAMA (DIOPTIMASI) ──────────────────────────────────────
  const fetchOrdersAndCustomers = useCallback(async (overrideFilters = {}) => {
    setLoading(true);
    if (!companyId) return;

    const activeFilters = {
      status:             overrideFilters.status             ?? statusFilter,
      paymentStatus:      overrideFilters.paymentStatus      ?? paymentStatusFilter,
      courier:            overrideFilters.courier            ?? courierFilter,
      customer:           overrideFilters.customer           ?? customerFilter,
      plannedDateStart:   overrideFilters.plannedDateStart   ?? plannedDateStart,
      plannedDateEnd:     overrideFilters.plannedDateEnd     ?? plannedDateEnd,
      deliveryDateStart:  overrideFilters.deliveryDateStart  ?? deliveryDateStart,
      deliveryDateEnd:    overrideFilters.deliveryDateEnd    ?? deliveryDateEnd,
      search:             overrideFilters.search             ?? debouncedSearch,
      page:               overrideFilters.page               ?? currentPage,
    };

    const from = (activeFilters.page - 1) * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;

    let query = supabase
      .from('orders')
      .select(`
        id,
        company_id, 
        created_at,
        invoice_number,
        status,
        payment_status,
        planned_date,
        delivered_at,
        notes,
        grand_total,
        transport_cost,
        dropshipper_id,
        dropshipper_commission,
        updated_by,
        customers!inner (id, name, customer_status, phone, address),
        order_couriers (
          courier:courier_id (id, full_name)
        ),
        order_items (
          id, qty, price, item_type, product_id, purchase_price,
          products (id, name, is_returnable, empty_bottle_price, purchase_price)
        ),
        order_galon_items (
          id, purchased_empty_qty,
          products (id, name, empty_bottle_price)
        ),
        payments (id, amount),
        invoices (id, total_discount, public_link),
        dropshipper:dropshipper_id (id, full_name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .eq('company_id', companyId)
      .range(from, to);

    if (userRole === 'dropship') query = query.eq('dropshipper_id', userId);
    if (activeFilters.status && activeFilters.status !== 'all') query = query.eq('status', activeFilters.status);
    if (activeFilters.paymentStatus && activeFilters.paymentStatus !== 'all') query = query.eq('payment_status', activeFilters.paymentStatus);

    const customerIds = Array.isArray(activeFilters.customer)
      ? activeFilters.customer
      : activeFilters.customer?.split(',').filter(Boolean) || [];
    if (customerIds.length > 0) query = query.in('customer_id', customerIds);

    if (activeFilters.courier && activeFilters.courier !== 'all') {
      query = query.eq('order_couriers.courier_id', activeFilters.courier);
    }

    if (activeFilters.plannedDateStart) query = query.gte('planned_date', activeFilters.plannedDateStart);
    if (activeFilters.plannedDateEnd)   query = query.lte('planned_date', activeFilters.plannedDateEnd);
    if (activeFilters.deliveryDateStart) query = query.gte('delivered_at', activeFilters.deliveryDateStart);
    if (activeFilters.deliveryDateEnd) {
      const endDay = new Date(activeFilters.deliveryDateEnd);
      endDay.setDate(endDay.getDate() + 1);
      query = query.lte('delivered_at', endDay.toISOString().split('T')[0]);
    }

    if (activeFilters.search && activeFilters.search.trim() !== '') {
      const searchVal = activeFilters.search.trim();
      const term = `%${searchVal}%`;
      
      if (/^\d+$/.test(searchVal)) {
        // If numeric, search by invoice number primarily
        query = query.eq('invoice_number', searchVal);
      } else {
        // If not numeric, search by customer name
        // We need to use !inner in select to filter by joined table columns
        query = query.ilike('customers.name', term);
      }
    }

    const { data: ordersData, error: ordersError, count } = await query;

    const customerQuery = supabase.from('customers').select('id, name').eq('company_id', companyId);
    if (userRole === 'dropship') customerQuery.eq('dropshipper_id', userId);

    const { data: customersData } = await customerQuery;
    const { data: couriersData } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'user')
      .eq('company_id', companyId);

    if (ordersError) {
      toast.error('Gagal mengambil data pesanan.');
      console.error(ordersError);
    } else {
      setOrders(ordersData || []);
      setTotalCount(count || 0);
      setCustomers(customersData || []);
      setCouriers(couriersData || []);
    }
    setLoading(false);
  }, [
    companyId, statusFilter, paymentStatusFilter, courierFilter,
    customerFilter, plannedDateStart, plannedDateEnd,
    deliveryDateStart, deliveryDateEnd, userRole, userId,
    debouncedSearch, currentPage
  ]);

  useEffect(() => {
    const urlFilters = {
      status:            searchParams.get('status')        || 'all',
      paymentStatus:     searchParams.get('payment_status')|| 'all',
      courier:           searchParams.get('courier')       || 'all',
      customer:          searchParams.get('customer')      || '',
      plannedDateStart:  searchParams.get('planned_start') || '',
      plannedDateEnd:    searchParams.get('planned_end')   || '',
      deliveryDateStart: searchParams.get('delivery_start')|| '',
      deliveryDateEnd:   searchParams.get('delivery_end')  || '',
      search:            debouncedSearch,
      page:              currentPage,
    };

    if (companyId) {
      fetchOrdersAndCustomers(urlFilters);
      fetchActiveTemplates();
    }
  }, [searchParams, companyId, debouncedSearch, currentPage]);

  const fetchActiveTemplates = async () => {
    const { data } = await supabase
      .from('whatsapp_templates')
      .select('template_name, template_text')
      .eq('company_id', companyId);
    if (data) {
      const map = {};
      data.forEach(t => { map[t.template_name] = t.template_text; });
      setActiveTemplates(map);
    }
  };

  const handleGeneratePrintInvoice = async (order) => {
    if (!order || !session) return;
    setIsActionLoading(true);
    const tid = toast.loading('Membuat invoice PDF...');

    try {
      const itemsTotal = calculateTotal(order.order_items);
      const transportCost = Number(order.transport_cost) || 0;
      const invoice = Array.isArray(order.invoices) ? order.invoices[0] : order.invoices;
      const discount = Number(invoice?.total_discount) || 0;
      const totalPurchaseCost = order.order_galon_items?.reduce((sum, item) => 
        sum + (Number(item.purchased_empty_qty) * Number(item.products?.empty_bottle_price || 0)), 0) || 0;
      
      const calculatedGrandTotal = order.grand_total > 0
        ? order.grand_total
        : (itemsTotal - discount + transportCost + totalPurchaseCost);
      const totalPaid = order.payments?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 0;

      const payload = {
        order_id: order.id,
        orderData: {
          ...order,
          company_id: order.company_id || companyId, 
          created_at: order.created_at || new Date().toISOString(), 
          payments: order.payments,
          grand_total: calculatedGrandTotal,
          remaining_due: Math.max(0, calculatedGrandTotal - totalPaid),
          order_galon_items: order.order_galon_items,
          total_discount: discount,
        }
      };

      const { data, error } = await supabase.functions.invoke('create-invoice-pdf', {
        body: payload,
      });

      if (error) throw error;
      const { pdfUrl } = data;
      window.open(pdfUrl, '_blank');
      toast.success('Invoice berhasil dibuka!', { id: tid });
      fetchOrdersAndCustomers();
    } catch (err) {
      toast.error(err.message, { id: tid });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleShareInvoiceWA = async (order) => {
    const invoice = Array.isArray(order.invoices) ? order.invoices[0] : order.invoices;
    if (!invoice?.public_link) {
      toast.error('Cetak invoice terlebih dahulu untuk mendapatkan link.');
      return;
    }
    if (processingWA[order.id]) return;

    setProcessingWA(prev => ({ ...prev, [order.id]: true }));
    const tid = toast.loading('Mengirim invoice via WA...');

    try {
      const itemsTotal = calculateTotal(order.order_items);
      const transportCost = Number(order.transport_cost) || 0;
      const discount = Number(invoice?.total_discount) || 0;
      const calculatedGrandTotal = order.grand_total > 0
        ? order.grand_total
        : (itemsTotal - discount + transportCost);
      
      const totalPaid = order.payments?.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) || 0;
      const sisaTagihan = Math.max(0, calculatedGrandTotal - totalPaid);
      const orderDate = order.planned_date
        ? new Date(order.planned_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        : '-';

      let paymentMethodDisplay = 'Transfer Bank / Tunai';
      const { data: methods } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true);
        
      const transferMethod = methods?.find(m => m.type === 'transfer') || methods?.[0];
      if (transferMethod) {
        paymentMethodDisplay = `Transfer ${transferMethod.method_name} ${transferMethod.account_number} a.n ${transferMethod.account_name || ''}`;
      }

      const productsListWithPrice = (order.order_items || [])
        .map(item => `* ${item.products?.name} (${item.qty} pcs) x ${formatCurrency(item.price)}`)
        .join('\n');

      const template = activeTemplates['payment_reminder'] || "";
      if (!template) throw new Error("Template tagihan belum diatur.");

      const finalMessage = template
        .replace(/{{customerName}}/g, order.customers?.name || 'Bapak/Ibu')
        .replace(/{{orderDate}}/g, orderDate)
        .replace(/{{invoiceNo}}/g, order.invoice_number)
        .replace(/{{totalHarga}}/g, formatCurrency(calculatedGrandTotal))
        .replace(/{{sisaTagihan}}/g, formatCurrency(sisaTagihan))
        .replace(/{{productsListWithPrice}}/g, productsListWithPrice)
        .replace(/{{productsList}}/g, productsListWithPrice)
        .replace(/{{invoiceLink}}/g, invoice.public_link)
        .replace(/{{paymentMethod}}/g, paymentMethodDisplay)
        .replace(/{{companyName}}/g, companyName);

      const phone = order.customers?.phone;
      if (!phone) throw new Error("Nomor telepon pelanggan tidak ditemukan.");

      const isAutoSent = await sendViaFonnte(phone, finalMessage);

      if (isAutoSent) {
        toast.success('Invoice Terkirim!', { id: tid });
      } else {
        toast.dismiss(tid);
        window.open(`https://api.whatsapp.com/send?phone=${phone.replace(/[^\d]/g, '')}&text=${encodeURIComponent(finalMessage)}`, '_blank');
      }
    } catch (err) {
      toast.error('Gagal: ' + err.message, { id: tid });
    } finally {
      setTimeout(() => setProcessingWA(prev => ({ ...prev, [order.id]: false })), 3000);
    }
  };

  const handleConfirmOrderWA = async (order) => {
    if (processingWA[order.id]) return;
    setProcessingWA(prev => ({ ...prev, [order.id]: true }));
    const tid = toast.loading('Mengirim konfirmasi via WA...');

    try {
      const customerName = order.customers?.name || 'Bapak/Ibu';
      const productsListWithPrice = (order.order_items || [])
        .map(item => `* ${item.products?.name} (${item.qty} pcs) x ${formatCurrency(item.price)}`)
        .join('\n');

      const totalHarga = formatCurrency(order.grand_total || calculateTotal(order.order_items));
      const template = activeTemplates['order_confirmation'] || "";
      if (!template) throw new Error("Template konfirmasi belum diatur.");

      const finalMessage = template
        .replace(/{{customerName}}/g, customerName)
        .replace(/{{orderDate}}/g, order.planned_date ? new Date(order.planned_date).toLocaleDateString('id-ID') : '-')
        .replace(/{{productsListWithPrice}}/g, productsListWithPrice)
        .replace(/{{productsList}}/g, productsListWithPrice)
        .replace(/{{totalHarga}}/g, totalHarga)
        .replace(/{{companyName}}/g, companyName);

      const phone = order.customers?.phone;
      const isAutoSent = await sendViaFonnte(phone, finalMessage);

      if (isAutoSent) {
        toast.success('Konfirmasi Terkirim!', { id: tid });
      } else {
        toast.dismiss(tid);
        window.open(`https://api.whatsapp.com/send?phone=${phone.replace(/[^\d]/g, '')}&text=${encodeURIComponent(finalMessage)}`, '_blank');
      }
    } catch (err) {
      toast.error('Gagal: ' + err.message, { id: tid });
    } finally {
      setTimeout(() => setProcessingWA(prev => ({ ...prev, [order.id]: false })), 3000);
    }
  };

  const calculateProfit = (order) => {
    if (!order?.order_items) return 0;
    const profitBeforeDiscount = order.order_items.reduce((profit, item) => {
      const cost = item.products?.purchase_price || 0;
      const revenue = item.price || 0;
      return cost > 0 ? profit + ((revenue - cost) * item.qty) : profit;
    }, 0);
    const invoice = Array.isArray(order.invoices) ? order.invoices[0] : order.invoices;
    const totalDiscount = Number(invoice?.total_discount) || 0;
    return profitBeforeDiscount - totalDiscount;
  };

  const handleUndoStatus = async (order) => {
    if (!window.confirm('Batalkan pengiriman? Stok akan dikembalikan dan status kembali ke Draft.')) return;
    
    setLoading(true);
    try {
      const { data: movements, error: moveError } = await supabase
        .from('stock_movements')
        .select('*')
        .eq('order_id', order.id)
        .eq('type', 'keluar');

      if (moveError) throw moveError;

      if (movements && movements.length > 0) {
        for (const move of movements) {
          const { data: product } = await supabase
            .from('products')
            .select('stock')
            .eq('id', move.product_id)
            .single();

          if (product) {
            await supabase
              .from('products')
              .update({ stock: product.stock + move.qty })
              .eq('id', move.product_id);
          }
        }

        await supabase
          .from('stock_movements')
          .delete()
          .eq('order_id', order.id)
          .eq('type', 'keluar');
      }

      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          status: 'draft',
          delivered_at: null
        })
        .eq('id', order.id);

      if (updateError) throw updateError;

      toast.success('Pengiriman dibatalkan, stok telah dikembalikan.');
      fetchOrdersAndCustomers();
    } catch (e) {
      toast.error('Gagal undo status: ' + e.message);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOrder = async (orderId, commission, dsName) => {
    const confirmMsg = commission > 0 
      ? `Hapus pesanan ini? Komisi ${dsName} sebesar ${formatCurrency(commission)} akan ditarik balik dari saldonya.`
      : "Hapus pesanan ini?";

    if (!window.confirm(confirmMsg)) return;

    try {
      const { data, error } = await supabase.functions.invoke('delete-order', {
        method: 'DELETE',
        body: { orderId, companyId },
      });
      
      if (error) throw error;

      toast.success('Pesanan dihapus & saldo dropshipper telah disesuaikan.');
      fetchOrdersAndCustomers();
    } catch (error) {
      toast.error('Gagal menghapus: ' + error.message);
    }
  };

  const applyFilters = () => {
    setCurrentPage(1); // Reset ke halaman 1 saat filter berubah
    updateUrl({
      status:           statusFilter,
      payment_status:   paymentStatusFilter,
      courier:          courierFilter,
      customer:         customerFilter.join(','),
      planned_start:    plannedDateStart,
      planned_end:      plannedDateEnd,
      delivery_start:   deliveryDateStart,
      delivery_end:     deliveryDateEnd,
    });
    setIsFilterModalOpen(false);
  };

  const resetFilters = () => {
    setSearchParams({});
    setStatusFilter('all');
    setPaymentStatusFilter('all');
    setCourierFilter('all');
    setCustomerFilter([]);
    setPlannedDateStart('');
    setPlannedDateEnd('');
    setDeliveryDateStart('');
    setDeliveryDateEnd('');
    setSearchQuery('');
    setDebouncedSearch('');
    setCurrentPage(1);
    setIsFilterModalOpen(false);
  };

  const handleExportToPdf = async () => {
    setIsExportingPdf(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-orders-report', {
        body: { orders, filterInfo: `Status: ${statusFilter}`, companyName: "Manajemen Pesanan" }
      });
      if (error) throw error;
      const blob = new Blob([Uint8Array.from(atob(data.pdfBase64), c => c.charCodeAt(0))], { type: 'application/pdf' });
      window.open(URL.createObjectURL(blob), '_blank');
    } catch (error) {
      toast.error('Gagal export PDF');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // ─── INDIKATOR FILTER AKTIF ────────────────────────────────────────────────
  const activeFilterCount = [
    statusFilter !== 'all',
    paymentStatusFilter !== 'all',
    courierFilter !== 'all',
    customerFilter.length > 0,
    !!plannedDateStart || !!plannedDateEnd,
    !!deliveryDateStart || !!deliveryDateEnd,
  ].filter(Boolean).length;

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-6">
      
      {/* ── HEADER RESPONSIVE ── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4 w-full">
          {/* SISI KIRI: JUDUL & INFORMASI */}
          <div className="space-y-1 w-full lg:w-auto">
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#011e4b] flex items-center gap-3 tracking-tight">
              <div className="p-2 bg-[#011e4b]/5 rounded-xl">
                <ListOrdered className="h-6 w-6 md:h-8 md:w-8 text-[#011e4b]" />
              </div>
              Manajemen Pesanan
            </h1>
            <p className="text-xs md:text-sm text-slate-500 font-medium ml-1">
              Kelola pengiriman, invoice, dan status pembayaran pelanggan.
            </p>
          </div>

          {/* SISI KANAN: ACTIONS */}
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto">
            
            {/* SECONDARY ACTIONS */}
            <div className="flex w-full sm:w-auto gap-2">
              <Button 
                onClick={() => setIsFilterModalOpen(true)} 
                variant="outline" 
                className="flex-1 sm:flex-none h-10 px-2 sm:px-4 border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold shadow-sm relative text-xs sm:text-sm"
              >
                <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 shrink-0" /> 
                <span>Filter</span>
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-[#011e4b] text-white text-[9px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </Button>

              {userRole !== 'dropship' && (
                <Button 
                  onClick={() => setIsTemplateModalOpen(true)} 
                  variant="outline" 
                  className="flex-1 sm:flex-none h-10 px-2 sm:px-4 border-slate-200 hover:bg-slate-50 text-slate-600 shadow-sm text-xs sm:text-sm"
                >
                  <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 shrink-0" /> 
                  <span className="hidden sm:inline">Pesan </span>WA
                </Button>
              )}

              {/* DROPDOWN UNTUK EXPORT */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex-1 sm:flex-none h-10 px-2 sm:px-4 border-slate-200 shadow-sm text-xs sm:text-sm">
                    <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 shrink-0" /> Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleExportToPdf} disabled={isExportingPdf} className="text-red-600 focus:text-red-600">
                    <FileText className="h-4 w-4 mr-2" /> Export PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportToExcel} disabled={isActionLoading} className="text-green-600 focus:text-green-600">
                    <Download className="h-4 w-4 mr-2" /> Export Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* PRIMARY ACTIONS */}
            <div className="flex w-full sm:w-auto gap-2">
              <Button 
                onClick={() => navigate('/quick-order')} 
                className="flex-1 sm:flex-none h-10 px-2 sm:px-4 bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-md shadow-orange-100 transition-all active:scale-95 text-xs sm:text-sm"
              >
                <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 shrink-0" /> 
                <span className="hidden sm:inline">Pesan </span>Langsung
              </Button>
              
              <Button 
                onClick={() => navigate('/orders/add')} 
                className="flex-1 sm:flex-none h-10 px-2 sm:px-4 bg-[#011e4b] hover:bg-[#00376a] text-white font-bold shadow-md shadow-slate-200 transition-all active:scale-95 text-xs sm:text-sm"
              >
                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 shrink-0" /> 
                Tambah <span className="hidden sm:inline">&nbsp;Pesanan</span>
              </Button>
            </div>
          </div>
      </div>

      <Card className="border-0 shadow-sm bg-white">
        <CardHeader className="p-4 md:p-6 border-b">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-lg font-semibold text-[#011e4b]">Daftar Pesanan</CardTitle>
              {/* ── INFO TOTAL DATA ── */}
              {!loading && (
                <p className="text-xs text-slate-400">
                  Menampilkan {orders.length} dari {totalCount.toLocaleString('id-ID')} pesanan
                </p>
              )}
            </div>

            {/* ── SEARCH BAR ─────────────────────────────────────────────── */}
            <div className="relative w-full md:w-80 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                placeholder="Cari invoice atau nama pelanggan..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="pl-9 pr-8 h-10 text-sm border-slate-200 focus-visible:ring-1 focus-visible:ring-[#011e4b] w-full"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="rounded-md overflow-x-auto">
            <Table className="w-full min-w-max">
              <TableHeader className="bg-slate-50">
                <TableRow className="text-xs">
                  <TableHead className="py-3 px-3">No. Invoice</TableHead>
                  <TableHead>Pelanggan</TableHead>
                  <TableHead>Tgl. Input</TableHead>
                  <TableHead>Tgl. Kirim</TableHead>
                  <TableHead>Produk</TableHead>
                  <TableHead>Status Kirim</TableHead>
                  <TableHead>Status Bayar</TableHead>
                  <TableHead>Total Harga</TableHead>
                  {userRole === 'admin' && (
                    <>
                      <TableHead className="text-green-600 py-2 px-2 min-w-[80px]">G. Profit</TableHead>
                      <TableHead className="text-green-600 py-2 px-2 min-w-[60px]">GM (%)</TableHead>
                      <TableHead className="text-blue-600 py-2 px-2 min-w-[100px]">Dropship</TableHead>
                    </>
                  )}
                  <TableHead>Petugas</TableHead>
                  <TableHead className="text-right px-6">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-10">
                      <Loader2 className="mx-auto animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-16 text-slate-400">
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Tidak ada pesanan ditemukan</p>
                      {(debouncedSearch || activeFilterCount > 0) && (
                        <p className="text-xs mt-1">Coba ubah kata kunci atau filter</p>
                      )}
                    </TableCell>
                  </TableRow>
                ) : orders.map((order) => {
                  const isPaid = ['paid', 'lunas'].includes((order.payment_status || '').toLowerCase());
                  const invoice = Array.isArray(order.invoices) ? order.invoices[0] : order.invoices;
                  
                  return (
                    <TableRow
                      key={order.id}
                      className="hover:bg-gray-50 transition-colors text-xs cursor-pointer"
                      onClick={() => navigate(`/orders/${order.id}`)}
                    >
                      <TableCell className="font-medium py-3 px-3">{order.invoice_number}</TableCell>
                      <TableCell className="font-medium text-[#011e4b] py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="whitespace-nowrap">{order.customers?.name || 'N/A'}</span>
                          {order.notes && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MessageSquareText className="h-3.5 w-3.5" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 p-3 z-50">
                                <div className="space-y-1">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Catatan Pesanan:</p>
                                  <p className="text-xs text-gray-700 leading-relaxed break-words">{order.notes}</p>
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}
                        </div>
                        {order.customers?.customer_status && (
                          <span className="text-[9px] text-gray-400 font-medium leading-tight">
                            {order.customers.customer_status}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{order.planned_date ? new Date(order.planned_date).toLocaleDateString('id-ID') : '-'}</TableCell>
                      <TableCell>
                        {order.delivered_at 
                          ? new Date(order.delivered_at).toLocaleDateString('id-ID', {
                              day: '2-digit', month: '2-digit', year: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            }) 
                          : <span className="text-gray-400 italic">Belum kirim</span>}
                      </TableCell>
                      <TableCell>
                        {order.order_items && order.order_items.length > 0 ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={(e) => e.stopPropagation()}>
                                {order.order_items.length} Item
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-3" onClick={(e) => e.stopPropagation()}>
                              <div className="space-y-2">
                                <p className="font-bold text-xs border-b pb-1">Detail Produk</p>
                                <ul className="space-y-1">
                                  {order.order_items.map((item, idx) => (
                                    <li key={idx} className="text-[11px] flex justify-between">
                                      <span>{item.products?.name}</span>
                                      <span className="font-semibold">{item.qty}x</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </PopoverContent>
                          </Popover>
                        ) : '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell>{getPaymentStatusBadge(order.payment_status)}</TableCell>
                      <TableCell className="font-semibold">{formatCurrency(order.grand_total || calculateTotal(order.order_items))}</TableCell>
                      {userRole === 'admin' && (
                        <>
                          <TableCell className={`font-semibold whitespace-nowrap py-2 px-2 ${calculateProfit(order) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(calculateProfit(order))}
                          </TableCell>
                          <TableCell className="font-semibold whitespace-nowrap py-2 px-2 text-green-600">
                            {calculateGrossMargin(calculateProfit(order), order).toFixed(2)}%
                          </TableCell>
                          <TableCell className="py-2 px-2">
                            {order.dropshipper_id ? (
                              <div className="flex flex-col">
                                <span className="font-bold text-blue-700">
                                  {formatCurrency(order.dropshipper_commission)}
                                </span>
                                <span className="text-[9px] text-gray-400 uppercase tracking-tighter truncate max-w-[80px]">
                                  {order.dropshipper?.full_name || 'Dropshipper'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-gray-300 italic">No Dropship</span>
                            )}
                          </TableCell>
                        </>
                      )}
                      <TableCell>
                        <div className="flex flex-col gap-0.5 text-[10px]">
                          {order.order_couriers?.map((c, i) => <span key={i}>{c.courier?.full_name}</span>) || '-'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right px-4" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
                            {order.status === 'draft' ? (
                              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); updateOrderStatus(order, 'sent'); }}>
                                <TruckIcon className="mr-2 h-4 w-4 text-blue-600" /> Kirim Barang
                              </DropdownMenuItem>
                            ) : order.status === 'sent' ? (
                              <>
                                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); navigate(`/complete-delivery/${order.id}`); }}>
                                  <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" /> Selesaikan Pengiriman
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleUndoStatus(order); }} className="text-orange-600 focus:text-orange-600">
                                  <Clock className="mr-2 h-4 w-4" /> Batalkan Pengiriman (Undo)
                                </DropdownMenuItem>
                              </>
                            ) : null}
                            
                            {!isPaid && (order.status === 'sent' || order.status === 'completed') && (
                              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setSelectedOrderForPayment(order); setIsPaymentModalOpen(true); }}>
                                <CreditCard className="mr-2 h-4 w-4 text-orange-600" /> Tambah Bayar
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator />

                            {order.status === 'draft' ? (
                              <DropdownMenuItem 
                                disabled={processingWA[order.id]} 
                                onSelect={(e) => { e.preventDefault(); handleConfirmOrderWA(order); }}
                              >
                                {processingWA[order.id]
                                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  : <MessageSquareText className="mr-2 h-4 w-4 text-blue-500" />} 
                                Konfirmasi Pesanan (WA)
                              </DropdownMenuItem>
                            ) : (
                              <>
                                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleGeneratePrintInvoice(order); }}>
                                  <Printer className="mr-2 h-4 w-4 text-slate-600" /> Cetak Invoice (PDF)
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  disabled={processingWA[order.id]} 
                                  onSelect={(e) => { e.preventDefault(); handleShareInvoiceWA(order); }}
                                >
                                  {processingWA[order.id]
                                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    : <MessageSquareText className={`mr-2 h-4 w-4 ${invoice?.public_link ? 'text-green-600' : 'text-gray-300'}`} />} 
                                  Kirim Invoice via WhatsApp
                                </DropdownMenuItem>
                              </>
                            )}

                            <DropdownMenuSeparator />

                            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); navigate(`/orders/${order.id}`); }}>
                              <ExternalLink className="mr-2 h-4 w-4 text-slate-600" /> Detail Pesanan
                            </DropdownMenuItem>
                              
                            {!isPaid && (
                              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); navigate(`/orders/edit/${order.id}`); }}>
                                <Pencil className="mr-2 h-4 w-4 text-slate-600" /> Edit Pesanan
                              </DropdownMenuItem>
                            )}
                              
                            <DropdownMenuItem 
                              className="text-red-600 focus:text-red-600" 
                              onSelect={(e) => { e.preventDefault(); handleDeleteOrder(order.id); }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Hapus
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* ── PAGINATION CONTROLS ────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-t gap-4 bg-gray-50/50 rounded-b-xl">
              <p className="text-xs text-slate-500 font-medium">
                Halaman <span className="font-semibold text-[#011e4b]">{currentPage}</span> dari{' '}
                <span className="font-semibold text-[#011e4b]">{totalPages}</span>
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 sm:px-3 text-xs"
                  disabled={currentPage <= 1 || loading}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5 sm:mr-1" />
                  <span className="hidden sm:inline">Sebelumnya</span>
                </Button>

                {/* Nomor halaman — tampilkan max 5 halaman di sekitar halaman aktif */}
                <div className="flex gap-1 overflow-x-auto max-w-[150px] sm:max-w-none scrollbar-hide">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let page;
                    if (totalPages <= 5) {
                      page = i + 1;
                    } else if (currentPage <= 3) {
                      page = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      page = totalPages - 4 + i;
                    } else {
                      page = currentPage - 2 + i;
                    }
                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? 'default' : 'outline'}
                        size="sm"
                        className={`h-8 w-8 p-0 text-xs shrink-0 ${currentPage === page ? 'bg-[#011e4b] text-white' : ''}`}
                        disabled={loading}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 sm:px-3 text-xs"
                  disabled={currentPage >= totalPages || loading}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                >
                  <span className="hidden sm:inline">Berikutnya</span>
                  <ChevronRight className="h-3.5 w-3.5 sm:ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AddPaymentModal
        isOpen={isPaymentModalOpen}
        onOpenChange={setIsPaymentModalOpen}
        order={selectedOrderForPayment}
        onPaymentAdded={fetchOrdersAndCustomers}
      />

      {/* MODAL PENGATURAN WA */}
      <WhatsappTemplateSettingsModal 
        isOpen={isTemplateModalOpen} 
        onOpenChange={(open) => {
          setIsTemplateModalOpen(open);
          if (!open) fetchActiveTemplates();
        }} 
      />

      <Dialog open={isFilterModalOpen} onOpenChange={setIsFilterModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><CardTitle>Filter Pesanan</CardTitle></DialogHeader>
          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Status Pengiriman</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Dikirim</SelectItem>
                  <SelectItem value="completed">Selesai</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentStatusFilter">Status Pembayaran</Label>
              <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Semua Status Pembayaran" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status Pembayaran</SelectItem>
                  <SelectItem value="paid">Lunas</SelectItem>
                  <SelectItem value="partial">Sebagian</SelectItem>
                  <SelectItem value="unpaid">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="courierFilter">Petugas</Label>
              <Popover open={isCourierFilterOpen} onOpenChange={setIsCourierFilterOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between">
                    {courierFilter === 'all' ? 'Semua Petugas' : couriers.find(c => c.id === courierFilter)?.full_name}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput placeholder="Cari petugas..." />
                    <CommandList>
                      <CommandEmpty>Petugas tidak ditemukan.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem value="all" onSelect={() => { setCourierFilter('all'); setIsCourierFilterOpen(false); }}>
                          Semua Petugas
                        </CommandItem>
                        {couriers.map(courier => (
                          <CommandItem key={courier.id} value={courier.full_name} onSelect={() => { setCourierFilter(courier.id); setIsCourierFilterOpen(false); }}>
                            {courier.full_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerFilter">Pelanggan (Pilih banyak)</Label>
              <Popover open={isCustomerFilterOpen} onOpenChange={setIsCustomerFilterOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between h-auto min-h-10 text-left py-2">
                    <div className="flex flex-wrap gap-1">
                      {customerFilter.length === 0 && "Semua Pelanggan"}
                      {customerFilter.map(id => (
                        <Badge key={id} variant="secondary" className="font-normal text-[10px]">
                          {customers.find(c => c.id === id)?.name}
                        </Badge>
                      ))}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Cari pelanggan..." />
                    <CommandList>
                      <CommandEmpty>Pelanggan tidak ditemukan.</CommandEmpty>
                      <CommandGroup>
                        {customers.map(customer => (
                          <CommandItem 
                            key={customer.id} 
                            value={customer.name} 
                            onSelect={() => {
                              const isSelected = customerFilter.includes(customer.id);
                              const newSelection = isSelected
                                ? customerFilter.filter(id => id !== customer.id)
                                : [...customerFilter, customer.id];
                              setCustomerFilter(newSelection);
                            }}
                          >
                            <div className="flex items-center gap-2 w-full">
                              <div className={`h-4 w-4 border rounded-sm flex items-center justify-center ${customerFilter.includes(customer.id) ? 'bg-[#011e4b] border-[#011e4b]' : 'border-gray-300'}`}>
                                {customerFilter.includes(customer.id) && <CheckCircle2 className="h-3 w-3 text-white" />}
                              </div>
                              {customer.name}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                    {customerFilter.length > 0 && (
                      <div className="p-2 border-t">
                        <Button variant="ghost" size="sm" onClick={() => setCustomerFilter([])} className="w-full text-xs text-red-500">
                          Bersihkan Pilihan
                        </Button>
                      </div>
                    )}
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            
            <Separator className="my-1" />

            <div className="space-y-2 col-span-2">
              <Label className="font-semibold">Filter Berdasarkan Tanggal Input</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="plannedDateStart" className="text-xs">Dari</Label>
                  <Input id="plannedDateStart" type="date" value={plannedDateStart} onChange={(e) => setPlannedDateStart(e.target.value)} className="w-full text-xs h-9" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="plannedDateEnd" className="text-xs">Sampai</Label>
                  <Input id="plannedDateEnd" type="date" value={plannedDateEnd} onChange={(e) => setPlannedDateEnd(e.target.value)} className="w-full text-xs h-9" />
                </div>
              </div>
            </div>

            <div className="space-y-2 col-span-2">
              <Label className="font-semibold">Filter Berdasarkan Tanggal Pengiriman</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="deliveryDateStart" className="text-xs">Dari</Label>
                  <Input id="deliveryDateStart" type="date" value={deliveryDateStart} onChange={(e) => setDeliveryDateStart(e.target.value)} className="w-full text-xs h-9" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="deliveryDateEnd" className="text-xs">Sampai</Label>
                  <Input id="deliveryDateEnd" type="date" value={deliveryDateEnd} onChange={(e) => setDeliveryDateEnd(e.target.value)} className="w-full text-xs h-9" />
                </div>
              </div>
            </div>

          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={resetFilters} className="w-full sm:flex-1">Reset</Button>
            <Button onClick={applyFilters} className="w-full sm:flex-1">Terapkan Filter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrdersPage;