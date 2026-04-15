import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import { Loader2, Check, X, ExternalLink, Eye, CreditCard } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const SubscriptionPaymentList = () => {
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [isProofOpen, setIsProofOpen] = useState(false);

    useEffect(() => {
        fetchPayments();
    }, []);

    const fetchPayments = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('subscription_payments')
            .select(`
                *,
                companies(name),
                subscription_plans(name, billing_cycle_days) 
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching payments:', error);
            toast.error('Gagal memuat data pembayaran.');
        } else {
            setPayments(data || []);
        }
        setLoading(false);
    };

    const handleApprove = async (payment) => {
        if (!window.confirm(`Setujui pembayaran dari ${payment.companies.name}?`)) return;
        
        setProcessingId(payment.id);
        try {
            const { id, company_id, subscription_plans } = payment;
            
            // FIX: Use the correct column name from the database schema
            const durationDays = subscription_plans.billing_cycle_days;
            
            // Safety check to prevent Invalid Date errors
            if (!durationDays) {
                throw new Error("Data siklus tagihan (billing_cycle_days) tidak valid pada paket ini.");
            }

            // 1. Ambil status perusahaan saat ini
            const { data: company, error: companyError } = await supabase
                .from('companies')
                .select('subscription_end_date')
                .eq('id', company_id)
                .single();

            if (companyError) throw companyError;

            // 2. Hitung tanggal baru
            const currentEnd = company.subscription_end_date ? new Date(company.subscription_end_date) : new Date();
            const startPoint = currentEnd > new Date() ? currentEnd : new Date();
            const newExpiry = new Date(startPoint.getTime() + (durationDays * 24 * 60 * 60 * 1000));

            // 3. Update status pembayaran & perpanjang perusahaan
            const { error: updateError } = await supabase
                .from('subscription_payments')
                .update({ 
                    status: 'approved', 
                    approved_at: new Date().toISOString() 
                })
                .eq('id', id);

            if (updateError) throw updateError;

            const { error: companyUpdateError } = await supabase
                .from('companies')
                .update({ 
                    subscription_end_date: newExpiry.toISOString(),
                    is_manually_locked: false
                })
                .eq('id', company_id);

            if (companyUpdateError) throw companyUpdateError;

            toast.success('Pembayaran disetujui dan langganan diperpanjang!');
            fetchPayments();
        } catch (error) {
            console.error('Error approving payment:', error);
            toast.error('Gagal menyetujui pembayaran: ' + error.message);
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (paymentId) => {
        const notes = window.prompt('Alasan penolakan:');
        if (notes === null) return;

        setProcessingId(paymentId);
        try {
            const { error } = await supabase
                .from('subscription_payments')
                .update({ 
                    status: 'rejected', 
                    admin_notes: notes 
                })
                .eq('id', paymentId);

            if (error) throw error;

            toast.success('Pembayaran ditolak.');
            fetchPayments();
        } catch (error) {
            console.error('Error rejecting payment:', error);
            toast.error('Gagal menolak pembayaran.');
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="animate-spin h-8 w-8 text-slate-400" />
            </div>
        );
    }

    return (
        <div className="space-y-0 w-full animate-in fade-in">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader className="bg-slate-50/80 border-b border-slate-200">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="px-6 py-4 font-semibold text-slate-700">Waktu Pengajuan</TableHead>
                            <TableHead className="py-4 font-semibold text-slate-700">Nama Tenant</TableHead>
                            <TableHead className="py-4 font-semibold text-slate-700">Paket Dipilih</TableHead>
                            <TableHead className="py-4 font-semibold text-slate-700">Nominal</TableHead>
                            <TableHead className="py-4 font-semibold text-slate-700 text-center">Bukti</TableHead>
                            <TableHead className="py-4 font-semibold text-slate-700">Status</TableHead>
                            <TableHead className="px-6 py-4 font-semibold text-slate-700 text-right">Verifikasi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {payments.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-20 text-slate-500">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center">
                                            <CreditCard className="h-8 w-8 text-slate-300" />
                                        </div>
                                        <p className="font-medium">Belum ada pengajuan pembayaran masuk.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            payments.map((p) => (
                                <TableRow key={p.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100">
                                    <TableCell className="px-6 py-4 text-sm font-medium text-slate-500">
                                        {new Date(p.created_at).toLocaleString('id-ID', {
                                            day: '2-digit',
                                            month: 'short',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <div className="font-medium text-slate-800">{p.companies?.name}</div>
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <Badge variant="outline" className="border-slate-200 text-slate-600 bg-slate-50 font-medium">
                                            {p.subscription_plans?.name}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="py-4 font-semibold text-slate-800">
                                        Rp {p.amount.toLocaleString('id-ID')}
                                    </TableCell>
                                    <TableCell className="py-4 text-center">
                                        {p.payment_proof_url && (
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => {
                                                    setSelectedPayment(p);
                                                    setIsProofOpen(true);
                                                }}
                                                className="h-8 border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                                            >
                                                <Eye className="h-4 w-4 mr-1.5" /> Preview
                                            </Button>
                                        )}
                                    </TableCell>
                                    <TableCell className="py-4">
                                        <Badge className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium border-0 tracking-wide
                                            ${p.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 
                                              p.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 
                                              'bg-amber-100 text-amber-700'}`}
                                        >
                                            {p.status.toUpperCase()}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="px-6 py-4 text-right">
                                        {p.status === 'pending' && (
                                            <div className="flex justify-end gap-2">
                                                <Button 
                                                    size="sm" 
                                                    className="bg-emerald-600 hover:bg-emerald-700 h-8 w-8 p-0 rounded-md transition-colors"
                                                    onClick={() => handleApprove(p)}
                                                    disabled={processingId === p.id}
                                                    title="Setujui Pembayaran"
                                                >
                                                    {processingId === p.id ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Check className="h-4 w-4 text-white" />}
                                                </Button>
                                                <Button 
                                                    size="sm" 
                                                    variant="destructive" 
                                                    className="h-8 w-8 p-0 rounded-md transition-colors"
                                                    onClick={() => handleReject(p.id)}
                                                    disabled={processingId === p.id}
                                                    title="Tolak Pembayaran"
                                                >
                                                    <X className="h-4 w-4 text-white" />
                                                </Button>
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Modal Bukti Pembayaran */}
            <Dialog open={isProofOpen} onOpenChange={setIsProofOpen}>
                <DialogContent className="sm:max-w-xl p-0 overflow-hidden border-0 shadow-xl rounded-2xl">
                    <DialogHeader className="p-6 bg-slate-50 border-b border-slate-100">
                        <DialogTitle className="flex items-center gap-2 text-[#011e4b] font-semibold text-lg">
                            <Eye className="h-5 w-5 text-[#015a97]" /> Bukti Pembayaran
                        </DialogTitle>
                        <p className="text-sm font-medium text-slate-500">{selectedPayment?.companies?.name}</p>
                    </DialogHeader>
                    
                    <div className="bg-slate-100/50 p-6">
                        <div className="bg-white rounded-xl p-2 border border-slate-200/60 shadow-sm flex items-center justify-center min-h-[300px] max-h-[60vh] overflow-auto">
                            {selectedPayment?.payment_proof_url ? (
                                <img 
                                    src={selectedPayment.payment_proof_url} 
                                    alt="Bukti Pembayaran" 
                                    className="max-w-full h-auto rounded-lg"
                                />
                            ) : (
                                <p className="text-slate-400 font-medium">Gambar tidak tersedia</p>
                            )}
                        </div>
                    </div>
                    
                    <div className="p-4 bg-white flex items-center justify-between border-t border-slate-100">
                        <a 
                            href={selectedPayment?.payment_proof_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-[#015a97] flex items-center hover:underline"
                        >
                            Buka di tab baru <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                        </a>
                        <Button variant="outline" onClick={() => setIsProofOpen(false)} className="font-medium text-slate-600 border-slate-200">
                            Tutup
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default SubscriptionPaymentList;