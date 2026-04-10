// Path: supabase/functions/create-order/index.ts

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

  const notificationUrlOneSignal = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-onesignal-push`;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  try {
    const { orderForm, orderItems } = await req.json()
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', SUPABASE_SERVICE_ROLE_KEY)

    if (!orderForm || !orderItems || orderItems.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing order data' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }
    
    // 1. Ambil data customer dan dropshipper_id terkait
    const { data: customerData, error: customerError } = await supabase
      .from('customers')
      .select('customer_status, company_id, name, dropshipper_id') 
      .eq('id', orderForm.customer_id)
      .single();
    
    if (customerError || !customerData) {
      throw new Error('Customer not found or invalid.');
    }
    const customerStatusName = customerData.customer_status;
    const customerName = customerData.name || 'Pelanggan Tidak Dikenal'; 
    const companyId = customerData.company_id;
    const dropshipperId = customerData.dropshipper_id; 

    let subtotal = 0;
    const itemsToInsert = [];
    const invoiceItemsToInsert = [];
    
    for (const item of orderItems) {
        const { data: priceData, error: priceError } = await supabase
            .from('product_prices')
            .select('price')
            .eq('product_id', item.product_id)
            .eq('customer_status', customerStatusName)
            .single();

        if (priceError || !priceData) {
            throw new Error(`Price for product ${item.product_id} and status ${customerStatusName} not found.`);
        }
        
        const validatedPrice = priceData.price;
        subtotal += item.qty * validatedPrice;

        itemsToInsert.push({
            order_id: null,
            product_id: item.product_id,
            qty: item.qty,
            price: validatedPrice,
            item_type: 'beli',
            company_id: orderForm.company_id,
        });

        invoiceItemsToInsert.push({
            invoice_id: null,
            product_id: item.product_id,
            quantity: item.qty, 
            unit_price: validatedPrice,
            line_total: item.qty * validatedPrice,
        });
    }

    const transport_cost = parseFloat(orderForm.transport_cost) || 0;
    // Grand total adalah total harga yang dibayar customer ke admin (termasuk transport)
    const grand_total = subtotal + transport_cost;

    // --- LOGIKA UTAMA: KOMISI DARI TOTAL PENJUALAN (REVENUE) ---
    let commissionAmount = 0;
    if (dropshipperId) {
      const { data: dropSettings } = await supabase
        .from('dropshipper_settings')
        .select('percentage')
        .eq('dropshipper_id', dropshipperId)
        .eq('customer_status', customerStatusName)
        .eq('company_id', companyId)
        .single();

      if (dropSettings && dropSettings.percentage > 0) {
        // MENGAMBIL PERSENTASE DARI TOTAL KESELURUHAN (GRAND TOTAL)
        // Misal: 2% dari 50.000 = 1.000
        commissionAmount = (parseFloat(dropSettings.percentage) / 100) * grand_total;
      }
    }
    // -----------------------------------------------------------

    const isQuickOrder = !!orderForm.is_quick_order;
    const initialStatus = isQuickOrder ? 'sent' : 'draft'; 
    const orderType = isQuickOrder ? 'quick' : 'normal'; 

    const { data: nextInvoiceNumber, error: invoiceNumberError } = await supabase.rpc('get_next_invoice_number', { p_company_id: orderForm.company_id });
    if (invoiceNumberError) throw invoiceNumberError;

    // 1. Masukkan pesanan baru dengan snapshot komisi
    const { data: insertedOrder, error: orderError } = await supabase
      .from('orders')
      .insert([{
        customer_id: orderForm.customer_id,
        planned_date: orderForm.planned_date,
        notes: orderForm.notes,
        created_by: orderForm.created_by,
        company_id: orderForm.company_id,
        status: initialStatus,
        type: orderType,
        payment_status: 'unpaid',
        invoice_number: nextInvoiceNumber,
        grand_total: grand_total,
        transport_cost: transport_cost,
        dropshipper_id: dropshipperId,
        dropshipper_commission: commissionAmount, 
      }])
      .select('id, courier_id') 
      .single();

    if (orderError) throw orderError;
    const orderId = insertedOrder.id;

    if (isQuickOrder) {
        const stockMovementsToInsert = [];
        for (const item of orderItems) {
            const { error: stockUpdateError } = await supabase.rpc('decrement_product_stock', {
                p_product_id: item.product_id,
                p_qty_to_decrement: item.qty,
            });
            if (stockUpdateError) throw new Error(`Gagal memperbarui stok produk ${item.product_id}.`);
            
            stockMovementsToInsert.push({
                product_id: item.product_id,
                type: 'keluar', 
                qty: item.qty, 
                notes: `Produk keluar untuk pesanan #${nextInvoiceNumber} (Quick Order)`,
                order_id: orderId,
                company_id: orderForm.company_id,
                user_id: orderForm.created_by, 
            });
        }
        if (stockMovementsToInsert.length > 0) {
            await supabase.from('stock_movements').insert(stockMovementsToInsert);
        }
    }

    const couriersToInsert = orderForm.courier_ids?.map(courierId => ({
        order_id: orderId,
        courier_id: courierId,
        company_id: orderForm.company_id, 
    }));
    
    let courierAssignmentSuccessful = false;
    let assignedCouriers = [];
    if (couriersToInsert && couriersToInsert.length > 0) {
        const { error: courierErrorNormal } = await supabase.from('order_couriers').insert(couriersToInsert);

        if (!courierErrorNormal) {
            courierAssignmentSuccessful = true;
            assignedCouriers = couriersToInsert; 
            const notifications = assignedCouriers.map(courier => ({
                user_id: courier.courier_id,
                message: `Anda ditugaskan ke pesanan baru #${nextInvoiceNumber}`,
                type: 'order_assignment',
                link_to: `/orders/${orderId}`
            }));
            await supabase.from('notifications').insert(notifications);
        }
    }

    // 3. Masukkan invoice baru
    const { data: insertedInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert([{
            order_id: orderId,
            company_id: orderForm.company_id,
            customer_id: orderForm.customer_id,
            invoice_number: nextInvoiceNumber,
            subtotal: subtotal,
            grand_total: grand_total, 
            balance_due: grand_total,
            notes: orderForm.notes,
        }])
        .select('id')
        .single();
    if (invoiceError) throw invoiceError;
    const invoiceId = insertedInvoice.id;

    const finalItemsToInsert = itemsToInsert.map(item => ({...item, order_id: orderId}));
    const finalInvoiceItemsToInsert = invoiceItemsToInsert.map(item => ({...item, invoice_id: invoiceId}));

    await supabase.from('order_items').insert(finalItemsToInsert);
    await supabase.from('invoice_items').insert(finalInvoiceItemsToInsert);

    // 6. Notifikasi Admins
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('company_id', companyId)
      .in('role', ['admin', 'super_admin']); 

    if (admins && admins.length > 0) {
        const adminIds = admins.map(a => a.id);
        await supabase.from('notifications').insert({
          user_id: adminIds[0], 
          message: `Pesanan baru #${nextInvoiceNumber} dari ${customerName} telah dibuat.`,
          type: 'new_order',
          link_to: `/orders/${orderId}`
        });

        const adminPayload = {
            user_ids: adminIds,
            title: `🔔 Pesanan Baru Masuk!`,
            message: `Order dari ${customerName} telah masuk.`, 
            data: { orderId, type: 'new_order', route: `/orders/${orderId}` },
        };

        fetch(notificationUrlOneSignal, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(adminPayload),
        }).catch(() => {});
    }
    
    if (courierAssignmentSuccessful && assignedCouriers.length > 0) {
        const courierIds = assignedCouriers.map(c => c.courier_id);
        const courierPayload = {
            user_ids: courierIds, 
            title: `🚚 Tugas Baru: Pesanan #${nextInvoiceNumber}`,
            message: `Pesanan dari ${customerName} telah ditugaskan untuk Anda.`,
            data: { orderId, type: 'courier_assignment', route: `/orders/${orderId}` },
        };
        fetch(notificationUrlOneSignal, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(courierPayload),
        }).catch(() => {});
    }
    
    return new Response(JSON.stringify({ message: 'Order created successfully', orderId, invoiceId }), {
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