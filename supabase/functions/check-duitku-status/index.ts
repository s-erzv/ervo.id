// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import md5fn from 'https://esm.sh/md5@2.3.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SANDBOX_URL = 'https://sandbox.duitku.com/webapi/api/merchant/transactionStatus';
const PROD_URL    = 'https://passport.duitku.com/webapi/api/merchant/transactionStatus';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Verifikasi caller
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    const { merchant_order_id } = await req.json();
    if (!merchant_order_id) {
      return new Response(JSON.stringify({ error: 'merchant_order_id diperlukan' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const merchantCode = Deno.env.get('DUITKU_MERCHANT_CODE') ?? '';
    const apiKey       = Deno.env.get('DUITKU_API_KEY') ?? '';
    const isSandbox    = (Deno.env.get('DUITKU_ENV') ?? 'sandbox') !== 'production';

    // Cari payment record — hanya milik company user yang request
    const { data: payment } = await supabase
      .from('subscription_payments')
      .select('duitku_reference, status')
      .eq('duitku_order_id', merchant_order_id)
      .eq('company_id', profile?.company_id)
      .single();

    if (!payment) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!payment?.duitku_reference) {
      return new Response(JSON.stringify({ statusCode: '01', statusMessage: 'Pending' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Signature: MD5(merchantCode + reference + apiKey)
    const signature = md5fn(`${merchantCode}${payment.duitku_reference}${apiKey}`);

    const url = isSandbox ? SANDBOX_URL : PROD_URL;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantCode, merchantOrderId: merchant_order_id, signature }),
    });

    const data = await res.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('check-duitku-status error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
