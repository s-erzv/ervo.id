import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';
import { Loader2, PlusCircle, Pencil, Trash2, Tags, Package, ShoppingBag, Search, ChevronLeft, ChevronRight, GripVertical, List, ImageIcon } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import CategoryModal from './CategoryModal';
import SupplierModal from './SupplierModal';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const ProductSettings = () => {
  const { userProfile, loading: authLoading, companyId } = useAuth(); 
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('__all__'); 
  const [selectedSubcategory, setSelectedSubcategory] = useState('__all__'); 
  const [selectedSupplier, setSelectedSupplier] = useState('__all__'); 
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); 
  const isShowAll = itemsPerPage === 9999;

  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const fetchFilterOptions = async (currentCompanyId) => {
    if (!currentCompanyId) return;
    try {
        const { data: categoriesWithSub, error: catError } = await supabase
            .from('categories')
            .select(`id, name, subcategories(id, name)`)
            .eq('company_id', currentCompanyId)
            .order('name', { ascending: true });
        if (catError) throw catError;
        setCategories(categoriesWithSub);
        const allSubcategories = categoriesWithSub.flatMap(cat => 
            cat.subcategories.map(sub => ({ ...sub, category_id: cat.id }))
        );
        setSubcategories(allSubcategories);
        const { data: suppliersData, error: suppliersError } = await supabase
            .from('suppliers')
            .select('id, name')
            .eq('company_id', currentCompanyId)
            .order('name', { ascending: true });
        if (suppliersError) throw suppliersError;
        setSuppliers(suppliersData);
    } catch (error) {
        console.error('Error fetching filter options:', error);
        toast.error('Gagal memuat opsi filter.');
    }
  };

  const fetchData = async (currentCompanyId, search, categoryId, subcategoryId, supplierId) => {
    setLoading(true);
    if (!currentCompanyId) {
        setLoading(false);
        return;
    }
    let query = supabase
      .from('products')
      .select(`
        *,
        product_prices(*),
        category:category_id(id, name),
        subcategory:subcategory_id(id, name),
        supplier:supplier_id(id, name)
      `)
      .eq('company_id', currentCompanyId);
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }
    if (categoryId && categoryId !== '__all__') {
      query = query.eq('category_id', categoryId);
    }
    if (subcategoryId && subcategoryId !== '__all__') {
      query = query.eq('subcategory_id', subcategoryId);
    }
    if (supplierId && supplierId !== '__all__') {
      query = query.eq('supplier_id', supplierId);
    }
    const { data: productsData, error: productsError } = await query
      .order('sort_order', { ascending: true });
    if (productsError) {
      console.error('Error fetching data:', productsError);
      toast.error('Gagal memuat data produk.'); 
      setProducts([]);
    } else {
      setProducts(productsData);
    }
    setLoading(false);
  };
  
  useEffect(() => {
    if (!authLoading && companyId) {
      fetchFilterOptions(companyId);
    } else if (!authLoading && !companyId) {
       setLoading(false); 
    }
  }, [authLoading, companyId]);

  useEffect(() => {
    setCurrentPage(1); 
    if (companyId) {
      const debounceTimeout = setTimeout(() => {
        fetchData(companyId, searchTerm, selectedCategory, selectedSubcategory, selectedSupplier);
      }, 300); 
      return () => clearTimeout(debounceTimeout); 
    }
  }, [companyId, searchTerm, selectedCategory, selectedSubcategory, selectedSupplier]);
  
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return products.slice(startIndex, endIndex);
  }, [products, currentPage, itemsPerPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(products.length / itemsPerPage);
  }, [products, itemsPerPage]);

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const filteredSubcategories = selectedCategory && selectedCategory !== '__all__' 
    ? subcategories.filter(sub => sub.category_id === selectedCategory) 
    : subcategories;

  const handleCategoryChange = (categoryId) => {
    setSelectedCategory(categoryId);
    setSelectedSubcategory('__all__'); 
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('__all__'); 
    setSelectedSubcategory('__all__'); 
    setSelectedSupplier('__all__'); 
    setCurrentPage(1);
    setItemsPerPage(10);
  }

  const handleDelete = async (productId) => {
    const isConfirmed = window.confirm('Apakah Anda yakin ingin menghapus produk ini? Semua data terkait akan terhapus.');
    if (!isConfirmed) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);
      if (error) throw new Error(error.message);
      toast.success('Produk berhasil dihapus!');
      fetchData(companyId, searchTerm, selectedCategory, selectedSubcategory, selectedSupplier);
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Gagal menghapus produk: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleOnDragEnd = async (result) => {
    if (!result.destination) return;

    const items = Array.from(products);
    const startIndex = (currentPage - 1) * itemsPerPage + result.source.index;
    const endIndex = (currentPage - 1) * itemsPerPage + result.destination.index;
    
    const [reorderedItem] = items.splice(startIndex, 1);
    items.splice(endIndex, 0, reorderedItem);

    setProducts(items);

    try {
      // Hanya ambil data yang diperlukan untuk upsert agar ringan
      const updates = items.map((product, index) => ({
        id: product.id,
        sort_order: index + 1,
        company_id: companyId,
        name: product.name 
      }));

      const { error } = await supabase
        .from('products')
        .upsert(updates, { onConflict: 'id' });

      if (error) throw error;
      toast.success('Urutan berhasil disimpan!');
    } catch (error) {
      console.error('Error reordering:', error);
      toast.error('Gagal menyimpan urutan.');
      // Re-fetch jika gagal agar state kembali ke data DB
      fetchData(companyId, searchTerm, selectedCategory, selectedSubcategory, selectedSupplier);
    }
  };

  const handleModalUpdate = () => {
    fetchFilterOptions(companyId);
  };

  const toggleShowAll = () => {
    if (isShowAll) {
      setItemsPerPage(10);
      setCurrentPage(1);
    } else {
      setItemsPerPage(9999);
      setCurrentPage(1);
    }
  };

  return (
    <Card className="border-0 shadow-lg bg-white">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-[#011e4b] text-white rounded-t-lg space-y-4 sm:space-y-0 p-6">
        <div>
            <CardTitle className="text-xl font-bold">Manajemen Produk</CardTitle>
            <p className="text-xs text-slate-300 mt-1">Kelola katalog, stok, dan urutan tampilan produk.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
            <Button variant="outline" className="bg-white/10 border-white/20 hover:bg-white/20 text-white" onClick={() => setIsCategoryModalOpen(true)}>
                <Tags className="h-4 w-4 mr-2" /> Kategori
            </Button>
            <Button variant="outline" className="bg-white/10 border-white/20 hover:bg-white/20 text-white" onClick={() => setIsSupplierModalOpen(true)}>
                <ShoppingBag className="h-4 w-4 mr-2" /> Supplier
            </Button>
            <Button className="bg-white text-[#011e4b] hover:bg-slate-100" onClick={() => navigate('/products/add')}>
              <PlusCircle className="h-4 w-4 mr-2" /> Tambah Produk
            </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row gap-3 mb-6 p-4 border rounded-xl bg-slate-50/50">
            <div className="flex-1 relative">
                <Input type="text" placeholder="Cari nama produk..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 bg-white" />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            </div>
            <div className="grid grid-cols-2 md:flex gap-2">
                <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                    <SelectTrigger className="w-full md:w-[150px] bg-white text-xs">
                        <SelectValue placeholder="Kategori" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__all__">Semua Kategori</SelectItem>
                        {categories.map(cat => (<SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>))}
                    </SelectContent>
                </Select>
                <Select value={selectedSubcategory} onValueChange={setSelectedSubcategory} disabled={filteredSubcategories.length === 0 && selectedCategory !== '__all__'}>
                    <SelectTrigger className="w-full md:w-[150px] bg-white text-xs">
                        <SelectValue placeholder="Subkategori" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__all__">Semua Sub</SelectItem>
                        {filteredSubcategories.map(sub => (<SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>))}
                    </SelectContent>
                </Select>
                <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                    <SelectTrigger className="w-full md:w-[150px] bg-white text-xs">
                        <SelectValue placeholder="Supplier" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__all__">Semua Supplier</SelectItem>
                        {suppliers.map(sup => (<SelectItem key={sup.id} value={sup.id}>{sup.name}</SelectItem>))}
                    </SelectContent>
                </Select>
                <Button variant="ghost" onClick={resetFilters} className="text-slate-500 hover:text-red-500 hover:bg-red-50 px-2">
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>

        {loading ? (
          <div className="flex flex-col justify-center items-center h-60 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#011e4b]" />
            <p className="text-sm text-slate-500">Memuat data produk...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 bg-slate-50 rounded-xl border-2 border-dashed">
             <Package className="h-12 w-12 text-slate-300 mx-auto mb-3" />
             <p className="text-slate-500 font-medium">Produk tidak ditemukan.</p>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-3 px-1">
               <div className="text-xs text-slate-500">
                  Total <strong>{products.length}</strong> produk ditemukan.
               </div>
               <Button 
                variant={isShowAll ? "default" : "outline"} 
                size="sm" 
                onClick={toggleShowAll}
                className={cn("h-8 text-xs", isShowAll ? "bg-orange-600 hover:bg-orange-700 text-white" : "border-slate-200 text-slate-600")}
               >
                 <List className="h-3.5 w-3.5 mr-2" />
                 {isShowAll ? "Selesai Atur Urutan" : "Atur Urutan (Lihat Semua)"}
               </Button>
            </div>

            <div className="rounded-xl border shadow-sm overflow-hidden bg-white">
                <DragDropContext onDragEnd={handleOnDragEnd}>
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead className="w-[40px]"></TableHead>
                                <TableHead className="w-[60px] text-center">Foto</TableHead>
                                <TableHead className="min-w-[100px]">SKU</TableHead>
                                <TableHead className="min-w-[200px]">Produk</TableHead>
                                <TableHead className="hidden md:table-cell">Kategori</TableHead>
                                <TableHead className="hidden lg:table-cell">Subkategori</TableHead>
                                <TableHead className="hidden xl:table-cell">Supplier</TableHead>
                                <TableHead className="text-center">Stok</TableHead>
                                <TableHead className="text-right">Harga Beli</TableHead>
                                <TableHead className="w-[100px] text-center">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <Droppable droppableId="productsTable">
                            {(provided) => (
                                <TableBody {...provided.droppableProps} ref={provided.innerRef}>
                                    {paginatedProducts.map((product, index) => (
                                        <Draggable key={product.id} draggableId={product.id} index={index} isDragDisabled={!isShowAll}>
                                            {(provided, snapshot) => (
                                                <TableRow 
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    className={cn(
                                                        "group transition-colors",
                                                        snapshot.isDragging ? "bg-blue-50 shadow-2xl ring-2 ring-blue-500/20 z-50" : "hover:bg-slate-50/80"
                                                    )}
                                                >
                                                    <TableCell {...provided.dragHandleProps} className="text-slate-300 group-hover:text-slate-500">
                                                        <GripVertical className="h-4 w-4" />
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <div className="w-10 h-10 rounded-lg border bg-slate-100 overflow-hidden flex items-center justify-center mx-auto shadow-sm">
                                                            {product.image_url ? (
                                                                <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <ImageIcon className="h-4 w-4 text-slate-300" />
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <code className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 uppercase">
                                                            {product.sku || '-'}
                                                        </code>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div 
                                                            className="font-bold text-slate-800 cursor-pointer hover:text-blue-600 hover:underline transition-all"
                                                            onClick={() => navigate(`/products/${product.id}`)}
                                                        >
                                                            {product.name}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="hidden md:table-cell text-xs text-slate-600">
                                                        {product.category?.name || '-'}
                                                    </TableCell>
                                                    <TableCell className="hidden lg:table-cell text-xs text-slate-500">
                                                        {product.subcategory?.name || '-'}
                                                    </TableCell>
                                                    <TableCell className="hidden xl:table-cell text-xs text-slate-500">
                                                        {product.supplier?.name || '-'}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <span className={cn(
                                                            "px-2 py-0.5 rounded-full text-[10px] font-bold",
                                                            product.stock <= 5 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                                                        )}>
                                                            {product.stock}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium text-slate-700 text-xs">
                                                        {product.purchase_price ? `Rp${parseFloat(product.purchase_price).toLocaleString('id-ID')}` : '-'}
                                                    </TableCell>
                                                    <TableCell> 
                                                        <div className="flex justify-center gap-1">
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500 hover:bg-blue-50" onClick={() => navigate(`/products/edit/${product.id}`)}>
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => handleDelete(product.id)}>
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </TableBody>
                            )}
                        </Droppable>
                    </Table>
                </DragDropContext>
            </div>
            
            {!isShowAll && (
              <div className="flex justify-between items-center mt-4 px-2">
                <p className="text-[11px] text-slate-500">
                  Menampilkan {Math.min(products.length, (currentPage - 1) * itemsPerPage + 1)} - {Math.min(products.length, currentPage * itemsPerPage)} dari {products.length} Produk
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={handlePrevPage} disabled={currentPage === 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-xs font-bold text-slate-700 bg-slate-100 h-8 px-3 flex items-center rounded-md border">
                    {currentPage} / {totalPages}
                  </div>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={handleNextPage} disabled={currentPage === totalPages}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
      <CategoryModal open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen} onCategoriesUpdated={handleModalUpdate} />
      <SupplierModal open={isSupplierModalOpen} onOpenChange={setIsSupplierModalOpen} onSuppliersUpdated={handleModalUpdate} />
    </Card>
  );
};

export default ProductSettings;