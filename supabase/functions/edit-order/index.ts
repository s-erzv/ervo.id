// supabase/functions/edit-order/index.ts
// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'PUT, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { orderId, orderDetails, orderItems, userId } = await req.json()
    
    const { courier_ids, ...restOfOrderDetails } = orderDetails;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (!orderId || !orderDetails || !orderItems || orderItems.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing order data' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 1. Ambil data pesanan lama & Payments terkait
    const { data: oldOrder, error: oldOrderError } = await supabase
        .from('orders')
        .select(`
            *,
            order_items (product_id, qty, price)
        `)
        .eq('id', orderId)
        .single();
    if (oldOrderError) throw oldOrderError;
    
    // --- LOGIKA BARU: BLOKIR EDIT ORDER JIKA STATUS PEMBAYARAN SUDAH LUNAS/PAID ---
    const paidStatuses = ['paid', 'lunas'];
    if (oldOrder.payment_status && paidStatuses.includes(oldOrder.payment_status.toLowerCase())) {
      // Mengembalikan pesan error yang jelas dan status 403 (Forbidden)
      return new Response(JSON.stringify({ 
          error: `Order tidak bisa diedit karena status pembayaran sudah ${oldOrder.payment_status}. Pembayaran masih bisa ditambahkan/diedit melalui menu Pembayaran.`
      }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
      });
    }
    // --------------------------------------------------------------------------------
    
    // FETCH EXISTING PAYMENTS
    const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('amount')
        .eq('order_id', orderId);
    if (paymentsError) throw paymentsError;

    const totalPaid = paymentsData.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    
    // Hitung ulang subtotal dan grand total baru
    const newSubtotal = orderItems.reduce((sum, item) => sum + (parseFloat(item.qty) * parseFloat(item.price)), 0);
    const newGrandTotal = newSubtotal + (oldOrder.transport_cost || 0) + (oldOrder.total_purchase_cost || 0); 
    const newBalanceDue = newGrandTotal - totalPaid;

    // --- LOGIKA NET CHANGE STOK ---
    const oldItemsMap = oldOrder.order_items.reduce((acc, item) => {
        acc[item.product_id] = parseFloat(item.qty) || 0;
        return acc;
    }, {});
    
    const netChanges = {};
    const allProductIds = new Set([
        ...Object.keys(oldItemsMap), 
        ...orderItems.map(item => item.product_id)
    ]);

    for (const productId of allProductIds) {
        const oldQty = oldItemsMap[productId] || 0;
        const newItem = orderItems.find(i => i.product_id === productId);
        const newQty = (newItem && parseFloat(newItem.qty)) || 0;
        
        const netChange = newQty - oldQty; // Positif: butuh stok keluar lagi; Negatif: stok harus masuk
        
        if (Math.abs(netChange) > 0) {
            netChanges[productId] = netChange;
        }
    }

    // 2. Update orders dan invoices (FINANSIAL)
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({ 
          ...restOfOrderDetails, 
          grand_total: newGrandTotal, 
          updated_by: userId, 
          updated_at: new Date().toISOString() 
      })
      .eq('id', orderId);
    if (orderUpdateError) throw orderUpdateError;
    
    const { error: invoiceUpdateError } = await supabase
        .from('invoices')
        .update({
            subtotal: newSubtotal,
            grand_total: newGrandTotal,
            paid_to_date: totalPaid,      
            balance_due: newBalanceDue,   
            notes: restOfOrderDetails.notes,
        })
        .eq('order_id', orderId);
    if (invoiceUpdateError) throw invoiceUpdateError;


    // 3. Update tabel order_couriers (Logika penugasan ulang kurir)
    const { error: deleteCouriersError } = await supabase
        .from('order_couriers')
        .delete()
        .eq('order_id', orderId);
    if (deleteCouriersError) throw deleteCouriersError;

    if (courier_ids && courier_ids.length > 0) {
        const couriersToInsert = courier_ids.map(courier_id => ({
            order_id: orderId,
            courier_id: courier_id
        }));
        const { error: insertCouriersError } = await supabase
            .from('order_couriers')
            .insert(couriersToInsert);
        if (insertCouriersError) throw insertCouriersError;
        
        // Notifikasi Penugasan Ulang
        const notifications = couriersToInsert.map(courier => ({
          user_id: courier.courier_id,
          message: `Anda ditugaskan ke pesanan #${oldOrder.invoice_number} (Diperbarui)`,
          type: 'order_assignment',
          link_to: `/orders/${orderId}`
        }));

        await supabase.from('notifications').insert(notifications);
    }

    // 4. Update tabel order_items (Hapus lama, Masukkan baru)
    const { error: deleteItemsError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', orderId);
    if (deleteItemsError) throw deleteItemsError;
    
    const itemsToInsert = orderItems.map(item => ({
      ...item,
      order_id: orderId,
      company_id: orderDetails.company_id,
    }));
    const { error: insertItemsError } = await supabase
      .from('order_items')
      .insert(itemsToInsert);
    if (insertItemsError) throw insertItemsError;

      const statusYangSudahPotongStok = ['sent', 'delivered', 'completed'];

      if (statusYangSudahPotongStok.includes(oldOrder.status.toLowerCase())) {
          for (const productId in netChanges) {
              const diff = netChanges[productId];
              const absDiff = Math.abs(diff);

              const movementType = diff > 0 ? 'keluar_edit_pesanan' : 'masuk_edit_pesanan';
              
              // 5.1. UPDATE STOK UTAMA (Atomic Update) 
              const { error: stockUpdateError } = await supabase.rpc('atomic_stock_update', {
                  product_id_input: productId,
                  qty_change: diff, // RPC ini harus menangani logika: qty_change positif = stok berkurang
                  company_id_input: orderDetails.company_id,
              });

              if (stockUpdateError) throw stockUpdateError;
              
              // 5.2. Catat Pergerakan Stok
              const { error: movementError } = await supabase
                .from('stock_movements')
                .insert({
                  order_id: orderId,
                  product_id: productId,
                  qty: absDiff,
                  type: movementType,
                  notes: `Koreksi edit pesanan (Status: ${oldOrder.status}). Selisih NET: ${diff}`,
                  company_id: orderDetails.company_id,
                  user_id: userId // Pastikan userId dicatat untuk audit log
                });
              if (movementError) throw movementError;
          }
      } else {
          // JIKA STATUS DRAFT/PENDING: 
          // Kita tidak perlu update tabel 'products', tapi kita tetap catat log audit 
          // (opsional) untuk menandakan ada perubahan data di level pesanan.
          console.log(`Status pesanan ${oldOrder.status}: Tidak ada koreksi stok gudang yang dilakukan.`);
      }

    return new Response(JSON.stringify({ message: 'Order updated successfully', orderId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error updating order:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});