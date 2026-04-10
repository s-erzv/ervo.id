// supabase/functions/complete-delivery/index.ts
// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const {
      orderId,
      paymentAmount,
      paymentMethodId,
      returnableItems, 
      transportCost,
      proofFileUrl,
      transferProofUrl,
      receivedByUserId,
      receivedByName,
      actualCourierIds,
    } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Ambil data order awal (Tambahkan kolom dropshipper_id & dropshipper_commission)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(product_id, qty, price)')
      .eq('id', orderId)
      .single();

    if (orderError) throw orderError;
    const company_id = order.company_id;

    // --- SYNC DATA PETUGAS (COURIERS) ---
    await supabase.from('order_couriers').delete().eq('order_id', orderId);
    if (actualCourierIds && actualCourierIds.length > 0) {
      const courierData = actualCourierIds.map((courierId: string) => ({
        order_id: orderId,
        courier_id: courierId,
        company_id: company_id,
      }));
      await supabase.from('order_couriers').insert(courierData);
    }

    // 2. Update Galon & Stok
    const orderItemsTotal = order?.order_items?.reduce((sum, item) => sum + (item.qty * item.price), 0) || 0;
    let totalPurchaseCost = 0;

    for (const item of returnableItems) {
        const old_returned = parseFloat(item.old_returnedQty) || 0; 
        const new_returned = parseFloat(item.returnedQty) || 0;
        const old_purchased = parseFloat(item.old_purchasedEmptyQty) || 0; 
        const new_purchased = parseFloat(item.purchasedEmptyQty) || 0;
        
        totalPurchaseCost += new_purchased * (item.empty_bottle_price || 0);

        await supabase.from('order_galon_items').upsert({
            order_id: orderId,
            product_id: item.product_id,
            returned_qty: new_returned,
            borrowed_qty: parseFloat(item.borrowedQty) || 0,
            purchased_empty_qty: new_purchased,
        }, { onConflict: 'order_id, product_id' });

        const total_net_change = (new_returned - old_returned) + (new_purchased - old_purchased);
        if (total_net_change !== 0) {
          await supabase.rpc('update_empty_bottle_stock', {
            product_id: item.product_id,
            qty_to_add: total_net_change,
          });
        }
    }

    const newGrandTotal = orderItemsTotal + (parseFloat(transportCost) || 0) + totalPurchaseCost;

    // 3. LOGIC PEMBAYARAN
    if (paymentAmount > 0) {
      await supabase.from('payments').insert({
          order_id: orderId,
          amount: paymentAmount, 
          payment_method_id: paymentMethodId,
          company_id,
          proof_url: transferProofUrl,
          received_by: receivedByUserId,
          received_by_name: receivedByName,
          paid_at: new Date().toISOString()
      });
    }
    
    const { data: currentPayments } = await supabase.from('payments').select('amount').eq('order_id', orderId);
    const totalPaid = currentPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;

    let finalStatus = 'unpaid';
    if (totalPaid >= newGrandTotal - 100) finalStatus = 'paid';
    else if (totalPaid > 0) finalStatus = 'partial';

    // 4. Update Order & Invoice
    await supabase.from('orders').update({
        status: 'completed',
        payment_status: finalStatus,
        proof_of_delivery_url: proofFileUrl,
        transport_cost: transportCost,
        delivered_at: new Date().toISOString(),
        grand_total: newGrandTotal,
    }).eq('id', orderId);

    await supabase.from('invoices').update({
        grand_total: newGrandTotal,
        balance_due: Math.max(0, newGrandTotal - totalPaid),
        status: finalStatus.toUpperCase()
    }).eq('order_id', orderId);


    // --- TAMBAHAN BARU: LOGIC DANA TERTUNDA DROPSHIPPER ---
    // Jika order memiliki dropshipper dan komisi > 0
    if (order.dropshipper_id && order.dropshipper_commission > 0) {
        // Ambil saldo saat ini dari profil dropshipper
        const { data: profile } = await supabase
            .from('profiles')
            .select('balance_pending')
            .eq('id', order.dropshipper_id)
            .single();

        const currentPending = parseFloat(profile?.balance_pending || 0);
        const commission = parseFloat(order.dropshipper_commission);

        // Update saldo tertunda (Hanya dilakukan saat pertama kali 'completed')
        // Catatan: Pastikan logic ini tidak duplikat jika function dipanggil 2x
        if (order.status !== 'completed') {
            const { error: balanceError } = await supabase
                .from('profiles')
                .update({ 
                    balance_pending: currentPending + commission 
                })
                .eq('id', order.dropshipper_id);
            
            if (balanceError) console.error("Error updating dropshipper balance:", balanceError);
        }
    }
    // -------------------------------------------------------

    return new Response(JSON.stringify({ success: true }), {
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