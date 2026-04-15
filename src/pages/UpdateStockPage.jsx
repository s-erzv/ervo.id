import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { format, subDays, addDays } from 'date-fns';
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
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import { Loader2, Box, Save, History, Package, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// --- HELPER DATES ---
const getStartOf30Days = () => format(subDays(new Date(), 29), 'yyyy-MM-dd');
const getTodayDate = () => format(new Date(), 'yyyy-MM-dd');
// --- END HELPER DATES ---

// =================================================================
//                 HELPER FORMATTING (GLOBAL)
// =================================================================

const formatCurrency = (amount) => 
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount ?? 0);

const formatDecimal = (amount) => 
    new Intl.NumberFormat('id-ID', { style: 'decimal', minimumFractionDigits: 0 }).format(amount ?? 0);

// =================================================================
//                 COMPONENT MODAL DETAIL PERGERAKAN HARIAN
// =================================================================

const DailyStockMovementModal = ({ isOpen, onClose, record, productMap }) => {
    const { companyId } = useAuth();
    const [movements, setMovements] = useState([]);
    const [loading, setLoading] = useState(true);

    const ignoredTypes = ['pengembalian'];

    const fetchMovementDetails = useCallback(async () => {
        if (!record || !companyId) return;
        setLoading(true);

        try {
            const { data, error } = await supabase
                .from('stock_movements')
                .select('product_id, type, qty, notes, movement_date, user:user_id(full_name)')
                .eq('company_id', companyId)
                .gte('movement_date', record.date)
                .lt('movement_date', format(addDays(new Date(record.date), 1), 'yyyy-MM-dd'))
                .order('movement_date', { ascending: true });

            if (error) throw error;
            
            const productIdsInRecord = record.products.map(p => p.id);
            
            const filteredMovements = data
                .filter(m => productIdsInRecord.includes(m.product_id))
                .filter(m => !ignoredTypes.includes(m.type)); 

            setMovements(filteredMovements);

        } catch (e) {
            console.error('Error fetching movement details:', e);
            toast.error('Gagal memuat detail pergerakan stok.');
            setMovements([]);
        } finally {
            setLoading(false);
        }
    }, [record, companyId]);

    useEffect(() => {
        if (isOpen && record) {
            fetchMovementDetails();
        }
    }, [isOpen, record, fetchMovementDetails]);

    const getMovementDirection = (type) => {
        const increaseTypes = [
            'masuk_rekonsiliasi', 
            'masuk_dari_pusat', 
            'masuk_edit_pesanan', 
            'manual_adjustment_in'
        ];
        return increaseTypes.includes(type) ? 'IN' : 'OUT';
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl p-6 w-[95vw] md:w-full">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-[#011e4b]">
                        Detail Pergerakan Stok Tanggal {new Date(record?.date).toLocaleDateString('id-ID')}
                    </DialogTitle>
                </DialogHeader>

                <div className="max-h-[70vh] overflow-y-auto">
                    {loading ? (
                        <div className="flex justify-center items-center py-10">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                        </div>
                    ) : movements.length > 0 ? (
                        <div className="overflow-x-auto rounded-md border">
                            <Table className="table-auto min-w-full text-sm">
                                <TableHeader>
                                    <TableRow className="bg-gray-50">
                                        <TableHead className="min-w-[150px]">Waktu</TableHead>
                                        <TableHead className="min-w-[150px]">Produk</TableHead>
                                        <TableHead className="min-w-[100px] text-center">Tipe</TableHead>
                                        <TableHead className="min-w-[80px] text-right">Kuantitas</TableHead>
                                        <TableHead className="min-w-[150px]">Keterangan</TableHead>
                                        <TableHead className="min-w-[100px]">Pelaku</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {movements.map((m, index) => (
                                        <TableRow key={index}>
                                            <TableCell className="text-xs">
                                                {format(new Date(m.movement_date), 'dd MMM yyyy HH:mm')}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {productMap[m.product_id]?.name || 'Produk Tidak Dikenal'}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getMovementDirection(m.type) === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {m.type}
                                                </span>
                                            </TableCell>
                                            <TableCell className={`text-right font-bold ${getMovementDirection(m.type) === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                                                {getMovementDirection(m.type) === 'OUT' ? '-' : ''}{formatDecimal(m.qty)}
                                            </TableCell>
                                            <TableCell className="text-xs max-w-[200px] whitespace-normal">
                                                {m.notes || '-'}
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {m.user?.full_name || 'Sistem'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <p className="text-center py-10 text-muted-foreground">
                            Tidak ada pergerakan stok produk (selain pengembalian) ditemukan pada tanggal ini.
                        </p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};


// =================================================================
//                           COMPONENT UTAMA
// =================================================================

const UpdateStockPage = () => {
    const { companyId, userProfile, session } = useAuth();
    const navigate = useNavigate();
    const [products, setProducts] = useState([]);
    const [reconciliations, setReconciliations] = useState([]);
    const [categories, setCategories] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [subcategories, setSubcategories] = useState([]);

    // --- STATE MODAL BARU ---
    const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
    const [selectedDailyRecord, setSelectedDailyRecord] = useState(null);
    // --- END STATE MODAL ---

    // --- STATE FILTER STOK FISIK ---
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedSubcategoryInput, setSelectedSubcategoryInput] = useState('all');

    // --- STATE REKAMAN HARIAN ---
    const [dailyRecordStartDate, setDailyRecordStartDate] = useState(getStartOf30Days());
    const [dailyRecordEndDate, setDailyRecordEndDate] = useState(getTodayDate());
    const [selectedDailyCategory, setSelectedDailyCategory] = useState('all');
    const [selectedDailySubcategory, setSelectedDailySubcategory] = useState('all');
    const [selectedDailySupplier, setSelectedDailySupplier] = useState('all');
    const [dailyStockRecords, setDailyStockRecords] = useState([]);
    const [loadingDailyRecords, setLoadingDailyRecords] = useState(false);

    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // START OF MODIFICATION 1: RENAME AND ADD NEW STATE
    const [manualProductCounts, setManualProductCounts] = useState({}); // Renamed from manualCounts
    const [manualEmptyBottleCounts, setManualEmptyBottleCounts] = useState({}); // New state for empty bottle stock
    // END OF MODIFICATION 1
    
    const [stockDifferences, setStockDifferences] = useState([]);
    
    const canAdjustStock = userProfile?.role === 'admin' || userProfile?.role === 'super_admin' || userProfile?.role === 'user';

    const getProductName = useCallback((id) => {
        const product = products.find(p => p.id === id);
        return product ? product.name : 'Produk Dihapus';
    }, [products]);

    // Memoization untuk productMap agar bisa dipakai modal
    const productMapForModal = useMemo(() => {
        return products.reduce((acc, p) => {
            acc[p.id] = { 
                name: p.name, 
                purchasePrice: parseFloat(p.purchase_price) || 0,
                currentStock: parseFloat(p.stock) || 0,
            };
            return acc;
        }, {});
    }, [products]);


    // --- HANDLER MODAL BARU ---
    const handleRowClick = (record) => {
        setSelectedDailyRecord(record);
        setIsMovementModalOpen(true);
    };
    // --- END HANDLER MODAL BARU ---

    useEffect(() => {
        if (companyId) {
            fetchCategories();
            fetchSuppliers();
            fetchReconciliationsHistory();
        }
    }, [companyId]);

    useEffect(() => {
        if (companyId) {
            fetchProducts();
        }
    }, [companyId, selectedCategory, selectedSubcategoryInput]);

    useEffect(() => {
        if (companyId && dailyRecordStartDate && dailyRecordEndDate) {
            fetchDailyStockRecords();
        }
    }, [companyId, dailyRecordStartDate, dailyRecordEndDate, selectedDailyCategory, selectedDailySubcategory, selectedDailySupplier]);

    // START OF MODIFICATION 2: UPDATE USE EFFECT FOR NEW STATES
    useEffect(() => {
        if (products.length > 0) {
            // Set manualProductCounts to system stock (or existing input)
            setManualProductCounts(prev => {
                return products.reduce((acc, product) => {
                    // Prioritize existing input, otherwise use system stock
                    acc[product.id] = prev[product.id] !== undefined 
                        ? prev[product.id] 
                        : String(product.stock ?? 0);
                    return acc;
                }, {});
            });
            
            // Set manualEmptyBottleCounts to system empty bottle stock (or existing input)
            setManualEmptyBottleCounts(prev => {
                return products.reduce((acc, product) => {
                    if (product.is_returnable) {
                        // Prioritize existing input, otherwise use system empty stock
                        acc[product.id] = prev[product.id] !== undefined 
                            ? prev[product.id] 
                            : String(product.empty_bottle_stock ?? 0);
                    }
                    return acc;
                }, {});
            });

            setStockDifferences([]);
        }
    }, [products]); 
    // END OF MODIFICATION 2

    const fetchCategories = async () => {
        const { data, error } = await supabase
            .from('categories')
            .select('id, name, subcategories(id, name)')
            .eq('company_id', companyId)
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching categories:', error);
            toast.error('Gagal memuat kategori.');
        } else {
            setCategories(data);
            const allSubcategories = data.flatMap(cat => cat.subcategories || []);
            setSubcategories(allSubcategories);
        }
    };

    const fetchSuppliers = async () => {
        const { data, error } = await supabase
            .from('suppliers')
            .select('id, name')
            .eq('company_id', companyId)
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching suppliers:', error);
        } else {
            setSuppliers(data);
        }
    };

    const fetchProducts = async () => {
        setLoading(true);
        let query = supabase
            .from('products')
            .select('id, name, stock, empty_bottle_stock, is_returnable, purchase_price, category_id, supplier_id, subcategory_id') 
            .eq('company_id', companyId)
            .order('name', { ascending: true });

        if (selectedCategory !== 'all') {
            query = query.eq('category_id', selectedCategory);
        }

        if (selectedSubcategoryInput !== 'all') {
            query = query.eq('subcategory_id', selectedSubcategoryInput);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching products:', error);
            toast.error('Gagal memuat data produk.');
            setProducts([]);
        } else {
            setProducts(data);
        }
        setLoading(false);
    };

    // --- LOGIC BARU: Mengambil dari daily_stock_records yang sudah terisi otomatis ---
    const fetchDailyStockRecords = useCallback(async () => {
        if (!companyId || !dailyRecordStartDate || !dailyRecordEndDate) return;
        setLoadingDailyRecords(true);

        try {
            // 1. Ambil semua produk yang relevant (untuk filter dan nama)
            let productQuery = supabase
                .from('products')
                .select('id, name, supplier_id, category_id, subcategory_id, purchase_price')
                .eq('company_id', companyId);

            if (selectedDailyCategory !== 'all') {
                productQuery = productQuery.eq('category_id', selectedDailyCategory);
            }
            if (selectedDailySubcategory !== 'all') {
                productQuery = productQuery.eq('subcategory_id', selectedDailySubcategory);
            }
            if (selectedDailySupplier !== 'all') {
                productQuery = productQuery.eq('supplier_id', selectedDailySupplier);
            }

            const { data: filteredProducts, error: productError } = await productQuery;
            if (productError) throw productError;

            const productIds = filteredProducts.map(p => p.id);
            const productNameMap = filteredProducts.reduce((acc, p) => {
                acc[p.id] = { 
                    name: p.name, 
                    purchasePrice: parseFloat(p.purchase_price) || 0,
                };
                return acc;
            }, {});

            if (productIds.length === 0) {
                setDailyStockRecords([]);
                setLoadingDailyRecords(false);
                return;
            }
                
            // 2. Ambil data snapshot dari tabel daily_stock_records yang baru terisi
            const { data: dailyRecords, error: dailyRecordsError } = await supabase
                .from('daily_stock_records')
                .select('product_id, record_date, stock_qty, purchase_price')
                .eq('company_id', companyId)
                .gte('record_date', dailyRecordStartDate)
                .lte('record_date', dailyRecordEndDate)
                .in('product_id', productIds)
                .order('record_date', { ascending: false });

            if (dailyRecordsError) throw dailyRecordsError;

            // 3. Restrukturisasi data hasil fetch (Pivot by Date)
            const pivotedRecords = dailyRecords.reduce((acc, record) => {
                const date = record.record_date;
                
                if (!acc[date]) {
                    acc[date] = { date: date, products: [], totalCogsDaily: 0 };
                }

                const endStock = parseFloat(record.stock_qty) || 0;
                // Gunakan purchase_price dari record snapshot
                const purchasePrice = parseFloat(record.purchase_price) || 0; 
                const inventoryValue = endStock * purchasePrice;

                acc[date].products.push({
                    id: record.product_id,
                    name: productNameMap[record.product_id]?.name || 'Produk Dihapus',
                    endStock: endStock,
                    inventoryValue: inventoryValue,
                });

                acc[date].totalCogsDaily += inventoryValue;

                return acc;
            }, {});

            // 4. Konversi ke array dan sort
            const finalRecords = Object.values(pivotedRecords);
            
            finalRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
            setDailyStockRecords(finalRecords);

        } catch (e) {
            console.error('Error fetching daily stock records:', e);
            toast.error('Gagal memuat rekaman stok harian.');
            setDailyStockRecords([]);
        } finally {
            setLoadingDailyRecords(false);
        }
    }, [companyId, dailyRecordStartDate, dailyRecordEndDate, selectedDailyCategory, selectedDailySubcategory, selectedDailySupplier]);
    // --- END LOGIC BARU ---

    // START OF MODIFICATION 3: UPDATE HISTORY FETCH TO INCLUDE BOTH STOCK TYPES
    const fetchReconciliationsHistory = async () => {
        try {
            const { data, error } = await supabase
                .from('stock_reconciliations')
                .select(`
                    *,
                    user:user_id(full_name)
                `)
                .eq('company_id', companyId)
                .order('reconciliation_date', { ascending: false });

            if (error) throw error; 

            // Client-side filtering untuk memastikan hanya rekonsiliasi yang memuat 
            // product_stock atau empty_bottle_stock yang ditampilkan
            const filteredReconciliations = data.filter(rec => 
                rec.items && rec.items.some(item => 
                    item.stock_type === 'product_stock' || item.stock_type === 'empty_bottle_stock'
                )
            );

            setReconciliations(filteredReconciliations);

        } catch (error) {
            console.error('Error fetching reconciliations:', error);
            toast.error('Gagal memuat riwayat update stok: ' + error.message);
            setReconciliations([]);
        }
    };
    // END OF MODIFICATION 3

    // START OF MODIFICATION 4: NEW HANDLERS FOR PRODUCT AND EMPTY BOTTLE COUNT
    const handleManualProductCountChange = (productId, value) => {
        setManualProductCounts(prev => ({
            ...prev,
            [productId]: value,
        }));
    };

    const handleManualEmptyBottleCountChange = (productId, value) => {
        setManualEmptyBottleCounts(prev => ({
            ...prev,
            [productId]: value,
        }));
    };
    // END OF MODIFICATION 4

    // START OF MODIFICATION 5: UPDATE RECONCILIATION LOGIC
    const handleReconcile = (e) => {
        e.preventDefault();
        const differences = [];

        products.forEach(product => {
            // 1. Reconcile Product Stock (Penuh)
            const manualProductCount = parseFloat(manualProductCounts[product.id]) || 0;
            const systemProductStock = parseFloat(product.stock) || 0;
            const productDifference = manualProductCount - systemProductStock;

            if (productDifference !== 0) {
                differences.push({
                    product_id: product.id,
                    name: product.name,
                    system_stock: systemProductStock,
                    physical_count: manualProductCount,
                    difference: productDifference,
                    stock_type: 'product_stock',
                });
            }

            // 2. Reconcile Empty Bottle Stock (Galon Kosong) - ONLY if returnable
            if (product.is_returnable) {
                const manualEmptyBottleCount = parseFloat(manualEmptyBottleCounts[product.id]) || 0;
                const systemEmptyBottleStock = parseFloat(product.empty_bottle_stock) || 0;
                const emptyBottleDifference = manualEmptyBottleCount - systemEmptyBottleStock;

                if (emptyBottleDifference !== 0) {
                    differences.push({
                        product_id: product.id,
                        name: product.name,
                        system_stock: systemEmptyBottleStock,
                        physical_count: manualEmptyBottleCount,
                        difference: emptyBottleDifference,
                        stock_type: 'empty_bottle_stock', // New stock type
                    });
                }
            }
        });

        setStockDifferences(differences);
    };
    // END OF MODIFICATION 5

    // START OF MODIFICATION 6: UPDATE SUBMISSION LOGIC
    const handleAutomaticAdjustment = async () => {
        setIsSubmitting(true);
        try {
            const payload = {
                reconciliationItems: stockDifferences,
                companyId: companyId,
                userId: userProfile.id,
            };

            const { data, error } = await supabase.functions.invoke('adjust-stock-reconciliation', {
                body: payload,
            });

            if (error) throw error;

            toast.success('Penyesuaian stok otomatis berhasil!');
            setStockDifferences([]);
            fetchProducts();
            fetchReconciliationsHistory();
        } catch (error) {
            console.error('Error during automatic adjustment:', error);
            toast.error('Gagal melakukan penyesuaian stok otomatis: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };
    // END OF MODIFICATION 6

    const displayProducts = products;

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 md:p-8 max-w-7xl space-y-6">
            
            {/* MODAL PERGERAKAN HARIAN */}
            <DailyStockMovementModal
                isOpen={isMovementModalOpen}
                onClose={() => setIsMovementModalOpen(false)}
                record={selectedDailyRecord}
                productMap={productMapForModal}
            />

            <h1 className="text-xl font-bold mb-3 text-[#011e4b]">
                <Package className="h-5 w-5 mr-2 inline-block" />
                Update Stok Fisik
            </h1>
            <p className="text-sm text-muted-foreground mb-4">
                Periksa dan input jumlah stok fisik di gudang, lalu bandingkan dengan data di sistem.
            </p>

            {/* Bagian Input Stok Fisik */}
            <form onSubmit={handleReconcile}>
                <Card className="shadow-sm bg-white">
                    <CardHeader className="p-4 md:p-6">
                        <CardTitle className="text-base text-[#011e4b]">Input Stok Fisik</CardTitle>
                        <CardDescription className="text-sm">
                            Masukkan jumlah stok yang ada di gudang untuk setiap produk.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 md:p-6 pt-0">
                        {/* Filter & Kontrol */}
                        <div className="flex flex-wrap gap-4 mb-4">
                            
                            {/* Filter Kategori */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-grow min-w-[150px] md:min-w-0">
                                <Label htmlFor="category-select" className="text-sm font-medium text-gray-700 whitespace-nowrap">Filter Kategori:</Label>
                                <Select
                                    value={selectedCategory}
                                    onValueChange={(value) => {
                                        setSelectedCategory(value);
                                        setSelectedSubcategoryInput('all');
                                    }}
                                >
                                    <SelectTrigger id="category-select" className="w-full sm:w-[200px] text-sm">
                                        <SelectValue placeholder="Semua Kategori" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua Kategori</SelectItem>
                                        {categories.map(category => (
                                            <SelectItem key={category.id} value={category.id}>
                                                {category.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Filter Subkategori */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-grow min-w-[150px] md:min-w-0">
                                <Label htmlFor="subcategory-select" className="text-sm font-medium text-gray-700 whitespace-nowrap">Filter Subkategori:</Label>
                                <Select
                                    value={selectedSubcategoryInput}
                                    onValueChange={setSelectedSubcategoryInput}
                                    disabled={!selectedCategory || selectedCategory === 'all'}
                                >
                                    <SelectTrigger id="subcategory-select" className="w-full sm:w-[200px] text-sm">
                                        <SelectValue placeholder="Semua Subkategori" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua Subkategori</SelectItem>
                                        {subcategories
                                            .filter(sub => {
                                                const parentCategory = categories.find(c => c.subcategories?.some(s => s.id === sub.id));
                                                return !selectedCategory || selectedCategory === 'all' || parentCategory?.id === selectedCategory;
                                            })
                                            .map(sub => (
                                                <SelectItem key={sub.id} value={sub.id}>
                                                    {sub.name}
                                                </SelectItem>
                                            ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* TABEL INPUT DAN STOK: Semua bisa di-scroll */}
                        <div className="overflow-x-auto rounded-md border">
                            <Table className="table-auto min-w-max text-xs">
                                <TableHeader>
                                    <TableRow className="bg-gray-50">
                                        <TableHead className="min-w-[100px] text-[#011e4b] font-semibold p-2">Metrik</TableHead>
                                        {displayProducts.map(product => (
                                            <TableHead
                                                className="text-center font-semibold min-w-[80px] max-w-[120px] whitespace-normal p-2"
                                                key={product.id}
                                            >
                                                {product.name}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {/* Baris Stok Sistem - Produk Penuh */}
                                    <TableRow>
                                        <TableCell className="font-medium min-w-[100px] p-2">Stok Sistem (Penuh)</TableCell>
                                        {displayProducts.map(product => (
                                            <TableCell
                                                key={product.id}
                                                className="text-center font-medium p-2 min-w-[80px] max-w-[120px] whitespace-normal"
                                            >
                                                {product.stock}
                                            </TableCell>
                                        ))}
                                    </TableRow>

                                    {/* Baris Stok Fisik - Produk Penuh */}
                                    <TableRow>
                                        <TableCell className="font-medium min-w-[100px] p-2">Stok Fisik (Penuh)</TableCell>
                                        {displayProducts.map(product => (
                                            <TableCell key={product.id} className="p-1 min-w-[80px] max-w-[120px]">
                                                <Input
                                                    type="number"
                                                    placeholder="Jml Penuh"
                                                    value={manualProductCounts[product.id] || ''}
                                                    onChange={(e) => handleManualProductCountChange(product.id, e.target.value)}
                                                    className="w-full max-w-[70px] text-center h-7 mx-auto p-1 text-xs"
                                                />
                                            </TableCell>
                                        ))}
                                    </TableRow>

                                    {/* START OF MODIFICATION 7: ADD EMPTY BOTTLE ROWS */}
                                    {/* Baris Stok Sistem - Galon Kosong */}
                                    <TableRow className="bg-blue-50/50">
                                        <TableCell className="font-medium min-w-[100px] p-2">Stok Sistem (Kosong)</TableCell>
                                        {displayProducts.map(product => (
                                            <TableCell 
                                                key={product.id} 
                                                className="text-center font-medium p-2 min-w-[80px] max-w-[120px] whitespace-normal"
                                            >
                                                {product.is_returnable ? product.empty_bottle_stock : '-'}
                                            </TableCell>
                                        ))}
                                    </TableRow>

                                    {/* Baris Stok Fisik - Galon Kosong */}
                                    <TableRow className="bg-blue-50/50">
                                        <TableCell className="font-medium min-w-[100px] p-2">Stok Fisik (Kosong)</TableCell>
                                        {displayProducts.map(product => (
                                            <TableCell key={product.id} className="p-1 min-w-[80px] max-w-[120px]">
                                                {product.is_returnable ? (
                                                    <Input
                                                        type="number"
                                                        placeholder="Jml Kosong"
                                                        value={manualEmptyBottleCounts[product.id] || ''}
                                                        onChange={(e) => handleManualEmptyBottleCountChange(product.id, e.target.value)}
                                                        className="w-full max-w-[70px] text-center h-7 mx-auto p-1 text-xs"
                                                    />
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                    {/* END OF MODIFICATION 7: ADD EMPTY BOTTLE ROWS */}

                                    {/* Baris Perbedaan - Produk Penuh */}
                                    {stockDifferences.filter(d => d.stock_type === 'product_stock').length > 0 && (
                                        <TableRow className="bg-yellow-50">
                                            <TableCell className="font-bold min-w-[150px] p-2">Perbedaan (Penuh)</TableCell>
                                            {displayProducts.map(product => {
                                                const diff = stockDifferences.find(d => d.product_id === product.id && d.stock_type === 'product_stock');
                                                const difference = diff?.difference ?? 0;
                                                const cellClass = difference > 0 ? 'text-green-600' : difference < 0 ? 'text-red-600' : '';
                                                const diffDisplay = difference !== 0 ? (difference > 0 ? `+${difference}` : difference) : '0';

                                                return (
                                                    <TableCell
                                                        key={product.id}
                                                        className={`text-center font-bold p-2 min-w-[80px] max-w-[120px] whitespace-normal ${cellClass}`}
                                                    >
                                                        {diffDisplay}
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                    )}
                                    
                                    {/* Baris Perbedaan - Galon Kosong */}
                                    {stockDifferences.filter(d => d.stock_type === 'empty_bottle_stock').length > 0 && (
                                        <TableRow className="bg-yellow-100">
                                            <TableCell className="font-bold min-w-[150px] p-2">Perbedaan (Kosong)</TableCell>
                                            {displayProducts.map(product => {
                                                const diff = stockDifferences.find(d => d.product_id === product.id && d.stock_type === 'empty_bottle_stock');
                                                
                                                if (!product.is_returnable) return <TableCell key={product.id} className='text-center'>-</TableCell>;
                                                
                                                const difference = diff?.difference ?? 0;
                                                const cellClass = difference > 0 ? 'text-green-600' : difference < 0 ? 'text-red-600' : '';
                                                const diffDisplay = difference !== 0 ? (difference > 0 ? `+${difference}` : difference) : '0';

                                                return (
                                                    <TableCell
                                                        key={product.id}
                                                        className={`text-center font-bold p-2 min-w-[80px] max-w-[120px] whitespace-normal ${cellClass}`}
                                                    >
                                                        {diffDisplay}
                                                    </TableCell>
                                                );
                                            })}
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Tombol Aksi */}
                        <div className="flex flex-col sm:flex-row gap-2 mt-6">
                            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto bg-[#011e4b] text-white hover:bg-[#011e4b]/90 text-sm">
                                <Box className="h-4 w-4 mr-2" /> Bandingkan Stok
                            </Button>
                            {stockDifferences.length > 0 && canAdjustStock && (
                                <Button onClick={handleAutomaticAdjustment} disabled={isSubmitting} variant="secondary" className="w-full sm:w-auto text-sm">
                                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Sesuaikan Stok Otomatis
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </form>
             
            <div className="mt-8">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-[#011e4b]"><History className="h-4 w-4" /> Rekaman Nilai Inventori Harian (COGS)</h2>

                <Card className="shadow-sm bg-white">
                    <CardHeader className="p-4 md:p-6">
                        <CardTitle className="text-base text-[#011e4b]">Filter Laporan Harian</CardTitle>
                        <CardDescription className="text-sm">
                            Menampilkan Stok Akhir dan Nilai Inventori (Stok Akhir * Harga Beli) per tanggal. Data diambil dari snapshot harian yang otomatis direkam setiap jam 00:00. Klik baris untuk melihat detail pergerakan.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 md:p-6 pt-0">
                        {/* Filter Tanggal */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="space-y-1">
                                <Label className="text-sm">Dari Tanggal</Label>
                                <Input
                                    type="date"
                                    value={dailyRecordStartDate}
                                    onChange={(e) => setDailyRecordStartDate(e.target.value)}
                                    className="h-9 text-sm"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-sm">Sampai Tanggal</Label>
                                <Input
                                    type="date"
                                    value={dailyRecordEndDate}
                                    onChange={(e) => setDailyRecordEndDate(e.target.value)}
                                    className="h-9 text-sm"
                                    required
                                />
                            </div>
                        </div>

                        {/* Filter Kategori, Subkategori, Supplier */}
                        <div className="flex flex-wrap items-end gap-3 mb-4">
                            <div className="space-y-1 w-[130px] flex-grow">
                                <Label className="text-xs">Kategori</Label>
                                <Select value={selectedDailyCategory} onValueChange={setSelectedDailyCategory}>
                                    <SelectTrigger className="h-9 text-sm">
                                        <SelectValue placeholder="Semua Kategori" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua</SelectItem>
                                        {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1 w-[130px] flex-grow">
                                <Label className="text-xs">Subkategori</Label>
                                <Select
                                    value={selectedDailySubcategory}
                                    onValueChange={setSelectedDailySubcategory}
                                    disabled={!selectedDailyCategory || selectedDailyCategory === 'all'}
                                >
                                    <SelectTrigger className="h-9 text-sm">
                                        <SelectValue placeholder="Semua Subkategori" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua</SelectItem>
                                        {categories.find(c => c.id === selectedDailyCategory)?.subcategories.map(s => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1 w-[130px] flex-grow">
                                <Label className="text-xs">Supplier</Label>
                                <Select value={selectedDailySupplier} onValueChange={setSelectedDailySupplier}>
                                    <SelectTrigger className="h-9 text-sm">
                                        <SelectValue placeholder="Semua Supplier" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua</SelectItem>
                                        {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {loadingDailyRecords ? (
                            <div className="flex justify-center items-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                                <span className="ml-2 text-sm text-blue-500">Memuat data inventori...</span>
                            </div>
                        ) : dailyStockRecords.length > 0 ? (
                            // TABEL REKAMAN HARIAN: Semua bisa di-scroll
                            <div className="overflow-x-auto rounded-md border mt-4">
                                <Table className="table-auto min-w-max text-xs">
                                    <TableHeader>
                                        <TableRow className="bg-gray-50">
                                            {/* Kolom Tanggal: Non-sticky */}
                                            <TableHead className="min-w-[100px] text-[#011e4b] font-semibold p-2">Tanggal</TableHead>
                                            
                                            {dailyStockRecords[0].products.map(p => (
                                                <TableHead className="text-center font-semibold min-w-[150px] whitespace-normal p-2" key={p.id}>
                                                    {p.name}
                                                    <div className='text-[10px] text-gray-500 font-normal mt-1 border-t border-gray-200 pt-1'>
                                                        Stok Akhir (Nilai COGS)
                                                    </div>
                                                </TableHead>
                                            ))}
                                            {/* Kolom Total COGS Harian: Non-sticky */}
                                            <TableHead className="min-w-[150px] text-right text-base text-green-700 font-bold p-2">
                                                Total COGS Harian
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {/* Data sudah diurutkan dari terbaru ke terlama */}
                                        {dailyStockRecords.map(row => (
                                            <TableRow 
                                                key={row.date} 
                                                onClick={() => handleRowClick(row)}
                                                className="cursor-pointer hover:bg-blue-50 transition-colors"
                                            >
                                                {/* Kolom Tanggal: Non-sticky */}
                                                <TableCell className="font-medium min-w-[100px] p-2">{new Date(row.date).toLocaleDateString('id-ID')}</TableCell>
                                                
                                                {row.products.map(p => (
                                                    <TableCell key={p.id} className="text-center p-2 min-w-[150px]">
                                                        <span className='font-semibold'>{formatDecimal(p.endStock)}</span>
                                                        <span className='block text-[10px] text-gray-600'>({formatCurrency(p.inventoryValue)})</span>
                                                    </TableCell>
                                                ))}
                                                
                                                {/* Kolom Total COGS Harian: Non-sticky */}
                                                <TableCell className="text-right text-base font-bold text-green-700 p-2">
                                                    {formatCurrency(row.totalCogsDaily)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <div className="text-center text-muted-foreground py-8 text-sm">
                                Tidak ada data stok yang ditemukan dalam periode yang dipilih.
                            </div>
                        )}

                    </CardContent>
                </Card>
            </div> 

 
            <div className="mt-8"> 
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-[#011e4b]"><History className="h-4 w-4" /> Riwayat Update Stok (Penuh & Galon Kosong)</h2>
                <Card className="shadow-sm bg-white">
                    <CardHeader className="p-4 md:p-6">
                        <CardTitle className="text-base">Riwayat Update Stok</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto overflow-y-auto max-h-[400px] rounded-md border-t">
                            <Table className="table-auto min-w-max">
                                <TableHeader className="sticky top-0 bg-white z-30">
                                    <TableRow className="text-xs md:text-sm bg-gray-50">
                                        <TableHead className="min-w-[100px] sticky top-0 bg-gray-50 z-30">Tanggal</TableHead>
                                        <TableHead className="min-w-[120px] sticky top-0 bg-gray-50 z-30">Dibuat Oleh</TableHead>
                                        {products.map(product => (
                                            <TableHead className="text-center sticky top-0 bg-gray-50 z-30" key={product.id}>
                                                <span className="block">{product.name}</span>
                                                <div className='text-[10px] text-gray-500 font-normal mt-1 border-t border-gray-200 pt-1'>
                                                    Penuh / Kosong
                                                </div>
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reconciliations.length > 0 ? (
                                        reconciliations.map(rec => (
                                            <TableRow key={rec.id} className="text-xs md:text-sm">
                                                <TableCell className="whitespace-nowrap min-w-[100px]">{new Date(rec.reconciliation_date).toLocaleDateString('id-ID')}</TableCell>
                                                <TableCell className="whitespace-nowrap min-w-[120px]">{rec.user?.full_name ?? 'N/A'}</TableCell>
                                                {products.map(product => {
                                                    // Cek item produk penuh
                                                    const itemProduct = rec.items.find(i => i.product_id === product.id && i.stock_type === 'product_stock');
                                                    // Cek item galon kosong
                                                    const itemEmpty = product.is_returnable 
                                                        ? rec.items.find(i => i.product_id === product.id && i.stock_type === 'empty_bottle_stock')
                                                        : null;

                                                    if (!itemProduct && (!itemEmpty || !product.is_returnable)) return <TableCell key={product.id} className='text-center'>-</TableCell>;
                                                    
                                                    // Format display untuk produk penuh
                                                    const prodDiff = itemProduct?.difference ?? 0;
                                                    const prodClass = prodDiff > 0 ? 'text-green-600 font-semibold' : prodDiff < 0 ? 'text-red-600 font-semibold' : 'text-gray-500';
                                                    const prodDisplay = itemProduct 
                                                        ? `${itemProduct.physical_count}${prodDiff !== 0 ? ` (${prodDiff > 0 ? `+${prodDiff}` : prodDiff})` : ''}`
                                                        : '0';

                                                    // Format display untuk galon kosong
                                                    const emptyDiff = itemEmpty?.difference ?? 0;
                                                    const emptyClass = emptyDiff > 0 ? 'text-green-600' : emptyDiff < 0 ? 'text-red-600' : 'text-gray-500';
                                                    const emptyDisplay = itemEmpty
                                                        ? `${itemEmpty.physical_count}${emptyDiff !== 0 ? ` (${emptyDiff > 0 ? `+${emptyDiff}` : emptyDiff})` : ''}`
                                                        : '0';

                                                    return (
                                                        <TableCell key={product.id} className={'text-center p-2'}>
                                                            <div className={prodClass}>{prodDisplay}</div> 
                                                        </TableCell>
                                                    );
                                                })}
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={products.length + 2} className="text-center text-muted-foreground py-8 text-sm">
                                                Belum ada riwayat update stok produk atau galon kosong.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default UpdateStockPage;