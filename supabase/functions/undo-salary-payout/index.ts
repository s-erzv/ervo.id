// supabase/functions/undo-salary-payout/index.ts
// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' 
  );
  
  try {
    const { payout_id } = await req.json();

    if (!payout_id) {
        return new Response(JSON.stringify({ error: "Payout ID wajib disertakan." }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }

    // --- 1. AMBIL DETAIL TRANSAKSI (Gunakan ilike atau lowercase untuk safety) ---
    const { data: expenseTx, error: fetchError } = await supabaseAdmin
      .from('financial_transactions')
      .select('id') 
      .eq('id', payout_id)
      .eq('source_table', 'salary_payouts')
      .ilike('type', 'expense') // PERBAIKAN: Gunakan ilike agar 'Expense' atau 'expense' sama saja
      .maybeSingle();

    if (fetchError || !expenseTx) {
        throw new Error(`Transaksi Pembayaran ID ${payout_id.substring(0,8)}... tidak ditemukan atau bukan transaksi gaji.`);
    }

    // --- 2. HAPUS TRANSAKSI (OTOMATIS BALIKIN SALDO VIA TRIGGER DB) ---
    const { error: deleteError } = await supabaseAdmin
      .from('financial_transactions')
      .delete()
      .eq('id', payout_id);

    if (deleteError) throw deleteError;
    
    return new Response(JSON.stringify({ success: true, message: "Pembayaran berhasil dibatalkan." }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});