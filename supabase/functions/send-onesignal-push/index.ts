// Path: supabase/functions/send-onesignal-push/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

// --- MODIFIKASI KRITIS: Tambahkan .trim() untuk membersihkan whitespace ---
const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID')?.trim()
const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY')?.trim()
// ----------------------------------------------------------------------

if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
  console.error('❌ ONESIGNAL_SECRET_ERROR: OneSignal App ID or REST API Key is not set.')
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    const { user_ids, title, message, data } = await req.json()

    if (!user_ids || user_ids.length === 0) {
      console.warn('🟡 ONESIGNAL_SKIP: user_ids is empty. Skipping push notification.')
      return new Response('No User IDs provided', { status: 200, headers: corsHeaders })
    }

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
        throw new Error('OneSignal secrets not available in environment.')
    }
    
    // --- PENGECEKAN KONTEN PUSH NOTIFICATION ---
    const finalTitle = title || "Pemberitahuan Baru";
    const finalMessage = message || "Anda memiliki pembaruan.";


    const notificationPayload = {
      app_id: ONESIGNAL_APP_ID, 
      name: finalTitle, // Tambah Name untuk tracking di dashboard
      
      // Targeting: Menggunakan External User IDs (UUID Supabase Anda)
      include_external_user_ids: user_ids, 
      
      // Konten Notifikasi
      contents: {
          en: finalMessage, 
          id: finalMessage 
      },
      headings: {
          en: finalTitle,   
          id: finalTitle
      },
      // Custom data payload untuk deep linking
      data: data, 

      // Wajib untuk penargetan External User IDs
      channel_for_external_user_ids: 'push' 
    }

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(notificationPayload),
    })

    const result = await response.json()
    
    if (!response.ok) {
      console.error('❌ ONESIGNAL_API_FAIL:', result)
      return new Response(JSON.stringify({ error: 'Failed to send notification', details: result }), { status: 500, headers: corsHeaders })
    }

    // Logging yang lebih akurat
    console.log(`✅ ONESIGNAL_SENT: To ${result.recipients || user_ids.length} users. ID: ${result.id}`)
    return new Response(JSON.stringify({ success: true, onesignal_id: result.id }), { status: 200, headers: corsHeaders })

  } catch (error) {
    console.error('❌ FUNCTION_ERROR:', error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})