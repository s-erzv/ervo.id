// Path: supabase/functions/submit-expense-report/index.ts

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

  // --- URL untuk Edge Function OneSignal ---
  const notificationUrlOneSignal = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-onesignal-push`;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';


  try {
    const { expenseReport, expenseItems } = await req.json()
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      SUPABASE_SERVICE_ROLE_KEY
    )

    if (!expenseReport || !expenseItems || expenseItems.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing expense data' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 1. Simpan laporan pengeluaran ke tabel expense_reports
    const { data: newReport, error: reportError } = await supabase
      .from('expense_reports')
      .insert([expenseReport])
      .select('id')
      .single();

    if (reportError) throw reportError;
    const reportId = newReport.id;

    // 2. Siapkan item pengeluaran untuk dimasukkan
    const itemsToInsert = expenseItems.map(item => ({
      ...item,
      expense_report_id: reportId,
    }));

    // 3. Simpan item pengeluaran ke tabel expense_report_items
    const { error: itemsError } = await supabase
      .from('expense_report_items')
      .insert(itemsToInsert);

    if (itemsError) throw itemsError;

    // 4. Notifikasi Admin (Database dan Push Notification)
    const { data: admins } = await supabase
      .from('profiles')
      .select('id, full_name') 
      .eq('company_id', expenseReport.company_id)
      .in('role', ['admin', 'super_admin']);

    if (admins && admins.length > 0) {
      const { data: user } = await supabase.from('profiles').select('full_name').eq('id', expenseReport.user_id).single();
      const userName = user?.full_name || 'Seorang pengguna';
      
      // --- FIX 4: Add null check to expenseReport.total_amount ---
      const safeTotalAmount = expenseReport.total_amount || 0;
      const totalAmount = new Intl.NumberFormat('id-ID').format(safeTotalAmount); 
      const adminIds = admins.map(a => a.id);

      // Notifikasi Database untuk Admin
      await supabase.from('notifications').insert({
        user_id: adminIds[0], 
        message: `${userName} telah mengajukan laporan pengeluaran baru.`,
        type: 'expense_report',
        link_to: '/expenses'
      });
      
      // Notifikasi Database untuk User (Konfirmasi Submit)
      await supabase.from('notifications').insert({
        user_id: expenseReport.user_id,
        message: `Laporan pengeluaran Anda senilai Rp${totalAmount} telah diajukan.`,
        type: 'expense_report_submitted',
        link_to: '/expenses'
      });
      
      // FIX KRITIS: PANGGILAN PUSH ONE-SIGNAL UNTUK ADMIN
      const adminPayload = {
          user_ids: adminIds,
          title: `💰 Laporan Pengeluaran Baru`,
          message: `${userName} mengajukan laporan senilai Rp${totalAmount}.`,
          data: { reportId, type: 'new_expense', route: '/expenses' },
      };

      fetch(notificationUrlOneSignal, {
          method: 'POST',
          headers: {
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json',
          },
          body: JSON.stringify(adminPayload),
      }).catch(err => {
          console.error('Failed to trigger OneSignal push for admin (expense report):', err);
      });
    }

    
    return new Response(JSON.stringify({ message: 'Laporan pengeluaran berhasil dibuat', reportId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});