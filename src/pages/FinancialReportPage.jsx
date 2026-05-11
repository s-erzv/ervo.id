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
  AlertCircle
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
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import CryptoJS from 'crypto-js';
import AddPaymentModal from '@/components/AddPaymentModal';

const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'fallback-key-proyek-rahasia';
const MAX_FILE_SIZE = 1 * 1024 * 1024;
const TARGET_SIZE_MB = 0.5;

// === UTILITY FUNCTIONS ===
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

// === MAIN COMPONENT ===
const FinancialReportPage = () => {
  const { companyId, userId, userRole, companyName } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allMethods, setAllMethods] = useState([]);
  const [reportData, setReportData] = useState({ totalBalance: 0, balances: [] });
  const [paymentMethods, setPaymentMethods] = useState([]);
  
  // Pending Orders (Piutang)
  const [pendingOrders, setPendingOrders] = useState([]);
  const [totalPending, setTotalPending] = useState(0);
  const [isPendingExpanded, setIsPendingExpanded] = useState(false);
  const [pendingByDate, setPendingByDate] = useState([]);
  
  // Draft Orders
  const [draftOrders, setDraftOrders] = useState([]);
  const [totalDraftProjection, setTotalDraftProjection] = useState(0);
  const [isDraftExpanded, setIsDraftExpanded] = useState(false);
  
  // Transfers & Modals
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [activeTemplates, setActiveTemplates] = useState({});
  const [processingWA, setProcessingWA] = useState({});
  
  // Payouts
  const [payoutRequests, setPayoutRequests] = useState([]);
  const [isPayoutExpanded, setIsPayoutExpanded] = useState(false);
  const [totalPayoutPending, setTotalPayoutPending] = useState(0);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [selectedPayoutRequest, setSelectedPayoutRequest] = useState(null);

  // Dropship Commission
  const [dropshipOrders, setDropshipOrders] = useState([]);
  const [isDropshipExpanded, setIsDropshipExpanded] = useState(false);
  const [selectedDropshipperId, setSelectedDropshipperId] = useState('all');

  const fetchPayoutRequests = async () => {
    const { data, error } = await supabase
      .from('payout_requests')
      .select('*, profiles:dropshipper_id (full_name, rekening)')
      .eq('company_id', companyId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (!error) {
      setPayoutRequests(data || []);
      setTotalPayoutPending(data?.reduce((sum, r) => sum + parseFloat(r.amount), 0) || 0);
    }
  };

  const sendViaFonnte = async (targetPhone, message) => {
    try {
      const { data: companyData } = await supabase
        .from('companies').select('fonnte_token').eq('id', companyId).single();
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
    } catch (err) {
      console.error('Fonnte Error:', err);
      return false;
    }
  };

  useEffect(() => {
    if (companyId) {
      fetchFinancialData();
      fetchActiveTemplates();
      fetchPayoutRequests();
    }
  }, [companyId]);

  const fetchActiveTemplates = async () => {
    const { data } = await supabase
      .from('whatsapp_templates').select('template_name, template_text').eq('company_id', companyId);
    if (data) {
      const map = {};
      data.forEach(t => { map[t.template_name] = t.template_text; });
      setActiveTemplates(map);
    }
  };

  const handleReminderWA = async (order) => {
    const customerName = order.customers?.name || 'Bapak/Ibu';
    const phone = (order.customers?.phone || '').replace(/[^\d]/g, '');
    const invoiceNum = order.invoice_number;
    const sisaTagihan = formatCurrency(order.grand_total);
    if (!phone) { toast.error('Nomor WhatsApp pelanggan tidak ditemukan.'); return; }
    if (processingWA[order.id]) return;
    
    setProcessingWA(prev => ({ ...prev, [order.id]: true }));
    const tid = toast.loading(`Menyiapkan pengingat untuk ${customerName}...`);
    try {
      let paymentMethodDisplay = 'Transfer Bank / Tunai';
      const transferMethod = allMethods.find(m => m.type === 'transfer' && m.is_active) || allMethods[0];
      if (transferMethod && transferMethod.type === 'transfer') {
        paymentMethodDisplay = `${transferMethod.method_name} ${transferMethod.account_number} a.n ${transferMethod.account_name || ''}`;
      }
      const template = activeTemplates['payment_reminder_finance'] || activeTemplates['payment_reminder'] || `Tagihan #{{invoiceNum}} sisa {{sisaTagihan}}.`;
      const whatsappMessage = template
        .replace(/{{customerName}}/g, customerName)
        .replace(/{{invoiceNo}}/g, invoiceNum)
        .replace(/{{invoiceNum}}/g, invoiceNum)
        .replace(/{{sisaTagihan}}/g, sisaTagihan)
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

  const [transferForm, setTransferForm] = useState({
    amount: '', from_method_id: '', to_method_id: '', description: '', admin_fee: '', proof_file: null,
  });

  // --- DEFAULT PERIOD: START OF MONTH TO TODAY ---
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const todayStr = now.toISOString().split('T')[0];

  const [dailyRecordStartDate, setDailyRecordStartDate] = useState(firstDayOfMonth);
  const [dailyRecordEndDate, setDailyRecordEndDate] = useState(todayStr);
  const [expandedMethodId, setExpandedMethodId] = useState(null);
  const [methodTransactions, setMethodTransactions] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const expandedMethod = paymentMethods.find(m => m.id === expandedMethodId) || {};

  const getProofUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http')) return path;
    return `${SUPABASE_STORAGE_URL}${path}`;
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount ?? 0);

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      const isPrivileged = userRole === 'admin' || userRole === 'super_admin';
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
        { data: unpaidOrdersData, error: unpaidError },
        { data: draftData, error: draftError },
        { data: dsData, error: dsError }
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
          .select('id, invoice_number, created_at, grand_total, dropshipper_commission, dropshipper:dropshipper_id(id, full_name), customers(name)')
          .eq('company_id', companyId)
          .gt('dropshipper_commission', 0)
          .not('status', 'eq', 'cancelled')
          .order('created_at', { ascending: false })
      ]);
      
      if (unpaidError) throw unpaidError;
      if (draftError) throw draftError;
      if (dsError) throw dsError;
      
      setPendingOrders(unpaidOrdersData || []);
      setTotalPending((unpaidOrdersData || []).reduce((sum, o) => sum + (parseFloat(o.grand_total) || 0), 0));
      setDraftOrders(draftData || []);
      setTotalDraftProjection((draftData || []).reduce((sum, o) => sum + (parseFloat(o.grand_total) || 0), 0));
      
      setDropshipOrders(dsData || []);

      const groupedByDate = (unpaidOrdersData || []).reduce((acc, order) => {
        const dateKey = order.planned_date || order.created_at.split('T')[0];
        if (!acc[dateKey]) acc[dateKey] = { date: dateKey, total: 0, count: 0 };
        acc[dateKey].total += (parseFloat(order.grand_total) || 0);
        acc[dateKey].count += 1;
        return acc;
      }, {});
      setPendingByDate(Object.values(groupedByDate).sort((a, b) => new Date(a.date) - new Date(b.date)));
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
            id: t.id,
            date: t.transaction_date,
            type: t.type,
            amount: parseFloat(t.amount),
            description: t.description,
            sourceTable: t.source_table,
            proofUrl: t.proof_url
        }));
        
        pData.forEach(p => combined.push({
            id: p.id,
            date: p.paid_at || p.created_at,
            type: 'income',
            amount: parseFloat(p.amount),
            description: `Pembayaran #${p.orders?.invoice_number} - ${p.orders?.customers?.name}`,
            sourceTable: 'payments',
            proofUrl: p.proof_url
        }));
        
        combined.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        let currentRunningBalance = 0;
        const reconciled = combined.map(t => {
            const startBal = currentRunningBalance;
            currentRunningBalance += (t.type === 'income' ? t.amount : -t.amount);
            return { 
                ...t, 
                startingBalance: startBal, 
                runningBalance: currentRunningBalance 
            };
        });
        
        setMethodTransactions(reconciled.reverse());
    } catch (error) {
        toast.error("Gagal memuat mutasi");
    } finally {
        setLoadingHistory(false);
    }
  };

  const selectedMethodDailyRecord = useMemo(() => {
    if (!expandedMethodId) return null;
    const currentMethod = paymentMethods.find(m => m.id === expandedMethodId);
    if (!currentMethod) return null;
    
    if (!methodTransactions || methodTransactions.length === 0) {
      return {
        method_name: currentMethod.method_name || 'Unknown',
        startDate: dailyRecordStartDate,
        endDate: dailyRecordEndDate,
        records: [],
        totalIncome: 0,
        totalExpense: 0,
        endingBalance: 0,
      };
    }

    const ascTx = [...methodTransactions].reverse();
    const startObj = new Date(dailyRecordStartDate);
    startObj.setHours(0, 0, 0, 0);
    const endObj = new Date(dailyRecordEndDate);
    endObj.setHours(23, 59, 59, 999);

    let periodStartingBalance = 0;
    const txInPeriod = [];

    ascTx.forEach(t => {
      const txDate = new Date(t.date);
      if (txDate < startObj) {
        periodStartingBalance += (t.type === 'income' ? t.amount : -t.amount);
      } else if (txDate <= endObj) {
        txInPeriod.push(t);
      }
    });

    const dailySummary = {};
    let totalIncome = 0;
    let totalExpense = 0;

    txInPeriod.forEach(t => {
      const d = new Date(t.date);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!dailySummary[dateKey]) dailySummary[dateKey] = { date: dateKey, income: 0, expense: 0 };
      if (t.type === 'income') {
        dailySummary[dateKey].income += t.amount;
        totalIncome += t.amount;
      } else {
        dailySummary[dateKey].expense += t.amount;
        totalExpense += t.amount;
      }
    });

    const dateRange = [];
    let curr = new Date(startObj);
    while (curr <= endObj) {
      const dateKey = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`;
      dateRange.push(dateKey);
      curr.setDate(curr.getDate() + 1);
    }

    const finalAggregatedRecords = [];
    let chainedBalance = periodStartingBalance;
    dateRange.forEach(dateKey => {
      const dayData = dailySummary[dateKey] || { date: dateKey, income: 0, expense: 0 };
      const startBal = chainedBalance;
      const netChange = dayData.income - dayData.expense;
      const endBal = startBal + netChange;
      finalAggregatedRecords.push({
        date: dateKey, income: dayData.income, expense: dayData.expense,
        startingBalance: startBal, endingBalance: endBal,
      });
      chainedBalance = endBal;
    });
    finalAggregatedRecords.reverse();
    return {
      method_name: currentMethod.method_name || 'Unknown',
      startDate: dailyRecordStartDate, endDate: dailyRecordEndDate,
      records: finalAggregatedRecords, totalIncome, totalExpense,
      endingBalance: periodStartingBalance + totalIncome - totalExpense,
    };
  }, [expandedMethodId, methodTransactions, dailyRecordStartDate, dailyRecordEndDate, paymentMethods]);

  const filteredMethodTransactions = useMemo(() => {
    if (!methodTransactions || !dailyRecordStartDate || !dailyRecordEndDate) return methodTransactions;
    const start = new Date(dailyRecordStartDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dailyRecordEndDate);
    end.setHours(23, 59, 59, 999);
    return methodTransactions.filter(t => {
      const txDate = new Date(t.date);
      return txDate >= start && txDate <= end;
    });
  }, [methodTransactions, dailyRecordStartDate, dailyRecordEndDate]);

  const filteredDropshipData = useMemo(() => {
    if (!dropshipOrders || dropshipOrders.length === 0) return [];
    let data = dropshipOrders;
    if (selectedDropshipperId !== 'all') {
      data = data.filter(o => o.dropshipper?.id === selectedDropshipperId);
    }
    return data;
  }, [dropshipOrders, selectedDropshipperId]);

  const uniqueDropshippers = useMemo(() => {
    if (!dropshipOrders) return [];
    const map = new Map();
    dropshipOrders.forEach(o => {
      if (o.dropshipper?.id && o.dropshipper?.full_name) {
        map.set(o.dropshipper.id, o.dropshipper.full_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [dropshipOrders]);

  const currentPeriodDropshipTotal = useMemo(() => {
    return filteredDropshipData.reduce((sum, o) => sum + (parseFloat(o.dropshipper_commission) || 0), 0);
  }, [filteredDropshipData]);

  const handleExportDropshipCommission = () => {
    if (filteredDropshipData.length === 0) { toast.error('Tidak ada data komisi untuk diekspor.'); return; }
    const dropshipperName = selectedDropshipperId === 'all' ? 'Semua' : uniqueDropshippers.find(d => d.id === selectedDropshipperId)?.name;
    const exportData = filteredDropshipData.map(o => ({
      Tanggal: new Date(o.created_at).toLocaleDateString('id-ID'),
      'No. Invoice': o.invoice_number,
      Dropshipper: o.dropshipper?.full_name || 'N/A',
      Pelanggan: o.customers?.name || 'N/A',
      'Total Order': o.grand_total,
      'Komisi Dropship': o.dropshipper_commission,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Komisi Dropship');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `Laporan_Komisi_Dropship_${dropshipperName}_Keseluruhan.xlsx`);
    toast.success('Data komisi berhasil diekspor!');
  };

  const handleDeleteTransaction = async (t) => {
    if (t.sourceTable === 'payments') {
      toast.error('Transaksi order tidak bisa dihapus dari sini. Hapus melalui Detail Pesanan.');
      return;
    }
    if (!window.confirm('Apakah Bapak/Ibu yakin ingin menghapus transaksi ini? Saldo akan disesuaikan otomatis.')) return;
    setLoadingHistory(true);
    try {
      const { error } = await supabase.from('financial_transactions').delete().eq('id', t.id);
      if (error) throw error;
      toast.success('Transaksi berhasil dihapus');
      fetchFinancialData();
      if (expandedMethodId) fetchMethodTransactions(expandedMethodId);
    } catch (error) {
      toast.error('Gagal menghapus transaksi.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCardClick = (methodId) => {
    if (isPendingExpanded) setIsPendingExpanded(false);
    if (isDraftExpanded) setIsDraftExpanded(false);
    if (isDropshipExpanded) setIsDropshipExpanded(false);
    if (expandedMethodId === methodId) {
      setExpandedMethodId(null);
      setMethodTransactions([]);
    } else {
      setExpandedMethodId(methodId);
      fetchMethodTransactions(methodId);
    }
  };

  const handlePendingCardClick = () => {
    if (expandedMethodId) setExpandedMethodId(null);
    if (isDraftExpanded) setIsDraftExpanded(false);
    if (isDropshipExpanded) setIsDropshipExpanded(false);
    setIsPendingExpanded(!isPendingExpanded);
  };

  const handleDraftCardClick = () => {
    if (expandedMethodId) setExpandedMethodId(null);
    if (isPendingExpanded) setIsPendingExpanded(false);
    if (isDropshipExpanded) setIsDropshipExpanded(false);
    setIsDraftExpanded(!isDraftExpanded);
  };

  const handleDropshipCardClick = () => {
    if (expandedMethodId) setExpandedMethodId(null);
    if (isPendingExpanded) setIsPendingExpanded(false);
    if (isDraftExpanded) setIsDraftExpanded(false);
    setIsDropshipExpanded(!isDropshipExpanded);
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const { amount, from_method_id, to_method_id, description, admin_fee, proof_file } = transferForm;
    if (from_method_id === to_method_id) {
      toast.error('Metode sumber dan tujuan tidak boleh sama.');
      setIsSubmitting(false);
      return;
    }
    const sourceMethodName = paymentMethods.find(m => m.id === from_method_id)?.method_name;
    const targetMethodName = allMethods.find(m => m.id === to_method_id)?.method_name;
    try {
      let proofPath = null;
      let fileToUpload = (proof_file instanceof FileList || Array.isArray(proof_file)) ? proof_file[0] : proof_file;
      if (fileToUpload && fileToUpload.type?.startsWith('image/') && fileToUpload.size > MAX_FILE_SIZE) {
        toast.loading('Kompresi bukti transfer...', { id: 'compressing-transfer' });
        try {
          fileToUpload = await compressImage(fileToUpload, TARGET_SIZE_MB);
          toast.success('Kompresi berhasil', { id: 'compressing-transfer' });
        } catch { toast.error('Gagal kompresi, mengunggah file asli', { id: 'compressing-transfer' }); }
      }
      if (fileToUpload) {
        const fileNameStr = fileToUpload.name || 'transfer_proof.jpg';
        const fileExt = fileNameStr.includes('.') ? fileNameStr.split('.').pop() : 'jpg';
        const fileName = `transfer_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${companyId}/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('proofs').upload(filePath, fileToUpload);
        if (uploadError) throw uploadError;
        proofPath = filePath;
      }
      const { error: expenseError } = await supabase.from('financial_transactions').insert({
        company_id: companyId, type: 'expense', amount: parseFloat(amount),
        description: `Transfer keluar ke ${targetMethodName}. ${description}`,
        payment_method_id: from_method_id, source_table: 'transfer', proof_url: proofPath,
      });
      if (expenseError) throw expenseError;
      const { error: incomeError } = await supabase.from('financial_transactions').insert({
        company_id: companyId, type: 'income', amount: parseFloat(amount),
        description: `Transfer masuk dari ${sourceMethodName}. ${description}`,
        payment_method_id: to_method_id, source_table: 'transfer', proof_url: proofPath,
      });
      if (incomeError) throw incomeError;
      if (admin_fee && parseFloat(admin_fee) > 0) {
        const { error: feeError } = await supabase.from('financial_transactions').insert({
          company_id: companyId, type: 'expense', amount: parseFloat(admin_fee),
          description: `Biaya Admin Transfer ke ${targetMethodName}. ${description}`,
          payment_method_id: from_method_id, source_table: 'transfer_fee',
        });
        if (feeError) throw feeError;
      }
      toast.success('Transfer dana berhasil dicatat!');
      setIsTransferModalOpen(false);
      setTransferForm({ amount: '', from_method_id: '', to_method_id: '', description: '', admin_fee: '', proof_file: null });
      fetchFinancialData();
      if (expandedMethodId) fetchMethodTransactions(expandedMethodId);
    } catch (error) { toast.error('Gagal mencatat transfer dana: ' + error.message); } finally { setIsSubmitting(false); }
  };

  const handleOpenPayoutModal = (request) => {
    setSelectedPayoutRequest(request);
    setIsAddPaymentOpen(true);
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
      const { error: rpcError } = await supabase.rpc('confirm_payout_and_move_balance', {
        p_payout_id: selectedPayoutRequest.id
      });
      if (rpcError) throw rpcError;
      await supabase.from('payout_requests')
        .update({ status: 'completed', proof_url: paymentInfo.proofUrl })
        .eq('id', selectedPayoutRequest.id);
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
      if (expandedMethodId) fetchMethodTransactions(expandedMethodId);
    } catch (err) { toast.error('Gagal: ' + err.message, { id: tid }); }
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
      'Saldo Saat Itu': t.runningBalance, Deskripsi: t.description,
      'URL Bukti': getProofUrl(t.proofUrl) || '-',
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Riwayat Transaksi');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `Riwayat_Keuangan_${nameForFile}_${dailyRecordStartDate}_sd_${dailyRecordEndDate}.xlsx`);
    toast.success('Riwayat transaksi berhasil diekspor!');
  };

  const handleExportDailyRecords = () => {
    if (!selectedMethodDailyRecord || selectedMethodDailyRecord.records.length === 0) {
      toast.error('Tidak ada rekaman transaksi periode untuk diekspor.'); return;
    }
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

  const isAllowedToView = paymentMethods.length > 0 || userRole === 'admin' || userRole === 'super_admin';
  
  if (loading) return <div className="flex justify-center items-center h-screen bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-slate-800" /></div>;
  if (!isAllowedToView) return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl h-screen flex items-center justify-center">
      <Card className="border border-red-200 shadow-sm max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto bg-red-50 w-12 h-12 flex items-center justify-center rounded-full mb-3">
             <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle className="text-red-700">Akses Dibatasi</CardTitle>
          <CardDescription className="mt-2 text-slate-600 text-sm">
            Bapak/Ibu tidak memiliki izin untuk melihat data keuangan manapun. Mohon hubungi Administrator.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 animate-in fade-in slide-in-from-bottom-2 space-y-6"> 
      
      {/* HEADER SECTION - Premium Layout */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
        <div className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg"><PiggyBank className="h-6 w-6 text-slate-700" /></div>
            Laporan Keuangan
          </h2>
          <p className="text-slate-500 font-medium ml-12">
            Kelola arus kas, pantau tagihan, dan rekonsiliasi saldo secara terpusat.
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
          <Button onClick={fetchFinancialData} variant="outline" className="h-11 bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-sm font-medium w-full sm:w-auto">
            <RefreshCcw className="h-4 w-4 mr-2 text-slate-500" /> Refresh
          </Button>
          <Button onClick={() => setIsTemplateModalOpen(true)} variant="outline" className="h-11 bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-sm font-medium w-full sm:w-auto">
            <Settings className="h-4 w-4 mr-2 text-slate-500" /> Atur WA
          </Button>
          <Button onClick={() => setIsTransferModalOpen(true)} className="h-11 bg-slate-900 text-white hover:bg-slate-800 shadow-sm font-medium w-full sm:w-auto px-6">
            <ArrowRightLeft className="h-4 w-4 mr-2" /> Transfer Kas
          </Button>
        </div>
      </div>

      {/* TOP SUMMARY CARDS (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Total Balance Card (Hero) */}
        <Card className="border-0 shadow-md bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl overflow-hidden relative group lg:col-span-1">
          <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-105 transition-transform duration-500">
             <Building size={100} />
          </div>
          <CardHeader className="p-5 pb-2 relative z-10">
            <CardTitle className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Banknote className="h-4 w-4" /> Saldo Riil
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0 relative z-10">
            <p className="text-2xl lg:text-3xl font-bold mt-1">{formatCurrency(reportData.totalBalance)}</p>
            <p className="text-[11px] text-slate-400 mt-2 font-medium">Fisik & digital terkonsolidasi</p>
          </CardContent>
        </Card>

        {/* Piutang Card */}
        <Card className={`border border-slate-200/60 shadow-sm rounded-2xl cursor-pointer transition-all hover:shadow-md group ${isPendingExpanded ? 'ring-2 ring-blue-500 bg-blue-50/30' : 'bg-white'}`} onClick={handlePendingCardClick}>
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              Estimasi Piutang
              <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                 <Clock className="h-4 w-4" />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(totalPending)}</p>
            <div className="flex justify-between items-center mt-3 border-t border-slate-100 pt-3">
              <p className="text-xs font-medium text-slate-500">{pendingOrders.length} Order</p>
              <span className="text-[10px] uppercase font-bold text-blue-600 flex items-center">Detail <ChevronRight className="h-3 w-3 ml-1" /></span>
            </div>
          </CardContent>
        </Card>

        {/* Dropship Card */}
        <Card className={`border border-slate-200/60 shadow-sm rounded-2xl cursor-pointer transition-all hover:shadow-md group relative overflow-visible ${isDropshipExpanded ? 'ring-2 ring-emerald-500 bg-emerald-50/30' : 'bg-white'}`} onClick={handleDropshipCardClick}>
          <CardHeader className="p-5 pb-2">
             <div className="flex justify-between items-start">
               <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">Komisi Dropship</CardTitle>
               <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Users className="h-4 w-4" />
               </div>
             </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(currentPeriodDropshipTotal)}</p>
            <div className="mt-3 border-t border-slate-100 pt-3" onClick={(e) => e.stopPropagation()}>
               <Select value={selectedDropshipperId} onValueChange={setSelectedDropshipperId}>
                  <SelectTrigger className="h-7 text-[10px] font-medium border-slate-200 bg-slate-50 focus:ring-0 shadow-none hover:bg-slate-100 transition-colors w-full">
                    <SelectValue placeholder="Pilih Dropshipper" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Dropshipper</SelectItem>
                    {uniqueDropshippers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
               </Select>
            </div>
          </CardContent>
        </Card>

        {/* Draft Card */}
        <Card className={`border border-slate-200/60 shadow-sm rounded-2xl cursor-pointer transition-all hover:shadow-md group ${isDraftExpanded ? 'ring-2 ring-purple-500 bg-purple-50/30' : 'bg-white'}`} onClick={handleDraftCardClick}>
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              Proyeksi Draft
              <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg group-hover:bg-purple-600 group-hover:text-white transition-colors">
                 <ClipboardList className="h-4 w-4" />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(totalDraftProjection)}</p>
            <div className="flex justify-between items-center mt-3 border-t border-slate-100 pt-3">
              <p className="text-xs font-medium text-slate-500">{draftOrders.length} Draft</p>
              <span className="text-[10px] uppercase font-bold text-purple-600 flex items-center">Detail <ChevronRight className="h-3 w-3 ml-1" /></span>
            </div>
          </CardContent>
        </Card>

        {/* Payout Requests Card */}
        <Card className={`border border-slate-200/60 shadow-sm rounded-2xl cursor-pointer transition-all hover:shadow-md group ${isPayoutExpanded ? 'ring-2 ring-amber-500 bg-amber-50/30' : 'bg-white'}`}
          onClick={() => {
            setIsPayoutExpanded(!isPayoutExpanded);
            if (isPendingExpanded) setIsPendingExpanded(false);
            if (isDraftExpanded) setIsDraftExpanded(false);
            if (isDropshipExpanded) setIsDropshipExpanded(false);
            fetchPayoutRequests();
          }}
        >
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              Tarik Komisi
              <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg group-hover:bg-amber-600 group-hover:text-white transition-colors relative">
                 <ArrowRightLeft className="h-4 w-4" />
                 {payoutRequests.length > 0 && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(totalPayoutPending)}</p>
            <div className="flex justify-between items-center mt-3 border-t border-slate-100 pt-3">
              <p className="text-xs font-medium text-slate-500">{payoutRequests.length} Pending</p>
              <span className="text-[10px] uppercase font-bold text-amber-600 flex items-center">Proses <ChevronRight className="h-3 w-3 ml-1" /></span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DETAIL PANELS (Animated Expandable Sections) */}
      {(isPendingExpanded || isDraftExpanded || isDropshipExpanded) && (
        <div className="mb-8 mt-2 animate-in fade-in slide-in-from-top-4 duration-300">
          
          {isPendingExpanded && (
            <Card className="border border-blue-200 shadow-md bg-white rounded-2xl overflow-hidden">
              <CardHeader className="bg-blue-50/50 border-b border-blue-100 p-5 flex flex-row items-center justify-between">
                 <div className="space-y-1">
                    <CardTitle className="text-base font-bold text-blue-900 flex items-center gap-2">
                      <Clock className="h-5 w-5 text-blue-600" /> Rincian Piutang Aktif
                    </CardTitle>
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
                            {order.delivered_at ? new Date(order.delivered_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year:'numeric' }) : formatDate(order.planned_date)}
                          </TableCell>
                          <TableCell className="font-bold text-slate-900">#{order.invoice_number}</TableCell>
                          <TableCell className="font-medium text-slate-700">{order.customers?.name}</TableCell>
                          <TableCell className="text-right font-bold text-blue-600">{formatCurrency(order.grand_total)}</TableCell>
                          <TableCell className="text-right px-5">
                            <div className="flex gap-2 justify-end">
                              <Link to={`/orders/${order.id}`}>
                                <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className={`h-8 px-3 border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-800 rounded-md font-semibold text-xs transition-colors ${processingWA[order.id] ? 'opacity-50 cursor-not-allowed' : ''}`} 
                                onClick={() => handleReminderWA(order)} 
                                disabled={processingWA[order.id]}
                              >
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
                  <CardTitle className="text-base font-bold text-emerald-900 flex items-center gap-2">
                    <Users className="h-5 w-5 text-emerald-600" /> Histori Komisi Dropship
                  </CardTitle>
                  <CardDescription className="text-emerald-700/70 font-medium text-xs">
                    Akumulasi komisi yang dihasilkan. Filter aktif: {selectedDropshipperId === 'all' ? 'Semua Dropshipper' : uniqueDropshippers.find(d=>d.id===selectedDropshipperId)?.name}
                  </CardDescription>
                </div>
                <Button onClick={handleExportDropshipCommission} variant="outline" className="h-9 text-xs font-semibold bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                   <Download className="h-3.5 w-3.5 mr-2" /> Export Excel
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[400px]">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                      <TableRow className="text-[11px] uppercase tracking-wider text-slate-500 border-slate-100">
                        <TableHead className="font-semibold px-5">Tgl Order</TableHead>
                        <TableHead className="font-semibold">Dropshipper</TableHead>
                        <TableHead className="font-semibold">Invoice</TableHead>
                        <TableHead className="font-semibold">Pelanggan</TableHead>
                        <TableHead className="font-semibold text-right">Nominal Komisi</TableHead>
                        <TableHead className="text-center font-semibold px-5">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDropshipData.map(order => (
                        <TableRow key={order.id} className="text-sm border-slate-100 hover:bg-slate-50/50">
                          <TableCell className="whitespace-nowrap font-medium text-slate-600 px-5">{new Date(order.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year:'numeric'})}</TableCell>
                          <TableCell className="font-bold text-slate-900">{order.dropshipper?.full_name || 'N/A'}</TableCell>
                          <TableCell className="text-slate-600">#{order.invoice_number}</TableCell>
                          <TableCell className="font-medium text-slate-700">{order.customers?.name}</TableCell>
                          <TableCell className="text-right font-bold text-emerald-600">{formatCurrency(order.dropshipper_commission)}</TableCell>
                          <TableCell className="text-right px-5">
                            <Link to={`/orders/${order.id}`}>
                              <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredDropshipData.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-400 font-medium">Tidak ada data komisi ditemukan.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {isDraftExpanded && (
            <Card className="border border-purple-200 shadow-md bg-white rounded-2xl overflow-hidden">
              <CardHeader className="bg-purple-50/50 border-b border-purple-100 p-5">
                <CardTitle className="text-base font-bold text-purple-900 flex items-center gap-2">
                   <ClipboardList className="h-5 w-5 text-purple-600" /> Rincian Order Draft
                </CardTitle>
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
                          <TableCell className="whitespace-nowrap font-medium text-slate-600 px-5">{new Date(order.created_at).toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year:'numeric'})}</TableCell>
                          <TableCell className="font-medium text-slate-700">{order.customers?.name}</TableCell>
                          <TableCell className="text-right font-bold text-purple-600">{formatCurrency(order.grand_total)}</TableCell>
                          <TableCell className="text-right px-5">
                            <Link to={`/orders/${order.id}`}>
                              <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
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
        </div>
      )}

      {/* PAYMENT METHODS GRID */}
      <div className="mt-8 mb-4 flex items-center justify-between">
         <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Metode Pembayaran
         </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportData.balances.map(item => (
          <Card 
             key={item.id} 
             className={`border transition-all duration-200 cursor-pointer rounded-2xl group ${expandedMethodId === item.id ? 'border-slate-800 shadow-lg ring-1 ring-slate-800 bg-slate-900 text-white' : 'border-slate-200/60 shadow-sm bg-white hover:border-slate-300 hover:shadow-md'}`} 
             onClick={() => handleCardClick(item.id)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-5 pb-3">
               <CardTitle className={`text-sm font-semibold truncate pr-2 ${expandedMethodId === item.id ? 'text-slate-200' : 'text-slate-600'}`}>{item.method_name}</CardTitle>
               <div className={`p-2 rounded-lg ${expandedMethodId === item.id ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-800 group-hover:text-white transition-colors'}`}>
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

      {/* EXPANDED SECTION (Daily Records & History) */}
      {expandedMethodId && (
        <div className="space-y-6 mt-8 animate-in fade-in duration-500 slide-in-from-bottom-4">
          <Card className="border border-slate-200/60 shadow-md bg-white rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
              <div className="space-y-1">
                 <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-slate-500" /> Analisis Mutasi: {expandedMethod.method_name}
                 </CardTitle>
                 <CardDescription className="font-medium text-slate-500">
                    Rekapitulasi transaksi harian untuk keperluan rekonsiliasi.
                 </CardDescription>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
                 {/* DATE FILTER */}
                 <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-full sm:w-auto">
                    <div className="flex flex-col px-3 py-1">
                        <Label className="text-[9px] uppercase tracking-widest font-bold text-slate-400 mb-1">Mulai</Label>
                        <Input 
                            type="date"
                            value={dailyRecordStartDate}
                            onChange={e => setDailyRecordStartDate(e.target.value)}
                            className="h-7 border-0 bg-transparent p-0 text-xs font-semibold focus-visible:ring-0 shadow-none w-[110px]"
                        />
                    </div>
                    <div className="w-px h-8 bg-slate-200 mx-1"></div>
                    <div className="flex flex-col px-3 py-1">
                        <Label className="text-[9px] uppercase tracking-widest font-bold text-slate-400 mb-1">Akhir</Label>
                        <Input 
                            type="date"
                            value={dailyRecordEndDate}
                            onChange={e => setDailyRecordEndDate(e.target.value)}
                            className="h-7 border-0 bg-transparent p-0 text-xs font-semibold focus-visible:ring-0 shadow-none w-[110px]"
                        />
                    </div>
                 </div>

                 <Button onClick={handleExportDailyRecords} className="h-[46px] px-5 w-full sm:w-auto bg-slate-900 text-white hover:bg-slate-800 font-semibold rounded-xl shadow-sm transition-all text-xs" disabled={!selectedMethodDailyRecord || selectedMethodDailyRecord.records.length === 0 || loadingHistory}>
                    <Download className="h-4 w-4 mr-2" /> Export
                 </Button>
              </div>
            </CardHeader>
            
            <CardContent className="p-6">
              {/* Daily Summary Tape */}
              {selectedMethodDailyRecord && !loadingHistory && (
                 <div className="flex flex-wrap gap-4 mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex flex-col">
                       <span className="text-[10px] uppercase font-bold text-slate-400">Total Masuk</span>
                       <span className="text-sm font-bold text-emerald-600">{formatCurrency(selectedMethodDailyRecord.totalIncome)}</span>
                    </div>
                    <div className="w-px bg-slate-200"></div>
                    <div className="flex flex-col">
                       <span className="text-[10px] uppercase font-bold text-slate-400">Total Keluar</span>
                       <span className="text-sm font-bold text-rose-600">{formatCurrency(selectedMethodDailyRecord.totalExpense)}</span>
                    </div>
                    <div className="w-px bg-slate-200"></div>
                    <div className="flex flex-col">
                       <span className="text-[10px] uppercase font-bold text-slate-400">Saldo Akhir Periode</span>
                       <span className="text-sm font-bold text-slate-900">{formatCurrency(selectedMethodDailyRecord.endingBalance)}</span>
                    </div>
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

          {/* DETAILED TRANSACTION HISTORY */}
          <Card className="border border-slate-200/60 shadow-md bg-white rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
               <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-slate-500" /> Buku Besar Transaksi
               </CardTitle>
               <Button onClick={handleExportTransactions} variant="outline" className="h-9 text-xs font-semibold bg-white border-slate-200 text-slate-700 w-full sm:w-auto" disabled={filteredMethodTransactions.length === 0}>
                  <Download className="h-3.5 w-3.5 mr-2" /> Download Laporan Mutasi
               </Button>
            </CardHeader>
            <CardContent className="p-0">
               <div className="overflow-x-auto max-h-[600px] scrollbar-thin scrollbar-thumb-slate-300">
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
                                 <TableCell className="whitespace-nowrap font-medium text-slate-700 px-5">{new Date(t.date).toLocaleDateString('id-ID', {day: '2-digit', month: 'short', year:'numeric'})}</TableCell>
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
                                             <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 rounded-md">
                                                <FileText className="h-4 w-4" />
                                             </Button>
                                          </a>
                                       )}
                                       {(userRole === 'admin' || userRole === 'super_admin') && (
                                          <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 rounded-md transition-colors" onClick={() => handleDeleteTransaction(t)}>
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

      {/* PAYOUT REQUESTS SECTION */}
      {isPayoutExpanded && (
        <Card className="border border-amber-200 shadow-md bg-white rounded-2xl overflow-hidden mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
          <CardHeader className="bg-amber-50/50 border-b border-amber-100 p-5">
            <CardTitle className="text-base font-bold text-amber-900 flex items-center gap-2">
               <ArrowRightLeft className="h-5 w-5 text-amber-600" /> Verifikasi Penarikan Komisi Dropship
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
               <Table>
                  <TableHeader className="bg-slate-50">
                     <TableRow className="text-[11px] uppercase tracking-wider text-slate-500 border-slate-100">
                        <TableHead className="font-semibold px-5">Dropshipper</TableHead>
                        <TableHead className="font-semibold">Info Rekening</TableHead>
                        <TableHead className="font-semibold text-right">Nominal Tarik</TableHead>
                        <TableHead className="text-center font-semibold px-5">Aksi Pembayaran</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {payoutRequests.map(req => (
                        <TableRow key={req.id} className="text-sm border-slate-100 hover:bg-slate-50">
                           <TableCell className="font-bold text-slate-900 px-5">{req.profiles?.full_name}</TableCell>
                           <TableCell className="font-medium text-slate-600">{req.profiles?.rekening || 'Silakan cek profil user'}</TableCell>
                           <TableCell className="text-right font-bold text-amber-600 text-base">{formatCurrency(req.amount)}</TableCell>
                           <TableCell className="text-center px-5 py-3">
                              <Button size="sm" className="bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg h-9 px-4 w-full sm:w-auto" onClick={() => handleOpenPayoutModal(req)}>
                                 Proses Pencairan
                              </Button>
                           </TableCell>
                        </TableRow>
                     ))}
                     {payoutRequests.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-12 text-slate-400 font-medium flex flex-col items-center justify-center"><CheckCircle2 className="h-8 w-8 mb-2 text-slate-300" /> Tidak ada pengajuan penarikan aktif.</TableCell></TableRow>}
                  </TableBody>
               </Table>
            </div>
          </CardContent>
        </Card>
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
                    <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium focus:ring-slate-300"><SelectValue placeholder="Pilih..." /></SelectTrigger>
                    <SelectContent>{paymentMethods.map(m => <SelectItem key={m.id} value={m.id}>{m.method_name}</SelectItem>)}</SelectContent>
                 </Select>
              </div>
              <div className="space-y-2">
                 <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Tujuan Dana</Label>
                 <Select value={transferForm.to_method_id} onValueChange={v => setTransferForm(prev => ({ ...prev, to_method_id: v }))} required>
                    <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-200 font-medium focus:ring-slate-300"><SelectValue placeholder="Pilih..." /></SelectTrigger>
                    <SelectContent>{allMethods.map(m => <SelectItem key={m.id} value={m.id}>{m.method_name}</SelectItem>)}</SelectContent>
                 </Select>
              </div>
            </div>
            
            <div className="space-y-2">
               <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Nominal Transfer</Label>
               <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <span className="text-slate-500 font-semibold sm:text-sm">Rp</span>
                  </div>
                  <Input type="number" value={transferForm.amount} onChange={e => setTransferForm(prev => ({ ...prev, amount: e.target.value }))} className="h-11 pl-9 rounded-xl border-slate-200 font-bold text-lg focus-visible:ring-slate-300" placeholder="0" required />
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Biaya Admin</Label>
                  <Input type="number" value={transferForm.admin_fee} onChange={e => setTransferForm(prev => ({ ...prev, admin_fee: e.target.value }))} className="h-10 rounded-xl border-slate-200 font-medium focus-visible:ring-slate-300" placeholder="Rp 0" />
               </div>
               <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider text-right block">Bukti (Opsional)</Label>
                  <Input type="file" accept="image/*" onChange={e => setTransferForm(prev => ({ ...prev, proof_file: e.target.files }))} className="h-10 text-xs rounded-xl border-slate-200 cursor-pointer file:text-slate-700 file:font-semibold focus-visible:ring-slate-300" />
               </div>
            </div>

            <div className="space-y-2">
               <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Keterangan Tambahan</Label>
               <Input value={transferForm.description} onChange={e => setTransferForm(prev => ({ ...prev, description: e.target.value }))} className="h-10 rounded-xl border-slate-200 font-medium focus-visible:ring-slate-300" placeholder="Contoh: Setoran uang kasir ke bank BCA" />
            </div>

            <div className="pt-4 flex gap-3">
               <Button type="button" variant="outline" className="flex-1 rounded-xl h-11 font-semibold text-slate-600 hover:bg-slate-50" onClick={() => setIsTransferModalOpen(false)}>Batal</Button>
               <Button type="submit" disabled={isSubmitting} className="flex-1 rounded-xl h-11 font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-md">
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