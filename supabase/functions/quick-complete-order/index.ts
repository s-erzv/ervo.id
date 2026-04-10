import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const DEFAULT_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
};

const handleCors = (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: DEFAULT_HEADERS });
    }
    return null;
}

serve(async (req) => {
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;
    if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: DEFAULT_HEADERS });

    try {
        const body = await req.json();
        const { orderForm, orderItems, paymentDetails } = body;

        if (!orderForm || !orderItems || !paymentDetails || !orderForm.customer_id) {
            throw new Error('Data pesanan, item, atau pembayaran tidak lengkap.');
        }
        
        // --- 0. Get Next Invoice Number ---
        const { data: nextInvoiceNumber, error: invoiceNumberError } = await supabase.rpc('get_next_invoice_number', { p_company_id: orderForm.company_id });
        if (invoiceNumberError) throw new Error('Gagal mendapatkan nomor invoice: ' + invoiceNumberError.message);
        
        const invoiceNumber = nextInvoiceNumber;
        
        // --- 1. Pre-calculate totals and determine payment status ---
        let subtotal = 0;
        const grandTotal = orderForm.grand_total;
        const paymentAmount = paymentDetails.amount || 0;
        
        const paymentStatus = paymentAmount >= grandTotal ? 'paid' : (paymentAmount > 0 ? 'partial' : 'unpaid');
        const balanceDue = Math.max(0, grandTotal - paymentAmount);
        
        for (const item of orderItems) {
            subtotal += (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0);
        }
        
        // --- 2. Insert Order ---
        const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .insert({ 
                customer_id: orderForm.customer_id,
                planned_date: orderForm.planned_date,
                notes: orderForm.notes,
                created_by: orderForm.created_by,
                company_id: orderForm.company_id,
                status: 'completed', // Quick Order is always completed
                payment_status: paymentStatus, 
                transport_cost: orderForm.transport_cost,
                proof_of_delivery_url: orderForm.proof_of_delivery_url,
                grand_total: grandTotal,
                invoice_number: invoiceNumber, 
                delivered_at: new Date().toISOString(),
                
                // Sum returned/borrowed/purchased quantities for the order header columns
                returned_qty: orderItems.reduce((sum, item) => sum + (parseFloat(item.returned_qty) || 0), 0),
                borrowed_qty: orderItems.reduce((sum, item) => sum + (parseFloat(item.borrowed_qty) || 0), 0),
                purchased_empty_qty: orderItems.reduce((sum, item) => sum + (parseFloat(item.purchased_empty_qty) || 0), 0),
            })
            .select('id')
            .single();

        if (orderError) throw new Error('Gagal membuat pesanan baru: ' + orderError.message);
        const orderId = orderData.id;

        // --- 3. Insert Order Items ---
        const itemsToInsert = orderItems.map((item: any) => ({
            order_id: orderId,
            product_id: item.product_id,
            qty: item.qty,
            price: item.price,
            item_type: 'beli',
            returned_qty: item.returned_qty, 
            purchased_empty_qty: item.purchased_empty_qty,
            borrowed_qty: item.borrowed_qty,
            company_id: orderForm.company_id 
        }));

        const { error: itemsError } = await supabase
            .from('order_items')
            .insert(itemsToInsert);

        if (itemsError) throw new Error('Gagal menyisipkan item pesanan: ' + itemsError.message);
        
        // --- 4. Insert Invoice (and Invoice Items) ---
        const { data: insertedInvoice, error: invoiceError } = await supabase
            .from('invoices')
            .insert([{
                order_id: orderId,
                company_id: orderForm.company_id,
                customer_id: orderForm.customer_id,
                invoice_number: invoiceNumber,
                subtotal: subtotal,
                grand_total: grandTotal,
                paid_to_date: paymentAmount,
                balance_due: balanceDue,
                notes: orderForm.notes,
                status: 'FINAL',
            }])
            .select('id')
            .single();
        if (invoiceError) throw new Error('Gagal membuat invoice: ' + invoiceError.message);
        const invoiceId = insertedInvoice.id;

        const finalInvoiceItemsToInsert = orderItems.map(item => ({
            invoice_id: invoiceId,
            product_id: item.product_id,
            quantity: item.qty,
            unit_price: item.price,
            line_total: (item.qty * item.price),
        })).filter(item => item.line_total > 0);
        
        if (orderForm.transport_cost > 0) {
             finalInvoiceItemsToInsert.push({
                invoice_id: invoiceId,
                product_id: null,
                description: 'Biaya Transportasi',
                quantity: 1,
                unit_price: orderForm.transport_cost,
                line_total: orderForm.transport_cost,
            });
        }
        
        // MODIFIKASI: Perbaiki logika invoice item untuk dibeli
        for (const item of orderItems) {
            const qty = (parseFloat(item.purchased_empty_qty) || 0);
            if (qty > 0) {
                // Fetch product data again to get empty_bottle_price
                const { data: productWithEmptyPrice, error: productPriceError } = await supabase
                    .from('products')
                    .select('empty_bottle_price')
                    .eq('id', item.product_id)
                    .single();
                
                if (productPriceError) {
                    console.error(`WARNING: Gagal memuat harga botol kosong untuk produk ${item.product_id}: ${productPriceError.message}`);
                    continue; // Skip this invoice item if price fetch fails
                }
                
                const emptyBottlePrice = productWithEmptyPrice?.empty_bottle_price || 0;

                finalInvoiceItemsToInsert.push({
                    invoice_id: invoiceId,
                    product_id: item.product_id,
                    description: `dibeli (${item.product_name || item.product_id})`,
                    quantity: qty,
                    unit_price: emptyBottlePrice,
                    line_total: qty * emptyBottlePrice,
                });
            }
        }
        // END MODIFIKASI

        const { error: invoiceItemsError } = await supabase
            .from('invoice_items')
            .insert(finalInvoiceItemsToInsert);
        if (invoiceItemsError) throw new Error('Gagal menyisipkan item invoice: ' + invoiceItemsError.message);

        // --- 5. BATCH STOCK UPDATE LOGIC (REFINED) ---
        const stockMovementRecords: any[] = [];
        const userId = orderForm.created_by;
        const companyId = orderForm.company_id;

        // Cleanup log galon lama jika ada (untuk safety, karena Quick Order harusnya INSERT)
        await supabase.from('stock_movements').delete().eq('order_id', orderId)
            .or('type.eq.pengembalian,type.eq.galon_kosong_dibeli,type.eq.pinjam_kembali');

        for (const item of orderItems) {
            const productId = item.product_id;
            const qtySold = parseFloat(item.qty) || 0;
            const qtyReturned = (parseFloat(item.returned_qty) || 0);
            const qtyPurchasedEmpty = (parseFloat(item.purchased_empty_qty) || 0);
            const qtyBorrowed = (parseFloat(item.borrowed_qty) || 0);

            // Perubahan ini hanya relevan jika fungsi ini juga digunakan untuk update (yang mana tidak, tapi penting untuk konsistensi)
            const oldQtyReturned = (parseFloat(item.old_returned_qty) || 0); 
            const oldQtyBorrowed = (parseFloat(item.old_borrowed_qty) || 0); // Asumsikan ini dikirim
            
            const netReturnedChange = qtyReturned - oldQtyReturned;
            const netBorrowedChange = qtyBorrowed - oldQtyBorrowed; // Net change for debt

            // A. Update Stok Produk (Kurangi Stok: Sale) - ABSOLUT
            if (qtySold > 0) {
                const { error: productStockError } = await supabase
                    .rpc('update_product_stock', {
                         product_id: productId,
                         qty_to_add: -qtySold,
                     });
                if (productStockError) console.error(`WARNING: Gagal mengurangi stok produk ${productId} via RPC: ${productStockError.message}`);
                
                stockMovementRecords.push({
                    product_id: productId,
                    type: 'sale',
                    qty: qtySold, 
                    order_id: orderId,
                    user_id: userId,
                    company_id: companyId,
                    notes: 'Penjualan via Quick Order (Keluar Stok Produk)'
                });
            }

            // B. Update Stok Kemasan Kosong (HANYA 'DIKEMBALIKAN') - NET CHANGE
            if (netReturnedChange !== 0) {
                 const { error: emptyStockInflowError } = await supabase
                    .rpc('update_empty_bottle_stock', {
                         product_id: productId,
                         qty_to_add: netReturnedChange, // Gunakan NET CHANGE
                     });
                    
                if (emptyStockInflowError) console.error(`WARNING: Gagal menambah stok kosong ${productId} via RPC: ${emptyStockInflowError.message}`);
            }
            
            // C. MODIFIKASI KRITIS: Update Hutang Kemasan Pelanggan - NET CHANGE
            if (netBorrowedChange !== 0) {
                 const { error: debtUpdateError } = await supabase
                    .rpc('update_customer_galon_debt', { // ASUMSI RPC INI ADA
                         p_customer_id: orderForm.customer_id,
                         p_product_id: productId,
                         p_qty_to_add: netBorrowedChange, // Hutang bertambah jika netBorrowedChange > 0
                     });
                
                if (debtUpdateError) console.error(`WARNING: Gagal memperbarui Hutang kemasan pelanggan ${orderForm.customer_id}: ${debtUpdateError.message}`);
            }
            // END MODIFIKASI KRITIS

            // D. Catat Log Pergerakan (Log ABSOLUT state baru setelah cleanup)
            
            if (qtyReturned > 0) {
                 stockMovementRecords.push({
                    product_id: productId,
                    type: 'pengembalian',
                    qty: qtyReturned, 
                    order_id: orderId,
                    user_id: userId,
                    company_id: companyId,
                    notes: 'Kemasan kembali via Quick Order (Masuk Stok Kemasan Kosong)'
                });
            }
            
            if (qtyPurchasedEmpty > 0) {
                 stockMovementRecords.push({
                    product_id: productId,
                    type: 'galon_kosong_dibeli', 
                    qty: qtyPurchasedEmpty, 
                    order_id: orderId,
                    user_id: userId,
                    company_id: companyId,
                    notes: 'Pembelian Kemasan Returnable dari pelanggan via Quick Order (Hanya Log/Finansial)'
                });
            }

            if (qtyBorrowed > 0) {
                stockMovementRecords.push({
                    product_id: productId,
                    type: 'pinjam_kembali',
                    qty: qtyBorrowed,
                    order_id: orderId,
                    user_id: userId,
                    company_id: companyId,
                    notes: 'Kemasan dipinjam oleh pelanggan via Quick Order'
                });
            }
        } // END OF FOR LOOP
        
        // --- 5.5. FIX KRITIS: Insert Order Galon Items (Historical Debt/Movement Record) ---
        // Ini memastikan record ada di tabel yang digunakan StockAndGalonPage untuk perhitungan
        const galonItemsToInsert = orderItems
            .filter(item => (item.returned_qty > 0 || item.purchased_empty_qty > 0 || item.borrowed_qty > 0))
            .map(item => ({
                order_id: orderId,
                product_id: item.product_id,
                returned_qty: item.returned_qty,
                purchased_empty_qty: item.purchased_empty_qty,
                borrowed_qty: item.borrowed_qty,
            }));

        if (galonItemsToInsert.length > 0) {
            const { error: galonInsertError } = await supabase
                .from('order_galon_items')
                .insert(galonItemsToInsert); 
            
            if (galonInsertError) {
                console.error('Warning: Gagal menyisipkan order_galon_items:', galonInsertError.message);
            }
        }
        // --- End of 5.5 ---

        // --- 6. Insert Stock Movements ---
        if (stockMovementRecords.length > 0) {
            const { error: movementError } = await supabase
                .from('stock_movements')
                .insert(stockMovementRecords);
                
            if (movementError) console.error('Warning: Gagal menyisipkan pergerakan stok: ' + movementError.message);
        }
        
        // --- 7. Insert Courier Assignment ---
        if (orderForm.courier_ids && orderForm.courier_ids.length > 0) {
            const couriersToInsert = orderForm.courier_ids.map((courierId: string) => ({
                order_id: orderId,
                courier_id: courierId,
                assigned_by: orderForm.created_by,
                company_id: orderForm.company_id,
            }));
            
            const { error: couriersError } = await supabase
                .from('order_couriers')
                .insert(couriersToInsert);
                
            if (couriersError) console.error('Warning: Gagal menyisipkan Petugas: ' + couriersError.message);
        }

        // --- 8. Insert Payment Record ---
        if (paymentDetails.amount > 0) {
            const { error: paymentError } = await supabase
                .from('payments')
                .insert({
                    order_id: orderId,
                    amount: paymentDetails.amount,
                    payment_method_id: paymentDetails.payment_method_id,
                    paid_at: new Date().toISOString(),
                    company_id: orderForm.company_id,
                    received_by: paymentDetails.received_by,
                    received_by_name: paymentDetails.received_by_name,
                    proof_url: paymentDetails.proof_url,
                });

            if (paymentError) throw new Error('Gagal mencatat pembayaran: ' + paymentError.message);
        }
        
        // --- 9. SUCCESS RESPONSE ---
        return new Response(JSON.stringify({ orderId, invoiceNumber, message: "Quick order completed successfully" }), {
            status: 200,
            headers: DEFAULT_HEADERS,
        });

    } catch (error) {
        console.error('Quick Order Error:', error);
        return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
            status: 500,
            headers: DEFAULT_HEADERS,
        });
    }
});