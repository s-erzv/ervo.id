import { supabase } from './supabase';

export const logFinancialTransaction = async ({
  companyId,
  type,
  categoryName,
  subcategoryName,
  amount,
  description,
  transactionDate = new Date(),
  paymentMethodId = null,
  sourceTable = null,
  sourceId = null,
  proofUrl = null
}) => {
  try {
    // 1. Cari Category ID (Gunakan maybeSingle biar gak error 406 kalau kosong)
    let { data: cat, error: catErr } = await supabase
      .from('financial_categories')
      .select('id')
      .eq('company_id', companyId)
      .ilike('name', categoryName)
      .maybeSingle(); // <--- GANTI INI

    if (catErr) throw catErr;

    // Jika kategori tidak ditemukan, kita punya 2 pilihan:
    // A. Error (supaya user sadar belum setup kategori) -> Pilihan yang aman
    // B. Auto-create (sedikit ribet dan berisiko duplikat kalau typo)
    
    if (!cat) {
      console.warn(`Kategori '${categoryName}' tidak ditemukan. Harap "Install Akun Standar" di menu Pengaturan Keuangan.`);
      return { error: `Kategori '${categoryName}' belum ada. Silakan ke menu Pengaturan Keuangan dan klik 'Install Akun Standar'.` };
    }

    // 2. Cari Subcategory ID
    let { data: sub } = await supabase
      .from('financial_subcategories')
      .select('id')
      .eq('category_id', cat.id)
      .ilike('name', subcategoryName)
      .maybeSingle(); // <--- GANTI INI JUGA

    // 3. Masukkan ke Tabel Financial Transactions
    const { error } = await supabase
      .from('financial_transactions')
      .insert({
        company_id: companyId,
        transaction_date: transactionDate,
        type: type, // Pastikan formatnya sesuai (misal: 'expense' lowercase)
        amount: amount,
        description: description,
        category_id: cat.id,
        subcategory_id: sub?.id || null, // Kalau sub gak ketemu, biarkan null
        payment_method_id: paymentMethodId,
        source_table: sourceTable,
        source_id: sourceId,
        proof_url: proofUrl
      });

    if (error) throw error;
    return { success: true };

  } catch (err) {
    console.error("Auto-log financial transaction failed:", err);
    return { error: err.message };
  }
};