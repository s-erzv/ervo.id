// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Mengambil semua data yang diperlukan
  const { reportId, companyId, expenseReport, expenseItems } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    if (req.method === 'PUT') {
      if (!reportId || !expenseReport || !expenseItems) {
        return new Response(JSON.stringify({ error: 'Missing report data for update' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      // Pastikan status diperbarui ke 'pending' jika ada perubahan
      const { error: reportUpdateError } = await supabase
        .from('expense_reports')
        .update(expenseReport)
        .eq('id', reportId); // Hapus filter .eq('status', 'pending')
      
      if (reportUpdateError) throw reportUpdateError;

      const { error: deleteItemsError } = await supabase
        .from('expense_report_items')
        .delete()
        .eq('expense_report_id', reportId);
      if (deleteItemsError) throw deleteItemsError;

      const itemsToInsert = expenseItems.map(item => ({
        ...item,
        expense_report_id: reportId,
      }));

      const { error: insertItemsError } = await supabase
        .from('expense_report_items')
        .insert(itemsToInsert);
      if (insertItemsError) throw insertItemsError;
      
      return new Response(JSON.stringify({ message: 'Laporan pengeluaran berhasil diperbarui!' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });

    } else if (req.method === 'DELETE') {
      if (!reportId || !companyId) {
        return new Response(JSON.stringify({ error: 'Report ID and Company ID are required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      // --- FIX PENTING: Hapus semua financial_transactions terkait ---
      // Ini secara otomatis mengembalikan saldo (rollback expense)
      const { error: financialDeleteError } = await supabase
        .from('financial_transactions')
        .delete()
        .eq('source_table', 'expense_reports')
        .eq('source_id', reportId);
      if (financialDeleteError) {
          // Log error, tetapi coba lanjutkan penghapusan item dan laporan utama
          console.error("FAILED to delete financial transactions (Manual Check Needed):", financialDeleteError);
      }
      
      // Hapus item-item laporan
      const { error: itemsDeleteError } = await supabase
        .from('expense_report_items')
        .delete()
        .eq('expense_report_id', reportId);
      if (itemsDeleteError) throw itemsDeleteError;

      // Hapus laporan utama
      const { error: reportDeleteError } = await supabase
        .from('expense_reports')
        .delete()
        .eq('id', reportId)
        .eq('company_id', companyId);
      if (reportDeleteError) throw reportDeleteError;
      
      return new Response(JSON.stringify({ message: 'Laporan berhasil dihapus.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });

  } catch (error) {
    console.error('Error in manage-expense-report:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});