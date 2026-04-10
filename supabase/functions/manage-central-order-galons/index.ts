// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-http-method-override',
  'Access-Control-Allow-Methods': 'POST, PUT, DELETE, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const { method } = req;
  // Gunakan service role key untuk operasi admin seperti modifikasi stok atau RLS terlewati
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  
  try {
    let bodyData = null;
    if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
      bodyData = await req.json();
    }
    
    // ====================================================================
    // POST: Finalize Receipt (Ditambahkan logic Financial Correction)
    // [LOGIC INI SUDAH BENAR, TIDAK ADA PERUBAHAN SIGNIFIKAN]
    // ====================================================================
    if (method === 'POST') {
      const { orderId, receivedItems, galonDetails, deliveryDetails, companyId, userId, orderItems } = bodyData;

      // 1. Proses Barang Masuk & Galon (Logic Stok Tetap Sama)
      // proses barang masuk
      for (const item of receivedItems) {
        const receivedQty = parseFloat(item.received_qty) || 0;
        if (receivedQty > 0) {
          await supabase.from('stock_movements').insert({
            product_id: item.product_id,
            qty: receivedQty,
            type: 'masuk_dari_pusat',
            notes: `Barang diterima dari pusat (Nomor Surat: ${deliveryDetails.central_note_number})`,
            company_id: companyId,
            user_id: userId,
            central_order_id: orderId,
          });

          await supabase.rpc('update_product_stock', {
            product_id: item.product_id,
            qty_to_add: receivedQty,
          });
        }
      }

      // proses galon
      const returnedMap = {};
      const borrowedMap = {};
      const soldEmptyMap = {};

      for (const [productId, details] of Object.entries(galonDetails)) {
        const returnedQty = parseFloat(details.returned_to_central) || 0;
        const borrowedQty = parseFloat(details.borrowed_from_central) || 0;
        const soldEmptyQty = parseFloat(details.sold_empty_to_central) || 0;
        const soldEmptyPrice = parseFloat(details.sold_empty_price) || 0;

        if (returnedQty > 0) {
          await supabase.from('stock_movements').insert({
            product_id: productId,
            qty: returnedQty,
            type: 'galon_dikembalikan_ke_pusat',
            notes: 'Pengembalian Kemasan Returnable ke pusat.',
            company_id: companyId,
            user_id: userId,
            central_order_id: orderId,
          });

          await supabase.rpc('update_empty_bottle_stock', {
            product_id: productId,
            qty_to_add: -returnedQty,
          });

          returnedMap[productId] = returnedQty;
        }

        if (borrowedQty > 0) {
          await supabase.from('stock_movements').insert({
            product_id: productId,
            qty: borrowedQty,
            type: 'galon_dipinjam_dari_pusat',
            notes: 'Galon dipinjam dari pusat (tidak memengaruhi stok).',
            company_id: companyId,
            user_id: userId,
            central_order_id: orderId,
          });

          borrowedMap[productId] = borrowedQty;
        }

        if (soldEmptyQty > 0) {
          await supabase.from('stock_movements').insert({
            product_id: productId,
            qty: soldEmptyQty,
            type: 'galon_kosong_dibeli_dari_pusat',
            notes: 'Kemasan Returnable dibeli dari pusat (tidak memengaruhi stok).',
            company_id: companyId,
            user_id: userId,
            central_order_id: orderId,
          });
          
          await supabase.from('financial_transactions').insert({
            company_id: companyId,
            type: 'expense',
            amount: soldEmptyQty * soldEmptyPrice,
            description: `Pembelian Kemasan Returnable dari pusat pesanan #${orderId.slice(0, 8)}`,
            source_table: 'central_orders',
            source_id: orderId,
          });

          soldEmptyMap[productId] = soldEmptyQty;
        }
      }

      // 2. LOGIC BARU: Koreksi Biaya untuk Barang yang Dibayar tapi Tidak Diterima
      let totalMissingCost = 0;

      for (const receivedItem of receivedItems) {
          const orderedItem = orderItems.find(item => item.product_id === receivedItem.product_id);
          
          const orderedQty = parseFloat(orderedItem?.qty) || 0;
          const receivedQty = parseFloat(receivedItem.received_qty) || 0;
          const itemPrice = parseFloat(orderedItem?.price) || 0; // Harga beli per unit
          
          // Hitung selisih biaya (dibayar untuk 10, tapi hanya 5 yang diterima)
          const missingQty = orderedQty - receivedQty;
          
          if (missingQty > 0) {
              const missingCost = missingQty * itemPrice;
              totalMissingCost += missingCost;
          }
      }

      if (totalMissingCost > 0) {
          // Mencatat sebagai 'income' (kredit) untuk mengimbangi 'expense' awal yang terlalu besar.
          // Ini merepresentasikan uang yang dikreditkan kembali (atau seharusnya dikreditkan).
          await supabase.from('financial_transactions').insert({
              company_id: companyId,
              type: 'income', 
              amount: totalMissingCost,
              description: `Kredit/Potongan biaya barang (selisih) pesanan pusat #${orderId.slice(0, 8)}`,
              source_table: 'central_orders',
              source_id: orderId,
          });
      }

      // 3. Simpan Order & Item
      await supabase.from('central_orders').update({
        arrival_date: deliveryDetails.arrival_date || null,
        central_note_number: deliveryDetails.central_note_number || null,
        status: 'received',
        returned_to_central: returnedMap,
        borrowed_from_central: borrowedMap,
        sold_empty_to_central: soldEmptyMap
      }).eq('id', orderId);

      // upsert item
      const updatedItemsPayload = receivedItems.map(receivedItem => {
        const originalItem = orderItems.find(
          (item) => item.product_id === receivedItem.product_id
        );
        const galonDetail = galonDetails[receivedItem.product_id];
        const soldEmptyPrice = galonDetail ? (parseFloat(galonDetail.sold_empty_price) || 0) : 0;
        
        return {
          central_order_id: orderId,
          product_id: receivedItem.product_id,
          received_qty: receivedItem.received_qty,
          qty: originalItem ? originalItem.qty : 0,
          price: originalItem ? originalItem.price : 0,
          sold_empty_price: soldEmptyPrice,
        };
      });
      await supabase.from('central_order_items').upsert(updatedItemsPayload, { onConflict: ['central_order_id', 'product_id'] });

      return new Response(JSON.stringify({ message: 'Penerimaan barang dan koreksi biaya berhasil dicatat.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });

    // ====================================================================
    // PUT: Edit Order (Rollback and Reset Status) - PERBAIKAN DI SINI
    // ====================================================================
    } else if (method === 'PUT') {
      const { newItems, orderId, order: updatedOrderDetails, companyId } = bodyData;
      
      // 1. Fetch current order status and received items/galons from DB
      const { data: currentOrder, error: fetchError } = await supabase
        .from('central_orders')
        .select(`
          status, 
          returned_to_central, 
          central_order_items(product_id, received_qty)
        `)
        .eq('id', orderId)
        .eq('company_id', companyId)
        .single();
        
      if (fetchError) throw fetchError;

      const isReceived = currentOrder.status === 'received';
      let message = 'Pesanan berhasil diperbarui.';

      // 2. Rollback logic if the order was previously received (isReceived)
      if (isReceived) {
        console.log(`[PUT] Initiating stock rollback for received order ${orderId}`);
        message = 'Pesanan berhasil diubah dan status dikembalikan ke Draft. Stok telah dikembalikan. Harap finalisasi ulang (Pengecekan Barang Datang).';
        
        // a. Rollback main product stock based on received_qty
        const receivedItemsData = currentOrder.central_order_items;
        for (const item of receivedItemsData) {
          const receivedQty = parseFloat(item.received_qty) || 0;
          if (receivedQty > 0) {
            await supabase.rpc('update_product_stock', {
              product_id: item.product_id,
              qty_to_add: -receivedQty, 
            });
          }
        }
        
        // b. Rollback empty bottle stock based on returned_to_central
        if (currentOrder.returned_to_central) {
          for (const [productId, returnedQtyStr] of Object.entries(currentOrder.returned_to_central)) {
            const returnedQty = parseFloat(returnedQtyStr) || 0;
            if (returnedQty > 0) {
              await supabase.rpc('update_empty_bottle_stock', {
                product_id: productId,
                qty_to_add: returnedQty, 
              });
            }
          }
        }
        
        // c. Delete all related logs and transactions
        await supabase.from('stock_movements').delete().eq('central_order_id', orderId);
        await supabase.from('financial_transactions').delete()
          .eq('source_id', orderId)
          .eq('source_table', 'central_orders'); 

          
        // d. Update order to reset 'received' related fields
        updatedOrderDetails.status = 'draft'; // Paksa status kembali ke draft
        updatedOrderDetails.arrival_date = null;
        updatedOrderDetails.central_note_number = null;
        updatedOrderDetails.returned_to_central = null;
        updatedOrderDetails.borrowed_from_central = null;
        updatedOrderDetails.sold_empty_to_central = null;
      }
      
      // 3. Update the central_orders header details (safe for both cases)
      await supabase.from('central_orders').update(updatedOrderDetails).eq('id', orderId);

      // 4. Update the order items (delete/insert)
      await supabase.from('central_order_items').delete().eq('central_order_id', orderId);
      if (newItems && newItems.length > 0) {
        const itemsToInsert = newItems.map(item => ({
          central_order_id: orderId,
          product_id: item.product_id,
          qty: parseFloat(item.qty) || 0,
          price: parseFloat(item.price) || 0,
          sold_empty_price: parseFloat(item.sold_empty_price) || 0,
          // received_qty harus disetel ulang ke 0 setelah rollback
          received_qty: 0, 
        }));
        await supabase.from('central_order_items').insert(itemsToInsert);
      }

      return new Response(JSON.stringify({ message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    
    // ====================================================================
    // DELETE: Delete Order (Revised for robust rollback) - [LOGIC INI JUGA SUDAH BENAR]
    // ====================================================================
    } else if (method === 'DELETE') {
      const { orderId, companyId } = bodyData;

      // 1. Ambil data order dan item yang sudah diterima
      const { data: orderData, error: orderFetchError } = await supabase
        .from('central_orders')
        .select(`
          returned_to_central, 
          central_order_items (product_id, received_qty)
        `)
        .eq('id', orderId)
        .eq('company_id', companyId)
        .single();

      if (orderFetchError && orderFetchError.code !== 'PGRST116') { // PGRST116: No row found
            throw orderFetchError;
      }

      const receivedItemsData = orderData ? orderData.central_order_items : [];
      const returnedGalons = orderData ? orderData.returned_to_central : null;

      // 2. Rollback stok produk utama (Kurangi stok produk)
      for (const item of receivedItemsData) {
        const receivedQty = parseFloat(item.received_qty) || 0;
        if (receivedQty > 0) {
          await supabase.rpc('update_product_stock', {
            product_id: item.product_id,
            qty_to_add: -receivedQty, // Stok berkurang (undo increase)
          });
        }
      }
      
      // 3. Rollback stok galon returnable (Tambah stok botol kosong)
      if (returnedGalons) {
        for (const [productId, returnedQtyStr] of Object.entries(returnedGalons)) {
          const returnedQty = parseFloat(returnedQtyStr) || 0;
          if (returnedQty > 0) {
            await supabase.rpc('update_empty_bottle_stock', {
              product_id: productId,
              qty_to_add: returnedQty, // Stok bertambah (undo decrease)
            });
          }
        }
      }
      
      // 4. Hapus data terkait
      await supabase.from('central_order_items').delete().eq('central_order_id', orderId);
      await supabase.from('stock_movements').delete().eq('central_order_id', orderId);
      await supabase.from('financial_transactions').delete().eq('source_id', orderId).eq('source_table', 'central_orders');
      await supabase.from('central_orders').delete().eq('id', orderId).eq('company_id', companyId);

      return new Response(JSON.stringify({ message: 'Pesanan berhasil dihapus dan stok telah dikembalikan.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  } catch (error) {
    console.error('Error in manage-central-order-galons:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});