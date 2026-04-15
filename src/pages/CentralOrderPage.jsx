import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
  Loader2, PlusCircle, Clock, PackageCheck, Pencil, Trash2, 
  DollarSign, ChevronDown, X, Download, Filter, 
  ChevronLeft, ChevronRight, Check
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

// Import untuk Excel
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const PAGE_SIZE = 20;

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount || 0);
};

const getOrderStatusBadge = (status) => {
  switch (status) {
    case 'draft':
      return <Badge className="bg-gray-200 text-[#011e4b] flex items-center gap-1 h-5 px-2 py-0.5 text-[10px] whitespace-nowrap"><Clock className="h-3 w-3" /> Draft</Badge>;
    case 'received':
      return <Badge className="bg-blue-500 text-white flex items-center gap-1 h-5 px-2 py-0.5 text-[10px] whitespace-nowrap"><PackageCheck className="h-3 w-3" /> Diterima</Badge>;
    default:
      return <Badge className="bg-gray-200 text-[#011e4b] flex items-center gap-1 h-5 px-2 py-0.5 text-[10px] whitespace-nowrap">Proses</Badge>;
  }
};

const getPaymentStatusBadge = (paymentStatus) => {
  switch (paymentStatus) {
    case 'paid':
      return <Badge className="bg-green-600 text-white flex items-center gap-1 h-5 px-2 py-0.5 text-[10px] whitespace-nowrap"><DollarSign className="h-3 w-3" /> Lunas</Badge>;
    case 'partial':
      return <Badge className="bg-yellow-500 text-white flex items-center gap-1 h-5 px-2 py-0.5 text-[10px] whitespace-nowrap"><DollarSign className="h-3 w-3" /> Sebagian</Badge>;
    case 'unpaid':
      return <Badge className="bg-red-500 text-white flex items-center gap-1 h-5 px-2 py-0.5 text-[10px] whitespace-nowrap"><DollarSign className="h-3 w-3" /> Belum Bayar</Badge>;
    default:
      return <Badge variant="secondary" className="h-5 px-2 py-0.5 text-[10px] whitespace-nowrap">N/A</Badge>;
  }
};

