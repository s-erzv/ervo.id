import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import { Loader2, ShieldAlert, Search, MapPin, UserPlus, Check, ChevronsUpDown } from 'lucide-react';
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from '@react-google-maps/api';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

// Import modal yang diminta
import AddDropshipperModal from './AddDropshipperModal';

const LIBRARIES = ['places'];
const DEFAULT_CENTER = { lat: -6.200000, lng: 106.816666 };

// --- KOMPONEN INTERNAL: LOCATION PICKER ---
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
            <Autocomplete onLoad={ref => autocompleteRef.current = ref} onPlaceChanged={handlePlaceChanged}>
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input placeholder="Cari alamat di peta..." className="pl-9 text-sm" />
                </div>
            </Autocomplete>
            <div className="h-[180px] w-full rounded-lg overflow-hidden border">
                <GoogleMap 
                    mapContainerStyle={{ width: '100%', height: '100%' }} 
                    center={markerPos} zoom={15} onLoad={setMap} onClick={handleMapClick}
                    options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
                >
                    <Marker position={markerPos} draggable onDragEnd={handleMapClick} />
                </GoogleMap>
            </div>
        </div>
    );
};

const CustomerForm = ({ isOpen, onOpenChange, onCustomerAdded, initialDropshipperId }) => {
  const { companyId, userRole, userId } = useAuth();
  
  // States
  const [customerStatuses, setCustomerStatuses] = useState([]);
  const [validDsStatuses, setValidDsStatuses] = useState([]);
  const [dropshippers, setDropshippers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isDsPickerOpen, setIsDsPickerOpen] = useState(false);
  const [isAddDsModalOpen, setIsAddDsModalOpen] = useState(false);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES
  });
  
  const [formData, setFormData] = useState({ 
    name: '', 
    phone: '', 
    address: '',
    latitude: null,
    longitude: null,
    customer_status: '',
    default_transport_cost: 0,
    dropshipper_id: userRole === 'dropship' ? userId : (initialDropshipperId || null)
  });

  const fetchData = useCallback(async () => {
    if (!companyId) return;
    
    // 1. Fetch Status
    const { data: statuses } = await supabase.from('customer_statuses').select('status_name').eq('company_id', companyId);
    setCustomerStatuses(statuses?.map(s => s.status_name) || []);

    // 2. Fetch Dropshippers (Jika Admin)
    if (userRole !== 'dropship') {
        const { data: ds } = await supabase.from('profiles').select('id, full_name').eq('company_id', companyId).eq('role', 'dropship');
        setDropshippers(ds || []);
    }

    // 3. Fetch Matrix Komisi (Jika Dropship)
    if (userRole === 'dropship') {
        const { data: dsSettings } = await supabase.from('dropshipper_settings').select('customer_status').eq('dropshipper_id', userId).gt('commission_value', 0);
        setValidDsStatuses(Array.from(new Set(dsSettings?.map(item => item.customer_status) || [])));
    }
  }, [companyId, userRole, userId]);

  useEffect(() => {
    if (isOpen) fetchData();
  }, [isOpen, fetchData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        company_id: companyId,
        default_transport_cost: parseFloat(formData.default_transport_cost) || 0
      };

      const { data, error } = await supabase.from('customers').insert([payload]).select().single();
      if (error) throw error;
      
      toast.success('Pelanggan berhasil disimpan!');
      if (onCustomerAdded) onCustomerAdded(data);
      resetForm();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ 
      name: '', phone: '', address: '', latitude: null, longitude: null,
      customer_status: '', default_transport_cost: 0,
      dropshipper_id: userRole === 'dropship' ? userId : null
    });
    onOpenChange(false);
  };

  const displayStatuses = customerStatuses.filter(status => {
    if (userRole === 'dropship') return validDsStatuses.includes(status);
    return true;
  });

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl w-[95vw] max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-xl border-none shadow-2xl">
        <DialogHeader className="p-6 bg-[#10182b] text-white shrink-0">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-blue-400" /> Tambah Pelanggan
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Pastikan data alamat dan status harga sudah sesuai.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 bg-slate-50/50">
            {/* ALERT DROPSHIP TANPA KOMISI */}
            {userRole === 'dropship' && validDsStatuses.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex gap-2 items-start">
                    <ShieldAlert className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                        Anda belum memiliki matrix komisi aktif dari Admin. Anda tidak dapat memilih status pelanggan saat ini.
                    </p>
                </div>
            )}

            <form id="customer-form-main" onSubmit={handleFormSubmit} className="space-y-5">
                {/* SECTION 1: IDENTITY */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-600">Nama Pelanggan</Label>
                        <Input name="name" value={formData.name} onChange={handleInputChange} placeholder="Contoh: Bpk. Budi" required className="bg-white" />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-600">No. WhatsApp</Label>
                        <Input name="phone" value={formData.phone} onChange={handleInputChange} placeholder="0812..." className="bg-white" />
                    </div>
                </div>

                {/* SECTION 2: MAPS */}
                <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600 flex items-center gap-1"><MapPin className="h-3 w-3" /> Titik Lokasi & Alamat</Label>
                    {isLoaded ? (
                        <LocationPicker 
                            onLocationSelect={({address, latitude, longitude}) => {
                                setFormData(p => ({...p, address: address || p.address, latitude, longitude}));
                            }} 
                        />
                    ) : <div className="h-[180px] bg-slate-200 animate-pulse rounded-lg" />}
                    <Textarea 
                        name="address" 
                        value={formData.address} 
                        onChange={handleInputChange} 
                        placeholder="Detail patokan atau nomor rumah..." 
                        className="text-sm bg-white h-20 mt-2" 
                    />
                </div>

                {/* SECTION 3: CONFIGURATION */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-600">Status Harga</Label>
                        <Select value={formData.customer_status} onValueChange={(v) => setFormData(p => ({...p, customer_status: v}))} required>
                            <SelectTrigger className="bg-white"><SelectValue placeholder="Pilih Status" /></SelectTrigger>
                            <SelectContent>
                                {displayStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                {displayStatuses.length === 0 && <SelectItem disabled value="none">Tidak ada status tersedia</SelectItem>}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-600">Ongkir Default (Rp)</Label>
                        <Input type="number" name="default_transport_cost" value={formData.default_transport_cost} onChange={handleInputChange} className="bg-white" />
                    </div>
                </div>

                {/* SECTION 4: DROPSHIPPER SELECTOR (ONLY ADMIN) */}
                {(userRole === 'admin' || userRole === 'super_admin') && (
                    <div className="pt-2">
                        <Label className="text-xs font-bold text-slate-600 mb-1.5 block">Milik Siapa? (Dropshipper)</Label>
                        <Popover open={isDsPickerOpen} onOpenChange={setIsDsPickerOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-between bg-white font-normal h-10 border-blue-100 hover:border-blue-300">
                                    {formData.dropshipper_id 
                                        ? dropshippers.find(d => d.id === formData.dropshipper_id)?.full_name 
                                        : "Langsung (Admin / Umum)"}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                                <Command>
                                    <CommandInput placeholder="Cari nama dropshipper..." />
                                    <CommandList>
                                        <CommandEmpty>Dropshipper tidak ditemukan.</CommandEmpty>
                                        <CommandGroup>
                                            <CommandItem onSelect={() => { setFormData(p => ({...p, dropshipper_id: null})); setIsDsPickerOpen(false); }}>
                                                <Check className={cn("mr-2 h-4 w-4", !formData.dropshipper_id ? "opacity-100" : "opacity-0")} />
                                                Langsung (Admin / Umum)
                                            </CommandItem>
                                            {dropshippers.map((ds) => (
                                                <CommandItem key={ds.id} onSelect={() => { setFormData(p => ({...p, dropshipper_id: ds.id})); setIsDsPickerOpen(false); }}>
                                                    <Check className={cn("mr-2 h-4 w-4", formData.dropshipper_id === ds.id ? "opacity-100" : "opacity-0")} />
                                                    {ds.full_name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                        <div className="p-2 border-t mt-1">
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="w-full justify-start text-blue-600 font-bold h-9 hover:bg-blue-50"
                                                onClick={() => { setIsDsPickerOpen(false); setIsAddDsModalOpen(true); }}
                                            >
                                                <UserPlus className="mr-2 h-4 w-4" /> Tambah Dropshipper Baru
                                            </Button>
                                        </div>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                )}
            </form>
        </div>

        <DialogFooter className="p-4 bg-slate-50 border-t shrink-0 flex gap-2">
          <Button variant="ghost" onClick={resetForm} disabled={loading} className="flex-1 md:flex-none">Batal</Button>
          <Button 
            type="submit" 
            form="customer-form-main" 
            disabled={loading || (userRole === 'dropship' && validDsStatuses.length === 0)}
            className="bg-[#10182b] text-white font-bold px-8 flex-1 md:flex-none shadow-lg shadow-slate-200"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Simpan Pelanggan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* MODAL TAMBAH DROPSHIPPER (DIPANGGIL DARI DALAM CUSTOMER FORM) */}
    <AddDropshipperModal 
        isOpen={isAddDsModalOpen} 
        onOpenChange={setIsAddDsModalOpen} 
        companyId={companyId} 
        onSuccess={(newDsId) => {
            // Re-fetch list dropshipper agar yg baru muncul di pilihan
            fetchData();
            setFormData(p => ({...p, dropshipper_id: newDsId}));
            toast.success("Dropshipper baru dipilih otomatis.");
        }} 
    />
    </>
  );
};

export default CustomerForm;