// s-erzv/management-app/s-erzv-management-app-12b73ef39915b66df14ffc806e6ae670c6a48daf/src/lib/onesignal-setup.jsx

// Hapus import OneSignal dari npm. SDK dimuat dari CDN di index.html.
// Import yang diperlukan dari Firebase/Firestore
import { getFirestore, doc, setDoc } from 'firebase/firestore'; 
import { app } from './firebase'; 
import { toast } from 'react-hot-toast'; // Asumsi ini adalah library toast Anda

// --- Environment Variables ---
const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID; 

/**
 * Menyimpan OneSignal Player ID ke Firestore.
 * ID ini akan disinkronkan ke Supabase oleh Cloud Function/Trigger.
 */
const savePlayerIdToFirestore = async (userId, playerId) => {
    try {
        const db = getFirestore(app);
        // Menggunakan koleksi staging yang sama untuk konsistensi
        const tokenRef = doc(db, "fcm_tokens_to_sync", userId); 
        
        await setDoc(tokenRef, {
            user_id: userId,
            onesignal_player_id: playerId, // Field BARU untuk Player ID
            platform: 'web',
            last_updated: new Date().toISOString(),
            needs_sync: true 
        }, { merge: true });
        
        console.log(`✅ ONESIGNAL Sync: Player ID ${playerId} berhasil disimpan untuk User ${userId.slice(0, 8)}.`);

    } catch (e) {
        console.error('❌ ONESIGNAL Error: Gagal menyimpan Player ID ke Firestore. Detail:', e);
    }
};


export const setupOneSignal = (userId) => {
    if (!userId || !ONESIGNAL_APP_ID) {
        console.warn("OneSignal Setup dibatalkan: User ID atau App ID tidak tersedia.");
        return;
    }
    
    // [KRITIS] Cek apakah SDK OneSignal sudah dimuat secara global
    if (typeof window.OneSignal === 'undefined') {
        console.error("❌ ONESIGNAL BLOKADE: window.OneSignal tidak ditemukan. Pastikan <script> tag di index.html sudah benar.");
        return;
    }

    console.log("🟢 START: Memulai OneSignal setup.");
    
    // [MODIFIKASI KRITIS]: Gunakan async function di dalam push() untuk menjamin inisialisasi selesai sebelum operasi lain.
    window.OneSignal.push(async function() {
        try {
            // 1. Inisialisasi OneSignal (gunakan await untuk menunggu init selesai)
            await window.OneSignal.init({
                appId: ONESIGNAL_APP_ID,
                allowLocalhostAsSecure: true, 
                notifyButton: { enable: false }, // Menyembunyikan tombol default
            });

            // 2. Event Listener untuk mendapatkan Player ID setelah disubscribe
            // Listener ini akan menangani kasus di mana pengguna baru mengizinkan notifikasi
            window.OneSignal.on('subscriptionChange', function(isSubscribed) {
                if (isSubscribed) {
                    window.OneSignal.getUserId().then(function(playerId) {
                        if (playerId) {
                            console.log(`✅ ONESIGNAL ID: Player ID didapatkan (via subscriptionChange): ${playerId}`);
                            // Gunakan External User ID (ID pengguna aplikasi Anda)
                            window.OneSignal.setExternalUserId(userId); 
                            savePlayerIdToFirestore(userId, playerId);
                        }
                    });
                }
            });
            
            // 3. Handle Notifikasi Saat Foreground (In-App Message)
            window.OneSignal.on('notificationDisplay', function(event) {
                console.log('🔔 Pesan Foreground (In-App) diterima:', event);
                
                const title = event.title || "Pemberitahuan Baru"; 
                const body = event.body || "Anda memiliki pembaruan.";
                
                toast(
                    <div className="flex flex-col">
                        <p className="font-semibold text-sm">{title}</p>
                        <p className="text-xs text-gray-500">{body}</p>
                    </div>, 
                    { 
                        icon: '🚀', 
                        duration: 6000 
                    }
                );
            });

            // 4. [FLOW BARU] Panggil sekali saat start untuk kasus di mana pengguna sudah subscribe
            // Ini menjamin Player ID disinkronkan bahkan jika 'subscriptionChange' tidak terpicu saat load.
            const currentUserId = await window.OneSignal.getUserId();
            if (currentUserId) {
                 console.log(`✅ ONESIGNAL ID (Initial Check): Player ID didapatkan: ${currentUserId}`);
                 await window.OneSignal.setExternalUserId(userId);
                 savePlayerIdToFirestore(userId, currentUserId);
            } else {
                 // Meminta native prompt jika pengguna belum disubscribe
                 window.OneSignal.showNativePrompt();
            }

        } catch (error) {
            console.error("❌ ONESIGNAL CRITICAL ERROR: Gagal dalam proses inisialisasi atau listener.", error);
        }
    });
};