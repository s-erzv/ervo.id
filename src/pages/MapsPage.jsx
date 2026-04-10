import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Circle } from '@react-google-maps/api';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, MessageSquareText, MapPin, Navigation, ScanSearch, Search, RefreshCw, Settings } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Badge } from '@/components/ui/badge';
import { geocodeAddress } from '../lib/MapsUtils';

// --- IMPORT MODAL BARU ---
import WhatsappTemplateSettingsModal from '@/components/WhatsappTemplateSettingsModal';
import CryptoJS from 'crypto-js'; // Tambahkan ini di deretan import

const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'fallback-key-proyek-rahasia';

const containerStyle = { width: '100%', height: '600px', borderRadius: '0.5rem' };
const defaultCenter = { lat: -6.200000, lng: 106.816666 };

const LIBRARIES = ['places'];

const MapsPage = () => {
  const { companyId, companyName } = useAuth();
  
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES
  });

  const [map, setMap] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [nearbyCustomers, setNearbyCustomers] = useState([]);
  const [radius, setRadius] = useState(2);
  
  // --- STATE BARU ---
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [activeTemplates, setActiveTemplates] = useState({});

  const [loadingNearby, setLoadingNearby] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState({ current: 0, total: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const searchContainerRef = useRef(null);
  const [processingWA, setProcessingWA] = useState({});

  const sendViaFonnte = async (targetPhone, message) => {
    try {
      const { data: companyData, error: coErr } = await supabase
        .from('companies')
        .select('fonnte_token')
        .eq('id', companyId)
        .single();

      if (coErr || !companyData?.fonnte_token) return false;

      const encryptedToken = companyData.fonnte_token;
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
      console.error("Fonnte API Error:", err);
      return false;
    }
};

  useEffect(() => {
    if (companyId) {
      fetchCustomers();
      fetchActiveTemplates(); // Ambil template WA saat loading awal
    }
  }, [companyId]);

  useEffect(() => {
    if (searchTerm.trim() === '') { setSearchResults([]); return; }
    const delayDebounceFn = setTimeout(() => {
        const lower = searchTerm.toLowerCase();
        const results = customers.filter(c => c.name.toLowerCase().includes(lower) || (c.phone && c.phone.includes(searchTerm)));
        setSearchResults(results);
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, customers]);

  // Fungsi ambil template agar tombol WA pakai teks terbaru
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

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('id, name, address, phone, latitude, longitude, customer_status').eq('company_id', companyId);
    setCustomers(data || []);
  };

  const handleBatchGeocode = async () => {
    const targetCustomers = customers.filter(c => (!c.latitude || !c.longitude) && c.address && c.address.length > 5);
    if (targetCustomers.length === 0) { toast.success("Semua pelanggan sudah punya koordinat!"); return; }
    if (!confirm(`Ada ${targetCustomers.length} pelanggan belum memiliki koordinat. Lanjutkan?`)) return;

    setIsMigrating(true);
    setMigrationProgress({ current: 0, total: targetCustomers.length });
    let successCount = 0;

    for (let i = 0; i < targetCustomers.length; i++) {
        const cust = targetCustomers[i];
        setMigrationProgress({ current: i + 1, total: targetCustomers.length });
        const coords = await geocodeAddress(cust.address);
        if (coords) {
            await supabase.from('customers').update({ latitude: coords.lat, longitude: coords.lng }).eq('id', cust.id);
            successCount++;
        }
        await new Promise(r => setTimeout(r, 200));
    }
    setIsMigrating(false);
    toast.success(`Selesai! ${successCount} pelanggan diperbarui.`);
    fetchCustomers();
  };

  const handleFindNearby = async (centerCustomer) => {
    if (!centerCustomer?.latitude || !centerCustomer?.longitude) return;
    setLoadingNearby(true);
    try {
        const { data, error } = await supabase.rpc('get_nearby_customers', {
            p_lat: centerCustomer.latitude, p_lng: centerCustomer.longitude, p_radius_km: parseFloat(radius), p_company_id: companyId, p_exclude_id: centerCustomer.id
        });
        if (error) throw error;
        setNearbyCustomers(data || []);
        if((data || []).length > 0) toast.success(`Ditemukan ${(data || []).length} pelanggan sekitar!`);
        else toast('Tidak ada pelanggan lain di area ini.');
    } catch (err) { console.error(err); toast.error("Gagal memuat data sekitar."); } finally { setLoadingNearby(false); }
  };

  const handleContact = async (cust) => {
        if (processingWA[cust.id]) return;

        setProcessingWA(prev => ({ ...prev, [cust.id]: true }));
        const tid = toast.loading(`Mempersiapkan pesan untuk ${cust.name}...`);

        try {
            const phone = (cust.phone || '').replace(/[^\d]/g, '');
            const template = activeTemplates['nearby_info'] || `Halo {{customerName}}, kami dari {{companyName}} sedang di sekitar Anda...`;

            const whatsappMessage = template
                .replace(/{{companyName}}/g, companyName || 'Toko Kami')
                .replace(/{{customerName}}/g, cust.name);

            const isAutoSent = await sendViaFonnte(phone, whatsappMessage);

            if (isAutoSent) {
                toast.success(`Pesan ke ${cust.name} Terkirim!`, { id: tid });
            } else {
                toast.dismiss(tid);
                window.open(`https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(whatsappMessage)}`, '_blank');
            }
        } catch (err) {
            toast.error('Gagal: ' + err.message, { id: tid });
        } finally {
            setTimeout(() => {
                setProcessingWA(prev => ({ ...prev, [cust.id]: false }));
            }, 3000);
        }
    };

  const handleSelectSearchResult = (cust) => {
    if (!cust.latitude || !cust.longitude) { toast.error("Pelanggan ini belum memiliki koordinat."); setSearchTerm(''); return; }
    setSelectedCustomer(cust);
    handleFindNearby(cust);
    setSearchTerm('');
    setSearchResults([]);
    if (map) { map.panTo({ lat: cust.latitude, lng: cust.longitude }); map.setZoom(15); }
  };

  const onLoad = useCallback((map) => {
    const validCustomers = customers.filter(c => c.latitude && c.longitude);
    if (validCustomers.length > 0) {
        const bounds = new window.google.maps.LatLngBounds();
        validCustomers.forEach(c => bounds.extend({ lat: c.latitude, lng: c.longitude }));
        map.fitBounds(bounds);
    }
    setMap(map);
  }, [customers]);

  const onUnmount = useCallback(() => setMap(null), []);

  if (!isLoaded) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#10182b]" /></div>;

  const mapCustomers = customers.filter(c => c.latitude && c.longitude);

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-7xl space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-[#10182b]"><MapPin className="h-7 w-7"/> Peta Persebaran Pelanggan</h1>
            <p className="text-sm text-gray-500">Total Pelanggan: {customers.length} | Terpetakan: {mapCustomers.length}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto items-center">
            {isMigrating && <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded text-xs text-blue-700"><Loader2 className="h-3 w-3 animate-spin"/> Memproses {migrationProgress.current}/{migrationProgress.total}...</div>}
            {!isMigrating && <Button variant="outline" size="sm" onClick={handleBatchGeocode} className="text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100"><RefreshCw className="h-4 w-4 mr-2" /> Generate Koordinat</Button>}
            
            {/* TOMBOL PENGATURAN TEMPLATE */}
            <Button variant="outline" size="sm" onClick={() => setIsTemplateModalOpen(true)}>
                <Settings className="h-4 w-4 mr-2" /> Atur Pesan WA
            </Button>

            <div className="relative w-full sm:w-64" ref={searchContainerRef}>
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input placeholder="Cari Pelanggan..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                {searchResults.length > 0 && (
                    <div className="absolute top-full mt-1 w-full bg-white border rounded-md shadow-lg z-50 max-h-[200px] overflow-y-auto">
                        {searchResults.map(cust => (
                            <div key={cust.id} className="p-2 hover:bg-gray-100 cursor-pointer text-sm border-b last:border-0" onClick={() => handleSelectSearchResult(cust)}>
                                <p className="font-semibold text-[#10182b]">{cust.name}</p>
                                <p className="text-xs text-gray-500 truncate">{cust.address || 'Tanpa Alamat'}</p>
                                {!cust.latitude && <span className="text-[10px] text-red-500 italic">Belum ada peta</span>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div className="flex items-center gap-2 bg-white p-2 rounded-lg border shadow-sm">
                <span className="text-xs font-semibold text-gray-600 pl-2">Radius (KM):</span>
                <Input type="number" value={radius} onChange={(e) => setRadius(e.target.value)} className="h-8 w-16 text-center" min="0.1" />
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
            <Card className="p-1 border shadow-md overflow-hidden bg-slate-100">
                <GoogleMap mapContainerStyle={containerStyle} center={defaultCenter} zoom={10} onLoad={onLoad} onUnmount={onUnmount} options={{ mapTypeControl: false, streetViewControl: false, fullscreenControl: true }}>
                    {mapCustomers.map(cust => (
                        <Marker key={cust.id} position={{ lat: cust.latitude, lng: cust.longitude }} onClick={() => { setSelectedCustomer(cust); handleFindNearby(cust); }} />
                    ))}
                    {selectedCustomer && (
                        <InfoWindow position={{ lat: selectedCustomer.latitude, lng: selectedCustomer.longitude }} onCloseClick={() => { setSelectedCustomer(null); setNearbyCustomers([]); }}>
                            <div className="p-1 min-w-[150px]">
                                <h3 className="font-bold text-sm text-[#10182b]">{selectedCustomer.name}</h3>
                                <Badge variant="outline" className="text-[10px] h-5 mb-1">{selectedCustomer.customer_status || 'Umum'}</Badge>
                                <p className="text-xs text-gray-500 mb-2 truncate max-w-[180px]">{selectedCustomer.address}</p>
                                <Button 
                                    size="sm" 
                                    className="w-full text-xs h-7 bg-green-600 hover:bg-green-700 text-white" 
                                    onClick={() => handleContact(selectedCustomer)}
                                    disabled={processingWA[selectedCustomer.id]}
                                >
                                    {processingWA[selectedCustomer.id] ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                                    Chat WA
                                </Button>
                            </div>
                        </InfoWindow>
                    )}
                    {selectedCustomer && <Circle center={{ lat: selectedCustomer.latitude, lng: selectedCustomer.longitude }} radius={radius * 1000} options={{ fillColor: "#3b82f6", fillOpacity: 0.15, strokeColor: "#2563eb", strokeOpacity: 0.8, strokeWeight: 1 }} />}
                </GoogleMap>
            </Card>
        </div>
        <div className="space-y-4">
            <Card className="h-[600px] flex flex-col shadow-md border-t-4 border-t-[#10182b]">
                <CardHeader className="pb-3 bg-gray-50 border-b"><CardTitle className="text-base flex items-center gap-2"><ScanSearch className="h-5 w-5 text-blue-600" /> Radar Pelanggan</CardTitle></CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
                    {!selectedCustomer ? (
                        <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 space-y-2 opacity-60"><Navigation className="h-12 w-12" /><p className="text-sm">Klik marker atau cari pelanggan.</p></div>
                    ) : (
                        <>
                            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Titik Pusat</div>
                                <div className="font-bold text-[#10182b]">{selectedCustomer.name}</div>
                                <div className="text-xs text-gray-500">{selectedCustomer.phone}</div>
                                <Button size="sm" variant="outline" className="w-full mt-2 h-7 text-xs bg-white text-blue-600 border-blue-200 hover:bg-blue-100" onClick={() => handleFindNearby(selectedCustomer)} disabled={loadingNearby}>{loadingNearby ? <Loader2 className="h-3 w-3 animate-spin"/> : 'Scan Ulang Area Ini'}</Button>
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-gray-500 mb-2 uppercase flex justify-between items-center"><span>Dalam Radius {radius} KM</span><Badge variant="secondary">{nearbyCustomers.length}</Badge></div>
                                {nearbyCustomers.length === 0 ? <div className="text-center py-4 text-xs text-gray-400 bg-gray-50 rounded border border-dashed">Tidak ada pelanggan lain di sini.</div> : (
                                    <div className="space-y-2">
                                        {nearbyCustomers.map(nc => (
                                            <div key={nc.id} className="p-3 border rounded-lg hover:bg-gray-50 transition-all flex justify-between items-center group bg-white shadow-sm">
                                                <div>
                                                    <p className="text-sm font-semibold text-[#10182b]">{nc.name}</p>
                                                    <div className="flex items-center gap-1 text-xs text-gray-500"><Navigation className="h-3 w-3 text-orange-500" /><span className="font-mono font-medium text-orange-600">{nc.distance_km.toFixed(2)} km</span></div>
                                                </div>
                                                <Button 
                                                    size="icon" 
                                                    variant="ghost" 
                                                    className={`h-8 w-8 text-green-600 bg-green-50 hover:bg-green-100 ${processingWA[nc.id] ? 'opacity-50' : ''}`} 
                                                    onClick={() => handleContact(nc)}
                                                    disabled={processingWA[nc.id]}
                                                >
                                                    {processingWA[nc.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareText className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>

      {/* MODAL PENGATURAN WA BARU */}
      <WhatsappTemplateSettingsModal 
        isOpen={isTemplateModalOpen} 
        onOpenChange={(open) => {
            setIsTemplateModalOpen(open);
            if (!open) fetchActiveTemplates(); // Refresh template saat modal ditutup
        }} 
      />
    </div>
  );
};

export default MapsPage;