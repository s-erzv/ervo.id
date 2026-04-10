import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'react-hot-toast';
import { Loader2, Plus, X, ChevronsUpDown, Pencil, Check, ImageIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CustomerForm from './CustomerForm';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';

const formatCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0
    }).format(amount);
};

const AddOrderForm = ({ onOrderSuccess, isQuickOrderMode = false }) => {
  const { session, companyId, userProfile } = useAuth();
  const navigate = useNavigate();

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [couriers, setCouriers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [orderItems, setOrderItems] = useState([]);
  const [newItem, setNewItem] = useState({ product_id: '', qty: '', price: 0 });
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  const [isCustomerPopoverOpen, setIsCustomerPopoverOpen] = useState(false);
  const [isProductPopoverOpen, setIsProductPopoverOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  const [editingIndex, setEditingIndex] = useState(-1);
  const [tempItem, setTempItem] = useState({});

  const [showTransportDialog, setShowTransportDialog] = useState(false);
  const [validDsStatuses, setValidDsStatuses] = useState([]);
  const [pendingSubmitType, setPendingSubmitType] = useState('normal');

  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };
  const fetchValidDsStatuses = useCallback(async () => {
    if (userProfile?.role !== 'dropship' || !userProfile.id) return;
    try {
        const { data } = await supabase
            .from('dropshipper_settings')
            .select('customer_status')
            .eq('dropshipper_id', userProfile.id)
            .gt('commission_value', 0);

        setValidDsStatuses(data?.map(item => item.customer_status) || []);
    } catch (err) {
        console.error("Gagal fetch skema komisi:", err);
    }
}, [userProfile]);

  const [orderForm, setOrderForm] = useState({
    customer_id: '',
    planned_date: getTodayDate(),
    notes: '',
    courier_ids: [],
    transport_cost: 0,
  });

  useEffect(() => {
    if (companyId) {
        fetchInitialData();
        if (userProfile?.role === 'dropship') {
            fetchValidDsStatuses();
        }
    }
}, [companyId, userProfile, fetchValidDsStatuses]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      let customerQuery = supabase
        .from('customers')
        .select('id, name, customer_status, default_transport_cost, dropshipper_id')
        .eq('company_id', companyId);

      if (userProfile?.role === 'dropship') {
        customerQuery = customerQuery.eq('dropshipper_id', userProfile.id);
      }

      const { data: customersData } = await customerQuery;

      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', companyId)
        .order('sort_order', { ascending: true });

      const { data: couriersData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'user')
        .eq('company_id', companyId);

      setCustomers(customersData || []);
      setProducts(productsData || []);
      setCouriers(couriersData || []);
    } catch (err) {
      toast.error("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerChange = (val) => {
    const selected = customers.find(c => c.id === val);
    setSelectedCustomerId(val);
    setOrderForm({ 
        ...orderForm, 
        customer_id: val,
        transport_cost: selected?.default_transport_cost || 0 
    });
    setIsCustomerPopoverOpen(false);
    setOrderItems([]);
  };

  const handleOrderFormChange = (e) => {
    const { name, value } = e.target;
    setOrderForm({ ...orderForm, [name]: value });
  };

const handleProductSelectChange = async (val) => {
    setIsProductPopoverOpen(false);
    const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

    if (!selectedCustomer) return toast.error("Pilih pelanggan dahulu");

    const { data: priceData, error } = await supabase
      .from('product_prices')
      .select('price')
      .match({
          product_id: val,
          customer_status: selectedCustomer.customer_status,
          company_id: companyId,
      })
      .maybeSingle(); 

    if (error) {
      console.error("Error fetching price:", error);
    }

    setNewItem({
      product_id: val,
      price: priceData?.price || 0,
      qty: '',
    });

    if (!priceData) {
      toast.error(`Harga untuk status ${selectedCustomer.customer_status} tidak ditemukan. Default Rp 0.`);
    }
  };

  const handleFormSubmit = async (type = 'normal', updateDefault = false) => {
    setShowTransportDialog(false);
    setLoading(true);

    try {
      if (updateDefault) {
        await supabase
          .from('customers')
          .update({ default_transport_cost: parseFloat(orderForm.transport_cost) })
          .eq('id', selectedCustomerId);
      }

      const isQuickOrder = type === 'quick';
      
      const payload = {
        orderForm: {
          customer_id: selectedCustomerId,
          planned_date: orderForm.planned_date,
          notes: orderForm.notes || "",
          courier_ids: Array.isArray(orderForm.courier_ids) ? orderForm.courier_ids : [],
          created_by: userProfile.id,
          company_id: companyId,
          is_quick_order: isQuickOrder,
          transport_cost: parseFloat(orderForm.transport_cost) || 0
        },
        orderItems: orderItems.map(item => ({
          product_id: item.product_id,
          qty: Number(item.qty),
          price: Number(item.price),
          item_type: 'beli'
        })),
      };

      const response = await fetch('https://wzmgcainyratlwxttdau.supabase.co/functions/v1/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Gagal membuat pesanan (Server Error)');
      }

      toast.success(isQuickOrder ? 'Pesanan langsung berhasil' : 'Pesanan berhasil dibuat');
      if (onOrderSuccess) {
        onOrderSuccess(result.orderId); 
      } else {
        navigate('/orders');
      }

    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };
  const handleItemAdd = () => {
    const qtyValue = parseFloat(newItem.qty) || 0;
    if (!newItem.product_id || qtyValue <= 0) return toast.error('Lengkapi data item');

    const selectedProduct = products.find((p) => p.id === newItem.product_id);
    setOrderItems([...orderItems, {
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      image_url: selectedProduct.image_url, // Simpan image url di state local
      qty: qtyValue,
      price: newItem.price,
      item_type: 'beli',
    }]);
    setNewItem({ product_id: '', qty: '', price: 0 });
  };

  const handleEditClick = (index) => {
    setEditingIndex(index);
    setTempItem(orderItems[index]);
  };

  const handleSaveEdit = (index) => {
    const finalQty = parseFloat(tempItem.qty);
    if (finalQty <= 0 || isNaN(finalQty)) return toast.error('Jumlah tidak valid');

    const updatedItems = [...orderItems];
    updatedItems[index] = { ...tempItem, qty: finalQty };
    setOrderItems(updatedItems);
    setEditingIndex(-1);
    setTempItem({});
  };

  const handlePreSubmit = (e, type) => {
    if (e && e.preventDefault) e.preventDefault();
    if (editingIndex !== -1) return toast.error('Simpan perubahan item terlebih dahulu');
    if (orderItems.length === 0) return toast.error('Daftar item masih kosong');
    
    const selected = customers.find(c => c.id === selectedCustomerId);
    const currentInputTransport = parseFloat(orderForm.transport_cost) || 0;
    const dbDefaultTransport = selected?.default_transport_cost || 0;

    if (currentInputTransport !== dbDefaultTransport) {
        setPendingSubmitType(type);
        setShowTransportDialog(true);
    } else {
        handleFormSubmit(type, false);
    }
  };

  const calculateTotal = () => {
    const itemsTotal = orderItems.reduce((total, item) => total + (item.qty * item.price), 0);
    return itemsTotal + (parseFloat(orderForm.transport_cost) || 0);
  };

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-2xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Tambah Pesanan</h1>
        <Button onClick={() => navigate('/orders')} variant="ghost" size="sm">Kembali</Button>
      </div>

      <Card className="border-none shadow-xl bg-white overflow-hidden">
        <CardHeader className="bg-[#10182b] text-white pb-6">
          <CardTitle className="text-lg font-medium">Formulir Tambah Pesanan</CardTitle>
        </CardHeader>

        <CardContent className="p-4 md:p-6 space-y-6">
          {loading && customers.length === 0 ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-slate-400" /></div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-slate-600 font-semibold">Pelanggan</Label>
                  <Popover open={isCustomerPopoverOpen} onOpenChange={setIsCustomerPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between font-normal border-slate-200">
                        <span className="truncate">
                          {customers.find(c => c.id === selectedCustomerId)?.name || 'Pilih pelanggan'}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-30 shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Cari pelanggan..." />
                        <CommandList>
                          <CommandEmpty>Pelanggan tidak ditemukan.</CommandEmpty>
                          <CommandGroup>
                            {customers.map((c) => (
                              <CommandItem key={c.id} onSelect={() => handleCustomerChange(c.id)} className="cursor-pointer">
                                {c.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                          <div className="p-2 border-t">
                            <Button variant="ghost" className="w-full justify-start gap-2 h-9 text-blue-600" onClick={() => setIsCustomerModalOpen(true)}>
                              <Plus className="h-4 w-4" /> Tambah pelanggan baru
                            </Button>
                          </div>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-600 font-semibold">Tanggal Pemesanan</Label>
                  <Input type="date" name="planned_date" className="border-slate-200" value={orderForm.planned_date} onChange={handleOrderFormChange} />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-slate-600 font-semibold">Petugas</Label>
                  {couriers.length > 0 && (
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-[11px] text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      onClick={() => {
                        const isAllSelected = orderForm.courier_ids.length === couriers.length;
                        if (isAllSelected) {
                          setOrderForm({ ...orderForm, courier_ids: [] });
                        } else {
                          const allIds = couriers.map(c => c.id);
                          setOrderForm({ ...orderForm, courier_ids: allIds });
                        }
                      }}
                    >
                      {orderForm.courier_ids.length === couriers.length ? 'Batalkan Semua' : 'Tugaskan Semua'}
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  {couriers.map((courier) => (
                    <div key={courier.id} className="flex items-center space-x-3">
                      <Checkbox 
                        id={courier.id} 
                        className="border-slate-300 data-[state=checked]:bg-slate-900"
                        checked={orderForm.courier_ids.includes(courier.id)}
                        onCheckedChange={(checked) => {
                            const newIds = checked 
                                ? [...orderForm.courier_ids, courier.id] 
                                : orderForm.courier_ids.filter(id => id !== courier.id);
                            setOrderForm({...orderForm, courier_ids: newIds});
                        }}
                      />
                      <Label htmlFor={courier.id} className="text-sm font-normal cursor-pointer text-slate-700">{courier.full_name}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                  <Label className="text-slate-600 font-semibold">Catatan (Opsional)</Label>
                  <Input 
                    name="notes" 
                    placeholder="Contoh: Titip di satpam..." 
                    className="border-slate-200 text-sm"
                    value={orderForm.notes} 
                    onChange={handleOrderFormChange} 
                  />
              </div>

              <Separator className="bg-slate-100" />

              {/* Seksi Pilih Produk */}
              <div className="space-y-4">
                <Label className="text-slate-600 font-semibold">Tambah Item</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Popover open={isProductPopoverOpen} onOpenChange={setIsProductPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="flex-1 justify-between font-normal border-slate-200 h-14" disabled={!selectedCustomerId}>
                        <div className="flex items-center gap-3 overflow-hidden">
                          {newItem.product_id ? (
                            <div className="w-10 h-10 rounded border overflow-hidden shrink-0">
                               {products.find(p => p.id === newItem.product_id)?.image_url ? (
                                 <img src={products.find(p => p.id === newItem.product_id).image_url} className="w-full h-full object-cover" />
                               ) : <div className="w-full h-full bg-slate-100 flex items-center justify-center"><ImageIcon className="h-4 w-4 text-slate-300" /></div>}
                            </div>
                          ) : null}
                          <span className="truncate">
                            {products.find(p => p.id === newItem.product_id)?.name || 'Pilih produk'}
                          </span>
                        </div>
                        <ChevronsUpDown className="h-4 w-4 opacity-30 shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[350px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Cari produk..." />
                        <CommandList>
                          {products.map(p => (
                            <CommandItem key={p.id} onSelect={() => handleProductSelectChange(p.id)} className="cursor-pointer py-3">
                              <div className="flex items-center gap-3 w-full">
                                <div className="w-12 h-12 rounded border overflow-hidden shrink-0">
                                  {p.image_url ? (
                                    <img src={p.image_url} className="w-full h-full object-cover" />
                                  ) : <div className="w-full h-full bg-slate-100 flex items-center justify-center"><ImageIcon className="h-6 w-6 text-slate-300" /></div>}
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-medium text-sm">{p.name}</span>
                                  <span className="text-[10px] text-slate-400">SKU: {p.sku || '-'}</span>
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <div className="flex gap-2">
                      <Input 
                        className="w-24 border-slate-200 h-14 text-center font-bold text-lg" 
                        type="number" 
                        placeholder="Qty" 
                        value={newItem.qty} 
                        onChange={(e) => setNewItem({...newItem, qty: e.target.value})} 
                      />
                      <Button onClick={handleItemAdd} disabled={!newItem.product_id || !newItem.qty} size="icon" className="bg-[#10182b] hover:bg-slate-800 shrink-0 text-white h-14 w-14">
                        <Plus className="h-6 w-6" />
                      </Button>
                  </div>
                </div>
                {newItem.product_id && (
                    <p className="text-[11px] text-slate-500 italic px-1">Harga saat ini: {formatCurrency(newItem.price)}</p>
                )}
              </div>

              {/* List Item yang sudah ditambahkan */}
              <div className="space-y-3">
                {orderItems.map((item, idx) => (
                  <div key={idx} className={cn(
                    "flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 border rounded-xl transition-all gap-3",
                    editingIndex === idx ? "border-blue-500 bg-blue-50/30" : "border-slate-100 hover:border-slate-200"
                  )}>
                    {editingIndex === idx ? (
                      <div className="flex items-center gap-2 w-full">
                        <Input 
                          type="number" 
                          className="h-10 w-20 bg-white" 
                          value={tempItem.qty} 
                          onChange={(e) => setTempItem({...tempItem, qty: e.target.value})}
                        />
                        <span className="text-sm text-slate-500">x {formatCurrency(item.price)}</span>
                        <div className="ml-auto flex gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600" onClick={() => handleSaveEdit(idx)}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400" onClick={() => setEditingIndex(-1)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-4 flex-1">
                           {/* GAMBAR PRODUK DI LIST */}
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
                            <span className="font-bold text-base text-[#10182b]">{formatCurrency(item.qty * item.price)}</span>
                            <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500" onClick={() => handleEditClick(idx)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => setOrderItems(orderItems.filter((_, i) => i !== idx))}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex justify-between items-center">
                <div className="space-y-1">
                    <Label className="text-blue-900 font-semibold text-xs  tracking-wider">Ongkos Kirim</Label>
                    <p className="text-[10px] text-blue-600 italic">Sesuai pengaturan pelanggan</p>
                </div>
                <div className="relative w-32">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">Rp</span>
                  <Input 
                    type="number" 
                    name="transport_cost" 
                    className="pl-9 h-9 bg-white border-blue-200 focus-visible:ring-blue-500 font-semibold"
                    value={orderForm.transport_cost} 
                    onChange={handleOrderFormChange} 
                    onWheel={(e) => e.target.blur()}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-dashed border-slate-200 flex justify-between items-end">
                <div className="space-y-1">
                    <p className="text-[11px] text-slate-400">Total belanja: {formatCurrency(orderItems.reduce((a, b) => a + (b.qty * b.price), 0))}</p>
                    <h3 className="text-xs font-semibold text-slate-500  tracking-widest">Total Bayar</h3>
                </div>
                <h3 className="text-2xl font-semibold text-[#10182b]">{formatCurrency(calculateTotal())}</h3>
              </div>

              <div className="grid gap-3">
                <Button 
                  className={cn(
                    "w-full py-7 text-base font-semibold shadow-lg transition-all active:scale-[0.98] text-white", 
                    isQuickOrderMode ? "bg-orange-600 hover:bg-orange-700" : "bg-[#10182b] hover:bg-slate-800"
                  )}
                  onClick={(e) => handlePreSubmit(e, isQuickOrderMode ? 'quick' : 'normal')}
                  disabled={loading || orderItems.length === 0 || !selectedCustomerId}
                >
                  {loading ? <Loader2 className="animate-spin" /> : (isQuickOrderMode ? 'Pesan Langsung' : 'Pesan')}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showTransportDialog} onOpenChange={setShowTransportDialog}>
        <AlertDialogContent className="rounded-2xl w-[90%] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Update Biaya Transport?</AlertDialogTitle>
            <AlertDialogDescription>
              Anda mengubah biaya transport menjadi <strong>{formatCurrency(orderForm.transport_cost)}</strong>. 
              Simpan sebagai biaya default pelanggan ini untuk seterusnya?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => handleFormSubmit(pendingSubmitType, false)} className="rounded-xl border-slate-200">
              Hanya sekali ini
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => handleFormSubmit(pendingSubmitType, true)} className="bg-blue-600 hover:bg-blue-700 rounded-xl">
              Ya, Simpan Permanen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CustomerForm 
        isOpen={isCustomerModalOpen} 
        onOpenChange={setIsCustomerModalOpen} 
        initialDropshipperId={userProfile?.role === 'dropship' ? userProfile.id : null}
        onCustomerAdded={(newC) => {
            setCustomers([...customers, newC]);
            handleCustomerChange(newC.id);
            setIsCustomerModalOpen(false);
            toast.success("Pelanggan berhasil ditambahkan");
        }} 
      />
    </div>
  );
};

export default AddOrderForm;