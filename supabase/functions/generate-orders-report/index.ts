//@ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orders, filterInfo, companyName } = await req.json()

    if (!orders || !Array.isArray(orders)) {
      throw new Error('Data orders tidak valid atau kosong')
    }

    const pdfDoc = await PDFDocument.create()
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)

    let page = pdfDoc.addPage([841.89, 595.28]) // A4 Landscape
    const { width, height } = page.getSize()
    let y = height - 50

    // ===== HEADER =====
    page.drawText(
      `Laporan Daftar Pesanan - ${String(companyName || 'Manajemen Pesanan')}`,
      { x: 50, y, size: 16, font: fontBold }
    )
    y -= 20

    // page.drawText(
    //   `Periode/Filter: ${String(filterInfo || '-')}`,
    //   { x: 50, y, size: 10, font: fontRegular }
    // )
    // y -= 35

    const cols = [
      { label: 'Inv #', x: 50 },
      { label: 'Pelanggan', x: 120 },
      { label: 'Tgl Kirim', x: 270 },
      { label: 'Status', x: 350 },
      { label: 'Bayar', x: 430 },
      { label: 'Total Harga', x: 510 },
      { label: 'Petugas', x: 630 },
    ]

    const drawTableHeader = () => {
      page.drawRectangle({
        x: 45,
        y: y - 5,
        width: width - 90,
        height: 20,
        color: rgb(0.06, 0.09, 0.17),
      })

      cols.forEach((col) => {
        page.drawText(col.label, {
          x: col.x,
          y,
          size: 10,
          font: fontBold,
          color: rgb(1, 1, 1),
        })
      })

      y -= 20
    }

    drawTableHeader()

    // ===== ROWS =====
    orders.forEach((order, index) => {
      if (y < 40) {
        page = pdfDoc.addPage([841.89, 595.28])
        y = height - 50
        drawTableHeader()
      }

      const rowColor =
        index % 2 === 0 ? rgb(1, 1, 1) : rgb(0.97, 0.97, 0.98)

      page.drawRectangle({
        x: 45,
        y: y - 5,
        width: width - 90,
        height: 20,
        color: rowColor,
      })

      const formatCurr = (val) =>
        `Rp${(Number(val) || 0).toLocaleString('id-ID')}`

      const courierName =
        order.order_couriers?.[0]?.courier?.full_name || '-'
      const custName = order.customers?.name || 'N/A'

      page.drawText(String(order.invoice_number || '-'), {
        x: cols[0].x,
        y,
        size: 9,
        font: fontRegular,
      })
      page.drawText(String(custName).substring(0, 25), {
        x: cols[1].x,
        y,
        size: 9,
        font: fontRegular,
      })
      page.drawText(
        order.delivered_at
          ? new Date(order.delivered_at).toLocaleDateString('id-ID')
          : '-',
        { x: cols[2].x, y, size: 9, font: fontRegular }
      )
      page.drawText(String(order.status || '-'), {
        x: cols[3].x,
        y,
        size: 9,
        font: fontRegular,
      })
      page.drawText(String(order.payment_status || '-'), {
        x: cols[4].x,
        y,
        size: 9,
        font: fontRegular,
      })
      page.drawText(formatCurr(order.grand_total), {
        x: cols[5].x,
        y,
        size: 9,
        font: fontRegular,
      })
      page.drawText(String(courierName).substring(0, 20), {
        x: cols[6].x,
        y,
        size: 9,
        font: fontRegular,
      })

      y -= 20
    })

    // ===== SAVE & CONVERT =====
    const pdfBytes = await pdfDoc.save()

    const pdfBase64 = btoa(
      String.fromCharCode(...pdfBytes)
    )

    return new Response(
      JSON.stringify({ pdfBase64 }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (err) {
    console.error('PDF Generation Error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  }
})
