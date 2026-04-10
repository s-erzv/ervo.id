/**
 * Sinkronisasi Token FCM dari Firestore ke Supabase.
 * Dipicu setiap kali dokumen di koleksi 'fcm_tokens_to_sync' dibuat atau diupdate.
 */
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

// 1. Inisialisasi Firebase Admin
// Ini memungkinkan function untuk berkomunikasi dengan Firestore, dll.
admin.initializeApp();

// 2. Ambil Environment Variables untuk Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
// HARUS MENGGUNAKAN SERVICE ROLE KEY karena fungsi ini adalah server-to-server
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 3. Pemicu Cloud Function
// Memantau setiap perubahan (onCreate, onUpdate, onDelete) pada dokumen di koleksi ini.
exports.syncFCMTokenToSupabase = functions.firestore
  .document('fcm_tokens_to_sync/{userId}')
  .onWrite(async (change, context) => {
    
    // --- Langkah 3A: Ambil Data Token ---
    const afterData = change.after.exists ? change.after.data() : null;
    
    // Jika dokumen dihapus, tidak perlu melakukan apapun (atau bisa ditambahkan logic delete di Supabase)
    if (!afterData) {
      console.log(`Dokumen untuk user ${context.params.userId} dihapus di Firestore. Sinkronisasi diabaikan.`);
      return null;
    }
    
    const token = afterData.fcm_token;
    const userId = afterData.user_id;

    if (!token || !userId) {
      console.error(`Data tidak lengkap untuk user ${userId}: token atau user_id hilang.`);
      return null;
    }
    
    // --- Langkah 3B: Inisialisasi Supabase Client ---
    // Menggunakan Service Role Key untuk bypass RLS (karena ini server-to-server)
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
    });

    // --- Langkah 3C: Lakukan Upsert ke Supabase ---
    try {
      const { error } = await supabaseAdmin
        .from('fcm_tokens')
        .upsert({
          user_id: userId,
          fcm_token: token,
          // Tambahkan created_at/updated_at jika perlu (diasumsikan Supabase auto-handle)
        }, {
          onConflict: 'user_id' 
        });

      if (error) {
        console.error('❌ GAGAL UPSERT KE SUPABASE:', error);
        // Penting: Anda bisa menambahkan logic di sini untuk menandai dokumen Firestore sebagai "sync_failed"
        return null;
      }
      
      console.log(`✅ SUKSES SINKRON: Token ${token.substring(0, 10)}... untuk user ${userId.substring(0, 8)} berhasil di-upsert ke Supabase.`);
      
      // OPTIONAL: Hapus flag 'needs_sync' di Firestore
      await change.after.ref.update({ needs_sync: false });
      
      return 'Sinkronisasi Selesai';

    } catch (e) {
      console.error('❌ KESALAHAN FATAL FUNGSI:', e);
      return null;
    }
  });