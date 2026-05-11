import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import { Loader2, Check, X, ExternalLink, Eye, CreditCard, MessageSquare, Link as LinkIcon, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SubscriptionPaymentList = () => {
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    
    // States for Link Modal
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [paymentLink, setPaymentLink] = useState('');
    const [isSavingLink, setIsSavingLink] = useState(false);

    useEffect(() => {
        fetchPayments();
    }, []);

    const fetchPayments = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('subscription_payments')
            .select(`
                *,
                companies(
                    name, 
                    profiles:profiles(full_name, phone)
                ),
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

    const handleOpenLinkModal = (payment) => {
        setSelectedPayment(payment);
        setPaymentLink(payment.payment_proof_url || '');
        setIsLinkModalOpen(true);
    };

    const handleSaveLink = async () => {
        if (!selectedPayment) return;
        
        setIsSavingLink(true);
        try {
            const { error } = await supabase
                .from('subscription_payments')
                .update({ payment_proof_url: paymentLink })
                .eq('id', selectedPayment.id);

            if (error) throw error;

            toast.success('Link pembayaran berhasil disimpan!');
            setIsLinkModalOpen(false);
            fetchPayments();
        } catch (error) {
            console.error('Error saving link:', error);
            toast.error('Gagal menyimpan link pembayaran.');
        } finally {
            setIsSavingLink(false);
        }
    };

    const handleApprove = async (payment) => {
        if (!window.confirm(`Setujui pembayaran dari ${payment.companies.name}?`)) return;
        
        setProcessingId(payment.id);
        try {
            const { id, company_id, subscription_plans } = payment;
            const durationDays = subscription_plans.billing_cycle_days;
            
            if (!durationDays) {
                throw new Error("Data siklus tagihan tidak valid pada paket ini.");
            }

            const { data: company, error: companyError } = await supabase
                .from('companies')
                .select('subscription_end_date')
                .eq('id', company_id)
                .single();

            if (companyError) throw companyError;

            const currentEnd = company.subscription_end_date ? new Date(company.subscription_end_date) : new Date();
            const startPoint = currentEnd > new Date() ? currentEnd : new Date();
            const newExpiry = new Date(startPoint.getTime() + (durationDays * 24 * 60 * 60 * 1000));

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
                    subscription_plan_id: payment.plan_id,
                    is_manually_locked: false
                })
                .eq('id', company_id);

            if (companyUpdateError) throw companyUpdateError;

            toast.success('Pembayaran disetujui!');
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

            toast.success('Permintaan ditolak.');
            fetchPayments();
        } catch (error) {
            console.error('Error rejecting payment:', error);
            toast.error('Gagal menolak permintaan.');
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
                            <TableHead className="px-6 py-4 font-semibold text-slate-700">Waktu</TableHead>
                            <TableHead className="py-4 font-semibold text-slate-700">Tenant</TableHead>
                            <TableHead className="py-4 font-semibold text-slate-700">Paket</TableHead>
                            <TableHead className="py-4 font-semibold text-slate-700">Nominal</TableHead>
                            <TableHead className="py-4 font-semibold text-slate-700 text-center">Payment Link</TableHead>
                            <TableHead className="py-4 font-semibold text-slate-700">Status</TableHead>
                            <TableHead className="px-6 py-4 font-semibold text-slate-700 text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {payments.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-20 text-slate-500">
                                    <p className="font-medium">Belum ada permintaan perpanjangan.</p>
                                </TableCell>
                            </TableRow>
                        ) : (
                            payments.map((p) => (
                                <TableRow key={p.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100">
                                    <TableCell className="px-6 py-4 text-xs font-medium text-slate-500">
                                        {new Date(p.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
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
                                        <Button 
                                            variant={p.payment_proof_url ? "default" : "outline"} 
                                            size="sm" 
                                            onClick={() => handleOpenLinkModal(p)}
                                            className={`h-8 font-medium ${p.payment_proof_url ? 'bg-blue-600 hover:bg-blue-700' : 'border-slate-200 text-slate-600'}`}
                                        >
                                            <LinkIcon className="h-4 w-4 mr-1.5" /> 
                                            {p.payment_proof_url ? 'Update Link' : 'Set Link'}
                                        </Button>
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
                                                    title="Setujui (Sudah Bayar)"
                                                >
                                                    {processingId === p.id ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Check className="h-4 w-4 text-white" />}
                                                </Button>
                                                <Button 
                                                    size="sm" 
                                                    variant="destructive" 
                                                    className="h-8 w-8 p-0 rounded-md transition-colors"
                                                    onClick={() => handleReject(p.id)}
                                                    disabled={processingId === p.id}
                                                    title="Tolak Permintaan"
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

            {/* Modal Input Payment Link */}
            <Dialog open={isLinkModalOpen} onOpenChange={setIsLinkModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-[#011e4b]">
                            <LinkIcon className="h-5 w-5 text-blue-600" /> Atur Link Pembayaran
                        </DialogTitle>
                        <p className="text-sm text-slate-500">Tenant: {selectedPayment?.companies?.name}</p>
                    </DialogHeader>
                    
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="pay-link">URL Link Pembayaran (Xendit/Midtrans/dll)</Label>
                            <Input 
                                id="pay-link"
                                placeholder="https://checkout.xendit.co/..."
                                value={paymentLink}
                                onChange={(e) => setPaymentLink(e.target.value)}
                                className="h-11"
                            />
                        </div>
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                            <p className="text-xs text-blue-700 leading-relaxed">
                                <b>Info:</b> Link ini akan muncul secara otomatis di halaman langganan tenant sehingga mereka bisa langsung melakukan pembayaran.
                            </p>
                        </div>
                    </div>
                    
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsLinkModalOpen(false)}>Batal</Button>
                        <Button 
                            onClick={handleSaveLink} 
                            disabled={isSavingLink}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {isSavingLink ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            Simpan Link
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default SubscriptionPaymentList;
