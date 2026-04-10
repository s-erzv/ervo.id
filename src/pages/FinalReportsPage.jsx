import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format, subDays } from 'date-fns';
import { FileText, Plus, X, Printer, RefreshCcw, ChevronDown, ChevronUp, GripVertical, Database, History, Trash2, Eye, Edit3, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Separator } from '@/components/ui/separator';
import * as XLSX from 'xlsx';

const getStartOf30Days = () => format(subDays(new Date(), 29), 'yyyy-MM-dd');
const getTodayDate = () => format(new Date(), 'yyyy-MM-dd');

const formatCurrency = (amount) => 
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount ?? 0);

const calculateDaysDifference = (start, end) => {
    const dayDifference = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)) + 1; 
    return Math.max(1, dayDifference);
};

const createEmptyExpenseItem = (initialData = {}) => ({ 
    id: initialData.id || `item-${Math.random().toString(36).substr(2, 9)}`,
    description: initialData.description || '', 
    amount: initialData.amount || '0', 
    type: initialData.type || 'expense', 
    category: initialData.category || 'opex',
    selectedCatId: initialData.selectedCatId || '',
    isCollapsed: true, 
});

const FinalReportsPage = () => {
    const { companyId, companyName, session } = useAuth();
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [startDate, setStartDate] = useState(getStartOf30Days());
    const [endDate, setEndDate] = useState(getTodayDate());
    const [companyDetails, setCompanyDetails] = useState({ address: '', logo_url: null, name: '' });
    const [finCategories, setFinCategories] = useState([]);
    const [reportHistory, setReportHistory] = useState([]);
    
    const [metricData, setMetricData] = useState({ totalOrderCount: 0, totalGrossProfitFromOrders: 0, totalQuantitySold: 0 });
    const [financialSummary, setFinancialSummary] = useState({ sales: 0, cogs: 0, grossProfit: 0, discount: 0, transportCost: 0 });
    const [manualItems, setManualItems] = useState([]);
    
    const [editingHistoryId, setEditingHistoryId] = useState(null);

    const fetchAndAutoGenerate = useCallback(async () => {
        setLoading(true);
        try {
            const { data: catData } = await supabase.from('financial_categories').select('*, financial_subcategories(*)').eq('company_id', companyId);
            setFinCategories(catData || []);

            const { data: txData } = await supabase.from('financial_transactions')
                .select('amount, category_id, type')
                .eq('company_id', companyId)
                .gte('transaction_date', startDate)
                .lte('transaction_date', `${endDate}T23:59:59`);

            const autoItems = (catData || [])
                .filter(c => !c.name.toLowerCase().includes('harga pokok'))
                .map(cat => {
                    const total = txData
                        ?.filter(t => t.category_id === cat.id)
                        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0) || 0;

                    return createEmptyExpenseItem({
                        description: cat.name,
                        amount: total.toString(),
                        type: cat.type,
                        category: cat.type === 'income' ? 'dll' : 'opex',
                        selectedCatId: cat.id
                    });
                });
            setManualItems(autoItems);
            setEditingHistoryId(null);
        } catch (err) {
            toast.error("Gagal sinkron data");
        } finally {
            setLoading(false);
        }
    }, [companyId, startDate, endDate]);

    const fetchHistory = useCallback(async () => {
        const { data } = await supabase.from('final_report_history').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
        setReportHistory(data || []);
    }, [companyId]);

    // FITUR EXCEL RIWAYAT
    const handleExportExcel = () => {
        if (reportHistory.length === 0) return toast.error("Tidak ada data riwayat.");
        
        const dataForExcel = reportHistory.map(h => ({
            'Periode Mulai': h.start_date,
            'Periode Selesai': h.end_date,
            'Net Profit': h.total_net_profit,
            'Tanggal Simpan': format(new Date(h.created_at), 'dd/MM/yyyy HH:mm'),
            'Link PDF': h.pdf_url
        }));

        const ws = XLSX.utils.json_to_sheet(dataForExcel);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Riwayat Laporan");
        XLSX.writeFile(wb, `Riwayat_Laporan_${format(new Date(), 'ddMMyy_HHmm')}.xlsx`);
        toast.success("Excel berhasil diunduh.");
    };

    const handleEditHistory = (h) => {
        setEditingHistoryId(h.id);
        setStartDate(h.start_date);
        setEndDate(h.end_date);
        if (h.report_data?.manualItems) {
            setManualItems(h.report_data.manualItems);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        toast.success("Mode Edit Riwayat Aktif");
    };

    const fetchFinancialSummary = useCallback(async () => {
        if (!companyId) return;
        try {
            const { data: companyData } = await supabase.from('companies').select('*').eq('id', companyId).single();
            if (companyData) setCompanyDetails(companyData);

            const { data: ordersData } = await supabase.from('orders')
                .select(`transport_cost, invoices(total_discount), order_items (qty, price, purchase_price, products ( purchase_price ) )`)
                .eq('company_id', companyId).eq('status', 'completed')
                .gte('delivered_at', startDate).lte('delivered_at', `${endDate}T23:59:59`);

            let totalRev = 0; let prodCogs = 0; let totalDisc = 0; let totalTrans = 0; let totalQty = 0;
            ordersData?.forEach(o => {
                o.order_items.forEach(i => {
                    totalRev += i.price * i.qty;
                    prodCogs += (i.purchase_price || i.products?.purchase_price || 0) * i.qty;
                    totalQty += i.qty;
                });
                totalTrans += parseFloat(o.transport_cost || 0);
                const inv = Array.isArray(o.invoices) ? o.invoices[0] : o.invoices;
                totalDisc += Number(inv?.total_discount || 0);
            });
            const netSales = totalRev - totalDisc;
            setFinancialSummary({ sales: netSales, cogs: prodCogs, grossProfit: netSales - prodCogs, discount: totalDisc, transportCost: totalTrans });
            setMetricData({ totalOrderCount: ordersData?.length || 0, totalGrossProfitFromOrders: netSales - prodCogs, totalQuantitySold: totalQty });
        } catch(e) {}
    }, [companyId, startDate, endDate]);

    useEffect(() => { 
        if (companyId) {
            if (!editingHistoryId) {
                fetchAndAutoGenerate(); 
            }
            fetchFinancialSummary();
            fetchHistory();
        }
    }, [companyId, startDate, endDate, fetchHistory, fetchFinancialSummary, editingHistoryId]);

    const handleSaveAndPrint = async () => {
        if (!companyId || !session) return;
        setIsSubmitting(true);
        const tid = toast.loading('Memproses laporan...');
        try {
            const payload = {
                companyId, companyName: companyDetails.name || companyName, startDate, endDate, 
                financialSummary, opexList, dllList, incomeList, totalOpex, ebitda, netProfit, 
                salesPerDay, atv, agp, upt, totalTransportCost: financialSummary.transportCost,
                manualItems 
            };

            const response = await fetch(`https://wzmgcainyratlwxttdau.supabase.co/functions/v1/generate-final-report-pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                body: JSON.stringify(payload),
            });
            const resData = await response.json();
            if (!response.ok) throw new Error(resData.error);

            const { error: upsertError } = await supabase.from('final_report_history').upsert({
                ...(editingHistoryId ? { id: editingHistoryId } : {}),
                company_id: companyId,
                start_date: startDate,
                end_date: endDate,
                pdf_url: resData.pdfUrl,
                report_data: payload,
                total_net_profit: netProfit
            });

            if (upsertError) throw upsertError;

            window.open(resData.pdfUrl, '_blank');
            toast.success(editingHistoryId ? 'Riwayat diperbarui!' : 'Laporan disimpan!', { id: tid });
            setEditingHistoryId(null);
            fetchHistory();
        } catch (error) { toast.error("Gagal memproses", { id: tid }); } finally { setIsSubmitting(false); }
    };

    const onDrDropshipperd = (result) => {
        if (!result.destination) return;
        const items = Array.from(manualItems);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);
        setManualItems(items);
    };

    const aggregatedManualItems = useMemo(() => {
        let totalOpex = 0; let totalDll = 0;
        manualItems.forEach(item => {
            const amount = parseFloat(item.amount) || 0;
            if (item.type === 'income') {
                if (item.category === 'opex') totalOpex -= amount; else totalDll -= amount;
            } else { 
                if (item.category === 'opex') totalOpex += amount; else totalDll += amount;
            }
        });
        return {
            opexList: manualItems.filter(i => i.category === 'opex'),
            dllList: manualItems.filter(i => i.category === 'dll' && i.type === 'expense'),
            incomeList: manualItems.filter(i => i.category === 'dll' && i.type === 'income'),
            totalOpex, totalDll
        };
    }, [manualItems]);

    const { totalOpex, totalDll, opexList, dllList, incomeList } = aggregatedManualItems;
    const ebitda = financialSummary.grossProfit + financialSummary.transportCost - totalOpex;
    const netProfit = ebitda - totalDll;
    const daysInPeriod = calculateDaysDifference(startDate, endDate);
    const salesPerDay = financialSummary.sales / daysInPeriod;
    const atv = financialSummary.sales / (metricData.totalOrderCount || 1);
    const agp = metricData.totalGrossProfitFromOrders / (metricData.totalOrderCount || 1);
    const upt = metricData.totalQuantitySold / (metricData.totalOrderCount || 1);

    const metrikKinerja = [
        { label: 'Sales Per Day', value: salesPerDay, format: (v) => formatCurrency(v) },
        { label: 'Avg Transaction Value', value: atv, format: (v) => formatCurrency(v) },
        { label: 'Avg Gross Profit', value: agp, format: (v) => formatCurrency(v) },
        { label: 'Units Per Transaction', value: upt, format: (v) => v.toFixed(2) + ' pcs' },
    ];

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900"><FileText className="text-blue-600" /> Laporan Final</h1>
                <div className="flex gap-2">
                    <Button onClick={() => { setEditingHistoryId(null); fetchAndAutoGenerate(); }} variant="outline" size="sm" className="h-9 font-medium text-blue-600 border-blue-200"><RefreshCcw className="h-4 w-4 mr-2" /> Sync Ulang</Button>
                    <Button onClick={handleSaveAndPrint} className={`h-9 text-white font-bold px-6 ${editingHistoryId ? 'bg-orange-600 hover:bg-orange-700' : 'bg-slate-900 hover:bg-slate-800'}`} disabled={isSubmitting}>
                        <Printer className="h-4 w-4 mr-2" /> {editingHistoryId ? 'Update & Cetak' : 'Simpan & Cetak'}
                    </Button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* KIRI: PREVIEW LAPORAN */}
                <div className="lg:col-span-2 space-y-8">
                    <Card className="p-6 shadow-2xl border-t-8 border-t-slate-900 bg-white min-h-[600px]">
                        <div className="flex justify-between border-b-2 pb-6 mb-8">
                            <div className="flex items-center gap-4">
                                {companyDetails.logo_url ? <img src={companyDetails.logo_url} className="h-12 w-12 object-contain" /> : <div className="h-12 w-12 bg-slate-100 rounded flex items-center justify-center text-[10px] font-bold">LOGO</div>}
                                <div><h2 className="text-lg font-bold text-slate-900 uppercase">{companyName}</h2><p className="text-xs text-slate-500">{companyDetails.address}</p></div>
                            </div>
                            <div className="text-right text-xs text-slate-500 uppercase">
                                <p className="font-bold text-slate-800">Laporan Laba Rugi</p>
                                <p>{startDate} - {endDate}</p>
                            </div>
                        </div>

                        <div className="space-y-5">
                            <div className="flex justify-between text-sm"><span>Penjualan Bersih</span><span className="font-bold">{formatCurrency(financialSummary.sales)}</span></div>
                            <div className="flex justify-between text-sm text-red-600 font-medium"><span>Beban Pokok Penjualan (COGS)</span><span>({formatCurrency(financialSummary.cogs)})</span></div>
                            <div className="flex justify-between p-3 bg-green-50 rounded-lg font-bold text-green-800 border border-green-100 text-base"><span>LABA KOTOR</span><span>{formatCurrency(financialSummary.grossProfit)}</span></div>
                            
                            <div className="pt-2">
                                <h4 className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Biaya Operasional (OPEX)</h4>
                                <div className="space-y-2 border-l-2 border-slate-100 ml-1">
                                    {opexList.map(i => (
                                        <div key={i.id} className="flex justify-between text-xs pl-4 group">
                                            <span className="text-slate-600">{i.description || 'Tanpa Nama'}</span>
                                            <span className={i.type === 'expense' ? 'text-red-500' : 'text-blue-500'}>{i.type === 'expense' ? '-' : '+'} {formatCurrency(parseFloat(i.amount) || 0)}</span>
                                        </div>
                                    ))}
                                    {financialSummary.transportCost > 0 && <div className="flex justify-between text-xs pl-4 text-blue-600 font-bold"><span>Biaya Transportasi</span><span>+ {formatCurrency(financialSummary.transportCost)}</span></div>}
                                </div>
                            </div>
                            
                            <div className="flex justify-between p-3 bg-slate-100 rounded-lg font-bold text-slate-800 border border-slate-200"><span>EBITDA</span><span>{formatCurrency(ebitda)}</span></div>
                            
                            <div className="pt-2">
                                <h4 className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Pendapatan & Biaya Lainnya</h4>
                                <div className="space-y-2 border-l-2 border-slate-100 ml-1">
                                    {dllList.map(i => (
                                        <div key={i.id} className="flex justify-between text-xs pl-4 text-red-500"><span>{i.description}</span><span>- {formatCurrency(parseFloat(i.amount) || 0)}</span></div>
                                    ))}
                                    {incomeList.map(i => (
                                        <div key={i.id} className="flex justify-between text-xs pl-4 text-blue-500"><span>{i.description}</span><span>+ {formatCurrency(parseFloat(i.amount) || 0)}</span></div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-between p-4 bg-blue-600 text-white rounded-xl font-black text-xl shadow-lg shadow-blue-200">
                                <span>LABA BERSIH (NET)</span>
                                <span>{formatCurrency(netProfit)}</span>
                            </div>

                            <div className="mt-10 grid grid-cols-2 gap-4">
                                {metrikKinerja.map(m => (
                                    <div key={m.label} className="p-4 bg-slate-50 rounded-xl border border-slate-200 group hover:border-blue-400 transition-all">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{m.label}</p>
                                        <p className="text-lg font-bold text-slate-800">{m.format(m.value)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Card>
                </div>

                {/* KANAN: PANEL KONTROL & TATA LETAK */}
                <div className="space-y-6">
                    <Card className={`border-0 shadow-xl sticky top-6 overflow-hidden transition-all ${editingHistoryId ? 'ring-2 ring-orange-500' : ''}`}>
                        <CardHeader className={`${editingHistoryId ? 'bg-orange-600' : 'bg-slate-900'} text-white p-4`}>
                            <CardTitle className="text-xs font-bold tracking-widest uppercase flex items-center gap-2">
                                <Database className="h-4 w-4" /> {editingHistoryId ? 'Sedang Edit Riwayat' : 'Tata Letak Item'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-6 bg-slate-50/50">
                            {editingHistoryId && (
                                <div className="p-2 bg-orange-100 text-orange-800 text-[10px] font-bold rounded text-center mb-2 animate-pulse">
                                    MENGEDIT DATA PERIODE {startDate}
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1"><Label className="text-[10px] font-bold">Mulai</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 text-xs shadow-sm" /></div>
                                <div className="space-y-1"><Label className="text-[10px] font-bold">Selesai</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 text-xs shadow-sm" /></div>
                            </div>
                            
                            <Separator />
                            
                            <div className="flex items-center justify-between">
                                <Label className="text-[10px] font-black text-slate-500 uppercase">Urutan Baris (DND)</Label>
                                <Button onClick={() => setManualItems([...manualItems, createEmptyExpenseItem()])} variant="outline" size="sm" className="h-7 text-[10px] border-blue-200 text-blue-600 bg-blue-50">+ Baris</Button>
                            </div>

                            <DragDropContext onDrDropshipperd={onDrDropshipperd}>
                                <Droppable droppableId="manualItems">
                                    {(provided) => (
                                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
                                            {manualItems.map((item, index) => (
                                                <Draggable key={item.id} draggableId={item.id} index={index}>
                                                    {(p) => (
                                                        <div ref={p.innerRef} {...p.draggableProps} className="bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow">
                                                            <div className="flex items-center p-2 bg-white gap-2">
                                                                <div {...p.dragHandleProps} className="text-slate-300 hover:text-slate-600"><GripVertical className="h-4 w-4" /></div>
                                                                <div className="flex-1 truncate"><span className="text-[11px] font-bold text-slate-700 uppercase">{item.description || "Untitled"}</span></div>
                                                                <Button variant="ghost" size="icon" onClick={() => {
                                                                    const n = [...manualItems]; n[index].isCollapsed = !n[index].isCollapsed; setManualItems(n);
                                                                }} className="h-7 w-7 text-slate-400">{item.isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}</Button>
                                                            </div>
                                                            {!item.isCollapsed && (
                                                                <div className="p-3 pt-0 space-y-3 border-t bg-slate-50/30">
                                                                    <div className="grid grid-cols-2 gap-2 pt-3">
                                                                        <div className="space-y-1">
                                                                            <Label className="text-[9px] uppercase font-bold">Jenis</Label>
                                                                            <Select value={item.type} onValueChange={(v) => { const n = [...manualItems]; n[index].type = v; setManualItems(n); }}>
                                                                                <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                                                                                <SelectContent><SelectItem value="expense">Keluar</SelectItem><SelectItem value="income">Masuk</SelectItem></SelectContent>
                                                                            </Select>
                                                                        </div>
                                                                        <div className="space-y-1">
                                                                            <Label className="text-[9px] uppercase font-bold">Grup</Label>
                                                                            <Select value={item.category} onValueChange={(v) => { const n = [...manualItems]; n[index].category = v; setManualItems(n); }}>
                                                                                <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                                                                                <SelectContent><SelectItem value="opex">OPEX</SelectItem><SelectItem value="dll">DLL</SelectItem></SelectContent>
                                                                            </Select>
                                                                        </div>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <Label className="text-[9px] uppercase font-bold">Label & Nominal</Label>
                                                                        <Input placeholder="Label..." value={item.description} onChange={(e) => { const n = [...manualItems]; n[index].description = e.target.value; setManualItems(n); }} className="h-8 text-xs mb-1" />
                                                                        <Input type="number" value={item.amount} onChange={(e) => { const n = [...manualItems]; n[index].amount = e.target.value; setManualItems(n); }} className="h-8 text-xs font-bold" />
                                                                    </div>
                                                                    <Button variant="ghost" size="sm" onClick={() => setManualItems(manualItems.filter((_, i) => i !== index))} className="w-full h-7 text-[10px] text-red-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3 w-3 mr-1" /> Hapus Baris</Button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </DragDropContext>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* TABEL RIWAYAT DENGAN FITUR EXCEL */}
            <Card className="border-0 shadow-2xl bg-white overflow-hidden">
                <CardHeader className="bg-slate-50 border-b p-6 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><History className="h-5 w-5" /></div>
                        <div>
                            <CardTitle className="text-lg">Riwayat Laporan</CardTitle>
                            <CardDescription>Semua laporan yang telah dicetak dan disimpan ke sistem.</CardDescription>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" className="h-9 border-green-200 text-green-700 bg-green-50 hover:bg-green-100" onClick={handleExportExcel}>
                        <Download className="h-4 w-4 mr-2" /> Export Excel
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b uppercase text-[10px] font-black text-slate-400 tracking-widest">
                                <tr>
                                    <th className="p-4 text-left">Periode Laporan</th>
                                    <th className="p-4 text-left">Total Net Profit</th>
                                    <th className="p-4 text-left">Tanggal Simpan</th>
                                    <th className="p-4 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {reportHistory.map(h => (
                                    <tr key={h.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="p-4 font-bold text-slate-700">{h.start_date} s/d {h.end_date}</td>
                                        <td className="p-4 font-black text-blue-600">{formatCurrency(h.total_net_profit)}</td>
                                        <td className="p-4 text-slate-500 text-xs">{format(new Date(h.created_at), 'dd MMM yyyy HH:mm')}</td>
                                        <td className="p-4 text-right space-x-2">
                                            <Button variant="outline" size="sm" onClick={() => window.open(h.pdf_url, '_blank')} className="h-8 text-xs border-slate-200"><Eye className="h-3 w-3 mr-1" /> View PDF</Button>
                                            <Button variant="outline" size="sm" onClick={() => handleEditHistory(h)} className="h-8 text-xs text-blue-600 border-blue-100 hover:bg-blue-50"><Edit3 className="h-3 w-3 mr-1" /> Edit Layout</Button>
                                            <Button variant="outline" size="sm" onClick={async () => {
                                                if(confirm("Hapus riwayat permanen?")) {
                                                    await supabase.from('final_report_history').delete().eq('id', h.id);
                                                    fetchHistory();
                                                }
                                            }} className="h-8 text-xs text-red-500 border-red-100 hover:bg-red-50"><Trash2 className="h-3 w-3 mr-1" /> Delete</Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {reportHistory.length === 0 && <div className="p-20 text-center text-slate-300 italic flex flex-col items-center gap-2"><FileText className="h-10 w-10 opacity-20" /> Belum ada riwayat laporan yang disimpan.</div>}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default FinalReportsPage;