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
  Users
} from 'lucide-react'; 
import { toast } from 'react-hot-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
  const [loading, setLoading] = useState(true);
  const [allMethods, setAllMethods] = useState([]);
  const [reportData, setReportData] = useState({ totalBalance: 0, balances: [] });
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [totalPending, setTotalPending] = useState(0);
  const [isPendingExpanded, setIsPendingExpanded] = useState(false);
  const [pendingByDate, setPendingByDate] = useState([]);
  const [draftOrders, setDraftOrders] = useState([]);
  const [totalDraftProjection, setTotalDraftProjection] = useState(0);
  const [isDraftExpanded, setIsDraftExpanded] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [activeTemplates, setActiveTemplates] = useState({});
  const [processingWA, setProcessingWA] = useState({});
  const [payoutRequests, setPayoutRequests] = useState([]);
  const [isPayoutExpanded, setIsPayoutExpanded] = useState(false);
  const [totalPayoutPending, setTotalPayoutPending] = useState(0);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [selectedPayoutRequest, setSelectedPayoutRequest] = useState(null);

  // --- DROPSHIP COMMISSION STATE ---
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
      const transferMethod = allMethods.find(m => m.type === 'transfer' && m.is_active) || allMethods;
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

  // --- DROPSHIP DATA FILTER LOGIC (REMOVED DATE FILTER) ---
  const filteredDropshipData = useMemo(() => {
    if (!dropshipOrders || dropshipOrders.length === 0) return [];
    let data = dropshipOrders;
    
    // Filter Dropshipper ID
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
  if (loading) return <div className="flex justify-center items-center h-screen bg-white"><Loader2 className="h-8 w-8 animate-spin text-[#011e4b]" /></div>;
  if (!isAllowedToView) return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl space-y-6">
      <Card className="mt-10 border-red-500 border-2">
        <CardHeader><CardTitle className="text-red-600">Akses Dibatasi</CardTitle><CardDescription>Bapak/Ibu tidak memiliki izin untuk melihat data keuangan manapun. Mohon hubungi Administrator Perusahaan Anda.</CardDescription></CardHeader>
      </Card>
    </div>
  );

  return (
    <div className="container mx-auto p-3 md:p-8 max-w-7xl space-y-4 md:space-y-6">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-2 md:mb-4 gap-3">
        <h1 className="text-xl md:text-2xl font-bold text-[#011e4b] flex items-center gap-2"><PiggyBank className="h-5 w-5 md:h-6 md:w-6" /> Laporan Keuangan</h1>
        <div className="flex flex-wrap w-full lg:w-auto gap-2">
          <Button onClick={fetchFinancialData} variant="outline" className="flex-1 md:flex-none text-[#011e4b] hover:bg-gray-100 text-xs md:text-sm h-9 md:h-10"><RefreshCcw className="h-4 w-4 mr-1 md:mr-2" /> Refresh</Button>
          <Button onClick={() => setIsTransferModalOpen(true)} className="flex-1 md:flex-none bg-[#011e4b] text-white hover:bg-[#00376a] text-xs md:text-sm h-9 md:h-10"><ArrowRightLeft className="h-4 w-4 mr-1 md:mr-2" /> Transfer</Button>
          <Button variant="outline" onClick={() => setIsTemplateModalOpen(true)} className="w-full md:w-auto text-xs md:text-sm h-9 md:h-10"><Settings className="mr-1 md:mr-2 h-4 w-4" /> Atur WA</Button>
        </div>
      </div>

      {/* TOP SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6">
        <Card className="border-0 shadow-lg bg-[#011e4b] text-white">
          <CardHeader className="p-4"><CardTitle className="text-xs md:text-sm font-medium opacity-80 flex items-center gap-2"><Banknote className="h-4 w-4" /> Total Saldo Riil</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl md:text-3xl font-bold">{formatCurrency(reportData.totalBalance)}</p>
            <p className="text-[10px] md:text-xs opacity-70 mt-1">Uang fisik/saldo di akun.</p>
          </CardContent>
        </Card>
        <Card className={`border-l-4 border-l-blue-500 shadow-md cursor-pointer transition-all hover:bg-blue-50 ${isPendingExpanded ? 'ring-2 ring-blue-400 bg-blue-50' : 'bg-white'}`} onClick={handlePendingCardClick}>
          <CardHeader className="p-4"><CardTitle className="text-xs md:text-sm font-medium text-blue-700 flex items-center gap-2"><Clock className="h-4 w-4" /> Estimasi Piutang</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl md:text-3xl font-bold text-blue-600">{formatCurrency(totalPending)}</p>
            <div className="flex justify-between items-center mt-1">
              <p className="text-[10px] md:text-xs text-gray-500">{pendingOrders.length} Order piutang.</p>
              <span className="text-[10px] md:text-xs text-blue-600 font-semibold underline flex items-center">Detail <ChevronRight className="h-3 w-3" /></span>
            </div>
          </CardContent>
        </Card>

        {/* --- DROPSHIP COMMISSION CARD WITH IN-CARD FILTER --- */}
        <Card className={`border-l-4 border-l-green-500 shadow-md cursor-pointer transition-all hover:bg-green-50 ${isDropshipExpanded ? 'ring-2 ring-green-400 bg-green-50' : 'bg-white'}`} onClick={handleDropshipCardClick}>
          <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs md:text-sm font-medium text-green-700 flex items-center gap-2"><Users className="h-4 w-4" /> Komisi Dropship</CardTitle>
            <div onClick={(e) => e.stopPropagation()}>
              <Select value={selectedDropshipperId} onValueChange={setSelectedDropshipperId}>
                <SelectTrigger className="h-7 w-28 md:w-36 text-[10px] bg-white border-green-200">
                  <SelectValue placeholder="Pilih Dropshipper" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Dropshipper</SelectItem>
                  {uniqueDropshippers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl md:text-3xl font-bold text-green-600">{formatCurrency(currentPeriodDropshipTotal)}</p>
            <div className="flex justify-between items-center mt-1">
              <p className="text-[10px] md:text-xs text-gray-500">Total akumulasi keseluruhan.</p>
              <span className="text-[10px] md:text-xs text-green-600 font-semibold underline flex items-center">Detail <ChevronRight className="h-3 w-3" /></span>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-l-4 border-l-purple-500 shadow-md cursor-pointer transition-all hover:bg-purple-50 ${isDraftExpanded ? 'ring-2 ring-purple-400 bg-purple-50' : 'bg-white'}`} onClick={handleDraftCardClick}>
          <CardHeader className="p-4"><CardTitle className="text-xs md:text-sm font-medium text-purple-700 flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Proyeksi Draft</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl md:text-3xl font-bold text-purple-600">{formatCurrency(totalDraftProjection)}</p>
            <div className="flex justify-between items-center mt-1">
              <p className="text-[10px] md:text-xs text-gray-500">{draftOrders.length} Pesanan draft.</p>
              <span className="text-[10px] md:text-xs text-purple-600 font-semibold underline flex items-center">Detail <ChevronRight className="h-3 w-3" /></span>
            </div>
          </CardContent>
        </Card>
        <Card className={`border-l-4 border-l-orange-500 shadow-md cursor-pointer transition-all hover:bg-orange-50 ${isPayoutExpanded ? 'ring-2 ring-orange-400 bg-orange-50' : 'bg-white'}`}
          onClick={() => {
            setIsPayoutExpanded(!isPayoutExpanded);
            if (isPendingExpanded) setIsPendingExpanded(false);
            if (isDraftExpanded) setIsDraftExpanded(false);
            if (isDropshipExpanded) setIsDropshipExpanded(false);
            fetchPayoutRequests();
          }}
        >
          <CardHeader className="p-4"><CardTitle className="text-xs md:text-sm font-medium text-orange-700 flex items-center gap-2"><ArrowRightLeft className="h-4 w-4" /> Pengajuan Tarik Dana</CardTitle></CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-2xl md:text-3xl font-bold text-orange-600">{formatCurrency(totalPayoutPending)}</p>
            <div className="flex justify-between items-center mt-1">
              <p className="text-[10px] md:text-xs text-gray-500">{payoutRequests.length} Permintaan pending.</p>
              <span className="text-[10px] md:text-xs text-orange-600 font-semibold underline flex items-center">Perlu Proses <ChevronRight className="h-3 w-3" /></span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* DETAIL VIEWS */}
      {(isPendingExpanded || isDraftExpanded || isDropshipExpanded) && (
        <div className="space-y-4 mb-6">
          {isPendingExpanded && (
            <Card className="border-blue-200 shadow-sm bg-white animate-in slide-in-from-top-2">
              <CardHeader className="bg-blue-50 border-b p-4"><CardTitle className="text-sm md:text-base text-blue-800 flex items-center gap-2"><Clock className="h-5 w-5" /> Rincian Piutang</CardTitle></CardHeader>
              <CardContent className="p-0 md:p-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow className="text-[10px] md:text-xs"><TableHead>Tgl Kirim</TableHead><TableHead>Invoice</TableHead><TableHead>Customer</TableHead><TableHead className="text-right">Nominal</TableHead><TableHead></TableHead></TableRow></TableHeader>
                    <TableBody>
                      {pendingOrders.map(order => (
                        <TableRow key={order.id} className="text-[11px] md:text-sm">
                          <TableCell className="whitespace-nowrap font-medium">{order.delivered_at ? new Date(order.delivered_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : formatDate(order.planned_date)}</TableCell>
                          <TableCell className="font-bold">#{order.invoice_number}</TableCell>
                          <TableCell className="max-w-[100px] truncate">{order.customers?.name}</TableCell>
                          <TableCell className="text-right font-bold text-blue-600">{formatCurrency(order.grand_total)}</TableCell>
                          <TableCell className="text-right p-1 md:p-2">
                            <div className="flex gap-1 justify-end">
                              <Link to={`/orders/${order.id}`}><Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-4 w-4" /></Button></Link>
                              <Button variant="ghost" size="icon" className={`h-7 w-7 text-green-600 ${processingWA[order.id] ? 'opacity-50' : ''}`} onClick={() => handleReminderWA(order)} disabled={processingWA[order.id]}>
                                {processingWA[order.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareText className="h-4 w-4" />}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* --- DROPSHIP COMMISSION DETAIL --- */}
          {isDropshipExpanded && (
            <Card className="border-green-200 shadow-sm bg-white animate-in slide-in-from-top-2">
              <CardHeader className="bg-green-50 border-b p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <CardTitle className="text-sm md:text-base text-green-800 flex items-center gap-2"><Users className="h-5 w-5" /> Rincian Komisi Dropship</CardTitle>
                  <CardDescription className="text-xs">Total akumulasi keseluruhan: <span className="font-bold text-green-700">{formatCurrency(currentPeriodDropshipTotal)}</span></CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={handleExportDropshipCommission} variant="outline" size="sm" className="h-8 text-xs bg-white"><Download className="h-3 w-3 mr-2" /> Export Excel</Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 md:p-4">
                <div className="overflow-x-auto max-h-[400px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-white z-10">
                      <TableRow className="text-[10px] md:text-xs"><TableHead>Tgl Order</TableHead><TableHead>Dropshipper</TableHead><TableHead>Invoice</TableHead><TableHead>Customer</TableHead><TableHead className="text-right">Nominal Komisi</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDropshipData.map(order => (
                        <TableRow key={order.id} className="text-[11px] md:text-sm">
                          <TableCell className="whitespace-nowrap">{new Date(order.created_at).toLocaleDateString('id-ID')}</TableCell>
                          <TableCell className="font-bold text-[#011e4b]">{order.dropshipper?.full_name || 'N/A'}</TableCell>
                          <TableCell>#{order.invoice_number}</TableCell>
                          <TableCell className="max-w-[100px] truncate">{order.customers?.name}</TableCell>
                          <TableCell className="text-right font-bold text-green-600">{formatCurrency(order.dropshipper_commission)}</TableCell>
                          <TableCell className="text-right p-1"><Link to={`/orders/${order.id}`}><Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-4 w-4" /></Button></Link></TableCell>
                        </TableRow>
                      ))}
                      {filteredDropshipData.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-gray-400">Tidak ada data komisi ditemukan.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {isDraftExpanded && (
            <Card className="border-purple-200 shadow-sm bg-white animate-in slide-in-from-top-2">
              <CardHeader className="bg-purple-50 border-b p-4"><CardTitle className="text-sm md:text-base text-purple-800 flex items-center gap-2"><ClipboardList className="h-5 w-5" /> Rincian Draft</CardTitle></CardHeader>
              <CardContent className="p-0 md:p-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow className="text-[10px] md:text-xs"><TableHead>Tgl</TableHead><TableHead>Customer</TableHead><TableHead className="text-right">Nilai</TableHead><TableHead></TableHead></TableRow></TableHeader>
                    <TableBody>
                      {draftOrders.map(order => (
                        <TableRow key={order.id} className="text-[11px] md:text-sm">
                          <TableCell className="whitespace-nowrap">{new Date(order.created_at).toLocaleDateString('id-ID')}</TableCell>
                          <TableCell className="max-w-[100px] truncate">{order.customers?.name}</TableCell>
                          <TableCell className="text-right font-bold text-purple-600">{formatCurrency(order.grand_total)}</TableCell>
                          <TableCell className="text-right p-1"><Link to={`/orders/${order.id}`}><Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-4 w-4" /></Button></Link></TableCell>
                        </TableRow>
                      ))}
                      {draftOrders.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-4">Kosong.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <h2 className="text-base md:text-lg font-bold mb-3 flex items-center gap-2 text-[#011e4b]">Rincian per Metode</h2>
      {/* PAYMENT METHODS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {reportData.balances.map(item => (
          <Card key={item.id} className={`border border-gray-200 shadow-sm transition-all hover:shadow-md hover:cursor-pointer ${expandedMethodId === item.id ? 'border-2 border-[#011e4b] shadow-lg ring-1 ring-[#011e4b]/20' : ''}`} onClick={() => handleCardClick(item.id)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4"><CardTitle className="text-sm md:text-base font-semibold text-[#011e4b] truncate pr-2">{item.method_name}</CardTitle><div className="p-1.5 rounded-full bg-[#011e4b] text-white flex-shrink-0">{item.type === 'cash' ? <Banknote className="h-3 w-3 md:h-4 md:w-4" /> : <CreditCard className="h-3 w-3 md:h-4 md:w-4" />}</div></CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-xl md:text-2xl font-bold text-[#011e4b]">{formatCurrency(item.balance)}</div>
              <div className="text-[10px] md:text-xs text-muted-foreground mt-2 flex justify-between items-center border-t pt-2"><span>Masuk: <span className="font-semibold text-green-600">{formatCurrency(item.income)}</span></span><span>Keluar: <span className="font-semibold text-red-600">{formatCurrency(item.expense)}</span></span></div>
              {item.type === 'transfer' && <p className="text-[9px] md:text-xs text-muted-foreground mt-2 truncate italic">{item.account_name} - {item.account_number}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* EXPANDED SECTION */}
      {expandedMethodId && (
        <div className="space-y-6 mt-6 md:mt-8 animate-in fade-in duration-500">
          <Card className="border-0 shadow-sm bg-white border-l-4 border-blue-500 overflow-hidden">
            <CardHeader className="p-4 md:p-6 pb-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <CardTitle className="text-sm md:text-base text-blue-700 flex flex-col gap-1"><span className="flex items-center gap-2 font-bold"><CalendarDays className="h-4 w-4" /> Rekaman Harian</span><CardDescription className="text-[10px] md:text-xs">Saldo berjalan {expandedMethod.method_name}</CardDescription></CardTitle>
              {selectedMethodDailyRecord && !loadingHistory && <div className="flex gap-4 text-xs"><span className="text-green-600 font-semibold">+{formatCurrency(selectedMethodDailyRecord.totalIncome)}</span><span className="text-red-600 font-semibold">-{formatCurrency(selectedMethodDailyRecord.totalExpense)}</span><span className="text-blue-700 font-bold">Akhir: {formatCurrency(selectedMethodDailyRecord.endingBalance)}</span></div>}
              <Button onClick={handleExportDailyRecords} variant="outline" size="sm" className="w-full sm:w-auto h-8 text-xs" disabled={!selectedMethodDailyRecord || selectedMethodDailyRecord.records.length === 0 || loadingHistory}><Download className="h-3 w-3 mr-2" /> Export</Button>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4"><div className="space-y-1"><Label className="text-[10px] md:text-xs uppercase font-bold text-gray-500">Dari</Label><Input type="date" value={dailyRecordStartDate} onChange={e => setDailyRecordStartDate(e.target.value)} className="h-8 md:h-9 text-xs md:text-sm" /></div><div className="space-y-1"><Label className="text-[10px] md:text-xs uppercase font-bold text-gray-500">Sampai</Label><Input type="date" value={dailyRecordEndDate} onChange={e => setDailyRecordEndDate(e.target.value)} className="h-8 md:h-9 text-xs md:text-sm" /></div></div>
              {loadingHistory ? <div className="flex justify-center items-center h-24"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div> : selectedMethodDailyRecord ? <div className="overflow-x-auto rounded-md border shadow-inner"><Table className="min-w-[600px]"><TableHeader className="bg-gray-50"><TableRow className="text-[10px] md:text-xs uppercase tracking-wider"><TableHead>Tanggal</TableHead><TableHead className="text-green-700 text-right">Masuk</TableHead><TableHead className="text-red-700 text-right">Keluar</TableHead><TableHead className="text-right text-gray-600">Saldo Awal</TableHead><TableHead className="text-right font-bold text-blue-700">Saldo Akhir</TableHead></TableRow></TableHeader><TableBody>{selectedMethodDailyRecord.records.map(day => (<TableRow key={day.date} className="text-[11px] md:text-sm"><TableCell className="font-medium">{new Date(day.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell><TableCell className="text-right text-green-600">{day.income > 0 ? formatCurrency(day.income) : '-'}</TableCell><TableCell className="text-right text-red-600">{day.expense > 0 ? formatCurrency(day.expense) : '-'}</TableCell><TableCell className="text-right text-gray-500">{formatCurrency(day.startingBalance)}</TableCell><TableCell className={`text-right font-bold ${day.endingBalance < 0 ? 'text-red-700' : 'text-blue-700'} bg-blue-50/30`}>{formatCurrency(day.endingBalance)}</TableCell></TableRow>))}</TableBody></Table></div> : <div className="text-center py-4 text-gray-500 text-sm">Belum ada data transaksi di periode ini.</div>}
            </CardContent>
          </Card>
          <Card id="transaction-history-table" className="border-0 shadow-lg bg-white overflow-hidden">
            <CardHeader className="bg-gray-100 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"><CardTitle className="text-sm md:text-base text-[#011e4b] flex items-center gap-2 font-bold"><FileText className="h-4 w-4" /> Riwayat Transaksi</CardTitle><Button onClick={handleExportTransactions} variant="outline" size="sm" className="w-full sm:w-auto text-xs" disabled={methodTransactions.length === 0}><Download className="h-3 w-3 mr-2" /> Export Riwayat</Button></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[500px] scrollbar-thin scrollbar-thumb-gray-300">
                {loadingHistory ? <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-[#011e4b]" /></div> : <Table className="min-w-[850px] text-xs md:text-sm"><TableHeader className="sticky top-0 bg-gray-100 z-20 shadow-sm"><TableRow className="text-[10px] md:text-xs"><TableHead>Tgl</TableHead><TableHead>Tipe</TableHead><TableHead className="text-green-700">Masuk</TableHead><TableHead className="text-red-700">Keluar</TableHead><TableHead>Saldo</TableHead><TableHead className="w-1/3">Deskripsi</TableHead><TableHead className="text-center">Aksi</TableHead></TableRow></TableHeader><TableBody>{filteredMethodTransactions.map(t => (<TableRow key={t.id} className="hover:bg-gray-50"><TableCell className="whitespace-nowrap font-medium">{new Date(t.date).toLocaleDateString('id-ID')}</TableCell><TableCell><Badge variant={t.type === 'income' ? 'success' : 'destructive'} className="text-[9px] px-1 py-0">{t.type === 'income' ? 'In' : 'Out'}</Badge></TableCell><TableCell className="text-green-700">{t.type === 'income' ? formatCurrency(t.amount) : '-'}</TableCell><TableCell className="text-red-700">{t.type === 'expense' ? formatCurrency(t.amount) : '-'}</TableCell><TableCell className="font-bold">{formatCurrency(t.runningBalance)}</TableCell><TableCell className="max-w-[200px] truncate md:whitespace-normal italic">{t.description}</TableCell><TableCell className="text-center"><div className="flex gap-1 justify-center">{t.proofUrl && <a href={getProofUrl(t.proofUrl)} target="_blank" rel="noreferrer"><Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="h-3.5 w-3.5" /></Button></a>}{(userRole === 'admin' || userRole === 'super_admin') && (<Button variant="ghost" size="icon" className="text-red-500 h-7 w-7" onClick={() => handleDeleteTransaction(t)}><Trash2 className="h-3.5 w-3.5" /></Button>)}</div></TableCell></TableRow>))}</TableBody></Table>}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {isPayoutExpanded && (
        <Card className="border-orange-200 shadow-sm bg-white animate-in slide-in-from-top-2 mb-6">
          <CardHeader className="bg-orange-50 border-b p-4"><CardTitle className="text-sm md:text-base text-orange-800">Verifikasi Penarikan Komisi</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow className="text-xs"><TableHead>Dropshipper</TableHead><TableHead>Info Rekening</TableHead><TableHead className="text-right">Nominal</TableHead><TableHead className="text-center">Aksi</TableHead></TableRow></TableHeader>
              <TableBody>
                {payoutRequests.map(req => (<TableRow key={req.id}><TableCell className="font-medium">{req.profiles?.full_name}</TableCell><TableCell className="text-xs italic">{req.profiles?.rekening || 'Cek di profil'}</TableCell><TableCell className="text-right font-bold text-orange-600">{formatCurrency(req.amount)}</TableCell><TableCell className="text-center p-2"><Button size="sm" className="bg-green-600 hover:bg-green-700 h-8 text-xs" onClick={() => handleOpenPayoutModal(req)}>Cairkan Sekarang</Button></TableCell></TableRow>))}
                {payoutRequests.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-10 text-gray-400">Tidak ada pengajuan aktif.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* DIALOGS */}
      <Dialog open={isTransferModalOpen} onOpenChange={setIsTransferModalOpen}>
        <DialogContent className="sm:max-w-md max-w-[95%] rounded-lg">
          <DialogHeader><DialogTitle className="text-lg">Transfer Dana</DialogTitle></DialogHeader>
          <form onSubmit={handleTransferSubmit} className="grid gap-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label className="text-xs uppercase font-bold text-gray-500">Dari Sumber</Label><Select value={transferForm.from_method_id} onValueChange={v => setTransferForm(prev => ({ ...prev, from_method_id: v }))} required><SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Pilih sumber" /></SelectTrigger><SelectContent>{paymentMethods.map(m => <SelectItem key={m.id} value={m.id}>{m.method_name}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid gap-1.5"><Label className="text-xs uppercase font-bold text-gray-500">Ke Tujuan</Label><Select value={transferForm.to_method_id} onValueChange={v => setTransferForm(prev => ({ ...prev, to_method_id: v }))} required><SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Pilih tujuan" /></SelectTrigger><SelectContent>{allMethods.map(m => <SelectItem key={m.id} value={m.id}>{m.method_name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label className="text-xs uppercase font-bold text-gray-500">Nominal</Label><Input type="number" value={transferForm.amount} onChange={e => setTransferForm(prev => ({ ...prev, amount: e.target.value }))} className="h-9" required /></div>
              <div className="grid gap-1.5"><Label className="text-xs uppercase font-bold text-gray-500">Biaya Admin</Label><Input type="number" value={transferForm.admin_fee} onChange={e => setTransferForm(prev => ({ ...prev, admin_fee: e.target.value }))} className="h-9" /></div>
            </div>
            <div className="grid gap-1.5"><Label className="text-xs uppercase font-bold text-gray-500">Bukti (Opsional)</Label><Input type="file" accept="image/*" onChange={e => setTransferForm(prev => ({ ...prev, proof_file: e.target.files }))} className="text-xs h-9 cursor-pointer" /></div>
            <div className="grid gap-1.5"><Label className="text-xs uppercase font-bold text-gray-500">Keterangan</Label><Input value={transferForm.description} onChange={e => setTransferForm(prev => ({ ...prev, description: e.target.value }))} className="h-9" placeholder="Contoh: Setor tunai ke Bank" /></div>
            <DialogFooter className="pt-2"><Button type="submit" disabled={isSubmitting} className="w-full bg-[#011e4b]">{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Catat Transfer'}</Button></DialogFooter>
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