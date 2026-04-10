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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Loader2, CalendarCheck, Search, Filter } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import CompanyExtensionForm from '../components/CompanyExtensionForm'; // Pastikan path ini benar!

// Helper untuk format tanggal
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
    const [filterStatus, setFilterStatus] = useState('all'); // 'active', 'expired', 'locked', 'all'

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
        // Ambil semua kolom yang dibutuhkan untuk manajemen langganan
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

    // Handler untuk Aksi Kunci Perusahaan
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

    // Handler untuk Buka Modal Setting Langganan Perusahaan
    const handleEditCompanySubscription = (company) => {
        setSelectedCompany(company);
        setIsCompanySubDialog(true);
    };

    // Filter dan Search Logic
    const filteredCompanies = useMemo(() => {
        let result = companies;

        // 1. Search (berdasarkan nama atau address)
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            result = result.filter(c => 
                c.name.toLowerCase().includes(searchLower) ||
                c.address?.toLowerCase().includes(searchLower)
            );
        }

        // 2. Filter Status
        if (filterStatus !== 'all') {
            result = result.filter(c => {
                const isExpired = c.subscription_end_date && new Date(c.subscription_end_date) < new Date();
                const isLocked = c.is_manually_locked === true;
                
                if (filterStatus === 'active') {
                    return !isLocked && !isExpired;
                } else if (filterStatus === 'expired') {
                    return isExpired && !isLocked;
                } else if (filterStatus === 'locked') {
                    return isLocked;
                }
                return true;
            });
        }

        return result;
    }, [companies, searchTerm, filterStatus]);


    if (!isSuperAdmin) {
        return <div className="text-red-500">Akses ditolak. Halaman ini hanya untuk Super Admin.</div>;
    }
    
    if (loading) {
        return (
            <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 md:p-8">
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                <CalendarCheck className="w-7 h-7 text-purple-600" /> Manajemen Langganan & Billing
            </h2>

            {/* Kontrol Search & Filter */}
            <Card className="mb-6 p-4">
                <div className="flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative w-full md:w-1/2">
                        <Input
                            placeholder="Cari nama atau alamat perusahaan..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    </div>
                    <div className="w-full md:w-auto flex items-center gap-2">
                         <Filter className="h-5 w-5 text-gray-500" />
                         <Select
                            value={filterStatus}
                            onValueChange={setFilterStatus}
                         >
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filter Status" />
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

            {/* Tabel Utama */}
            <Card className="border-0 shadow-lg bg-white">
                <CardHeader className="bg-purple-600 text-white rounded-t-lg">
                    <CardTitle>Daftar Perusahaan dan Status Langganan</CardTitle>
                </CardHeader>
                <CardContent className='p-2 md:p-4'>
                    <div className="rounded-md border overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="min-w-[200px]">Nama Perusahaan</TableHead>
                                    <TableHead className="min-w-[250px]">Alamat</TableHead>
                                    <TableHead className="text-center min-w-[150px]">Langganan s/d</TableHead>
                                    <TableHead className="text-center min-w-[120px]">Kunci Manual</TableHead>
                                    <TableHead className="min-w-[100px]">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredCompanies.map((c) => {
                                    const isExpired = c.subscription_end_date && new Date(c.subscription_end_date) < new Date();
                                    const isLocked = c.is_manually_locked || isExpired;
                                    
                                    return (
                                        <TableRow key={c.id} className={isLocked ? 'bg-red-50/50' : ''}>
                                            <TableCell className='font-medium'>{c.name}</TableCell>
                                            <TableCell>{c.address ?? '-'}</TableCell>
                                            <TableCell className="text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium 
                                                    ${c.is_manually_locked ? 'bg-red-100 text-red-700' : isExpired ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`
                                                }>
                                                    {c.is_manually_locked ? 'DIKUNCI' : isExpired ? 'KEDALUWARSA' : 'Aktif'}
                                                </span>
                                                <span className="block text-xs font-normal text-gray-500 mt-1">
                                                    s/d {formatDate(c.subscription_end_date)}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex items-center justify-center space-x-2">
                                                    <span 
                                                        className={`text-sm font-medium ${c.is_manually_locked ? 'text-red-600' : 'text-green-600'}`}
                                                    >
                                                        {c.is_manually_locked ? 'DIKUNCI' : 'AKTIF'}
                                                    </span>
                                                    <Switch
                                                        checked={c.is_manually_locked}
                                                        onCheckedChange={() => handleToggleCompanyLock(c)}
                                                        className="data-[state=checked]:bg-red-500 data-[state=unchecked]:bg-green-500"
                                                        title={c.is_manually_locked ? "Klik untuk Buka Kunci" : "Klik untuk Kunci Manual"}
                                                    />
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Button 
                                                    size="sm"
                                                    onClick={() => handleEditCompanySubscription(c)}
                                                    title='Perpanjang/Atur Masa Langganan'
                                                    className='bg-purple-500 hover:bg-purple-600 h-8'
                                                >
                                                    Atur
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {filteredCompanies.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                            {loading ? 'Memuat data...' : 'Tidak ada perusahaan yang cocok dengan filter.'}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Modal Setting Langganan */}
            <Dialog open={isCompanySubDialog} onOpenChange={setIsCompanySubDialog}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Atur Langganan Perusahaan: {selectedCompany?.name}</DialogTitle>
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