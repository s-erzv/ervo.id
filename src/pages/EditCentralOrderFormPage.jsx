import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'react-hot-toast';
import { Loader2, Plus, Trash2, FileIcon, DollarSign, Wallet, Package, ArrowLeft, MessageSquareText, Pencil, ChevronsUpDown, Settings } from 'lucide-react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import WhatsappOrderModal from '@/components/WhatsappOrderModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils'; 
import CryptoJS from 'crypto-js'; // Tambahkan ini di deretan import
import WhatsappTemplateSettingsModal from '@/components/WhatsappTemplateSettingsModal';

const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'fallback-key-proyek-rahasia';

 const MAX_FILE_SIZE = 1 * 1024 * 1024; 
  const TARGET_SIZE_MB = 0.5; 

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
  

const EditCentralOrderFormPage = () => { // NAMA KOMPONEN DIUBAH
  const { id } = useParams(); // ID SELALU ADA
  const navigate = useNavigate();
  const { userProfile, loading: authLoading, companyId, session, companyName } = useAuth();
  
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState([]); // Tetap dibutuhkan untuk Whatsapp Modal
  
  // Tab 1 State
  const [orderDate, setOrderDate] = useState(''); // Tidak bisa default date, harus dari fetch
  const [orderItems, setOrderItems] = useState([]);
  const [activeTab, setActiveTab] = useState('order-items');

  // STATES UNTUK ROLLBACK LOGIC
  const [orderStatus, setOrderStatus] = useState('draft'); 
  const [isEditConfirmationModalOpen, setIsEditConfirmationModalOpen] = useState(false);

  // States baru untuk popover produk
  const [isProductPopoverOpen, setIsProductPopoverOpen] = useState({});

  // Di dalam komponen, tambahkan state ini
  const [processingWA, setProcessingWA] = useState(false);
  const [activeTemplates, setActiveTemplates] = useState({});
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  

  // Tab 2 State
  const [transactionDetails, setTransactionDetails] = useState({
    driver_tip: '',
    notes: '',
    attachments: [],
    admin_fee: '',
  });
  const [uploading, setUploading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [newPayment, setNewPayment] = useState({
    amount: '',
    payment_method_id: '',
    proof: null,
  });
  const [payments, setPayments] = useState([]);
  const [isWhatsappModalOpen, setIsWhatsappModalOpen] = useState(false);

  // States untuk edit pembayaran
  const [isEditPaymentModalOpen, setIsEditPaymentModalOpen] = useState(false);
  const [paymentToEdit, setPaymentToEdit] = useState(null);
  const [editPaymentForm, setEditPaymentForm] = useState({
      amount: '',
      payment_method_id: '',
  });

  // Tab 3 State
  const [deliveryDetails, setDeliveryDetails] = useState({
    arrival_date: '',
    central_note_number: '',
    delivery_notes_url: [],
  });

  const [gallonDetails, setGallonDetails] = useState({});
  const [receivedItems, setReceivedItems] = useState([]);
  
  const totalItemsValue = useMemo(() => {
    return orderItems.reduce((sum, item) => {
      const qty = parseFloat(item.qty) || 0;
      const price = parseFloat(item.price) || 0;
      return sum + (qty * price);
    }, 0);
  }, [orderItems]);

  const totalOrderValue = useMemo(() => {
    // Memastikan gallonDetails diisi dengan aman, karena mungkin ada produk yang dihapus
    const totalGalonPrice = orderItems.reduce((sum, item) => {
        const galon = gallonDetails[item.product_id];
        if (galon) {
            const soldEmptyQty = parseFloat(galon.sold_empty_to_central) || 0;
            const soldEmptyPrice = parseFloat(galon.sold_empty_price) || 0;
            return sum + (soldEmptyQty * soldEmptyPrice);
        }
        return sum;
    }, 0);
    const adminFee = parseFloat(transactionDetails.admin_fee) || 0;
    const driverTip = parseFloat(transactionDetails.driver_tip) || 0;
    return totalItemsValue + totalGalonPrice + adminFee + driverTip;
  }, [totalItemsValue, gallonDetails, transactionDetails.admin_fee, transactionDetails.driver_tip, orderItems]);

  const totalPaid = useMemo(() => {
    return payments.reduce((sum, p) => sum + p.amount, 0);
  }, [payments]);

  const remainingDue = useMemo(() => {
    return totalOrderValue - totalPaid;
  }, [totalOrderValue, totalPaid]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };
  const handleInputWheel = (e) => {
    e.target.blur();
  };

  const fetchActiveTemplates = async () => {
      const { data } = await supabase
        .from('whatsapp_templates')
        .select('template_name, template_text')
        .eq('company_id', companyId);
      
      if (data) {
        const map = {};
        data.forEach(t => { map[t.template_name] = t.template_text; });
        setActiveTemplates(map);
      }
  };

  const sendViaFonnte = async (targetPhone, message) => {
    try {
        const { data: companyData } = await supabase
            .from('companies')
            .select('fonnte_token')
            .eq('id', companyId)
            .single();

        const encryptedToken = companyData?.fonnte_token;
        if (!encryptedToken) return false;

        let finalToken = null;
        try {
            const bytes = CryptoJS.AES.decrypt(encryptedToken, ENCRYPTION_KEY);
            const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
            finalToken = decryptedText || encryptedToken;
        } catch (e) {
            finalToken = encryptedToken;
        }

        if (!finalToken || finalToken.trim() === "") return false;

        const response = await fetch('https://api.fonnte.com/send', {
            method: 'POST',
            headers: { 'Authorization': finalToken },
            body: new URLSearchParams({
                'target': targetPhone.replace(/[^\d]/g, ''),
                'message': message,
                'countryCode': '62'
            })
        });

        const result = await response.json();
        return result.status === true;
    } catch (err) {
        console.error("Fonnte Error:", err);
        return false;
    }
};

  useEffect(() => {
      if (companyId) fetchActiveTemplates();
  }, [companyId]);
  
  useEffect(() => {
    if (!authLoading && companyId && id) { // Order ID harus ada
      fetchData();
    } else if (!authLoading && !id) {
        // Jika tidak ada ID, navigasi kembali (karena ini halaman edit)
        toast.error('ID Pesanan tidak ditemukan.');
        navigate('/central-orders');
    }
  }, [authLoading, companyId, id]);

  useEffect(() => {
    if (activeTab === 'attachments-expenses') {
      if (remainingDue > 0) {
        setNewPayment(prev => ({ ...prev, amount: remainingDue.toString() }));
      } else {
        setNewPayment(prev => ({ ...prev, amount: '' }));
      }
    }
  }, [activeTab, remainingDue]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchSuppliers(),
      fetchPaymentMethods(),
      fetchProductsAndPrices()
    ]);
    await fetchCentralOrder(id);
  };
  
  const fetchSuppliers = async () => {
    if (!companyId) return;
    const { data, error } = await supabase
        .from('suppliers')
        .select('id, name, phone')
        .eq('company_id', companyId);
    if (!error) {
        setSuppliers(data);
    }
  };
  // --- CONSTANT: BATAS MAKSIMUM FILE (1 MB) ---
 

  
  const fetchProductsAndPrices = async () => {
    if (!companyId) return;

    let query = supabase.from('products').select('id, name, stock, empty_bottle_stock, purchase_price, is_returnable, empty_bottle_price, sort_order, supplier_id').eq('company_id', companyId);
    query = query.order('sort_order', { ascending: true }).order('name', { ascending: true });

    const { data: productsData, error: productsError } = await query;
    
    if (productsError) {
      console.error('Error fetching products:', productsError);
      toast.error('Gagal memuat daftar produk.');
      return;
    }
    setProducts(productsData);
  };
  
  const fetchPaymentMethods = async () => {
    if (!companyId) return;
    const { data, error } = await supabase
      .from('payment_methods')
      .select('id, method_name, account_name')
      .eq('company_id', companyId);
    if (!error) {
      setPaymentMethods(data);
    }
  };

  const fetchCentralOrder = async (orderId) => {
    if (!companyId) return;

    const { data: orderData, error: orderError } = await supabase
      .from('central_orders')
      .select(`
        *,
        items:central_order_items (product_id, qty, price, received_qty, sold_empty_price, products(id, name, stock, empty_bottle_stock, purchase_price, is_returnable, empty_bottle_price, supplier_id))
      `)
      .eq('id', orderId)
      .eq('company_id', companyId)
      .single();
    
    if (orderError) {
      console.error('Error fetching central order:', orderError);
      toast.error('Gagal memuat detail pesanan.');
      setLoading(false);
      return;
    }
    
    // Fetch products again to ensure we have the latest list (redundant if fetchProductsAndPrices ran, but safer)
    const { data: productsData } = await supabase
      .from('products')
      .select('id, name, stock, empty_bottle_stock, purchase_price, is_returnable, empty_bottle_price, sort_order, supplier_id')
      .eq('company_id', companyId);
    setProducts(productsData || []);
    
    const { data: paymentsData } = await supabase
      .from('financial_transactions')
      .select('*, payment_method:payment_method_id(method_name, account_name)')
      .eq('source_table', 'central_orders')
      .eq('source_id', orderId)
      .eq('type', 'expense');

    setPayments(paymentsData || []);
    
    setOrderStatus(orderData.status); 
    setOrderDate(orderData.order_date);
    
    const processedOrderItems = orderData.items.map(item => {
      const product = productsData?.find(p => p.id === item.product_id) || {};
      return {
        ...item,
        product_name: product.name,
        is_returnable: product.is_returnable,
        qty: item.qty || '',
        price: item.price || '',
        sold_empty_price: item.sold_empty_price || '',
      };
    });
    setOrderItems(processedOrderItems);
    
    // LOGIKA RESET STATE PENERIMAAN (ROLLBACK)
    const isOrderDraftAfterRollback = orderData.status === 'draft';
    
    setReceivedItems(processedOrderItems.map(item => {
      // Jika draft (setelah rollback), received_qty harus di-reset ke string kosong
      const initialReceivedQty = isOrderDraftAfterRollback ? '' : (item.received_qty || '');
      return {
        product_id: item.product_id,
        product_name: item.product_name,
        ordered_qty: item.qty,
        received_qty: initialReceivedQty, 
      };
    }));
    
    setGallonDetails(processedOrderItems.reduce((acc, item) => {
      if (item.is_returnable) {
        acc[item.product_id] = isOrderDraftAfterRollback ? {
            returned_to_central: '',
            borrowed_from_central: '',
            sold_empty_to_central: '',
            sold_empty_price: item.sold_empty_price || '',
        } : {
            returned_to_central: orderData.returned_to_central?.[item.product_id] || '',
            borrowed_from_central: orderData.borrowed_from_central?.[item.product_id] || '',
            sold_empty_to_central: orderData.sold_empty_to_central?.[item.product_id] || '',
            sold_empty_price: item.sold_empty_price || '', 
        };
      }
      return acc;
    }, {}));

    // RESET deliveryDetails
    if (isOrderDraftAfterRollback) {
        setDeliveryDetails({
            arrival_date: '',
            central_note_number: '',
            // attachments (surat jalan) tidak di-reset total karena file mungkin masih relevan
            delivery_notes_url: orderData.attachments?.filter(a => a.file_type === 'delivery_note').map(a => a.file_url) || [],
        });
    } else {
        setDeliveryDetails({
            arrival_date: orderData.arrival_date || '',
            central_note_number: orderData.central_note_number || '',
            delivery_notes_url: orderData.attachments?.filter(a => a.file_type === 'delivery_note').map(a => a.file_url) || [],
        });
    }
    
    setTransactionDetails({
      driver_tip: orderData.driver_tip || '',
      notes: orderData.notes || '',
      attachments: orderData.attachments || [],
      admin_fee: orderData.admin_fee || '',
    });

    setLoading(false);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...orderItems];
    newItems[index][field] = value;
    
    if (field === 'product_id') {
        const selectedProduct = products.find(p => p.id === value);
        if (selectedProduct) {
            newItems[index].price = selectedProduct.purchase_price; 
            newItems[index].is_returnable = selectedProduct.is_returnable;
            newItems[index].sold_empty_price = selectedProduct.empty_bottle_price;
            if (selectedProduct.is_returnable) {
                setGallonDetails(prev => ({
                    ...prev,
                    [value]: {
                        returned_to_central: prev[value]?.returned_to_central || '',
                        borrowed_from_central: prev[value]?.borrowed_from_central || '',
                        sold_empty_to_central: prev[value]?.sold_empty_to_central || '',
                        sold_empty_price: selectedProduct.empty_bottle_price,
                    }
                }));
            }
        } else {
            newItems[index].is_returnable = false;
            newItems[index].sold_empty_price = 0;
        }
    }
    
    setOrderItems(newItems);
  };

  const handleAddItem = () => {
    setOrderItems([...orderItems, { product_id: '', qty: '', price: '', is_returnable: false }]);
  };

  const handleRemoveItem = (index) => {
    const newItems = orderItems.filter((_, i) => i !== index);
    setOrderItems(newItems);
  };

  /**
   * Mengupdate order yang sudah ada menggunakan Edge Function (PUT method).
   * Termasuk logic konfirmasi rollback.
   */
  const handleUpdateExistingOrder = async (confirmed = false) => {
      // 1. Tampilkan modal konfirmasi jika status received
      if (orderStatus === 'received' && !confirmed) {
          setIsEditConfirmationModalOpen(true);
          return;
      }
      
      // Validasi input di Tab 1 (diperlukan setelah rollback)
      const invalidItems = orderItems.filter(item => !item.product_id || !item.qty || parseFloat(item.qty) <= 0);
      if (invalidItems.length > 0) {
          toast.error('Pastikan semua produk dipilih dan kuantitas pesanan diisi dengan benar.');
          setLoading(false);
          return;
      }
      
      setLoading(true); // Mulai loading saat akan PUT

      try {
          const payload = {
              orderId: id,
              newItems: orderItems.map(item => ({
                  product_id: item.product_id,
                  qty: parseFloat(item.qty) || 0,
                  price: parseFloat(item.price) || 0,
                  sold_empty_price: parseFloat(item.sold_empty_price) || 0,
              })),
              order: {
                  order_date: orderDate,
                  notes: transactionDetails.notes,
                  total_transaction: totalOrderValue,
                  driver_tip: parseFloat(transactionDetails.driver_tip) || null,
                  admin_fee: parseFloat(transactionDetails.admin_fee) || null,
              },
              companyId: userProfile.company_id,
          };
          
          const response = await fetch('https://wzmgcainyratlwxttdau.supabase.co/functions/v1/manage-central-order-galons', {
              method: 'PUT',
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify(payload),
          });

          if (!response.ok) {
              const errorText = await response.text();
              throw new Error(errorText || 'Gagal memperbarui pesanan.');
          }
          
          const responseData = await response.json();
          
          toast.success(responseData.message);
          setIsEditConfirmationModalOpen(false); 
          
          // Update prices
          const { error: pricesError } = await supabase
            .from('central_order_prices')
            .upsert(orderItems.map(item => ({
              product_id: item.product_id,
              price: parseFloat(item.price) || 0,
              order_date: orderDate,
              company_id: userProfile.company_id,
            })));
          if (pricesError) throw pricesError;

          // RELOAD DATA DAN PINDAH TAB
          await fetchCentralOrder(id); 
          // Paksa kembali ke Tab 1 setelah rollback
          setActiveTab('order-items'); 
          
      } catch (error) {
          console.error('Error updating order:', error);
          toast.error('Gagal menyimpan pesanan: ' + error.message);
      } finally {
          setLoading(false);
      }
  };


  const handleSaveOrder = async () => {
    // Karena ini adalah halaman edit, kita langsung panggil update.
    if (!id) {
        toast.error('ID Pesanan tidak valid untuk disimpan.');
        return;
    }
    await handleUpdateExistingOrder();
  };

  const handleFileUpload = async (e, type) => {
      const files = e.target.files;
      if (files.length === 0 || !id) {
        if (!id) toast.error('Harap simpan pesanan terlebih dahulu.');
        return;
      }

      setUploading(true);
      const newAttachments = [...transactionDetails.attachments];
      const uploadPromises = [];

      for (let i = 0; i < files.length; i++) {
        let file = files[i];

        // LOGIKA KOMPRESI BARU
        if (file.type.startsWith('image/') && file.size > MAX_FILE_SIZE) {
          toast.loading(`Kompresi file ${file.name}...`, { id: 'compressing' });
          try {
            file = await compressImage(file, TARGET_SIZE_MB);
            toast.success('Kompresi berhasil', { id: 'compressing' });
          } catch (err) {
            toast.error('Gagal kompresi, mengunggah file asli', { id: 'compressing' });
          }
        }

        const fileExt = file.name.split('.').pop();
        const filePath = `${userProfile.company_id}/${id}/${type}_${Date.now()}_${i}.${fileExt}`;

        uploadPromises.push(
          supabase.storage
            .from('proofs')
            .upload(filePath, file)
            .then(({ data, error }) => {
              if (error) {
                console.error('Error uploading file:', error);
                return null;
              }
              const { data: publicUrlData } = supabase.storage
                .from('proofs')
                .getPublicUrl(filePath);
              return { file_type: type, file_url: publicUrlData.publicUrl };
            })
        );
      }

      try {
        const uploadedFiles = await Promise.all(uploadPromises);
        const validUploads = uploadedFiles.filter(Boolean);
        const updatedAttachments = [...newAttachments, ...validUploads];

        const { error: dbError } = await supabase
          .from('central_orders')
          .update({ attachments: updatedAttachments })
          .eq('id', id);

        if (dbError) throw dbError;

        setTransactionDetails(prev => ({ ...prev, attachments: updatedAttachments }));
        toast.success('File berhasil diunggah!');
      } catch (error) {
        console.error('Error in file upload process:', error);
        toast.error('Gagal mengunggah file.');
      } finally {
        setUploading(false);
      }
    };
  
  const handleUpdateTransaction = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('central_orders')
        .update({
          total_transaction: totalOrderValue,
          driver_tip: parseFloat(transactionDetails.driver_tip) || null,
          notes: transactionDetails.notes || '',
          admin_fee: parseFloat(transactionDetails.admin_fee) || null,
        })
        .eq('id', id);
      if (error) throw error;
      toast.success('Detail transaksi berhasil diperbarui.');
      fetchCentralOrder(id); 
    } catch (error) {
      console.error('Error updating transaction details:', error);
      toast.error('Gagal memperbarui detail transaksi.');
    } finally {
      setLoading(false);
    }
  };
  
  const handlePaymentFormChange = (field, value) => {
      setNewPayment(prev => ({ ...prev, [field]: value }));
  };
  
 const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!newPayment.amount || parseFloat(newPayment.amount) <= 0 || !newPayment.payment_method_id) {
        toast.error('Jumlah dan metode pembayaran harus diisi.');
        return;
    }
    
    setUploading(true);
    try {
      const adminFee = parseFloat(transactionDetails.admin_fee) || 0;
      const driverTip = parseFloat(transactionDetails.driver_tip) || 0;
      const totalPaidNow = parseFloat(newPayment.amount);
      
      // Hitung nilai barang murni
      const itemsAmount = totalPaidNow - adminFee - driverTip;

      // BUAT TIMESTAMP UNTUK MENGHINDARI DUPLICATE KEY CONSTRAINT
      const now = new Date();
      const timeString = now.toLocaleTimeString('id-ID', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });

      const newTransactions = [];

      // 1. Log Barang (HPP) - Tambahkan jam agar deskripsi unik
      newTransactions.push({
          company_id: companyId,
          type: 'expense',
          amount: itemsAmount,
          payment_method_id: newPayment.payment_method_id,
          source_table: 'central_orders',
          source_id: id, 
          description: `Pembelian Produk Procurement Order #${id.slice(0, 8)} (${timeString})`,
          transaction_date: now.toISOString(),
          created_by: userProfile.id,
          updated_by: userProfile.id
      });

      // 2. Log Admin (Jika ada)
      if (adminFee > 0) {
        newTransactions.push({
            company_id: companyId,
            type: 'expense',
            amount: adminFee,
            payment_method_id: newPayment.payment_method_id,
            source_table: 'central_orders',
            source_id: id, 
            description: `Biaya Admin untuk Order Pusat #${id.slice(0, 8)} (${timeString})`,
            transaction_date: now.toISOString(),
            created_by: userProfile.id,
            updated_by: userProfile.id
        });
      }

      // 3. Log Tip (Jika ada)
      if (driverTip > 0) {
        newTransactions.push({
            company_id: companyId,
            type: 'expense',
            amount: driverTip,
            payment_method_id: newPayment.payment_method_id,
            source_table: 'central_orders',
            source_id: id, 
            description: `Tip Supir untuk Order Pusat #${id.slice(0, 8)} (${timeString})`,
            transaction_date: now.toISOString(),
            created_by: userProfile.id,
            updated_by: userProfile.id
        });
      }

      // GUNAKAN .insert() BUKAN .upsert() agar cicilan masuk sebagai baris baru
      const { error } = await supabase
        .from('financial_transactions')
        .insert(newTransactions);

      if (error) throw error;

      toast.success('Pembayaran cicilan berhasil dicatat!');
      setNewPayment({ amount: '', payment_method_id: '', proof: null });
      fetchCentralOrder(id);

    } catch (error) {
      console.error('Error recording payment:', error);
      toast.error('Gagal mencatat: ' + error.message);
    } finally {
      setUploading(false);
    }
};

  const handleEditPaymentClick = (payment) => {
      setPaymentToEdit(payment);
      setEditPaymentForm({
          amount: payment.amount,
          payment_method_id: payment.payment_method_id,
      });
      setIsEditPaymentModalOpen(true);
  };
  
  const handleUpdatePayment = async (e) => {
      e.preventDefault();
      setLoading(true);
      try {
          const { error } = await supabase
              .from('financial_transactions')
              .update({
                  amount: parseFloat(editPaymentForm.amount),
                  payment_method_id: editPaymentForm.payment_method_id,
              })
              .eq('id', paymentToEdit.id);
          if (error) throw error;
          
          toast.success('Pembayaran berhasil diperbarui!');
          setIsEditPaymentModalOpen(false);
          setPaymentToEdit(null);
          fetchCentralOrder(id);
      } catch (error) {
          console.error('Error updating payment:', error);
          toast.error('Gagal memperbarui pembayaran: ' + error.message);
      } finally {
          setLoading(false);
      }
  };
  
  const handleDeletePayment = async (paymentId) => {
      if (!window.confirm('Apakah Anda yakin ingin menghapus pembayaran ini?')) return;
      setLoading(true);
      try {
          const { error } = await supabase
              .from('financial_transactions')
              .delete()
              .eq('id', paymentId);
          if (error) throw error;

          toast.success('Pembayaran berhasil dihapus!');
          fetchCentralOrder(id);
      } catch (error) {
          console.error('Error deleting payment:', error);
          toast.error('Gagal menghapus pembayaran: ' + error.message);
      } finally {
          setLoading(false);
      }
  };

  const handleReceivedQtyChange = (index, value) => {
    const newReceivedItems = [...receivedItems];
    newReceivedItems[index].received_qty = value;
    setReceivedItems(newReceivedItems);
  };
  
  const handleGallonDetailsChange = (productId, field, value) => {
    setGallonDetails(prev => ({
        ...prev,
        [productId]: {
            ...prev[productId],
            [field]: value,
        }
    }));
  };
  
  const handleDeleteOrder = async () => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus pesanan pusat ini? Semua data terkait akan dihapus dan stok akan dikembalikan.')) return;
    setLoading(true);
    try {
        const response = await fetch('https://wzmgcainyratlwxttdau.supabase.co/functions/v1/manage-central-order-galons', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ orderId: id, companyId }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Gagal menghapus pesanan.');
        }

        toast.success('Pesanan berhasil dihapus dan stok dikembalikan!');
        navigate('/central-orders');
    } catch (error) {
        console.error('Error deleting central order:', error);
        toast.error('Gagal menghapus pesanan: ' + error.message);
    } finally {
        setLoading(false);
    }
  };

  const handleFinalizeReceipt = async () => {
    setLoading(true);

    const galonDetailsPayload = {};
    for (const productId in gallonDetails) {
        galonDetailsPayload[productId] = {
            returned_to_central: parseFloat(gallonDetails[productId].returned_to_central) || 0,
            borrowed_from_central: parseFloat(gallonDetails[productId].borrowed_from_central) || 0,
            sold_empty_to_central: parseFloat(gallonDetails[productId].sold_empty_to_central) || 0,
            sold_empty_price: parseFloat(gallonDetails[productId].sold_empty_price) || 0,
        };
    }
    
    // VALIDASI FINALISASI: Pastikan jumlah diterima terisi untuk semua item
    const missingReceivedQty = receivedItems.some(item => 
        !item.received_qty || parseFloat(item.received_qty) < 0
    );
    if (missingReceivedQty) {
        toast.error('Pastikan semua kolom "Jumlah Diterima" sudah diisi dengan angka yang valid (minimal 0).');
        setLoading(false);
        return;
    }


    const payload = {
      orderId: id,
      receivedItems,
      orderItems, 
      galonDetails: galonDetailsPayload,
      deliveryDetails,
      companyId,
      userId: userProfile.id,
    };

    try {
      const response = await fetch('https://wzmgcainyratlwxttdau.supabase.co/functions/v1/manage-central-order-galons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Gagal mencatat penerimaan barang.');
      }
      
      toast.success('Penerimaan barang berhasil dicatat dan stok diperbarui!');
      navigate('/central-orders');
    } catch (error) {
      console.error('Error finalizing receipt:', error);
      toast.error('Gagal mencatat penerimaan barang: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const isCrossCheckEnabled = orderItems.length > 0; // Tidak perlu cek !isNewOrder lagi
  
  if (authLoading || !userProfile || loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }
  
  if (!id) return null; // Fallback jika ID hilang saat loading selesai.

  const handleProductSelectChange = (index, productId) => {
    handleItemChange(index, 'product_id', productId);
    setIsProductPopoverOpen(prev => ({ ...prev, [index]: false }));
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">{`Detail Pesanan #${id?.slice(0, 8)}`}</h1>
        <div className="flex flex-wrap gap-2">
            <Button onClick={() => navigate('/central-orders')} variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" /> Kembali
            </Button>
            <Button variant="outline" onClick={() => setIsTemplateModalOpen(true)}>
              <Settings className="h-4 w-4 mr-2" /> Atur Format Procurement
          </Button>
            <Button
                variant="outline"
                onClick={() => setIsWhatsappModalOpen(true)}
            >
                <MessageSquareText className="h-4 w-4 mr-2" /> Kirim Pesan
            </Button>
            
            <Button
              onClick={handleDeleteOrder}
              variant="destructive"
              disabled={loading}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Hapus Pesanan
            </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="bg-white rounded-lg border p-1 mb-6">
          <TabsList className="grid w-full justify-start grid-cols-1 gap-1 bg-transparent p-0 h-auto md:grid-cols-3">
            <TabsTrigger 
              className="w-full text-xs sm:text-sm px-2 py-2 data-[state=active]:bg-[#10182b] data-[state=active]:text-white rounded-md" 
              value="order-items"
            >
              1. Detail & Item
            </TabsTrigger>
            <TabsTrigger 
                className="w-full text-xs sm:text-sm px-2 py-2 data-[state=active]:bg-[#10182b] data-[state=active]:text-white rounded-md" 
              value="attachments-expenses"
              >
                2. Pembayaran & Lampiran
            </TabsTrigger>
            <TabsTrigger 
                className="w-full text-xs sm:text-sm px-2 py-2 data-[state=active]:bg-[#10182b] data-[state=active]:text-white rounded-md" 
                value="cross-check"
                disabled={!isCrossCheckEnabled}
              >
                3. Pengecekan Barang Datang
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Detail & Item */}
        <TabsContent value="order-items">
          <Card className="p-4 md:p-6">
            <CardHeader><CardTitle>Detail Pesanan</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="order-date">Tanggal Pesanan</Label>
                <Input
                  id="order-date"
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                />
              </div>

              <h3 className="font-semibold mt-6">Daftar Item</h3>
              <div className="space-y-4">
                {orderItems.map((item, index) => {
                  const selectedProductName = products.find(p => p.id === item.product_id)?.name || 'Pilih Produk';
                  return (
                  <div key={index} className="space-y-4 p-4 border rounded-md">
                    <div className="flex flex-col sm:flex-row gap-2 items-end">
                      <div className="w-full sm:w-auto flex-1">
                        <Label htmlFor={`product-${index}`}>Produk</Label>
                        {/* POP OVER PRODUCT START */}
                        <Popover open={isProductPopoverOpen[index]} onOpenChange={(open) => setIsProductPopoverOpen(prev => ({...prev, [index]: open}))}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={isProductPopoverOpen[index]}
                              className="w-full justify-between"
                            >
                              {selectedProductName}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0">
                            <Command>
                              <CommandInput placeholder="Cari produk..." />
                              <CommandList>
                                <CommandEmpty>Produk tidak ditemukan.</CommandEmpty>
                                <CommandGroup>
                                  {products.map(product => (
                                    <CommandItem
                                      key={product.id}
                                      value={product.name}
                                      onSelect={() => handleProductSelectChange(index, product.id)}
                                    >
                                      {product.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {/* POP OVER PRODUCT END */}
                      </div>
                      <div className="w-full sm:w-24">
                        <Label htmlFor={`qty-${index}`}>Jumlah</Label>
                        <Input
                          id={`qty-${index}`}
                          type="number"
                          value={item.qty}
                          onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                          onWheel={handleInputWheel}
                        />
                      </div>
                      <div className="w-full sm:w-32">
                        <Label htmlFor={`price-${index}`}>Harga Per Item</Label>
                        <Input
                          id={`price-${index}`}
                          type="number"
                          value={item.price}
                          onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                          placeholder="Harga"
                          onWheel={handleInputWheel}
                          readOnly
                          className="bg-gray-100 cursor-not-allowed"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        onClick={() => handleRemoveItem(index)}
                        className="mt-2 sm:mt-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )})}
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={handleAddItem}>
                <Plus className="h-4 w-4 mr-2" /> Tambah Item
              </Button>
                <Button 
                  onClick={handleSaveOrder}  
                  className={cn(
                    "w-full mt-4 text-white", // Class dasar
                    loading || authLoading ? "bg-gray-500 cursor-not-allowed" : 
                      orderStatus === 'received' 
                          ? 'bg-orange-600 hover:bg-orange-700' 
                          : 'bg-[#10182b] hover:bg-[#10182b]/90' 
                  )}
                  disabled={loading || authLoading}
              >
                {loading || authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 
                 (orderStatus === 'received' ? 'Edit Pesanan (Wajib Rollback)' : 'Perbarui Pesanan')
                }
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Pembayaran & Lampiran */}
        <TabsContent value="attachments-expenses">
          <Card className="p-4 md:p-6">
            <CardHeader><CardTitle>Pembayaran & Lampiran</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label>Lampiran</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="proof-transfer">Bukti Transfer</Label>
                    <Input
                      id="proof-transfer"
                      type="file"
                      onChange={(e) => handleFileUpload(e, 'proof_transfer')}
                      disabled={uploading}
                    />
                    {transactionDetails.attachments.find(a => a.file_type === 'proof_transfer') && (
                      <a href={transactionDetails.attachments.find(a => a.file_type === 'proof_transfer')?.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center text-sm text-blue-600 underline">
                          <FileIcon className="h-4 w-4 mr-1" /> Lihat file
                      </a>
                    )}
                  </div>
                  <div className="flex flex-col space-y-2">
                    <Label htmlFor="proforma-invoice">Faktur Proforma</Label>
                    <Input
                      id="proforma-invoice"
                      type="file"
                      onChange={(e) => handleFileUpload(e, 'proforma_invoice')}
                      disabled={uploading}
                    />
                    {transactionDetails.attachments.find(a => a.file_type === 'proforma_invoice') && (
                      <a href={transactionDetails.attachments.find(a => a.file_type === 'proforma_invoice')?.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center text-sm text-blue-600 underline">
                        <FileIcon className="h-4 w-4 mr-1" /> Lihat file
                      </a>
                    )}
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <Label className="text-xl font-semibold flex items-center gap-2 mb-2">
                    <DollarSign className="h-5 w-5" /> Pembayaran
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Total Harga Barang</Label>
                    <p className="text-lg font-bold">{formatCurrency(totalItemsValue)}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-fee">Biaya Admin</Label>
                    <Input
                      id="admin-fee"
                      type="number"
                      placeholder="Masukkan biaya admin"
                      value={transactionDetails.admin_fee}
                      onChange={(e) => setTransactionDetails({...transactionDetails, admin_fee: e.target.value})}
                      onWheel={handleInputWheel}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Kemasan Returnable Dibeli dari Pusat</Label>
                    <p className="text-lg font-bold">{formatCurrency(totalOrderValue - totalItemsValue - (parseFloat(transactionDetails.admin_fee) || 0) - (parseFloat(transactionDetails.driver_tip) || 0))}</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="driver_tip">Tip Supir</Label>
                    <Input
                      id="driver_tip"
                      type="number"
                      placeholder="Masukkan tip supir"
                      value={transactionDetails.driver_tip}
                      onChange={(e) => setTransactionDetails({...transactionDetails, driver_tip: e.target.value})}
                      onWheel={handleInputWheel}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Total Tagihan</Label>
                  <p className="text-2xl font-bold text-[#10182b]">{formatCurrency(totalOrderValue)}</p>
                </div>
                <div className="space-y-2">
                  <Label>Total Dibayar</Label>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
                </div>

                <Separator />

                <form onSubmit={handleRecordPayment} className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="payment_amount">Nominal Pembayaran</Label>
                      <Input
                        id="payment_amount"
                        type="number"
                        placeholder="Jumlah Pembayaran"
                        value={newPayment.amount}
                        onChange={(e) => setNewPayment(prev => ({...prev, amount: e.target.value}))}
                        onWheel={handleInputWheel}
                        required
                        disabled={remainingDue <= 0}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="payment_method">Metode Pembayaran</Label>
                      <Select
                        value={newPayment.payment_method_id}
                        onValueChange={(value) => setNewPayment(prev => ({...prev, payment_method_id: value}))}
                        required
                        disabled={remainingDue <= 0}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih metode" />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentMethods.map(method => (
                            <SelectItem key={method.id} value={method.id}>
                              {method.method_name} ({method.account_name})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="proof-payment">Bukti Transfer/Pembayaran</Label>
                    <Input
                      id="proof-payment"
                      type="file"
                      onChange={(e) => setNewPayment(prev => ({...prev, proof: e.target.files[0]}))}
                      accept="image/*"
                      disabled={remainingDue <= 0}
                    />
                  </div>
                  <Button type="submit" className="w-full bg-[#10182b] text-white hover:bg-[#10182b]/90" disabled={uploading || remainingDue <= 0}>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Catat Pembayaran'}
                  </Button>
                  {remainingDue <= 0 && <p className="text-sm text-green-600 text-center">Pembayaran sudah lunas.</p>}
                </form>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                  <Label className="text-xl font-semibold flex items-center gap-2 mb-2">
                      <Wallet className="h-5 w-5" /> Riwayat Pembayaran
                  </Label>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead>Tanggal</TableHead>
                          <TableHead>Jumlah</TableHead>
                          <TableHead>Metode</TableHead>
                          <TableHead>Bukti</TableHead>
                          <TableHead>Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map(p => (
                          <TableRow key={p.id}>
                            <TableCell>{new Date(p.transaction_date).toLocaleDateString()}</TableCell>
                            <TableCell>{formatCurrency(p.amount)}</TableCell>
                            <TableCell>{p.payment_method?.method_name || 'N/A'}</TableCell>
                            <TableCell>
                              {p.proof_url ? (
                                <a href={p.proof_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                  Lihat Bukti
                                </a>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell className="flex gap-2">
                                <Button variant="ghost" size="icon" onClick={() => handleEditPaymentClick(p)}>
                                    <Pencil className="h-4 w-4 text-blue-500" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDeletePayment(p.id)}>
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {payments.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground">
                              Belum ada riwayat pembayaran.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label>Detail Transaksi Lainnya</Label>
                <Input
                  label="Catatan"
                  type="text"
                  placeholder="Catatan"
                  value={transactionDetails.notes}
                  onChange={(e) => setTransactionDetails({...transactionDetails, notes: e.target.value})}
                />
              </div>
              <Button onClick={handleUpdateTransaction} className="w-full bg-[#10182b] text-white hover:bg-[#10182b]/90" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan Detail Transaksi Lainnya'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Pengecekan Barang Datang */}
        <TabsContent value="cross-check">
          {/* NEW: Apply text-sm on mobile, sm:text-base for larger screens */}
          <Card className="p-4 md:p-6 text-sm sm:text-base"> 
            <CardHeader><CardTitle className="text-xl sm:text-2xl">Pengecekan Barang Datang</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm"> 
                <div className="space-y-2">
                  <Label htmlFor="arrival-date">Tanggal Barang Datang</Label>
                  <Input
                    id="arrival-date"
                    type="date"
                    value={deliveryDetails.arrival_date}
                    onChange={(e) => setDeliveryDetails({ ...deliveryDetails, arrival_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="central-note-number">Nomor Surat Jalan Pusat</Label>
                  <Input
                    id="central-note-number"
                    type="text"
                    value={deliveryDetails.central_note_number}
                    onChange={(e) => setDeliveryDetails({ ...deliveryDetails, central_note_number: e.target.value })}
                    placeholder="Contoh: SJ-001/2025"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm">Surat Jalan (Lampiran)</Label>
                <Input
                  type="file"
                  onChange={(e) => handleFileUpload(e, 'delivery_note')}
                  disabled={uploading}
                  multiple
                />
                <div className="flex flex-wrap gap-3 mt-3">
                  {/* NEW: Rendering attachment dengan thumbnail */}
                  {transactionDetails.attachments.filter(a => a.file_type === 'delivery_note').map((attachment, index) => {
                      // Cek sederhana apakah URL adalah format gambar
                      const isImage = attachment.file_url.match(/\.(jpeg|jpg|png|gif)$/i);
                      return (
                          <a key={index} href={attachment.file_url} target="_blank" rel="noopener noreferrer" className="block border rounded-md p-2 hover:bg-gray-100 transition-colors">
                              {isImage ? (
                                  <img 
                                      src={attachment.file_url} 
                                      alt={`Lampiran ${index + 1}`} 
                                      className="h-12 w-12 object-cover rounded-sm"
                                  />
                              ) : (
                                  <div className="flex flex-col items-center justify-center h-12 w-12 text-blue-600">
                                      <FileIcon className="h-6 w-6" />
                                  </div>
                              )}
                              <span className="mt-1 block text-xs text-gray-600 text-center">File {index + 1}</span>
                          </a>
                      );
                  })}
                </div>
              </div>


              <h3 className="font-semibold mt-6 text-base sm:text-lg">Detail Barang Diterima</h3>
              <div className="rounded-md border overflow-x-auto">
                <Table className="text-[10px] sm:text-sm"> {/* NEW: Apply text-xs for the table content */}
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[100px]">Produk</TableHead>
                      <TableHead className="min-w-[100px]">Jumlah Dipesan</TableHead>
                      <TableHead className="min-w-[120px]">Jumlah Diterima</TableHead>
                      <TableHead className="min-w-[60px]">Selisih</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receivedItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="py-2">{item.product_name}</TableCell>
                        <TableCell className="py-2">{item.ordered_qty}</TableCell>
                        <TableCell className="py-2">
                          <Input
                            type="number"
                            value={item.received_qty}
                            onChange={(e) => handleReceivedQtyChange(index, e.target.value)}
                            onWheel={handleInputWheel}
                            className="h-8 text-xs sm:text-sm"
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          {/* Pastikan kalkulasi selisih tidak error jika input kosong */}
                          {parseInt(item.received_qty || 0) - parseInt(item.ordered_qty || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {orderItems.filter(item => item.is_returnable).map(item => {
                  const productDetail = products.find(p => p.id === item.product_id);
                  const currentEmptyStock = productDetail ? productDetail.empty_bottle_stock : 0;
                  
                  const gallonsReturned = parseFloat(gallonDetails[item.product_id]?.returned_to_central) || 0;
                  const remainingStock = currentEmptyStock - gallonsReturned;

                  return (
                      <div key={item.product_id} className="space-y-4 col-span-full mt-4 p-4 border rounded-md bg-gray-50 text-xs sm:text-sm"> {/* NEW: Apply text-xs here */}
                          <h4 className="font-semibold text-[#10182b] flex items-center gap-2 text-sm sm:text-base">
                              <Package className="h-4 w-4" />
                              Detail Kemasan Returnable ({item.product_name})
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-2">
                                  <Label htmlFor={`galon-returned-${item.product_id}`}>
                                      Kemasan Returnable Dikembalikan ke Pusat
                                      <span className="ml-2 font-normal text-gray-500">
                                          (Stok sisa: {remainingStock} pcs)
                                      </span>
                                  </Label>
                                  <Input
                                      id={`galon-returned-${item.product_id}`}
                                      type="number"
                                      placeholder="0"
                                      value={gallonsReturned || ''}
                                      onChange={(e) => handleGallonDetailsChange(item.product_id, 'returned_to_central', e.target.value)}
                                      onWheel={handleInputWheel}
                                      className="h-8 text-xs sm:text-sm"
                                  />
                              </div>
                              <div className="space-y-2">
                                  <Label htmlFor={`galon-borrowed-${item.product_id}`}>Kemasan Returnable Dipinjam dari Pusat</Label>
                                  <Input
                                      id={`galon-borrowed-${item.product_id}`}
                                      type="number"
                                      placeholder="0"
                                      value={gallonDetails[item.product_id]?.borrowed_from_central || ''}
                                      onChange={(e) => handleGallonDetailsChange(item.product_id, 'borrowed_from_central', e.target.value)}
                                      onWheel={handleInputWheel}
                                      className="h-8 text-xs sm:text-sm"
                                  />
                              </div>
                              <div className="space-y-2">
                                  <Label htmlFor={`galon-sold-${item.product_id}`}>Kemasan Returnable Dibeli dari Pusat</Label>
                                  <Input
                                      id={`galon-sold-${item.product_id}`}
                                      type="number"
                                      placeholder="0"
                                      value={gallonDetails[item.product_id]?.sold_empty_to_central || ''}
                                      onChange={(e) => handleGallonDetailsChange(item.product_id, 'sold_empty_to_central', e.target.value)}
                                      onWheel={handleInputWheel}
                                      className="h-8 text-xs sm:text-sm"
                                  />
                                  <Label htmlFor={`price-sold-${item.product_id}`}>Harga Kemasan Returnable</Label>
                                  <Input
                                      id={`price-sold-${item.product_id}`}
                                      type="number"
                                      placeholder="0"
                                      value={gallonDetails[item.product_id]?.sold_empty_price || ''}
                                      onChange={(e) => handleGallonDetailsChange(item.product_id, 'sold_empty_price', e.target.value)}
                                      onWheel={handleInputWheel}
                                      className="h-8 text-xs sm:text-sm"
                                  />
                              </div>
                          </div>
                      </div>
                  );
              })}
            
            <Button onClick={handleFinalizeReceipt} className="w-full bg-[#10182b] text-white hover:bg-[#10182b]/90" disabled={loading || orderStatus === 'received'}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Selesaikan Pengecekan & Perbarui Stok'}
            </Button>
            {orderStatus === 'received' && <p className="text-sm text-center text-green-600 mt-2">Penerimaan barang sudah dicatat.</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <WhatsappOrderModal
        isOpen={isWhatsappModalOpen}
        onOpenChange={setIsWhatsappModalOpen}
        orderId={id} // Akan dipetakan ke {{orderNo}} di modal
        orderDate={orderDate} // Akan dipetakan ke {{orderDate}}
        orderItems={orderItems}
        products={products}
        suppliers={suppliers}
        // Props tambahan untuk mendukung template baru
        activeTemplates={activeTemplates}
        sendViaFonnte={sendViaFonnte}
        companyName={companyName}
        totalHarga={formatCurrency(totalOrderValue)} // Akan dipetakan ke {{totalHarga}}
    />
      
      {/* Modal Edit Pembayaran */}
      <Dialog open={isEditPaymentModalOpen} onOpenChange={setIsEditPaymentModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit Pembayaran</DialogTitle>
                <DialogDescription>Perbarui nominal atau metode pembayaran.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdatePayment} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="edit-amount">Nominal Pembayaran</Label>
                    <Input
                        id="edit-amount"
                        type="number"
                        value={editPaymentForm.amount}
                        onChange={(e) => setEditPaymentForm({...editPaymentForm, amount: e.target.value})}
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="edit-method">Metode Pembayaran</Label>
                    <Select
                        value={editPaymentForm.payment_method_id}
                        onValueChange={(value) => setEditPaymentForm({...editPaymentForm, payment_method_id: value})}
                        required
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Pilih metode" />
                        </SelectTrigger>
                        <SelectContent>
                            {paymentMethods.map(method => (
                                <SelectItem key={method.id} value={method.id}>
                                    {method.method_name} ({method.account_name})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button type="submit" disabled={loading}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Perbarui Pembayaran'}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
      
      {/* MODAL: Edit Konfirmasi Rollback */}
      <Dialog open={isEditConfirmationModalOpen} onOpenChange={setIsEditConfirmationModalOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Konfirmasi Perubahan Pesanan</DialogTitle>
            </DialogHeader>
             <DialogDescription>
              <p className="mb-4">Apakah anda ingin mengedit pesanan ini?</p>
              <p className="mt-4 font-semibold text-sm">Anda harus melakukan Pengecekan Barang Datang ulang setelah menyimpan perubahan di halaman berikutnya.</p>
            </DialogDescription>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditConfirmationModalOpen(false)}>Batal</Button>
                <Button 
                    onClick={() => handleUpdateExistingOrder(true)} // Pass true to confirm and trigger PUT
                    variant="destructive"
                    disabled={loading}
                >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ya, Lanjutkan Edit & Rollback'}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <WhatsappTemplateSettingsModal 
            isOpen={isTemplateModalOpen} 
            onOpenChange={(open) => {
                setIsTemplateModalOpen(open);
                if (!open) fetchActiveTemplates(); 
            }} 
        />
    </div>
  );
};

export default EditCentralOrderFormPage;