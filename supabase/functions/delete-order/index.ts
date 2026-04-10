// supabase/functions/delete-order/index.ts
// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'DELETE, POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { orderId, companyId } = await req.json()
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

    if (!orderId || !companyId) throw new Error('Order ID and Company ID are required');
    
    // 1. Ambil semua Payment ID terkait order ini
    const { data: payments } = await supabase.from('payments').select('id').eq('order_id', orderId);
    const paymentIds = payments?.map(p => p.id) || [];

    // 2. REVERSING STOCK
    const { data: movements } = await supabase.from('stock_movements').select('product_id, qty, type').eq('order_id', orderId);
    if (movements) {
      for (const move of movements) {
        const qtyToAdjust = parseFloat(move.qty);
        let adjustmentValue = (move.type.startsWith('masuk') || move.type.startsWith('pengembalian')) ? -qtyToAdjust : qtyToAdjust;
        const rpcName = (move.type.includes('galon') || move.type.includes('pengembalian')) ? 'update_empty_bottle_stock' : 'update_product_stock';
        await supabase.rpc(rpcName, { product_id: move.product_id, qty_to_add: adjustmentValue });
      }
    }
    
    // 3. CLEANUP FINANCIAL TRANSACTIONS (Penting agar tidak error)
    if (paymentIds.length > 0) {
      await supabase.from('financial_transactions').delete().in('source_id', paymentIds);
    }
    await supabase.from('financial_transactions').delete().eq('source_id', orderId);

    // 4. DELETE RELATED DATA
    const { data: invoice } = await supabase.from('invoices').select('id').eq('order_id', orderId).single();
    if (invoice) {
      await supabase.from('invoice_items').delete().eq('invoice_id', invoice.id);
      await supabase.from('invoices').delete().eq('id', invoice.id);
    }
    
    await supabase.from('stock_movements').delete().eq('order_id', orderId);
    await supabase.from('order_galon_items').delete().eq('order_id', orderId);
    await supabase.from('payments').delete().eq('order_id', orderId);
    await supabase.from('order_items').delete().eq('order_id', orderId);
    await supabase.from('order_couriers').delete().eq('order_id', orderId);

    // 5. DELETE ORDER
    const { error: orderError } = await supabase.from('orders').delete().eq('id', orderId);
    if (orderError) throw orderError;
    
    return new Response(JSON.stringify({ message: 'Success' }), {
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