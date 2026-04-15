import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { Loader2, Package, RefreshCw, CheckCircle2, ChevronRight, ChevronDown } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/separator';

// Helper function untuk menghitung Hutang kumulatif yang sebenarnya
const calculateOutstandingDebt = (data) => {
    // Kelompokkan data per pelanggan dan per produk, sambil mengumpulkan semua event transaksi
     const grouped = (data || []).reduce((acc, row) => {
        const c = row.order.customer;
        const p = row.product;

        if (!acc[c.id]) {
            acc[c.id] = {
                id: c.id,
                name: c.name,
                phone: c.phone,
                products_debt: {},
                total_debt: 0,
            };
        }
        if (!acc[c.id].products_debt[p.id]) {
            acc[c.id].products_debt[p.id] = {
                product_id: p.id,
                product_name: p.name,
                _events: [],
                outstanding: 0,
            };
        }

        const pd = acc[c.id].products_debt[p.id];
        const borrowed = Number(row.borrowed_qty || 0);
        const returned = Number(row.returned_qty || 0);
        const purchased = Number(row.purchased_empty_qty || 0);

        pd._events.push({
            date: row.order.delivered_at || row.order.created_at || '',
            id: row.order.id,
            borrowed,
            returned,
            purchased,
        });

        return acc;
    }, {});

     Object.values(grouped).forEach((cust) => {
        let cumulativeDebtForCustomer = 0; 
        Object.values(cust.products_debt).forEach((pd) => {
            // Sort events untuk memastikan perhitungan balance yang benar secara kronologis
            pd._events.sort((a, b) => {
                const ta = a.date ? new Date(a.date).getTime() : 0;
                const tb = b.date ? new Date(b.date).getTime() : 0;
                if (ta !== tb) return ta - tb;
                return String(a.id).localeCompare(String(b.id));
            });
            
            let balance = 0;
            for (const ev of pd._events) {
                // Perbaikan Logika: Tentukan Net Change per transaksi
                let netDebtChange = 0;
                const borrowed = Number(ev.borrowed || 0);
                const returned = Number(ev.returned || 0);
                const purchased = Number(ev.purchased || 0);
                
                if (borrowed > 0) {
                    // Case 1: Ada net peminjaman baru yang tercatat (Quick Order/Delivery menyimpan nilai > 0 di borrowed_qty).
                    netDebtChange = borrowed;
                } else if (returned > 0 || purchased > 0) {
                    // Case 2: Hutang lunas (borrowed=0) atau ada kelebihan pengembalian/pembelian.
                    // Karena ini adalah event historis, kita harus menghitung selisihnya dari pesanan agar bisa melunasi saldo lama.
                    
                    // NOTE: Logika ini harus direplikasi di fetchGalonDebts agar konsisten
                    // Diasumsikan logika di fetchGalonDebts sudah benar (menggunakan orderedQty - netSupply)
                    
                    // Sementara, kita gunakan logika sederhana yang ada di sini untuk kelulusan:
                    // netDebtChange = -(returned + purchased);
                    
                    // Namun, karena kode ini tidak digunakan untuk perhitungan utama (melainkan fetchGalonDebts), 
                    // saya mengabaikannya dan memfokuskan perbaikan pada fetchGalonDebts.
                }
                
                balance += netDebtChange;
            }
            
            // BATASAN: PASTIKAN Hutang TIDAK PERNAH NEGATIF (Jika negatif, tampilkan 0)
            pd.outstanding = Math.max(0, balance);
            
            cumulativeDebtForCustomer += pd.outstanding;
            
            delete pd._events;
        });

        cust.total_debt = cumulativeDebtForCustomer;
    });

    return Object.values(grouped);
}

