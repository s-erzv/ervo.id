import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'react-hot-toast';
import { Loader2, Plus, X, ArrowLeft, Pencil, Check, ChevronsUpDown, ImageIcon } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

const EditOrderPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { session, companyId, userId } = useAuth();
  
  const [order, setOrder] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [couriers, setCouriers] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editForm, setEditForm] = useState({ 
    customer_id: '', 
    planned_date: '', 
    notes: '', 
    courier_ids: [],
    transport_cost: 0, 
  });
  
  const [editItems, setEditItems] = useState([]);
  const [newEditItem, setNewEditItem] = useState({ 
    product_id: '', 
    qty: 0, 
    price: 0 
  });

  const [editingIndex, setEditingIndex] = useState(-1);
  const [tempItem, setTempItem] = useState({});
  const [openProductPopover, setOpenProductPopover] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    if (!orderId || !companyId) {
      toast.error('ID pesanan tidak valid.');
      navigate('/orders');
      return;
    }

    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          customers (id, name, customer_status, phone, address),
          order_couriers (courier:profiles!order_couriers_courier_id_fkey(id, full_name)),
          order_items (*, products(id, name, is_returnable, image_url, sku))
        `)
        .eq('id', orderId)
        .single();
      
      if (orderError || !orderData) throw new Error('Pesanan tidak ditemukan.');

      // FETCH CUSTOMERS
      const { data: customersData } = await supabase.from('customers').select('id, name, customer_status').eq('company_id', companyId);
      
      // FETCH COURIERS
      const { data: couriersData } = await supabase.from('profiles').select('id, full_name').eq('role', 'user').eq('company_id', companyId);
      
      // FETCH PRODUCTS WITH IMAGE_URL & SKU
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name, purchase_price, company_id, sort_order, image_url, sku')
        .eq('company_id', companyId)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      setOrder(orderData);
      setCustomers(customersData || []);
      setCouriers(couriersData || []);
      setProducts(productsData || []);

      setEditForm({
        customer_id: orderData.customer_id,
        planned_date: orderData.planned_date,
        notes: orderData.notes || '',
        courier_ids: orderData.order_couriers?.map(c => c.courier?.id).filter(Boolean) || [],
        transport_cost: parseFloat(orderData.transport_cost) || 0,
      });

      setEditItems(orderData.order_items?.map(item => ({
        product_id: item.product_id,
        product_name: item.products?.name || 'Produk Tidak Dikenal',
        image_url: item.products?.image_url,
        qty: item.qty,
        price: item.price,
        item_type: item.item_type,
      })) || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Gagal memuat data pesanan: ' + error.message);
      navigate('/orders');
    } finally {
      setLoading(false);
    }
  }, [orderId, companyId, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditForm({ ...editForm, [name]: value });
  };
  
  const handleEditCourierCheckboxChange = (courierId, checked) => {
    setEditForm(prevForm => {
      const newCourierIds = checked
        ? [...prevForm.courier_ids, courierId]
        : prevForm.courier_ids.filter(id => id !== courierId);
      return { ...prevForm, courier_ids: newCourierIds };
    });
  };

  const handleNewEditItemChange = (e) => {
    const { name, value } = e.target;
    setNewEditItem({ ...newEditItem, [name]: parseFloat(value) || 0 });
  };
  
  const handleProductSelectChange = async (val) => {
    setOpenProductPopover(false);
    const selectedProduct = products.find((p) => p.id === val);
    const selectedCustomer = customers.find((c) => c.id === editForm.customer_id);

    if (!selectedCustomer) {
      toast.error('Data pelanggan tidak ditemukan.');
      return;
    }

    const { data: priceData, error } = await supabase
      .from('product_prices')
      .select('price')
      .match({
          product_id: selectedProduct.id,
          customer_status: selectedCustomer.customer_status,
          company_id: companyId,
      })
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching price:', error);
    }

    setNewEditItem({
      ...newEditItem,
      product_id: val,
      price: priceData?.price || 0,
      qty: '', 
    });
  };

  const handleEditItemAdd = () => {
    const qtyVal = parseFloat(newEditItem.qty);
    if (!newEditItem.product_id || qtyVal <= 0) {
      toast.error('Pilih produk dan masukkan jumlah yang valid.');
      return;
    }
    
    if (editingIndex !== -1) {
        toast.error('Simpan perubahan item terlebih dahulu.');
        return;
    }

    const selectedProduct = products.find((p) => p.id === newEditItem.product_id);
    const itemToAdd = {
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      image_url: selectedProduct.image_url,
      qty: qtyVal,
      price: newEditItem.price,
      item_type: 'beli',
      order_id: orderId,
    };

    setEditItems([...editItems, itemToAdd]);
    setNewEditItem({ product_id: '', qty: 0, price: 0 });
  };

  const handleEditItemRemove = (index) => {
    const newItems = editItems.filter((_, i) => i !== index);
    setEditItems(newItems);
  };
  
  const handleEditClick = (index) => {
    if (editingIndex !== -1) {
        toast.error('Selesaikan edit item sebelumnya.');
        return;
    }
    setEditingIndex(index);
    setTempItem(editItems[index]); 
  };

  const handleCancelEdit = () => {
    setEditingIndex(-1);
    setTempItem({});
  };

  const handleInlineUpdate = (field, value) => {
    setTempItem(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveEdit = (index) => {
      const finalQty = parseFloat(tempItem.qty);
      const finalPrice = parseFloat(tempItem.price); 

      if (finalQty <= 0) {
          toast.error('Jumlah harus lebih dari nol.');
          return;
      }

      setEditItems(prev => prev.map((item, i) => 
          i === index 
              ? { ...tempItem, qty: finalQty, price: finalPrice } 
              : item
      ));
      setEditingIndex(-1);
      setTempItem({});
      toast.success('Item diperbarui.');
  };

  const handleEditFormSubmit = async (e) => {
    e.preventDefault();

    if (!userId) {
      toast.error("Sesi login tidak ditemukan. Silakan login ulang.");
      return;
    }

    setIsSubmitting(true);

    if (editItems.length === 0) {
      toast.error('Pesanan minimal harus ada satu item.');
      setIsSubmitting(false);
      return;
    }
    
    if (editingIndex !== -1) {
        toast.error('Simpan perubahan item terlebih dahulu.');
        setIsSubmitting(false);
        return;
    }
    
    try {
      const payload = {
        orderId,
        userId: userId,
        orderDetails: { 
            ...editForm, 
            company_id: companyId,
            transport_cost: parseFloat(editForm.transport_cost) || 0 
        },
        orderItems: editItems.map(item => ({
          product_id: item.product_id,
          qty: item.qty,
          price: item.price,
          item_type: item.item_type,
        })),
      };

      const { data: result, error: invokeError } = await supabase.functions.invoke('edit-order', {
        method: 'PUT',
        body: payload,
      });

      if (invokeError) {
        throw new Error(invokeError.message || 'Gagal memperbarui pesanan.');
      }
    
      toast.success('Pesanan berhasil diperbarui!');
      navigate('/orders');
    } catch (error) {
      console.error('Error updating order:', error.message);
      toast.error('Gagal update: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };
  
  const calculateTotal = () => {
    const itemsTotal = editItems.reduce((total, item) => total + (item.qty * item.price), 0);
    const transportTotal = parseFloat(editForm.transport_cost) || 0;
    return itemsTotal + transportTotal;
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-white">
        <Loader2 className="h-10 w-10 animate-spin text-[#011e4b]" />
        <p className="mt-4 text-muted-foreground">Memuat data...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-white">
        <p className="mt-4 text-red-500">Pesanan tidak ditemukan.</p>
        <Button onClick={() => navigate('/orders')} className="mt-4">Kembali</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="hover:bg-slate-100">
          <ArrowLeft className="h-5 w-5 text-slate-700" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-[#011e4b]">Edit Pesanan #{order.invoice_number || order.id.slice(0,8)}</h1>
          <p className="text-xs text-muted-foreground">Perbarui detail pesanan pelanggan.</p>
        </div>
      </div>
      
      <Card className="border-none shadow-xl bg-white overflow-hidden">
        <CardHeader className="bg-[#011e4b] text-white pb-6">
          <CardTitle className="text-lg font-medium">Formulir Perubahan</CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 space-y-6">
          <form onSubmit={handleEditFormSubmit} className="space-y-6">
            
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="customer_id" className="text-slate-600 font-semibold">Pelanggan</Label>
                    <Select value={editForm.customer_id} onValueChange={(val) => setEditForm({ ...editForm, customer_id: val })} disabled={true}>
                        <SelectTrigger className="bg-slate-100 border-slate-200 text-slate-600">
                            <SelectValue placeholder="Pilih Pelanggan" />
                        </SelectTrigger>
                        <SelectContent>
                            {customers.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="planned_date" className="text-slate-600 font-semibold">Tanggal Pemesanan</Label>
                    <Input
                        type="date"
                        name="planned_date"
                        value={editForm.planned_date}
                        onChange={handleEditFormChange}
                        className="border-slate-200"
                        required
                    />
                </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-slate-600 font-semibold">Petugas</Label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                {couriers.map((courier) => (
                  <div key={courier.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={`edit-courier-${courier.id}`}
                      checked={editForm.courier_ids?.includes(courier.id)}
                      onCheckedChange={(checked) => handleEditCourierCheckboxChange(courier.id, checked)}
                      className="border-slate-300 data-[state=checked]:bg-slate-900"
                    />
                    <Label htmlFor={`edit-courier-${courier.id}`} className="text-sm font-normal cursor-pointer text-slate-700">
                      {courier.full_name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-slate-600 font-semibold">Catatan (Opsional)</Label>
              <Input
                name="notes"
                placeholder="Contoh: Titip di satpam..."
                value={editForm.notes}
                onChange={handleEditFormChange}
                className="border-slate-200 text-sm"
              />
            </div>
            
            <Separator className="bg-slate-100" />

            <div className="space-y-4">
              <Label className="text-slate-600 font-semibold">Item Produk</Label>
              
              <div className="flex flex-col sm:flex-row gap-2">
                <Popover open={openProductPopover} onOpenChange={setOpenProductPopover}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" aria-expanded={openProductPopover} className="flex-1 justify-between font-normal border-slate-200 h-14" disabled={editingIndex !== -1}>
                            <div className="flex items-center gap-3 overflow-hidden">
                              {newEditItem.product_id ? (
                                <div className="w-10 h-10 rounded border overflow-hidden shrink-0">
                                   {products.find(p => p.id === newEditItem.product_id)?.image_url ? (
                                     <img src={products.find(p => p.id === newEditItem.product_id).image_url} className="w-full h-full object-cover" />
                                   ) : <div className="w-full h-full bg-slate-100 flex items-center justify-center"><ImageIcon className="h-4 w-4 text-slate-300" /></div>}
                                </div>
                              ) : null}
                              <span className="truncate">
                                {products.find((p) => p.id === newEditItem.product_id)?.name || "Pilih Produk..."}
                              </span>
                            </div>
                            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[350px] p-0" align="start">
                        <Command>
                            <CommandInput placeholder="Cari produk..." />
                            <CommandList>
                                <CommandEmpty>Tidak ditemukan.</CommandEmpty>
                                <CommandGroup>
                                    {products.map((product) => (
                                        <CommandItem key={product.id} value={product.name} onSelect={() => handleProductSelectChange(product.id)} className="cursor-pointer py-3">
                                            <div className="flex items-center gap-3 w-full">
                                              <div className="w-12 h-12 rounded border overflow-hidden shrink-0">
                                                {product.image_url ? (
                                                  <img src={product.image_url} className="w-full h-full object-cover" />
                                                ) : <div className="w-full h-full bg-slate-100 flex items-center justify-center"><ImageIcon className="h-6 w-6 text-slate-300" /></div>}
                                              </div>
                                              <div className="flex flex-col">
                                                <span className="font-medium text-sm">{product.name}</span>
                                                <span className="text-[10px] text-slate-400">SKU: {product.sku || '-'}</span>
                                              </div>
                                            </div>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>

                <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Qty"
                      name="qty"
                      value={newEditItem.qty}
                      onChange={handleNewEditItemChange}
                      disabled={!newEditItem.product_id || editingIndex !== -1}
                      className="w-24 border-slate-200 h-14 text-center font-bold text-lg"
                    />
                    <Button type="button" onClick={handleEditItemAdd} disabled={!newEditItem.product_id || newEditItem.qty <= 0 || editingIndex !== -1} size="icon" className="bg-[#011e4b] hover:bg-slate-800 shrink-0 text-white h-14 w-14">
                      <Plus className="h-6 w-6" />
                    </Button>
                </div>
              </div>

              <div className="space-y-3">
                  {editItems.map((item, index) => {
                      const itemTotal = item.qty * item.price;
                      const isEditing = index === editingIndex;

                      return (
                          <div key={index} className={cn(
                            "flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 border rounded-xl transition-all gap-3",
                            isEditing ? "border-blue-500 bg-blue-50/30" : "border-slate-100 hover:border-slate-200"
                          )}>
                              {isEditing ? (
                                  <div className="flex items-center gap-2 w-full">
                                      <div className="flex-1">
                                          <p className="text-xs text-slate-500 mb-1">Edit Qty</p>
                                          <Input
                                              type="number"
                                              value={tempItem.qty}
                                              onChange={(e) => handleInlineUpdate('qty', e.target.value)}
                                              className="h-10 bg-white"
                                          />
                                      </div>
                                      <div className="flex-1">
                                          <p className="text-xs text-slate-500 mb-1">Harga Satuan</p>
                                          <Input
                                              type="number"
                                              value={tempItem.price}
                                              disabled
                                              className="h-10 bg-slate-100 text-slate-500 cursor-not-allowed"
                                          />
                                      </div>
                                      <div className="flex gap-1 mt-auto h-10">
                                          <Button type="button" size="icon" onClick={() => handleSaveEdit(index)} className="bg-green-600 hover:bg-green-700 h-10 w-10"><Check className="h-4 w-4" /></Button>
                                          <Button type="button" size="icon" variant="outline" onClick={handleCancelEdit} className="h-10 w-10 border-slate-300"><X className="h-4 w-4" /></Button>
                                      </div>
                                  </div>
                              ) : (
                                  <>
                                      <div className="flex items-center gap-4 flex-1">
                                         <div className="w-14 h-14 rounded-lg border bg-white overflow-hidden shrink-0 shadow-sm">
                                           {item.image_url ? (
                                             <img src={item.image_url} className="w-full h-full object-cover" />
                                           ) : <div className="w-full h-full bg-slate-50 flex items-center justify-center"><ImageIcon className="h-5 w-5 text-slate-200" /></div>}
                                         </div>
                                         <div className="flex flex-col min-w-0">
                                             <span className="text-sm font-bold text-slate-900 truncate">{item.product_name}</span>
                                             <span className="text-xs text-slate-500">{item.qty} pcs x {formatCurrency(item.price)}</span>
                                         </div>
                                      </div>
                                      
                                      <div className="flex items-center justify-between w-full sm:w-auto gap-4 pl-16 sm:pl-0">
                                          <span className="font-bold text-base text-[#011e4b]">{formatCurrency(itemTotal)}</span>
                                          <div className="flex gap-1">
                                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-blue-500" onClick={() => handleEditClick(index)} disabled={isSubmitting}>
                                                  <Pencil className="h-3.5 w-3.5" />
                                              </Button>
                                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleEditItemRemove(index)} disabled={isSubmitting}>
                                                  <X className="h-4 w-4" />
                                              </Button>
                                          </div>
                                      </div>
                                  </>
                              )}
                          </div>
                      );
                  })}
                  {editItems.length === 0 && (
                      <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl text-sm">
                          Belum ada item ditambahkan.
                      </div>
                  )}
              </div>
            </div>

            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex justify-between items-center mt-4">
              <div className="space-y-1">
                  <Label className="text-blue-900 font-semibold text-xs tracking-wider">Ongkos Kirim</Label>
                  <p className="text-[10px] text-blue-600 italic">Ditambahkan ke total</p>
              </div>
              <div className="relative w-32">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">Rp</span>
                <Input
                  type="number"
                  name="transport_cost"
                  value={editForm.transport_cost}
                  onChange={handleEditFormChange}
                  className="pl-9 h-9 bg-white border-blue-200 focus-visible:ring-blue-500 font-semibold"
                  onWheel={(e) => e.target.blur()}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-dashed border-slate-200 flex justify-between items-end">
              <div className="space-y-1">
                  <p className="text-[11px] text-slate-400">Total belanja: {formatCurrency(editItems.reduce((acc, curr) => acc + (curr.qty * curr.price), 0))}</p>
                  <h3 className="text-xs font-semibold text-slate-500 tracking-widest">Total Bayar</h3>
              </div>
              <h3 className="text-2xl font-semibold text-[#011e4b]">{formatCurrency(calculateTotal())}</h3>
            </div>

            <Button type="submit" className="w-full bg-[#011e4b] text-white hover:bg-slate-800 py-7 text-base font-semibold shadow-lg shadow-slate-200" disabled={isSubmitting || editItems.length === 0 || editingIndex !== -1}>
              {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Check className="h-5 w-5 mr-2" />}
              Simpan Perubahan
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default EditOrderPage;