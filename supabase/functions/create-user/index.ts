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

  try {
    const { 
      email, 
      password, 
      role, 
      companyName, 
      companyId, 
      fullName, // Kita terima fullName (camelCase) dari frontend
      phone, 
      rekening, 
      googleSheetsLink,
      base_salary,  
      logoUrl, 
      companyAddress 
    } = await req.json()
     
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
 
    if (!email || !password || !role) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }
    
    let profile_company_id = null;
 
    if (role === 'admin') {
      if (!companyName) {
         return new Response(JSON.stringify({ error: 'Company name is required for admin role' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
      }
      
      const companyInsertData = { 
        name: companyName, 
        google_sheets_link: googleSheetsLink 
      };
 
      if (logoUrl) companyInsertData.logo_url = logoUrl;
      if (companyAddress) companyInsertData.address = companyAddress;
      
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .insert([companyInsertData]) 
        .select()
        .single()
      
      if (companyError) throw companyError;
      profile_company_id = companyData.id;

    } else if (role === 'user' || role === 'dropship') { // TAMBAHKAN DROPSHIP DI SINI
      profile_company_id = companyId;
    }
 
    const { data: { user }, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone, rekening } // Gunakan fullName
    })

    if (userError) throw userError;
 
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(
        { 
          id: user.id, 
          role, 
          company_id: profile_company_id, 
          full_name: fullName, // Gunakan fullName
          phone, 
          rekening,
          base_salary  
        },
        { onConflict: 'id' }
      )
    
    if (profileError) throw profileError;

    return new Response(JSON.stringify({ message: 'User created successfully', userId: user.id, companyId: profile_company_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})