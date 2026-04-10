// supabase/functions/adjust-stock-reconciliation/index.ts
// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // PERBAIKAN: Hapus 'stockType' dari destructuring, karena kita akan mengambilnya per item.
    const { reconciliationItems, companyId, userId } = await req.json()
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Simpan rekonsiliasi ke tabel history
    const { data: reconciliationRecord, error: insertError } = await supabase
      .from('stock_reconciliations')
      .insert({
        company_id: companyId,
        user_id: userId,
        items: reconciliationItems,
        reconciliation_date: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 2. Perbarui stok produk dan buat pergerakan stok
    for (const item of reconciliationItems) {
      // PERBAIKAN KRUSIAL 1: Pastikan 'difference' diperlakukan sebagai angka.
      const diff = parseFloat(item.difference);

      // PERBAIKAN KRUSIAL 2: Pastikan hanya item dengan perbedaan non-nol yang diproses.
      if (!isNaN(diff) && diff !== 0) {
        
        // PERBAIKAN KRUSIAL 3: Tentukan kolom yang di-update BERSADARKAN TIPE STOK DARI ITEM.
        const updateColumn = item.stock_type === 'empty_bottle_stock' ? 'empty_bottle_stock' : 'stock';
        
        const newStock = parseFloat(item.physical_count);
        
        // Perbarui stok produk
        const { error: updateError } = await supabase
          .from('products')
          .update({ [updateColumn]: newStock })
          .eq('id', item.product_id);
          
        if (updateError) throw updateError;

        // Tambahkan catatan pergerakan stok
        // Gunakan 'diff' yang sudah numerik
        const movementTypeBase = diff > 0 ? 'masuk' : 'keluar';
        const movementType = `${movementTypeBase}_rekonsiliasi`;
        
        // Deskripsi yang lebih informatif
        const notes = `Penyesuaian otomatis dari rekonsiliasi stok (${updateColumn.replace('_', ' ')}). Selisih: ${diff}`;
        
        const { error: movementError } = await supabase
          .from('stock_movements')
          .insert({
            product_id: item.product_id,
            qty: Math.abs(diff), // Gunakan 'diff' yang sudah numerik
            type: movementType,
            notes: notes,
            company_id: companyId,
            user_id: userId,
            reconciliation_id: reconciliationRecord.id
          });
          
        if (movementError) throw movementError;
      }
    }

    const { data: admin, error: adminError } = await supabase
      .from('profiles')
      .select('id')
      .eq('company_id', companyId)
      .eq('role', 'admin')
      .single();

    if (admin) {
      const { data: user } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
      const userName = user?.full_name || 'Seorang pengguna';

      await supabase.from('notifications').insert({
        user_id: admin.id,
        message: `${userName} telah melakukan rekonsiliasi stok.`,
        type: 'stock_reconciliation',
        link_to: '/stock-reconciliation'
      });
    }


    return new Response(JSON.stringify({ message: 'Stok berhasil disesuaikan secara otomatis.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in adjust-stock-reconciliation:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});