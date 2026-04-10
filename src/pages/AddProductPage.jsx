import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'react-hot-toast';
import { Loader2, ArrowLeft, Tags, Plus, Package, ImageIcon, X, Hash } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import CategoryModal from '@/components/CategoryModal';
import SupplierModal from '@/components/SupplierModal';
import { Separator } from '@/components/ui/separator';

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB
const TARGET_SIZE_MB = 0.5; // Target 500 KB

const AddProductPage = () => {
  const { userProfile, loading: authLoading, companyId } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  const [loading, setLoading] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);

  const [customerStatuses, setCustomerStatuses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  
  // Opsi Penetapan Harga
  const [pricingMode, setPricingMode] = useState('manual');
  const [basePrice, setBasePrice] = useState('');
  const [globalPercentage, setGlobalPercentage] = useState('100');

  // New State: Image & SKU
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const [productForm, setProductForm] = useState({
    name: '',
    sku: '', // New Field SKU
    stock: 0,
    purchase_price: '',
    is_returnable: false,
    empty_bottle_price: '',
    category_id: '',
    subcategory_id: '',
    supplier_id: '',
  });

  const [productPrices, setProductPrices] = useState([]);

  // --- START: HELPER KOMPRESI GAMBAR ---
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
                    const base64Data = parts[1];
                    const binaryString = atob(base64Data);
                    const uint8Array = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        uint8Array[i] = binaryString.charCodeAt(i);
                    }
                    blob = new Blob([uint8Array], { type: 'image/jpeg' });
                    if (blob.size / 1024 / 1024 <= targetMB || quality < 0.1) break;
                    quality -= 0.1;
                } while (quality > 0.05);
                const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + '.jpeg', {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                });
                resolve(compressedFile);
            };
        };
        reader.onerror = (error) => reject(error);
    });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        return toast.error('Hanya diperbolehkan file gambar.');
    }

    let fileToProcess = file;
    if (file.size > MAX_FILE_SIZE) {
        toast.loading('Kompresi gambar...', { id: 'compress-img' });
        try {
            fileToProcess = await compressImage(file, TARGET_SIZE_MB);
            toast.success('Gambar berhasil dikompresi.', { id: 'compress-img' });
        } catch (err) {
            toast.error('Gagal kompresi, menggunakan file asli.', { id: 'compress-img' });
        }
    }

    setImageFile(fileToProcess);
    const objectUrl = URL.createObjectURL(fileToProcess);
    setPreviewUrl(objectUrl);
  };

  const removeImage = () => {
    setImageFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  // --- END: HELPER KOMPRESI GAMBAR ---

  useEffect(() => {
    if (!authLoading && companyId) {
      fetchData();
    }
  }, [authLoading, companyId]);

  const fetchData = async () => {
    setLoading(true);
    const [
      { data: statusData, error: statusError },
      { data: categoriesData, error: categoriesError },
      { data: suppliersData, error: suppliersError },
    ] = await Promise.all([
      supabase.from('customer_statuses').select('status_name, default_percentage').eq('company_id', companyId).order('sort_order', { ascending: true }),
      supabase.from('categories').select('*, subcategories(*)').eq('company_id', companyId),
      supabase.from('suppliers').select('*').eq('company_id', companyId),
    ]);

    if (statusError || categoriesError || suppliersError) {
      console.error('Error fetching data:', statusError || categoriesError || suppliersError);
      toast.error('Gagal memuat data awal.');
    } else {
      setCustomerStatuses(statusData);
      setCategories(categoriesData);
      setSuppliers(suppliersData);
      
      const initialPrices = statusData.map(status => {
          const defaultPercentage = status.default_percentage !== null ? status.default_percentage.toString() : '100';
          return {
              customer_status: status.status_name,
              name: status.status_name,
              price: '',
              percentage: defaultPercentage,
          };
      });
      setProductPrices(initialPrices);
    }
    setLoading(false);
  };
  
  const handleInputWheel = (e) => {
    e.target.blur();
  };

  const handleProductFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setProductForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };
  
  const handleBasePriceChange = (value) => {
      setBasePrice(value);
  };

  const handlePricingModeChange = (mode) => {
      setPricingMode(mode);
      if (mode === 'manual') {
          setBasePrice('');
      } else if (mode === 'percentage') {
          setBasePrice('');
          setGlobalPercentage('100');
      } else if (mode === 'relative_status') {
          setBasePrice(''); 
          setProductPrices(prev => prev.map(p => {
              const status = customerStatuses.find(s => s.status_name === p.customer_status);
              const defaultPercentage = status?.default_percentage !== null ? status.default_percentage.toString() : '100';
              return { ...p, percentage: defaultPercentage };
          }));
      }
  };

  const handlePriceChange = (statusName, value) => {
    setProductPrices(prev => prev.map(p => {
      if (p.customer_status === statusName) {
        if (pricingMode === 'relative_status') return { ...p, percentage: value };
        if (pricingMode === 'manual') return { ...p, price: value };
      }
      return p;
    }));
  };

  const handleCategoryChange = (value) => {
    const selectedCategory = categories.find(cat => cat.id === value);
    setProductForm(prev => ({
        ...prev,
        category_id: value,
        subcategory_id: '',
    }));
    setSubCategories(selectedCategory ? selectedCategory.subcategories : []);
  };
  
  const handleSubCategoryChange = (value) => {
      setProductForm(prev => ({ ...prev, subcategory_id: value }));
  };

  const handleSupplierChange = (value) => {
      setProductForm(prev => ({ ...prev, supplier_id: value }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Upload Image if exists
      let imageUrl = null;
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${companyId}/products/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(filePath, imageFile);

        if (uploadError) throw uploadError;

        const { data: pubUrl } = supabase.storage
            .from('product-images')
            .getPublicUrl(filePath);
        
        imageUrl = pubUrl.publicUrl;
      }

      // 2. Insert Product
      const { data: maxSortOrderData } = await supabase
        .from('products')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .single();
      const maxSortOrder = maxSortOrderData?.sort_order || 0;

      const { data, error } = await supabase
        .from('products')
        .insert({ 
          ...productForm,
          sku: productForm.sku || null, // SKU Field
          image_url: imageUrl, // Image URL Field
          stock: parseInt(productForm.stock),
          purchase_price: parseFloat(productForm.purchase_price) || 0,
          empty_bottle_price: productForm.is_returnable ? parseFloat(productForm.empty_bottle_price) || 0 : null,
          category_id: productForm.category_id || null,
          subcategory_id: productForm.subcategory_id || null,
          supplier_id: productForm.supplier_id || null,
          company_id: companyId,
          sort_order: maxSortOrder + 1,
        })
        .select('id')
        .single();
      if (error) throw error;
      
      const productId = data.id;
      
      // 3. Price Calculation Logic
      const finalPriceUpdates = productPrices.map(p => {
        let finalPrice = 0;
        if (pricingMode === 'relative_status') {
          finalPrice = (parseFloat(basePrice) || 0) * ((parseFloat(p.percentage) || 0) / 100);
        } else if (pricingMode === 'percentage') {
          finalPrice = (parseFloat(basePrice) || 0) * ((parseFloat(globalPercentage) || 0) / 100);
        } else {
          finalPrice = parseFloat(p.price) || 0;
        }

        return {
          product_id: productId,
          customer_status: p.customer_status,
          price: parseFloat(finalPrice.toFixed(2)) || 0, 
          company_id: companyId,
        };
      });
      
      const { error: priceError } = await supabase
        .from('product_prices')
        .insert(finalPriceUpdates);
        
      if (priceError) throw priceError;
      
      toast.success('Produk berhasil ditambahkan.');
      navigate('/settings');
    } catch (error) {
      console.error('Error in form submission:', error);
      toast.error('Gagal menambahkan produk: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const allPricesValid = useMemo(() => {
    if (pricingMode === 'manual') {
      return productPrices.every(p => p.price !== '' && parseFloat(p.price) >= 0);
    }
    if (pricingMode === 'percentage') {
        return basePrice !== '' && parseFloat(basePrice) >= 0 && globalPercentage !== '' && parseFloat(globalPercentage) >= 0;
    }
    if (pricingMode === 'relative_status') {
        return basePrice !== '' && parseFloat(basePrice) >= 0 && productPrices.every(p => p.percentage !== '' && parseFloat(p.percentage) >= 0);
    }
    return false;
  }, [productPrices, pricingMode, basePrice, globalPercentage]);

  const isFormValid = productForm.name && productForm.stock !== '' && productForm.purchase_price !== '' && allPricesValid;
  const formatCurrency = (amount) => 
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount ?? 0);
  
  if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-gray-500" /></div>;

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-2xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Package className="h-6 w-6" /> Tambah Produk Baru
        </h1>
        <Button onClick={() => navigate('/settings')} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" /> Kembali
        </Button>
      </div>

      <Card className="border-0 shadow-lg bg-white">
        <CardHeader className="bg-[#10182b] text-white rounded-t-lg">
          <CardTitle>Formulir Produk</CardTitle>
          <CardDescription className="text-gray-200">
            Isi detail produk, SKU, dan foto untuk katalog sistem.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 p-2 md:p-4">
          <form onSubmit={handleFormSubmit} className="space-y-4">
            
            {/* --- SECTION: FOTO PRODUK --- */}
            <div className="space-y-2">
                <Label>Foto Produk</Label>
                <div className="flex flex-col sm:flex-row items-center gap-4 p-4 border-2 border-dashed rounded-xl bg-slate-50/50">
                    <div className="relative w-32 h-32 bg-white rounded-lg border shadow-sm flex items-center justify-center overflow-hidden">
                        {previewUrl ? (
                            <>
                                <img src={previewUrl} className="w-full h-full object-cover" alt="Preview" />
                                <button type="button" onClick={removeImage} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors">
                                    <X className="h-3 w-3" />
                                </button>
                            </>
                        ) : (
                            <ImageIcon className="h-10 w-10 text-slate-300" />
                        )}
                    </div>
                    <div className="flex-1 space-y-2 w-full">
                        <Input 
                            type="file" 
                            accept="image/*" 
                            onChange={handleFileChange} 
                            ref={fileInputRef}
                            className="bg-white"
                        />
                        <p className="text-[10px] text-slate-500 italic">Maks. 1MB. Gambar besar akan dikompresi otomatis.</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Nama Produk</Label>
                    <Input id="name" name="name" value={productForm.name} onChange={handleProductFormChange} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="sku" className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" /> SKU (Stock Keeping Unit)</Label>
                    <Input id="sku" name="sku" value={productForm.sku} onChange={(e) => setProductForm(p => ({...p, sku: e.target.value.toUpperCase()}))} placeholder="MISAL: BRG-001" />
                </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="space-y-2 w-full">
                    <Label htmlFor="category_id">Kategori</Label>
                    <div className="flex gap-2">
                        <Select value={productForm.category_id} onValueChange={handleCategoryChange}>
                            <SelectTrigger className="bg-white"><SelectValue placeholder="Pilih Kategori" /></SelectTrigger>
                            <SelectContent>
                                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button variant="outline" size="icon" type="button" onClick={() => setIsCategoryModalOpen(true)}><Plus className="h-4 w-4" /></Button>
                    </div>
                </div>
                <div className="space-y-2 w-full">
                    <Label htmlFor="subcategory_id">Sub Kategori</Label>
                    <Select value={productForm.subcategory_id} onValueChange={handleSubCategoryChange} disabled={!productForm.category_id || subCategories.length === 0}>
                        <SelectTrigger className="bg-white"><SelectValue placeholder="Pilih Sub Kategori" /></SelectTrigger>
                        <SelectContent>
                            {subCategories.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="supplier_id">Supplier (Opsional)</Label>
                <div className="flex gap-2">
                    <Select value={productForm.supplier_id} onValueChange={handleSupplierChange}>
                        <SelectTrigger className="bg-white"><SelectValue placeholder="Pilih Supplier" /></SelectTrigger>
                        <SelectContent>
                            {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" type="button" onClick={() => setIsSupplierModalOpen(true)}><Plus className="h-4 w-4" /></Button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="stock">Stok Awal</Label>
                    <Input id="stock" name="stock" type="number" value={productForm.stock} onChange={handleProductFormChange} onWheel={handleInputWheel} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="purchase_price">Harga Beli dari Pusat</Label>
                    <Input id="purchase_price" name="purchase_price" type="number" value={productForm.purchase_price} onChange={handleProductFormChange} onWheel={handleInputWheel} required />
                </div>
            </div>

            <div className="flex items-center space-x-2 p-1">
                <Checkbox id="is_returnable" checked={productForm.is_returnable} onCheckedChange={(checked) => setProductForm(prev => ({ ...prev, is_returnable: checked }))} />
                <Label htmlFor="is_returnable" className="text-sm font-normal">Produk ini dapat dikembalikan (galon/gas)</Label>
            </div>

            {productForm.is_returnable && (
                <div className="space-y-2">
                    <Label htmlFor="empty_bottle_price">Harga Jual Kemasan Kosong</Label>
                    <Input id="empty_bottle_price" name="empty_bottle_price" type="number" value={productForm.empty_bottle_price} onChange={handleProductFormChange} onWheel={handleInputWheel} required />
                </div>
            )}
            
            <Separator className="my-6" />

            {/* OPSI PENETAPAN HARGA */}
            <div className="space-y-2">
                <Label className="font-medium">Opsi Penetapan Harga Jual</Label>
                <Select value={pricingMode} onValueChange={handlePricingModeChange}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Pilih Mode Harga" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="manual">Harga Manual</SelectItem>
                        <SelectItem value="percentage">Harga Relatif (Global %)</SelectItem>
                        <SelectItem value="relative_status">Harga Relatif (Per Status %)</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            
            {(pricingMode === 'percentage' || pricingMode === 'relative_status') && (
                <div className="space-y-2">
                    <Label htmlFor="base_price">Harga Bandrol / Dasar</Label>
                    <Input id="base_price" type="number" value={basePrice} onChange={(e) => handleBasePriceChange(e.target.value)} onWheel={handleInputWheel} required />
                </div>
            )}
            
            {pricingMode === 'percentage' && (
                <div className="space-y-2">
                    <Label className="font-medium">Persentase Harga Jual Global</Label>
                    <div className='flex items-center'>
                        <Input type="number" value={globalPercentage} onChange={(e) => setGlobalPercentage(e.target.value)} onWheel={handleInputWheel} required className="w-full pr-8" />
                        <span className="ml-[-25px] text-gray-500 font-semibold">%</span>
                    </div>
                    {basePrice && (
                        <div className="text-[10px] text-slate-600 mt-2 p-2 border border-blue-100 bg-blue-50/50 rounded-md">
                            <p className='font-bold mb-1 underline'>Estimasi Harga (Dasar: {formatCurrency(parseFloat(basePrice))}):</p>
                            {productPrices.map(p => (
                                <p key={`calc-${p.customer_status}`}>- {p.name}: {formatCurrency((parseFloat(basePrice) || 0) * (parseFloat(globalPercentage) / 100))}</p>
                            ))}
                        </div>
                    )}
                </div>
            )}
            
            {pricingMode === 'relative_status' && (
                <div className="space-y-2">
                    <Label className="font-medium text-xs uppercase text-slate-500">Persentase Per Status</Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto p-1">
                        {productPrices.map(p => (
                            <div key={p.customer_status} className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border">
                                <Label className="text-xs flex-1 truncate font-bold">{p.name}</Label>
                                <div className='flex items-center w-24 shrink-0'>
                                    <Input type="number" value={p.percentage} onChange={(e) => handlePriceChange(p.customer_status, e.target.value)} onWheel={handleInputWheel} required className="h-8 pr-6 text-right" />
                                    <span className="ml-[-18px] text-[10px] text-gray-400 font-bold">%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    {basePrice && (
                        <div className="text-[10px] text-slate-600 mt-2 p-2 border border-blue-100 bg-blue-50/50 rounded-md">
                            <p className='font-bold mb-1 underline'>Estimasi Harga:</p>
                            {productPrices.map(p => (
                                <p key={`calc-${p.customer_status}`}>- {p.name}: {formatCurrency((parseFloat(basePrice) || 0) * (parseFloat(p.percentage) / 100))}</p>
                            ))}
                        </div>
                    )}
                </div>
            )}
            
            {pricingMode === 'manual' && (
                <div className="space-y-2">
                    <Label className="font-medium text-xs uppercase text-slate-500">Harga Jual Manual</Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto p-1">
                        {productPrices.map(p => (
                            <div key={p.customer_status} className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border">
                                <Label className="text-xs flex-1 truncate font-bold">{p.name}</Label>
                                <Input type="number" value={p.price} onChange={(e) => handlePriceChange(p.customer_status, e.target.value)} onWheel={handleInputWheel} required className="h-8 w-32 text-right" />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <Button type="submit" className="w-full bg-[#10182b] text-white font-bold h-11" disabled={loading || !isFormValid}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />} 
                Tambah Produk
            </Button>
          </form>
        </CardContent>
      </Card>
      
      <CategoryModal open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen} onCategoriesUpdated={() => fetchData()} />
      <SupplierModal open={isSupplierModalOpen} onOpenChange={setIsSupplierModalOpen} onSuppliersUpdated={() => fetchData()} />
    </div>
  );
};

export default AddProductPage;