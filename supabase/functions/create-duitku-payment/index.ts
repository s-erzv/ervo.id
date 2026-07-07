// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Duitku POP API — signature via header, bukan body
const SANDBOX_URL = 'https://api-sandbox.duitku.com/api/merchant/createInvoice';
const PROD_URL    = 'https://api-prod.duitku.com/api/merchant/createInvoice';

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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Auth — verifikasi JWT
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { plan_id, company_id, months = 1, custom_amount } = body;

    if (!plan_id || !company_id) {
      return new Response(JSON.stringify({ error: 'plan_id dan company_id diperlukan' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const qty = Math.max(1, Math.min(12, parseInt(months) || 1));

    // Pastikan user adalah admin dari company
    const { data: membership } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .eq('company_id', company_id)
      .in('role', ['admin', 'super_admin'])
      .single();

    if (!membership) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const merchantCode = Deno.env.get('DUITKU_MERCHANT_CODE') ?? '';
    const apiKey       = Deno.env.get('DUITKU_API_KEY') ?? '';
    // Memastikan environment backend sama dengan frontend.
    // Jika tidak di-set di Supabase Secrets, kita anggap Production untuk menghindari error blank POP UI.
    const isSandbox    = Deno.env.get('DUITKU_ENV') === 'sandbox'; 
    const appBaseUrl   = Deno.env.get('APP_BASE_URL') ?? 'https://app.ervo.id';
    const supabaseUrl  = Deno.env.get('SUPABASE_URL') ?? '';

    // Ambil plan
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('id, name, price, billing_cycle_days, is_custom_pricing')
      .eq('id', plan_id)
      .single();

    if (planError || !plan) {
      return new Response(JSON.stringify({ error: 'Paket tidak ditemukan' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Ambil company + admin
    const { data: company } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', company_id)
      .single();

    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('company_id', company_id)
      .eq('role', 'admin')
      .limit(1)
      .single();

    const timestamp = Date.now();
    const shortCompanyId = company_id.replace(/-/g, '').slice(0, 8).toUpperCase();
    const merchantOrderId = `ERVO-${shortCompanyId}-${timestamp}`;

    let amount = Math.round(plan.price * qty);
    if (plan.is_custom_pricing) {
      amount = Math.round(Number(custom_amount) || 0);
      if (amount < 1) {
        return new Response(JSON.stringify({ error: 'Nominal pembayaran tidak valid untuk paket ini' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const totalDays = (plan.billing_cycle_days ?? 30) * qty;

    // Duitku POP signature (Header): HMAC_SHA256(merchantCode + timestamp, apiKey)
    const signature = await hmacSha256(apiKey, `${merchantCode}${timestamp}`);

    // Duitku POP signature (Body): HMAC_SHA256(merchantCode + amount + merchantOrderId, apiKey)
    const bodySignature = await hmacSha256(apiKey, `${merchantCode}${amount}${merchantOrderId}`);

    const callbackUrl = `${supabaseUrl}/functions/v1/duitku-callback`;
    const returnUrl   = `${appBaseUrl}/payment/result`;
    const email       = `admin@ervo-${shortCompanyId.toLowerCase()}.id`;

    const payload = {
      merchantCode,
      paymentAmount: amount,
      merchantOrderId,
      signature: bodySignature,
      productDetails: `Langganan Ervo - ${plan.name}${qty > 1 ? ` (${qty} bulan)` : ''}`,
      email,
      phoneNumber: '',
      additionalParam: '',
      merchantUserInfo: '',
      customerVaName: company?.name ?? 'Ervo User',
      callbackUrl,
      returnUrl,
      expiryPeriod: 1440,
      itemDetails: [{ name: `${plan.name}${qty > 1 ? ` x${qty}` : ''}`, price: amount, quantity: 1 }],
      customerDetail: {
        firstName: adminProfile?.full_name ?? company?.name ?? 'User',
        lastName: '',
        email,
        phoneNumber: '',
      },
    };

    const url = isSandbox ? SANDBOX_URL : PROD_URL;
    const duitkuRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-duitku-signature':   signature,
        'x-duitku-timestamp':   String(timestamp),
        'x-duitku-merchantcode': merchantCode,
      },
      body: JSON.stringify(payload),
    });

    const textData = await duitkuRes.text();
    let duitkuData;
    try {
      duitkuData = JSON.parse(textData);
      console.log('Duitku POP response:', JSON.stringify(duitkuData));
    } catch (e) {
      console.error('Duitku returned non-JSON response:', textData);
      return new Response(
        JSON.stringify({ error: `Duitku API Error: ${textData}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!duitkuRes.ok || duitkuData.statusCode !== '00') {
      console.error('Duitku POP error:', duitkuData);
      return new Response(
        JSON.stringify({ error: duitkuData.statusMessage ?? duitkuData.Message ?? 'Gagal membuat invoice Duitku' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Simpan ke subscription_payments
    const { data: payment, error: insertError } = await supabase
      .from('subscription_payments')
      .insert({
        company_id,
        plan_id,
        amount,
        status: 'pending',
        payment_url:      duitkuData.paymentUrl,
        duitku_reference: duitkuData.reference,
        duitku_order_id:  merchantOrderId,
        admin_notes:      `months:${qty}`,
      })
      .select()
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({ error: 'Gagal menyimpan data pembayaran: ' + insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        payment_url: duitkuData.paymentUrl,
        reference:   duitkuData.reference,
        order_id:    merchantOrderId,
        payment_id:  payment.id,
        amount,
        is_sandbox:  isSandbox,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: err.message ?? 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
