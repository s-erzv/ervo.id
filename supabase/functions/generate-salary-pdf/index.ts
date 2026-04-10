// supabase/functions/generate-salary-pdf/index.ts
// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { PDFDocument, StandardFonts, rgb, jpg, png } from 'https://esm.sh/pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Helper untuk memformat mata uang
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount || 0);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { 
        employee, 
        achievement, 
        totalPayout, 
        basePay, 
        adjustments, 
        period, 
        companyId,
        startDate,
        endDate 
    } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Fetch company data
    const { data: companyData } = await supabase.from('companies').select('name, logo_url').eq('id', companyId).single();
    const companyName = companyData?.name || 'PERUSAHAAN ANDA';
    const logoUrl = companyData?.logo_url;

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    const margin = 40; 
    let y = height - margin;
    const padding = 8;
    const rowHeight = 22; 
    
    // --- DEFINISI UKURAN FONT & KOLOM KONSISTEN ---
    const standardFontSize = 10; 
    const detailFontSize = 14; 
    const titleFontSize = 28; 
    const contentWidth = width - 2 * margin;

    const INCOME_LABEL_W = 300; 
    const VALUE_W = contentWidth - INCOME_LABEL_W; 

    const POTONGAN_DATE_W = 80;
    const POTONGAN_DESC_W = 300;
    const POTONGAN_NOMINAL_W = contentWidth - POTONGAN_DATE_W - POTONGAN_DESC_W;
    // ---------------------------------------------

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Warna
    const primaryColor = rgb(0.06, 0.09, 0.17); 
    const accentColor = rgb(0.12, 0.29, 0.49); 
    const secondaryColor = rgb(0.4, 0.4, 0.4); 
    const whiteColor = rgb(1, 1, 1);
    const lightGray = rgb(0.96, 0.97, 0.98); 
    const mediumGray = rgb(0.85, 0.85, 0.85); 
    const highlightColor = rgb(0.1, 0.5, 0.1); 
    
    
    // --- Helper untuk draw text sejajar kanan ---
    const drawTextRight = (text, x, yPos, font, size, color) => {
        const textWidth = font.widthOfTextAtSize(text, size);
        page.drawText(text, { x: x - textWidth, y: yPos, size: size, font: font, color: color });
    };

    // --- Helper untuk draw cell dan text ---
    const drawCell = (x, yPos, w, h, text, fnt, size, color, bgColor = whiteColor, alignRight = false, border = true) => {
        if (border) {
            page.drawRectangle({ 
                x, y: yPos, width: w, height: h, 
                color: bgColor, 
                borderColor: mediumGray, 
                borderWidth: 0.5 
            });
        } else {
             page.drawRectangle({ x, y: yPos, width: w, height: h, color: bgColor });
        }
        
        const textY = yPos + (h - size) / 2;

        if (alignRight) {
            drawTextRight(text, x + w - padding, textY, fnt, size, color);
        } else {
            page.drawText(text, { x: x + padding, y: textY, size, font: fnt, color });
        }
    };

    // =================================================================
    // HEADER & INFO
    // =================================================================
    
    // Asumsi Logo
    let logoImage = null;
    let logoHeight = 0;
    const logoMaxWidth = 100; // Maksimum lebar logo
    const logoMaxHeight = 40; // Maksimum tinggi logo

    if (logoUrl) {
        try {
            const logoResponse = await fetch(logoUrl);
            const logoBytes = await logoResponse.arrayBuffer();
            
            // Coba identifikasi tipe gambar (sederhana)
            const isPng = logoUrl.toLowerCase().endsWith('.png');
            const isJpg = logoUrl.toLowerCase().endsWith('.jpg') || logoUrl.toLowerCase().endsWith('.jpeg');

            if (isPng) {
                logoImage = await pdfDoc.embedPng(logoBytes);
            } else if (isJpg) {
                logoImage = await pdfDoc.embedJpg(logoBytes);
            } else {
                console.warn("Unsupported logo image format, skipping logo.");
            }

            if (logoImage) {
                const aspectRatio = logoImage.width / logoImage.height;
                logoHeight = Math.min(logoMaxHeight, logoMaxWidth / aspectRatio);
                const logoWidth = logoHeight * aspectRatio;

                page.drawImage(logoImage, {
                    x: margin,
                    y: y - logoHeight, // Posisikan di kanan atas
                    width: logoWidth,
                    height: logoHeight,
                });
                y -= logoHeight + 10; // Geser 'y' ke bawah setelah logo
            }
        } catch (error) {
            console.error("Error embedding logo:", error);
            // Lanjutkan tanpa logo jika ada error
        }
    }
    
    // Company Name & Title (Posisinya disesuaikan agar tidak tumpang tindih dengan logo)
    // Jika ada logo, geser companyName ke kanan logo atau di bawahnya
    const companyNameX = logoImage ? margin + logoMaxWidth + padding : margin;
    const titleX = margin; // Judul selalu mulai dari margin kiri

    page.drawText(companyName, { x: titleX, y: y - 10, size: standardFontSize, font: boldFont, color: primaryColor });
    page.drawText('SLIP GAJI', { x: titleX, y: y - 32, size: titleFontSize, font: boldFont, color: primaryColor });
    
    y -= 70; // Jarak setelah header
    
    // Info karyawan & periode - Diatur menjadi 2 kolom
    const infoStartX2 = width / 2; // Mulai kolom kedua
    const infoStartY = y;
    
    // Kolom 1 (Periode & Tanggal)
    page.drawText('Periode Pembayaran', { x: margin, y: infoStartY, size: standardFontSize, font: font, color: secondaryColor });
    page.drawText(`${period}`, { x: margin, y: infoStartY - rowHeight + 5, size: detailFontSize, font: boldFont, color: primaryColor });
    
    page.drawText('Tanggal Cetak', { x: margin, y: infoStartY - rowHeight * 2, size: standardFontSize, font: font, color: secondaryColor });
    page.drawText(`${new Date().toLocaleDateString('id-ID')}`, { x: margin, y: infoStartY - rowHeight * 3 + 5, size: detailFontSize, font: font, color: primaryColor });
    
    // Kolom 2 (Karyawan & Jabatan)
    page.drawText('Nama Karyawan', { x: infoStartX2, y: infoStartY, size: standardFontSize, font: font, color: secondaryColor });
    page.drawText(`${employee.full_name}`, { x: infoStartX2, y: infoStartY - rowHeight + 5, size: detailFontSize, font: boldFont, color: primaryColor });
    
    y -= rowHeight * 4 + 10;
    
    // Divider
    page.drawLine({
        start: { x: margin, y: y },
        end: { x: width - margin, y: y },
        thickness: 1,
        color: mediumGray,
    });
    y -= 15;


    // =================================================================
    // RINCIAN PENDAPATAN
    // =================================================================
    
    let subTotalPendapatan = 0;
    
    // Item Pendapatan Utama
    let pendapatanItems = [
        { label: 'Gaji Pokok', amount: basePay, isBase: true },
    ];
    
    // Tambahkan item tambahan (bonus/uang makan)
    const tambahanItems = adjustments.filter(adj => adj.type === 'Tambahan');
    tambahanItems.forEach(adj => {
        pendapatanItems.push({ 
            label: adj.description, 
            amount: parseFloat(adj.amount) || 0,
            isBase: false,
        });
    });

    subTotalPendapatan = pendapatanItems.reduce((sum, item) => sum + item.amount, 0);

    // Header Rincian
    page.drawText('A. Pendapatan', { x: margin, y: y, size: detailFontSize, font: boldFont, color: primaryColor });
    y -= 10;
    
    // Draw Headers
    const headerPendapatanY = y - rowHeight;
    drawCell(margin, headerPendapatanY, INCOME_LABEL_W, rowHeight, 'Deskripsi', boldFont, standardFontSize, whiteColor, accentColor);
    drawCell(margin + INCOME_LABEL_W, headerPendapatanY, VALUE_W, rowHeight, 'Nominal', boldFont, standardFontSize, whiteColor, accentColor, true);
    y -= rowHeight;

    // Draw Items
    pendapatanItems.forEach((item, index) => {
        const itemY = y - rowHeight;
        
        // Warna item bergantian untuk keterbacaan
        const bgColor = index % 2 === 0 ? whiteColor : lightGray;
        const currentFont = item.isBase ? boldFont : font;

        drawCell(margin, itemY, INCOME_LABEL_W, rowHeight, item.label, currentFont, standardFontSize, primaryColor, bgColor);
        drawCell(margin + INCOME_LABEL_W, itemY, VALUE_W, rowHeight, formatCurrency(item.amount), currentFont, standardFontSize, primaryColor, bgColor, true);
        y -= rowHeight;
    });

    
    // Draw Sub Total Pendapatan
    const subTotal1Y = y - rowHeight;
    page.drawRectangle({ x: margin, y: subTotal1Y, width: contentWidth, height: rowHeight, color: mediumGray, opacity: 0.5 });
    drawCell(margin, subTotal1Y, INCOME_LABEL_W, rowHeight, 'Sub Total Pendapatan', boldFont, standardFontSize, primaryColor, mediumGray, false, false);
    drawCell(margin + INCOME_LABEL_W, subTotal1Y, VALUE_W, rowHeight, formatCurrency(subTotalPendapatan), boldFont, standardFontSize, primaryColor, mediumGray, true, false);
    y -= rowHeight * 2;


    // =================================================================
    // POTONGAN (Pengurangan)
    // =================================================================
    
    const potonganItems = adjustments.filter(adj => adj.type === 'Potongan');
    const potonganSubtotal = potonganItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    
    // Header Potongan
    page.drawText('B. Potongan', { x: margin, y: y, size: detailFontSize, font: boldFont, color: primaryColor });
    y -= 10;

    // Tabel Header Potongan
    const headerPotonganY = y - rowHeight;
    drawCell(margin, headerPotonganY, POTONGAN_DATE_W, rowHeight, 'Tgl. Mulai', boldFont, standardFontSize, whiteColor, accentColor);
    drawCell(margin + POTONGAN_DATE_W, headerPotonganY, POTONGAN_DESC_W, rowHeight, 'Keterangan', boldFont, standardFontSize, whiteColor, accentColor);
    drawCell(margin + POTONGAN_DATE_W + POTONGAN_DESC_W, headerPotonganY, POTONGAN_NOMINAL_W, rowHeight, 'Nominal', boldFont, standardFontSize, whiteColor, accentColor, true);
    y -= rowHeight;

    // Draw Potongan Items
    if (potonganItems.length === 0) {
        drawCell(margin, y - rowHeight, contentWidth, rowHeight, 'Tidak ada potongan bulan ini.', font, standardFontSize, secondaryColor, lightGray);
        y -= rowHeight;
    } else {
        potonganItems.forEach((item, index) => {
            const itemY = y - rowHeight;
            const bgColor = index % 2 === 0 ? whiteColor : lightGray;
            
            drawCell(margin, itemY, POTONGAN_DATE_W, rowHeight, new Date(item.date || startDate).toLocaleDateString('id-ID'), font, standardFontSize, primaryColor, bgColor);
            drawCell(margin + POTONGAN_DATE_W, itemY, POTONGAN_DESC_W, rowHeight, item.description, font, standardFontSize, primaryColor, bgColor);
            drawCell(margin + POTONGAN_DATE_W + POTONGAN_DESC_W, itemY, POTONGAN_NOMINAL_W, rowHeight, formatCurrency(parseFloat(item.amount) || 0), font, standardFontSize, primaryColor, bgColor, true);
            y -= rowHeight;
        });
    }

    // Draw Sub Total Potongan
    const subTotal2Y = y - rowHeight;
    page.drawRectangle({ x: margin, y: subTotal2Y, width: contentWidth, height: rowHeight, color: mediumGray, opacity: 0.5 });
    drawCell(margin, subTotal2Y, POTONGAN_DATE_W + POTONGAN_DESC_W, rowHeight, 'Sub Total Potongan', boldFont, standardFontSize, primaryColor, mediumGray, false, false);
    drawCell(margin + POTONGAN_DATE_W + POTONGAN_DESC_W, subTotal2Y, POTONGAN_NOMINAL_W, rowHeight, formatCurrency(potonganSubtotal), boldFont, standardFontSize, primaryColor, mediumGray, true, false);
    y -= rowHeight * 2;
    
    // =================================================================
    // TOTAL AKHIR (NET PAY)
    // =================================================================

    // Box untuk Total Akhir
    const totalBoxHeight = rowHeight + 10;
    const totalY = y - totalBoxHeight;
    
    page.drawRectangle({ 
        x: margin, y: totalY, width: contentWidth, height: totalBoxHeight, 
        color: highlightColor, 
        borderColor: highlightColor, 
        borderWidth: 2,
    });
    
    const textTotalY = totalY + (totalBoxHeight - standardFontSize) / 2; // Menggunakan standardFontSize untuk teks label

    page.drawText('Total', { 
        x: margin + padding, 
        y: textTotalY + 3, // Sedikit geser ke atas
        size: standardFontSize + 1, // Label lebih kecil dari nominal tapi tetap jelas
        font: boldFont, 
        color: whiteColor 
    });
    
    // Nominal di kanan
    drawTextRight(
        formatCurrency(totalPayout), 
        width - margin - padding, 
        textTotalY + 3, // Sesuaikan posisi y
        boldFont, 
        titleFontSize - 18, // Ukuran nominal dikurangi agar tidak terlalu besar (contoh: 28 - 10 = 18)
        whiteColor
    );
    
    y -= totalBoxHeight + 30; 


    // =================================================================
    // FOOTER & SIGNATURE
    // =================================================================
    
    // Kiri: Rekening
    page.drawText('Detail Pembayaran', { x: margin, y: y, size: standardFontSize, font: boldFont, color: primaryColor });
    y -= rowHeight - 5;
    page.drawText(`Rekening Tujuan: ${employee.rekening || 'Belum diisi'}`, { x: margin, y: y, size: standardFontSize, font: font, color: secondaryColor });
    y -= rowHeight;
    page.drawText(`Keterangan: Slip gaji ini adalah bukti pembayaran resmi.`, { x: margin, y: y, size: standardFontSize - 2, font: font, color: secondaryColor });

 

    // =================================================================
    // SIMPAN & UPLOAD
    // =================================================================
    
    const pdfBytes = await pdfDoc.save();
    const employeeId = employee?.id ? employee.id.slice(0, 8) : 'unknown';
    const safeStartDate = startDate || 'start';
    const safeEndDate = endDate || 'end';

    const fileName = `slip-gaji-${employeeId}-${safeStartDate}-${safeEndDate}.pdf`;
    
    const { error: uploadError } = await supabase.storage.from('invoices').upload(fileName, pdfBytes, { contentType: 'application/pdf', upsert: true });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage.from('invoices').getPublicUrl(fileName);
    let pdfUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`; 

    return new Response(JSON.stringify({ pdfUrl: pdfUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error generating PDF:', error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred on the server.";
    return new Response(JSON.stringify({ 
        error: errorMessage,
        context: "Pastikan semua variabel data yang dikirimkan (employee, totalPayout, basePay, adjustments, dll.) terisi dengan benar, terutama object employee.",
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});