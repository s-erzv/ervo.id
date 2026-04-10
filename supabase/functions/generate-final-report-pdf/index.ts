// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';
import { format } from 'https://esm.sh/date-fns@2.30.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount || 0);
};

const formatNumber = (amount: number, decimals: number = 2) => {
    return (amount || 0).toFixed(decimals).replace(/\.?0+$/, ''); 
};

async function fetchImage(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const payload = await req.json();
    const {
        companyId, companyName, startDate, endDate, financialSummary,
        opexList, dllList, incomeList, totalOpex, ebitda, netProfit, grossMargin,
        salesPerDay, atv, agp, upt, totalTransportCost,
        manualItems 
    } = payload;

    const metricItems = [
        { label: 'Sales Per Day', value: salesPerDay, format: (v) => formatCurrency(v) },
        { label: 'ATV (Average Transaction Value)', value: atv, format: (v) => formatCurrency(v) },
        { label: 'AGP (Average Gross Profit)', value: agp, format: (v) => formatCurrency(v) },
        { label: 'UPT (Units Per Transaction)', value: upt, format: (v) => formatNumber(v) + ' pcs' },
    ];

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const { data: companyData } = await supabase.from('companies').select('name, logo_url, address').eq('id', companyId).single();
    const finalCompanyName = companyData?.name || companyName;
    const logoUrl = companyData?.logo_url;
    const companyAddress = companyData?.address || '';

    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage();
    let currentPage = page; 
    const { width, height } = currentPage.getSize();
    const margin = 40; 
    let y = height - margin;
    const padding = 5;
    const rowHeight = 18;
    const standardFontSize = 10;
    const contentWidth = width - 2 * margin;
    
    const col1W_GP = contentWidth * 0.7; 
    const col2W_GP = contentWidth * 0.3; 

    const col1W_DETAIL = contentWidth * 0.5; 
    const col2W_DETAIL = contentWidth * 0.2; 
    const col3W_DETAIL = contentWidth * 0.3; 

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    
    const primaryColor = rgb(0.1, 0.1, 0.1); 
    const accentColor = rgb(0.5, 0.7, 0.9); 
    const lightBg = rgb(0.95, 0.98, 1);    
    const totalBgColor = rgb(0.85, 0.93, 0.99); 
    const highlightGain = rgb(0.1, 0.5, 0.1); 
    const highlightLoss = rgb(0.7, 0.1, 0.1); 
    const whiteColor = rgb(1, 1, 1);
    const borderColor = rgb(0.7, 0.85, 0.95);

    const checkNewPage = (neededSpace: number) => {
        if (y - neededSpace < margin) {
            currentPage = pdfDoc.addPage();
            y = currentPage.getHeight() - margin;
        }
    };

    const drawCell = (x: number, currentY: number, w: number, h: number, text: string, fnt: any, size: number, textColor: any, bgColor: any, alignRight = false, borderOptions: any = {}) => {
        currentPage.drawRectangle({ x, y: currentY, width: w, height: h, color: bgColor });
        const borderW = 0.5;
        // Pengecekan eksplisit agar tidak ada garis yang tergambar jika tidak diminta
        if (borderOptions.top === 1) currentPage.drawLine({ start: { x, y: currentY + h }, end: { x: x + w, y: currentY + h }, thickness: borderW, color: borderColor });
        if (borderOptions.bottom === 1) currentPage.drawLine({ start: { x, y: currentY }, end: { x: x + w, y: currentY }, thickness: borderW, color: borderColor });
        if (borderOptions.left === 1) currentPage.drawLine({ start: { x, y: currentY }, end: { x: x, y: currentY + h }, thickness: borderW, color: borderColor });
        if (borderOptions.right === 1) currentPage.drawLine({ start: { x: x + w, y: currentY }, end: { x: x + w, y: currentY + h }, thickness: borderW, color: borderColor });

        let textX = x + padding;
        if (alignRight) textX = x + w - padding - fnt.widthOfTextAtSize(text, size);
        currentPage.drawText(text, { x: textX, y: currentY + (h - size) / 2, size, font: fnt, color: textColor });
    };

    const drawProfitRow = (label: string, value: number, fontStyle: string, isTotalRow = false, isPercentage = false, customBg = whiteColor, customValueColor = primaryColor, customFont = null, borders: any = {}) => {
        checkNewPage(rowHeight);
        const fnt = fontStyle === 'bold' ? boldFont : font;
        const valFnt = customFont || fnt;
        const txtSize = isTotalRow ? standardFontSize + 1 : standardFontSize;
        const bg = isTotalRow ? totalBgColor : customBg;
        const valDisp = isPercentage ? `${formatNumber(value)}%` : formatCurrency(value);
        const currentY = y - rowHeight;
        drawCell(margin, currentY, col1W_GP, rowHeight, label, fnt, txtSize, primaryColor, bg, false, { left: 1, top: borders.top, bottom: borders.bottom });
        drawCell(margin + col1W_GP, currentY, col2W_GP, rowHeight, valDisp, valFnt, txtSize, customValueColor, bg, true, { right: 1, top: borders.top, bottom: borders.bottom });
        y -= rowHeight;
    };

    const drawTransportIncomeRow = (label: string, value: number, borders: any = {}) => {
        checkNewPage(rowHeight);
        const currentY = y - rowHeight;
        drawCell(margin, currentY, col1W_GP, rowHeight, label, boldFont, standardFontSize, primaryColor, whiteColor, false, { left: 1, top: borders.top, bottom: borders.bottom });
        drawCell(margin + col1W_GP, currentY, col2W_GP, rowHeight, `+ ${formatCurrency(value)}`, boldFont, standardFontSize, highlightGain, whiteColor, true, { right: 1, top: borders.top, bottom: borders.bottom });
        y -= rowHeight;
    };

    const drawDetailRow3Col = (description: string, type: string, amount: number, index: number, totalItems: number, borders: any = {}) => {
        checkNewPage(rowHeight);
        const isInc = type === 'income';
        const valColor = isInc ? highlightGain : highlightLoss;
        const bg = index % 2 === 0 ? whiteColor : lightBg;
        const currentY = y - rowHeight;
        const botBorder = borders.bottom || (index < totalItems - 1 ? 1 : 1); // Set ke 1 biar konsisten
        drawCell(margin, currentY, col1W_DETAIL, rowHeight, description, font, standardFontSize, primaryColor, bg, false, { left: 1, top: borders.top, bottom: botBorder });
        drawCell(margin + col1W_DETAIL, currentY, col2W_DETAIL, rowHeight, isInc ? 'Pemasukan' : 'Pengeluaran', font, standardFontSize, isInc ? highlightGain : primaryColor, bg, false, { left: 1, top: borders.top, bottom: botBorder });
        drawCell(margin + col1W_DETAIL + col2W_DETAIL, currentY, col3W_DETAIL, rowHeight, formatCurrency(amount), font, standardFontSize, valColor, bg, true, { right: 1, top: borders.top, bottom: botBorder });
        y -= rowHeight;
    };

    const drawSubtotal3Col = (label: string, value: number, borders: any = {}) => {
        checkNewPage(rowHeight);
        const currentY = y - rowHeight;
        drawCell(margin, currentY, col1W_DETAIL + col2W_DETAIL, rowHeight, label, boldFont, standardFontSize + 1, primaryColor, totalBgColor, false, { left: 1, top: borders.top, bottom: borders.bottom });
        drawCell(margin + col1W_DETAIL + col2W_DETAIL, currentY, col3W_DETAIL, rowHeight, formatCurrency(value), boldFont, standardFontSize + 1, primaryColor, totalBgColor, true, { right: 1, top: borders.top, bottom: borders.bottom });
        y -= rowHeight;
    };

    // =================================================================
    // HEADER SECTION
    // =================================================================
    const initialY = height - margin;
    let logoMaxHeight = 60; 
    let logoDrawnY = initialY;
    let infoX = margin; 
    
    const companyNameSize = 20;
    const addressSize = 10;
    const textGap = 2;
    
    let targetLogoHeight = logoMaxHeight; 
    let y_companyName = initialY - companyNameSize; 
    
    if (logoUrl) {
        try {
            const imageBytes = await fetchImage(logoUrl);
            const fileExtension = logoUrl.split('.').pop().toLowerCase();
            let image;
            if (fileExtension === 'png') image = await pdfDoc.embedPng(imageBytes);
            else if (['jpg', 'jpeg'].includes(fileExtension)) image = await pdfDoc.embedJpg(imageBytes);
            
            const scale = Math.min(120 / image.width, logoMaxHeight / image.height, 1);
            const imageDims = image.scale(scale);

            const logoDrawY = initialY - imageDims.height;
            currentPage.drawImage(image, { x: margin, y: logoDrawY, width: imageDims.width, height: imageDims.height });
            logoDrawnY = logoDrawY; 
            infoX = margin + imageDims.width + 15; 
            
            const textBlockHeight = companyNameSize + textGap + addressSize;
            const logoCenterY = logoDrawY + (imageDims.height / 2);
            y_companyName = logoCenterY + (textBlockHeight / 2) - companyNameSize;
        } catch (e) {
            infoX = margin;
        }
    }

    currentPage.drawText(`${finalCompanyName}`, { x: infoX, y: y_companyName, size: companyNameSize, font: boldFont, color: primaryColor });
    currentPage.drawText(`${companyAddress}`, { x: infoX, y: y_companyName - addressSize - textGap, size: addressSize, font: font, color: primaryColor });
    
    const pStr = `Periode: ${new Date(startDate).toLocaleDateString('id-ID')} - ${new Date(endDate).toLocaleDateString('id-ID')}`;
    const dStr = `Tgl. Cetak: ${new Date().toLocaleDateString('id-ID')}`;

    currentPage.drawText(pStr, { x: width - margin - boldFont.widthOfTextAtSize(pStr, 11), y: initialY - 15, size: 11, font: boldFont, color: primaryColor });
    currentPage.drawText(dStr, { x: width - margin - font.widthOfTextAtSize(dStr, 9), y: initialY - 30, size: 9, font: font, color: primaryColor });
    
    y = logoDrawnY - 20; 
    // Garis Pemisah Header (Satu-satunya garis di bagian atas)
    currentPage.drawLine({ start: { x: margin, y: y }, end: { x: width - margin, y: y }, thickness: 1.5, color: accentColor });
    y -= 10;

    // --- BAGIAN 1: GROSS PROFIT ---
    drawProfitRow('Sales', financialSummary.sales, 'normal', false, false, whiteColor, primaryColor, null, { top: 0 });
    drawProfitRow('COGS', financialSummary.cogs, 'normal');
    drawProfitRow(`Gross Profit`, financialSummary.grossProfit, 'bold', true, false, totalBgColor, primaryColor);
    drawProfitRow(`Gross Margin %`, grossMargin, 'normal', false, true, totalBgColor, primaryColor, italicFont);
    y -= 5;

    // --- BAGIAN 2: OPEX ---
    const opexItems = manualItems.filter(i => i.category === 'opex');
    if (opexItems.length > 0) {
        checkNewPage(rowHeight * 2);
        const hY = y - rowHeight;
        drawCell(margin, hY, col1W_DETAIL, rowHeight, 'Deskripsi (Operasional)', boldFont, 10, primaryColor, totalBgColor, false, { left: 1, top: 1, bottom: 1 });
        drawCell(margin + col1W_DETAIL, hY, col2W_DETAIL, rowHeight, 'Jenis', boldFont, 10, primaryColor, totalBgColor, false, { left: 1, top: 1, bottom: 1 });
        drawCell(margin + col1W_DETAIL + col2W_DETAIL, hY, col3W_DETAIL, rowHeight, 'Nominal', boldFont, 10, primaryColor, totalBgColor, true, { right: 1, top: 1, bottom: 1 });
        y -= rowHeight;

        opexItems.forEach((item, index) => {
            drawDetailRow3Col(item.description, item.type, parseFloat(item.amount) || 0, index, opexItems.length);
        });
        drawSubtotal3Col('Sub Total OPEX', totalOpex, { top: 1, bottom: 1 });
        y -= 5;
    }

    if (totalTransportCost > 0) drawTransportIncomeRow('Pemasukan Transportasi', totalTransportCost, { top: 1, bottom: 1 });
    drawProfitRow('EBITDA', ebitda, 'bold', true, false, totalBgColor, primaryColor, boldFont);
    y -= 5;

    // --- BAGIAN 3: LAIN-LAIN ---
    const otherItems = manualItems.filter(i => i.category === 'dll');
    if (otherItems.length > 0) {
        checkNewPage(rowHeight * 2);
        const hY = y - rowHeight;
        drawCell(margin, hY, col1W_DETAIL, rowHeight, 'Deskripsi (Lain-lain)', boldFont, 10, primaryColor, totalBgColor, false, { left: 1, top: 1, bottom: 1 });
        drawCell(margin + col1W_DETAIL, hY, col2W_DETAIL, rowHeight, 'Jenis', boldFont, 10, primaryColor, totalBgColor, false, { left: 1, top: 1, bottom: 1 });
        drawCell(margin + col1W_DETAIL + col2W_DETAIL, hY, col3W_DETAIL, rowHeight, 'Nominal', boldFont, 10, primaryColor, totalBgColor, true, { right: 1, top: 1, bottom: 1 });
        y -= rowHeight;

        otherItems.forEach((item, index) => {
            drawDetailRow3Col(item.description, item.type, parseFloat(item.amount) || 0, index, otherItems.length);
        });
        y -= 2;
    }

    drawProfitRow('Net Profit', netProfit, 'bold', true, false, totalBgColor, primaryColor, boldFont, { top: 1, bottom: 1 });
    y -= 25;

    // --- METRICS ---
    metricItems.forEach((m) => {
        checkNewPage(rowHeight);
        currentPage.drawText(m.label, { x: margin, y: y - 10, size: 10, font, color: primaryColor });
        const val = m.format(m.value);
        currentPage.drawText(val, { x: width - margin - boldFont.widthOfTextAtSize(val, 10), y: y - 10, size: 10, font: boldFont, color: primaryColor });
        y -= rowHeight;
    });

    const pdfBytes = await pdfDoc.save();
    const filename = `Laporan_Final_${Date.now()}.pdf`;
    await supabase.storage.from('invoices').upload(filename, pdfBytes, { contentType: 'application/pdf', upsert: true });
    const { data: urlData } = supabase.storage.from('invoices').getPublicUrl(filename);

    return new Response(JSON.stringify({ pdfUrl: urlData.publicUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 500 });
  }
});