// ⚡️ PERUBAHAN KRUSIAL: Import Buffer dari modul Node.js
import { Buffer } from "node:buffer";

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { create as createJwt, getNumericDate } from "https://deno.land/x/djwt@v2.9/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS Headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Environment Variables (Didefinisikan ulang agar TypeScript tidak error)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FCM_PROJECT_ID = Deno.env.get("FCM_PROJECT_ID")!;
const TOKEN_URI = "https://oauth2.googleapis.com/token";
const MESSAGING_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

/**
 * Generates an Access Token for Firebase Cloud Messaging using a Service Account JWT.
 */
async function getAccessToken(): Promise<string> {
  const clientEmail = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_EMAIL");
  const privateKeyString = Deno.env.get("FIREBASE_PRIVATE_KEY")!;
  const privateKeyId = Deno.env.get("FIREBASE_PRIVATE_KEY_ID");

  if (!clientEmail || !privateKeyString || !privateKeyId) {
    throw new Error("Missing FIREBASE_* environment variables (Email, Key, or Key ID).");
  }

  // [LOG] 
  console.log(`[LOG-AUTH] Starting Access Token generation for email: ${clientEmail}`);
  
  const cleanedBase64Key = privateKeyString.replace(/\s/g, "").trim();

  try {
    const binaryKey = Buffer.from(cleanedBase64Key, 'base64');
    
    // [LOG]
    console.log(`[LOG-AUTH] Base64 decoding successful. Binary key length: ${binaryKey.byteLength} bytes`);

    const now = getNumericDate(0);
    const exp = getNumericDate(3600);
    const header = { alg: "RS256", typ: "JWT", kid: privateKeyId };
    const payload = {
      iss: clientEmail,
      scope: MESSAGING_SCOPE,
      aud: TOKEN_URI,
      iat: now,
      exp,
    };

    const key = await crypto.subtle.importKey(
      "pkcs8",
      binaryKey.buffer,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const jwt = await createJwt(header, payload, key);
    
    // [LOG]
    console.log(`[LOG-AUTH] JWT signed successfully. Starting token exchange...`);

    const response = await fetch(TOKEN_URI, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[LOG-AUTH] Token Exchange Failed: ${errorText}`);
      throw new Error(`Failed to get access token: ${errorText}`);
    }

    const data = await response.json();
    // [LOG]
    console.log(`[LOG-AUTH] Access Token received. Expires in: ${data.expires_in}s`);
    return data.access_token;
  } catch (e) {
    throw new Error(`JWT or Decoding Failed. Check FIREBASE_PRIVATE_KEY/ID/EMAIL. Original Error: ${e.message}`);
  }
}

// --- Main Server Logic ---

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { user_id, title, body: notifBody } = body;
    
    // [LOG]
    console.log(`[LOG-REQUEST] Received request for user_id: ${user_id}`);
    
    if (!user_id || !title || !notifBody) {
      throw new Error("Missing fields: user_id, title, and body are required.");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // [LOG]
    console.log(`[LOG-DB] Querying fcm_tokens for user_id: ${user_id}`);
    
    const { data: tokenData, error: dbError } = await supabase
      .from("fcm_tokens")
      .select("fcm_token")
      .eq("user_id", user_id)
      .single();
      
    if (dbError && dbError.code !== 'PGRST116') {
        throw new Error(`Supabase DB Error: ${dbError.message} (Code: ${dbError.code})`);
    }

    if (!tokenData?.fcm_token) {
      // [LOG]
      console.warn(`[LOG-DB] No FCM token found for user_id: ${user_id}`);
      
      return new Response(JSON.stringify({ message: "No FCM token found for user." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // [LOG]
    console.log(`[LOG-DB] Token retrieved successfully. Token starts with: ${tokenData.fcm_token.slice(0, 10)}...`);

    const accessToken = await getAccessToken();
    
    // [LOG]
    console.log(`[LOG-FCM] Access Token is ready. Starting notification send...`);

    // Prepare FCM Payload
    const fcmPayload = {
      message: {
        token: tokenData.fcm_token,
        notification: { title, body: notifBody },
        android: { priority: "HIGH" },
      },
    };

    // [LOG]
    console.log(`[LOG-FCM] Payload prepared. Title: ${title}`);

    // Send the push notification
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fcmPayload),
      }
    );

    const result = await res.json();
    if (!res.ok) {
        console.error("[LOG-FCM] FCM Send Failed Detail:", result); 
        throw new Error(`FCM Send Failed: ${JSON.stringify(result)}`);
    }
    
    // [LOG]
    console.log("[LOG-FCM] Notification sent successfully.");

    return new Response(
      JSON.stringify({
        message: "Notification sent successfully",
        fcm_response: result,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    console.error("FUNCTION EXECUTION ERROR (CATCH BLOCK):", err.message);
    
    return new Response(JSON.stringify({ 
        error: "Internal Server Error",
        detail: String(err.message), 
        step: err.message.includes('FIREBASE') || err.message.includes('Token Exchange') ? 'Authentication' : (err.message.includes('Supabase DB Error') ? 'Database' : 'FCM_API')
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});