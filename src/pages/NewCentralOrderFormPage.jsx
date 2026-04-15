import { useEffect, useState, useMemo } from 'react';
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
import { Input } from '@/components/ui/input';
import { toast } from 'react-hot-toast';
import { Loader2, Plus, Trash2, ArrowLeft, ChevronsUpDown } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

const NewCentralOrderFormPage = () => {
  const navigate = useNavigate();
  const { userProfile, loading: authLoading, companyId } = useAuth();
  
  // products kini menyimpan data produk termasuk stok, permintaan, dan selisih
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Tab 1 State
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [orderItems, setOrderItems] = useState([{ product_id: '', qty: '', price: '', is_returnable: false, sold_empty_price: 0 }]);
  
  // States untuk popover produk
  const [isProductPopoverOpen, setIsProductPopoverOpen] = useState({});

  // Memo untuk kalkulasi total
  const totalItemsValue = useMemo(() => {
    return orderItems.reduce((sum, item) => {
      const qty = parseFloat(item.qty) || 0;
      const price = parseFloat(item.price) || 0;
      return sum + (qty * price);
    }, 0);
  }, [orderItems]);

  useEffect(() => {
    if (!authLoading && companyId) {
      // Memanggil fungsi baru untuk mengambil Stok dan Permintaan
      fetchStockAndDemandData();
    }
  }, [authLoading, companyId]);

  /**
   * Mengambil data produk, stok saat ini, dan menghitung permintaan (demand) 
   * dari pesanan pelanggan yang belum selesai.
   */
  const fetchStockAndDemandData = async () => {
    if (!companyId) return;
    setLoading(true);

    try {
        // 1. Fetch data produk (Stok Saat Ini)
        const { data: productsData, error: productsError } = await supabase
            .from('products')
            .select('id, name, stock, purchase_price, is_returnable, empty_bottle_price, sort_order')
            .eq('company_id', companyId)
            .order('sort_order', { ascending: true });

        if (productsError) throw productsError;

        // 2. Fetch Demand Data (Sum of qty in open orders)
        // PERBAIKAN: Gunakan !inner agar baris tanpa order (yg sesuai filter company_id) dibuang
        const { data: orderItemsData, error: orderItemsError } = await supabase
            .from('order_items')
            .select(`
                product_id,
                qty,
                order:order_id!inner(status, company_id)
            `)
            .eq('order.company_id', companyId) // Filter company di tabel order
            .not('order.status', 'in', '("completed","cancelled")'); // Langsung filter status di query

        if (orderItemsError) {
            console.error('Error fetching order items for demand:', orderItemsError);
        }

        // 3. Aggregate Demand
        const demandMap = {};
        (orderItemsData || []).forEach(item => {
            const qty = parseFloat(item.qty) || 0;
            demandMap[item.product_id] = (demandMap[item.product_id] || 0) + qty;
        });

        // 4. Combine and Calculate Selisih
        const combinedProductData = productsData.map(product => {
            const currentStock = parseFloat(product.stock) || 0;
            const demand = demandMap[product.id] || 0;
            const difference = currentStock - demand;

            return {
                ...product,
                current_stock: currentStock,
                demand: demand,
                difference: difference
            };
        });

        setProducts(combinedProductData);
        
    } catch (error) {
        console.error('Error in fetching stock and demand:', error);
        toast.error('Gagal memuat data stok dan permintaan: ' + error.message);
    } finally {
        setLoading(false);
    }
  };
  
  const handleItemChange = (index, field, value) => {
    const newItems = [...orderItems];
    newItems[index][field] = value;
    
    if (field === 'product_id') {
        // Cari produk dari state `products` yang kini sudah mengandung data stok/demand
        const selectedProduct = products.find(p => p.id === value);
        if (selectedProduct) {
            newItems[index].price = selectedProduct.purchase_price; 
            newItems[index].is_returnable = selectedProduct.is_returnable;
            newItems[index].sold_empty_price = selectedProduct.empty_bottle_price;
        } else {
            newItems[index].is_returnable = false;
            newItems[index].sold_empty_price = 0;
        }
    }
    
    setOrderItems(newItems);
  };

  const handleAddItem = () => {
    setOrderItems([...orderItems, { product_id: '', qty: '', price: '', is_returnable: false, sold_empty_price: 0 }]);
  };

  const handleRemoveItem = (index) => {
    const newItems = orderItems.filter((_, i) => i !== index);
    setOrderItems(newItems);
  };
  
  const handleInputWheel = (e) => {
    e.target.blur();
  };

  const handleSaveOrder = async () => {
    setLoading(true);
    if (!userProfile?.id || !companyId) {
        toast.error('Profil pengguna atau ID perusahaan tidak ditemukan. Silakan login ulang.');
        setLoading(false);
        return;
    }
    
    if (orderItems.some(item => !item.product_id || !item.qty || parseFloat(item.qty) <= 0)) {
        toast.error('Pastikan semua produk dipilih dan kuantitas diisi.');
        setLoading(false);
        return;
    }
    
    try {
        const { data, error } = await supabase
          .from('central_orders')
          .insert({
            order_date: orderDate,
            company_id: userProfile.company_id,
            user_id: userProfile.id,
            status: 'draft',
          })
          .select()
          .single();
        if (error) throw error;
        
        const { error: itemsError } = await supabase
          .from('central_order_items')
          .insert(orderItems.map(item => ({
            central_order_id: data.id,
            product_id: item.product_id,
            qty: parseFloat(item.qty) || 0,
            price: parseFloat(item.price) || 0,
            sold_empty_price: parseFloat(item.sold_empty_price) || 0,
          })));
        if (itemsError) throw itemsError;
        
        const { error: pricesError } = await supabase
          .from('central_order_prices')
          .upsert(orderItems.map(item => ({
            product_id: item.product_id,
            price: parseFloat(item.price) || 0,
            order_date: orderDate,
            company_id: userProfile.company_id,
          })));
        if (pricesError) throw pricesError;

        toast.success('Pesanan berhasil dibuat!');
        navigate(`/central-order/${data.id}`);
      
    } catch (error) {
      console.error('Error saving new order:', error);
      toast.error('Gagal menyimpan pesanan: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleProductSelectChange = (index, productId) => {
    handleItemChange(index, 'product_id', productId);
    setIsProductPopoverOpen(prev => ({ ...prev, [index]: false }));
  };


  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Buat Pesanan Baru dari Pusat</h1>
        <Button onClick={() => navigate('/central-orders')} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" /> Kembali
        </Button>
      </div>

      <Card className="p-4 md:p-6">
        <CardHeader><CardTitle>Detail Pesanan</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="order-date">Tanggal Pesanan</Label>
            <Input
              id="order-date"
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
            />
          </div>

          <h3 className="font-semibold mt-6">Daftar Item</h3>
          <div className="space-y-4">
            {orderItems.map((item, index) => {
              const selectedProduct = products.find(p => p.id === item.product_id);
              const selectedProductName = selectedProduct?.name || 'Pilih Produk';
              
              // Data Stok dan Permintaan yang sudah dihitung
              const currentStock = selectedProduct?.current_stock ?? 0;
              const demand = selectedProduct?.demand ?? 0;
              const difference = selectedProduct?.difference ?? 0;

              return (
              <div key={index} className="space-y-4 p-4 border rounded-md">
                <div className="flex flex-col sm:flex-row gap-2 items-end">
                  <div className="w-full sm:w-auto flex-1">
                    <Label htmlFor={`product-${index}`}>Produk</Label>
                    {/* POP OVER PRODUCT START */}
                    <Popover open={isProductPopoverOpen[index]} onOpenChange={(open) => setIsProductPopoverOpen(prev => ({...prev, [index]: open}))}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={isProductPopoverOpen[index]}
                          className="w-full justify-between"
                          disabled={loading}
                        >
                          {selectedProductName}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput placeholder="Cari produk..." />
                          <CommandList>
                            <CommandEmpty>Produk tidak ditemukan.</CommandEmpty>
                            <CommandGroup>
                              {products.map(product => (
                                <CommandItem
                                  key={product.id}
                                  value={product.name}
                                  onSelect={() => handleProductSelectChange(index, product.id)}
                                >
                                  {product.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {/* POP OVER PRODUCT END */}
                  </div>
                  <div className="w-full sm:w-24">
                    <Label htmlFor={`qty-${index}`}>Jumlah</Label>
                    <Input
                      id={`qty-${index}`}
                      type="number"
                      value={item.qty}
                      onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                      onWheel={handleInputWheel}
                    />
                  </div>
                  <div className="w-full sm:w-32">
                    <Label htmlFor={`price-${index}`}>Harga Per Item</Label>
                    <Input
                      id={`price-${index}`}
                      type="number"
                      value={item.price}
                      onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                      placeholder="Harga"
                      onWheel={handleInputWheel}
                      readOnly
                      className="bg-gray-100 cursor-not-allowed"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    onClick={() => handleRemoveItem(index)}
                    className="mt-2 sm:mt-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* NEW: Tampilan Stok dan Demand */}
                {item.product_id && (
                    <div className="mt-2 text-sm p-3 bg-gray-50 border rounded-md grid grid-cols-3 gap-2">
                        <div className="flex flex-col">
                            <span className="text-gray-600">Stok Tersedia</span>
                            <span className="font-bold text-lg">{currentStock}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-gray-600">Permintaan (Open Order)</span>
                            <span className="font-bold text-lg text-yellow-600">{demand}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-gray-600">Selisih (Stok - Minta)</span>
                            <span className={`font-bold text-lg ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {difference}
                            </span>
                        </div>
                    </div>
                )}
                {/* END NEW */}

              </div>
            )})}
          </div>
          <Button type="button" variant="outline" className="w-full" onClick={handleAddItem}>
            <Plus className="h-4 w-4 mr-2" /> Tambah Item
          </Button>
          <Button 
              onClick={handleSaveOrder} 
              className="w-full mt-4 bg-[#011e4b] text-white hover:bg-[#011e4b]/90" 
              disabled={loading || authLoading}
          >
            {loading || authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan Pesanan Baru'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default NewCentralOrderFormPage;