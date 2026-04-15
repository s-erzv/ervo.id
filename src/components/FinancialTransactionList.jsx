import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ExternalLink, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
};

const FinancialTransactionList = ({ transactions, loading }) => {
  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-[#011e4b]" />
      </div>
    );
  }

  if (transactions.length === 0) {
    return <p className="text-center text-gray-500 py-10">Belum ada riwayat transaksi.</p>;
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="w-[120px]">Tanggal</TableHead>
            <TableHead>Kategori & Sub</TableHead>
            <TableHead>Deskripsi</TableHead>
            <TableHead>Metode</TableHead>
            <TableHead className="text-right">Jumlah</TableHead>
            <TableHead className="w-[80px]">Bukti</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((t) => (
            <TableRow key={t.id} className="hover:bg-slate-50 transition-colors">
              <TableCell className="text-xs">
                {new Date(t.date).toLocaleDateString('id-ID')}
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-semibold text-xs text-[#011e4b] flex items-center gap-1">
                    {t.type === 'income' ? 
                      <ArrowUpRight className="h-3 w-3 text-green-600" /> : 
                      <ArrowDownLeft className="h-3 w-3 text-red-600" />
                    }
                    {t.categoryName || 'Lain-lain'}
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-4">
                    {t.subcategoryName || '-'}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                    <span className="text-sm">{t.description}</span>
                    <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded w-fit text-slate-500 mt-1">{t.source}</span>
                </div>
              </TableCell>
              <TableCell className="text-xs">
                {t.method}
                {t.account && t.methodType === 'transfer' && (
                  <span className="block text-[10px] text-muted-foreground italic">({t.account})</span>
                )}
              </TableCell>
              <TableCell className={`text-right font-bold ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
              </TableCell>
              <TableCell>
                {t.proofUrl ? (
                  <a href={t.proofUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : <span className="text-gray-300">-</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default FinancialTransactionList;