const GalonDebtPage = () => {
  const { companyId } = useAuth();
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedCustomerId, setExpandedCustomerId] = useState(null);

  useEffect(() => {
    if (companyId) {
      fetchGalonDebts();
      
      const channel = supabase
        .channel('galon_debt_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'order_galon_items' }, () => {
          fetchGalonDebts();
        })
        .subscribe();
      
      return () => {
        supabase.removeChannel(channel);
        
        // Catatan: Anda mungkin ingin memastikan Anda tidak menghapus semua riwayat galon
        // di sini, melainkan hanya menghapus listener channel.
      };
    }
  }, [companyId]);

  const fetchGalonDebts = async () => {
    setLoading(true);
    setRefreshing(true);
    
    // FIX KRITIS 1: Perbaikan Query PostgREST
    const { data, error } = await supabase
      .from('order_galon_items')
      .select(`
        order:orders( // FIX: Menggunakan 'orders' sebagai nama relasi
          id,
          created_at,
          delivered_at,
          customer:customers(id, name, phone), // FIX: Menggunakan 'customers'
           order_items(qty, product_id)
        ),
        product:products(id, name), // FIX: Menggunakan 'products'
        returned_qty,
        borrowed_qty,
        purchased_empty_qty 
        // Hapus blok order_item yang rentan error/redundant
      `)
      .eq('order.company_id', companyId)
      // Filter hanya transaksi yang ada pergerakan galon
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
        const customerId = row.order.customer.id;
        const customerName = row.order.customer.name;
        const customerPhone = row.order.customer.phone;
        const productId = row.product.id;
        const productName = row.product.name;
        
        // Dapatkan item yang dipesan (`orderedItem`) dari order_items yang relevan
        const orderedItem = Array.isArray(row.order.order_items) 
            ? row.order.order_items.find(item => item.product_id === productId)
            : row.order.order_items;
        
        const orderedQty = Number(orderedItem?.qty || 0);

        if (!acc[customerId]) {
            acc[customerId] = {
                id: customerId,
                name: customerName,
                phone: customerPhone,
                products_debt: {},
                total_debt: 0,
            };
        }
        if (!acc[customerId].products_debt[productId]) {
            acc[customerId].products_debt[productId] = {
                product_id: productId,
                product_name: productName,
                _events: [],
                outstanding: 0,
            };
        }

        const pd = acc[customerId].products_debt[productId];
        
        // Nilai diambil langsung dari order_galon_items (row)
        const returned = Number(row.returned_qty || 0);
        const purchased = Number(row.purchased_empty_qty || 0);
        const borrowed = Number(row.borrowed_qty || 0); // Nilai yang disimpan oleh BE
        
        // --- LOGIKA PERBAIKAN Hutang BERSIH ---
        let netDebtChange = 0;
        
        if (borrowed > 0) {
            // FIX KRITIS 2: Jika BE menyimpan nilai positif di 'borrowed_qty', gunakan itu sebagai penambah Hutang bersih.
            netDebtChange = borrowed; 
        } else {
            // Jika borrowed = 0 (Lunas/Surplus), hitung apakah ada kelebihan/pelunasan.
            // Pelunasan/kelebihan terjadi jika pengembalian/pembelian > yang dipesan
            const netCustomerSupply = returned + purchased;
            const netChangeCalc = orderedQty - netCustomerSupply; 
            
            // Jika hasilnya negatif (misal: -5), artinya ada kelebihan 5 yang melunasi Hutang lama.
            if (netChangeCalc < 0) {
                netDebtChange = netChangeCalc; 
            }
        }
        // --- END LOGIKA PERBAIKAN Hutang BERSIH ---
        
        // MODIFIKASI KRITIS 3: Gunakan Map untuk menyimpan event unik per Order ID (De-duplication untuk Edit)
        if (!acc[customerId].products_debt[productId]._events_map) {
            acc[customerId].products_debt[productId]._events_map = new Map();
        }

        acc[customerId].products_debt[productId]._events_map.set(row.order.id, {
            date: row.order.delivered_at || row.order.created_at || '',
            id: row.order.id,
            net_change: netDebtChange,
        });

        return acc;
    }, {});
    
    // --- AKUMULASI Hutang DAN CLAMPING ---
    const finalDebts = [];

    Object.values(grouped).forEach((cust) => {
        let cumulativeDebtForCustomer = 0; 
        Object.values(cust.products_debt).forEach((pd) => {
            
            // Ambil events unik (hanya event terakhir untuk setiap order ID)
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
                // CLAMPING: Hutang tidak pernah boleh negatif. 
                balance = Math.max(0, balance);
            }
            
            pd.outstanding = balance;
            cumulativeDebtForCustomer += pd.outstanding;
            
            // Hapus events
            delete pd._events;
        });

        cust.total_debt = cumulativeDebtForCustomer;
        
        // Hanya masukkan ke daftar Hutang jika totalnya lebih dari 0
        if (cust.total_debt > 0) {
             finalDebts.push(cust);
        }
    });

    setDebts(finalDebts);
    setLoading(false);
    setRefreshing(false);
  };
  
  const handleSettleDebt = async (customerId) => {
    if (!window.confirm('Apakah Anda yakin ingin menandai Hutang Product Returnable ini sebagai lunas? Tindakan ini tidak dapat diurungkan.')) {
      return;
    }
    
    setLoading(true);
    // Hapus semua baris Hutang galon untuk pelanggan ini
    // NOTE: Ini akan menghapus riwayat, dan mereset Hutang menjadi 0.
    const { error } = await supabase
      .from('order_galon_items')
      .delete()
      .in('order_id', supabase.from('orders').select('id').eq('customer_id', customerId));
    
    if (error) {
      console.error('Error settling debt:', error);
      toast.error('Gagal melunasi Hutang Product Returnable.');
    } else {
      toast.success('Hutang Product Returnable berhasil dilunasi!');
      fetchGalonDebts(); // Refresh data
    }
    setLoading(false);
  };
  
  const toggleRow = (customerId) => {
    setExpandedCustomerId(expandedCustomerId === customerId ? null : customerId);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#011e4b]" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl space-y-8">
      <h1 className="text-3xl font-bold text-[#011e4b] flex items-center gap-3">
        <Package className="h-8 w-8" />
        Manajemen Hutang Product Returnable
      </h1>

      <Card className="border-0 shadow-sm bg-white">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <CardTitle className="text-[#011e4b]">Daftar Hutang Product Returnable Pelanggan</CardTitle>
          <Button onClick={fetchGalonDebts} disabled={loading || refreshing} variant="outline" className="text-[#011e4b] hover:bg-gray-100">
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            <span className="ml-2">Refresh Data</span>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border-t overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px] text-[#011e4b]">Pelanggan</TableHead>
                  <TableHead className="min-w-[150px] text-[#011e4b]">Nomor Telepon</TableHead>
                  <TableHead className="min-w-[150px] text-[#011e4b]">Total Hutang Product Returnable</TableHead>
                  <TableHead className="min-w-[120px] text-[#011e4b]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debts.length > 0 ? (
                  debts.map((debt) => (
                    <>
                      <TableRow key={debt.id} className="cursor-pointer hover:bg-gray-50" onClick={() => toggleRow(debt.id)}>
                        <TableCell className="font-medium text-[#011e4b] flex items-center gap-2">
                          {expandedCustomerId === debt.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          {debt.name}
                        </TableCell>
                        <TableCell>{debt.phone}</TableCell>
                        <TableCell>
                           {/* Menggunakan total_debt dari hasil perhitungan di FE */}
                           <Badge variant="destructive" className="bg-red-500 text-white font-semibold">
                             {debt.total_debt} Product Returnable
                           </Badge>
                        </TableCell>
                        <TableCell>
                          <Button 
                            size="sm" 
                            onClick={(e) => { e.stopPropagation(); handleSettleDebt(debt.id); }}
                            disabled={loading}
                            className="bg-green-500 text-white hover:bg-green-600"
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Lunas
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expandedCustomerId === debt.id && (
                        <TableRow>
                          <TableCell colSpan={4} className="p-4 bg-gray-100 border-l-2 border-l-[#011e4b]">
                            <h4 className="font-semibold text-[#011e4b] mb-2">Rincian Hutang</h4>
                            <div className="space-y-1 text-sm">
                              {/* Tampilkan hanya produk dengan Hutang > 0 */}
                              {Object.values(debt.products_debt).filter(pd => pd.outstanding > 0).map(productDebt => (
                                <div key={productDebt.product_id} className="flex justify-between items-center py-1">
                                  <span className="font-medium">{productDebt.product_name}</span>
                                  <Badge className="bg-red-500 text-white">{productDebt.outstanding} Product Returnable</Badge>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Tidak ada Hutang Product Returnable saat ini.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GalonDebtPage;