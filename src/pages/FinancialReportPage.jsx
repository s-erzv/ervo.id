import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import WhatsappTemplateSettingsModal from '@/components/WhatsappTemplateSettingsModal';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Loader2,
  Banknote,
  CreditCard,
  PiggyBank,
  RefreshCcw,
  ArrowRightLeft,
  FileText,
  Eye,
  Download,
  CalendarDays,
  Clock,
  ChevronRight,
  Trash2,
  MessageSquareText,
  Settings,
  ClipboardList,
  Users,
  Building,
  CheckCircle2,
  AlertCircle,
  Box,
  Tag,
  Wallet,
  TrendingUp,
  Info,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import CryptoJS from 'crypto-js';
import AddPaymentModal from '@/components/AddPaymentModal';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'fallback-key-proyek-rahasia';
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
          const binaryString = atob(parts[1]);
          const uint8Array = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) uint8Array[i] = binaryString.charCodeAt(i);
          blob = new Blob([uint8Array], { type: 'image/jpeg' });
          if (blob.size / 1024 / 1024 <= targetMB || quality < 0.1) break;
          quality -= 0.1;
        } while (quality > 0.05);
        resolve(new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.jpeg', { type: 'image/jpeg', lastModified: Date.now() }));
      };
    };
    reader.onerror = (error) => reject(error);
  });
};

