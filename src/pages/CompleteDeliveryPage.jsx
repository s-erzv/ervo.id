import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate,  useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'react-hot-toast';
import { Loader2, ArrowLeft, PackageCheck, X, ChevronsUpDown, Package, Check, Eye } from 'lucide-react'; 
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';

const MAX_FILE_SIZE = 1 * 1024 * 1024; 
const TARGET_SIZE_MB = 0.5;  


const CompleteDeliveryPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { session, userId, companyId } = useAuth();
  const location = useLocation();

  // --- REFS FOR FILE INPUTS ---
  const proofFileRef = useRef(null);
  const transferProofRef = useRef(null);
  
  // --- STATE DEFINITIONS ---
  const [deliveryFile, setDeliveryFile] = useState(null);
  const [transferProofFile, setTransferProofFile] = useState(null); 
  const [submitting, setSubmitting] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('unpaid');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [transferMethod, setTransferMethod] = useState('');
  const [receivedByName, setReceivedByName] = useState('');
  const [cashAmount, setCashAmount] = useState('0');
  const [transferAmount, setTransferAmount] = useState('0');
  const [transportCost, setTransportCost] = useState(' ');
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [orderCouriers, setOrderCouriers] = useState([]);
  const [allReturnableProducts, setAllReturnableProducts] = useState([]);
  const [returnMovements, setReturnMovements] = useState([]); 
  const [allCompanyStaff, setAllCompanyStaff] = useState([]); // MODIFIKASI: State baru untuk semua Staff/Admin

  // --- LOGIKA QUICK ORDER & KEWAJIBAN BUKTI ---
  const isQuickOrder = location.state?.isQuickOrder || false; 
  // MODIFIKASI: Bukti pengiriman TIDAK WAJIB untuk SEMUA pesanan
  const isProofRequired = false;
  // ---------------------------------------------
  
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actualCouriers, setActualCouriers] = useState([]);
  
  const [isProductPopoverOpen, setIsProductPopoverOpen] = useState(false);
  const [productToAddId, setProductToAddId] = useState('');
  const [soldReturnableMap, setSoldReturnableMap] = useState({});
  const [initialDeliveryProofUrl, setInitialDeliveryProofUrl] = useState(null); 
  const [initialTransferProofUrl, setInitialTransferProofUrl] = useState(null); 

  
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

                  // Resize jika terlalu besar (opsional)
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
                  
                  // Kompresi berulang sampai ukuran target tercapai (atau kualitas terlalu rendah)
                  do {
                      const dataUrl = canvas.toDataURL('image/jpeg', quality);
                      const parts = dataUrl.split(',');
                      const mime = parts[0].match(/:(.*?);/)[1];
                      const base64Data = parts[1];
                      
                      // Mengubah Base64 ke Binary String (atob)
                      const binaryString = atob(base64Data); 
                      const binaryLength = binaryString.length; 
                      
                      // Jika ukuran sudah di bawah target, break
                      if (binaryLength / 1024 / 1024 <= targetMB || quality < 0.1) {
                        // CRITICAL FIX: Convert binary string to Uint8Array safely
                        const uint8Array = new Uint8Array(binaryLength);
                        for (let i = 0; i < binaryLength; i++) {
                          // Gunakan charCodeAt pada binaryString
                          uint8Array[i] = binaryString.charCodeAt(i); 
                        }
                        
                        blob = new Blob([uint8Array], { type: mime });
                        break;
                      }
                      quality -= 0.1;
                  } while (quality > 0.05);

                  // Fallback jika loop tidak mencapai kualitas yang diinginkan tapi menghasilkan blob
                  if (!blob) {
                      const dataUrl = canvas.toDataURL('image/jpeg', 0.05);
                      const parts = dataUrl.split(',');
                      const mime = parts[0].match(/:(.*?);/)[1];
                      const base64Data = parts[1];
                      const binaryString = atob(base64Data);
                      const binaryLength = binaryString.length; 
                      
                      const uint8Array = new Uint8Array(binaryLength);
                      for (let i = 0; i < binaryLength; i++) {
                        uint8Array[i] = binaryString.charCodeAt(i);
                      }
                      blob = new Blob([uint8Array], { type: mime });
                  }
                  
                  const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + '.jpeg', {
                      type: 'image/jpeg',
                      lastModified: Date.now()
                  });

                  resolve(compressedFile);
              };
              img.onerror = () => reject(new Error('Image loading failed'));
          };
          reader.onerror = (error) => reject(error);
      });
  };


  const handleInputWheel = (e) => {
    e.target.blur();
  };

  const handleDeliveryFileChange = async (e) => {
    const file = e.target.files?.[0] || null;
    e.target.value = null; // Reset input field

    if (!file) return setDeliveryFile(null);
    
    if (file.size > MAX_FILE_SIZE) { 
        toast.loading('File terlalu besar (> 1MB). Mencoba kompresi otomatis...', { id: 'compress-del' });
        try {
            const compressedFile = await compressImage(file, TARGET_SIZE_MB); // Target 0.5MB
            setDeliveryFile(compressedFile);
            toast.success(`Kompresi berhasil: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`, { id: 'compress-del' });
        } catch (error) {
            toast.error('Kompresi gagal. Mohon unggah file lebih kecil.', { id: 'compress-del' });
            setDeliveryFile(null);
        }
    } else {
        setDeliveryFile(file);
        toast.success(`Bukti pengiriman berhasil diambil: ${file.name}`, { duration: 1500 });
    }
  };

  const handleTransferProofFileChange = async (e) => {
    const file = e.target.files?.[0] || null;
    e.target.value = null; // Reset input field

    if (!file) return setTransferProofFile(null);

    if (file.size > MAX_FILE_SIZE) { 
        toast.loading('File terlalu besar (> 1MB). Mencoba kompresi otomatis...', { id: 'compress-trans' });
        try {
            const compressedFile = await compressImage(file, TARGET_SIZE_MB); // Target 0.5MB
            setTransferProofFile(compressedFile);
            toast.success(`Kompresi berhasil: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`, { id: 'compress-trans' });
        } catch (error) {
            toast.error('Kompresi gagal. Mohon unggah file lebih kecil.', { id: 'compress-trans' });
            setTransferProofFile(null);
        }
    } else {
        setTransferProofFile(file);
        toast.success(`Bukti transfer berhasil diambil: ${file.name}`, { duration: 1500 });
    }
  };

  const handleUpdateReturnableEntry = useCallback((index, field, value) => {
      setReturnMovements(prev => {
          const newMovements = [...prev];
          newMovements[index][field] = value;
          return newMovements;
      });
  }, []);

  const handleRemoveReturnableEntry = useCallback((index) => {
      setReturnMovements(prev => {
          const itemToModify = prev[index];
          
          const hadOldData = (parseFloat(itemToModify.old_returnedQty) > 0 || parseFloat(itemToModify.old_purchasedEmptyQty) > 0);
          
          if (itemToModify.isPrimarySoldItem || hadOldData) {
              // Jika ini adalah item utama yang dijual ATAU memiliki data lama di DB, RESET Qty ke 0
              // Kuantitas lama (old_...) tetap dipertahankan agar BE bisa menghitung NET CHANGE (0 - oldQty)
              const newMovements = [...prev];
              newMovements[index] = {
                  ...itemToModify,
                  returnedQty: 0,
                  purchasedEmptyQty: 0,
              };
              toast.success(`Kuantitas Kemasan ${itemToModify.product_name} direset ke 0.`);
              return newMovements;
          } else {
              // Jika ini adalah item yang ditambahkan secara manual dan belum ada pergerakan yang tersimpan di DB, HAPUS entri
              toast.success(`Kemasan ${itemToModify.product_name} dihapus dari daftar.`);
              return prev.filter((_, i) => i !== index);
          }
      });
  }, []);
  
  const handleAddReturnableEntry = useCallback((productId) => {
        const product = allReturnableProducts.find(p => p.id === productId);
        
        if (!product || returnMovements.some(m => m.product_id === productId)) {
            if (product) toast.error('Produk ini sudah ada di daftar.');
            return;
        } 

        setReturnMovements(prev => {
            return [...prev, {
                product_id: productId,
                product_name: product.name,
                ordered_qty: soldReturnableMap[productId]?.qty || 0,
                returnedQty: 0, 
                purchasedEmptyQty: 0, 
                empty_bottle_price: product.empty_bottle_price,
                isPrimarySoldItem: !!soldReturnableMap[productId], 
                old_returnedQty: 0,
                old_purchasedEmptyQty: 0,
                old_borrowed_qty: 0,
            }];
        });
        setProductToAddId('');
        setIsProductPopoverOpen(false);
  }, [allReturnableProducts, returnMovements, soldReturnableMap]);

  // --- MEMOIZED VALUES & EFFECTS ---
  const orderItemsTotal = order?.order_items.reduce((sum, item) => sum + (item.qty * item.price), 0) || 0;
  const transportCostVal = parseFloat(transportCost) || 0;
  
  const totalPurchaseCost = useMemo(() => {
      return returnMovements.reduce((sum, item) => {
          const qty = parseInt(item.purchasedEmptyQty) || 0;
          return sum + (qty * (item.empty_bottle_price || 0));
      }, 0);
  }, [returnMovements]);

  const newGrandTotal = orderItemsTotal + transportCostVal + totalPurchaseCost;
  const remainingDue = newGrandTotal - (order?.total_paid || 0);

  const allInvolvedReturnableProductIds = useMemo(() => {
      return Array.from(new Set(returnMovements.map(m => m.product_id)));
  }, [returnMovements]);

  const availableProductsForReturn = useMemo(() => {
      return allReturnableProducts.filter(p => !allInvolvedReturnableProductIds.includes(p.id));
  }, [allReturnableProducts, allInvolvedReturnableProductIds]);
  
  const productToAddName = availableProductsForReturn.find(p => p.id === productToAddId)?.name || 'Cari Kemasan Returnable';
  
  // --- LOGIC AUTO-FILL NOMINAL PEMBAYARAN ---
