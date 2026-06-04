// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SANDBOX_URL = 'https://sandbox.duitku.com/webapi/api/merchant/paymentmethod/getpaymentmethod';
const PROD_URL    = 'https://passport.duitku.com/webapi/api/merchant/paymentmethod/getpaymentmethod';

async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { amount } = await req.json();
    if (!amount) {
      return new Response(JSON.stringify({ error: 'amount diperlukan' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const merchantCode = Deno.env.get('DUITKU_MERCHANT_CODE') ?? '';
    const apiKey       = Deno.env.get('DUITKU_API_KEY') ?? '';
    const isSandbox    = (Deno.env.get('DUITKU_ENV') ?? 'sandbox') !== 'production';

    // DateTime dalam format Asia/Jakarta (UTC+7): "yyyy-MM-dd HH:mm:ss"
    const now = new Date();
    const jakarta = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const dateTime = jakarta.toISOString().replace('T', ' ').slice(0, 19);

    // Signature: SHA256(merchantCode + amount + dateTime + apiKey)
    const signature = await sha256(`${merchantCode}${amount}${dateTime}${apiKey}`);

    const url = isSandbox ? SANDBOX_URL : PROD_URL;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantcode: merchantCode, amount, datetime: dateTime, signature }),
    });

    const data = await res.json();
    console.log('getpaymentmethod response:', JSON.stringify(data));

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('get-payment-methods error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
