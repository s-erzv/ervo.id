import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2, ArrowLeft, Pencil, ImageIcon, Hash, Package, DollarSign, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const ProductDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { companyId } = useAuth();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProductDetail = async () => {
            if (!companyId || !id) {
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('products')
                .select(`
                    *,
                    category:category_id(name),
                    subcategory:subcategory_id(name),
                    supplier:supplier_id(name),
                    product_prices(*)
                `)
                .eq('id', id)
                .eq('company_id', companyId)
                .single();

            if (error) {
                console.error("Error fetching product detail:", error);
                toast.error("Gagal memuat detail produk.");
                setProduct(null);
            } else {
                setProduct(data);
            }
            setLoading(false);
        };

        fetchProductDetail();
    }, [id, companyId]);

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center h-60 gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-[#10182b]" />
                <p className="text-sm text-slate-500 italic">Memuat informasi produk...</p>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="text-center py-20">
                <p className="text-red-500 font-bold">Detail produk tidak ditemukan.</p>
                <Button variant="link" onClick={() => navigate('/settings')}>Kembali</Button>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-4 space-y-6">
            <Button variant="ghost" onClick={() => navigate('/settings')} className="mb-2">
                <ArrowLeft className="h-4 w-4 mr-2" /> Kembali ke Pengaturan
            </Button>

            <Card className="shadow-xl border-none overflow-hidden bg-white">
                {/* Header Section with Image & Basic Info */}
                <div className="flex flex-col md:flex-row bg-[#10182b] text-white p-6 md:p-8 gap-6 md:gap-8 items-center md:items-start">
                    {/* Product Image */}
                    <div className="relative w-40 h-40 md:w-48 md:h-48 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 overflow-hidden flex items-center justify-center shrink-0 shadow-2xl">
                        {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                            <ImageIcon className="h-16 w-16 text-white/20" />
                        )}
                    </div>

                    <div className="flex-1 text-center md:text-left space-y-3">
                        <div className="flex flex-wrap justify-center md:justify-start gap-2">
                            <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 border-none">
                                {product.category?.name || 'Umum'}
                            </Badge>
                            <Badge className={product.is_active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                                {product.is_active ? 'Aktif' : 'Non-aktif'}
                            </Badge>
                        </div>
                        <h1 className="text-3xl font-extrabold tracking-tight">{product.name}</h1>
                        <div className="flex items-center justify-center md:justify-start gap-2 text-slate-300 font-mono text-sm">
                            <Hash className="h-4 w-4" />
                            <span>SKU: {product.sku || 'Belum diatur'}</span>
                        </div>
                    </div>

                    <Button
                        className="bg-white text-[#10182b] hover:bg-slate-100 font-bold"
                        onClick={() => navigate(`/products/edit/${product.id}`)}
                    >
                        <Pencil className="h-4 w-4 mr-2" /> Edit
                    </Button>
                </div>

                <CardContent className="p-6 md:p-8 space-y-8">
                    {/* General Information */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-[#10182b]">
                            <Info className="h-5 w-5" />
                            <h2 className="text-lg font-bold uppercase tracking-wider">Spesifikasi Produk</h2>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-12 bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div className="flex justify-between border-b border-slate-200 pb-2">
                                <span className="text-slate-500 text-sm">Subkategori</span>
                                <span className="font-semibold">{product.subcategory?.name || '-'}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-200 pb-2">
                                <span className="text-slate-500 text-sm">Supplier</span>
                                <span className="font-semibold">{product.supplier?.name || '-'}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-200 pb-2">
                                <span className="text-slate-500 text-sm">Kemasan Returnable</span>
                                <span className="font-semibold">{product.is_returnable ? 'Ya (Wajib Balik)' : 'Tidak'}</span>
                            </div>
                        </div>
                    </section>

                    {/* Stock & Finance */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-[#10182b]">
                            <Package className="h-5 w-5" />
                            <h2 className="text-lg font-bold uppercase tracking-wider">Stok & Inventori</h2>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="p-4 rounded-xl border bg-white shadow-sm space-y-1">
                                <p className="text-xs text-slate-500 uppercase font-bold">Stok Isi</p>
                                <p className="text-2xl font-black text-[#10182b]">{product.stock} <span className="text-sm font-normal text-slate-400">Unit</span></p>
                            </div>
                            <div className="p-4 rounded-xl border bg-white shadow-sm space-y-1">
                                <p className="text-xs text-slate-500 uppercase font-bold">Stok Kosongan</p>
                                <p className="text-2xl font-black text-orange-600">{product.empty_bottle_stock} <span className="text-sm font-normal text-slate-400">Pcs</span></p>
                            </div>
                            <div className="p-4 rounded-xl border bg-blue-50/50 border-blue-100 space-y-1">
                                <p className="text-xs text-blue-600 uppercase font-bold">Harga Beli Pusat</p>
                                <p className="text-xl font-bold text-blue-700">Rp{product.purchase_price ? parseFloat(product.purchase_price).toLocaleString('id-ID') : '-'}</p>
                            </div>
                        </div>
                    </section>

                    {/* Pricing per Status */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-[#10182b]">
                            <DollarSign className="h-5 w-5" />
                            <h2 className="text-lg font-bold uppercase tracking-wider">Skema Harga Jual</h2>
                        </div>
                        <div className="overflow-hidden rounded-xl border shadow-sm">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                                    <tr>
                                        <th className="px-4 py-3">Status Pelanggan</th>
                                        <th className="px-4 py-3 text-right">Harga Jual</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {product.product_prices && product.product_prices.length > 0 ? (
                                        product.product_prices.map(price => (
                                            <tr key={price.id} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="px-4 py-3 font-medium text-slate-700">{price.customer_status}</td>
                                                <td className="px-4 py-3 text-right font-bold text-green-600">
                                                    Rp{price.price ? parseFloat(price.price).toLocaleString('id-ID') : '0'}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="2" className="px-4 py-8 text-center text-slate-400 italic">Belum ada skema harga yang diatur.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </CardContent>
            </Card>
        </div>
    );
};

export default ProductDetailPage;