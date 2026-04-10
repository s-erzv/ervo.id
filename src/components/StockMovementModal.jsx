// src/components/StockMovementModal.jsx

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge"; 
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

// Helper untuk memformat angka
const formatStockQty = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'decimal',
      minimumFractionDigits: 0
    }).format(amount);
};

// --- FIX: Helper baru untuk menentukan arah pergerakan (tanpa 'pengembalian') ---
const getMovementDirection = (type) => {
    if (!type) return 'NEUTRAL';
    
    // Tipe yang MENAMBAH stok
    const increaseTypes = [
        'masuk_rekonsiliasi', 
        'masuk_dari_pusat', 
        'masuk_edit_pesanan', 
        'manual_adjustment_in',
        // 'pengembalian' Dihapus
    ];

    // Tipe yang MENGURANGI stok
    const decreaseTypes = [
        'keluar', 
        'keluar_rekonsiliasi', 
        'keluar_edit_pesanan', 
        'manual_adjustment_out'
    ];

    if (increaseTypes.includes(type.toLowerCase())) return 'IN';
    if (decreaseTypes.includes(type.toLowerCase())) return 'OUT';
    
    return 'NEUTRAL'; // Failsafe untuk tipe yang tidak dikenal (seperti 'pengembalian' sekarang)
};
// --- END FIX ---


export function StockMovementModal({ isOpen, onClose, data }) {
  if (!data || !data.dailyRecord) return null;

  const { productName, dailyRecord, movements } = data;
  const loading = movements === null;

  // --- FIX: Filter 'pengembalian' dari tampilan ---
  const filteredMovements = movements 
    ? movements.filter(move => move.movement_type !== 'pengembalian') 
    : [];
  // --- END FIX ---

  const getMovementStyle = (type) => {
    const direction = getMovementDirection(type);
    const isAdjustment = type.toLowerCase().includes('reconciliation') || type.toLowerCase().includes('manual_adjustment');
    
    if (isAdjustment) return "bg-yellow-100 text-yellow-700 hover:bg-yellow-100";
    if (direction === 'IN') return "bg-green-100 text-green-700 hover:bg-green-100";
    if (direction === 'OUT') return "bg-red-100 text-red-700 hover:bg-red-100";
    return "bg-gray-100 text-gray-700 hover:bg-gray-100"; // Neutral (termasuk 'pengembalian' jika lolos filter)
  };
  
  // Mengambil stok akhir hari dari data rekap harian
  const finalStockQty = dailyRecord.records?.[dailyRecord.productIdForDisplay]?.qty ?? dailyRecord.stock_qty ?? 'N/A';
  
  const displayProductName = productName || "Detail Stok";
  const displayDate = format(new Date(dailyRecord.date), 'EEEE, dd MMMM yyyy');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Detail Pergerakan Stok: {displayProductName}
          </DialogTitle>
          <p className="text-sm text-gray-500">
            Tanggal: {displayDate}
          </p>
        </DialogHeader>
        
        <div className="py-2 space-y-4">
          <div className="flex justify-between p-3 border rounded-lg bg-secondary/20">
            <p className="text-lg">Stok Tercatat (Akhir Hari):</p>
            <p className="text-2xl font-extrabold text-primary">{formatStockQty(finalStockQty)}</p>
          </div>

          <h4 className="text-lg font-semibold pt-4">Log Pergerakan Harian:</h4>
          
          {loading ? (
            <div className="flex justify-center items-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                <span className="ml-2 text-sm text-gray-600">Memuat data pergerakan...</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Waktu</TableHead>
                  <TableHead className="w-[120px]">Tipe</TableHead>
                  <TableHead className="w-[100px] text-right">Jumlah</TableHead>
                  <TableHead>Sumber Transaksi</TableHead>
                  <TableHead>Keterangan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* --- FIX: Gunakan filteredMovements --- */}
                {filteredMovements.length > 0 ? (
                  filteredMovements.map((move, index) => {
                    const direction = getMovementDirection(move.movement_type);
                    
                    return (
                        <TableRow key={move.movement_id || index}>
                        <TableCell className="text-xs font-mono">
                            {format(new Date(move.movement_timestamp), 'HH:mm:ss')}
                        </TableCell>
                        <TableCell>
                            <Badge variant="secondary" className={getMovementStyle(move.movement_type)}>
                            {move.movement_type.replace(/_/g, ' ').toUpperCase()}
                            </Badge>
                        </TableCell>
                        <TableCell className={`text-right font-mono font-medium ${
                            direction === 'IN' ? 'text-green-600' : direction === 'OUT' ? 'text-red-600' : 'text-gray-500'
                        }`}>
                            {direction === 'OUT' ? `- ${formatStockQty(move.quantity)}` : 
                             direction === 'IN' ? `+ ${formatStockQty(move.quantity)}` : 
                             `${formatStockQty(move.quantity)}`}
                        </TableCell>
                        <TableCell>
                            <span className="font-medium">{move.source_type}</span>: {move.source_reference}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 italic">
                            {move.notes || '-'}
                        </TableCell>
                        </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-gray-500">
                      Tidak ada pergerakan stok (selain pengembalian) tercatat untuk produk ini pada tanggal ini.
                    </TableCell>
                  </TableRow>
                )}
                {/* --- END FIX --- */}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}