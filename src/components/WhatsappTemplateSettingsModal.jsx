import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'react-hot-toast';
import { Loader2, Save, MessageSquare, Info, Smartphone, AlertCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const WhatsappTemplateSettingsModal = ({ isOpen, onOpenChange }) => {
  const { companyId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('order_confirmation');
  
  const defaultTexts = {
    order_confirmation: `Assalamualaikum warahmatullahi wabarakatuh.
Yth. Bapak/Ibu {{customerName}},

Dengan hormat, Izin Konfirmasi pemesanan pada tanggal {{orderDate}}
Dengan Rincian:
{{productsListWithPrice}}

Dengan Total: {{totalHarga}}

Mohon kembali memeriksa pesanannya.
Terima kasih.

Hormat kami,
{{companyName}}`,

    payment_reminder: `Assalamualaikum warahmatullahi wabarakatuh.
Yth. Bapak/Ibu {{customerName}},

Dengan hormat, kami sampaikan tagihan untuk pesanan pada tanggal {{orderDate}} dengan rincian berikut:

Invoice No. {{invoiceNo}}
Senilai {{totalHarga}}
Sisa Tagihan: *{{sisaTagihan}}*

Rincian Produk:
{{productsListWithPrice}}

Invoice dapat diunduh pada link berikut: 
{{invoiceLink}}

Mohon segera selesaikan pembayaran Melalui: 
*{{paymentMethod}}*

Wassalamualaikum warahmatullahi wabarakatuh.

Hormat kami,
{{companyName}}`,

    payment_reminder_finance: `Assalamualaikum wr wb Bapak/Ibu {{customerName}}.

Izin mengingatkan untuk tagihan dengan nomor invoice {{invoiceNo}} dan sisa tagihan {{sisaTagihan}}.

Mohon dapat dibayarkan ke nomor rekening berikut:
{{paymentMethod}}

Terima kasih.`,

    nearby_info: `Assalamualaikum warahmatullahi wabarakatuh.
Yth. Bapak/Ibu {{customerName}},

Semoga Bapak/Ibu dalam keadaan sehat. Kami dari {{companyName}} izin menginformasikan bahwa kurir kami sedang berada di sekitar lokasi Bapak/Ibu untuk pengiriman.

Barangkali Bapak/Ibu ingin memesan stok tambahan, kami bisa sekalian kirimkan ke lokasi sekarang juga tanpa biaya kirim tambahan.

Jika berminat, silakan balas pesan ini ya. Terima kasih!

Hormat kami,
{{companyName}}`,

    reminder_message: `Assalamualaikum Warahmatullahi Wabarakatuh, Yth. Bapak/Ibu {{customerName}}.

Semoga Bapak/Ibu senantiasa dalam kondisi baik dan diberi kelancaran dalam segala aktivitasnya.

Izin mengingatkan, jika persediaan Air Minum Dalam Kemasan di rumah/kantor/toko sudah mulai menipis, dengan senang hati kami siap membantu proses pemesanan ulang.

Terima kasih atas kepercayaan Bapak/Ibu selama ini kepada {{companyName}}. 
Jazaakumullahu khayran. 🙏😇`,

    procurement_order: `Pesan Final Order (Nomor Order: #{{orderNo}})

Order Distributor
(Nomor Order: #{{orderNo}})
Tanggal Order: {{orderDate}}

Daftar Barang:
{{itemsListWithPrice}}

Dengan Total Transaksi: {{totalHarga}}

Terima kasih.`
  };

  const [templates, setTemplates] = useState({ ...defaultTexts });

  const categories = [
    { 
      id: 'order_confirmation', 
      label: 'Konfirmasi', 
      desc: 'Digunakan di halaman Pesanan/Draft.', 
      vars: '{{customerName}}, {{orderDate}}, {{productsListWithPrice}}, {{totalHarga}}, {{companyName}}' 
    },
    { 
      id: 'payment_reminder', 
      label: 'Kirim Invoice', 
      desc: 'Digunakan untuk kirim invoice lengkap.', 
      vars: '{{customerName}}, {{orderDate}}, {{invoiceNo}}, {{totalHarga}}, {{sisaTagihan}}, {{productsListWithPrice}}, {{invoiceLink}}, {{paymentMethod}}, {{companyName}}' 
    },
    { 
      id: 'payment_reminder_finance', 
      label: 'Tagihan', 
      desc: 'Reminder singkat di halaman Keuangan.', 
      vars: '{{customerName}}, {{invoiceNo}}, {{sisaTagihan}}, {{paymentMethod}}' 
    },
    { 
      id: 'nearby_info', 
      label: 'Tetangga', 
      desc: 'Info petugas di lokasi sekitar.', 
      vars: '{{customerName}}, {{companyName}}' 
    },
    { 
      id: 'reminder_message', 
      label: 'Restock', 
      desc: 'Pengingat repeat order (CRM).', 
      vars: '{{customerName}}, {{companyName}}' 
    },
    { 
      id: 'procurement_order', 
      label: 'Procurement', 
      desc: 'Pesanan ke Supplier (Pusat).', 
      vars: '{{orderNo}}, {{orderDate}}, {{itemsListWithPrice}}, {{totalHarga}}, {{companyName}}' 
    }
  ];

  // ... (fungsi fetchAllTemplates dan handleSave tetap sama)
  useEffect(() => {
    if (isOpen && companyId) fetchAllTemplates();
  }, [isOpen, companyId]);

  const fetchAllTemplates = async () => {
    setLoading(true);
    const { data } = await supabase.from('whatsapp_templates').select('template_name, template_text').eq('company_id', companyId);
    
    if (data && data.length > 0) {
      const tempMap = { ...defaultTexts };
      data.forEach(t => { if (t.template_text) tempMap[t.template_name] = t.template_text; });
      setTemplates(tempMap);
    }
    setLoading(false);
  };

  const handleSave = async (category) => {
    setSaving(true);
    try {
      const { error } = await supabase.from('whatsapp_templates').upsert({
        company_id: companyId,
        template_name: category,
        template_text: templates[category]
      }, { onConflict: 'company_id, template_name' });
      if (error) throw error;
      toast.success('Template ' + category + ' berhasil disimpan!');
    } catch (e) {
      toast.error('Gagal menyimpan template.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl w-[95vw] p-4 md:p-6 overflow-hidden max-h-[95vh] flex flex-col">
        <DialogHeader className="mb-2">
          <DialogTitle className="flex items-center gap-2 text-lg md:text-xl">
            <MessageSquare className="h-5 w-5 text-green-600" />
            Pengaturan Template WhatsApp
          </DialogTitle>
          <DialogDescription className="text-xs md:text-sm text-slate-500">
            Sesuaikan pesan otomatis untuk tiap halaman aplikasi.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col justify-center items-center py-20 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <p className="text-xs text-gray-500 animate-pulse">Memuat template...</p>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid grid-cols-3 md:grid-cols-6 h-auto bg-gray-100 p-1 mb-4">
              {categories.map(cat => (
                <TabsTrigger key={cat.id} value={cat.id} className="text-[9px] md:text-xs py-2 px-1 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  {cat.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <ScrollArea className="flex-1 pr-3">
              {categories.map(cat => (
                <TabsContent key={cat.id} value={cat.id} className="mt-0 space-y-4 pb-4">
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <p className="text-[11px] md:text-xs text-blue-700 font-semibold flex items-center gap-1.5 mb-2">
                      <Info className="h-3.5 w-3.5" /> {cat.desc}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {cat.vars.split(', ').map(v => (
                        <span key={v} className="text-[9px] md:text-[10px] bg-white text-blue-600 px-1.5 py-0.5 rounded font-mono border border-blue-200 shadow-sm">
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="relative group">
                    <Textarea 
                      value={templates[cat.id]} 
                      onChange={(e) => setTemplates({ ...templates, [cat.id]: e.target.value })}
                      placeholder="Ketik template pesan di sini..."
                      className="min-h-[300px] md:min-h-[350px] font-mono text-[12px] md:text-sm leading-relaxed p-4 bg-slate-50 focus:bg-white transition-all border-slate-200 shadow-inner"
                    />
                    <div className="absolute top-4 right-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                       <Smartphone className="h-20 w-20" />
                    </div>
                  </div>

                  <Button 
                    onClick={() => handleSave(cat.id)} 
                    disabled={saving} 
                    className="w-full bg-[#10182b] hover:bg-slate-800 text-white flex h-11 transition-all"
                  >
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Simpan Template {cat.label}
                  </Button>
                </TabsContent>
              ))}
            </ScrollArea>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WhatsappTemplateSettingsModal;