const SUPABASE_PROJECT_REF = 'eyfjudhnkxvsdqusqnoy';
const SUPABASE_STORAGE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/storage/v1/object/public/proofs/`;

const fetchAllData = async (queryFn) => {
  let allData = [];
  let from = 0;
  const step = 1000;
  while (true) {
    const { data, error } = await queryFn().range(from, from + step - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = [...allData, ...data];
    if (data.length < step) break;
    from += step;
  }
  return allData;
};

const FinancialReportPage = () => {
  const { companyId, userId, userRole, companyName } = useAuth();
  const isPrivileged = userRole === 'admin' || userRole === 'super_admin';

  const [loading, setLoading] = useState(true);
  const [allMethods, setAllMethods] = useState([]);
  const [reportData, setReportData] = useState({ totalBalance: 0, balances: [] });
  const [paymentMethods, setPaymentMethods] = useState([]);

  // Piutang
  const [pendingOrders, setPendingOrders] = useState([]);
  const [totalPending, setTotalPending] = useState(0);
  const [isPendingExpanded, setIsPendingExpanded] = useState(false);
  const [pendingByDate, setPendingByDate] = useState([]);

  // Draft
  const [draftOrders, setDraftOrders] = useState([]);
  const [totalDraftProjection, setTotalDraftProjection] = useState(0);
  const [isDraftExpanded, setIsDraftExpanded] = useState(false);

  // Utang Pusat
  const [pendingProcurements, setPendingProcurements] = useState([]);
  const [totalProcurementPending, setTotalProcurementPending] = useState(0);
  const [isProcurementExpanded, setIsProcurementExpanded] = useState(false);

  // Inventory
  const [inventoryData, setInventoryData] = useState([]);
  const [totalInventoryCost, setTotalInventoryCost] = useState(0);
  const [isInventoryExpanded, setIsInventoryExpanded] = useState(false);

  // Dropship Commission
  const [dropshipOrders, setDropshipOrders] = useState([]);
  const [dsProfiles, setDsProfiles] = useState([]);
  const [dsCompletedPayouts, setDsCompletedPayouts] = useState([]);
  const [isDropshipExpanded, setIsDropshipExpanded] = useState(false);
  const [selectedDropshipperId, setSelectedDropshipperId] = useState('all');
  const [dsCommissionTab, setDsCommissionTab] = useState('terutang');

  // Payout
  const [payoutRequests, setPayoutRequests] = useState([]);
  const [totalPayoutPending, setTotalPayoutPending] = useState(0);
  const [isPayoutExpanded, setIsPayoutExpanded] = useState(false);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [selectedPayoutRequest, setSelectedPayoutRequest] = useState(null);
  const [payoutHistory, setPayoutHistory] = useState([]);

  // Transfer modal
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [activeTemplates, setActiveTemplates] = useState({});
  const [processingWA, setProcessingWA] = useState({});

  // Date & method history
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const todayStr = now.toISOString().split('T')[0];
  const [dailyRecordStartDate, setDailyRecordStartDate] = useState(firstDayOfMonth);
  const [dailyRecordEndDate, setDailyRecordEndDate] = useState(todayStr);
  const [expandedMethodId, setExpandedMethodId] = useState(null);
  const [methodTransactions, setMethodTransactions] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const expandedMethod = paymentMethods.find(m => m.id === expandedMethodId) || {};

  const [transferForm, setTransferForm] = useState({
    amount: '', from_method_id: '', to_method_id: '', description: '', admin_fee: '', proof_file: null,
  });

  const getProofUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${SUPABASE_STORAGE_URL}${path}`;
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount ?? 0);

  const formatShortCurrency = (amount) => {
    if (amount >= 1000000) return `Rp ${(amount / 1000000).toFixed(2)} JT`;
    if (amount >= 1000) return `Rp ${(amount / 1000).toFixed(1)} K`;
    return formatCurrency(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // --- FETCHERS ---
  const fetchPayoutRequests = async () => {
    const { data } = await supabase
      .from('payout_requests')
      .select('*, profiles:dropshipper_id (full_name, rekening)')
      .eq('company_id', companyId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    setPayoutRequests(data || []);
    setTotalPayoutPending(data?.reduce((sum, r) => sum + parseFloat(r.amount), 0) || 0);
  };

  const fetchPayoutHistory = async () => {
    const { data } = await supabase
      .from('payout_requests')
      .select('*, profiles:dropshipper_id (full_name, rekening)')
      .eq('company_id', companyId)
      .in('status', ['completed', 'rejected'])
      .order('updated_at', { ascending: false })
      .limit(50);
    setPayoutHistory(data || []);
  };

  const fetchActiveTemplates = async () => {
    const { data } = await supabase
      .from('whatsapp_templates').select('template_name, template_text').eq('company_id', companyId);
    if (data) {
      const map = {};
      data.forEach(t => { map[t.template_name] = t.template_text; });
      setActiveTemplates(map);
    }
  };

  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      const { data: allPaymentMethods, error: methodsError } = await supabase
        .from('payment_methods').select('*, view_permissions').eq('company_id', companyId);
      if (methodsError) throw methodsError;

      setAllMethods(allPaymentMethods);
      const visiblePaymentMethods = allPaymentMethods.filter(method => {
        if (isPrivileged) return true;
        const permissions = method.view_permissions;
        return permissions && permissions.includes(userId);
      });
      setPaymentMethods(visiblePaymentMethods);
      const visibleMethodIds = visiblePaymentMethods.map(m => m.id);

      if (visibleMethodIds.length === 0) {
        setReportData({ totalBalance: 0, balances: [] });
      } else {
        const [allTransactions, incomingPayments] = await Promise.all([
          fetchAllData(() => supabase.from('financial_transactions')
            .select('amount, type, payment_method_id')
            .in('payment_method_id', visibleMethodIds)
            .order('id', { ascending: true })),
          fetchAllData(() => supabase.from('payments')
            .select('amount, payment_method_id')
            .in('payment_method_id', visibleMethodIds)
            .order('id', { ascending: true }))
        ]);

        const balancesMap = visiblePaymentMethods.reduce((acc, method) => {
          acc[method.id] = { ...method, income: 0, expense: 0, balance: 0 };
          return acc;
        }, {});

        incomingPayments.forEach(p => {
          if (balancesMap[p.payment_method_id])
            balancesMap[p.payment_method_id].income += parseFloat(p.amount || 0);
        });

        allTransactions.forEach(t => {
          if (balancesMap[t.payment_method_id]) {
            if (t.type === 'income') balancesMap[t.payment_method_id].income += parseFloat(t.amount || 0);
            else balancesMap[t.payment_method_id].expense += parseFloat(t.amount || 0);
          }
        });

        let totalCompanyBalance = 0;
        const finalBalances = Object.values(balancesMap).map(item => {
          const balance = item.income - item.expense;
          totalCompanyBalance += balance;
          return { ...item, balance };
        });
        setReportData({ totalBalance: totalCompanyBalance, balances: finalBalances });
      }

      const [
        { data: unpaidOrdersData },
        { data: draftData },
        { data: dsData },
        { data: dsProfilesData },
        { data: dsCompletedPayoutsData },
      ] = await Promise.all([
        supabase.from('orders')
          .select('id, invoice_number, planned_date, delivered_at, grand_total, status, payment_status, created_at, customers (name, phone), order_items (qty, price, products (name)), invoices (public_link)')
          .eq('company_id', companyId)
          .eq('payment_status', 'unpaid')
          .not('status', 'in', '("cancelled","draft","pending")')
          .order('delivered_at', { ascending: false }),
        supabase.from('orders')
          .select('id, invoice_number, planned_date, grand_total, status, payment_status, created_at, customers (name, phone), order_items (qty, price, products (name)), invoices (public_link)')
          .eq('company_id', companyId)
          .eq('payment_status', 'unpaid')
          .in('status', ['draft', 'pending'])
          .order('created_at', { ascending: false }),
        supabase.from('orders')
          .select('id, invoice_number, created_at, delivered_at, grand_total, dropshipper_commission, status, payment_status, dropshipper:dropshipper_id(id, full_name), customers(name)')
          .eq('company_id', companyId)
          .gt('dropshipper_commission', 0)
          .not('status', 'eq', 'cancelled')
          .order('created_at', { ascending: false }),
        supabase.from('profiles')
          .select('id, full_name')
          .eq('company_id', companyId)
          .eq('role', 'dropship'),
        supabase.from('payout_requests')
          .select('dropshipper_id, amount')
          .eq('company_id', companyId)
          .eq('status', 'completed'),
      ]);

      setPendingOrders(unpaidOrdersData || []);
      setTotalPending((unpaidOrdersData || []).reduce((sum, o) => sum + (parseFloat(o.grand_total) || 0), 0));
      setDraftOrders(draftData || []);
      setTotalDraftProjection((draftData || []).reduce((sum, o) => sum + (parseFloat(o.grand_total) || 0), 0));
      setDropshipOrders(dsData || []);
      setDsProfiles(dsProfilesData || []);
      setDsCompletedPayouts(dsCompletedPayoutsData || []);

      const groupedByDate = (unpaidOrdersData || []).reduce((acc, order) => {
        const dateKey = order.planned_date || order.created_at.split('T')[0];
        if (!acc[dateKey]) acc[dateKey] = { date: dateKey, total: 0, count: 0 };
        acc[dateKey].total += (parseFloat(order.grand_total) || 0);
        acc[dateKey].count += 1;
        return acc;
      }, {});
      setPendingByDate(Object.values(groupedByDate).sort((a, b) => new Date(a.date) - new Date(b.date)));

      // Utang Pusat
      const { data: centralOrdersData } = await supabase
        .from('central_orders')
        .select(`*, items:central_order_items(qty, price, received_qty, sold_empty_price)`)
        .eq('company_id', companyId)
        .not('status', 'eq', 'cancelled')
        .order('created_at', { ascending: false });

      const { data: centralTransactions } = await supabase
        .from('financial_transactions')
        .select('amount, source_id')
        .eq('company_id', companyId)
        .eq('source_table', 'central_orders')
        .eq('type', 'expense');

      const paymentsByCOId = (centralTransactions || []).reduce((acc, tx) => {
        const cleanId = tx.source_id.split('_')[0];
        acc[cleanId] = (acc[cleanId] || 0) + parseFloat(tx.amount || 0);
        return acc;
      }, {});

      const pendingCOs = (centralOrdersData || []).map(order => {
        const totalItemsValue = (order.items || []).reduce((sum, item) => sum + (item.qty * item.price), 0);
        const totalGalonSoldValue = (order.sold_empty_to_central ? Object.keys(order.sold_empty_to_central) : []).reduce((sum, productId) => {
          const item = (order.items || []).find(i => i.product_id === productId);
          return sum + ((parseFloat(order.sold_empty_to_central[productId]) || 0) * (parseFloat(item?.sold_empty_price || 0)));
        }, 0);
        const totalOrderValue = totalItemsValue + totalGalonSoldValue + (parseFloat(order.admin_fee) || 0) + (parseFloat(order.driver_tip) || 0);
        const totalPaid = paymentsByCOId[order.id] || 0;
        const balanceDue = totalOrderValue - totalPaid;
        return { ...order, calculated_total: totalOrderValue, total_paid: totalPaid, balance_due: balanceDue };
      }).filter(order => order.balance_due > 100);

      setPendingProcurements(pendingCOs);
      setTotalProcurementPending(pendingCOs.reduce((sum, o) => sum + o.balance_due, 0));

      // Inventory
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name, stock, purchase_price')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .gt('stock', 0);

      if (productsData) {
        const processedInventory = productsData.map(p => ({
          ...p, total_hpp: (parseFloat(p.stock) || 0) * (parseFloat(p.purchase_price) || 0)
        })).sort((a, b) => b.total_hpp - a.total_hpp);
        setInventoryData(processedInventory);
        setTotalInventoryCost(processedInventory.reduce((sum, p) => sum + p.total_hpp, 0));
      }

    } catch (err) {
      console.error('Error fetching financial data:', err);
      toast.error('Gagal memuat data keuangan');
    } finally {
      setLoading(false);
    }
  };

  const fetchMethodTransactions = async (methodId) => {
    setLoadingHistory(true);
    try {
      const [ftData, pData] = await Promise.all([
        fetchAllData(() => supabase.from('financial_transactions')
          .select(`*, payment_method:payment_method_id (method_name)`)
          .eq('payment_method_id', methodId)
          .order('id', { ascending: true })),
        fetchAllData(() => supabase.from('payments')
          .select(`*, payment_method:payment_method_id (method_name), orders:order_id(invoice_number, customers(name))`)
          .eq('payment_method_id', methodId)
          .order('id', { ascending: true }))
      ]);

      let combined = [];
      ftData.forEach(t => combined.push({
        id: t.id, date: t.transaction_date, type: t.type, amount: parseFloat(t.amount),
        description: t.description, sourceTable: t.source_table, proofUrl: t.proof_url
      }));
      pData.forEach(p => combined.push({
        id: p.id, date: p.paid_at || p.created_at, type: 'income', amount: parseFloat(p.amount),
        description: `Pembayaran #${p.orders?.invoice_number} - ${p.orders?.customers?.name}`,
        sourceTable: 'payments', proofUrl: p.proof_url
      }));

      combined.sort((a, b) => new Date(a.date) - new Date(b.date));
      let currentRunningBalance = 0;
      const reconciled = combined.map(t => {
        const startBal = currentRunningBalance;
        currentRunningBalance += (t.type === 'income' ? t.amount : -t.amount);
        return { ...t, startingBalance: startBal, runningBalance: currentRunningBalance };
      });
      setMethodTransactions(reconciled.reverse());
    } catch (error) {
      toast.error("Gagal memuat mutasi");
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (companyId) {
      fetchFinancialData();
      fetchActiveTemplates();
      fetchPayoutRequests();
      fetchPayoutHistory();
    }
  }, [companyId]);

  // --- ACTIONS ---
  const sendViaFonnte = async (targetPhone, message) => {
    try {
      const { data: companyData } = await supabase.from('companies').select('fonnte_token').eq('id', companyId).single();
      const encryptedToken = companyData?.fonnte_token;
      if (!encryptedToken) return false;
      let finalToken = null;
      try {
        const bytes = CryptoJS.AES.decrypt(encryptedToken, ENCRYPTION_KEY);
        finalToken = bytes.toString(CryptoJS.enc.Utf8);
      } catch { finalToken = encryptedToken; }
      if (!finalToken || finalToken.trim() === '') return false;
      const response = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { 'Authorization': finalToken },
        body: new URLSearchParams({ target: targetPhone.replace(/[^\d]/g, ''), message, countryCode: '62' })
      });
      const result = await response.json();
      return result.status === true;
    } catch (err) { return false; }
  };

  const handleReminderWA = async (order) => {
    const customerName = order.customers?.name || 'Bapak/Ibu';
    const phone = (order.customers?.phone || '').replace(/[^\d]/g, '');
    if (!phone) { toast.error('Nomor WhatsApp pelanggan tidak ditemukan.'); return; }
    if (processingWA[order.id]) return;
    setProcessingWA(prev => ({ ...prev, [order.id]: true }));
    const tid = toast.loading(`Menyiapkan pengingat untuk ${customerName}...`);
    try {
      let paymentMethodDisplay = 'Transfer Bank / Tunai';
      const transferMethod = allMethods.find(m => m.type === 'transfer' && m.is_active) || allMethods[0];
      if (transferMethod?.type === 'transfer') {
        paymentMethodDisplay = `${transferMethod.method_name} ${transferMethod.account_number} a.n ${transferMethod.account_name || ''}`;
      }
      const template = activeTemplates['payment_reminder_finance'] || activeTemplates['payment_reminder'] || `Tagihan #{{invoiceNum}} sisa {{sisaTagihan}}.`;
      const whatsappMessage = template
        .replace(/{{customerName}}/g, customerName)
        .replace(/{{invoiceNo}}/g, order.invoice_number)
        .replace(/{{invoiceNum}}/g, order.invoice_number)
        .replace(/{{sisaTagihan}}/g, formatCurrency(order.grand_total))
        .replace(/{{paymentMethod}}/g, paymentMethodDisplay)
        .replace(/{{companyName}}/g, companyName || 'Manajemen Toko');
      const isAutoSent = await sendViaFonnte(phone, whatsappMessage);
      if (isAutoSent) {
        toast.success(`Pesan Terkirim ke ${customerName}!`, { id: tid });
      } else {
        toast.dismiss(tid);
        window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(whatsappMessage)}`, '_blank');
        toast.success('Membuka WhatsApp...', { duration: 3000 });
      }
    } catch (err) {
      toast.error('Gagal mengirim pesan', { id: tid });
    } finally {
      setTimeout(() => setProcessingWA(prev => ({ ...prev, [order.id]: false })), 3000);
    }
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const { amount, from_method_id, to_method_id, description, admin_fee, proof_file } = transferForm;
    if (from_method_id === to_method_id) { toast.error('Metode sumber dan tujuan tidak boleh sama.'); setIsSubmitting(false); return; }
    const sourceMethodName = paymentMethods.find(m => m.id === from_method_id)?.method_name;
    const targetMethodName = allMethods.find(m => m.id === to_method_id)?.method_name;
    try {
      let proofPath = null;
      let fileToUpload = (proof_file instanceof FileList || Array.isArray(proof_file)) ? proof_file[0] : proof_file;
      if (fileToUpload && fileToUpload.type?.startsWith('image/') && fileToUpload.size > MAX_FILE_SIZE) {
        toast.loading('Kompresi bukti transfer...', { id: 'compressing-transfer' });
        try { fileToUpload = await compressImage(fileToUpload, TARGET_SIZE_MB); toast.success('Kompresi berhasil', { id: 'compressing-transfer' }); }
        catch { toast.error('Gagal kompresi', { id: 'compressing-transfer' }); }
      }
      if (fileToUpload) {
        const fileNameStr = fileToUpload.name || 'transfer_proof.jpg';
        const fileExt = fileNameStr.includes('.') ? fileNameStr.split('.').pop() : 'jpg';
        const filePath = `${companyId}/transfer_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('proofs').upload(filePath, fileToUpload);
        if (uploadError) throw uploadError;
        proofPath = filePath;
      }
      await supabase.from('financial_transactions').insert({
        company_id: companyId, type: 'expense', amount: parseFloat(amount),
        description: `Transfer keluar ke ${targetMethodName}. ${description}`,
        payment_method_id: from_method_id, source_table: 'transfer', proof_url: proofPath,
      });
      await supabase.from('financial_transactions').insert({
        company_id: companyId, type: 'income', amount: parseFloat(amount),
        description: `Transfer masuk dari ${sourceMethodName}. ${description}`,
        payment_method_id: to_method_id, source_table: 'transfer', proof_url: proofPath,
      });
      if (admin_fee && parseFloat(admin_fee) > 0) {
        await supabase.from('financial_transactions').insert({
          company_id: companyId, type: 'expense', amount: parseFloat(admin_fee),
          description: `Biaya Admin Transfer ke ${targetMethodName}. ${description}`,
          payment_method_id: from_method_id, source_table: 'transfer_fee',
        });
      }
      toast.success('Transfer dana berhasil dicatat!');
      setIsTransferModalOpen(false);
      setTransferForm({ amount: '', from_method_id: '', to_method_id: '', description: '', admin_fee: '', proof_file: null });
      fetchFinancialData();
      if (expandedMethodId) fetchMethodTransactions(expandedMethodId);
    } catch (error) { toast.error('Gagal mencatat transfer dana: ' + error.message); } finally { setIsSubmitting(false); }
  };

  const handleOpenPayoutModal = (request) => { setSelectedPayoutRequest(request); setIsAddPaymentOpen(true); };

  const handleRejectPayout = async (request) => {
    if (!window.confirm(`Tolak pencairan ${formatCurrency(request.amount)} dari ${request.profiles?.full_name}?`)) return;
    const tid = toast.loading('Menolak pengajuan...');
    try {
      await supabase.from('payout_requests').update({ status: 'rejected', admin_note: 'Ditolak oleh admin' }).eq('id', request.id);
      toast.success('Pengajuan ditolak.', { id: tid });
      fetchPayoutRequests();
      fetchPayoutHistory();
    } catch (err) { toast.error('Gagal: ' + err.message, { id: tid }); }
  };

  const onPayoutSuccess = async (paymentInfo) => {
    if (!selectedPayoutRequest) return;
    const tid = toast.loading('Mencatat pencairan dana ke pembukuan...');
    try {
      const { data: subCatData } = await supabase
        .from('financial_subcategories')
        .select('id, category_id, financial_categories!inner (id, name)')
        .ilike('name', 'Sharing Profit')
        .single();
      const { error: rpcError } = await supabase.rpc('confirm_payout_and_move_balance', { p_payout_id: selectedPayoutRequest.id });
      if (rpcError) throw rpcError;
      await supabase.from('payout_requests').update({ status: 'completed', proof_url: paymentInfo.proofUrl }).eq('id', selectedPayoutRequest.id);
      await supabase.from('financial_transactions').insert({
        company_id: companyId, type: 'expense', amount: selectedPayoutRequest.amount,
        description: `Pencairan Komisi Dropship: ${selectedPayoutRequest.profiles?.full_name}`,
        payment_method_id: paymentInfo.paymentMethodId,
        category_id: subCatData?.category_id || null,
        subcategory_id: subCatData?.id || null,
        source_table: 'payout_requests', source_id: selectedPayoutRequest.id,
        proof_url: paymentInfo.proofUrl
      });
      toast.success('Saldo cair & tercatat di Sharing Profit!', { id: tid });
      fetchFinancialData();
      fetchPayoutRequests();
      fetchPayoutHistory();
      if (expandedMethodId) fetchMethodTransactions(expandedMethodId);
    } catch (err) { toast.error('Gagal: ' + err.message, { id: tid }); }
  };

  const handleDeleteTransaction = async (t) => {
    if (t.sourceTable === 'payments') { toast.error('Transaksi order tidak bisa dihapus dari sini.'); return; }
    if (!window.confirm('Yakin ingin menghapus transaksi ini? Saldo akan disesuaikan otomatis.')) return;
    setLoadingHistory(true);
    try {
      await supabase.from('financial_transactions').delete().eq('id', t.id);
      toast.success('Transaksi berhasil dihapus');
      fetchFinancialData();
      if (expandedMethodId) fetchMethodTransactions(expandedMethodId);
    } catch (error) { toast.error('Gagal menghapus transaksi.'); } finally { setLoadingHistory(false); }
  };

  // --- EXPORTS ---
  const handleExportDropshipCommission = () => {
    if (filteredDropshipData.length === 0) { toast.error('Tidak ada data komisi untuk diekspor.'); return; }
    const dropshipperName = selectedDropshipperId === 'all' ? 'Semua' : uniqueDropshippers.find(d => d.id === selectedDropshipperId)?.name;
    const exportData = filteredDropshipData.map(o => ({
      Tanggal: new Date(o.created_at).toLocaleDateString('id-ID'),
      'No. Invoice': o.invoice_number, Dropshipper: o.dropshipper?.full_name || 'N/A',
      Pelanggan: o.customers?.name || 'N/A', 'Total Order': o.grand_total, 'Komisi Dropship': o.dropshipper_commission,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Komisi Dropship');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `Laporan_Komisi_Dropship_${dropshipperName}.xlsx`);
    toast.success('Data komisi berhasil diekspor!');
  };

  const handleExportTransactions = () => {
    if (filteredMethodTransactions.length === 0) { toast.error('Tidak ada riwayat transaksi untuk diekspor.'); return; }
    const methodName = expandedMethod.method_name || 'Semua_Metode';
    const methodAccount = expandedMethod.account_name || '';
    const nameForFile = `${methodName}${methodAccount ? `_${methodAccount}` : ''}`.replace(/[^a-zA-Z0-9_]/g, '');
    const exportData = filteredMethodTransactions.map(t => ({
      'ID Transaksi': t.id, Tanggal: new Date(t.date).toLocaleDateString('id-ID'),
      Tipe: t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      Debit: t.type === 'income' ? t.amount : 0, Kredit: t.type === 'expense' ? t.amount : 0,
      'Saldo Saat Itu': t.runningBalance, Deskripsi: t.description, 'URL Bukti': getProofUrl(t.proofUrl) || '-',
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Riwayat Transaksi');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `Riwayat_Keuangan_${nameForFile}_${dailyRecordStartDate}_sd_${dailyRecordEndDate}.xlsx`);
    toast.success('Riwayat transaksi berhasil diekspor!');
  };

  const handleExportDailyRecords = () => {
    if (!selectedMethodDailyRecord || selectedMethodDailyRecord.records.length === 0) { toast.error('Tidak ada rekaman transaksi periode untuk diekspor.'); return; }
    const exportData = selectedMethodDailyRecord.records.map(day => ({
      Tanggal: new Date(day.date).toLocaleDateString('id-ID'),
      'Metode Pembayaran': selectedMethodDailyRecord.method_name,
      'Pemasukan (Rp)': day.income, 'Pengeluaran (Rp)': day.expense,
      'Saldo Awal (Rp)': day.startingBalance, 'Saldo Akhir (Rp)': day.endingBalance,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekaman Periode Harian');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `Rekaman_Transaksi_Harian_${dailyRecordStartDate}_${dailyRecordEndDate}.xlsx`);
    toast.success('Rekaman periode berhasil diekspor!');
  };

  // --- SECTION TOGGLES ---
  const resetAllExpansions = () => {
    setIsPendingExpanded(false); setIsDraftExpanded(false); setIsDropshipExpanded(false);
    setIsProcurementExpanded(false); setIsInventoryExpanded(false); setIsPayoutExpanded(false);
  };
  const toggleSection = (setter, currentValue) => { resetAllExpansions(); setter(!currentValue); };

  const handleCardClick = (methodId) => {
    if (expandedMethodId === methodId) { setExpandedMethodId(null); setMethodTransactions([]); }
    else { setExpandedMethodId(methodId); fetchMethodTransactions(methodId); }
  };

  // --- MEMOS ---
  const selectedMethodDailyRecord = useMemo(() => {
    if (!expandedMethodId) return null;
    const currentMethod = paymentMethods.find(m => m.id === expandedMethodId);
    if (!currentMethod) return null;
    if (!methodTransactions || methodTransactions.length === 0) {
      return { method_name: currentMethod.method_name || 'Unknown', startDate: dailyRecordStartDate, endDate: dailyRecordEndDate, records: [], totalIncome: 0, totalExpense: 0, endingBalance: 0 };
    }
    const ascTx = [...methodTransactions].reverse();
    const startObj = new Date(dailyRecordStartDate); startObj.setHours(0, 0, 0, 0);
    const endObj = new Date(dailyRecordEndDate); endObj.setHours(23, 59, 59, 999);
    let periodStartingBalance = 0;
    const txInPeriod = [];
    ascTx.forEach(t => {
      const txDate = new Date(t.date);
      if (txDate < startObj) periodStartingBalance += (t.type === 'income' ? t.amount : -t.amount);
      else if (txDate <= endObj) txInPeriod.push(t);
    });
    const dailySummary = {};
    let totalIncome = 0, totalExpense = 0;
    txInPeriod.forEach(t => {
      const d = new Date(t.date);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!dailySummary[dateKey]) dailySummary[dateKey] = { date: dateKey, income: 0, expense: 0 };
      if (t.type === 'income') { dailySummary[dateKey].income += t.amount; totalIncome += t.amount; }
      else { dailySummary[dateKey].expense += t.amount; totalExpense += t.amount; }
    });
    const dateRange = [];
    let curr = new Date(startObj);
    while (curr <= endObj) {
      dateRange.push(`${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`);
      curr.setDate(curr.getDate() + 1);
    }
    const finalAggregatedRecords = [];
    let chainedBalance = periodStartingBalance;
    dateRange.forEach(dateKey => {
      const dayData = dailySummary[dateKey] || { date: dateKey, income: 0, expense: 0 };
      const startBal = chainedBalance;
      const endBal = startBal + dayData.income - dayData.expense;
      finalAggregatedRecords.push({ date: dateKey, income: dayData.income, expense: dayData.expense, startingBalance: startBal, endingBalance: endBal });
      chainedBalance = endBal;
    });
    finalAggregatedRecords.reverse();
    return { method_name: currentMethod.method_name || 'Unknown', startDate: dailyRecordStartDate, endDate: dailyRecordEndDate, records: finalAggregatedRecords, totalIncome, totalExpense, endingBalance: periodStartingBalance + totalIncome - totalExpense };
  }, [expandedMethodId, methodTransactions, dailyRecordStartDate, dailyRecordEndDate, paymentMethods]);

  const filteredMethodTransactions = useMemo(() => {
    if (!methodTransactions || !dailyRecordStartDate || !dailyRecordEndDate) return methodTransactions;
    const start = new Date(dailyRecordStartDate); start.setHours(0, 0, 0, 0);
    const end = new Date(dailyRecordEndDate); end.setHours(23, 59, 59, 999);
    return methodTransactions.filter(t => { const txDate = new Date(t.date); return txDate >= start && txDate <= end; });
  }, [methodTransactions, dailyRecordStartDate, dailyRecordEndDate]);

  const dsPayoutsByDropshipper = useMemo(() => {
    const map = {};
    dsCompletedPayouts.forEach(p => { map[p.dropshipper_id] = (map[p.dropshipper_id] || 0) + (parseFloat(p.amount) || 0); });
    return map;
  }, [dsCompletedPayouts]);

  const totalPaidOutAll = useMemo(() => Object.values(dsPayoutsByDropshipper).reduce((sum, v) => sum + v, 0), [dsPayoutsByDropshipper]);
  const totalEarnedAll = useMemo(() => dropshipOrders.reduce((sum, o) => sum + (parseFloat(o.dropshipper_commission) || 0), 0), [dropshipOrders]);
  const totalOutstandingCommission = useMemo(() =>
    dsProfiles.reduce((total, p) => {
      const earned = dropshipOrders.filter(o => o.dropshipper?.id === p.id).reduce((sum, o) => sum + (parseFloat(o.dropshipper_commission) || 0), 0);
      const paid = dsPayoutsByDropshipper[p.id] || 0;
      return total + Math.max(0, earned - paid);
    }, 0),
    [dsProfiles, dropshipOrders, dsPayoutsByDropshipper]
  );

  const filteredDropshipData = useMemo(() => {
    if (!dropshipOrders || dropshipOrders.length === 0) return [];
    return selectedDropshipperId !== 'all' ? dropshipOrders.filter(o => o.dropshipper?.id === selectedDropshipperId) : dropshipOrders;
  }, [dropshipOrders, selectedDropshipperId]);

  const uniqueDropshippers = useMemo(() => {
    const map = new Map();
    dropshipOrders.forEach(o => { if (o.dropshipper?.id && o.dropshipper?.full_name) map.set(o.dropshipper.id, o.dropshipper.full_name); });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [dropshipOrders]);

  const currentPeriodDropshipTotal = useMemo(() =>
    filteredDropshipData.reduce((sum, o) => sum + (parseFloat(o.dropshipper_commission) || 0), 0),
    [filteredDropshipData]
  );

  // --- FINANCIAL METRICS ---
  const totalAset = reportData.totalBalance + totalPending + totalInventoryCost;
  const totalLiabilitas = totalProcurementPending;
  const totalEkuitas = totalAset - totalLiabilitas;

  const currentRatioVal = totalLiabilitas > 0 ? totalAset / totalLiabilitas : null;
  const currentRatio = currentRatioVal !== null ? currentRatioVal.toFixed(2) : '—';
  const currentRatioLabel = currentRatioVal === null ? 'AMAN' : currentRatioVal >= 2 ? 'SEHAT' : currentRatioVal >= 1 ? 'MODERAT' : 'RENDAH';
  const currentRatioColor = currentRatioLabel === 'RENDAH' ? 'text-red-500 bg-red-50 border-red-100' : currentRatioLabel === 'MODERAT' ? 'text-orange-500 bg-orange-50 border-orange-100' : 'text-emerald-500 bg-emerald-50 border-emerald-100';
  const currentRatioBar = currentRatioVal === null ? 100 : Math.min((currentRatioVal / 3) * 100, 100);
  const currentRatioBarColor = currentRatioLabel === 'RENDAH' ? 'bg-red-500' : currentRatioLabel === 'MODERAT' ? 'bg-orange-500' : 'bg-emerald-500';

  const debtToAssetVal = totalAset > 0 ? (totalLiabilitas / totalAset) * 100 : 0;
  const debtToAsset = debtToAssetVal.toFixed(1);
  const debtToAssetLabel = debtToAssetVal <= 30 ? 'SEHAT' : debtToAssetVal <= 60 ? 'MODERAT' : 'RENDAH';
  const debtToAssetColor = debtToAssetLabel === 'RENDAH' ? 'text-red-500 bg-red-50 border-red-100' : debtToAssetLabel === 'MODERAT' ? 'text-orange-500 bg-orange-50 border-orange-100' : 'text-emerald-500 bg-emerald-50 border-emerald-100';
  const debtToAssetBarColor = debtToAssetLabel === 'RENDAH' ? 'bg-red-500' : debtToAssetLabel === 'MODERAT' ? 'bg-orange-500' : 'bg-emerald-500';

  const cashRatioVal = totalLiabilitas > 0 ? reportData.totalBalance / totalLiabilitas : null;
  const cashRatio = cashRatioVal !== null ? cashRatioVal.toFixed(2) : '—';
  const cashRatioLabel = cashRatioVal === null ? 'AMAN' : cashRatioVal >= 1 ? 'SEHAT' : cashRatioVal >= 0.5 ? 'MODERAT' : 'RENDAH';
  const cashRatioColor = cashRatioLabel === 'RENDAH' ? 'text-red-500 bg-red-50 border-red-100' : cashRatioLabel === 'MODERAT' ? 'text-orange-500 bg-orange-50 border-orange-100' : 'text-emerald-500 bg-emerald-50 border-emerald-100';
  const cashRatioBar = cashRatioVal === null ? 100 : Math.min((cashRatioVal / 2) * 100, 100);
  const cashRatioBarColor = cashRatioLabel === 'RENDAH' ? 'bg-red-500' : cashRatioLabel === 'MODERAT' ? 'bg-orange-500' : 'bg-emerald-500';

  const chartData = [
    { name: 'Kas', value: reportData.totalBalance, color: '#3b82f6' },
    { name: 'Piutang', value: totalPending, color: '#22c55e' },
    { name: 'Persediaan', value: totalInventoryCost, color: '#f97316' },
  ].filter(d => d.value > 0);

  const totalIncomeAll = reportData.balances.reduce((sum, m) => sum + m.income, 0);
  const totalExpenseAll = reportData.balances.reduce((sum, m) => sum + m.expense, 0);
  const startingBalEstimate = reportData.totalBalance - totalIncomeAll + totalExpenseAll;

  const topPiutang = [...pendingOrders].sort((a, b) => b.grand_total - a.grand_total).slice(0, 5);
  const topUtang = [...pendingProcurements].sort((a, b) => b.balance_due - a.balance_due).slice(0, 5);

  const isAllowedToView = paymentMethods.length > 0 || userRole === 'admin' || userRole === 'super_admin';

  if (loading) return <div className="flex justify-center items-center h-screen bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-[#011e4b]" /></div>;
  if (!isAllowedToView) return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl h-screen flex items-center justify-center">
      <Card className="border border-red-200 shadow-sm max-w-md w-full rounded-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto bg-red-50 w-12 h-12 flex items-center justify-center rounded-full mb-3"><AlertCircle className="h-6 w-6 text-red-600" /></div>
          <CardTitle className="text-red-700">Akses Dibatasi</CardTitle>
          <CardDescription className="mt-2 text-slate-600 text-sm">Bapak/Ibu tidak memiliki izin untuk melihat data keuangan manapun. Mohon hubungi Administrator.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 animate-in fade-in slide-in-from-bottom-2 space-y-6">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard Keuangan</h1>
          <p className="text-sm text-slate-500 mt-1">Ringkasan kondisi keuangan bisnis Anda</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setIsTransferModalOpen(true)} variant="outline" className="bg-white border-slate-200 h-10 text-sm rounded-xl">
            <ArrowRightLeft className="h-4 w-4 mr-2" /> Transfer
          </Button>
          <Button onClick={() => setIsTemplateModalOpen(true)} variant="outline" className="bg-white border-slate-200 h-10 rounded-xl">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 7 KPI CARDS */}
      <div className={`grid gap-3 ${isPrivileged ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>

        {/* 1. Saldo Riil */}
        <div className={`bg-white border rounded-xl p-4 shadow-sm cursor-pointer transition-all hover:shadow-md ${expandedMethodId ? 'border-blue-500 ring-1 ring-blue-500/10' : 'border-slate-200'}`}
          onClick={() => { resetAllExpansions(); if (expandedMethodId) setExpandedMethodId(null); else document.getElementById('payment-methods-section')?.scrollIntoView({ behavior: 'smooth' }); }}>
          <div className="bg-blue-50 p-2 rounded-lg w-fit mb-3"><Wallet className="h-4 w-4 text-blue-600" /></div>
          <div className="text-[10px] font-medium text-slate-500 uppercase tracking-tight">Saldo Riil</div>
          <div className="text-lg md:text-xl font-bold text-slate-800">{formatShortCurrency(reportData.totalBalance)}</div>
          <div className="text-[10px] text-blue-600 mt-3 font-semibold flex items-center">Detail <ChevronRight className="h-3 w-3" /></div>
        </div>

        {isPrivileged && (
          <>
            {/* 2. Piutang */}
            <div className={`bg-white border rounded-xl p-4 shadow-sm cursor-pointer transition-all hover:shadow-md ${isPendingExpanded ? 'border-green-500 ring-1 ring-green-500/10' : 'border-slate-200'}`}
              onClick={() => toggleSection(setIsPendingExpanded, isPendingExpanded)}>
              <div className="bg-green-50 p-2 rounded-lg w-fit mb-3"><Users className="h-4 w-4 text-green-600" /></div>
              <div className="text-[10px] font-medium text-slate-500 uppercase tracking-tight">Piutang</div>
              <div className="text-lg md:text-xl font-bold text-slate-800">{formatShortCurrency(totalPending)}</div>
              <div className="text-[10px] text-green-600 mt-3 font-semibold flex items-center">Detail <ChevronRight className="h-3 w-3" /></div>
            </div>

            {/* 3. Inventory */}
            <div className={`bg-white border rounded-xl p-4 shadow-sm cursor-pointer transition-all hover:shadow-md ${isInventoryExpanded ? 'border-orange-500 ring-1 ring-orange-500/10' : 'border-slate-200'}`}
              onClick={() => toggleSection(setIsInventoryExpanded, isInventoryExpanded)}>
              <div className="bg-orange-50 p-2 rounded-lg w-fit mb-3"><Box className="h-4 w-4 text-orange-500" /></div>
              <div className="text-[10px] font-medium text-slate-500 uppercase tracking-tight">Inventory</div>
              <div className="text-lg md:text-xl font-bold text-slate-800">{formatShortCurrency(totalInventoryCost)}</div>
              <div className="text-[10px] text-orange-600 mt-3 font-semibold flex items-center">Detail <ChevronRight className="h-3 w-3" /></div>
            </div>

            {/* 4. Utang Pusat */}
            <div className={`bg-white border rounded-xl p-4 shadow-sm cursor-pointer transition-all hover:shadow-md ${isProcurementExpanded ? 'border-red-500 ring-1 ring-red-500/10' : 'border-slate-200'}`}
              onClick={() => toggleSection(setIsProcurementExpanded, isProcurementExpanded)}>
              <div className="bg-red-50 p-2 rounded-lg w-fit mb-3"><FileText className="h-4 w-4 text-red-600" /></div>
              <div className="text-[10px] font-medium text-slate-500 uppercase tracking-tight">Utang Pusat</div>
              <div className="text-lg md:text-xl font-bold text-slate-800">{formatShortCurrency(totalProcurementPending)}</div>
              <div className="text-[10px] text-red-600 mt-3 font-semibold flex items-center">Detail <ChevronRight className="h-3 w-3" /></div>
            </div>

            {/* 5. Komisi DS */}
            <div className={`bg-white border rounded-xl p-4 shadow-sm cursor-pointer transition-all hover:shadow-md ${isDropshipExpanded ? 'border-purple-500 ring-1 ring-purple-500/10' : 'border-slate-200'}`}
              onClick={() => toggleSection(setIsDropshipExpanded, isDropshipExpanded)}>
              <div className="bg-purple-50 p-2 rounded-lg w-fit mb-3"><Tag className="h-4 w-4 text-purple-600" /></div>
              <div className="text-[10px] font-medium text-slate-500 uppercase tracking-tight">Komisi DS</div>
              <div className="text-lg md:text-xl font-bold text-slate-800">{formatShortCurrency(totalOutstandingCommission)}</div>
              <div className="text-[10px] text-purple-600 mt-3 font-semibold flex items-center">Detail <ChevronRight className="h-3 w-3" /></div>
            </div>

            {/* 6. Draft */}
            <div className={`bg-white border rounded-xl p-4 shadow-sm cursor-pointer transition-all hover:shadow-md ${isDraftExpanded ? 'border-cyan-500 ring-1 ring-cyan-500/10' : 'border-slate-200'}`}
              onClick={() => toggleSection(setIsDraftExpanded, isDraftExpanded)}>
              <div className="bg-cyan-50 p-2 rounded-lg w-fit mb-3"><ClipboardList className="h-4 w-4 text-cyan-600" /></div>
              <div className="text-[10px] font-medium text-slate-500 uppercase tracking-tight">Draft</div>
              <div className="text-lg md:text-xl font-bold text-slate-800">{formatShortCurrency(totalDraftProjection)}</div>
              <div className="text-[10px] text-cyan-600 mt-3 font-semibold flex items-center">Detail <ChevronRight className="h-3 w-3" /></div>
            </div>

            {/* 7. Tarik Dana */}
            <div className={`bg-white border rounded-xl p-4 shadow-sm cursor-pointer transition-all hover:shadow-md ${isPayoutExpanded ? 'border-pink-500 ring-1 ring-pink-500/10' : 'border-slate-200'}`}
              onClick={() => { toggleSection(setIsPayoutExpanded, isPayoutExpanded); fetchPayoutRequests(); fetchPayoutHistory(); }}>
              <div className="bg-pink-50 p-2 rounded-lg w-fit mb-3 relative">
                <TrendingUp className="h-4 w-4 text-pink-600" />
                {payoutRequests.length > 0 && <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span></span>}
              </div>
              <div className="text-[10px] font-medium text-slate-500 uppercase tracking-tight">Tarik Dana</div>
              <div className="text-lg md:text-xl font-bold text-slate-800">{formatShortCurrency(totalPayoutPending)}</div>
              <div className="text-[10px] text-pink-600 mt-3 font-semibold flex items-center">Proses <ChevronRight className="h-3 w-3" /></div>
            </div>
          </>
        )}
      </div>

      {/* EXPANDED DETAIL PANELS */}
      {(isPendingExpanded || isDraftExpanded || isDropshipExpanded || isPayoutExpanded || isInventoryExpanded || isProcurementExpanded) && (
        <div className="mb-2 mt-2 animate-in fade-in slide-in-from-top-4 duration-300">

          {isPendingExpanded && (
            <Card className="border border-blue-200 shadow-md bg-white rounded-2xl overflow-hidden">
              <CardHeader className="bg-blue-50/50 border-b border-blue-100 p-5 flex flex-row items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base font-bold text-blue-900 flex items-center gap-2"><Clock className="h-5 w-5 text-blue-600" /> Rincian Piutang Aktif</CardTitle>
                  <CardDescription className="text-blue-700/70 font-medium text-xs">Daftar order yang belum lunas sepenuhnya.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[400px]">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                      <TableRow className="text-[11px] uppercase tracking-wider text-slate-500 border-slate-100">
                        <TableHead className="font-semibold px-5">Tgl Kirim</TableHead>
                        <TableHead className="font-semibold">No. Invoice</TableHead>
                        <TableHead className="font-semibold">Pelanggan</TableHead>
                        <TableHead className="font-semibold text-right">Nominal Tagihan</TableHead>
                        <TableHead className="text-center font-semibold px-5">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingOrders.map(order => (
                        <TableRow key={order.id} className="text-sm border-slate-100 hover:bg-slate-50/50">
                          <TableCell className="whitespace-nowrap font-medium text-slate-600 px-5">
                            {order.delivered_at ? new Date(order.delivered_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : formatDate(order.planned_date)}
                          </TableCell>
                          <TableCell className="font-bold text-slate-900">#{order.invoice_number}</TableCell>
                          <TableCell className="font-medium text-slate-700">{order.customers?.name}</TableCell>
                          <TableCell className="text-right font-bold text-blue-600">{formatCurrency(order.grand_total)}</TableCell>
                          <TableCell className="text-right px-5">
                            <div className="flex gap-2 justify-end">
                              <Link to={`/orders/${order.id}`}>
                                <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Button variant="outline" size="sm"
                                className={`h-8 px-3 border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg font-semibold text-xs ${processingWA[order.id] ? 'opacity-50 cursor-not-allowed' : ''}`}
                                onClick={() => handleReminderWA(order)} disabled={processingWA[order.id]}>
                                {processingWA[order.id] ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <MessageSquareText className="h-3 w-3 mr-1.5" />}
                                Kirim WA
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {pendingOrders.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-12 text-slate-400 font-medium">Tidak ada piutang aktif.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {isDropshipExpanded && (
            <Card className="border border-emerald-200 shadow-md bg-white rounded-2xl overflow-hidden">
              <CardHeader className="bg-emerald-50/50 border-b border-emerald-100 p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1">
                  <CardTitle className="text-base font-bold text-emerald-900 flex items-center gap-2"><Users className="h-5 w-5 text-emerald-600" /> Detail Komisi Dropshipper</CardTitle>
                  <CardDescription className="text-emerald-700/70 font-medium text-xs">
                    Belum cair: <span className="font-bold text-emerald-800">{formatCurrency(totalOutstandingCommission)}</span> &nbsp;|&nbsp; Total earned: <span className="font-semibold">{formatCurrency(totalEarnedAll)}</span>
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <Tabs value={dsCommissionTab} onValueChange={setDsCommissionTab}>
                  <TabsList className="h-9 bg-slate-100 rounded-xl p-1 w-full sm:w-auto mb-4">
                    <TabsTrigger value="terutang" className="text-xs font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">Belum Cair</TabsTrigger>
                    <TabsTrigger value="riwayat" className="text-xs font-bold rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-700 data-[state=active]:shadow-sm">Riwayat Order</TabsTrigger>
                  </TabsList>

                  <TabsContent value="terutang">
                    <div className="overflow-x-auto border rounded-xl">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="font-semibold text-slate-700">Dropshipper</TableHead>
                            <TableHead className="text-right font-semibold text-slate-700 whitespace-nowrap">Total Earned</TableHead>
                            <TableHead className="text-right font-semibold text-slate-700 whitespace-nowrap">Sudah Cair</TableHead>
                            <TableHead className="text-right font-semibold text-slate-700 whitespace-nowrap">Belum Cair</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dsProfiles.map(p => {
                            const earned = dropshipOrders.filter(o => o.dropshipper?.id === p.id).reduce((sum, o) => sum + (parseFloat(o.dropshipper_commission) || 0), 0);
                            const paid = dsPayoutsByDropshipper[p.id] || 0;
                            const outstanding = Math.max(0, earned - paid);
                            return (
                              <TableRow key={p.id} className={outstanding > 0 ? 'bg-emerald-50/30' : ''}>
                                <TableCell className="font-bold text-slate-800">{p.full_name}</TableCell>
                                <TableCell className="text-right text-slate-600 whitespace-nowrap">{formatCurrency(earned)}</TableCell>
                                <TableCell className="text-right text-emerald-600 whitespace-nowrap">{formatCurrency(paid)}</TableCell>
                                <TableCell className="text-right whitespace-nowrap">
                                  {outstanding > 0
                                    ? <span className="font-bold text-emerald-700">{formatCurrency(outstanding)}</span>
                                    : <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200 border font-bold">Lunas</Badge>}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {dsProfiles.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-400 italic">Belum ada dropshipper.</TableCell></TableRow>}
                        </TableBody>
                        {dsProfiles.length > 0 && (
                          <TableFooter>
                            <TableRow className="font-bold bg-emerald-50">
                              <TableCell>TOTAL</TableCell>
                              <TableCell className="text-right whitespace-nowrap">{formatCurrency(totalEarnedAll)}</TableCell>
                              <TableCell className="text-right text-emerald-700 whitespace-nowrap">{formatCurrency(totalEarnedAll - totalOutstandingCommission)}</TableCell>
                              <TableCell className="text-right text-emerald-700 whitespace-nowrap">{formatCurrency(totalOutstandingCommission)}</TableCell>
                            </TableRow>
                          </TableFooter>
                        )}
                      </Table>
                    </div>
                  </TabsContent>

                  <TabsContent value="riwayat">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <Select value={selectedDropshipperId} onValueChange={setSelectedDropshipperId}>
                        <SelectTrigger className="h-9 w-full sm:w-[180px] bg-white rounded-lg"><SelectValue placeholder="Pilih Dropshipper" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Dropshipper</SelectItem>
                          {uniqueDropshippers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button onClick={handleExportDropshipCommission} variant="outline" size="sm" className="h-9 bg-white rounded-lg flex-grow sm:flex-grow-0"><Download className="h-4 w-4 mr-2" /> Export</Button>
                    </div>
                    <div className="overflow-x-auto max-h-[400px] border rounded-xl">
                      <Table>
                        <TableHeader className="sticky top-0 bg-slate-50 z-10">
                          <TableRow>
                            <TableHead className="font-semibold text-slate-700 whitespace-nowrap">Tgl Order</TableHead>
                            <TableHead className="font-semibold text-slate-700">Dropshipper</TableHead>
                            <TableHead className="font-semibold text-slate-700">Invoice</TableHead>
                            <TableHead className="font-semibold text-slate-700">Pelanggan</TableHead>
                            <TableHead className="font-semibold text-slate-700 text-right whitespace-nowrap">Komisi</TableHead>
                            <TableHead className="text-center font-semibold text-slate-700">Aksi</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredDropshipData.map(order => (
                            <TableRow key={order.id} className="text-sm hover:bg-slate-50/50">
                              <TableCell className="whitespace-nowrap text-slate-600">{new Date(order.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                              <TableCell className="font-bold text-slate-900">{order.dropshipper?.full_name || 'N/A'}</TableCell>
                              <TableCell className="text-slate-600">#{order.invoice_number}</TableCell>
                              <TableCell className="font-medium text-slate-700">{order.customers?.name}</TableCell>
                              <TableCell className="text-right font-bold text-emerald-600">{formatCurrency(order.dropshipper_commission)}</TableCell>
                              <TableCell className="text-right px-4">
                                <Link to={`/orders/${order.id}`}><Button variant="outline" size="sm" className="h-8 w-8 p-0 border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg"><Eye className="h-4 w-4" /></Button></Link>
                              </TableCell>
                            </TableRow>
                          ))}
                          {filteredDropshipData.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400 italic">Tidak ada data komisi.</TableCell></TableRow>}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

          {isDraftExpanded && (
            <Card className="border border-purple-200 shadow-md bg-white rounded-2xl overflow-hidden">
              <CardHeader className="bg-purple-50/50 border-b border-purple-100 p-5">
                <CardTitle className="text-base font-bold text-purple-900 flex items-center gap-2"><ClipboardList className="h-5 w-5 text-purple-600" /> Rincian Order Draft</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[400px]">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                      <TableRow className="text-[11px] uppercase tracking-wider text-slate-500 border-slate-100">
                        <TableHead className="font-semibold px-5">Tgl Dibuat</TableHead>
                        <TableHead className="font-semibold">Pelanggan</TableHead>
                        <TableHead className="font-semibold text-right">Nilai Proyeksi</TableHead>
                        <TableHead className="text-center font-semibold px-5">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {draftOrders.map(order => (
                        <TableRow key={order.id} className="text-sm border-slate-100 hover:bg-slate-50/50">
                          <TableCell className="whitespace-nowrap font-medium text-slate-600 px-5">{new Date(order.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                          <TableCell className="font-medium text-slate-700">{order.customers?.name}</TableCell>
                          <TableCell className="text-right font-bold text-purple-600">{formatCurrency(order.grand_total)}</TableCell>
                          <TableCell className="text-right px-5">
                            <Link to={`/orders/${order.id}`}><Button variant="outline" size="sm" className="h-8 w-8 p-0 border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg"><Eye className="h-4 w-4" /></Button></Link>
                          </TableCell>
                        </TableRow>
                      ))}
                      {draftOrders.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-12 text-slate-400 font-medium">Tidak ada order draft saat ini.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {isInventoryExpanded && (
            <Card className="border border-orange-200 shadow-md bg-white rounded-2xl overflow-hidden">
              <CardHeader className="bg-orange-50/50 border-b border-orange-100 p-5">
                <CardTitle className="text-base font-bold text-orange-900 flex items-center gap-2"><Box className="h-5 w-5 text-orange-500" /> Rincian Nilai Stok (Berdasarkan HPP)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[400px]">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                      <TableRow className="text-[11px] uppercase tracking-wider text-slate-500 border-slate-100">
                        <TableHead className="font-semibold px-5">Produk</TableHead>
                        <TableHead className="font-semibold text-right">Stok</TableHead>
                        <TableHead className="font-semibold text-right whitespace-nowrap">HPP (Satuan)</TableHead>
                        <TableHead className="font-semibold text-right whitespace-nowrap px-5">Total HPP</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventoryData.map(p => (
                        <TableRow key={p.id} className="text-sm border-slate-100 hover:bg-slate-50/50">
                          <TableCell className="font-medium text-slate-800 px-5">{p.name}</TableCell>
                          <TableCell className="text-right whitespace-nowrap text-slate-600">{p.stock?.toLocaleString('id-ID')}</TableCell>
                          <TableCell className="text-right whitespace-nowrap text-slate-600">{formatCurrency(p.purchase_price)}</TableCell>
                          <TableCell className="text-right font-bold text-orange-600 whitespace-nowrap px-5">{formatCurrency(p.total_hpp)}</TableCell>
                        </TableRow>
                      ))}
                      {inventoryData.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-400 italic">Tidak ada stok produk aktif.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end p-4 bg-orange-50/50 border-t">
                  <span className="font-bold text-orange-700 text-sm whitespace-nowrap">TOTAL ESTIMASI NILAI STOK: {formatCurrency(totalInventoryCost)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {isProcurementExpanded && (
            <Card className="border border-red-200 shadow-md bg-white rounded-2xl overflow-hidden">
              <CardHeader className="bg-red-50/50 border-b border-red-100 p-5">
                <CardTitle className="text-base font-bold text-red-900 flex items-center gap-2"><FileText className="h-5 w-5 text-red-600" /> Kewajiban Pusat Aktif</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[400px]">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                      <TableRow className="text-[11px] uppercase tracking-wider text-slate-500 border-slate-100">
                        <TableHead className="font-semibold px-5 whitespace-nowrap">Tgl Order</TableHead>
                        <TableHead className="font-semibold whitespace-nowrap">No. SJ</TableHead>
                        <TableHead className="font-semibold text-right whitespace-nowrap">Total Transaksi</TableHead>
                        <TableHead className="font-semibold text-right whitespace-nowrap px-5">Sisa Tagihan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingProcurements.map(order => (
                        <TableRow key={order.id} className="text-sm border-slate-100 hover:bg-slate-50/50">
                          <TableCell className="whitespace-nowrap text-slate-600 px-5">{order.order_date}</TableCell>
                          <TableCell className="font-bold whitespace-nowrap text-slate-800">#{order.central_note_number || order.id.slice(0, 8)}</TableCell>
                          <TableCell className="text-right whitespace-nowrap text-slate-600">{formatCurrency(order.calculated_total)}</TableCell>
                          <TableCell className="text-right font-bold text-red-600 whitespace-nowrap px-5">{formatCurrency(order.balance_due)}</TableCell>
                        </TableRow>
                      ))}
                      {pendingProcurements.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-400 italic">Tidak ada tagihan aktif ke pusat.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {isPayoutExpanded && (
            <Card className="border border-amber-200 shadow-md bg-white rounded-2xl overflow-hidden">
              <CardHeader className="bg-amber-50/50 border-b border-amber-100 p-5">
                <CardTitle className="text-base font-bold text-amber-900 flex items-center gap-2"><ArrowRightLeft className="h-5 w-5 text-amber-600" /> Verifikasi Penarikan Komisi Dropship</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {/* Pending Requests */}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow className="text-[11px] uppercase tracking-wider text-slate-500 border-slate-100">
                        <TableHead className="font-semibold px-5">Tgl Pengajuan</TableHead>
                        <TableHead className="font-semibold">Dropshipper</TableHead>
                        <TableHead className="font-semibold">Info Rekening</TableHead>
                        <TableHead className="font-semibold text-right">Nominal</TableHead>
                        <TableHead className="text-center font-semibold px-5">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payoutRequests.map(req => (
                        <TableRow key={req.id} className="text-sm border-slate-100 hover:bg-slate-50">
                          <TableCell className="whitespace-nowrap text-xs text-slate-600 px-5">{new Date(req.created_at).toLocaleDateString('id-ID')}</TableCell>
                          <TableCell className="font-bold text-slate-900">{req.profiles?.full_name}</TableCell>
                          <TableCell className="font-medium text-slate-600 text-xs italic">{req.profiles?.rekening || 'Cek di profil'}</TableCell>
                          <TableCell className="text-right font-bold text-amber-600 text-base">{formatCurrency(req.amount)}</TableCell>
                          <TableCell className="text-center px-5 py-3">
                            <div className="flex gap-2 justify-center">
                              <Button size="sm" className="bg-[#011e4b] hover:bg-[#022a6b] text-white font-semibold rounded-lg h-9 px-4" onClick={() => handleOpenPayoutModal(req)}>Cairkan</Button>
                              <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 h-9 rounded-lg font-semibold" onClick={() => handleRejectPayout(req)}>Tolak</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {payoutRequests.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-400 italic">Tidak ada pengajuan aktif.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>

                {/* Payout History */}
                {payoutHistory.length > 0 && (
                  <div className="border-t border-slate-100 p-4">
                    <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><Clock className="h-4 w-4 text-slate-500" /> Riwayat Pencairan</h4>
                    <div className="overflow-x-auto max-h-[300px] border rounded-xl">
                      <Table>
                        <TableHeader className="sticky top-0 bg-slate-50 z-10">
                          <TableRow>
                            <TableHead className="font-semibold text-slate-700 whitespace-nowrap">Tgl Pengajuan</TableHead>
                            <TableHead className="font-semibold text-slate-700 whitespace-nowrap">Tgl Proses</TableHead>
                            <TableHead className="font-semibold text-slate-700">Dropshipper</TableHead>
                            <TableHead className="font-semibold text-slate-700 text-right whitespace-nowrap">Nominal</TableHead>
                            <TableHead className="text-center font-semibold text-slate-700">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {payoutHistory.map(req => (
                            <TableRow key={req.id} className="text-sm hover:bg-slate-50">
                              <TableCell className="whitespace-nowrap text-xs text-slate-600">{new Date(req.created_at).toLocaleDateString('id-ID')}</TableCell>
                              <TableCell className="whitespace-nowrap text-xs text-slate-600">{req.updated_at ? new Date(req.updated_at).toLocaleDateString('id-ID') : '-'}</TableCell>
                              <TableCell className="font-medium text-slate-800 whitespace-nowrap">{req.profiles?.full_name}</TableCell>
                              <TableCell className="text-right font-bold text-slate-800 whitespace-nowrap">{formatCurrency(req.amount)}</TableCell>
                              <TableCell className="text-center">
                                <Badge className={`text-[9px] font-bold border ${req.status === 'completed' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                                  {req.status === 'completed' ? 'Dicairkan' : 'Ditolak'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ANALYTICS SECTION — Posisi Keuangan, Neraca, Rasio (Admin only) */}
      {isPrivileged && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 items-start">

          {/* Donut Pie Chart — Ringkasan Posisi Keuangan */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-3 md:mb-4">Ringkasan Posisi Keuangan</h3>
            <div className="flex flex-col lg:flex-row items-center gap-4 lg:gap-6">
              <div className="h-40 w-40 relative flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} innerRadius={50} outerRadius={72} paddingAngle={2} dataKey="value" stroke="none">
                      {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <RechartsTooltip formatter={(val) => formatCurrency(val)} wrapperStyle={{ zIndex: 9999 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-[10px] text-slate-500 font-medium">Total Aset</span>
                  <span className="text-[11px] font-bold text-slate-800">{formatShortCurrency(totalAset)}</span>
                </div>
              </div>
              <div className="flex flex-col gap-3 w-full">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded bg-blue-500"></div><span className="text-slate-600">Kas</span></div>
                  <div className="text-slate-800 font-medium text-right flex flex-col">
                    <span>{formatShortCurrency(reportData.totalBalance)}</span>
                    <span className="text-[9px] text-slate-400 font-normal">{((reportData.totalBalance / (totalAset || 1)) * 100).toFixed(1)}%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded bg-green-500"></div><span className="text-slate-600">Piutang</span></div>
                  <div className="text-slate-800 font-medium text-right flex flex-col">
                    <span>{formatShortCurrency(totalPending)}</span>
                    <span className="text-[9px] text-slate-400 font-normal">{((totalPending / (totalAset || 1)) * 100).toFixed(1)}%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded bg-orange-500"></div><span className="text-slate-600">Persediaan</span></div>
                  <div className="text-slate-800 font-medium text-right flex flex-col">
                    <span>{formatShortCurrency(totalInventoryCost)}</span>
                    <span className="text-[9px] text-slate-400 font-normal">{((totalInventoryCost / (totalAset || 1)) * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Posisi Neraca */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 shadow-sm flex flex-col">
            <h3 className="text-sm font-bold text-slate-800 mb-4 md:mb-6">Posisi Neraca</h3>
            <div className="flex flex-col sm:flex-row justify-between mb-4 gap-6 sm:gap-4">
              <div className="space-y-3 w-full sm:w-1/2">
                <div>
                  <div className="text-[11px] font-semibold text-blue-600 mb-0.5 uppercase tracking-wide">Aset</div>
                  <div className="text-xs md:text-sm font-bold text-slate-800">{formatCurrency(totalAset)}</div>
                </div>
                <div className="space-y-1.5 border-l-2 border-blue-100 pl-2">
                  <div><div className="text-[10px] text-slate-500">Kas</div><div className="text-[11px] font-medium text-slate-700">{formatCurrency(reportData.totalBalance)}</div></div>
                  <div><div className="text-[10px] text-slate-500">Piutang</div><div className="text-[11px] font-medium text-slate-700">{formatCurrency(totalPending)}</div></div>
                  <div><div className="text-[10px] text-slate-500">Persediaan</div><div className="text-[11px] font-medium text-slate-700">{formatCurrency(totalInventoryCost)}</div></div>
                </div>
              </div>
              <div className="space-y-3 w-full sm:w-1/2">
                <div>
                  <div className="text-[11px] font-semibold text-red-600 mb-0.5 uppercase tracking-wide">Liabilitas</div>
                  <div className="text-xs md:text-sm font-bold text-slate-800">{formatCurrency(totalLiabilitas)}</div>
                </div>
                <div className="space-y-1.5 border-l-2 border-red-100 pl-2">
                  <div><div className="text-[10px] text-slate-500">Utang Pusat</div><div className="text-[11px] font-medium text-slate-700">{formatCurrency(totalProcurementPending)}</div></div>
                </div>
              </div>
            </div>
            <div className="mt-auto border-t border-slate-100 pt-3 flex justify-between items-end">
              <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Ekuitas</div>
              <div className="text-sm font-bold text-emerald-600">{formatCurrency(totalEkuitas)}</div>
            </div>
          </div>

          {/* Rasio Keuangan */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 shadow-sm flex flex-col">
            <h3 className="text-sm font-bold text-slate-800 mb-4 md:mb-6">Rasio Keuangan</h3>
            <div className="space-y-5 flex-grow">

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-1 group relative">
                    <span className="text-xs font-medium text-slate-700 border-b border-dashed border-slate-400 cursor-help">Current Ratio</span>
                    <Info className="h-3 w-3 text-slate-400" />
                    <div className="opacity-0 invisible group-hover:opacity-100 group-hover:visible absolute left-0 bottom-full mb-2 w-56 p-3 bg-slate-800 text-white text-[10px] rounded-xl shadow-xl z-[9999] transition-all">
                      <p className="font-semibold mb-1">Kemampuan bayar hutang pendek</p>
                      <p className="text-slate-300">Rumus: Total Aset / Kewajiban Pusat</p>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs font-bold text-slate-800">{currentRatio}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${currentRatioColor}`}>{currentRatioLabel}</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className={`${currentRatioBarColor} h-full rounded-full transition-all`} style={{ width: `${currentRatioBar}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-1 group relative">
                    <span className="text-xs font-medium text-slate-700 border-b border-dashed border-slate-400 cursor-help">Debt to Asset</span>
                    <Info className="h-3 w-3 text-slate-400" />
                    <div className="opacity-0 invisible group-hover:opacity-100 group-hover:visible absolute left-0 bottom-full mb-2 w-56 p-3 bg-slate-800 text-white text-[10px] rounded-xl shadow-xl z-[9999] transition-all">
                      <p className="font-semibold mb-1">Persentase aset dibiayai hutang</p>
                      <p className="text-slate-300">Rumus: (Total Utang / Total Aset) × 100%</p>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs font-bold text-slate-800">{debtToAsset}%</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${debtToAssetColor}`}>{debtToAssetLabel}</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className={`${debtToAssetBarColor} h-full rounded-full transition-all`} style={{ width: `${Math.min(debtToAssetVal, 100)}%` }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-1 group relative">
                    <span className="text-xs font-medium text-slate-700 border-b border-dashed border-slate-400 cursor-help">Cash Ratio</span>
                    <Info className="h-3 w-3 text-slate-400" />
                    <div className="opacity-0 invisible group-hover:opacity-100 group-hover:visible absolute left-0 bottom-full mb-2 w-56 p-3 bg-slate-800 text-white text-[10px] rounded-xl shadow-xl z-[9999] transition-all">
                      <p className="font-semibold mb-1">Likuiditas Paling Konservatif</p>
                      <p className="text-slate-300">Rumus: Kas Tersedia / Kewajiban Pusat</p>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="text-xs font-bold text-slate-800">{cashRatio}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${cashRatioColor}`}>{cashRatioLabel}</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div className={`${cashRatioBarColor} h-full rounded-full transition-all`} style={{ width: `${cashRatioBar}%` }}></div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* PAYMENT METHODS */}
      <div id="payment-methods-section" className="mt-4 mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Metode Pembayaran</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportData.balances.map(item => (
          <Card
            key={item.id}
            className={`border transition-all duration-200 cursor-pointer rounded-2xl group ${expandedMethodId === item.id ? 'border-[#011e4b] shadow-lg ring-1 ring-[#011e4b] bg-[#011e4b] text-white' : 'border-slate-200/60 shadow-sm bg-white hover:border-slate-300 hover:shadow-md'}`}
            onClick={() => handleCardClick(item.id)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-5 pb-3">
              <CardTitle className={`text-sm font-semibold truncate pr-2 ${expandedMethodId === item.id ? 'text-slate-200' : 'text-slate-600'}`}>{item.method_name}</CardTitle>
              <div className={`p-2 rounded-xl ${expandedMethodId === item.id ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-[#011e4b] group-hover:text-white transition-colors'}`}>
                {item.type === 'cash' ? <Banknote className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
              </div>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <div className="text-2xl font-bold tracking-tight">{formatCurrency(item.balance)}</div>
              <div className={`flex justify-between items-center mt-4 pt-3 border-t text-xs font-medium ${expandedMethodId === item.id ? 'border-white/10 text-slate-300' : 'border-slate-100 text-slate-500'}`}>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] uppercase tracking-wider opacity-70">Masuk</span>
                  <span className={expandedMethodId === item.id ? 'text-emerald-400 font-bold' : 'text-emerald-600 font-bold'}>{formatCurrency(item.income)}</span>
                </div>
                <div className="flex flex-col gap-0.5 text-right">
                  <span className="text-[10px] uppercase tracking-wider opacity-70">Keluar</span>
                  <span className={expandedMethodId === item.id ? 'text-rose-400 font-bold' : 'text-rose-600 font-bold'}>{formatCurrency(item.expense)}</span>
                </div>
              </div>
              {item.type === 'transfer' && (
                <p className={`text-[10px] mt-3 truncate italic font-medium ${expandedMethodId === item.id ? 'text-slate-400' : 'text-slate-400'}`}>
                  {item.account_name} - {item.account_number}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* EXPANDED METHOD — Daily Records & Transaction History */}
      {expandedMethodId && (
        <div className="space-y-6 mt-6 animate-in fade-in duration-500 slide-in-from-bottom-4">
          {/* Daily Records */}
          <Card className="border border-slate-200/60 shadow-md bg-white rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
              <div className="space-y-1">
                <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-slate-500" /> Analisis Mutasi: {expandedMethod.method_name}
                </CardTitle>
                <CardDescription className="font-medium text-slate-500">Rekapitulasi transaksi harian untuk keperluan rekonsiliasi.</CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
                <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-full sm:w-auto">
                  <div className="flex flex-col px-3 py-1">
                    <Label className="text-[9px] uppercase tracking-widest font-bold text-slate-400 mb-1">Mulai</Label>
                    <Input type="date" value={dailyRecordStartDate} onChange={e => setDailyRecordStartDate(e.target.value)} className="h-7 border-0 bg-transparent p-0 text-xs font-semibold focus-visible:ring-0 shadow-none w-[110px]" />
                  </div>
                  <div className="w-px h-8 bg-slate-200 mx-1"></div>
                  <div className="flex flex-col px-3 py-1">
                    <Label className="text-[9px] uppercase tracking-widest font-bold text-slate-400 mb-1">Akhir</Label>
                    <Input type="date" value={dailyRecordEndDate} onChange={e => setDailyRecordEndDate(e.target.value)} className="h-7 border-0 bg-transparent p-0 text-xs font-semibold focus-visible:ring-0 shadow-none w-[110px]" />
                  </div>
                </div>
                <Button onClick={handleExportDailyRecords} className="h-[46px] px-5 w-full sm:w-auto bg-[#011e4b] text-white hover:bg-[#022a6b] font-semibold rounded-xl shadow-sm text-xs" disabled={!selectedMethodDailyRecord || selectedMethodDailyRecord.records.length === 0 || loadingHistory}>
                  <Download className="h-4 w-4 mr-2" /> Export
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {selectedMethodDailyRecord && !loadingHistory && (
                <div className="flex flex-wrap gap-4 mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex flex-col"><span className="text-[10px] uppercase font-bold text-slate-400">Total Masuk</span><span className="text-sm font-bold text-emerald-600">{formatCurrency(selectedMethodDailyRecord.totalIncome)}</span></div>
                  <div className="w-px bg-slate-200"></div>
                  <div className="flex flex-col"><span className="text-[10px] uppercase font-bold text-slate-400">Total Keluar</span><span className="text-sm font-bold text-rose-600">{formatCurrency(selectedMethodDailyRecord.totalExpense)}</span></div>
                  <div className="w-px bg-slate-200"></div>
                  <div className="flex flex-col"><span className="text-[10px] uppercase font-bold text-slate-400">Saldo Akhir Periode</span><span className="text-sm font-bold text-slate-900">{formatCurrency(selectedMethodDailyRecord.endingBalance)}</span></div>
                </div>
              )}
              {loadingHistory ? (
                <div className="flex justify-center items-center h-32"><Loader2 className="h-6 w-6 animate-spin text-slate-500" /></div>
              ) : selectedMethodDailyRecord && selectedMethodDailyRecord.records.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="overflow-x-auto">
                    <Table className="min-w-[700px]">
                      <TableHeader className="bg-slate-50">
                        <TableRow className="text-[11px] uppercase tracking-wider text-slate-500 border-slate-200">
                          <TableHead className="font-semibold px-4">Tanggal</TableHead>
                          <TableHead className="font-semibold text-right">Debit (Masuk)</TableHead>
                          <TableHead className="font-semibold text-right">Kredit (Keluar)</TableHead>
                          <TableHead className="font-semibold text-right">Saldo Awal</TableHead>
                          <TableHead className="font-semibold text-right text-slate-900 px-4">Saldo Akhir</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedMethodDailyRecord.records.map(day => (
                          <TableRow key={day.date} className="text-sm border-slate-100 hover:bg-slate-50">
                            <TableCell className="font-medium text-slate-700 px-4">{new Date(day.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                            <TableCell className="text-right text-emerald-600 font-medium">{day.income > 0 ? formatCurrency(day.income) : '-'}</TableCell>
                            <TableCell className="text-right text-rose-600 font-medium">{day.expense > 0 ? formatCurrency(day.expense) : '-'}</TableCell>
                            <TableCell className="text-right text-slate-500">{formatCurrency(day.startingBalance)}</TableCell>
                            <TableCell className={`text-right font-bold px-4 ${day.endingBalance < 0 ? 'text-rose-700' : 'text-slate-900'} bg-slate-50/50`}>{formatCurrency(day.endingBalance)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <p className="text-sm font-semibold text-slate-500">Belum ada mutasi</p>
                  <p className="text-xs text-slate-400 mt-1">Ubah rentang waktu untuk melihat data histori.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Transaction History */}
          <Card className="border border-slate-200/60 shadow-md bg-white rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-slate-500" /> Buku Besar Transaksi
              </CardTitle>
              <Button onClick={handleExportTransactions} variant="outline" className="h-9 text-xs font-semibold bg-white border-slate-200 text-slate-700 w-full sm:w-auto rounded-xl" disabled={filteredMethodTransactions.length === 0}>
                <Download className="h-3.5 w-3.5 mr-2" /> Download Laporan Mutasi
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[600px]">
                {loadingHistory ? (
                  <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
                ) : (
                  <Table className="min-w-[900px]">
                    <TableHeader className="sticky top-0 bg-slate-50 z-20 shadow-sm">
                      <TableRow className="text-[11px] uppercase tracking-wider text-slate-500 border-slate-200">
                        <TableHead className="font-semibold px-5">Tgl</TableHead>
                        <TableHead className="font-semibold">Tipe</TableHead>
                        <TableHead className="font-semibold text-right">Masuk</TableHead>
                        <TableHead className="font-semibold text-right">Keluar</TableHead>
                        <TableHead className="font-semibold text-right">Saldo Saat Ini</TableHead>
                        <TableHead className="font-semibold w-1/3">Keterangan / Deskripsi</TableHead>
                        <TableHead className="text-center font-semibold px-5">Opsi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMethodTransactions.map(t => (
                        <TableRow key={t.id} className="text-sm hover:bg-slate-50 border-slate-100 transition-colors">
                          <TableCell className="whitespace-nowrap font-medium text-slate-700 px-5">{new Date(t.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] px-2 py-0.5 border-0 font-semibold ${t.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                              {t.type === 'income' ? 'IN' : 'OUT'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-emerald-600 font-medium">{t.type === 'income' ? formatCurrency(t.amount) : '-'}</TableCell>
                          <TableCell className="text-right text-rose-600 font-medium">{t.type === 'expense' ? formatCurrency(t.amount) : '-'}</TableCell>
                          <TableCell className="text-right font-bold text-slate-900">{formatCurrency(t.runningBalance)}</TableCell>
                          <TableCell className="max-w-[250px] truncate text-slate-600 font-medium">{t.description}</TableCell>
                          <TableCell className="px-5">
                            <div className="flex gap-2 justify-center">
                              {t.proofUrl && (
                                <a href={getProofUrl(t.proofUrl)} target="_blank" rel="noreferrer">
                                  <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 rounded-lg">
                                    <FileText className="h-4 w-4" />
                                  </Button>
                                </a>
                              )}
                              {(userRole === 'admin' || userRole === 'super_admin') && (
                                <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 rounded-lg transition-colors" onClick={() => handleDeleteTransaction(t)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredMethodTransactions.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-10 text-slate-400 font-medium">Tidak ada transaksi ditemukan.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* BOTTOM: Arus Kas + Piutang Terbesar + Utang Terbesar (Admin only) */}
      {isPrivileged && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-10">

          {/* Arus Kas Ringkasan */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col overflow-hidden">
            <h3 className="text-sm font-bold text-slate-800 mb-6">Arus Kas (Ringkasan)</h3>
            <div className="space-y-4 flex-grow">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">Saldo Awal (Estimasi)</span>
                <span className="text-xs font-medium text-slate-700">{formatCurrency(startingBalEstimate)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">Kas Masuk</span>
                <span className="text-xs font-medium text-emerald-600">{formatCurrency(totalIncomeAll)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">Kas Keluar</span>
                <span className="text-xs font-medium text-rose-600">({formatCurrency(totalExpenseAll)})</span>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center bg-blue-50/50 -mx-6 px-6 pb-2">
              <span className="text-xs font-bold text-[#011e4b]">Saldo Akhir</span>
              <span className="text-sm font-bold text-[#011e4b]">{formatCurrency(reportData.totalBalance)}</span>
            </div>
          </div>

          {/* Piutang Terbesar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-800">Piutang Terbesar</h3>
              <span className="text-[11px] text-[#011e4b] cursor-pointer hover:underline" onClick={() => toggleSection(setIsPendingExpanded, false)}>Lihat Semua</span>
            </div>
            <div className="space-y-3 overflow-x-auto">
              <div className="min-w-[300px]">
                <div className="flex justify-between text-[10px] font-semibold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100 gap-2">
                  <span className="w-1/3">Pelanggan</span>
                  <span className="w-1/3 text-right">Jumlah</span>
                  <span className="w-1/3 text-right hidden sm:block">Tgl Kirim</span>
                </div>
                {topPiutang.length > 0 ? topPiutang.map(p => (
                  <div key={p.id} className="flex justify-between text-xs items-center py-1.5 gap-2 border-b border-slate-50 last:border-0">
                    <span className="w-1/3 text-slate-700 truncate font-medium">{p.customers?.name}</span>
                    <span className="w-1/3 text-right text-slate-800 font-semibold">{formatCurrency(p.grand_total)}</span>
                    <span className="w-1/3 text-right text-slate-500 hidden sm:block">{p.delivered_at ? new Date(p.delivered_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-'}</span>
                  </div>
                )) : <div className="text-center text-xs text-slate-400 py-4">Tidak ada data piutang</div>}
              </div>
            </div>
          </div>

          {/* Utang Terbesar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-800">Utang Terbesar</h3>
              <span className="text-[11px] text-[#011e4b] cursor-pointer hover:underline" onClick={() => toggleSection(setIsProcurementExpanded, false)}>Lihat Semua</span>
            </div>
            <div className="space-y-3 overflow-x-auto">
              <div className="min-w-[300px]">
                <div className="flex justify-between text-[10px] font-semibold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100 gap-2">
                  <span className="w-1/3">No. Ref</span>
                  <span className="w-1/3 text-right">Jumlah</span>
                  <span className="w-1/3 text-right hidden sm:block">Tgl Order</span>
                </div>
                {topUtang.length > 0 ? topUtang.map(u => (
                  <div key={u.id} className="flex justify-between text-xs items-center py-1.5 gap-2 border-b border-slate-50 last:border-0">
                    <span className="w-1/3 text-slate-700 truncate font-medium">#{u.central_note_number || u.id.slice(0, 5)}</span>
                    <span className="w-1/3 text-right text-slate-800 font-semibold">{formatCurrency(u.balance_due)}</span>
                    <span className="w-1/3 text-right text-rose-500 hidden sm:block">{u.order_date ? new Date(u.order_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-'}</span>
                  </div>
                )) : <div className="text-center text-xs text-slate-400 py-4">Tidak ada data utang</div>}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* DIALOGS */}
      <Dialog open={isTransferModalOpen} onOpenChange={setIsTransferModalOpen}>
        <DialogContent className="sm:max-w-[425px] p-0 rounded-2xl overflow-hidden bg-white border-0 shadow-2xl">
          <div className="bg-slate-50 p-6 border-b border-slate-100">
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-slate-500" /> Transfer Dana Antar Kas
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm text-slate-500 font-medium">
              Pindahkan saldo antar metode pembayaran / rekening bank internal perusahaan.
            </DialogDescription>
          </div>
          <form onSubmit={handleTransferSubmit} className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Sumber Dana</Label>
                <Select value={transferForm.from_method_id} onValueChange={v => setTransferForm(prev => ({ ...prev, from_method_id: v }))} required>
                  <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium"><SelectValue placeholder="Pilih..." /></SelectTrigger>
                  <SelectContent>{paymentMethods.map(m => <SelectItem key={m.id} value={m.id}>{m.method_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Tujuan Dana</Label>
                <Select value={transferForm.to_method_id} onValueChange={v => setTransferForm(prev => ({ ...prev, to_method_id: v }))} required>
                  <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium"><SelectValue placeholder="Pilih..." /></SelectTrigger>
                  <SelectContent>{allMethods.map(m => <SelectItem key={m.id} value={m.id}>{m.method_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Nominal Transfer</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><span className="text-slate-500 font-semibold sm:text-sm">Rp</span></div>
                <Input type="number" value={transferForm.amount} onChange={e => setTransferForm(prev => ({ ...prev, amount: e.target.value }))} className="h-11 pl-9 rounded-xl border-slate-200 font-bold text-lg" placeholder="0" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Biaya Admin</Label>
                <Input type="number" value={transferForm.admin_fee} onChange={e => setTransferForm(prev => ({ ...prev, admin_fee: e.target.value }))} className="h-10 rounded-xl border-slate-200 font-medium" placeholder="Rp 0" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Bukti (Opsional)</Label>
                <Input type="file" accept="image/*" onChange={e => setTransferForm(prev => ({ ...prev, proof_file: e.target.files }))} className="h-10 text-xs rounded-xl border-slate-200 cursor-pointer" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Keterangan Tambahan</Label>
              <Input value={transferForm.description} onChange={e => setTransferForm(prev => ({ ...prev, description: e.target.value }))} className="h-10 rounded-xl border-slate-200 font-medium" placeholder="Contoh: Setoran uang kasir ke bank BCA" />
            </div>
            <div className="pt-4 flex gap-3">
              <Button type="button" variant="outline" className="flex-1 rounded-xl h-11 font-semibold text-slate-600 hover:bg-slate-50" onClick={() => setIsTransferModalOpen(false)}>Batal</Button>
              <Button type="submit" disabled={isSubmitting} className="flex-1 rounded-xl h-11 font-semibold bg-[#011e4b] hover:bg-[#022a6b] text-white shadow-md">
                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Selesaikan Transfer'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {isAddPaymentOpen && selectedPayoutRequest && (
        <AddPaymentModal
          isOpen={isAddPaymentOpen}
          onOpenChange={setIsAddPaymentOpen}
          order={{
            id: selectedPayoutRequest.id, isVirtual: true, company_id: companyId,
            grand_total: selectedPayoutRequest.amount, payments: [],
            invoice_number: `PAYOUT-${(selectedPayoutRequest.profiles?.full_name || '').split(' ').join('_').toUpperCase()}`
          }}
          onPaymentAdded={onPayoutSuccess}
        />
      )}
      <WhatsappTemplateSettingsModal isOpen={isTemplateModalOpen} onOpenChange={open => { setIsTemplateModalOpen(open); if (!open) fetchActiveTemplates(); }} />
    </div>
  );
};

export default FinancialReportPage;
