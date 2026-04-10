import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import { Loader2, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const CategoryModal = ({ open, onOpenChange, onCategoriesUpdated }) => {
  const { companyId } = useAuth();
  const [categories, setCategories] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubCategoryName, setNewSubCategoryName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const fetchCategories = useCallback(async () => {
    setLoading(true);
    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('*, subcategories(*)')
      .eq('company_id', companyId);

    if (categoriesError) {
      toast.error('Gagal mengambil kategori.');
      console.error(categoriesError);
    } else {
      setCategories(categoriesData);
    }
    setLoading(false);
  }, [companyId]); 

  useEffect(() => {
    if (open) {
      fetchCategories();
    }
  }, [open, fetchCategories]); 

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      return toast.error('Nama kategori tidak boleh kosong.');
    }
    setLoading(true);
    const { error } = await supabase
      .from('categories')
      .insert({ name: newCategoryName, company_id: companyId });

    if (error) {
      toast.error('Gagal menambahkan kategori.');
      console.error(error);
    } else {
      toast.success('Kategori berhasil ditambahkan!');
      setNewCategoryName('');
      fetchCategories();
      onCategoriesUpdated();
    }
    setLoading(false);
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus kategori ini?')) return;
    
    setLoading(true);
    const { error } = await supabase.from('categories').delete().eq('id', id);

    if (error) {
      toast.error('Gagal menghapus kategori. Pastikan tidak ada subkategori atau produk yang terhubung.');
      console.error(error);
    } else {
      toast.success('Kategori berhasil dihapus.');
      setSelectedCategory(null);
      fetchCategories();
      onCategoriesUpdated();
    }
    setLoading(false);
  };

  const handleAddSubCategory = async () => {
    if (!newSubCategoryName.trim()) {
      return toast.error('Nama subkategori tidak boleh kosong.');
    }
    if (!selectedCategory) {
      return toast.error('Pilih kategori terlebih dahulu.');
    }
    setLoading(true);
    const { error } = await supabase
      .from('subcategories')
      .insert({ name: newSubCategoryName, category_id: selectedCategory.id });

    if (error) {
      toast.error('Gagal menambahkan subkategori.');
      console.error(error);
    } else {
      toast.success('Subkategori berhasil ditambahkan!');
      setNewSubCategoryName('');
      const updatedCategories = categories.map(cat => 
        cat.id === selectedCategory.id 
          ? { ...cat, subcategories: [...cat.subcategories, { name: newSubCategoryName, category_id: selectedCategory.id, id: Date.now() }] }
          : cat
      );
      setCategories(updatedCategories);
      setSelectedCategory(updatedCategories.find(c => c.id === selectedCategory.id));
      fetchCategories();
      onCategoriesUpdated();
    }
    setLoading(false);
  };

  const handleDeleteSubCategory = async (id) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus subkategori ini?')) return;
    
    setLoading(true);
    const { error } = await supabase.from('subcategories').delete().eq('id', id);

    if (error) {
      toast.error('Gagal menghapus subkategori. Pastikan tidak ada produk yang terhubung.');
      console.error(error);
    } else {
      toast.success('Subkategori berhasil dihapus.');
      fetchCategories();
      onCategoriesUpdated();
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(newOpenState) => {
        onOpenChange(newOpenState);
        if (!newOpenState) {
            setSelectedCategory(null);
        }
    }}>
      <DialogContent className="w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 sm:max-w-[90vw] md:max-w-2xl lg:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Kelola Kategori & Subkategori Produk</DialogTitle>
          <DialogDescription>
            Tambahkan, edit, atau hapus kategori dan subkategori untuk produk Anda.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-4 sm:items-center">
            <Label htmlFor="category-name" className="text-left sm:text-right">
              Kategori Baru
            </Label>
            <Input
              id="category-name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="col-span-1 sm:col-span-3"
              placeholder="Contoh: Makanan, Minuman, Pakaian"
            />
          </div>
          <Button onClick={handleAddCategory} className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tambah Kategori'}
          </Button>

          <div className="mt-4">
            <h4 className="font-semibold text-sm sm:text-base">Daftar Kategori</h4>
            {loading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border mt-2">
                <Table className="text-xs sm:text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[120px] sm:min-w-auto">Nama Kategori</TableHead>
                      <TableHead className="min-w-[100px] sm:min-w-auto">Jumlah Sub</TableHead>
                      <TableHead className="text-right min-w-[60px] sm:min-w-auto">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((category) => (
                      <TableRow
                        key={category.id}
                        className={`cursor-pointer transition-colors ${selectedCategory?.id === category.id ? 'bg-gray-100 hover:bg-gray-200' : 'hover:bg-gray-50'}`}
                        onClick={() => setSelectedCategory(category)}
                      >
                        <TableCell className="truncate">{category.name}</TableCell>
                        <TableCell>{category.subcategories.length}</TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="destructive" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCategory(category.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {selectedCategory && (
            <div className="mt-4 p-3 sm:p-4 border rounded-md bg-gray-50">
              <h4 className="font-semibold text-sm sm:text-base">Subkategori: {selectedCategory.name}</h4>
              <div className="flex flex-col sm:flex-row gap-2 mt-2">
                <Input
                  value={newSubCategoryName}
                  onChange={(e) => setNewSubCategoryName(e.target.value)}
                  placeholder="Nama subkategori baru"
                  className="text-sm"
                />
                <Button onClick={handleAddSubCategory} disabled={loading} className="w-full sm:w-auto whitespace-nowrap">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tambah'}
                </Button>
              </div>

              <div className="overflow-x-auto rounded-md border mt-4 bg-white">
                <Table className="text-xs sm:text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px] sm:min-w-auto">Nama Subkategori</TableHead>
                      <TableHead className="text-right min-w-[60px] sm:min-w-auto">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedCategory.subcategories.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={2} className="text-center text-gray-500 text-xs sm:text-sm">
                                Belum ada subkategori.
                            </TableCell>
                        </TableRow>
                    ) : (
                        selectedCategory.subcategories.map((sub) => (
                        <TableRow key={sub.id}>
                            <TableCell className="truncate">{sub.name}</TableCell>
                            <TableCell className="text-right">
                            <Button 
                              variant="destructive" 
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleDeleteSubCategory(sub.id)}
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
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CategoryModal;