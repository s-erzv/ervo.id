// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Gunakan Service Role Key untuk operasi database yang aman.
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        // 1. Ambil semua perusahaan
        const { data: companies, error: companyError } = await supabase
            .from('companies')
            .select('id');

        if (companyError || !companies) throw companyError || new Error('No companies found.');

        let totalRecordsCreated = 0;

        for (const company of companies) {
            const companyId = company.id;
            // Dapatkan tanggal hari ini (YYYY-MM-DD)
            const recordDate = new Date().toISOString().split('T')[0]; 

            // 2. Ambil snapshot STOK PRODUK UTAMA
            // SELECT hanya kolom 'stock' dan 'purchase_price'
            const { data: products, error: productError } = await supabase
                .from('products')
                .select('id, stock, purchase_price');

            if (productError) {
                console.error(`Error fetching products for company ${companyId}:`, productError);
                continue;
            }

            const recordsToInsert = [];

            // 3. Siapkan data untuk dimasukkan ke daily_stock_records
            products.forEach(product => {
                // HANYA catat jika stok produk > 0
                if (product.stock > 0) {
                    recordsToInsert.push({
                        company_id: companyId,
                        product_id: product.id,
                        record_date: recordDate,
                        stock_qty: product.stock, // Mengambil snapshot saldo akhir
                        purchase_price: product.purchase_price || 0,
                        stock_type: 'product', 
                    });
                }
            });

            // 4. Masukkan data dengan mekanisme UPSERT
            // Jika record untuk hari dan produk ini sudah ada, timpa (update) datanya
            if (recordsToInsert.length > 0) {
                const { error: insertError } = await supabase
                    .from('daily_stock_records')
                    .insert(recordsToInsert)
                    // Conflict target: memastikan unik per hari, per produk, per tipe.
                    .onConflict(['company_id', 'product_id', 'record_date', 'stock_type'])
                    .merge(); // Gunakan .merge() untuk update jika record sudah ada
                
                if (insertError) {
                    console.error(`Error inserting daily records for company ${companyId}:`, insertError);
                } else {
                    totalRecordsCreated += recordsToInsert.length;
                }
            }
        }

        return new Response(JSON.stringify({ 
            success: true, 
            message: `Successfully created ${totalRecordsCreated} stock records for ${companies.length} companies.`,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        console.error('Error in scheduled function:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});