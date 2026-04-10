import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
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
import { Loader2, ArrowLeft, Plus, Tags, Pencil, ImageIcon, X, Hash } from 'lucide-react';
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

// Helper untuk format mata uang
const formatCurrency = (amount) => 
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount ?? 0);

const EditProductPage = () => {
    const { id } = useParams();
    const { userProfile, loading: authLoading, companyId } = useAuth();
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
    
    const [customerStatuses, setCustomerStatuses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [subCategories, setSubCategories] = useState([]);
    const [suppliers, setSuppliers] = useState([]);

    // STATES FOR PRICING MODE
    const [pricingMode, setPricingMode] = useState('manual');
    const [basePrice, setBasePrice] = useState('');
    const [globalPercentage, setGlobalPercentage] = useState('100');

    // NEW STATES: IMAGE & SKU
    const [imageFile, setImageFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [existingImageUrl, setExistingImageUrl] = useState(null);

    const [productForm, setProductForm] = useState({
        name: '',
        sku: '',
        stock: '',
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
        if (!file.type.startsWith('image/')) return toast.error('Hanya file gambar.');

        let fileToProcess = file;
        if (file.size > MAX_FILE_SIZE) {
            toast.loading('Kompresi gambar...', { id: 'edit-compress' });
            try {
                fileToProcess = await compressImage(file, TARGET_SIZE_MB);
                toast.success('Dikompresi.', { id: 'edit-compress' });
            } catch (err) {
                toast.error('Gagal kompresi.', { id: 'edit-compress' });
            }
        }
        setImageFile(fileToProcess);
        setPreviewUrl(URL.createObjectURL(fileToProcess));
    };

    const removeImage = () => {
        setImageFile(null);
        setPreviewUrl(null);
        setExistingImageUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };
    // --- END: HELPER GAMBAR ---

    useEffect(() => {
        if (!authLoading && companyId && id) {
            fetchData();
        }
    }, [authLoading, companyId, id]);

    const fetchData = async () => {
        setLoading(true);
        const [
            { data: productData, error: productError },
            { data: statusData, error: statusError }, 
            { data: categoriesData, error: categoriesError },
            { data: suppliersData, error: suppliersError },
        ] = await Promise.all([
            supabase.from('products').select('*, product_prices(customer_status, price)').eq('id', id).single(),
            supabase.from('customer_statuses').select('status_name, default_percentage').eq('company_id', companyId).order('sort_order', { ascending: true }),
            supabase.from('categories').select('*, subcategories(*)').eq('company_id', companyId),
            supabase.from('suppliers').select('*').eq('company_id', companyId),
        ]);

        if (productError || statusError || categoriesError || suppliersError) {
            console.error('Error fetching data:', productError || statusError || categoriesError || suppliersError);
            toast.error('Gagal memuat data produk.');
            setLoading(false);
            return;
        }

        setCategories(categoriesData);
        setSuppliers(suppliersData);
        setCustomerStatuses(statusData);

        const existingPrices = productData.product_prices || [];
        const firstPrice = parseFloat(existingPrices[0]?.price) || 0;
        let inferredMode = 'manual';
        let inferredBasePrice = '';
        
        const allPricesSame = existingPrices.length > 0 && existingPrices.every(p => Math.abs(parseFloat(p.price) - firstPrice) < 0.001);
        if (allPricesSame && firstPrice > 0) {
            inferredMode = 'percentage';
            inferredBasePrice = firstPrice.toString();
        } 

        setExistingImageUrl(productData.image_url);
        setPreviewUrl(productData.image_url);

        setProductForm({
            name: productData.name,
            sku: productData.sku || '',
            stock: productData.stock?.toString() ?? '0',
            purchase_price: productData.purchase_price?.toString() ?? '',
            is_returnable: productData.is_returnable,
            empty_bottle_price: productData.empty_bottle_price?.toString() ?? '',
            category_id: productData.category_id || '',
            subcategory_id: productData.subcategory_id || '',
            supplier_id: productData.supplier_id || '',
        });
        
        const pricesForProduct = statusData.map(status => {
            const existingPrice = existingPrices.find(p => p.customer_status === status.status_name);
            const priceValue = existingPrice ? existingPrice.price.toString() : '';
            const defaultPercentage = status.default_percentage !== null ? status.default_percentage.toString() : '100';
            
            return {
                product_id: id,
                customer_status: status.status_name,
                name: status.status_name,
                price: priceValue,
                percentage: defaultPercentage,
            };
        });
        
        setPricingMode(inferredMode);
        setBasePrice(inferredBasePrice);
        setProductPrices(pricesForProduct);

        const selectedCategory = categoriesData.find(cat => cat.id === productData.category_id);
        setSubCategories(selectedCategory ? selectedCategory.subcategories : []);
        setLoading(false);
    };
    
    const handleInputWheel = (e) => e.target.blur();

    const handleProductFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        setProductForm(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };
    
    const handleBasePriceChange = (value) => setBasePrice(value);
  
    const handlePricingModeChange = (mode) => {
        setPricingMode(mode);
        if (mode === 'manual') setBasePrice('');
        else if (mode === 'percentage') {
            setBasePrice('');
            setGlobalPercentage('100'); 
        } else if (mode === 'relative_status') {
            setBasePrice(''); 
            setProductPrices(prev => prev.map(p => {
                const status = customerStatuses.find(s => s.status_name === p.customer_status);
                return { ...p, percentage: status?.default_percentage?.toString() || '100' };
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
        setProductForm(prev => ({ ...prev, category_id: value, subcategory_id: '' }));
        setSubCategories(selectedCategory ? selectedCategory.subcategories : []);
    };
    
    const handleSubCategoryChange = (value) => setProductForm(prev => ({ ...prev, subcategory_id: value }));
    const handleSupplierChange = (value) => setProductForm(prev => ({ ...prev, supplier_id: value }));

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        
        try {
            // 1. Image Upload Logic
            let imageUrl = existingImageUrl;
            if (imageFile) {
                const fileExt = imageFile.name.split('.').pop();
                const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
                const filePath = `${companyId}/products/${fileName}`;
                const { error: uploadError } = await supabase.storage.from('product-images').upload(filePath, imageFile);
                if (uploadError) throw uploadError;
                const { data: pubUrl } = supabase.storage.from('product-images').getPublicUrl(filePath);
                imageUrl = pubUrl.publicUrl;
            }

            // 2. Pricing Logic
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
                    product_id: id,
                    customer_status: p.customer_status,
                    price: parseFloat(finalPrice.toFixed(2)) || 0, 
                    company_id: companyId,
                };
            });
            
            // 3. Update Product
            const { error: productUpdateError } = await supabase
                .from('products')
                .update({
                    ...productForm,
                    sku: productForm.sku || null,
                    image_url: imageUrl,
                    stock: parseInt(productForm.stock),
                    purchase_price: parseFloat(productForm.purchase_price) || 0,
                    empty_bottle_price: productForm.is_returnable ? parseFloat(productForm.empty_bottle_price) || 0 : null,
                    category_id: productForm.category_id || null,
                    subcategory_id: productForm.subcategory_id || null,
                    supplier_id: productForm.supplier_id || null,
                })
                .eq('id', id);

            if (productUpdateError) throw productUpdateError;
            
            // 4. Update Prices
            const { error: priceError } = await supabase
                .from('product_prices')
                .upsert(finalPriceUpdates, { onConflict: ['product_id', 'customer_status'] });
            
            if (priceError) throw priceError;
            
            toast.success('Produk diperbarui.');
            navigate('/settings');
        } catch (error) {
            console.error(error);
            toast.error('Gagal: ' + error.message);
        } finally {
            setLoading(false);
        }
    };
    
    const allPricesValid = useMemo(() => {
        if (pricingMode === 'manual') return productPrices.every(p => p.price !== '' && parseFloat(p.price) >= 0);
        if (pricingMode === 'percentage') return basePrice !== '' && parseFloat(basePrice) >= 0;
        if (pricingMode === 'relative_status') return basePrice !== '' && parseFloat(basePrice) >= 0 && productPrices.every(p => p.percentage !== '');
        return false;
    }, [productPrices, pricingMode, basePrice, globalPercentage]);

    const isFormValid = productForm.name && productForm.stock !== '' && productForm.purchase_price !== '' && allPricesValid;

    if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-gray-500" /></div>;

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-2xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Pencil className="h-6 w-6" /> Edit Produk
                </h1>
                <Button onClick={() => navigate('/settings')} variant="outline">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Kembali
                </Button>
            </div>

            <Card className="border-0 shadow-lg bg-white">
                <CardHeader className="bg-[#10182b] text-white rounded-t-lg">
                    <CardTitle>Formulir Edit Produk</CardTitle>
                    <CardDescription className="text-gray-200">Perbarui detail produk, SKU, dan foto.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 p-4">
                    <form onSubmit={handleFormSubmit} className="space-y-6">
                        
                        {/* SECTION: FOTO PRODUK */}
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
                                    <Input type="file" accept="image/*" onChange={handleFileChange} ref={fileInputRef} className="bg-white" />
                                    <p className="text-[10px] text-slate-500 italic">Gunakan foto baru untuk mengganti foto lama.</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nama Produk</Label>
                                <Input id="name" name="name" value={productForm.name} onChange={handleProductFormChange} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sku" className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" /> SKU</Label>
                                <Input id="sku" value={productForm.sku} onChange={(e) => setProductForm(p => ({...p, sku: e.target.value.toUpperCase()}))} placeholder="MISAL: BRG-001" />
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
                                    <Button type="button" variant="outline" size="icon" onClick={() => setIsCategoryModalOpen(true)}><Plus className="h-4 w-4" /></Button>
                                </div>
                            </div>
                            <div className="space-y-2 w-full">
                                <Label htmlFor="subcategory_id">Sub Kategori</Label>
                                <Select value={productForm.subcategory_id} onValueChange={handleSubCategoryChange} disabled={!productForm.category_id || subCategories.length === 0}>
                                    <SelectTrigger className="bg-white"><SelectValue placeholder="Pilih Sub" /></SelectTrigger>
                                    <SelectContent>
                                        {subCategories.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="supplier_id">Supplier</Label>
                            <div className="flex gap-2">
                                <Select value={productForm.supplier_id} onValueChange={handleSupplierChange}>
                                    <SelectTrigger className="bg-white"><SelectValue placeholder="Pilih Supplier" /></SelectTrigger>
                                    <SelectContent>
                                        {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Button type="button" variant="outline" size="icon" onClick={() => setIsSupplierModalOpen(true)}><Plus className="h-4 w-4" /></Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="stock">Stok</Label>
                                <Input id="stock" name="stock" type="number" value={productForm.stock} onChange={handleProductFormChange} onWheel={handleInputWheel} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="purchase_price">Harga Beli</Label>
                                <Input id="purchase_price" name="purchase_price" type="number" value={productForm.purchase_price} onChange={handleProductFormChange} onWheel={handleInputWheel} required />
                            </div>
                        </div>

                        <div className="flex items-center space-x-2 p-1">
                            <Checkbox id="is_returnable" checked={productForm.is_returnable} onCheckedChange={(checked) => setProductForm(prev => ({ ...prev, is_returnable: checked }))} />
                            <Label htmlFor="is_returnable" className="text-sm font-normal">Dapat dikembalikan (galon/gas)</Label>
                        </div>

                        {productForm.is_returnable && (
                            <div className="space-y-2">
                                <Label htmlFor="empty_bottle_price">Harga Kemasan Kosong</Label>
                                <Input id="empty_bottle_price" name="empty_bottle_price" type="number" value={productForm.empty_bottle_price} onChange={handleProductFormChange} onWheel={handleInputWheel} required />
                            </div>
                        )}
                        
                        <Separator className="my-2" />

                        {/* HARGA JUAL SECTION */}
                        <div className="space-y-4">
                            <Label className="font-bold text-[#10182b]">Penetapan Harga Jual</Label>
                            <Select value={pricingMode} onValueChange={handlePricingModeChange}>
                                <SelectTrigger className="bg-white"><SelectValue placeholder="Pilih Mode Harga" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="manual">Manual (Absolut)</SelectItem>
                                    <SelectItem value="percentage">Relatif (Global %)</SelectItem>
                                    <SelectItem value="relative_status">Relatif (Per Status %)</SelectItem>
                                </SelectContent>
                            </Select>
                            
                            {(pricingMode === 'percentage' || pricingMode === 'relative_status') && (
                                <div className="space-y-2">
                                    <Label htmlFor="base_price">Harga Bandrol / Dasar</Label>
                                    <Input id="base_price" type="number" value={basePrice} onChange={(e) => handleBasePriceChange(e.target.value)} onWheel={handleInputWheel} required />
                                </div>
                            )}
                            
                            {pricingMode === 'percentage' && (
                                <div className="space-y-2">
                                    <Label>Persentase Global (%)</Label>
                                    <Input type="number" value={globalPercentage} onChange={(e) => setGlobalPercentage(e.target.value)} onWheel={handleInputWheel} required />
                                </div>
                            )}
                            
                            {pricingMode === 'relative_status' && (
                                <div className="space-y-2 max-h-48 overflow-y-auto p-1 border rounded-lg">
                                    {productPrices.map(p => (
                                        <div key={p.customer_status} className="flex items-center gap-3 bg-slate-50 p-2 mb-2 rounded border">
                                            <Label className="text-xs flex-1 truncate font-bold">{p.name}</Label>
                                            <Input type="number" value={p.percentage} onChange={(e) => handlePriceChange(p.customer_status, e.target.value)} onWheel={handleInputWheel} required className="h-8 w-24 text-right" />
                                        </div>
                                    ))}
                                </div>
                            )}
                            
                            {pricingMode === 'manual' && (
                                <div className="space-y-2 max-h-48 overflow-y-auto p-1 border rounded-lg">
                                    {productPrices.map(p => (
                                        <div key={p.customer_status} className="flex items-center gap-3 bg-slate-50 p-2 mb-2 rounded border">
                                            <Label className="text-xs flex-1 truncate font-bold">{p.name}</Label>
                                            <Input type="number" value={p.price} onChange={(e) => handlePriceChange(p.customer_status, e.target.value)} onWheel={handleInputWheel} required className="h-8 w-32 text-right" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <Button type="submit" className="w-full bg-[#10182b] text-white font-bold h-11" disabled={loading || !isFormValid}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Pencil className="h-4 w-4 mr-2" />} 
                            Simpan Perubahan
                        </Button>
                    </form>
                </CardContent>
            </Card>
            
            <CategoryModal open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen} onCategoriesUpdated={() => fetchData()} />
            <SupplierModal open={isSupplierModalOpen} onOpenChange={setIsSupplierModalOpen} onSuppliersUpdated={() => fetchData()} />
        </div>
    );
};

export default EditProductPage;