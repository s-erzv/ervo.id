// src/containers/CourierDashboardContainer.jsx

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Truck, UserCircle2, Loader2, ListOrdered } from 'lucide-react'; // Import ListOrdered
import UserDashboard from '@/components/dashboards/UserDashboard';
import { toast } from 'react-hot-toast';

// Konstanta untuk menyimpan ID Petugas di LocalStorage
const LAST_SELECTED_COURIER = 'lastSelectedCourierId';

// Konstanta ID Petugas Spesial untuk Semua Pesanan
const ALL_ORDERS_ID = 'all';

const CourierDashboardContainer = () => {
    const { companyId } = useAuth();
    const [couriers, setCouriers] = useState([]);
    
    // FIX KRITIS 1: Inisialisasi selectedUserId dari localStorage
    const [selectedUserId, setSelectedUserId] = useState(() => {
        // Cek jika ID tersimpan adalah ID spesial 'all'
        const savedId = localStorage.getItem(LAST_SELECTED_COURIER);
        return savedId === ALL_ORDERS_ID ? ALL_ORDERS_ID : savedId;
    });
    // END FIX KRITIS 1
    
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCouriers = async () => {
            if (!companyId) return;
            setLoading(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, role')
                .eq('company_id', companyId)
                .eq('role', 'user'); // Hanya ambil Petugas
            
            if (error) {
                console.error("Error fetching couriers:", error);
                toast.error("Gagal memuat daftar petugas.");
            } else {
                const fetchedCouriers = data || [];
                // MODIFIKASI 1: Tambahkan opsi 'Semua Pesanan'
                const allOptions = [
                    { id: ALL_ORDERS_ID, full_name: 'Semua Pesanan' },
                    ...fetchedCouriers
                ];
                setCouriers(allOptions);

                // FIX KRITIS 3: Cek validitas ID yang tersimpan
                const savedIdIsValid = allOptions.some(c => c.id === selectedUserId);
                
                if (!selectedUserId || !savedIdIsValid) {
                     // Default ke 'Semua Pesanan' jika tidak ada ID tersimpan atau tidak valid
                     const defaultId = ALL_ORDERS_ID;
                     setSelectedUserId(defaultId);
                     localStorage.setItem(LAST_SELECTED_COURIER, defaultId);
                }
            }
            setLoading(false);
        };
        fetchCouriers();
    }, [companyId]);

    // FIX KRITIS 2: Simpan ID Petugas ke localStorage setiap kali berubah
    const handleUserChange = (newId) => {
        setSelectedUserId(newId);
        localStorage.setItem(LAST_SELECTED_COURIER, newId);
    };
    // END FIX KRITIS 2

    if (loading) {
        return (
            <div className="flex justify-center items-center h-40">
                <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
            </div>
        );
    }

    const selectedCourier = couriers.find(c => c.id === selectedUserId);

    return (
        <div className="space-y-6"> 
            <div className="mb-4 flex items-center flex-wrap gap-2">
                {selectedUserId === ALL_ORDERS_ID ? (
                    <ListOrdered className="h-5 w-5 text-gray-600" />
                ) : (
                    <UserCircle2 className="h-5 w-5 text-gray-600" />
                )}
                <span className="text-sm font-medium text-gray-600">
                    {selectedUserId === ALL_ORDERS_ID ? 'Tampilkan Data:' : 'Pilih Petugas:'}
                </span>
                <Select onValueChange={handleUserChange} value={selectedUserId || ''}>
                    <SelectTrigger className="w-[200px] sm:w-[240px]">
                        <SelectValue placeholder="Pilih Petugas" />
                    </SelectTrigger>
                    <SelectContent>
                        {couriers.map(courier => (
                            <SelectItem key={courier.id} value={courier.id}>
                                {courier.full_name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            
            {/* FIX: Pastikan userId yang dilewatkan valid */}
            {selectedUserId ? ( 
                <UserDashboard 
                    userId={selectedUserId} 
                    isAllOrdersMode={selectedUserId === ALL_ORDERS_ID} // NEW PROP
                />
            ) : (
                <Card className="p-12">
                    <CardContent className="p-0">
                        <div className="flex flex-col items-center justify-center space-y-3 text-center">
                            <Truck className="h-12 w-12 text-muted-foreground" />
                            <h3 className="text-lg font-semibold">Pilih Petugas atau Semua Pesanan</h3>
                            <p className="text-sm text-muted-foreground max-w-sm">
                                Pilih opsi dari dropdown di atas untuk melihat tugas per petugas atau semua pesanan.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default CourierDashboardContainer;