import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, Database, Eye, Key, Server, RefreshCw, Mail } from 'lucide-react';

const LAST_UPDATED = 'Juni 2025';

const SecurityCard = ({ icon: Icon, title, desc, color = '#011e4b', bg = '#f0f5fa' }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all">
    <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: bg }}>
      <Icon className="h-5 w-5" style={{ color }} />
    </div>
    <h3 className="font-bold text-slate-900 mb-2">{title}</h3>
    <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
  </div>
);

export default function SecurityPage() {
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
            <Link to="/cookies" className="hover:text-[#011e4b]">Cookie</Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-10">
        {/* Hero */}
        <div>
          <div className="inline-flex items-center gap-2 bg-[#011e4b] text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full mb-4">
            <Shield className="h-3.5 w-3.5" /> Kebijakan Keamanan
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-3">Keamanan Data</h1>
          <p className="text-slate-500 text-lg">Bagaimana kami melindungi data bisnis Anda dengan standar keamanan enterprise.</p>
          <p className="text-sm text-slate-400 mt-3">Berlaku sejak: {LAST_UPDATED} · Berlaku untuk semua tenant</p>
        </div>

        {/* Commitment statement */}
        <div className="bg-gradient-to-br from-[#011e4b] to-[#0336a0] rounded-2xl p-8 text-white">
          <h2 className="text-2xl font-bold mb-3">Komitmen Keamanan Kami</h2>
          <p className="text-white/80 leading-relaxed">
            Data bisnis Anda adalah aset paling berharga. Kami menerapkan lapisan keamanan berlapis — mulai dari enkripsi tingkat database, isolasi data antar tenant, hingga pemantauan aktif 24/7 — untuk memastikan tidak ada akses tidak sah yang bisa terjadi.
          </p>
        </div>

        {/* Security features grid */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-5">Fitur Keamanan Platform</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <SecurityCard icon={Lock} title="Enkripsi AES-256" color="#3b82f6" bg="#eff6ff"
              desc="Semua data dienkripsi menggunakan AES-256 baik saat transit (TLS 1.3) maupun saat tersimpan di database. Password tidak disimpan dalam bentuk plain-text — hanya hash bcrypt." />
            <SecurityCard icon={Database} title="Isolasi Data Multi-Tenant" color="#10b981" bg="#f0fdf4"
              desc="Setiap tenant memiliki namespace data yang terisolasi penuh menggunakan Row Level Security (RLS) di tingkat PostgreSQL. Tidak ada data antar tenant yang bisa saling diakses." />
            <SecurityCard icon={Key} title="Autentikasi Berlapis" color="#8b5cf6" bg="#f5f3ff"
              desc="Sistem autentikasi berbasis JWT dengan expiry token yang ketat. Session management yang aman dengan refresh token rotation untuk mencegah session hijacking." />
            <SecurityCard icon={Eye} title="Audit Trail & Logging" color="#f59e0b" bg="#fffbeb"
              desc="Setiap aksi pengguna (login, perubahan data, akses halaman sensitif) dicatat dengan timestamp, user ID, IP address, dan detail perubahan. Log disimpan minimal 90 hari." />
            <SecurityCard icon={Server} title="Infrastruktur Cloud Terpercaya" color="#06b6d4" bg="#ecfeff"
              desc="Platform berjalan di atas Supabase (PostgreSQL terkelola) dengan infrastruktur yang memenuhi standar SOC 2 Type II dan ISO 27001. Data center berlokasi di Asia Tenggara." />
            <SecurityCard icon={RefreshCw} title="Backup Otomatis Harian" color="#f97316" bg="#fff7ed"
              desc="Data di-backup setiap 24 jam ke storage terpisah secara geografis. Backup diuji secara berkala untuk memastikan integritas data. RPO < 24 jam, RTO < 4 jam." />
            <SecurityCard icon={Shield} title="Pemantauan Keamanan Aktif" color="#ef4444" bg="#fef2f2"
              desc="Sistem pemantauan anomali aktif 24/7 untuk mendeteksi akses mencurigakan, brute force, dan pola penggunaan tidak wajar. Alert otomatis ke tim keamanan kami." />
            <SecurityCard icon={Lock} title="Kontrol Akses Berbasis Peran" color="#64748b" bg="#f8fafc"
              desc="RBAC (Role-Based Access Control) yang granular: Super Admin, Admin, Kurir/Staff, dan Dropshipper masing-masing memiliki izin akses yang berbeda sesuai kebutuhan operasional." />
          </div>
        </div>

        {/* Data handling */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-5">Penanganan Data Pribadi</h2>
          <div className="space-y-5">
            {[
              {
                title: 'Data yang Kami Kumpulkan',
                points: [
                  'Informasi akun: nama, email, nomor telepon, peran pengguna',
                  'Data bisnis operasional: pesanan, produk, pelanggan, keuangan — milik Tenant',
                  'Data teknis: log akses, IP address, jenis browser untuk keamanan',
                  'Data pembayaran: hanya bukti transfer (tidak menyimpan kartu kredit/debit)',
                ]
              },
              {
                title: 'Penggunaan Data',
                points: [
                  'Menjalankan dan meningkatkan layanan platform',
                  'Mengirimkan notifikasi terkait akun dan layanan',
                  'Mendeteksi dan mencegah penipuan atau penyalahgunaan',
                  'Mematuhi kewajiban hukum yang berlaku di Indonesia',
                ]
              },
              {
                title: 'Tidak Pernah Kami Lakukan',
                points: [
                  'Menjual data Anda ke pihak ketiga',
                  'Menggunakan data bisnis Anda untuk keperluan komersial Ervo',
                  'Memberikan akses ke data Anda tanpa izin eksplisit',
                  'Menyimpan kredensial pembayaran elektronik',
                ]
              },
            ].map(section => (
              <div key={section.title}>
                <h3 className="font-semibold text-slate-800 mb-2 text-sm">{section.title}</h3>
                <ul className="space-y-1.5">
                  {section.points.map(p => (
                    <li key={p} className="flex gap-2 text-sm text-slate-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#011e4b]/40 mt-2 shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Incident response */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-5">Prosedur Insiden Keamanan</h2>
          <div className="space-y-4">
            {[
              { step: '01', title: 'Deteksi & Klasifikasi', desc: 'Insiden keamanan dideteksi melalui sistem monitoring otomatis atau laporan dari pengguna. Tim keamanan mengklasifikasikan tingkat keparahan dalam 30 menit.' },
              { step: '02', title: 'Containment & Investigasi', desc: 'Langkah mitigasi segera diambil untuk mencegah penyebaran. Investigasi forensik dilakukan untuk memahami akar masalah dan dampak.' },
              { step: '03', title: 'Notifikasi Tenant', desc: 'Jika insiden berdampak pada data tenant, kami akan menginformasikan dalam 72 jam melalui email terdaftar, sesuai ketentuan hukum perlindungan data yang berlaku.' },
              { step: '04', title: 'Pemulihan & Post-Mortem', desc: 'Setelah insiden teratasi, kami menerbitkan laporan post-mortem yang mencakup kronologi, dampak, tindakan yang diambil, dan langkah pencegahan ke depan.' },
            ].map(item => (
              <div key={item.step} className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#011e4b] text-white font-bold text-sm flex items-center justify-center shrink-0">{item.step}</div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{item.title}</p>
                  <p className="text-sm text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Responsible disclosure */}
        <div className="bg-slate-100 rounded-2xl p-6 border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
            <Shield className="h-4 w-4 text-slate-600" /> Responsible Disclosure
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Jika Anda menemukan celah keamanan pada platform kami, kami mengundang Anda untuk melaporkannya secara bertanggung jawab ke <a href="mailto:security@ervo.id" className="text-[#011e4b] font-semibold underline">security@ervo.id</a>.
            Kami berkomitmen untuk merespons dalam 48 jam kerja dan tidak mengambil tindakan hukum terhadap peneliti keamanan yang beritikad baik.
          </p>
        </div>

        <div className="bg-[#011e4b] rounded-2xl p-6 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold">Pertanyaan tentang keamanan data Anda?</p>
            <p className="text-white/70 text-sm mt-1">Tim keamanan kami siap menjelaskan detail teknis lebih lanjut.</p>
          </div>
          <a href="mailto:security@ervo.id" className="flex items-center gap-2 bg-white text-[#011e4b] font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-slate-100 transition-colors shrink-0">
            <Mail className="h-4 w-4" /> security@ervo.id
          </a>
        </div>

        <p className="text-center text-xs text-slate-400">Kebijakan Keamanan terakhir diperbarui {LAST_UPDATED} · Ervo ERP</p>
      </main>
    </div>
  );
}
