import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter, 
  DialogDescription
} from '@/components/ui/dialog';
import { toast } from 'react-hot-toast';
import { Loader2, Plus, Users, MessageSquareText, Pencil, Trash2, Settings, Truck, History, CalendarClock, DollarSign, MapPin, Search, Download, ChevronsUpDown, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge'; 
import { Textarea } from '@/components/ui/textarea'; 
import AddDropshipperModal from '@/components/AddDropshipperModal';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';


// --- IMPORT MODAL BARU ---
import WhatsappTemplateSettingsModal from '@/components/WhatsappTemplateSettingsModal';

// --- GOOGLE MAPS IMPORTS ---
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from '@react-google-maps/api';
import CryptoJS from 'crypto-js'; // Tambahkan ini di deretan import
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'fallback-key-proyek-rahasia';

// --- KONSTANTA ---
const LIBRARIES = ['places']; 
const DEFAULT_CENTER = { lat: -6.200000, lng: 106.816666 }; 

// --- HELPER FORMATTER ---
const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount ?? 0);
const formatDays = (days) => (!days || days === 0) ? '-' : `${Math.round(days)} Hari Sekali`;

const formatDate = (dateString, avgInterval) => {
    if (!dateString) return <span className="text-gray-400 italic text-[10px]">Belum pernah</span>;
    const lastOrder = new Date(dateString);
    const today = new Date();
    const diffTime = Math.abs(today - lastOrder);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const isOverdue = avgInterval > 0 && diffDays > avgInterval;

    return (
        <span className={isOverdue ? "text-red-600 font-bold animate-pulse" : ""}>
            {new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
    );
};

// --- KOMPONEN LOCATION PICKER ---
const LocationPicker = ({ onLocationSelect, initialLocation }) => {
    const [map, setMap] = useState(null);
    const [markerPos, setMarkerPos] = useState(initialLocation || DEFAULT_CENTER);
    const autocompleteRef = useRef(null);
    
    

    const handlePlaceChanged = () => {
        const place = autocompleteRef.current.getPlace();
        if (place.geometry && place.geometry.location) {
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            const address = place.formatted_address;
            const newPos = { lat, lng };
            setMarkerPos(newPos);
            map.panTo(newPos);
            map.setZoom(17);
            onLocationSelect({ address: address, latitude: lat, longitude: lng });
        } else {
            toast.error("Pilih alamat yang valid dari daftar dropdown.");
        }
    };

    const handleMapClick = (e) => {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        setMarkerPos({ lat, lng });
        onLocationSelect({ latitude: lat, longitude: lng });
    };

    return (
        <div className="space-y-2">
            <div className="relative">
                <Autocomplete onLoad={ref => autocompleteRef.current = ref} onPlaceChanged={handlePlaceChanged}>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <Input placeholder="Ketik nama jalan / gedung..." className="pl-9 border-blue-200 focus:border-blue-500" />
                    </div>
                </Autocomplete>
            </div>
            <div className="h-[200px] md:h-[250px] w-full rounded-md overflow-hidden border">
                <GoogleMap mapContainerStyle={{ width: '100%', height: '100%' }} center={markerPos} zoom={13} onLoad={setMap} onClick={handleMapClick} options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}>
                    <Marker position={markerPos} draggable={true} onDrDropshipperd={handleMapClick} />
                </GoogleMap>
            </div>
            <p className="text-[10px] text-gray-500 text-right">*Geser pin atau klik peta untuk sesuaikan titik.</p>
        </div>
    );
};

