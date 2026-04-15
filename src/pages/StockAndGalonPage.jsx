import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { cn } from '@/lib/utils';
import { useAuth } from '../contexts/AuthContext';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; // Sudah diimpor
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'react-hot-toast';
import { Loader2, Package, RefreshCw, FileText, Search, User } from 'lucide-react'; // Tambahkan Search
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

const StockAndGalonPage = () => {
  const { companyId, userProfile } = useAuth();
  const [products, setProducts] = useState([]);
  const [debts, setDebts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [movements, setMovements] = useState([]);
  const [manualMovements, setManualMovements] = useState([]);
  
  const [currentProductStock, setCurrentProductStock] = useState(0);
  const [currentEmptyBottleStock, setCurrentEmptyBottleStock] = useState(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeStockTab, setActiveStockTab] = useState('summary');

  // NEW STATE FOR SEARCH
  const [productSearchQuery, setProductSearchQuery] = useState('');

  // NEW STATES FOR DETAIL MODAL
  const [isDebtDetailModalOpen, setIsDebtDetailModalOpen] = useState(false);
  const [selectedDebtCustomer, setSelectedDebtCustomer] = useState(null);
  const [debtHistory, setDebtHistory] = useState([]); // To store raw historical movements
  
  const [newMovementForm, setNewMovementForm] = useState({
    type: 'masuk',
    qty: '',
    notes: '',
    movement_for: 'product_stock',
  });

  const [expandedCustomerId, setExpandedCustomerId] = useState(null);

  useEffect(() => {
    if (companyId) {
      fetchProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  useEffect(() => {
    if (selectedProductId) {
      fetchStockValues(selectedProductId);
      fetchMovements(selectedProductId);
      const selectedProduct = products.find((p) => p.id === selectedProductId);
      if (selectedProduct && selectedProduct.is_returnable) {
        fetchGalonDebts(selectedProductId);
      } else {
        setDebts([]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductId, products]);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*, is_returnable, empty_bottle_stock')
      .eq('company_id', companyId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching products:', error);
      toast.error('Gagal memuat daftar produk.');
    } else {
      setProducts(data || []);
      if (data && data.length > 0) {
        setSelectedProductId(data[0].id);
      } else {
        setSelectedProductId(null);
      }
    }
    setLoading(false);
  };
  
  const fetchStockValues = async (productId) => {
    const { data, error } = await supabase
      .from('products')
      .select('stock, empty_bottle_stock')
      .eq('id', productId)
      .single();
    
    if (error) {
        console.error('Error fetching stock values:', error);
        setCurrentProductStock(0);
        setCurrentEmptyBottleStock(0);
    } else {
        setCurrentProductStock(Number(data?.stock || 0));
        setCurrentEmptyBottleStock(Number(data?.empty_bottle_stock || 0));
    }
  };

  const fetchMovements = async (productId) => {
    setLoading(true);
    const { data: movementsData, error } = await supabase
      .from('stock_movements')
      .select(`
        *,
        products (name),
        user:user_id(full_name), 
        orders (id, invoice_number, customers(name, phone))
      `)
      .eq('product_id', productId)
      .order('movement_date', { ascending: false });

    if (error) {
      console.error('Error fetching movements:', error);
      toast.error('Gagal memuat data pergerakan stok.');
    } else {
      const list = movementsData || [];
      setMovements(list);
      setManualMovements(list.filter((m) => 
        ['masuk', 'keluar', 'penyesuaian_stok'].includes(m.type)
      ));
    }
    setLoading(false);
  };

  const fetchCustomerDebtHistory = async (customerId, productId) => {
    setLoading(true);
    // Fetch all related order_galon_items for the customer and product
    const { data, error } = await supabase
      .from('order_galon_items')
      .select(`
        order:orders(
          id, 
          created_at, 
          delivered_at, 
          invoice_number, 
          customer:customer_id(name)
        ),
        returned_qty,
        borrowed_qty,
        purchased_empty_qty
      `)
      .eq('product_id', productId)
      .eq('order.customer_id', customerId)
      .eq('order.company_id', companyId)
      .or('returned_qty.gt.0,borrowed_qty.gt.0,purchased_empty_qty.gt.0');

    if (error) {
      console.error('Error fetching debt history:', error);
      toast.error('Gagal memuat riwayat Hutang.');
      setLoading(false);
      return;
    }
    
    // Sort chronologically by delivery date/created date for display
    const sortedData = (data || []).sort((a, b) => {
        // 🔥 PERBAIKAN: Menggunakan Optional Chaining (?.) untuk mencegah error jika a.order atau b.order adalah null
        const dateA = a.order?.delivered_at || a.order?.created_at || '';
        const dateB = b.order?.delivered_at || b.order?.created_at || '';
        return new Date(dateA).getTime() - new Date(dateB).getTime();
    });

    setDebtHistory(sortedData);
    setLoading(false);
  };
  
  const handleDebtRowClick = (customerData, productData) => {
      setSelectedDebtCustomer({ 
          ...customerData, 
          product_name: productData.product_name,
          product_id: productData.product_id,
          outstanding: productData.outstanding,
          surplus: productData.surplus, // New: Pass surplus to the modal context
      });
      fetchCustomerDebtHistory(customerData.id, productData.product_id);
      setIsDebtDetailModalOpen(true);
  };
  
  const fetchGalonDebts = async (productId) => { 
    if (!productId) {
      setDebts([]);
      setRefreshing(false);
      return;
    }
    setRefreshing(true);

    const { data, error } = await supabase
      .from('order_galon_items')
      .select(`
        order:orders(  
          id,
          created_at,
          delivered_at,
          customer:customer_id(id, name, phone),
          order_items(qty, product_id)
        ),
        product:product_id(id, name),
        returned_qty,
        borrowed_qty,
        purchased_empty_qty 
      `)
      .eq('product_id', productId) 
      .eq('order.company_id', companyId)
      .or('borrowed_qty.gt.0,returned_qty.gt.0,purchased_empty_qty.gt.0');

    if (error) {
      console.error('Error fetching Product Returnable debts:', error);
      toast.error('Gagal memuat data Hutang Product Returnable.');
      setDebts([]);
      setRefreshing(false);
      return;
    }

    // Kelompokkan data per pelanggan dan per produk
    const grouped = (data || []).reduce((acc, row) => {
        // Cek jika row.order null (karena order induk dihapus)
        if (!row.order || !row.order.customer) {
            return acc;
        }

        const customerId = row.order.customer.id;
        const customerName = row.order.customer.name;
        const customerPhone = row.order.customer.phone;
        const prodId = row.product.id;
        const productName = row.product.name;
        
        // Dapatkan item yang dipesan (`orderedItem`) dari order_items yang relevan
        const orderedItem = Array.isArray(row.order.order_items) 
            ? row.order.order_items.find(item => item.product_id === prodId)
            : row.order.order_items; // Fallback jika hanya 1 item
        
        const orderedQty = Number(orderedItem?.qty || 0);

        if (!acc[customerId]) {
            acc[customerId] = {
                id: customerId,
                name: customerName,
                phone: customerPhone,
                products_debt: {},
                total_debt: 0,
                total_credit: 0, // NEW: Initialize total credit
            };
        }
        if (!acc[customerId].products_debt[prodId]) {
            acc[customerId].products_debt[prodId] = {
                product_id: prodId,
                product_name: productName,
                _events: [],
                outstanding: 0,
                surplus: 0, // NEW: Initialize surplus
            };
        }

        const pd = acc[customerId].products_debt[prodId];
        
        // Nilai diambil langsung dari order_galon_items (row)
        const returned = Number(row.returned_qty || 0);
        const purchased = Number(row.purchased_empty_qty || 0);
        const borrowed = Number(row.borrowed_qty || 0); // Nilai yang disimpan oleh BE
        
        // --- LOGIKA PERBAIKAN Hutang BERSIH ---
        let netDebtChange = 0;
        
        if (borrowed > 0) {
            // FIX KRITIS: Jika BE menyimpan nilai positif di 'borrowed_qty', gunakan itu sebagai penambah Hutang bersih.
            netDebtChange = borrowed; 
        } else {
            // Jika borrowed = 0 (Lunas/Surplus), hitung apakah ada kelebihan/pelunasan.
            const netCustomerSupply = returned + purchased;
            const netChangeCalc = orderedQty - netCustomerSupply; 
            
            // Jika hasilnya negatif (misal: -5), artinya ada kelebihan 5 yang melunasi Hutang lama.
            if (netChangeCalc < 0) {
                netDebtChange = netChangeCalc; 
            }
        }
        // --- END LOGIKA PERBAIKAN Hutang BERSIH ---
        
        // 🔥 MODIFIKASI KRITIS: Gunakan Map untuk menyimpan event unik per Order ID
        if (!acc[customerId].products_debt[prodId]._events_map) {
            acc[customerId].products_debt[prodId]._events_map = new Map();
        }

        acc[customerId].products_debt[prodId]._events_map.set(row.order.id, {
            // 🔥 PERBAIKAN: Menggunakan Optional Chaining (?.)
            date: row.order?.delivered_at || row.order?.created_at || '', 
            id: row.order.id,
            net_change: netDebtChange,
        });

        return acc;
    }, {});
    
    // --- AKUMULASI Hutang DAN SURPLUS ---
    const finalDebts = [];

    Object.values(grouped).forEach((cust) => {
        let cumulativeDebtForCustomer = 0; 
        let cumulativeCreditForCustomer = 0; // NEW: Track Credit/Surplus
        
        Object.values(cust.products_debt).forEach((pd) => {
            
            // 🔥 MODIFIKASI KRITIS: Ambil events unik (hanya event terakhir untuk setiap order ID)
            pd._events = Array.from(pd._events_map.values());
            delete pd._events_map;

            // Urutkan events secara kronologis
            pd._events.sort((a, b) => {
                const ta = a.date ? new Date(a.date).getTime() : 0;
                const tb = b.date ? new Date(b.date).getTime() : 0;
                if (ta !== tb) return ta - tb;
                return String(a.id).localeCompare(String(b.id)); 
            });
            
            let balance = 0;
            for (const ev of pd._events) {
                balance += ev.net_change; 
            }
            
            // NEW: Split balance menjadi Outstanding (Debt) dan Surplus (Credit)
            pd.outstanding = Math.max(0, balance);
            pd.surplus = Math.max(0, -balance); // Surplus adalah nilai absolut dari saldo negatif
            
            cumulativeDebtForCustomer += pd.outstanding;
            cumulativeCreditForCustomer += pd.surplus; // Akumulasi credit/surplus
            
            delete pd._events;
        });

        cust.total_debt = cumulativeDebtForCustomer;
        cust.total_credit = cumulativeCreditForCustomer; // Store total credit/surplus
        
        // Filter: Hanya tampilkan pelanggan jika memiliki Hutang ATAU kelebihan
        if (cust.total_debt > 0 || cust.total_credit > 0) {
             finalDebts.push(cust);
        }
    });

    setDebts(finalDebts);
    setRefreshing(false);
  };
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewMovementForm({ ...newMovementForm, [name]: value });
  };
  
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { type, qty, notes, movement_for } = newMovementForm;
    const qtyValue = parseFloat(qty);
    
    if (movement_for === 'product_stock') {
      const { error: rpcError } = await supabase.rpc('update_product_stock', {
        product_id: selectedProductId,
        qty_to_add: type === 'masuk' ? qtyValue : -qtyValue,
      });

      if (rpcError) {
        console.error('Error updating product stock:', rpcError);
        toast.error('Gagal memperbarui stok produk.');
        setLoading(false);
        return;
      }
      
    } else { // movement_for === 'empty_bottle_stock'
      const { error: rpcError } = await supabase.rpc('update_empty_bottle_stock', {
        product_id: selectedProductId,
        qty_to_add: type === 'masuk' ? qtyValue : -qtyValue,
      });
      
      if (rpcError) {
        console.error('Error updating empty bottle stock:', rpcError);
        toast.error('Gagal memperbarui stok Kemasan Returnable.');
        setLoading(false);
        return;
      }
    }

    // Di dalam handleFormSubmit (sekitar baris 330)
    const { error: insertError } = await supabase
      .from('stock_movements')
      .insert({
        product_id: selectedProductId,
        qty: qtyValue,
        type: type === 'masuk' ? 'masuk' : 'keluar',
        notes: `Penyesuaian manual: ${notes}`,
        company_id: companyId,
        user_id: userProfile.id, 
      });
    
    if (insertError) {
      console.error('Error adding movement:', insertError);
      toast.error('Gagal mencatat pergerakan stok.');
    } else {
      toast.success('Penyesuaian stok berhasil dicatat!');
      setNewMovementForm({ type: 'masuk', qty: '', notes: '', movement_for: 'product_stock' });
      fetchProducts();
    }
    setLoading(false);
  };
  
  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const isReturnable = selectedProduct?.is_returnable;

  const toggleRow = (customerId) => {
    setExpandedCustomerId(expandedCustomerId === customerId ? null : customerId);
  };
  
  const galonMovements = useMemo(() => {
    if (!isReturnable) return {};
    const movementsByType = movements.reduce((acc, m) => {
      const type = m.type;
      if (!acc[type]) {
        acc[type] = 0;
      }
      acc[type] += Number(m.qty || 0);
      return acc;
    }, {});
    
    return {
      returnedFromCustomer: movementsByType['pengembalian'] || 0,
      // FIX KRITIS: Tambahkan 'galon_kosong_dibeli' yang digunakan oleh Quick Order BE
      purchasedFromCustomer: (movementsByType['galon_dibeli'] || 0) + (movementsByType['galon_kosong_dibeli'] || 0), 
      // Memastikan peminjaman (borrowed) mencakup 'pinjam_kembali' dari Quick Order
      borrowed: (movementsByType['pinjam_kembali'] || 0) + (movementsByType['keluar_pinjam_dari_pusat'] || 0),
    };
  }, [movements, isReturnable]);
  
  // NEW: Filter produk berdasarkan query pencarian
  const searchFilteredProducts = useMemo(() => {
    if (!productSearchQuery) {
      return products;
    }
    const query = productSearchQuery.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(query)
    );
  }, [products, productSearchQuery]);
  
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#011e4b]" />
      </div>
    );
  }

  return (
    // Mengurangi padding horizontal di mobile (p-4)
    <div className="container mx-auto p-4 md:p-8 max-w-7xl space-y-6">
      {/* Mengurangi ukuran font judul di mobile */}
      <h1 className="text-2xl font-bold text-[#011e4b] flex items-center gap-2">
        <Package className="h-6 w-6 md:h-8 md:w-8" />
        Manajemen Stok
      </h1>

      <Card className="border-0 shadow-sm bg-white">
        <CardHeader className="p-4 md:p-6 pb-2">
          <CardTitle className="text-base font-semibold text-[#011e4b] flex items-center gap-2">
            <Search className="h-4 w-4" /> Cari / Pilih Produk
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0 space-y-3">
          <Input
            type="text"
            placeholder="Ketik nama produk untuk mencari..."
            value={productSearchQuery}
            onChange={(e) => setProductSearchQuery(e.target.value)}
            className="w-full text-sm"
          />
          <Select
            id="product-select"
            value={selectedProductId || undefined}
            onValueChange={(val) => {
              setSelectedProductId(val);
              setActiveStockTab('summary');
              // Opsional: Hapus query pencarian setelah memilih
              setProductSearchQuery(''); 
            }}
          >
            <SelectTrigger className="w-full text-sm">
              <SelectValue placeholder="Pilih Produk" />
            </SelectTrigger>
            <SelectContent>
              {searchFilteredProducts.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name}
                </SelectItem>
              ))}
              {searchFilteredProducts.length === 0 && productSearchQuery && (
                <SelectItem value="no-result" disabled>
                  Tidak ada hasil untuk "{productSearchQuery}"
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      
      <Tabs value={activeStockTab} onValueChange={(v) => setActiveStockTab(v)}>
        {/* Tabs List agar full width di mobile */}
        <TabsList className="w-full grid grid-cols-2 bg-gray-100 text-[#011e4b]">
          <TabsTrigger value="summary" className="text-sm data-[state=active]:bg-[#011e4b] data-[state=active]:text-white data-[state=active]:shadow-sm">Ringkasan Stok</TabsTrigger>
          <TabsTrigger value="adjustment" className="text-sm data-[state=active]:bg-[#011e4b] data-[state=active]:text-white data-[state=active]:shadow-sm">Penyesuaian</TabsTrigger>
        </TabsList>
        
        <TabsContent value="summary" className="pt-4 space-y-6">
          {/* Mengubah grid menjadi 1 kolom di mobile dan 2 di md */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-0 shadow-sm bg-white">
              <CardHeader className="p-4">
                <CardTitle className="text-base text-[#011e4b]">Stok Produk (Siap Jual)</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <p className="text-3xl font-bold text-[#011e4b]">{currentProductStock}</p>
              </CardContent>
            </Card>
            {isReturnable && (
                <Card className="border-0 shadow-sm bg-white">
                  <CardHeader className="p-4">
                    <CardTitle className="text-base text-[#011e4b]">Stok Kemasan Kosong</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-3xl font-bold text-gray-500">{currentEmptyBottleStock}</p>
                  </CardContent>
                </Card>
            )}
          </div>

          {isReturnable && (
            <Card className="border-0 shadow-sm bg-white">
              <CardHeader className="p-4">
                <CardTitle className="text-base text-[#011e4b]">Ringkasan Product Returnable</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {/* Mengubah grid menjadi 1 kolom di mobile dan 3 di sm */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-lg border bg-gray-50">
                    <h3 className="text-sm font-semibold text-[#011e4b] mb-1">Diterima</h3>
                    <p className="text-2xl font-bold text-green-600">
                      {galonMovements.returnedFromCustomer}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border bg-gray-50">
                    <h3 className="text-sm font-semibold text-[#011e4b] mb-1">Dibeli</h3>
                    <p className="text-2xl font-bold text-purple-600">
                      {galonMovements.purchasedFromCustomer}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border bg-gray-50">
                    <h3 className="text-sm font-semibold text-[#011e4b] mb-1">Dipinjam</h3>
                    <p className="text-2xl font-bold text-yellow-600">
                      {galonMovements.borrowed}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {isReturnable && (
            <Card className="border-0 shadow-sm bg-white">
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-4 md:p-6">
                <CardTitle className="text-base text-[#011e4b]">Daftar Hutang Kemasan Pelanggan</CardTitle>
                <Button 
                  onClick={() => fetchGalonDebts(selectedProductId)} 
                  disabled={loading || refreshing} 
                  variant="outline" 
                  className="w-full sm:w-auto text-[#011e4b] hover:bg-gray-100 text-sm"
                >
                  {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Refresh
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="rounded-md border-t overflow-x-auto">
                  <Table className="min-w-max">
                    <TableHeader>
                      <TableRow className="text-xs md:text-sm">
                        <TableHead className="min-w-[120px] text-[#011e4b]">Pelanggan</TableHead>
                        <TableHead className="min-w-[100px] text-[#011e4b]">Telepon</TableHead>
                        {/* UPDATED HEADER */}
                        <TableHead className="min-w-[150px] text-[#011e4b]">Hutang / Kelebihan</TableHead>
                        <TableHead className="min-w-[80px] text-[#011e4b]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                        {debts.length > 0 ? (
                            debts.map((debt) => {
                                const pd = debt.products_debt[selectedProductId];
                                
                                // NEW FILTER: Hanya tampilkan jika ada Hutang ATAU Kelebihan
                                if (!pd || (pd.outstanding <= 0 && pd.surplus <= 0)) {
                                    return null;
                                }

                                const isSurplus = pd.surplus > 0;
                                const isDebt = pd.outstanding > 0;

                                return (
                                    <TableRow
                                        key={debt.id}
                                        className={'cursor-pointer hover:bg-gray-50 text-xs'}
                                        onClick={() => handleDebtRowClick(debt, pd)}
                                    >
                                        <TableCell className={`font-medium ${isDebt ? 'text-red-600' : isSurplus ? 'text-green-600' : 'text-[#011e4b]'}`}>
                                            {debt.name}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">{debt.phone}</TableCell>
                                        {/* UPDATED CELL: Menampilkan Hutang dan Kelebihan */}
                                        <TableCell>
                                            {isDebt && (
                                                <Badge 
                                                    variant="destructive" 
                                                    className={`text-xs whitespace-nowrap bg-red-500 text-white font-semibold`}
                                                >
                                                    {pd.outstanding} (Hutang)
                                                </Badge>
                                            )}
                                            {isSurplus && (
                                                <Badge 
                                                    variant="default" 
                                                    className={`text-xs whitespace-nowrap bg-green-500 text-white font-semibold ${isDebt ? 'ml-1' : ''}`}
                                                >
                                                    +{pd.surplus} (Kelebihan)
                                                </Badge>
                                            )}
                                        </TableCell>
                                        {/* UPDATED CELL: Status mencakup Lunas/Surplus */}
                                        <TableCell>
                                            <Badge 
                                                variant={isDebt ? "destructive" : "default"} 
                                                className={`text-xs whitespace-nowrap ${isDebt ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}
                                            >
                                                {isDebt ? 'Belum Lunas' : 'Lunas/Surplus'}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground py-8 text-sm">
                                    Tidak ada Hutang atau kelebihan kemasan untuk produk ini.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-0 shadow-sm bg-white">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-base text-[#011e4b]">Log Semua Pergerakan Stok</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="rounded-md border-t overflow-x-auto">
                <Table className="min-w-max">
                  <TableHeader>
                    <TableRow className="text-xs md:text-sm">
                      <TableHead className="min-w-[100px] text-[#011e4b]">Tanggal</TableHead>
                      <TableHead className="min-w-[120px] text-[#011e4b]">Produk</TableHead>
                      <TableHead className="min-w-[80px] text-[#011e4b]">Jenis</TableHead>
                      <TableHead className="min-w-[60px] text-[#011e4b]">Jumlah</TableHead>
                      <TableHead className="min-w-[150px] text-[#011e4b]">Catatan</TableHead>
                    </TableRow>
                  </TableHeader>
                {/* Ganti isi TableBody di Log Semua Pergerakan Stok (Sekitar baris 530) */}
                  <TableBody>
                    {movements
                      .filter(m => m.notes && m.notes.trim() !== '' && m.notes !== '-') 
                      .map((m) => (
                        <TableRow key={m.id} className="text-xs md:text-sm hover:bg-slate-50 transition-colors">
                          <TableCell className="whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="font-medium">{new Date(m.movement_date).toLocaleDateString('id-ID')}</span>
                              <span className="text-[10px] text-slate-400">{new Date(m.movement_date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-medium">{m.products?.name}</TableCell>
                          <TableCell className="whitespace-nowrap">
                              <Badge variant="outline" className={cn(
                                  "text-[9px] uppercase font-bold",
                                  m.type.includes('masuk') ? "text-green-600 border-green-200 bg-green-50" : "text-red-600 border-red-200 bg-red-50"
                              )}>
                                  {m.type?.replace(/_/g, ' ')}
                              </Badge>
                          </TableCell>
                          <TableCell className="font-bold text-center">{m.qty}</TableCell>
                          <TableCell>
                              <div className="space-y-1">
                                  <p className="text-xs text-slate-700 leading-tight">{m.notes}</p>
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                      {/* LINK KE ORDER JIKA ADA */}
                                      {m.orders && (
                                          <button 
                                              onClick={() => navigate(`/orders/${m.orders.id}`)}
                                              className="text-[10px] flex items-center gap-1 text-blue-600 font-bold hover:underline"
                                          >
                                              <FileText className="h-3 w-3" /> Orderan dengan Nomor Invoice #{m.orders.invoice_number}
                                          </button>
                                      )}
                                      
                                  </div>
                              </div>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="adjustment" className="pt-4 space-y-6">
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-base text-[#011e4b]">Penyesuaian Stok</CardTitle>
              <CardDescription className="text-sm">
                Tambahkan stok masuk atau keluar secara manual.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="movement-for">Stok yang Disesuaikan</Label>
                  <Select
                    value={newMovementForm.movement_for}
                    onValueChange={(val) => setNewMovementForm({ ...newMovementForm, movement_for: val })}
                  >
                    <SelectTrigger className="w-full text-sm">
                      <SelectValue placeholder="Pilih Jenis Stok" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product_stock">Stok Produk</SelectItem>
                      {isReturnable && <SelectItem value="empty_bottle_stock">Stok Kemasan Returnable</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="movement-type">Jenis Pergerakan</Label>
                  <Select
                    value={newMovementForm.type}
                    onValueChange={(val) => setNewMovementForm({ ...newMovementForm, type: val })}
                  >
                    <SelectTrigger className="w-full text-sm">
                      <SelectValue placeholder="Pilih Jenis Pergerakan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masuk">Stok Masuk</SelectItem>
                      <SelectItem value="keluar">Stok Keluar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="movement-qty">Jumlah</Label>
                  <Input
                    type="number"
                    id="movement-qty"
                    name="qty"
                    placeholder="Jumlah Stok"
                    value={newMovementForm.qty}
                    onChange={handleInputChange}
                    required
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="movement-notes">Catatan</Label>
                  <Input
                    id="movement-notes"
                    name="notes"
                    placeholder="Catatan (Opsional)"
                    value={newMovementForm.notes}
                    onChange={handleInputChange}
                    className="text-sm"
                  />
                </div>
                <Button type="submit" className="w-full bg-[#011e4b] text-white hover:bg-[#00376a] text-sm" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 'Catat Penyesuaian'}
                </Button>
              </form>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm bg-white">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="text-base text-[#011e4b]">Riwayat Penyesuaian Manual</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="rounded-md border-t overflow-x-auto">
                <Table className="min-w-max">
                  <TableHeader>
                    <TableRow className="text-xs md:text-sm">
                      <TableHead className="min-w-[100px] text-[#011e4b]">Tanggal</TableHead>
                      <TableHead className="min-w-[120px] text-[#011e4b]">Produk</TableHead>
                      <TableHead className="min-w-[80px] text-[#011e4b]">Jenis</TableHead>
                      <TableHead className="min-w-[60px] text-[#011e4b]">Jumlah</TableHead>
                      <TableHead className="min-w-[150px] text-[#011e4b]">Catatan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {manualMovements.map((m) => (
                      <TableRow key={m.id} className="text-xs md:text-sm">
                        <TableCell className="whitespace-nowrap">{new Date(m.movement_date).toLocaleDateString('id-ID')}</TableCell>
                        <TableCell className="whitespace-nowrap">{m.products?.name}</TableCell>
                        <TableCell className="whitespace-nowrap">{m.type}</TableCell>
                        <TableCell className="font-medium whitespace-nowrap">{m.qty}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{m.notes}</TableCell>
                      </TableRow>
                    ))}
                    {movements.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-sm">
                          Tidak ada data penyesuaian manual.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
      
      {/* --- MODAL DETAIL Hutang GALON --- */}
      <Dialog open={isDebtDetailModalOpen} onOpenChange={setIsDebtDetailModalOpen}>
          <DialogContent className="sm:max-w-4xl max-h-[95vh] overflow-y-auto">
              <DialogHeader>
                  <DialogTitle className="text-[#011e4b] flex items-center gap-2">
                      <FileText className="h-5 w-5" /> Riwayat Hutang Kemasan: {selectedDebtCustomer?.name}
                  </DialogTitle>
                  <CardDescription>
                      Produk: {selectedDebtCustomer?.product_name} | 
                      Hutang Saat Ini: **{selectedDebtCustomer?.outstanding}** pcs 
                      {selectedDebtCustomer?.surplus > 0 && ` | Kelebihan: **+${selectedDebtCustomer?.surplus}** pcs`}
                  </CardDescription>
              </DialogHeader>
              <Card className="shadow-none border">
                  <CardHeader>
                      <CardTitle className="text-base">Detail Transaksi yang Memengaruhi Hutang</CardTitle>
                  </CardHeader>
                  <CardContent>
                      <div className="rounded-md border overflow-x-auto">
                          <Table>
                              <TableHeader>
                                  <TableRow className="text-xs md:text-sm">
                                      <TableHead className="min-w-[120px]">Tanggal Kirim</TableHead>
                                      <TableHead className="min-w-[120px]">No. Invoice</TableHead>
                                      <TableHead className="min-w-[120px]">Dikembalikan</TableHead>
                                      <TableHead className="min-w-[120px]">Dibeli Pelanggan</TableHead>
                                      <TableHead className="min-w-[120px]">Dipinjam Baru</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {debtHistory.map((item, index) => (
                                      <TableRow key={index} className="text-xs">
                                          <TableCell>{item.order?.invoice_number || 'Dihapus'}</TableCell>
                                          <TableCell>{item.order?.invoice_number}</TableCell>
                                          <TableCell className="text-green-600 font-medium">{item.returned_qty}</TableCell>
                                          <TableCell className="text-purple-600 font-medium">{item.purchased_empty_qty}</TableCell>
                                          <TableCell className="text-red-600 font-medium">{item.borrowed_qty}</TableCell>
                                      </TableRow>
                                  ))}
                                  {debtHistory.length === 0 && (
                                      <TableRow>
                                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                              Tidak ada riwayat transaksi yang memengaruhi Hutang saat ini.
                                          </TableCell>
                                      </TableRow>
                                  )}
                              </TableBody>
                          </Table>
                      </div>
                  </CardContent>
              </Card>
              <DialogFooter>
                  <Button onClick={() => setIsDebtDetailModalOpen(false)}>Tutup</Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
};

export default StockAndGalonPage;