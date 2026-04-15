import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'react-hot-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Search, 
  Filter, 
  Landmark, 
  CreditCard, 
  Building2, 
  CheckCircle2, 
  Lock, 
  Settings 
} from 'lucide-react';

import CompanyExtensionForm from '../components/CompanyExtensionForm'; 
import SubscriptionPaymentList from '../components/SubscriptionPaymentList';

// Date formatter
const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

const BillingAccountPage = () => {
    const { userRole } = useAuth();
    const isSuperAdmin = userRole === 'super_admin';

    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all'); 

    // States for Modal
    const [isCompanySubDialog, setIsCompanySubDialog] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState(null);

    useEffect(() => {
        if (isSuperAdmin) {
            fetchCompanies();
        }
    }, [isSuperAdmin]);

    const fetchCompanies = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('companies')
            .select('id, name, address, subscription_end_date, is_manually_locked') 
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching companies:', error);
            toast.error('Gagal mengambil data perusahaan.');
            setCompanies([]);
        } else {
            setCompanies(data ?? []);
        }
        setLoading(false);
    };

    const handleToggleCompanyLock = async (company) => {
        if (!isSuperAdmin) return;
        const newLockStatus = !company.is_manually_locked;
        
        const lockPromise = supabase
            .from('companies')
            .update({ is_manually_locked: newLockStatus })
            .eq('id', company.id);
        
        toast.promise(lockPromise, {
            loading: newLockStatus ? `Mengunci ${company.name}...` : `Membuka ${company.name}...`,
            success: (res) => {
                if (res.error) throw new Error(res.error.message);
                setCompanies(prev => prev.map(c => 
                    c.id === company.id ? { ...c, is_manually_locked: newLockStatus } : c
                ));
                return newLockStatus ? `Perusahaan ${company.name} berhasil dikunci.` : `Perusahaan ${company.name} berhasil dibuka.`;
            },
            error: (err) => `Gagal mengubah status kunci perusahaan: ${err.message}`,
        });
    };

    const handleEditCompanySubscription = (company) => {
        setSelectedCompany(company);
        setIsCompanySubDialog(true);
    };

    const filteredCompanies = useMemo(() => {
        let result = companies;

        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            result = result.filter(c => 
                c.name.toLowerCase().includes(searchLower) ||
                c.address?.toLowerCase().includes(searchLower)
            );
        }

        if (filterStatus !== 'all') {
            result = result.filter(c => {
                const isExpired = c.subscription_end_date && new Date(c.subscription_end_date) < new Date();
                const isLocked = c.is_manually_locked === true;
                
                if (filterStatus === 'active') return !isLocked && !isExpired;
                if (filterStatus === 'expired') return isExpired && !isLocked;
                if (filterStatus === 'locked') return isLocked;
                
                return true;
            });
        }

        return result;
    }, [companies, searchTerm, filterStatus]);

    if (!isSuperAdmin) {
        return <div className="text-red-500 font-medium p-8">Akses ditolak. Halaman ini hanya untuk Super Admin.</div>;
    }
    
    if (loading) {
        return (
            <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 md:p-10 max-w-7xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-medium text-[#011e4b] flex items-center gap-3">
                        <Landmark className="w-8 h-8" /> Billing Central
                    </h2>
                    <p className="text-slate-500 mt-2">Kelola langganan perusahaan dan verifikasi pembayaran Ervo.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchCompanies} className="border-slate-200 text-slate-600 hover:bg-slate-50 font-medium">
                        Refresh Data
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="companies" className="space-y-8">
                {/* Fixed TabsList colors to ensure inactive tabs are visible */}
                <TabsList className="bg-slate-100 p-1.5 rounded-xl w-full md:w-auto border border-slate-200">
                    <TabsTrigger 
                        value="companies" 
                        className="rounded-lg px-6 py-2 font-medium text-slate-500 hover:text-slate-900 data-[state=active]:bg-[#011e4b] data-[state=active]:text-white transition-all"
                    >
                        <Building2 className="w-4 h-4 mr-2" /> Direktori Perusahaan
                    </TabsTrigger>
                    <TabsTrigger 
                        value="payments" 
                        className="rounded-lg px-6 py-2 font-medium text-slate-500 hover:text-slate-900 data-[state=active]:bg-[#011e4b] data-[state=active]:text-white transition-all"
                    >
                        <CreditCard className="w-4 h-4 mr-2" /> Konfirmasi Pembayaran
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="companies" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    {/* Ringkasan Dashboard */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="border-0 shadow-md bg-gradient-to-br from-[#011e4b] to-[#00376a] text-white overflow-hidden relative group">
                            <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-105 transition-transform duration-500">
                                <Building2 size={120} />
                            </div>
                            <CardContent className="p-6 relative z-10">
                                <p className="text-[#afcddd] text-sm uppercase tracking-wide">Total Tenant</p>
                                <h3 className="text-4xl font-medium mt-2">{companies.length}</h3>
                                <div className="mt-4 flex items-center gap-2 text-xs text-[#afcddd]">
                                    <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
                                        <div className="h-full bg-[#afcddd] w-full" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        
                        <Card className="border border-slate-200 shadow-sm bg-white border-l-4 border-l-emerald-500 overflow-hidden relative">
                            <CardContent className="p-6 relative z-10">
                                <p className="text-slate-500 text-sm uppercase tracking-wide">Tenant Aktif</p>
                                <h3 className="text-4xl font-medium mt-2 text-[#011e4b]">
                                    {companies.filter(c => !c.is_manually_locked && (!c.subscription_end_date || new Date(c.subscription_end_date) > new Date())).length}
                                </h3>
                                <div className="mt-4 flex items-center gap-2 text-sm text-emerald-600">
                                    <CheckCircle2 size={16} /> Running Well
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border border-slate-200 shadow-sm bg-white border-l-4 border-l-red-500 overflow-hidden relative">
                            <CardContent className="p-6 relative z-10">
                                <p className="text-slate-500 text-sm uppercase tracking-wide">Terkunci / Expired</p>
                                <h3 className="text-4xl font-medium mt-2 text-[#011e4b]">
                                    {companies.filter(c => c.is_manually_locked || (c.subscription_end_date && new Date(c.subscription_end_date) < new Date())).length}
                                </h3>
                                <div className="mt-4 flex items-center gap-2 text-sm text-red-600">
                                    <Lock size={16} /> Action Required
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Filter & Search Bar */}
                    <Card className="p-3 border shadow-sm bg-white rounded-2xl border-slate-200">
                        <div className="flex flex-col md:flex-row gap-4 items-center">
                            <div className="relative w-full">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <Input
                                    placeholder="Cari berdasarkan nama atau alamat..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-12 h-12 border-0 bg-transparent focus-visible:ring-0 text-base font-normal"
                                />
                            </div>
                            <div className="h-8 w-[1px] bg-slate-200 hidden md:block" />
                            <div className="w-full md:w-auto min-w-[200px] px-2">
                                 <Select value={filterStatus} onValueChange={setFilterStatus}>
                                    <SelectTrigger className="h-12 border-0 bg-transparent font-medium text-slate-600 focus:ring-0">
                                        <div className="flex items-center gap-2">
                                            <Filter className="h-4 w-4" />
                                            <SelectValue placeholder="Semua Status" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Semua Status</SelectItem>
                                        <SelectItem value="active">Aktif</SelectItem>
                                        <SelectItem value="expired">Kedaluwarsa</SelectItem>
                                        <SelectItem value="locked">Dikunci Manual</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </Card>

                    {/* Table Perusahaan */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow className="hover:bg-transparent border-b-slate-200">
                                    <TableHead className="py-4 px-6 font-medium text-[#011e4b]">Perusahaan</TableHead>
                                    <TableHead className="py-4 font-medium text-[#011e4b]">Status Akses</TableHead>
                                    <TableHead className="py-4 font-medium text-[#011e4b] text-center">Masa Aktif</TableHead>
                                    <TableHead className="py-4 font-medium text-[#011e4b] text-center">Master Lock</TableHead>
                                    <TableHead className="py-4 px-6 font-medium text-[#011e4b] text-right">Manajemen</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredCompanies.map((c) => {
                                    const isExpired = c.subscription_end_date && new Date(c.subscription_end_date) < new Date();
                                    const isLocked = c.is_manually_locked || isExpired;
                                    
                                    return (
                                        <TableRow key={c.id} className="group hover:bg-slate-50/50 transition-colors border-b-slate-100">
                                            <TableCell className="py-4 px-6">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-medium text-slate-800 text-base">{c.name}</span>
                                                    <span className="text-sm text-slate-500 truncate max-w-[250px]">{c.address || 'No address registered'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={`px-3 py-1 rounded-full text-[11px] font-medium tracking-wide border-0
                                                    ${c.is_manually_locked ? 'bg-red-100 text-red-700' : isExpired ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}
                                                >
                                                    {c.is_manually_locked ? 'SUSPENDED' : isExpired ? 'EXPIRED' : 'ACTIVE'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center text-slate-600">
                                                {formatDate(c.subscription_end_date)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex justify-center">
                                                    <Switch
                                                        checked={c.is_manually_locked}
                                                        onCheckedChange={() => handleToggleCompanyLock(c)}
                                                        className="data-[state=checked]:bg-red-500"
                                                    />
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4 px-6 text-right">
                                                <Button 
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => handleEditCompanySubscription(c)}
                                                    className="text-[#015a97] hover:bg-[#afcddd]/20 hover:text-[#011e4b] font-medium"
                                                >
                                                    Configure <Settings className="ml-2 h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                        {filteredCompanies.length === 0 && (
                            <div className="py-20 text-center space-y-4">
                                <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-slate-400">
                                    <Search size={28} />
                                </div>
                                <p className="text-slate-500">Tidak ada perusahaan yang ditemukan.</p>
                            </div>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="payments" className="animate-in fade-in slide-in-from-bottom-2">
                    <Card className="border border-slate-200 shadow-md bg-white rounded-2xl overflow-hidden">
                        <CardHeader className="bg-gradient-to-r from-[#015a97] to-[#011e4b] text-white p-8">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white/10 rounded-xl backdrop-blur-md">
                                    <CreditCard className="h-8 w-8" />
                                </div>
                                <div>
                                    <CardTitle className="text-2xl font-medium">Verifikasi Pembayaran</CardTitle>
                                    <CardDescription className="text-blue-100 mt-1">Pantau dan setujui bukti transfer dari tenant.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <SubscriptionPaymentList />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Modal Setting Langganan */}
            <Dialog open={isCompanySubDialog} onOpenChange={setIsCompanySubDialog}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="font-medium">Atur Langganan: {selectedCompany?.name}</DialogTitle>
                    </DialogHeader>
                    <CompanyExtensionForm 
                        company={selectedCompany} 
                        onSuccess={() => {
                            setIsCompanySubDialog(false);
                            fetchCompanies();
                        }}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default BillingAccountPage;