// --- KOMPONEN MODAL HARGA ---
const PriceSettingsModal = ({ isOpen, onClose, companyId, statuses, initialStatus }) => {
    const [selectedStatus, setSelectedStatus] = useState(initialStatus || '');
    const [products, setProducts] = useState([]);
    const [prices, setPrices] = useState({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && initialStatus) setSelectedStatus(initialStatus);
        else if (isOpen && !initialStatus && !selectedStatus && statuses.length > 0) setSelectedStatus(statuses[0]);
    }, [isOpen, initialStatus, statuses]);

    useEffect(() => {
        if(isOpen && companyId) {
            const fetchProducts = async () => {
                const { data } = await supabase.from('products').select('id, name').eq('company_id', companyId).eq('is_active', true);
                setProducts(data || []);
            };
            fetchProducts();
        }
    }, [isOpen, companyId]);

    useEffect(() => {
        if (selectedStatus && companyId) {
            const fetchPrices = async () => {
                setLoading(true);
                const { data } = await supabase.from('product_prices').select('product_id, price').eq('company_id', companyId).eq('customer_status', selectedStatus);
                const priceMap = {};
                data?.forEach(p => { priceMap[p.product_id] = p.price; });
                setPrices(priceMap);
                setLoading(false);
            };
            fetchPrices();
        } else setPrices({});
    }, [selectedStatus, companyId]);

    // Cari fungsi handleSave di dalam PriceSettingsModal
    const handleSave = async () => {
        setLoading(true);
        try {
            const updates = products.map(prod => ({
                company_id: companyId,
                customer_status: selectedStatus,
                product_id: prod.id,
                price: parseFloat(prices[prod.id]) || 0
            }));

            // Pastikan onConflict sesuai dengan kolom yang kita buat unik di SQL tadi
            const { error } = await supabase
                .from('product_prices')
                .upsert(updates, { 
                    onConflict: 'company_id, customer_status, product_id' 
                });

            if (error) throw error;
            
            toast.success(`Harga untuk status ${selectedStatus} diperbarui!`);
            onClose();
        } catch (error) { 
            console.error(error);
            toast.error("Gagal menyimpan harga: " + error.message); 
        } finally { 
            setLoading(false); 
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg w-[95vw] max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2"><DialogTitle>Atur Harga: {selectedStatus}</DialogTitle></DialogHeader>
                <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-4">
                    <div className="space-y-2">
                        <Label>Pilih Status</Label>
                        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                            <SelectTrigger><SelectValue placeholder="Pilih Status..." /></SelectTrigger>
                            <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    {selectedStatus && (
                        <div className="space-y-3 border rounded-md p-3 bg-gray-50">
                            {products.map(prod => (
                                <div key={prod.id} className="flex items-center justify-between gap-4">
                                    <Label className="text-sm flex-1">{prod.name}</Label>
                                    <Input type="number" className="w-32 h-8 text-right" placeholder="0" value={prices[prod.id] || ''} onChange={e => setPrices(prev => ({ ...prev, [prod.id]: e.target.value }))} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <DialogFooter className="p-6 pt-2 border-t bg-gray-50/50">
                    <Button onClick={handleSave} className="w-full sm:w-auto" disabled={loading || !selectedStatus}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Simpan'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const CustomersPage = () => {
  // 1. Ambil context auth di paling atas
  const { companyId, companyName, userRole, userId } = useAuth();
  
  // 2. Load Google Maps
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES 
  });

  // 3. States
  const [customers, setCustomers] = useState([]);
  const [customerStatuses, setCustomerStatuses] = useState([]);
  const [dropshippers, setDropshippers] = useState([]); // List Dropshipper untuk Admin
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [processingWA, setProcessingWA] = useState({});
  const [isDsPickerOpen, setIsDsPickerOpen] = useState(false);
  const [isModalDsOpen, setIsModalDsOpen] = useState(false);
    const [validDsStatuses, setValidDsStatuses] = useState([]);
  // 4. Inisialisasi Form Data (Sekarang aman karena userRole & userId sudah di-destructuring di atas)
  const [formData, setFormData] = useState({ 
      name: '', 
      phone: '', 
      address: '', 
      latitude: null, 
      longitude: null, 
      customer_status: '', 
      default_transport_cost: 0,
      dropshipper_id: userRole === 'dropship' ? userId : '' 
    });
    
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [activeTemplates, setActiveTemplates] = useState({});
    const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
    const [selectedStatusForPrice, setSelectedStatusForPrice] = useState(null);
    
    const fetchActiveTemplates = useCallback(async () => {
        if (!companyId) return;
        const { data } = await supabase
        .from('whatsapp_templates')
        .select('template_name, template_text')
        .eq('company_id', companyId);
        if (data) {
            const map = {};
            data.forEach(t => { map[t.template_name] = t.template_text; });
            setActiveTemplates(map);
        }
    }, [companyId]);

    const fetchValidDsStatuses = useCallback(async () => {
        if (userRole !== 'dropship' || !userId) return;

        try {
            // Ambil pengaturan komisi yang spesifik memiliki nilai > 0
            const { data, error } = await supabase
                .from('dropshipper_settings')
                .select('customer_status')
                .eq('dropshipper_id', userId)
                .gt('commission_value', 0); 

            if (error) throw error;

            // Karena satu status bisa punya banyak produk, kita ambil yang unik saja (Set)
            // Ini memastikan jika "Gold" punya komisi di "Susu" tapi 0 di "Beras", 
            // status "Gold" tetap muncul di pilihan Dropshipper.
            const uniqueStatuses = Array.from(new Set(data.map(item => item.customer_status)));
            
            setValidDsStatuses(uniqueStatuses);
        } catch (err) {
            console.error("Gagal sinkronisasi matrix komisi:", err);
        }
    }, [userRole, userId]);
    
    // 2. Baru panggil useEffect-nya
    useEffect(() => {
        if (companyId) {
            fetchCustomers();
            fetchCustomerStatuses();
            fetchActiveTemplates();
            if (userRole === 'dropship') fetchValidDsStatuses();
            
            // --- PERBAIKAN DI SINI ---
            // Ubah kondisinya agar role 'user' juga melakukan fetch data dropshipper
            if (userRole !== 'dropship') {
                const fetchDs = async () => {
                    const { data } = await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .eq('company_id', companyId)
                    .eq('role', 'dropship');
                    setDropshippers(data || []);
                };
                fetchDs();
            }
        }
    }, [companyId, userRole, fetchActiveTemplates, fetchValidDsStatuses]);
    
    // --- FUNGSI-FUNGSI ---
    
    // --- AKTIFKAN KEMBALI KODE INI ---
    const resetForm = () => {
        setFormData({ 
            name: '', 
            phone: '', 
            address: '', 
            latitude: null, 
            longitude: null, 
            customer_status: '', 
            default_transport_cost: 0,
            dropshipper_id: userRole === 'dropship' ? userId : null 
        });
        setCurrentCustomer(null);
        setIsModalOpen(false);
    };
    
    const handleEditClick = (customer) => {
        setFormData({ 
            name: customer.name || '', 
            phone: customer.phone || '', 
            address: customer.address || '', 
            latitude: customer.latitude || null, 
            longitude: customer.longitude || null, 
            customer_status: customer.customer_status || '', 
            default_transport_cost: customer.default_transport_cost || 0,
            dropshipper_id: customer.dropshipper_id || null 
        });
        setCurrentCustomer(customer);
        setIsModalOpen(true);
    };
    
    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_customer_metrics', { p_company_id: companyId });
            if (error) throw error;
            
            let result = data || [];
            
            // --- LOGIKA FILTER DROPSHIP ---
            if (userRole === 'dropship') {
                result = result.filter(c => c.dropshipper_id === userId);
            }
            
            setCustomers(result.sort((a, b) => new Date(b.last_order_date || 0) - new Date(a.last_order_date || 0)));
        } catch (err) { 
            toast.error("Gagal memuat data pelanggan"); 
        } finally { 
            setLoading(false); 
        }
    };
    
    const filteredCustomers = customers.filter((customer) => {
        const query = searchQuery.toLowerCase();
        const matchesSearch = customer.name?.toLowerCase().includes(query) || customer.phone?.toLowerCase().includes(query) || customer.address?.toLowerCase().includes(query);
        const matchesStatus = statusFilter === "all" || customer.customer_status === statusFilter;
        return matchesSearch && matchesStatus;
    });
    
    const handleExportToExcel = () => {
        if (filteredCustomers.length === 0) return toast.error("Tidak ada data untuk diexport");
        const headers = ["Nama", "Telepon", "Alamat", "Status", "Biaya Transport", "Total Order", "Interval (Hari)", "Terakhir Order"];
        const csvRows = filteredCustomers.map(c => [`"${c.name}"`, `"${c.phone}"`, `"${c.address?.replace(/"/g, '""') || '-'}"`, `"${c.customer_status || 'Umum'}"`, c.default_transport_cost || 0, c.total_orders || 0, Math.round(c.avg_order_interval) || 0, c.last_order_date ? new Date(c.last_order_date).toLocaleDateString('id-ID') : '-' ].join(','));
        const csvContent = "\ufeff" + [headers.join(','), ...csvRows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Daftar_Pelanggan_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Data berhasil diexport!");
    };
    
    const fetchCustomerStatuses = async () => {
        const { data } = await supabase.from('customer_statuses').select('status_name').eq('company_id', companyId);
        if (data) setCustomerStatuses(data.map(item => item.status_name));
    };
    
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };
    
    const handleLocationSelect = ({ address, latitude, longitude }) => {
        setFormData(prev => ({ ...prev, address: address || prev.address, latitude: latitude, longitude: longitude }));
    };
    
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        
        // Pastikan jika nilai picker adalah null/undefined, kirim null ke DB
        const dsId = formData.dropshipper_id || null;
        
        const payload = { 
            name: formData.name,
            phone: formData.phone,
            address: formData.address,
            latitude: formData.latitude,
            longitude: formData.longitude,
            customer_status: formData.customer_status,
            default_transport_cost: parseFloat(formData.default_transport_cost) || 0,
            dropshipper_id: dsId // UUID atau NULL
        };
        
        try {
            if (currentCustomer) { 
                // 1. Jalankan Update
                const { error } = await supabase
                .from('customers')
                .update(payload)
                .eq('id', currentCustomer.id);
                
                if (error) throw error;
                toast.success('Pelanggan berhasil diperbarui!');
            } else { 
                // 2. Jalankan Insert
                const { error } = await supabase
                .from('customers')
                .insert([{ ...payload, company_id: companyId }]);
                
                if (error) throw error;
                toast.success('Pelanggan baru ditambahkan!');
            }
            
            // 3. PENTING: Panggil ulang data dari server
            await fetchCustomers(); 
            resetForm();
        } catch (error) { 
            console.error("Submit Error:", error);
            toast.error('Gagal menyimpan: ' + error.message); 
        } finally { 
            setLoading(false); 
        }
    };
    
    // const resetForm = () => {
        //   setFormData({ 
            //     name: '', phone: '', address: '', latitude: null, longitude: null, 
            //     customer_status: '', default_transport_cost: 0,
            //     dropshipper_id: userRole === 'dropship' ? userId : '' 
            //   });
            //   setCurrentCustomer(null);
            //   setIsModalOpen(false);
            // };
            
            // const handleEditClick = (customer) => {
                //   setFormData({ name: customer.name, phone: customer.phone, address: customer.address, latitude: customer.latitude, longitude: customer.longitude, customer_status: customer.customer_status, default_transport_cost: customer.default_transport_cost || 0, dropshipper_id: customer.dropshipper_id || '' });
                //   setCurrentCustomer(customer);
                //   setIsModalOpen(true);
                // };
                
                const handleDeleteClick = async (id) => {
                    if (!window.confirm('Hapus pelanggan ini?')) return;
                    const { error } = await supabase.from('customers').delete().eq('id', id);
                    if (!error) { setCustomers(customers.filter(c => c.id !== id)); toast.success('Dihapus.'); }
                };
                
                const handlePriceClick = (status) => {
                    if (!status) { toast.error("Pelanggan ini tidak memiliki status."); return; }
                    setSelectedStatusForPrice(status);
                    setIsPriceModalOpen(true);
                };
                
                const sendViaFonnte = async (target, message) => {
                    try {
                        // 1. Ambil data perusahaan untuk mendapatkan token
                        const { data: companyData, error: companyError } = await supabase
                        .from('companies')
                        .select('fonnte_token')
                        .eq('id', companyId)
                        .single();
                        
                        if (companyError || !companyData?.fonnte_token) {
                            console.log("Token tidak ditemukan, dialihkan ke WA Web.");
                            return false; 
                        }
                        
                        // 2. Dekripsi Token
                        let decryptedToken = "";
                        try {
                            const bytes = CryptoJS.AES.decrypt(companyData.fonnte_token, ENCRYPTION_KEY);
                            decryptedToken = bytes.toString(CryptoJS.enc.Utf8);
                            if (!decryptedToken) decryptedToken = companyData.fonnte_token; // Fallback jika data lama tidak terenkripsi
                        } catch (e) {
                            decryptedToken = companyData.fonnte_token;
                        }
                        
                        // 3. Kirim ke API Fonnte
                        const response = await fetch('https://api.fonnte.com/send', {
                            method: 'POST',
                            headers: { 'Authorization': decryptedToken },
                            body: new URLSearchParams({
                                target: target,
                                message: message,
                                countryCode: '62', // Kode negara Indonesia
                            }),
                        });
                        
                        const result = await response.json();
                        return result.status === true; // Kembalikan true jika berhasil terkirim via API
                        
                    } catch (err) {
                        console.error("Fonnte Error:", err);
                        return false; // Jika error (misal jaringan), fallback ke WA Web
                    }
                };
                
                const handleContactCustomer = async (customer) => {
                    const customerId = customer.id;
                    if (processingWA[customerId]) return;
                    
                    setProcessingWA(prev => ({ ...prev, [customerId]: true }));
                    const tid = toast.loading(`Mempersiapkan pesan untuk ${customer.name}...`);
                    
                    try {
                        const phone = (customer.phone || '').replace(/[^\d]/g, '');
                        const template = activeTemplates['reminder_message'] || `Assalamualaikum {{customerName}}, kami dari {{companyName}}...`;
                        
                        const finalMessage = template
                        .replace(/{{companyName}}/g, companyName || 'Toko Kami')
                        .replace(/{{customerName}}/g, customer.name);
                        
                        const isAutoSent = await sendViaFonnte(phone, finalMessage);
                        
                        if (isAutoSent) {
                            toast.success(`Pesan ke ${customer.name} Terkirim!`, { id: tid });
                        } else {
                            toast.dismiss(tid);
                            window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(finalMessage)}`, '_blank');
                        }
                    } catch (err) {
                        toast.error('Gagal: ' + err.message, { id: tid });
                    } finally {
                        setTimeout(() => {
                            setProcessingWA(prev => ({ ...prev, [customerId]: false }));
                        }, 3000);
                    }
                };
                
                if (!isLoaded || (loading && customers.length === 0)) return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin" /></div>;
                
                return (
                    <div className="container mx-auto p-4 md:p-8 max-w-7xl space-y-6">
      
      {/* HEADER */}
      {/* HEADER */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-4 gap-3">
        <h1 className="text-2xl font-bold text-[#011e4b] flex items-center gap-2">
            <Users className="h-6 w-6" /> Manajemen Pelanggan
        </h1>
        <div className="flex flex-wrap gap-2 w-full xl:w-auto">
            <Button onClick={handleExportToExcel} variant="outline" className="text-blue-700 border-blue-200 hover:bg-blue-50">
                <Download className="h-4 w-4 mr-2" /> Export Excel
            </Button>

            {/* HANYA MUNCUL JIKA BUKAN DROPSHIP */}
            {userRole !== 'dropship' && (
                <>
                <Button 
                    onClick={() => { setSelectedStatusForPrice(null); setIsPriceModalOpen(true); }} 
                    variant="outline" 
                    className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200"
                    >
                    <DollarSign className="h-4 w-4 mr-2" /> Atur Harga Status
                </Button>
                <Button onClick={() => setIsTemplateModalOpen(true)} variant="outline">
                    <Settings className="h-4 w-4 mr-2" /> Atur Pesan WA
                </Button>
                </>
            )}

            <Button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-[#011e4b] text-white">
                <Plus className="h-4 w-4 mr-2" /> Tambah Pelanggan
            </Button>
        </div>
        </div>

      {/* TABEL PELANGGAN */}
      <Card className="border-0 shadow-sm bg-white">
        <CardHeader className="p-4 border-b">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                <CardTitle className="text-lg font-semibold">Daftar Pelanggan</CardTitle>
                <div className="flex w-full md:w-auto gap-2">
                    <Input placeholder="Cari nama, hp, alamat..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full md:w-64" />
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[150px]"><SelectValue placeholder="Semua Status" /></SelectTrigger>
                        <SelectContent>
                        <SelectItem value="all">Semua Status</SelectItem>
                        {customerStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-md overflow-x-auto">
            <Table className="min-w-[1000px]">
              <TableHeader>
                <TableRow className="bg-gray-50/50">
                  <TableHead className="w-[50px]">No</TableHead>
                  <TableHead className="min-w-[150px]">Pelanggan</TableHead>
                  <TableHead>Dropshipper</TableHead>
                  <TableHead>Kontak & Alamat</TableHead>
                  <TableHead>Status & Biaya</TableHead>
                  <TableHead className="text-center"><div className="flex items-center justify-center gap-1 text-xs"><History className="h-3 w-3" /> Total</div></TableHead>
                  <TableHead className="text-center"><div className="flex items-center justify-center gap-1 text-xs"><CalendarClock className="h-3 w-3" /> Interval</div></TableHead>
                  <TableHead className="text-right text-xs">Terakhir Order</TableHead>
                  <TableHead className="text-center w-[160px]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                 {filteredCustomers.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-gray-500">Tidak ada data pelanggan.</TableCell></TableRow>}
                 {filteredCustomers.map((customer, idx) => (
                     <TableRow key={customer.id} className="hover:bg-blue-50/30">
                    <TableCell className="text-center text-gray-500">{idx + 1}</TableCell>
                    <TableCell>
                        <div className="font-semibold text-[#011e4b] flex items-center gap-2">{customer.name} {customer.latitude && <MapPin className="h-3 w-3 text-blue-500" />}</div>
                        <Badge variant="secondary" className="mt-1 text-[10px] h-5">{customer.customer_status || 'Umum'}</Badge>
                    </TableCell>
                    <TableCell>
                      {customer.dropshipper_id ? (
                          <div className="flex flex-col">
                              <span className="text-xs font-bold text-blue-700">
                                  {/* Jika saya dropshipper, tampilkan nama saya. Jika admin, cari di list dropshippers */}
                                  {userRole === 'dropship' && customer.dropshipper_id === userId 
                                    ? "Milik Saya" 
                                    : (dropshippers.find(d => d.id === customer.dropshipper_id)?.full_name || 'Dropshipper Terdaftar')}
                              </span>
                              <span className="text-[10px] text-gray-400">Dropship</span>
                          </div>
                      ) : (
                          <span className="text-xs text-gray-400 italic">Langsung (Admin)</span>
                        )}
                    </TableCell>
                    <TableCell>
                        <div className="text-sm">{customer.phone}</div>
                        <div className="text-xs text-gray-500 truncate max-w-[200px]" title={customer.address}>{customer.address || '-'}</div>
                    </TableCell>
                    <TableCell><div className="flex items-center gap-1 text-xs text-slate-600"><Truck className="h-3 w-3" /> {formatCurrency(customer.default_transport_cost)}</div></TableCell>
                    <TableCell className="text-center font-bold text-gray-700">{customer.total_orders || 0}</TableCell>
                    <TableCell className="text-center"><Badge variant="outline" className="bg-white font-normal text-xs whitespace-nowrap">{formatDays(customer.avg_order_interval)}</Badge></TableCell>
                    <TableCell className="text-right">{formatDate(customer.last_order_date, customer.avg_order_interval)}</TableCell>
                    <TableCell className="text-center">
                    <div className="flex justify-center gap-1">
                        {userRole !== 'dropship' && (
                            <div className='flex'>
                            <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handlePriceClick(customer.customer_status)} 
                            className="h-8 w-8 text-yellow-600 bg-yellow-50 hover:bg-yellow-100"
                            >
                                <DollarSign className="h-4 w-4" />
                            </Button>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleContactCustomer(customer)}
                            disabled={processingWA[customer.id]}
                            className={`h-8 w-8 text-green-600 bg-green-50 hover:bg-green-100 ${processingWA[customer.id] ? 'opacity-50' : ''}`}
                            >
                            {processingWA[customer.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareText className="h-4 w-4" />}
                        </Button>
                                
                        </div>
                        )}

                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(customer)} className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(customer.id)} className="h-8 w-8 text-red-500"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* MODAL EDIT/ADD CUSTOMER */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-xl w-[95vw] max-h-[90vh] flex flex-col p-0 overflow-hidden" onInteractOutside={(e) => { if (e.target.closest('.pac-container')) { e.preventDefault(); } }}>
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>{currentCustomer ? 'Edit Pelanggan' : 'Tambah Pelanggan'}</DialogTitle>
            <DialogDescription>Isi detail pelanggan dan tentukan titik koordinat.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 pt-2">
            <form id="customer-form" onSubmit={handleFormSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Nama Pelanggan</Label><Input name="name" value={formData.name} onChange={handleInputChange} required /></div>
                    <div className="space-y-2"><Label>Nomor Telepon</Label><Input name="phone" value={formData.phone} onChange={handleInputChange} placeholder="08..." /></div>
                </div>
                <div className="space-y-2">
                    <Label>Lokasi & Alamat (Cari di Peta)</Label>
                    <LocationPicker onLocationSelect={handleLocationSelect} initialLocation={formData.latitude && formData.longitude ? { lat: formData.latitude, lng: formData.longitude } : null} />
                </div>
                <div className="space-y-2"><Label>Alamat Lengkap (Teks)</Label><Textarea name="address" value={formData.address} onChange={handleInputChange} placeholder="Detail jalan, nomor rumah, patokan..." className="h-20" /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Biaya Transport (Rp)</Label><Input type="number" name="default_transport_cost" value={formData.default_transport_cost} onChange={handleInputChange} /></div>
                   <div className="space-y-2">
                        <Label>Status Pelanggan</Label>
                        <Select 
                            value={formData.customer_status} 
                            onValueChange={(v) => setFormData({...formData, customer_status: v})} 
                            required
                        >
                            <SelectTrigger><SelectValue placeholder="Pilih Status" /></SelectTrigger>
                            <SelectContent>
                                {customerStatuses
                                    .filter(status => {
                                        // LOGIKANYA DI SINI:
                                        // Jika login sebagai dropship, hanya tampilkan yang ada di list valid (komisi > 0)
                                        if (userRole === 'dropship') {
                                            return validDsStatuses.includes(status);
                                        }
                                        // Jika admin/super_admin, tampilkan semua tanpa filter
                                        return true;
                                    })
                                    .map(status => (
                                        <SelectItem key={status} value={status}>{status}</SelectItem>
                                    ))
                                }
                                {/* Tampilkan pesan jika tidak ada status yang tersedia untuk Dropshipper */}
                                {userRole === 'dropship' && validDsStatuses.length === 0 && (
                                    <SelectItem value="none" disabled>Skema komisi belum diset Admin</SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Dropshipper (Dropshipper)</Label>
                      <Popover open={isDsPickerOpen} onOpenChange={setIsDsPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            disabled={userRole === 'dropship'}
                            className="w-full justify-between font-normal bg-white"
                            >
                            {formData.dropshipper_id 
                              ? dropshippers.find((d) => d.id === formData.dropshipper_id)?.full_name 
                              : "Tanpa Dropshipper (Umum)"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0" align="start" onPointerDownOutside={(e) => e.preventDefault()}>
                          <Command>
                            <CommandInput placeholder="Cari Dropshipper..." />
                            <CommandList>
                              <CommandEmpty>Dropshipper tidak ditemukan.</CommandEmpty>
                              <CommandGroup>
                                <CommandItem
                                  value="tanpa-Dropshipper-umum" // Beri string unik, jangan biarkan kosong
                                  onSelect={() => {
                                      setFormData({ ...formData, dropshipper_id: null });
                                      setIsDsPickerOpen(false);
                                    }}
                                    >
                                  <CheckCircle2 className={`mr-2 h-4 w-4 ${!formData.dropshipper_id ? "opacity-100" : "opacity-0"}`} />
                                  Tanpa Dropshipper (Umum)
                                </CommandItem>
                                {dropshippers.map((ds) => (
                                    <CommandItem
                                    key={ds.id}
                                    value={ds.full_name || ""} // Pastikan string
                                    onSelect={() => {
                                        setFormData({ ...formData, dropshipper_id: ds.id });
                                        setIsDsPickerOpen(false);
                                    }}
                                    >
                                    <CheckCircle2 className={`mr-2 h-4 w-4 ${formData.dropshipper_id === ds.id ? "opacity-100" : "opacity-0"}`} />
                                    {ds.full_name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>

                            {/* BUTTON ADD DI DALAM DROPDOWN */}
                            {(userRole === 'admin' || userRole === 'super_admin') && (
                                <div className="p-2 border-t">
                                <Button 
                                  type="button" 
                                  variant="ghost" 
                                  size="sm" 
                                  className="w-full justify-start text-blue-600 font-bold"
                                  onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation(); // Tambahkan ini
                                      setIsDsPickerOpen(false);
                                      setIsModalDsOpen(true);
                                    }}
                                    >
                                  <Plus className="mr-2 h-4 w-4" /> Tambah Dropshipper Baru
                                </Button>
                              </div>
                            )}
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                </div>
            </form>
          </div>
          <DialogFooter className="p-6 pt-2 border-t bg-gray-50/50">
            <Button type="submit" form="customer-form" className="w-full bg-[#011e4b] text-white">{currentCustomer ? 'Perbarui' : 'Simpan'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* MODAL PENGATURAN WA BARU */}
      <WhatsappTemplateSettingsModal 
        isOpen={isTemplateModalOpen} 
        onOpenChange={(open) => {
            setIsTemplateModalOpen(open);
            if (!open) fetchActiveTemplates(); 
        }} 
        />

      <PriceSettingsModal isOpen={isPriceModalOpen} onClose={() => setIsPriceModalOpen(false)} companyId={companyId} statuses={customerStatuses} initialStatus={selectedStatusForPrice} />
        <AddDropshipperModal 
          isOpen={isModalDsOpen} 
          onOpenChange={setIsModalDsOpen} 
          companyId={companyId}
          onSuccess={() => {
              // Refresh list dropshipper setelah nambah baru
              const fetchDs = async () => {
                  const { data } = await supabase.from('profiles').select('id, full_name').eq('company_id', companyId).eq('role', 'dropship');
                  setDropshippers(data || []);
                };
                fetchDs();
            }}
            />
    </div>
    
);
};

export default CustomersPage;
