import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { CalendarCheck, Loader2, CreditCard } from 'lucide-react';

const SubscriptionExtensionForm = ({ user, onSuccess }) => {
    const [plans, setPlans] = useState([]);
    const [selectedPlanId, setSelectedPlanId] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetchingPlans, setFetchingPlans] = useState(true);
    
    const [isManualDate, setIsManualDate] = useState(false);
    const [manualDate, setManualDate] = useState('');

    useEffect(() => {
        fetchPlans();
        
        const currentEndDate = user?.companies?.subscription_end_date || user?.subscription_end_date;
        if (currentEndDate) {
            setManualDate(new Date(currentEndDate).toISOString().split('T')[0]);
        } else {
            setManualDate(new Date().toISOString().split('T')[0]);
        }
    }, [user]);

    const fetchPlans = async () => {
        setFetchingPlans(true);
        const { data, error } = await supabase
            .from('subscription_plans')
            .select('*')
            .eq('is_active', true)
            .order('price', { ascending: true });

        if (error) {
            console.error('Error fetching plans:', error);
            toast.error('Gagal mengambil daftar paket langganan');
        } else {
            setPlans(data || []);
            // Check if user's company already has a plan
            const currentPlanId = user?.companies?.subscription_plan_id;
            if (currentPlanId) {
                setSelectedPlanId(currentPlanId);
            } else if (data?.length > 0) {
                setSelectedPlanId(data[0].id);
            }
        }
        setFetchingPlans(false);
    };

    if (!user) return <div className="text-red-500">Tidak ada pengguna terpilih.</div>;

    const handleExtendSubscription = async (e) => {
        e.preventDefault();
        setLoading(true);

        const selectedPlan = plans.find(p => p.id === selectedPlanId);
        if (!selectedPlan) {
            toast.error('Silakan pilih paket langganan');
            setLoading(false);
            return;
        }

        let newExpiryDate;
        if (isManualDate) {
            if (!manualDate) {
                toast.error('Silakan tentukan tanggal kedaluwarsa');
                setLoading(false);
                return;
            }
            newExpiryDate = new Date(manualDate);
        } else {
            if (!selectedPlan.billing_cycle_days) {
                newExpiryDate = null; 
            } else {
                // Priority to company end date if available
                const currentEndDate = user.companies?.subscription_end_date || user.subscription_end_date;
                const startPoint = currentEndDate && new Date(currentEndDate) > new Date()
                    ? new Date(currentEndDate) 
                    : new Date(); 

                newExpiryDate = new Date(startPoint.getTime() + (selectedPlan.billing_cycle_days * 24 * 60 * 60 * 1000));
            }
        }

        const isoString = newExpiryDate ? newExpiryDate.toISOString() : null; 

        const updateData = {
            subscription_end_date: isoString,
            is_manually_locked: false,
        };

        try {
            // Update both profile and company if applicable
            const promises = [];
            
            // Update Profile
            promises.push(supabase
                .from('profiles')
                .update(updateData)
                .eq('id', user.id));
                
            // Update Company
            if (user.company_id) {
                promises.push(supabase
                    .from('companies')
                    .update({
                        ...updateData,
                        subscription_plan_id: selectedPlanId
                    })
                    .eq('id', user.company_id));
            }

            const results = await Promise.all(promises);
            const errors = results.filter(r => r.error);

            if (errors.length > 0) {
                throw new Error(errors[0].error.message);
            }

            toast.success(`Langganan ${user.full_name} berhasil diperbarui.`);
            if (onSuccess) {
                onSuccess(updateData); 
            }
        } catch (error) {
            toast.error(`Gagal mengatur langganan: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const getNewExpiryDateText = () => {
        const selectedPlan = plans.find(p => p.id === selectedPlanId);
        if (!selectedPlan) return 'Pilih Paket';
        
        if (!selectedPlan.billing_cycle_days) return 'Berlaku Selamanya';
        
        const currentEndDate = user.companies?.subscription_end_date || user.subscription_end_date;
        const startPoint = currentEndDate && new Date(currentEndDate) > new Date()
            ? new Date(currentEndDate) 
            : new Date();

        const calculatedDate = new Date(startPoint.getTime() + (selectedPlan.billing_cycle_days * 24 * 60 * 60 * 1000));

        return calculatedDate.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    return (
        <form onSubmit={handleExtendSubscription} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="user-name">Pengguna</Label>
                <Input id="user-name" value={user.full_name} disabled className="bg-slate-50 font-medium" />
            </div>

            <div className="space-y-2">
                <Label htmlFor="plan">Pilih Paket Langganan</Label>
                {fetchingPlans ? (
                    <div className="flex items-center gap-2 p-2 border rounded-md bg-slate-50 text-slate-500 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" /> Memuat paket...
                    </div>
                ) : (
                    <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Pilih paket" />
                        </SelectTrigger>
                        <SelectContent>
                            {plans.map(plan => (
                                <SelectItem key={plan.id} value={plan.id}>
                                    {plan.name} - Rp {plan.price.toLocaleString('id-ID')} ({plan.billing_cycle_days || '∞'} Hari)
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl space-y-2">
                <div className="flex items-center text-sm text-blue-800 font-semibold">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Detail Paket
                </div>
                {selectedPlanId ? (
                    <div className="text-xs text-blue-700 space-y-1">
                        <p>• Harga: Rp {plans.find(p => p.id === selectedPlanId)?.price.toLocaleString('id-ID')}</p>
                        <p>• Durasi: {plans.find(p => p.id === selectedPlanId)?.billing_cycle_days || 'Selamanya'} Hari</p>
                    </div>
                ) : (
                    <p className="text-xs text-blue-600 italic">Pilih paket untuk melihat detail</p>
                )}
            </div>

            <div className="flex items-center justify-between p-3 border rounded-xl bg-slate-50">
                <div className="space-y-0.5">
                    <Label htmlFor="manual-date-toggle" className="text-sm font-medium text-slate-700">Atur Tanggal Manual</Label>
                    <p className="text-xs text-slate-500">Tentukan tanggal kedaluwarsa secara spesifik</p>
                </div>
                <Switch 
                    id="manual-date-toggle" 
                    checked={isManualDate} 
                    onCheckedChange={setIsManualDate} 
                />
            </div>

            {isManualDate ? (
                <div className="space-y-2 p-3 border border-blue-100 rounded-xl bg-blue-50/50">
                    <Label htmlFor="manual-date-input" className="text-sm text-blue-800">Pilih Tanggal Kedaluwarsa</Label>
                    <Input 
                        type="date" 
                        id="manual-date-input" 
                        value={manualDate} 
                        onChange={(e) => setManualDate(e.target.value)} 
                        className="bg-white border-blue-200"
                    />
                </div>
            ) : (
                <div className={`flex items-center text-sm p-3 border rounded-xl ${selectedPlanId && !plans.find(p => p.id === selectedPlanId)?.billing_cycle_days ? 'bg-green-50 text-green-700 border-green-100' : 'bg-amber-50 text-amber-800 border-amber-100'}`}>
                    <CalendarCheck className="h-4 w-4 mr-2 shrink-0" />
                    <span className="font-medium">Kedaluwarsa Baru: {getNewExpiryDateText()}</span>
                </div>
            )}
            
            <Button type="submit" className="w-full h-11 bg-[#011e4b] hover:bg-[#00376a] font-semibold" disabled={loading || fetchingPlans}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 'Simpan Pengaturan Langganan'}
            </Button>
        </form>
    );
};

export default SubscriptionExtensionForm;