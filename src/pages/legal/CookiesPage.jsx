import { Link } from 'react-router-dom';
import { ArrowLeft, Cookie, Settings, BarChart2, Shield, XCircle, Mail } from 'lucide-react';

const LAST_UPDATED = 'Juni 2025';

const CookieType = ({ icon: Icon, name, purpose, duration, canDisable, color, bg }) => (
  <div className="flex gap-4 p-5 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: bg }}>
      <Icon className="h-4 w-4" style={{ color }} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="font-semibold text-slate-800 text-sm">{name}</p>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border-0 ${canDisable ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
          {canDisable ? 'Opsional' : 'Wajib'}
        </span>
      </div>
      <p className="text-sm text-slate-500 mt-1 leading-relaxed">{purpose}</p>
      <p className="text-xs text-slate-400 mt-1.5 font-medium">Durasi: {duration}</p>
    </div>
  </div>
);

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#011e4b] transition-colors">
            <ArrowLeft className="h-4 w-4" /> Kembali ke Beranda
          </Link>
          <img src="/header.svg" alt="Ervo" className="h-8" onError={e => e.target.style.display='none'} />
          <div className="flex gap-4 text-xs text-slate-400">
            <Link to="/terms" className="hover:text-[#011e4b]">Terms</Link>
            <Link to="/sla" className="hover:text-[#011e4b]">SLA</Link>
            <Link to="/security" className="hover:text-[#011e4b]">Keamanan</Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-10">
        {/* Hero */}
        <div>
          <div className="inline-flex items-center gap-2 bg-amber-500 text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full mb-4">
            <Cookie className="h-3.5 w-3.5" /> Kebijakan Cookie
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-3">Kebijakan Cookie</h1>
          <p className="text-slate-500 text-lg">Penjelasan tentang cookie yang kami gunakan dan cara mengelolanya.</p>
          <p className="text-sm text-slate-400 mt-3">Berlaku sejak: {LAST_UPDATED}</p>
        </div>

        {/* Intro */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-3">Apa itu Cookie?</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Cookie adalah file teks kecil yang disimpan di perangkat Anda saat mengunjungi atau menggunakan platform Ervo ERP. Cookie memungkinkan platform mengingat preferensi Anda, menjaga sesi login tetap aktif, dan membantu kami memahami cara penggunaan platform untuk terus meningkatkan pengalaman Anda.
          </p>
          <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-sm text-blue-800 leading-relaxed">
              <strong>Ervo ERP tidak menggunakan cookie untuk iklan</strong>, pelacakan lintas situs, atau menjual data pengguna kepada pihak ketiga. Cookie kami murni untuk keperluan fungsional dan keamanan platform.
            </p>
          </div>
        </div>

        {/* Cookie types */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-5">Jenis Cookie yang Kami Gunakan</h2>
          <div className="space-y-3">
            <CookieType
              icon={Shield} name="Cookie Esensial / Sesi" canDisable={false}
              color="#011e4b" bg="#f0f5fa"
              purpose="Diperlukan agar platform berfungsi dengan benar. Menyimpan token autentikasi untuk menjaga sesi login Anda aktif dan aman, serta preferensi bahasa dan tampilan dasar."
              duration="Sesi browser (dihapus saat browser ditutup) hingga 7 hari untuk 'Ingat Saya'"
            />
            <CookieType
              icon={Settings} name="Cookie Preferensi" canDisable={true}
              color="#8b5cf6" bg="#f5f3ff"
              purpose="Menyimpan preferensi tampilan Anda seperti mode gelap/terang, ukuran tampilan tabel, dan filter terakhir yang digunakan agar tidak perlu mengatur ulang setiap kali login."
              duration="Hingga 1 tahun atau sampai Anda menghapusnya"
            />
            <CookieType
              icon={BarChart2} name="Cookie Analitik Internal" canDisable={true}
              color="#0ea5e9" bg="#f0f9ff"
              purpose="Mengumpulkan data anonim tentang halaman yang dikunjungi dan fitur yang digunakan — semata-mata untuk membantu kami mengidentifikasi area yang perlu ditingkatkan. Tidak mengidentifikasi Anda secara personal."
              duration="Hingga 30 hari"
            />
            <CookieType
              icon={XCircle} name="Cookie Pihak Ketiga" canDisable={true}
              color="#64748b" bg="#f8fafc"
              purpose="Platform kami menggunakan Supabase (penyedia database) yang mungkin menetapkan cookie teknis untuk keperluan koneksi. Kami tidak menggunakan Google Analytics, Facebook Pixel, atau layanan iklan manapun."
              duration="Sesuai kebijakan Supabase (umumnya sesi)"
            />
          </div>
        </div>

        {/* Cookie list */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900">Daftar Cookie Spesifik</h2>
            <p className="text-sm text-slate-500 mt-1">Cookie yang aktif di platform Ervo ERP.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['Nama Cookie', 'Tujuan', 'Durasi', 'Jenis'].map(h => (
                    <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider first:pl-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'sb-access-token', purpose: 'Token autentikasi Supabase', duration: 'Sesi (1 jam)', type: 'Esensial' },
                  { name: 'sb-refresh-token', purpose: 'Perbarui sesi login secara otomatis', duration: '7 hari', type: 'Esensial' },
                  { name: 'ervo-theme', purpose: 'Simpan preferensi dark/light mode', duration: '1 tahun', type: 'Preferensi' },
                  { name: 'pwa_prompt_dismissed', purpose: 'Ingat pilihan "jangan tampilkan lagi" untuk prompt install PWA', duration: 'Sesi', type: 'Preferensi' },
                  { name: '__session', purpose: 'Manajemen sesi pengguna yang aktif', duration: 'Sesi', type: 'Esensial' },
                ].map((row, i) => (
                  <tr key={i} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 pl-5 pr-4 font-mono text-xs text-[#011e4b] font-semibold">{row.name}</td>
                    <td className="py-3.5 px-4 text-slate-600">{row.purpose}</td>
                    <td className="py-3.5 px-4 text-slate-500">{row.duration}</td>
                    <td className="py-3.5 px-4">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${row.type === 'Esensial' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {row.type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* How to manage */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-5">Cara Mengelola Cookie</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-slate-800 mb-2">Melalui Browser</h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">Anda dapat mengatur, membatasi, atau menghapus cookie melalui pengaturan browser Anda:</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  ['Google Chrome', 'Settings → Privacy → Cookies and other site data'],
                  ['Mozilla Firefox', 'Options → Privacy & Security → Cookies and Site Data'],
                  ['Safari', 'Preferences → Privacy → Manage Website Data'],
                  ['Microsoft Edge', 'Settings → Cookies and site permissions'],
                ].map(([browser, path]) => (
                  <div key={browser} className="bg-slate-50 rounded-lg p-3">
                    <p className="font-semibold text-xs text-slate-700">{browser}</p>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">{path}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <p className="text-sm text-amber-800 leading-relaxed">
                <strong>Perhatian:</strong> Menonaktifkan cookie esensial akan mencegah Anda login ke platform. Cookie preferensi dan analitik dapat dinonaktifkan tanpa mempengaruhi fungsi utama platform.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-800 mb-2">Melalui Platform Ervo</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Cookie preferensi (seperti dark mode) dapat di-reset dengan menghapus data lokal browser atau melalui menu pengaturan di profil akun Anda. Untuk permintaan penghapusan data lengkap, kirimkan permintaan ke <a href="mailto:privacy@ervo.id" className="text-[#011e4b] font-semibold underline">privacy@ervo.id</a>.
              </p>
            </div>
          </div>
        </div>

        {/* Updates */}
        <div className="bg-slate-100 rounded-2xl p-5 border border-slate-200">
          <h3 className="font-bold text-slate-800 mb-2">Pembaruan Kebijakan Cookie</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Kami dapat memperbarui kebijakan cookie ini dari waktu ke waktu untuk mencerminkan perubahan teknologi atau praktik kami. Perubahan signifikan akan dikomunikasikan melalui notifikasi dalam aplikasi. Tanggal "Berlaku Sejak" di atas selalu menunjukkan versi terbaru.
          </p>
        </div>

        <div className="bg-[#011e4b] rounded-2xl p-6 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold">Pertanyaan tentang cookie atau privasi?</p>
            <p className="text-white/70 text-sm mt-1">Tim privasi kami siap membantu.</p>
          </div>
          <a href="mailto:privacy@ervo.id" className="flex items-center gap-2 bg-white text-[#011e4b] font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-slate-100 transition-colors shrink-0">
            <Mail className="h-4 w-4" /> privacy@ervo.id
          </a>
        </div>

        <p className="text-center text-xs text-slate-400">Kebijakan Cookie terakhir diperbarui {LAST_UPDATED} · Ervo ERP</p>
      </main>
    </div>
  );
}