useEffect(() => {
  if (!order) return;
  const selectedMethod = paymentMethods.find(m => m.id === paymentMethod);

  // Jika statusnya bukan UNPAID (artinya Paid atau Partial)
  if (paymentStatus !== 'unpaid') {
    if (paymentMethod === 'hybrid') {
      // Untuk hybrid, isi cash dulu, sisanya ke transfer
      const remainingForTransfer = Math.max(0, remainingDue - (parseFloat(cashAmount) || 0));
      setTransferAmount(remainingForTransfer.toString());
    } else if (selectedMethod?.type === 'cash') {
      // Jika lunas & cash, otomatis isi semua sisa tagihan
      setCashAmount(remainingDue.toString());
      setTransferAmount('0');
    } else if (selectedMethod?.type === 'transfer') {
      // Jika lunas & transfer, otomatis isi semua sisa tagihan
      setTransferAmount(remainingDue.toString());
      setCashAmount('0');
    }
  } else {
    // Jika status diubah ke PENDING (unpaid), kosongkan semua
    setCashAmount('0');
    setTransferAmount('0');
  }
}, [paymentMethod, paymentStatus, remainingDue, paymentMethods, order]); 
// Tambahkan paymentStatus ke dependency array di atas ^


  // --- FETCHING FUNCTIONS ---
  const fetchData = async () => {
    // GUARD: Jika orderId tidak ada atau string "undefined" (karena routing tertunda)
    if (!orderId || orderId === 'undefined') {
        console.warn("fetchData blocked: orderId is undefined");
        return;
    }

    setLoading(true);
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        customers (name, address, phone), 
        order_items (
            product_id, qty, price, item_type, 
            returned_qty, purchased_empty_qty, borrowed_qty, 
            products(id, name, is_returnable, empty_bottle_price)
        ),
        order_couriers (courier:profiles!order_couriers_courier_id_fkey(id, full_name)),
        order_galon_items(product_id, returned_qty, borrowed_qty, purchased_empty_qty)
      `)
      .eq('id', orderId)
      .single();

    if (orderError) {
      console.error('Error fetching order:', orderError);
      toast.error('Gagal memuat detail pesanan.');
      setLoading(false);
      navigate('/dashboard');
      return;
    }

    if (orderData.order_couriers) {
        const initialCourierIds = orderData.order_couriers.map(oc => oc.courier.id);
        setActualCouriers(initialCourierIds);
    }
    
    const { data: paymentsData, error: paymentsError } = await supabase
      .from('payments')
      .select('amount, proof_url')
      .eq('order_id', orderData.id);

    if (paymentsError) {
        console.error('Error fetching payments:', paymentsError);
    }
    
    let pmQuery = supabase.from('payment_methods').select('*').eq('is_active', true);
    if (companyId) pmQuery = pmQuery.eq('company_id', companyId);
    
    const { data: methodsData, error: methodsError } = await pmQuery;
    
    if (methodsError) {
        console.error('Error fetching payment methods:', methodsError);
    } else {
        setPaymentMethods(methodsData || []);
    }
    
    const total_paid = paymentsData ? paymentsData.reduce((sum, p) => sum + p.amount, 0) : 0;
    
    // Ambil URL publik untuk bukti pengiriman yang sudah ada
    let deliveryProofPublicUrl = null;
    if (orderData.proof_of_delivery_url) {
        const { data } = supabase.storage.from('proofs').getPublicUrl(orderData.proof_of_delivery_url);
        deliveryProofPublicUrl = data?.publicUrl;
        setInitialDeliveryProofUrl(deliveryProofPublicUrl);
    }
    
    // Ambil URL publik untuk bukti transfer yang sudah ada (dari pembayaran terakhir)
    const lastTransferPayment = paymentsData?.find(p => p.proof_url);
    if (lastTransferPayment?.proof_url) {
        const { data } = supabase.storage.from('proofs').getPublicUrl(lastTransferPayment.proof_url);
        setInitialTransferProofUrl(data?.publicUrl);
    }


    const orderWithDetails = {
      ...orderData,
      total_paid,
    };

    setOrder(orderWithDetails);
    setOrderCouriers(orderData.order_couriers.map(oc => oc.courier));
    
    // order_items sekarang mencakup returned_qty, purchased_empty_qty, borrowed_qty
    const soldReturnableItems = orderData.order_items.filter(item => item.products?.is_returnable);
    const soldReturnableMap = soldReturnableItems.reduce((acc, item) => {
        acc[item.product_id] = { 
            qty: item.qty, 
            price: item.products.empty_bottle_price 
        };
        return acc;
    }, {});
    setSoldReturnableMap(soldReturnableMap);
    
    // order_galon_items adalah data historis.
    const existingGalonDataMap = (orderData.order_galon_items || []).reduce((acc, g) => {
        acc[g.product_id] = g;
        return acc;
    }, {});
    
    const allUniqueReturnableProductIds = Array.from(new Set([
        ...Object.keys(existingGalonDataMap),
        ...Object.keys(soldReturnableMap)
    ]));

    const initialMovements = allUniqueReturnableProductIds.map(productId => {
        const productFromAll = allReturnableProducts.find(p => p.id === productId);
        const itemFromOrder = soldReturnableItems.find(p => p.product_id === productId); // Item yang dibeli
        const product = productFromAll || itemFromOrder?.products || {};

        // PENTING: Ambil data galon TERBARU dari order_items (itemFromOrder)
        // Jika tidak ada, fallback ke order_galon_items (jika ada).
        const latestGalonData = existingGalonDataMap[productId];
        
        // Fungsi helper untuk mendapatkan nilai float yang aman
        const getFloat = (val) => parseFloat(val) || 0;
        
        // Prioritaskan itemFromOrder karena BE harusnya mengupdate ini pada Edit/Complete
        const savedReturnedQty = getFloat(itemFromOrder?.returned_qty || latestGalonData?.returned_qty);
        const savedPurchasedEmptyQty = getFloat(itemFromOrder?.purchased_empty_qty || latestGalonData?.purchased_empty_qty);
        const savedBorrowedQty = getFloat(itemFromOrder?.borrowed_qty || latestGalonData?.borrowed_qty); 


        const isSold = !!soldReturnableMap[productId];
        
        return {
            product_id: productId,
            product_name: product.name,
            ordered_qty: soldReturnableMap[productId]?.qty || 0,
            
            // Inisialisasi input (Returned) dengan data TERBARU (Seharusnya 10 setelah edit)
            returnedQty: savedReturnedQty, 
            purchasedEmptyQty: savedPurchasedEmptyQty, 
            
            empty_bottle_price: product.empty_bottle_price,
            isPrimarySoldItem: isSold,
            
            // Simpan kuantitas lama (old_...) juga dengan nilai TERBARU (Seharusnya 10 setelah edit)
            old_returnedQty: savedReturnedQty,
            old_purchasedEmptyQty: savedPurchasedEmptyQty,
            old_borrowed_qty: savedBorrowedQty, 
        };
    });
    
    setReturnMovements(initialMovements);
    setTransportCost(orderData.transport_cost?.toString() || '0');
    setLoading(false);
  };

  const fetchInitialData = async () => {
    // Guard: Pastikan orderId valid
    if (!orderId || orderId === 'undefined') return;

    // Fetch all returnable products
    const { data: allReturnables, error: allReturnablesError } = await supabase
        .from('products')
        .select('id, name, is_returnable, empty_bottle_price, purchase_price')
        .eq('company_id', companyId)
        .eq('is_returnable', true);

    if (!allReturnablesError) {
        setAllReturnableProducts(allReturnables || []);
    } else {
        console.error('Error fetching all returnable products:', allReturnablesError);
    }
    
    // MODIFIKASI: Ambil semua staff/admin dari perusahaan untuk dropdown penerima
    const { data: staffData, error: staffError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('company_id', companyId)
        .or('role.eq.user,role.eq.admin'); // Filter role: user atau admin

    if (!staffError) {
        setAllCompanyStaff(staffData || []);
    } else {
        console.error('Error fetching all company staff:', staffError);
    }
    
    await fetchData();
  };
  
  useEffect(() => {
    // Perbaikan Guard: Tambahkan pengecekan string "undefined"
    if (!orderId || orderId === 'undefined') {
      return; // Tunggu sampai ID tersedia
    }
    if (companyId) {
      fetchInitialData();
    }
  }, [orderId, companyId, session]);
  
  
  const handlePaymentMethodChange = (value) => {
    setPaymentMethod(value);
    setTransferMethod('');
  }
  
  const handleCompleteDelivery = async (e) => {
    e.preventDefault(); 
    
    const fileToUpload = deliveryFile;
    const transferProofToUpload = transferProofFile;
    
    // --- VALIDASI BUKTI PENGIRIMAN (DINONAKTIFKAN PER PERMINTAAN USER) ---
    // Logika ini dinonaktifkan karena isProofRequired = false
    /* if (isProofRequired && !fileToUpload && !initialDeliveryProofUrl) {
      toast.error('Bukti pengiriman (foto) harus diunggah.');
      return;
    }
    */
    // --- AKHIR VALIDASI BUKTI PENGIRIMAN ---

    const selectedMethodObj = paymentMethods.find(m => m.id === paymentMethod);
    const isTransfer = selectedMethodObj?.type === 'transfer' || paymentMethod === 'hybrid';
    const isCashPayment = selectedMethodObj?.type === 'cash' || paymentMethod === 'hybrid';
    
    if (paymentStatus !== 'unpaid') {
      if (isTransfer) { 
        if (!transferProofToUpload && !initialTransferProofUrl) { // Cek file baru ATAU file lama
            toast.error('Mohon unggah bukti transfer.');
            return;
        }
        if (paymentMethod === 'hybrid' && !transferMethod) {
            toast.error('Mohon pilih metode transfer.');
            return;
        }
      }
      
      if (isCashPayment && !receivedByName) {
        toast.error('Nama penerima harus diisi.');
        return;
      }
    }
    // --- AKHIR VALIDASI REQUIRED DATA ---

    setSubmitting(true);
    let transferProofUrl = initialTransferProofUrl || null; // Gunakan link lama sebagai default
    let deliveryFilePath = order.proof_of_delivery_url || null; // Gunakan link lama sebagai default

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Upload BUKTI PENGIRIMAN (Hanya jika ada file baru)
      if (fileToUpload) {
          const deliveryFileExt = fileToUpload.name.split('.').pop();
          deliveryFilePath = `${order.id}/delivery_proofs/${Date.now()}.${deliveryFileExt}`;
          const { error: deliveryUploadError } = await supabase.storage
            .from("proofs")
            .upload(deliveryFilePath, fileToUpload, { upsert: true }); // Gunakan upsert=true untuk timpa

          if (deliveryUploadError) throw new Error('Gagal mengunggah bukti pengiriman: ' + deliveryUploadError.message);
      }
      
      let finalPaymentAmount = 0;
      if (paymentStatus !== 'unpaid') {
        finalPaymentAmount = (parseFloat(cashAmount) || 0) + (parseFloat(transferAmount) || 0);
      }
      
      let pmToSend = null;
      if (paymentMethod && paymentMethod !== "pending") {
          pmToSend = paymentMethod === "hybrid" ? transferMethod : paymentMethod;
      }
      
      const selectedMethodObjForTransfer = paymentMethods.find(m => m.id === pmToSend);
      const isTransferPayment = selectedMethodObjForTransfer?.type === 'transfer' || (paymentMethod === 'hybrid' && selectedMethodObjForTransfer?.type === 'transfer');

      // 2. Upload BUKTI TRANSFER (Jika ada file baru dan diperlukan)
      if (paymentStatus !== 'unpaid' && isTransferPayment && transferProofToUpload) {
        const transferFileExt = transferProofToUpload.name.split('.').pop();
        const transferFilePath = `${order.id}/transfer_proofs/${Date.now()}.${transferFileExt}`;
        const { data: transferUploadData, error: transferUploadError } = await supabase.storage
          .from("proofs")
          .upload(transferFilePath, transferProofToUpload, { upsert: true });

        if (transferUploadError) throw new Error('Gagal mengunggah bukti transfer: ' + transferUploadError.message);
        transferProofUrl = transferUploadData.path;
      }
      
      // 3. Persiapan Payload untuk Edge Function
      const returnableItemsPayload = returnMovements.map(item => {
          const returnedQty = parseFloat(item.returnedQty) || 0;
          const purchasedEmptyQty = parseFloat(item.purchasedEmptyQty) || 0;
          
          let orderedQty = 0;
          let calculatedBorrowedQty = 0;
          
          if (item.isPrimarySoldItem) {
              orderedQty = item.ordered_qty;
              calculatedBorrowedQty = Math.max(0, orderedQty - returnedQty - purchasedEmptyQty);
          }
          
          return {
              product_id: item.product_id,
              returnedQty,
              purchasedEmptyQty,
              borrowedQty: calculatedBorrowedQty, 
              empty_bottle_price: item.empty_bottle_price,
              
              // DATA LAMA DARI DATABASE UNTUK NET CHANGE DI BE
              old_returnedQty: parseFloat(item.old_returnedQty) || 0, 
              old_purchasedEmptyQty: parseFloat(item.old_purchasedEmptyQty) || 0,
              old_borrowed_qty: parseFloat(item.old_borrowed_qty) || 0, 
          };
      });

      const payload = {
        orderId,
        actualCourierIds: actualCouriers,
        paymentAmount: finalPaymentAmount,
        paymentMethodId: pmToSend, 
        returnableItems: returnableItemsPayload,
        transportCost: parseFloat(transportCost) || 0,
        proofFileUrl: deliveryFilePath,
        transferProofUrl,
        receivedByUserId: userId || null,
        receivedByName: receivedByName || null,
        paymentStatus: paymentStatus,
        
        // Data lama yang dibutuhkan untuk perhitungan net change pembayaran
        oldOrderGrandTotal: order.grand_total,
        oldOrderPaymentsTotal: order.total_paid,
        
        // PENTING: Menentukan apakah ini UPDATE atau INSERT baru (berdasarkan status lama)
        isUpdate: order.status === 'completed', 
      };

      // 4. Panggil Edge Function
      const { data, error } = await supabase.functions.invoke('complete-delivery', {
        body: payload,
      });

      if (error) throw error;

      toast.success("Pesanan berhasil diselesaikan/diperbarui!");
      if (isQuickOrder) {
          navigate('/orders'); 
      } else {
          navigate(-1); 
      }
      
    } catch (error) {
      console.error("Error completing delivery:", error);
      toast.error("Gagal menyelesaikan pesanan: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !order) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-white">
        <Loader2 className="h-10 w-10 animate-spin text-[#011e4b]" />
        <p className="mt-4 text-muted-foreground">Memuat detail pesanan...</p>
      </div>
    );
  }
  
  const combinedPaymentMethods = [
    ...paymentMethods,
  ];
  
  const selectedMethodObj = paymentMethods.find(m => m.id === paymentMethod);
  const selectedMethodType = selectedMethodObj?.type;
  const transferMethods = paymentMethods.filter(m => m.type === 'transfer');

  const showPaymentDetailsFields = paymentStatus === 'paid' || paymentStatus === 'partial';
  const showCashFields = showPaymentDetailsFields && (selectedMethodType === 'cash' || paymentMethod === 'hybrid');
  const showTransferFields = showPaymentDetailsFields && (selectedMethodType === 'transfer' || paymentMethod === 'hybrid');
  
  const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  // --- LOGIKA KRITIS: KONDISI TOMBOL SUBMIT ---
  const isSubmitDisabled = submitting; // Hanya dinonaktifkan jika sedang dalam proses submit
  // --- AKHIR LOGIKA KRITIS ---

 return (
    <div className="container mx-auto p-4 md:p-6 max-w-lg space-y-6">
      <div className="flex items-center gap-2 mb-4">
        {/* PENTING: Mengubah navigasi tombol kembali */}
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-[#011e4b] hover:bg-gray-100 flex-shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0"> 
          <h1 className="text-xl font-bold text-[#011e4b] truncate">
            {order.status === 'completed' ? 'Edit Penyelesaian' : 'Selesaikan Pesanan'}
          </h1>
          <p className="text-xs text-muted-foreground truncate">Lengkapi info pesanan #{order.id.slice(0, 8)}.</p>
        </div>
      </div>

      <form onSubmit={handleCompleteDelivery} className="grid gap-4"> 
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="p-4">
            <CardTitle className="text-base text-[#011e4b]">Informasi Pesanan</CardTitle>
            <CardDescription className="text-sm">Rincian pelanggan dan barang yang dikirim.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0">
            <div>
              <Label className="text-xs text-muted-foreground">Pelanggan</Label>
              <p className="font-medium text-sm text-[#011e4b]">{order.customers?.name}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Alamat</Label>
              <p className="text-sm text-[#011e4b]">{order.customers?.address}</p>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Total Tagihan Baru</Label>
                <p className="font-bold text-base text-green-600">{formatCurrency(newGrandTotal)}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Sisa Tagihan</Label>
                <p className="font-bold text-base text-red-600">{formatCurrency(remainingDue)}</p>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label className="font-medium text-sm text-[#011e4b]">Detail Barang</Label>
              {order.order_items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">{item.products?.name}</span>
                  <span className="text-[#011e4b]">{item.qty} x {formatCurrency(item.price)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="p-4">
            <CardTitle className="text-base text-[#011e4b]">Rincian Penyelesaian</CardTitle>
            <CardDescription className="text-sm">Masukkan detail pembayaran, pengembalian, dan biaya.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 p-4 pt-0">
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-[#011e4b]">Siapa yang mengirim pesanan ini?</Label>
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                {allCompanyStaff.map((staff) => (
                  <div key={staff.id} className="flex items-center space-x-2">
                    <Checkbox 
                      id={`actual-${staff.id}`}
                      checked={actualCouriers.includes(staff.id)}
                      onCheckedChange={(checked) => {
                        setActualCouriers(prev => 
                          checked ? [...prev, staff.id] : prev.filter(id => id !== staff.id)
                        );
                      }}
                    />
                    <Label htmlFor={`actual-${staff.id}`} className="text-xs cursor-pointer text-slate-700">{staff.full_name}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="transportCost" className="text-sm">Biaya Transportasi</Label>
              <input
                id="transportCost"
                type="number"
                placeholder="Biaya Transportasi"
                value={transportCost === '0' ? '' : transportCost}
                onChange={(e) => setTransportCost(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                onWheel={handleInputWheel}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="paymentStatus" className="text-sm">Status Pembayaran</Label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Pilih Status Pembayaran" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Lunas</SelectItem>
                  <SelectItem value="partial">Sebagian</SelectItem>
                  <SelectItem value="unpaid">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="paymentMethod" className="text-sm">Metode Pembayaran</Label>
              <Select value={paymentMethod} onValueChange={handlePaymentMethodChange}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Pilih metode pembayaran" />
                </SelectTrigger>
                <SelectContent>
                   {combinedPaymentMethods.map(method => (
                     <SelectItem key={method.id} value={method.id}>
                     {method.method_name}
                      {method.type === 'transfer' && method.account_name && ` (${method.account_name})`}
                    </SelectItem>
                   ))}
                   <SelectItem value="hybrid">Cash & Transfer (Hybrid)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {showPaymentDetailsFields && (
              <>
                {paymentMethod === 'hybrid' && (
                  <div className="grid gap-2">
                    <Label htmlFor="transferMethod" className="text-sm">Pilih Metode Transfer</Label>
                    <Select value={transferMethod} onValueChange={setTransferMethod}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Pilih rekening tujuan" />
                      </SelectTrigger>
                      <SelectContent>
                        {transferMethods.length > 0 ? (
                          transferMethods.map(method => (
                            <SelectItem key={method.id} value={method.id}>
                              {method.method_name} ({method.account_name})
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem disabled>Tidak ada metode transfer</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                {showCashFields && (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="receivedByName" className="text-sm">Nama Penerima</Label>
                       <Select value={receivedByName} onValueChange={setReceivedByName}>
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Pilih Petugas penerima" />
                        </SelectTrigger>
                        <SelectContent>
                          {/* MODIFIKASI: Menggunakan allCompanyStaff */}
                          {allCompanyStaff.map(courier => (
                            <SelectItem key={courier.id} value={courier.full_name}>
                              {courier.full_name}
                            </SelectItem>
                          ))}
                          {/* ------------------------------------- */}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="cashAmount" className="text-sm">Jumlah Pembayaran Tunai</Label>
                      <input
                        id="cashAmount"
                        type="number"
                        placeholder="Jumlah Pembayaran Tunai"
                        value={cashAmount}
                        onChange={(e) => setCashAmount(e.target.value)}
                        required
                        onWheel={handleInputWheel}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>
                  </>
                )}
                
                {showTransferFields && (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="transferAmount" className="text-sm">Jumlah Pembayaran Transfer</Label>
                      <input
                        id="transferAmount"
                        type="number"
                        placeholder="Jumlah Pembayaran Transfer"
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                        readOnly={paymentMethod === 'hybrid'}
                        className={`flex h-10 w-full rounded-md border border-input px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${paymentMethod === 'hybrid' ? "bg-gray-100 cursor-not-allowed" : "bg-background"}`}
                        required
                      />
                    </div>
                    {/* INPUT BUKTI TRANSFER - DISIMPLIFIKASI DAN TANPA KAMERA */}
                    <div className="grid gap-2">
                      <div className='flex justify-between items-center'>
                          <Label htmlFor="transferProof" className="text-sm">Unggah Bukti Transfer</Label>
                          {transferProofFile && <Check className='h-4 w-4 text-green-500' />}
                      </div>
                      {/* Tombol yang memicu klik pada input file tersembunyi */}
                     <Button
                        type="button"
                        onClick={() => transferProofRef.current?.click()}
                        variant="outline"
                        className="w-full justify-start text-sm flex items-center gap-2 overflow-hidden max-w-full"
                      >
                        <Package className="h-4 w-4 text-[#011e4b] flex-shrink-0 items-center justify-center" />
                        <span className=" truncate text-left min-w-0 max-w-[85%] block">
                          {transferProofFile ? transferProofFile.name : 'Pilih File Bukti Transfer'}
                        </span>
                      </Button>

                      <input
                        id="transferProofFallback" 
                        ref={transferProofRef} 
                        type="file"
                        onChange={handleTransferProofFileChange} 
                        accept="image/*"
                        className="hidden" 
                      />
                      {initialTransferProofUrl && !transferProofFile && (
                          <a href={initialTransferProofUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                            <Eye className="h-4 w-4" /> Bukti transfer lama tersedia
                          </a>
                      )}
                    </div>
                  </>
                )}
              </>
            )}

            {allReturnableProducts.length > 0 && (
                <>
                    <Separator />
                    <div className="space-y-4">
                        <h3 className="text-base font-bold text-[#011e4b] flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            Rincian Kemasan Returnable
                        </h3>
                        
                        <div className="space-y-2 pt-2">
                            <Label className="text-sm">Pilih Kemasan yang Dikembalikan/Dibeli</Label>
                            <Popover open={isProductPopoverOpen} onOpenChange={setIsProductPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        type="button" 
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={isProductPopoverOpen}
                                        className="w-full justify-between"
                                    >
                                        {productToAddName}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0">
                                    <Command>
                                        <CommandInput placeholder="Cari Kemasan..." />
                                        <CommandList>
                                            <CommandEmpty>Kemasan tidak ditemukan.</CommandEmpty>
                                            <CommandGroup>
                                                {availableProductsForReturn.map(product => (
                                                    <CommandItem
                                                        key={product.id}
                                                        value={product.name}
                                                        onSelect={() => {
                                                            setProductToAddId(product.id);
                                                            handleAddReturnableEntry(product.id);
                                                            setIsProductPopoverOpen(false);
                                                        }}
                                                    >
                                                        {product.name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                        
                        {returnMovements.map((item, index) => {
                            const orderedQty = parseFloat(item.ordered_qty) || 0;
                            const returnedQty = parseFloat(item.returnedQty) || 0;
                            const purchasedEmptyQty = parseFloat(item.purchasedEmptyQty) || 0;
                            
                            const borrowedQty = item.isPrimarySoldItem 
                                ? Math.max(0, orderedQty - returnedQty - purchasedEmptyQty)
                                : 0; 

                            return (
                                <div key={item.product_id} className={`space-y-3 border-l-4 p-3 ${item.isPrimarySoldItem ? 'border-l-[#011e4b]' : 'border-l-gray-400 bg-gray-50'}`}>
                                    <div className='flex justify-between items-start'>
                                        <h4 className="font-semibold text-sm text-[#011e4b]">{item.product_name} 
                                            {item.isPrimarySoldItem && orderedQty > 0 && ` (${orderedQty} dipesan)`}
                                        </h4>
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={(e) => { e.stopPropagation(); handleRemoveReturnableEntry(index); }}
                                            className="shrink-0"
                                        >
                                            <X className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4"> 
                                        <div className="space-y-2">
                                            <Label htmlFor={`returnedQty-${item.product_id}`} className="text-sm">Kembali</Label>
                                            <input
                                                id={`returnedQty-${item.product_id}`}
                                                type="number"
                                                placeholder="0"
                                                value={item.returnedQty || ''}
                                                onChange={(e) => handleUpdateReturnableEntry(index, 'returnedQty', e.target.value)}
                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                min="0"
                                                onWheel={handleInputWheel}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`purchasedEmptyQty-${item.product_id}`} className="text-sm">Beli</Label>
                                            <input
                                                id={`purchasedEmptyQty-${item.product_id}`}
                                                type="number"
                                                placeholder="0"
                                                value={item.purchasedEmptyQty || ''}
                                                onChange={(e) => handleUpdateReturnableEntry(index, 'purchasedEmptyQty', e.target.value)}
                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                min="0"
                                                onWheel={handleInputWheel}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`borrowedQty-${item.product_id}`} className="text-sm">Pinjam</Label>
                                            <input
                                                id={`borrowedQty-${item.product_id}`}
                                                type="number"
                                                placeholder="0"
                                                value={borrowedQty}
                                                readOnly
                                                className="flex h-10 w-full rounded-md border border-input bg-gray-100 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-not-allowed"
                                            />
                                        </div>
                                    </div>
                                    {item.purchasedEmptyQty > 0 && (
                                        <p className="text-xs text-muted-foreground mt-2">
                                            * Pembelian Kemasan Returnable akan menambah tagihan sebesar {formatCurrency(item.purchasedEmptyQty * (item.empty_bottle_price || 0))}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
            
            {/* INPUT BUKTI PENGIRIMAN - DISIMPLIFIKASI DAN TANPA KAMERA */}
            <div className="grid gap-2">
              <div className='flex justify-between items-center'>
                  <Label htmlFor="proofFile" className="text-sm">
                    Unggah Bukti Pengiriman 
                  </Label>
                  {deliveryFile && <Check className='h-4 w-4 text-green-500' />}
              </div>
              {/* Tombol yang memicu klik pada input file tersembunyi */}
              <Button 
                    type="button" 
                    onClick={() => proofFileRef.current?.click()}
                    variant="outline"
                    className="w-full justify-start"
                >
                    <Package className='h-4 w-4 mr-2 text-[#011e4b] flex-shrink-0' /> 
                    <span className="text-[9px] truncate flex-1 text-left min-w-0">
                        {deliveryFile ? deliveryFile.name : (initialDeliveryProofUrl ? 'File lama tersedia' : 'Pilih File Bukti Pengiriman')}
                    </span>
                </Button>
              <input
                id="proofFileFallback" 
                ref={proofFileRef} // Menggunakan ref untuk akses langsung
                type="file"
                onChange={handleDeliveryFileChange} 
                accept="image/*" 
                className="hidden"  
              />
              {initialDeliveryProofUrl && !deliveryFile && (
                  <a href={initialDeliveryProofUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                    <Eye className="h-4 w-4" /> Lihat bukti pengiriman lama
                  </a>
              )}
            </div>
          </CardContent>
        </Card>
        
        <div className="mt-2">
          <Button 
            type="submit" 
            className="w-full bg-[#011e4b] text-white hover:bg-[#00376a] text-sm" 
            disabled={isSubmitDisabled} 
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <PackageCheck className="h-4 w-4 mr-2" />
            )}
            Selesaikan Pesanan
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CompleteDeliveryPage;