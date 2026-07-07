// @ts-nocheck
// Callback dari Duitku — verify_jwt = false karena dipanggil server Duitku
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
async function hmacSha256(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  // Duitku mengirim POST dengan form-encoded body
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const merchantCode = Deno.env.get('DUITKU_MERCHANT_CODE') ?? '';
    const apiKey       = Deno.env.get('DUITKU_API_KEY') ?? '';

    // Parse form body dari Duitku
    const contentType = req.headers.get('content-type') ?? '';
    let params: Record<string, string> = {};

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text();
      params = Object.fromEntries(new URLSearchParams(text));
    } else {
      // Kadang Duitku kirim JSON di beberapa versi
      params = await req.json();
    }

    const {
      merchantCode: incomingMerchantCode,
      amount,
      merchantOrderId,
      resultCode,
      reference,
      signature: incomingSignature,
    } = params;

    console.log('Duitku callback received:', { merchantOrderId, resultCode, amount, reference });

    // Verifikasi signature: HMAC_SHA256(merchantCode + amount + merchantOrderId, apiKey)
    const expectedSig = await hmacSha256(apiKey, `${merchantCode}${amount}${merchantOrderId}`);
    if (expectedSig.toLowerCase() !== (incomingSignature ?? '').toLowerCase()) {
      console.error('Signature mismatch. Expected:', expectedSig, 'Got:', incomingSignature);
      return new Response(JSON.stringify({ status: 'INVALID_SIGNATURE' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Cari payment record
    const { data: payment, error: findError } = await supabase
      .from('subscription_payments')
      .select('*, subscription_plans(billing_cycle_days)')
      .eq('duitku_order_id', merchantOrderId)
      .single();

    if (findError || !payment) {
      console.error('Payment not found for order:', merchantOrderId, findError);
      return new Response(JSON.stringify({ status: 'NOT_FOUND' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verifikasi amount cocok dengan yang tersimpan di DB
    if (Number(amount) !== Number(payment.amount)) {
      console.error('Amount mismatch', { expected: payment.amount, got: amount });
      return new Response(JSON.stringify({ status: 'AMOUNT_MISMATCH' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Jika sudah diproses sebelumnya, return OK supaya Duitku tidak retry terus
    if (payment.status === 'approved') {
      return new Response(JSON.stringify({ status: 'OK' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (resultCode === '00') {
      // SUKSES — update payment status
      const now = new Date().toISOString();
      await supabase
        .from('subscription_payments')
        .update({
          status: 'approved',
          approved_at: now,
          duitku_reference: reference,
        })
        .eq('id', payment.id);

      // Hitung tanggal kedaluwarsa baru
      const monthsMatch = payment.admin_notes?.match(/months:(\d+)/);
      const months = monthsMatch ? parseInt(monthsMatch[1]) : 1;
      const billingDays = (payment.subscription_plans?.billing_cycle_days ?? 30) * months;
      const { data: currentCompany } = await supabase
        .from('companies')
        .select('subscription_end_date')
        .eq('id', payment.company_id)
        .single();

      // Mulai dari hari ini atau dari expiry yang masih aktif (mana lebih lambat)
      const startFrom =
        currentCompany?.subscription_end_date &&
        new Date(currentCompany.subscription_end_date) > new Date()
          ? new Date(currentCompany.subscription_end_date)
          : new Date();

      const newExpiry = new Date(startFrom.getTime() + billingDays * 24 * 60 * 60 * 1000);

      await supabase
        .from('companies')
        .update({
          subscription_end_date: newExpiry.toISOString(),
          subscription_plan_id: payment.plan_id,
          is_manually_locked: false,
        })
        .eq('id', payment.company_id);

      console.log(`✅ Payment approved for company ${payment.company_id}, expires ${newExpiry.toISOString()}`);

    } else if (resultCode === '02') {
      // GAGAL
      await supabase
        .from('subscription_payments')
        .update({ status: 'rejected', admin_notes: `Duitku resultCode: ${resultCode}` })
        .eq('id', payment.id);

      console.log(`❌ Payment failed for order ${merchantOrderId}, resultCode: ${resultCode}`);
    }
    // resultCode '01' = masih pending, tidak perlu update

    // Duitku mengharapkan response {"status": "OK"} atau plain text "OK"
    return new Response(JSON.stringify({ status: 'OK' }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Callback error:', err);
    // Tetap return 200 supaya Duitku tidak retry berkali-kali untuk error internal kita
    return new Response(JSON.stringify({ status: 'OK' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
