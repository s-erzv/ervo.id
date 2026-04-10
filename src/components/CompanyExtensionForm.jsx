import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { CalendarCheck, Loader2 } from 'lucide-react';

const CompanyExtensionForm = ({ company, onSuccess }) => {
    // Default 1 bulan
    const [duration, setDuration] = useState('1'); 
    const [loading, setLoading] = useState(false);

    if (!company) return <div className="text-red-500">Tidak ada perusahaan terpilih.</div>;

    const handleExtendSubscription = async (e) => {
        e.preventDefault();
        setLoading(true);

        const durationMonths = parseInt(duration);
        
        let newExpiryDate;
        if (duration === '999') {
             // Jika selamanya, set ke NULL di database
            newExpiryDate = null; 
        } else {
            // Logika perhitungan tanggal kedaluwarsa normal
            const startPoint = company.subscription_end_date && new Date(company.subscription_end_date) > new Date()
                ? new Date(company.subscription_end_date) 
                : new Date(); 

            newExpiryDate = new Date(startPoint.setMonth(startPoint.getMonth() + durationMonths));
        }

        // Jika newExpiryDate adalah null, isoString akan menjadi null
        const isoString = newExpiryDate ? newExpiryDate.toISOString() : null; 

        const updateData = {
            subscription_end_date: isoString,
            is_manually_locked: false, // Otomatis buka kunci saat diperpanjang/diset
        };

        const { error } = await supabase
            .from('companies') // TARGET: tabel 'companies'
            .update(updateData)
            .eq('id', company.id);

        setLoading(false);

        if (error) {
            toast.error(`Gagal mengatur langganan perusahaan: ${error.message}`);
        } else {
            toast.success(`Langganan ${company.name} berhasil diperbarui.`);
            // Pastikan kita mengembalikan status updateData yang benar ke onSuccess
            if (onSuccess) {
                onSuccess(updateData); 
            }
        }
    };

    // --- PERBAIKAN LOGIKA TAMPILAN DI SINI ---
    const getNewExpiryDateText = () => {
        if (duration === '999') {
            return 'Berlaku Selamanya (NULL di Database)';
        }
        if (!duration) return 'Pilih Durasi';
        
        const durationMonths = parseInt(duration);
        
        const startPoint = company.subscription_end_date && new Date(company.subscription_end_date) > new Date()
            ? new Date(company.subscription_end_date) 
            : new Date();

        const calculatedDate = new Date(startPoint.getTime()); 
        calculatedDate.setMonth(calculatedDate.getMonth() + durationMonths);

        return calculatedDate.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    return (
        <form onSubmit={handleExtendSubscription} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="company-name">Perusahaan</Label>
                <Input id="company-name" value={company.name} disabled />
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

export default CompanyExtensionForm;
