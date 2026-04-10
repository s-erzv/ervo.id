// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function fetchImage(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { order_id, orderData } = await req.json();

    if (!order_id || !orderData) {
      return new Response(JSON.stringify({ error: 'Order ID and data are required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .select('name, logo_url')
      .eq('id', orderData.company_id)
      .single();
        
    if (companyError) throw companyError;
    const companyName = companyData.name;
    const companyLogoUrl = companyData.logo_url;

    const {
      customers,
      invoice_number,
      created_at,
      order_items,
      transport_cost,
      grand_total,
      proof_public_url,
      payments,
      remaining_due,
      order_galon_items,
      total_discount, 
    } = orderData;
    
    const totalDiscount = Number(total_discount) || 0;

    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();
    const margin = 30;
    let y = height - margin;

    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const FONT_SIZE = {
      INVOICE_TITLE: 24,
      TOTAL_SUMMARY: 14,
      BODY_BOLD: 12,
      BODY_REGULAR: 12,
      BODY_SMALL: 10,
    };

    let itemsToRender = [];

    if (order_items) {
      itemsToRender = itemsToRender.concat(order_items.map(item => ({
        name: item.products.name,
        qty: item.qty,
        price: item.price,
        itemType: 'Produk',
        isChargeable: true,
      })));
    }
    
    if (transport_cost > 0) {
      itemsToRender.push({
        name: 'Biaya Transportasi',
        qty: 1,
        price: transport_cost,
        itemType: 'Biaya',
        isChargeable: true,
      });
    }
    
    if (order_galon_items && order_galon_items.length > 0) {
      for (const galonItem of order_galon_items) {
        const product = galonItem.products;
        if (!product) continue;
        
        const emptyBottlePrice = product.empty_bottle_price || 0;

        if (galonItem.purchased_empty_qty > 0) {
          itemsToRender.push({
            name: `Kemasan dibeli (${product.name})`,
            qty: galonItem.purchased_empty_qty,
            price: emptyBottlePrice,
            itemType: 'Beli Kemasan',
            isChargeable: true,
          });
        }
        if (galonItem.returned_qty > 0) {
          itemsToRender.push({
            name: `Kemasan Kembali (${product.name})`,
            qty: galonItem.returned_qty,
            price: 0, 
            itemType: 'Kembali',
            isChargeable: false,
          });
        }
        if (galonItem.borrowed_qty > 0) {
          itemsToRender.push({
            name: `Kemasan Dipinjam (${product.name})`,
            qty: galonItem.borrowed_qty,
            price: 0, 
            itemType: 'Pinjam',
            isChargeable: false,
          });
        }
      }
    }
    
    if (companyLogoUrl) {
        try {
            const imageBytes = await fetchImage(companyLogoUrl);
            const fileExtension = companyLogoUrl.split('.').pop().toLowerCase();
            let image;
            if (fileExtension === 'png') image = await pdfDoc.embedPng(imageBytes);
            else if (['jpg', 'jpeg'].includes(fileExtension)) image = await pdfDoc.embedJpg(imageBytes);
            else throw new Error('Unsupported logo file type.');
            
            const logoMaxWidth = 180, logoMaxHeight = 100;
            const scale = Math.min(logoMaxWidth / image.width, logoMaxHeight / image.height, 1);
            const imageDims = image.scale(scale);

            page.drawImage(image, { x: margin, y: y - imageDims.height / 2 - 20, width: imageDims.width, height: imageDims.height });
            y -= imageDims.height / 2 + 10;
        } catch (imageError) {
            console.error('Failed to embed company logo:', imageError);
            page.drawText('Gagal memuat logo.', { x: margin, y: y - 20, size: FONT_SIZE.BODY_SMALL, font: helveticaFont, color: rgb(1, 0, 0) });
            y -= 30;
        }
    } else {
        y -= 20; 
    }

    page.drawText('INVOICE', { 
        x: width - margin - helveticaBoldFont.widthOfTextAtSize('INVOICE', FONT_SIZE.INVOICE_TITLE), 
        y: y - 10, 
        size: FONT_SIZE.INVOICE_TITLE, 
        font: helveticaBoldFont, 
        color: rgb(0.06, 0.09, 0.17) 
    });
    y -= 50;

    page.drawText(`${companyName}`, { x: margin, y: y, size: FONT_SIZE.BODY_BOLD, font: helveticaBoldFont });
    page.drawText(`Invoice #${invoice_number}`, { x: width - margin - helveticaFont.widthOfTextAtSize(`Invoice #${invoice_number}`, FONT_SIZE.BODY_REGULAR), y: y, size: FONT_SIZE.BODY_REGULAR, font: helveticaFont });
    y -= 15;
    page.drawText(`Tanggal Pesanan: ${new Date(created_at).toLocaleDateString()}`, { x: width - margin - helveticaFont.widthOfTextAtSize(`Tanggal Pesanan: ${new Date(created_at).toLocaleDateString()}`, FONT_SIZE.BODY_REGULAR), y: y, size: FONT_SIZE.BODY_REGULAR, font: helveticaFont });
    y -= 45;
    
    page.drawText('Tagihan Kepada:', { x: margin, y: y, size: FONT_SIZE.BODY_SMALL, font: helveticaBoldFont });
    y -= 15;
    page.drawText(customers.name, { x: margin, y: y, size: FONT_SIZE.BODY_REGULAR, font: helveticaFont });
    y -= 15;
    page.drawText(customers.address, { x: margin, y: y, size: FONT_SIZE.BODY_REGULAR, font: helveticaFont });
    y -= 15;
    page.drawText(customers.phone, { x: margin, y: y, size: FONT_SIZE.BODY_REGULAR, font: helveticaFont });
    y -= 30;

    page.drawRectangle({ x: margin, y: y, width: width - 2 * margin, height: 20, color: rgb(0.06, 0.09, 0.17) });
    page.drawText('Item', { x: margin + 5, y: y + 5, size: FONT_SIZE.BODY_BOLD, font: helveticaBoldFont, color: rgb(1, 1, 1) });
    page.drawText('Kuantitas', { x: margin + 200, y: y + 5, size: FONT_SIZE.BODY_BOLD, font: helveticaBoldFont, color: rgb(1, 1, 1) });
    page.drawText('Harga Satuan', { x: margin + 300, y: y + 5, size: FONT_SIZE.BODY_BOLD, font: helveticaBoldFont, color: rgb(1, 1, 1) });
    page.drawText('Total', { x: width - margin - helveticaBoldFont.widthOfTextAtSize('Total', FONT_SIZE.BODY_BOLD) - 5, y: y + 5, size: FONT_SIZE.BODY_BOLD, font: helveticaBoldFont, color: rgb(1, 1, 1) });
    y -= 10;
    
    for (const item of itemsToRender) {
        y -= 25;
        if (y < margin + 100) {
            page = pdfDoc.addPage([595.28, 841.89]);
            y = page.getHeight() - margin - 25; 
        }
        const currentFontSize = item.isChargeable ? FONT_SIZE.BODY_REGULAR : FONT_SIZE.BODY_SMALL;
        const itemTotal = item.isChargeable ? (item.qty || 0) * (item.price || 0) : 0;
        const totalDisplay = item.isChargeable ? `Rp${itemTotal.toLocaleString('id-ID')}` : '-';
        const priceDisplay = item.isChargeable ? `Rp${(item.price || 0).toLocaleString('id-ID')}` : '-';
        
        page.drawText(item.name, { x: margin + 5, y: y, size: currentFontSize, font: helveticaFont });
        page.drawText(`${item.qty || 0}`, { x: margin + 200, y: y, size: currentFontSize, font: helveticaFont });
        page.drawText(priceDisplay, { x: margin + 300, y: y, size: currentFontSize, font: helveticaFont });
        page.drawText(totalDisplay, { x: width - margin - helveticaFont.widthOfTextAtSize(totalDisplay, currentFontSize) - 5, y: y, size: currentFontSize, font: helveticaFont });
    }
    
    y -= 20;
    page.drawLine({ start: { x: margin, y: y }, end: { x: width - margin, y: y }, thickness: 1, color: rgb(0, 0, 0) });
    y -= 20;
    
    if (totalDiscount > 0) {
        const discountText = `DISKON: - Rp${totalDiscount.toLocaleString('id-ID')}`;
        page.drawText(discountText, { x: width - margin - helveticaBoldFont.widthOfTextAtSize(discountText, FONT_SIZE.BODY_REGULAR), y: y, size: FONT_SIZE.BODY_REGULAR, font: helveticaBoldFont, color: rgb(0.9, 0, 0) });
        y -= 20;
    }

    const totalText = `TOTAL TAGIHAN: Rp${grand_total?.toLocaleString('id-ID') ?? '0'}`;
    page.drawText(totalText, { 
        x: width - margin - helveticaBoldFont.widthOfTextAtSize(totalText, FONT_SIZE.TOTAL_SUMMARY), 
        y: y, 
        size: FONT_SIZE.TOTAL_SUMMARY, 
        font: helveticaBoldFont, 
        color: rgb(0.06, 0.09, 0.17) 
    });
    y -= 20;

    if (payments && payments.length > 0) {
        y -= 15;
        page.drawText('Rincian Pembayaran:', { x: margin, y: y, size: FONT_SIZE.BODY_SMALL, font: helveticaBoldFont });
        y -= 15;
        for (const payment of payments) {
            const paymentAmount = parseFloat(payment.amount || 0);
            const paymentMethod = payment.payment_method;
            let paymentDetails = 'N/A';
            if (paymentMethod) {
                if (paymentMethod.type === 'transfer') {
                    paymentDetails = `${paymentMethod.method_name} (${paymentMethod.account_name} / ${paymentMethod.account_number})`;
                } else {
                    paymentDetails = paymentMethod.method_name;
                }
            }
            if (paymentAmount > 0) {
                const paymentText = `Pembayaran Rp${paymentAmount.toLocaleString('id-ID')} (${paymentDetails}).`;
                page.drawText(paymentText, { x: margin, y: y, size: FONT_SIZE.BODY_SMALL, font: helveticaFont });
                y -= 15;
            }
        }
        y -= 5;
    }
    
    const remainingDueText = `SISA TAGIHAN: Rp${remaining_due?.toLocaleString('id-ID') ?? '0'}`;
    page.drawText(remainingDueText, {
        x: width - margin - helveticaBoldFont.widthOfTextAtSize(remainingDueText, FONT_SIZE.TOTAL_SUMMARY),
        y: y,
        size: FONT_SIZE.TOTAL_SUMMARY,
        font: helveticaBoldFont,
        color: remaining_due > 0 ? rgb(0.9, 0, 0) : rgb(0, 0.5, 0),
    });

    if (proof_public_url) {
        y -= 40;
        page.drawText('Bukti Pengiriman:', { x: margin, y: y, size: FONT_SIZE.BODY_REGULAR, font: helveticaBoldFont, color: rgb(0, 0, 0) });
        y -= 10;
        try {
            const imageBytes = await fetchImage(proof_public_url);
            const fileExtension = proof_public_url.split('.').pop().toLowerCase();
            let image;
            if (fileExtension === 'png') image = await pdfDoc.embedPng(imageBytes);
            else if (['jpg', 'jpeg'].includes(fileExtension)) image = await pdfDoc.embedJpg(imageBytes);
            else throw new Error('Unsupported proof file type.');
            
            const proofMaxWidth = width - 2 * margin;
            let scale = 1;
            if (image.width > proofMaxWidth) scale = proofMaxWidth / image.width;
            const imageDims = image.scale(scale);

            if (y - imageDims.height < margin) {
                page = pdfDoc.addPage([595.28, 841.89]);
                y = page.getHeight() - margin;
            }
            page.drawImage(image, { x: margin, y: y - imageDims.height, width: imageDims.width, height: imageDims.height });
        } catch (imageError) {
            console.error('Failed to embed delivery proof image:', imageError);
            page.drawText(`Gagal memuat bukti kirim. Error: ${imageError.message}`, { x: margin, y: y, size: FONT_SIZE.BODY_SMALL, font: helveticaFont, color: rgb(0.9, 0, 0) });
            y -= 15;
        }
    }

    const pdfBytes = await pdfDoc.save();
    const { data: existingInvoice } = await supabase.from('invoices').select('id').eq('order_id', order_id).single();
    let invData, invErr;

    const subtotalBeforeDiscount = grand_total - Number(transport_cost || 0) + totalDiscount;
    const invoicePayload = {
        customer_id: customers.id,
        invoice_number: invoice_number,
        grand_total: grand_total,
        company_id: orderData.company_id,
        paid_to_date: grand_total - remaining_due,
        balance_due: remaining_due,
        total_discount: totalDiscount,
        subtotal: subtotalBeforeDiscount, 
    };

    if (existingInvoice) {
      ({ data: invData, error: invErr } = await supabase.from('invoices').update(invoicePayload).eq('id', existingInvoice.id).select().single());
    } else {
      ({ data: invData, error: invErr } = await supabase.from('invoices').insert({ ...invoicePayload, order_id: order_id }).select().single());
    }

    if (invErr) throw invErr;

    const fileName = `invoice-${invData.id}.pdf`;

    // LOGIKA HAPUS LAMA: Menghapus file lama sebelum upload baru agar storage bersih
    if (existingInvoice) {
        await supabase.storage.from('invoices').remove([fileName]);
    }

    // Upload dengan upsert dan cacheControl: '0' agar browser tidak menampilkan file lama
    const { error: uploadError } = await supabase.storage.from('invoices').upload(fileName, pdfBytes, { 
      contentType: 'application/pdf', 
      upsert: true,
      cacheControl: '0'
    });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage.from('invoices').getPublicUrl(fileName);
    await supabase.from('invoices').update({ public_link: publicUrlData.publicUrl }).eq('id', invData.id);

    return new Response(JSON.stringify({ pdfUrl: publicUrlData.publicUrl, invoiceNumber: invoice_number, amount: grand_total, companyName: companyName }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});