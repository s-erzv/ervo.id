// src/components/AddDropshipperModal.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import { Loader2, Save, UserCircle, Percent, CreditCard, Package, Mail, Phone, Lock, ChevronRight } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils'; 
import { Badge } from './ui/badge';

const AddDropshipperModal = ({ isOpen, onOpenChange, companyId, onSuccess }) => {
  const [statuses, setStatuses] = useState([]);
  const [products, setProducts] = useState([]);
  const [commissions, setCommissions] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    fullName: '', email: '', password: '', phone: '', rekening: ''
  });

  useEffect(() => {
    if (isOpen && companyId) {
      fetchInitialData();
    }
  }, [isOpen, companyId]);

  const fetchInitialData = async () => {
    try {
      const [resStatuses, resProducts] = await Promise.all([
        supabase.from('customer_statuses').select('status_name').eq('company_id', companyId).order('sort_order', { ascending: true }),
        supabase.from('products').select('id, name').eq('company_id', companyId).eq('is_active', true).order('name', { ascending: true })
      ]);

      setStatuses(resStatuses.data || []);
      setProducts(resProducts.data || []);
      
      const matrix = {};
      resStatuses.data?.forEach(s => {
        matrix[s.status_name] = {};
        resProducts.data?.forEach(p => {
          matrix[s.status_name][p.id] = { value: 0, type: 'percentage' };
        });
      });
      setCommissions(matrix);
    } catch (error) {
      console.error(error);
    }
  };

  const handleCommissionChange = (status, prodId, field, value) => {
    setCommissions(prev => ({
      ...prev,
      [status]: {
        ...prev[status],
        [prodId]: { ...prev[status][prodId], [field]: value }
      }
    }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fullName || !formData.email || !formData.password) {
        return toast.error("Mohon lengkapi data login Dropshipper");
    }
    
    setIsSaving(true);
    try {
      const { data: authSession } = await supabase.auth.getSession();
      const response = await fetch('https://wzmgcainyratlwxttdau.supabase.co/functions/v1/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession.session?.access_token}`
        },
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
          role: 'dropship',
          companyId: companyId
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal mendaftarkan Dropshipper');
      const newUserId = result.userId;

      await supabase.from('profiles').update({ rekening: formData.rekening }).eq('id', newUserId);

      const settingsToInsert = [];
      Object.entries(commissions).forEach(([status, prodMap]) => {
        Object.entries(prodMap).forEach(([prodId, config]) => {
          if (parseFloat(config.value) > 0) {
            settingsToInsert.push({
              company_id: companyId,
              dropshipper_id: newUserId,
              customer_status: status,
              product_id: prodId,
              commission_value: parseFloat(config.value),
              commission_type: config.type
            });
          }
        });
      });

      if (settingsToInsert.length > 0) {
        const { error } = await supabase.from('dropshipper_settings').insert(settingsToInsert);
        if (error) throw error;
      }

      toast.success("Dropshipper & Matrix Komisi berhasil dikonfigurasi!");
      onOpenChange(false);
      if (onSuccess) onSuccess(newUserId);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl w-[95vw] h-[95vh] sm:h-[90vh] flex flex-col p-0 gap-0 overflow-hidden border-none shadow-2xl rounded-t-2xl sm:rounded-2xl">
        <DialogHeader className="p-4 sm:p-6 bg-[#10182b] text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg hidden sm:block">
                <UserCircle className="h-6 w-6 text-blue-400" />
            </div>
            <div className="min-w-0">
                <DialogTitle className="text-lg sm:text-xl font-bold truncate">Pendaftaran Dropshipper Baru</DialogTitle>
                <DialogDescription className="text-slate-400 text-xs sm:text-sm truncate">
                    Akun akses dan konfigurasi komisi spesifik produk.
                </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleFormSubmit} className="flex-1 overflow-hidden flex flex-col bg-white">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
            
            {/* SECTION 1: IDENTITY */}
            <div className="space-y-4">
                <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" /> Informasi Dasar
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                    <div className="space-y-1.5">
                        <Label className="text-[10px] sm:text-xs font-semibold text-slate-600">Nama Lengkap</Label>
                        <div className="relative">
                            <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="pl-9 h-10 bg-slate-50 border-slate-200 focus:bg-white text-sm" placeholder="Nama Dropshipper" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[10px] sm:text-xs font-semibold text-slate-600">WhatsApp</Label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="pl-9 h-10 bg-slate-50 border-slate-200 text-sm" placeholder="08..." />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[10px] sm:text-xs font-semibold text-slate-600">Email Login</Label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="pl-9 h-10 bg-slate-50 border-slate-200 text-sm" placeholder="email@toko.com" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[10px] sm:text-xs font-semibold text-slate-600">Password Akses</Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="pl-9 h-10 bg-slate-50 border-slate-200 text-sm" placeholder="Min. 6 Karakter" />
                        </div>
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                        <Label className="text-[10px] sm:text-xs font-semibold text-slate-600">Info Rekening</Label>
                        <div className="relative">
                            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input value={formData.rekening} onChange={e => setFormData({...formData, rekening: e.target.value})} className="pl-9 h-10 bg-slate-50 border-slate-200 text-sm" placeholder="Contoh: BCA 123... a/n Nama" />
                        </div>
                    </div>
                </div>
            </div>

            <Separator className="bg-slate-100" />

            {/* SECTION 2: COMMISSION MATRIX */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                        <Package className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" /> Matrix Komisi
                    </h4>
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] sm:text-xs">
                        {products.length} Produk
                    </Badge>
                </div>
                
                <Tabs defaultValue={statuses[0]?.status_name} className="w-full border rounded-xl overflow-hidden bg-white shadow-sm">
                    <div className="w-full overflow-x-auto bg-slate-50 border-b scrollbar-hide">
                        <TabsList className="flex w-max justify-start rounded-none h-11 bg-transparent p-0">
                            {statuses.map(s => (
                            <TabsTrigger 
                                key={s.status_name} 
                                value={s.status_name} 
                                className="h-full rounded-none px-4 sm:px-6 text-[10px] sm:text-xs font-bold uppercase data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 transition-all whitespace-nowrap"
                            >
                                {s.status_name}
                            </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>

                    {statuses.map(s => (
                    <TabsContent key={s.status_name} value={s.status_name} className="m-0 animate-in fade-in-50 duration-500">
                        <div className="grid grid-cols-1 lg:grid-cols-2 p-2 sm:p-4 gap-3 sm:gap-4 bg-slate-50/50">
                            {products.map(p => {
                                const currentComm = commissions[s.status_name]?.[p.id];
                                const isNominal = currentComm?.type === 'nominal';
                                
                                return (
                                <div key={p.id} className="group bg-white border border-slate-200 p-3 sm:p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-blue-400 transition-all">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs sm:text-sm font-bold text-slate-700 truncate group-hover:text-blue-700 transition-colors">
                                            {p.name}
                                        </p>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 shrink-0">
                                        <div className="flex bg-slate-100 p-0.5 sm:p-1 rounded-lg border border-slate-200">
                                            <button 
                                                type="button" 
                                                onClick={() => handleCommissionChange(s.status_name, p.id, 'type', 'percentage')} 
                                                className={cn(
                                                    "px-2 py-1 text-[10px] font-bold rounded-md transition-all",
                                                    !isNominal ? "bg-blue-600 text-white shadow-sm" : "text-slate-400"
                                                )}
                                            > % </button>
                                            <button 
                                                type="button" 
                                                onClick={() => handleCommissionChange(s.status_name, p.id, 'type', 'nominal')} 
                                                className={cn(
                                                    "px-2 py-1 text-[10px] font-bold rounded-md transition-all",
                                                    isNominal ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400"
                                                )}
                                            > Rp </button>
                                        </div>
                                        
                                        <div className="relative w-28 sm:w-32">
                                            <Input 
                                                type="number" 
                                                className={cn(
                                                    "h-9 text-right font-bold text-xs sm:text-sm pr-7 rounded-lg bg-white",
                                                    isNominal ? "border-emerald-200 focus:border-emerald-500" : "border-blue-200 focus:border-blue-500"
                                                )}
                                                placeholder="0"
                                                value={currentComm?.value || ''} 
                                                onChange={e => handleCommissionChange(s.status_name, p.id, 'value', e.target.value)}
                                            />
                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] sm:text-[11px] text-slate-400 font-bold pointer-events-none">
                                                {isNominal ? '' : '%'}
                                            </span>
                                            {isNominal && (
                                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[9px] sm:text-[10px] text-slate-300 font-bold pointer-events-none">Rp</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    </TabsContent>
                    ))}
                </Tabs>
            </div>
          </div>

          <DialogFooter className="p-4 sm:p-6 bg-slate-50 border-t flex flex-row justify-end gap-2 shrink-0">
            <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="flex-1 sm:flex-none rounded-xl h-10 sm:h-11 px-4 sm:px-6 border-slate-300 text-slate-600 font-bold text-xs sm:text-sm"
            >
                Batal
            </Button>
            <Button 
                onClick={handleFormSubmit} 
                disabled={isSaving} 
                className="flex-[2] sm:flex-none bg-[#10182b] text-white rounded-xl h-10 sm:h-11 px-6 sm:px-8 font-bold text-xs sm:text-sm shadow-lg shadow-slate-200"
            >
              {isSaving ? (
                <Loader2 className="animate-spin h-4 w-4" />
              ) : (
                <>
                    <Save className="h-4 w-4 mr-2 hidden sm:block" />
                    Simpan
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddDropshipperModal;