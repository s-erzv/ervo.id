import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { CalendarCheck, Loader2 } from 'lucide-react';

const SubscriptionExtensionForm = ({ user, onSuccess }) => {
    // Default 1 bulan
    const [duration, setDuration] = useState('1'); 
    const [loading, setLoading] = useState(false);

    if (!user) return <div className="text-red-500">Tidak ada pengguna terpilih.</div>;

    const handleExtendSubscription = async (e) => {
        e.preventDefault();
        setLoading(true);

        const durationMonths = parseInt(duration);
        
        let newExpiryDate;
        if (duration === '999') {
             // Jika memilih 'Hapus Masa Berlaku', set ke NULL
            newExpiryDate = null; 
        } else {
            // Tentukan titik mulai perpanjangan: 
            const startPoint = user.subscription_end_date && new Date(user.subscription_end_date) > new Date()
                ? new Date(user.subscription_end_date) 
                : new Date(); 

            newExpiryDate = new Date(startPoint.setMonth(startPoint.getMonth() + durationMonths));
        }

        const isoString = newExpiryDate ? newExpiryDate.toISOString() : null; 

        const updateData = {
            subscription_end_date: isoString,
            is_manually_locked: false, // Otomatis buka kunci saat diperpanjang/diset
        };

        const { error } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', user.id);

        setLoading(false);

        if (error) {
            toast.error(`Gagal mengatur langganan: ${error.message}`);
        } else {
            toast.success(`Langganan ${user.full_name} berhasil diperbarui.`);
            if (onSuccess) {
                onSuccess(updateData); 
            }
        }
    };

    const getNewExpiryDateText = () => {
        if (duration === '999') return 'TIDAK ADA KEDALUWARSA';
        if (!duration) return 'Pilih Durasi';
        
        const durationMonths = parseInt(duration);
        
        const startPoint = user.subscription_end_date && new Date(user.subscription_end_date) > new Date()
            ? new Date(user.subscription_end_date) 
            : new Date();

        const calculatedDate = new Date(startPoint.getTime()); 
        calculatedDate.setMonth(calculatedDate.getMonth() + durationMonths);

        return calculatedDate.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    return (
        <form onSubmit={handleExtendSubscription} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="user-name">Pengguna</Label>
                <Input id="user-name" value={user.full_name} disabled />
            </div>

            <div className="space-y-2">
                <Label htmlFor="duration">Pilih Durasi Langganan</Label>
                <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih durasi" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="1">1 Bulan</SelectItem>
                        <SelectItem value="3">3 Bulan</SelectItem>
                        <SelectItem value="6">6 Bulan</SelectItem>
                        <SelectItem value="12">1 Tahun</SelectItem>
                        <SelectItem value="999">Hapus Masa Berlaku (Selamanya)</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className={`flex items-center text-sm p-2 border rounded-md ${duration === '999' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-gray-600'}`}>
                <CalendarCheck className="h-4 w-4 mr-2" />
                <span>Tanggal Kedaluwarsa Baru: {getNewExpiryDateText()}</span>
            </div>
            
            <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 'Simpan Pengaturan Langganan'}
            </Button>
        </form>
    );
};

export default SubscriptionExtensionForm;