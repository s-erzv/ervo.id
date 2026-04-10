// supabase/functions/process-salary-payout/index.ts
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

  try {
    // Data yang dikirim dari handlePayout di client
    const { 
      employeeId, 
      companyId, 
      amount, 
      paymentMethodId, 
      description, // Deskripsi lengkap dari client
      employeeName 
    } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (!employeeId || !companyId || !amount || !paymentMethodId || parseFloat(amount) <= 0) {
      return new Response(JSON.stringify({ error: 'Data pembayaran tidak lengkap atau jumlah tidak valid.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const numericAmount = parseFloat(amount);
    
    // 1. Masukkan Transaksi Pengeluaran ke financial_transactions (MENGURANGI SALDO KEUNANGAN)
    const { data: transaction, error: transactionError } = await supabase
      .from('financial_transactions')
      .insert({
        company_id: companyId,
        type: 'expense', // Dicatat sebagai pengeluaran
        amount: numericAmount,
        description: description,
        payment_method_id: paymentMethodId,
        source_table: 'salary_payout',
        source_id: employeeId, 
      })
      .select('id')
      .single();

    if (transactionError) throw transactionError;

    // 2. Kirim Notifikasi ke Karyawan (Opsional)
    const { error: notificationError } = await supabase.from('notifications').insert({
        user_id: employeeId,
        message: `Pembayaran gaji sebesar ${new Intl.NumberFormat('id-ID').format(numericAmount)} telah diproses.`,
        type: 'salary_paid',
        link_to: '/financial-management'
    });
    
    if (notificationError) console.error('Warning: Gagal mengirim notifikasi gaji:', notificationError.message);


    return new Response(JSON.stringify({ message: 'Pembayaran gaji berhasil dicatat.', transactionId: transaction.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in process-salary-payout:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});