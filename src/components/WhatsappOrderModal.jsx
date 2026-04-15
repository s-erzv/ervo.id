import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import { Send, CheckCircle2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Card } from './ui/card';
import { Separator } from './ui/separator';

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount ?? 0);
};

// Tambahkan props: activeTemplates dan sendViaFonnte
const WhatsappOrderModal = ({ 
  isOpen, 
  onOpenChange, 
  orderId, 
  orderDate, 
  orderItems, 
  products, 
  suppliers, 
  companyName,
  activeTemplates, // Prop baru
  sendViaFonnte    // Prop baru
}) => {
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [customPhoneNumber, setCustomPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false); // State loading baru

  const selectedSupplierData = useMemo(() => {
    if (selectedSupplier === 'custom') {
      return { name: 'Pusat/Lainnya', phone: customPhoneNumber };
    }
    return suppliers.find(s => s.id === selectedSupplier);
  }, [selectedSupplier, suppliers, customPhoneNumber]);

  const filteredOrderItems = useMemo(() => {
    if (!selectedSupplier || selectedSupplier === 'custom') {
      return orderItems;
    }
    return orderItems.filter(item => {
      const product = products.find(p => p.id === item.product_id);
      return product?.supplier_id === selectedSupplier;
    });
  }, [selectedSupplier, orderItems, products]);

  const totalTransaction = useMemo(() => {
      return filteredOrderItems.reduce((sum, item) => {
          return sum + ((item.qty || 0) * (item.price || 0));
      }, 0);
  }, [filteredOrderItems]);

  const handleSendMessage = async () => {
    if (!selectedSupplierData?.phone) return toast.error("Pilih supplier atau isi nomor telepon!");

    setLoading(true);
    const tid = toast.loading("Mengirim pesanan...");

    try {
        // 1. Susun daftar barang dengan rincian HARGA per item (Sesuai contoh data yang diminta)
        // Format: - Nama Produk: Qty x Rp Harga
        const itemsListWithPrice = filteredOrderItems.map(i => {
            const product = products.find(p => p.id === i.product_id);
            const prodName = product?.name || 'Produk';
            const price = i.price || 0;
            return `- ${prodName}: ${i.qty} x ${formatCurrency(price)}`;
        }).join('\n');

        // 2. Ambil template Procurement
        const template = activeTemplates?.procurement_order || "";
        if (!template) throw new Error("Template Procurement belum diatur.");

        // 3. Mapping Variabel Baru
        const finalMessage = template
            .replace(/{{supplierName}}/g, selectedSupplierData.name || 'Supplier')
            .replace(/{{orderNo}}/g, orderId?.slice(0, 8) || '-')
            .replace(/{{orderDate}}/g, orderDate ? format(new Date(orderDate), 'eeee, d MMMM yyyy', { locale: id }) : '-')
            .replace(/{{itemsListWithPrice}}/g, itemsListWithPrice)
            .replace(/{{itemsList}}/g, itemsListWithPrice) // Fallback var lama
            .replace(/{{totalHarga}}/g, formatCurrency(totalTransaction))
            .replace(/{{companyName}}/g, companyName || 'Toko Kami');

        const targetPhone = selectedSupplierData.phone;

        // 4. Eksekusi Kirim
        let isSuccess = false;
        if (sendViaFonnte) {
            isSuccess = await sendViaFonnte(targetPhone, finalMessage);
        }

        if (isSuccess) {
            toast.success("Pesan Terkirim Otomatis!", { id: tid });
            onOpenChange(false);
        } else {
            toast.dismiss(tid);
            const cleanPhone = targetPhone.replace(/[^\d]/g, '');
            window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(finalMessage)}`, '_blank');
            toast.success("Membuka WhatsApp...");
        }
    } catch (err) {
        toast.error("Gagal: " + err.message, { id: tid });
    } finally {
        setLoading(false);
    }
  };

  const isFormValid = !!selectedSupplierData?.phone || (selectedSupplier === 'custom' && customPhoneNumber);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kirim Pesan ke Supplier</DialogTitle>
          <DialogDescription>
            Pilih supplier untuk mengirimkan detail pesanan secara otomatis.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="supplier-select">Pilih Supplier</Label>
            <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
              <SelectTrigger id="supplier-select">
                <SelectValue placeholder="Pilih Supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map(supplier => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name} ({supplier.phone})
                  </SelectItem>
                ))}
                <SelectItem value="custom">Nomor Telepon Lainnya</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedSupplier === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="custom-phone">Nomor Telepon</Label>
              <Input
                id="custom-phone"
                type="tel"
                placeholder="Contoh: 62812..."
                value={customPhoneNumber}
                onChange={(e) => setCustomPhoneNumber(e.target.value)}
              />
            </div>
          )}

          {selectedSupplier && filteredOrderItems.length > 0 && (
            <Card className="p-4 bg-gray-50 border-dashed">
              <Label className="text-xs text-gray-500 uppercase font-bold mb-2 block">Ringkasan Pesanan:</Label>
              <ul className="space-y-1 text-sm">
                {filteredOrderItems.map((item, idx) => {
                  const product = products.find(p => p.id === item.product_id);
                  return (
                      <li key={idx} className="flex justify-between">
                          <span>{product?.name || 'Produk'}</span>
                          <span className="font-semibold">{item.qty} pcs</span>
                      </li>
                  );
                })}
                <Separator className="my-2" />
                <li className="flex justify-between font-bold text-[#011e4b]">
                  <span>Total Estimasi</span>
                  <span>{formatCurrency(totalTransaction)}</span>
                </li>
              </ul>
            </Card>
          )}
        </div>
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button
            className="w-full bg-black hover:bg-gray-900 text-white"
            onClick={() => handleSendMessage(true)}
            disabled={!isFormValid || filteredOrderItems.length === 0 || loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Kirim Pesan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WhatsappOrderModal;