const CentralOrderPage = () => {
  const { authLoading, companyId, session, userId } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastViewedCentralOrder, setLastViewedCentralOrder] = useState(null); 
  const [selectedProductId, setSelectedProductId] = useState('all');

  const [editingReceived, setEditingReceived] = useState({}); 
  const [isUpdating, setIsUpdating] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const loadLastViewedCentralOrder = () => {
    try {
        const storedOrder = localStorage.getItem('lastViewedCentralOrder');
        if (storedOrder) {
            const data = JSON.parse(storedOrder);
            const oneHourAgo = new Date(new Date().getTime() - (60 * 60 * 1000));
            if (new Date(data.timestamp) > oneHourAgo) {
                setLastViewedCentralOrder(data);
            } else {
                 localStorage.removeItem('lastViewedCentralOrder');
            }
        }
    } catch (e) {
        console.error('Error reading lastViewedCentralOrder:', e);
    }
  };
  
  const clearLastViewedOrder = () => {
    localStorage.removeItem('lastViewedCentralOrder');
    setLastViewedCentralOrder(null);
  };
  
  useEffect(() => {
    if (!authLoading && companyId) {
      fetchCentralOrders();
      fetchProducts();
      loadLastViewedCentralOrder();
    }
  }, [authLoading, companyId, currentPage, selectedProductId]);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('id, name').eq('company_id', companyId);
    if (data) setProducts(data);
  };
  
  const fetchCentralOrders = async () => {
    setLoading(true);
    if (!companyId) return;

    const from = (currentPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('central_orders')
      .select(`
        *,
        user:user_id(full_name),
        items:central_order_items${selectedProductId !== 'all' ? '!inner' : ''}(id, qty, price, received_qty, product_id, product:product_id(id, name), sold_empty_price)
      `, { count: 'exact' })
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (selectedProductId !== 'all') {
      query = query.eq('items.product_id', selectedProductId);
    }

    const { data: ordersData, error: ordersError, count } = await query;

    if (ordersError) { 
      toast.error('Gagal mengambil data pesanan pusat');
      setLoading(false); 
      return; 
    }
    
    const { data: transactionsData } = await supabase
        .from('financial_transactions')
        .select('amount, source_id')
        .eq('company_id', companyId)
        .eq('source_table', 'central_orders')
        .eq('type', 'expense');

    const paymentsByOrderId = (transactionsData || []).reduce((acc, tx) => {
        const cleanId = tx.source_id.split('_')[0]; 
        acc[cleanId] = (acc[cleanId] || 0) + parseFloat(tx.amount || 0);
        return acc;
    }, {});

    const ordersWithTotals = (ordersData || []).map(order => {
        const totalItemsValue = order.items.reduce((sum, item) => sum + (item.qty * item.price), 0);
        const totalGalonSoldValue = (order.sold_empty_to_central ? Object.keys(order.sold_empty_to_central) : []).reduce((sum, productId) => {
            const item = order.items.find(i => i.product.id === productId);
            return sum + ((parseFloat(order.sold_empty_to_central[productId]) || 0) * (parseFloat(item?.sold_empty_price || 0)));
        }, 0);

        const totalOrderValue = totalItemsValue + totalGalonSoldValue + (parseFloat(order.admin_fee) || 0) + (parseFloat(order.driver_tip) || 0);
        const totalPaid = paymentsByOrderId[order.id] || 0;
        
        let paymentStatus = 'unpaid';
        if (totalPaid >= totalOrderValue && totalOrderValue > 0) paymentStatus = 'paid';
        else if (totalPaid > 0) paymentStatus = 'partial';

        return { ...order, calculated_total: totalOrderValue, total_paid: totalPaid, payment_status: paymentStatus };
    });

    setOrders(ordersWithTotals);
    setTotalCount(count || 0);
    setLoading(false);
  };

  const handleQuickUpdateReceivedQty = async (orderId, item, newValue) => {
    const newQty = parseFloat(newValue);
    if (isNaN(newQty) || newQty < 0) {
      toast.error('Jumlah tidak valid');
      return;
    }

    const oldQty = parseFloat(item.received_qty || 0);
    const diff = newQty - oldQty;

    if (diff === 0) {
      setEditingReceived(prev => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      return;
    }

    setIsUpdating(true);
    const tid = toast.loading('Memperbarui jumlah diterima...');

    try {
      // 1. Update received_qty di central_order_items
      const { error: updateError } = await supabase
        .from('central_order_items')
        .update({ received_qty: newQty })
        .eq('id', item.id);

      if (updateError) throw new Error(`Update Item: ${updateError.message}`);

      // 2. Jika status order sudah 'received', WAJIB update stok produk secara real-time
      const order = orders.find(o => o.id === orderId);
      
      if (order?.status === 'received') {
        // Update Stock via RPC
        const { error: rpcError } = await supabase.rpc('update_product_stock', {
          product_id: item.product_id,
          qty_to_add: diff, 
        });

        if (rpcError) throw new Error(`Update Stok Gagal: ${rpcError.message}`);

        // Record Movement
        const { error: moveError } = await supabase.from('stock_movements').insert({
          product_id: item.product_id,
          qty: Math.abs(diff),
          type: diff > 0 ? 'masuk_dari_pusat' : 'keluar',
          notes: `Koreksi jumlah diterima dari Pusat #${order.central_note_number || orderId.slice(0, 8)} (Dari ${oldQty} ke ${newQty})`,
          company_id: companyId,
          user_id: userId,
          central_order_id: orderId,
        });

        if (moveError) throw new Error(`Catat Riwayat Stok Gagal: ${moveError.message}`);
        
        toast.success(`Berhasil! Jumlah diterima & stok telah disesuaikan.`, { id: tid });
      } else {
        // Jika order belum received (masih draft)
        toast.success(`Berhasil! (Stok akan berubah saat status order diselesaikan)`, { id: tid });
      }

      setEditingReceived(prev => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      fetchCentralOrders();
      
    } catch (error) {
      console.error(error);
      toast.error(error.message, { id: tid });
    } finally {
      setIsUpdating(false);
    }
  };
  
  const handleUpdatePaymentStatus = async (orderId, currentOrder, type) => {
    setLoading(true);
    try {
      if (type === 'paid') {
        const itemsPrice = currentOrder.items.reduce((sum, item) => sum + (item.qty * item.price), 0);
        const adminFee = parseFloat(currentOrder.admin_fee) || 0;

        await supabase.from('financial_transactions').upsert({
          source_id: orderId,
          company_id: companyId,
          type: 'expense',
          amount: itemsPrice,
          description: `Pembelian Produk Order Pusat #${orderId.slice(0,8)}`,
          source_table: 'central_orders'
        }, { onConflict: 'source_id,description' });

        if (adminFee > 0) {
          await supabase.from('financial_transactions').upsert({
            source_id: orderId,
            company_id: companyId,
            type: 'expense',
            amount: adminFee,
            description: `Biaya Admin untuk Order Pusat #${orderId.slice(0,8)}`,
            source_table: 'central_orders'
          }, { onConflict: 'source_id,description' });
        }
      } else {
        await supabase.from('financial_transactions')
          .delete()
          .eq('source_id', orderId)
          .eq('source_table', 'central_orders');
      }

      toast.success(`Berhasil dipisahkan!`);
      fetchCentralOrders();
    } catch (error) {
      toast.error('Gagal: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (orderId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus pesanan pusat ini? Semua data terkait akan terhapus dan stok akan dikembalikan.')) return;
    setLoading(true);
    
    try {
        const { data, error: invokeError } = await supabase.functions.invoke('manage-central-order-galons', {
            method: 'DELETE',
            body: { orderId, companyId },
        });

        if (invokeError) {
            throw new Error(invokeError.message || 'Gagal menghapus pesanan.');
        }

        toast.success('Pesanan berhasil dihapus dan stok dikembalikan!');
        fetchCentralOrders();
    } catch (error) {
        console.error('Error deleting central order:', error);
        toast.error('Gagal menghapus pesanan: ' + error.message);
    } finally {
        setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (orders.length === 0) {
      toast.error('Tidak ada data untuk diekspor.');
      return;
    }

    const rows = orders.map(order => {
        const getGalonString = (jsonObj) => {
            if (!jsonObj) return '-';
            return Object.entries(jsonObj).map(([pid, qty]) => {
                const p = products.find(prod => prod.id === pid);
                return `${p?.name || pid}: ${qty}`;
            }).join('; ');
        };

        const procurementDetail = order.items.map(i => {
            const dipesan = i.qty || 0;
            const diterima = i.received_qty || 0;
            const selisih = diterima - dipesan;
            const statusSelisih = selisih === 0 ? "Pas" : (selisih > 0 ? `+${selisih}` : `${selisih}`);
            return `${i.product?.name || 'Produk'}: ${dipesan} dipesan, ${diterima} diterima (Selisih: ${statusSelisih})`;
        }).join(' | ');

        return {
            'Tanggal Order': order.order_date,
            'No. Surat Jalan Pusat': order.central_note_number || '-',
            'Status Order': order.status === 'received' ? 'Diterima' : 'Draft/Proses',
            'Status Pembayaran': order.payment_status === 'paid' ? 'Lunas' : (order.payment_status === 'partial' ? 'Sebagian' : 'Belum Bayar'),
            'Detail Produk (Procurement)': procurementDetail,
            'Admin Fee': order.admin_fee || 0,
            'Tip Driver': order.driver_tip || 0,
            'TOTAL TRANSAKSI': order.calculated_total,
            'Galon Kembali (Returned)': getGalonString(order.returned_to_central),
            'Galon Pinjam (Borrowed)': getGalonString(order.borrowed_from_central),
            'Jual Galon Kosong (Sold Empty)': getGalonString(order.sold_empty_to_central),
            'Catatan': order.notes || '-',
            'Dibuat Oleh': order.user?.full_name || 'System'
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Procurement Detail");

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const dataBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    saveAs(dataBlob, `Laporan_Procurement_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Excel berhasil diekspor!');
  };

  const handleProductChange = (val) => {
    setSelectedProductId(val);
    setCurrentPage(1);
  };

  if (loading && orders.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
      <div className="container mx-auto p-4 md:p-8 max-w-7xl space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-[#011e4b]">
              Daftar Pesanan dari Pusat
            </h1>
            {!loading && (
              <p className="text-xs text-slate-400">
                Menampilkan {orders.length} dari {totalCount.toLocaleString('id-ID')} pesanan
              </p>
            )}
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button onClick={exportToExcel} variant="outline" className="w-full sm:w-auto border-[#011e4b] text-[#011e4b] hover:bg-gray-50">
                <Download className="h-4 w-4 mr-2" /> Export Excel
            </Button>
            <Button onClick={() => navigate('/central-order/new-form')} className="w-full sm:w-auto bg-[#011e4b] text-white hover:bg-[#011e4b]/90 text-sm">
                <PlusCircle className="h-4 w-4 mr-2" /> Buat Pesanan Baru
            </Button>
          </div>
        </div>

        {/* --- FILTER SECTION --- */}
        <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                <Filter className="h-4 w-4" /> Filter Produk:
            </div>
            <Select value={selectedProductId} onValueChange={handleProductChange}>
                <SelectTrigger className="w-full sm:w-[250px] bg-gray-50">
                    <SelectValue placeholder="Semua Produk" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Semua Produk</SelectItem>
                    {products.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>

        {lastViewedCentralOrder && (
            <Card className="border-l-4 border-yellow-500 shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
                    <CardTitle className="text-base font-semibold text-yellow-700 flex items-center gap-2">
                        <Clock className="h-4 w-4" /> Pesanan Pusat Terakhir Dilihat
                    </CardTitle>
                    <Button variant="ghost" size="icon" onClick={clearLastViewedOrder} className="h-6 w-6">
                        <X className="h-4 w-4" />
                    </Button>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-2 cursor-pointer" onClick={() => navigate(`/central-order/${lastViewedCentralOrder.id}`)}>
                    <div className="flex justify-between text-sm">
                        <p className="font-medium text-[#011e4b]">Dibuat oleh: {lastViewedCentralOrder.userName}</p>
                        <p className="font-bold text-lg text-[#011e4b]">{formatCurrency(lastViewedCentralOrder.calculatedTotal)}</p>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                        <p>Tanggal Order: {lastViewedCentralOrder.orderDate}</p>
                        <div className="flex gap-2">
                            {getOrderStatusBadge(lastViewedCentralOrder.status)}
                            {getPaymentStatusBadge(lastViewedCentralOrder.paymentStatus)}
                        </div>
                    </div>
                </CardContent>
            </Card>
        )}

        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-lg font-semibold text-[#011e4b]">Riwayat Pesanan ({totalCount.toLocaleString('id-ID')})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-md border-t overflow-x-auto">
              <Table className="min-w-max">
                <TableHeader>
                  <TableRow className="text-xs"> 
                    <TableHead className="min-w-[80px] text-[#011e4b] py-2 px-1">Tanggal</TableHead>
                    <TableHead className="min-w-[80px] text-[#011e4b] py-2 px-1">Status Order</TableHead>
                    <TableHead className="min-w-[80px] text-[#011e4b] py-2 px-1">Status Bayar</TableHead> 
                    <TableHead className="min-w-[100px] text-[#011e4b] py-2 px-1">Total</TableHead>
                    <TableHead className="min-w-[120px] text-[#011e4b] py-2 px-1">Produk</TableHead> 
                    <TableHead className="min-w-[80px] text-[#011e4b] py-2 px-1">Dibuat Oleh</TableHead>
                    <TableHead className="min-w-[100px] text-[#011e4b] py-2 px-1">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                      </TableCell>
                    </TableRow>
                  ) : orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-8">
                        Tidak ada pesanan dari pusat yang ditemukan.
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.map(order => (
                      <TableRow 
                        key={order.id} 
                        className="text-[11px] align-top cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => navigate(`/central-order/${order.id}`)}
                      >
                        <TableCell className="whitespace-nowrap py-3 px-1 font-medium">{order.order_date}</TableCell>
                        <TableCell className="py-3 px-1">
                          {getOrderStatusBadge(order.status)}
                        </TableCell>
                        <TableCell className="py-3 px-1" onClick={(e) => e.stopPropagation()}>
                          <Popover>
                            <PopoverTrigger asChild>
                              <div className="cursor-pointer">
                                {getPaymentStatusBadge(order.payment_status)}
                              </div>
                            </PopoverTrigger>
                            <PopoverContent className="w-40 p-2 z-50">
                              <p className="text-[10px] font-bold mb-2 text-gray-500 uppercase px-2">Update Bayar</p>
                              <div className="flex flex-col gap-1">
                                <Button 
                                  variant="ghost" 
                                  className="justify-start h-8 text-[11px] text-green-600"
                                  onClick={() => handleUpdatePaymentStatus(order.id, order, 'paid')}
                                >
                                  Set Lunas
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  className="justify-start h-8 text-[11px] text-red-500"
                                  onClick={() => handleUpdatePaymentStatus(order.id, order, 'unpaid')}
                                >
                                  Set Belum Bayar
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-3 px-1 font-semibold">{formatCurrency(order.calculated_total)}</TableCell>
                        
                        <TableCell className="py-3 px-1">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="xs" 
                                className="h-6 text-[#011e4b] hover:bg-gray-100 text-[10px] whitespace-nowrap"
                                onClick={(e) => e.stopPropagation()} 
                              >
                                Lihat ({order.items.length}) <ChevronDown className="ml-1 h-3 w-3" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-3 z-50" onClick={(e) => e.stopPropagation()}>
                              <p className="text-sm font-semibold mb-2 border-b pb-1">Produk Dipesan</p>
                                <ol className="list-decimal list-inside space-y-3 text-xs">
                                  {order.items.map((item, index) => {
                                    const dipesan = item.qty || 0;
                                    const diterima = item.received_qty || 0;
                                    const adaSelisih = dipesan !== diterima && diterima > 0;
                                    const isEditing = editingReceived[item.id] !== undefined;

                                    return (
                                      <li key={index} className="text-gray-700 whitespace-normal border-b border-slate-50 pb-2 last:border-0">
                                        <div className="flex justify-between items-start mb-1">
                                          <strong className="text-[#011e4b]">{item.product?.name ?? 'Produk Dihapus'}</strong>
                                        </div>
                                        <div className="ml-4 flex flex-col gap-1.5">
                                          <span className="text-slate-500 text-[10px]">Dipesan: {dipesan} pcs</span>
                                          
                                          <div className="flex items-center gap-2">
                                            <span className="text-[10px] whitespace-nowrap">Diterima:</span>
                                            {isEditing ? (
                                              <div className="flex items-center gap-1">
                                                <Input 
                                                  type="number" 
                                                  value={editingReceived[item.id]} 
                                                  onChange={(e) => setEditingReceived(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                  className="h-6 w-16 text-[10px] p-1"
                                                  autoFocus
                                                />
                                                <Button 
                                                  size="icon" 
                                                  variant="ghost" 
                                                  className="h-6 w-6 text-green-600 hover:bg-green-50"
                                                  onClick={() => handleQuickUpdateReceivedQty(order.id, item, editingReceived[item.id])}
                                                  disabled={isUpdating}
                                                >
                                                  <Check className="h-3 w-3" />
                                                </Button>
                                                <Button 
                                                  size="icon" 
                                                  variant="ghost" 
                                                  className="h-6 w-6 text-red-500 hover:bg-red-50"
                                                  onClick={() => setEditingReceived(prev => {
                                                    const next = { ...prev };
                                                    delete next[item.id];
                                                    return next;
                                                  })}
                                                >
                                                  <X className="h-3 w-3" />
                                                </Button>
                                              </div>
                                            ) : (
                                              <div className="flex items-center gap-2">
                                                <span className={`${adaSelisih ? "text-red-600 font-bold" : "text-blue-600 font-medium"} text-[10px]`}>
                                                  {diterima} pcs {adaSelisih ? `(Selisih: ${diterima - dipesan})` : '(Pas)'}
                                                </span>
                                                <Button 
                                                  variant="ghost" 
                                                  size="icon" 
                                                  className="h-5 w-5 text-gray-400 hover:text-[#011e4b]"
                                                  onClick={() => setEditingReceived(prev => ({ ...prev, [item.id]: diterima }))}
                                                >
                                                  <Pencil className="h-2.5 w-2.5" />
                                                </Button>
                                              </div>
                                            )}
                                          </div>

                                          {diterima === 0 && order.status === 'received' && !isEditing && (
                                            <span className="text-red-600 font-bold italic text-[9px]">Barang tidak sampai (0 diterima)</span>
                                          )}
                                        </div>
                                      </li>
                                    );
                                  })}
                                </ol>
                            </PopoverContent>
                          </Popover>
                        </TableCell>
                        
                        <TableCell className="whitespace-nowrap py-3 px-1 text-[10px]">{order.user?.full_name ?? 'N/A'}</TableCell>
                        <TableCell className="py-3 px-1 flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button 
                            variant="ghost" 
                            size="xs" 
                            onClick={() => navigate(`/central-order/${order.id}`)}
                            title="Detail/Edit"
                            className="h-6 w-8 text-blue-500 hover:bg-blue-50 p-0"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="xs" 
                            onClick={() => handleDelete(order.id)}
                            title="Hapus"
                            className="h-6 w-8 text-red-500 hover:bg-red-50 p-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* ── PAGINATION CONTROLS ── */}
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
      </div>
  );
};

export default CentralOrderPage;