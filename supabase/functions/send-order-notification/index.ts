import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function createEmailBody(order: any) {
  const customerName = order.customers?.name ?? "Pelanggan";
  const items = (order.order_items ?? [])
    .map((i: any) => `- ${i.products?.name ?? "Item"}: ${i.qty} pcs`)
    .join("\n");
  const totalAmount = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(order.grand_total ?? 0);
  const plannedDate = order.planned_date
    ? new Date(order.planned_date).toLocaleDateString("id-ID")
    : "Tidak ditentukan";

  return `Halo Admin,

Ada pesanan baru yang masuk ke sistem. Berikut detailnya:

* Nomor Invoice: #${order.invoice_number}
* Pelanggan: ${customerName}
* Tanggal Pengiriman: ${plannedDate}
* Total Harga: ${totalAmount}

Item Pesanan:
${items}

Silakan cek dashboard untuk detail lebih lanjut dan proses pesanan ini.

Terima kasih.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { record: newOrder } = await req.json();
    if (!newOrder?.id) {
      throw new Error("Payload tidak valid: ID pesanan tidak ditemukan.");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Ambil detail pesanan
    const { data: orderDetails, error: fetchOrderError } = await supabase
      .from("orders")
      .select(
        `id, invoice_number, grand_total, planned_date, company_id, 
         customers(name), order_items(qty, products(name))`
      )
      .eq("id", newOrder.id)
      .single();

    if (fetchOrderError) {
      throw new Error(`Gagal mengambil detail pesanan: ${fetchOrderError.message}`);
    }

    // Cari admin perusahaan
    const { data: adminProfile, error: fetchAdminError } = await supabase
      .from("profiles")
      .select("id")
      .eq("company_id", orderDetails.company_id)
      .eq("role", "admin")
      .limit(1)
      .single();

    if (fetchAdminError) {
      throw new Error(`Gagal mencari profil admin: ${fetchAdminError.message}`);
    }
    if (!adminProfile?.id) {
      throw new Error("Profil admin untuk perusahaan ini tidak ditemukan.");
    }

    // Ambil data user admin dari Auth
    const { data: userRes, error: adminGetUserErr } =
      await supabase.auth.admin.getUserById(adminProfile.id);

    if (adminGetUserErr) {
      throw new Error(
        `Gagal mendapatkan data user admin: ${adminGetUserErr.message}`
      );
    }

    const adminEmail = userRes?.user?.email;
    if (!adminEmail) throw new Error("Alamat email admin tidak ditemukan.");

    // 🚀 Kirim email via Brevo API
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      throw new Error("BREVO_API_KEY belum diset di environment variables.");
    }

    const emailBody = createEmailBody(orderDetails);

    const sendRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          email: "managementapp1.0@gmail.com",
          name: "Notifikasi Pesanan Baru",
        },
        to: [{ email: adminEmail }],  
        subject: `Pesanan Baru Diterima - #${orderDetails.invoice_number}`,
        textContent: emailBody,
      }),
    });

    if (!sendRes.ok) {
      const errText = await sendRes.text();
      // Memberikan error yang lebih spesifik jika pengiriman Brevo gagal
      throw new Error(`Gagal mengirim email Brevo (Status ${sendRes.status}): ${errText}`);
    }

    return new Response(
      JSON.stringify({ message: "Notifikasi email berhasil dikirim." }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error di Edge Function:", error);
    return new Response(JSON.stringify({ error: String(error?.message || error) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});