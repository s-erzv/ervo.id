import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Shield, CreditCard, Users, AlertTriangle, RefreshCw, Mail } from 'lucide-react';

const LAST_UPDATED = 'Juni 2025';

const Section = ({ icon: Icon, title, children }) => (
  <section className="mb-10">
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 bg-[#011e4b]/10 rounded-xl">
        <Icon className="h-5 w-5 text-[#011e4b]" />
      </div>
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
    </div>
    <div className="pl-12 space-y-3 text-slate-600 leading-relaxed">{children}</div>
  </section>
);

const Clause = ({ num, title, text }) => (
  <div className="mb-5">
    <h3 className="font-semibold text-slate-800 mb-1.5">{num}. {title}</h3>
    <p className="text-sm leading-relaxed">{text}</p>
  </div>
);

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top nav */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#011e4b] transition-colors">
            <ArrowLeft className="h-4 w-4" /> Kembali ke Beranda
          </Link>
          <img src="/header.svg" alt="Ervo" className="h-8" onError={e => e.target.style.display='none'} />
          <div className="flex gap-4 text-xs text-slate-400">
            <Link to="/sla" className="hover:text-[#011e4b]">SLA</Link>
            <Link to="/security" className="hover:text-[#011e4b]">Keamanan</Link>
            <Link to="/cookies" className="hover:text-[#011e4b]">Cookie</Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Hero */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 bg-[#011e4b] text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full mb-4">
            <FileText className="h-3.5 w-3.5" /> Dokumen Hukum
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-3">Ketentuan Penggunaan</h1>
          <p className="text-slate-500 text-lg">Terms of Service yang mengatur penggunaan platform Ervo ERP.</p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-400">
            <span>Versi: 2.0</span>
            <span>·</span>
            <span>Berlaku sejak: {LAST_UPDATED}</span>
            <span>·</span>
            <span>Berlaku untuk semua paket langganan</span>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-10 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 leading-relaxed">
            Dengan mendaftar atau menggunakan layanan Ervo ERP, Anda menyatakan telah membaca, memahami, dan menyetujui seluruh ketentuan yang tercantum dalam dokumen ini. Harap baca seluruhnya sebelum menggunakan platform.
          </p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-2">

          <Section icon={FileText} title="1. Definisi & Ruang Lingkup">
            <Clause num="1.1" title="Platform" text="Platform Ervo ERP adalah sistem perangkat lunak berbasis web (SaaS) yang dikelola oleh tim Ervo untuk mendukung operasional bisnis distribusi, termasuk manajemen pesanan, inventaris, keuangan, dan pelanggan." />
            <Clause num="1.2" title="Tenant / Pelanggan" text="Adalah perusahaan atau individu yang mendaftar dan berlangganan layanan Ervo ERP. Setiap tenant memiliki ruang data yang terisolasi secara penuh." />
            <Clause num="1.3" title="Pengguna" text="Adalah individu (karyawan, kurir, dropshipper, atau admin) yang diberi akses ke platform oleh Tenant. Tenant bertanggung jawab atas semua aktivitas pengguna yang terdaftar di akunnya." />
            <Clause num="1.4" title="Konten" text="Segala data, dokumen, laporan, dan informasi yang dibuat, diunggah, atau dihasilkan oleh Tenant melalui platform Ervo." />
          </Section>

          <Section icon={Shield} title="2. Hak & Kepemilikan Data">
            <Clause num="2.1" title="Kepemilikan Tenant" text="Seluruh data yang dimasukkan dan dihasilkan oleh Tenant dalam platform Ervo adalah milik eksklusif Tenant tersebut. Ervo tidak mengklaim kepemilikan atas data bisnis Anda." />
            <Clause num="2.2" title="Hak Penggunaan Platform" text="Ervo memberikan lisensi non-eksklusif, non-transferable, dan terbatas untuk menggunakan platform selama masa berlangganan yang aktif." />
            <Clause num="2.3" title="Konten Pihak Ketiga" text="Ervo tidak bertanggung jawab atas konten yang diunggah Tenant. Tenant bertanggung jawab memastikan konten yang diunggah tidak melanggar hak kekayaan intelektual atau peraturan yang berlaku." />
          </Section>

          <Section icon={Users} title="3. Tanggung Jawab Pengguna">
            <Clause num="3.1" title="Keamanan Akun" text="Tenant wajib menjaga kerahasiaan kredensial login dan bertanggung jawab atas semua aktivitas yang terjadi di bawah akun mereka, termasuk aktivitas pengguna yang ditambahkan oleh Tenant." />
            <Clause num="3.2" title="Kebenaran Data" text="Tenant bertanggung jawab atas keakuratan dan kelengkapan data yang diinputkan ke dalam sistem. Ervo tidak bertanggung jawab atas keputusan bisnis yang dibuat berdasarkan data tidak akurat." />
            <Clause num="3.3" title="Penggunaan yang Diizinkan" text="Platform hanya boleh digunakan untuk keperluan operasional bisnis yang sah. Dilarang menggunakan platform untuk tujuan ilegal, menyebarkan malware, melakukan scraping data tanpa izin, atau merugikan pengguna lain." />
            <Clause num="3.4" title="Batasan Pengguna" text="Jumlah pengguna aktif per tenant dibatasi sesuai paket langganan yang dipilih. Penambahan pengguna di luar batas paket memerlukan upgrade paket." />
          </Section>

          <Section icon={CreditCard} title="4. Langganan & Pembayaran">
            <Clause num="4.1" title="Sifat Pembayaran" text="Seluruh pembayaran langganan bersifat prabayar dan non-refundable setelah akses berhasil diaktifkan. Tidak ada pengembalian dana (refund) untuk masa langganan yang belum habis jika tenant memilih berhenti lebih awal." />
            <Clause num="4.2" title="Perpanjangan" text="Tenant wajib melakukan pembayaran sebelum masa langganan berakhir untuk menghindari gangguan akses. Ervo tidak menjamin pemberitahuan otomatis, meskipun kami berusaha mengirimkan pengingat." />
            <Clause num="4.3" title="Harga & Perubahan" text="Harga paket dapat berubah dengan pemberitahuan minimal 30 hari sebelum berlaku. Harga yang sudah disepakati berlaku hingga akhir periode langganan yang berjalan." />
            <Clause num="4.4" title="Penghentian Akses" text="Ervo berhak menangguhkan akses jika pembayaran terlambat lebih dari 7 hari kalender setelah tanggal jatuh tempo. Data tenant akan tetap disimpan selama 30 hari setelah penangguhan." />
          </Section>

          <Section icon={AlertTriangle} title="5. Pembatasan Tanggung Jawab">
            <Clause num="5.1" title="Garansi Layanan" text='Ervo menyediakan platform "sebagaimana adanya" dengan uptime target 99.5%. Namun Ervo tidak menjamin layanan bebas dari gangguan, kesalahan, atau keamanan yang sempurna.' />
            <Clause num="5.2" title="Batasan Ganti Rugi" text="Dalam hal terjadi kerugian akibat gangguan layanan, tanggung jawab Ervo terbatas pada nilai perpanjangan langganan proporsional sesuai durasi gangguan yang terdokumentasi." />
            <Clause num="5.3" title="Force Majeure" text="Ervo tidak bertanggung jawab atas kegagalan layanan akibat kejadian di luar kendali yang wajar, termasuk namun tidak terbatas pada: bencana alam, pemadaman internet global, kebijakan pemerintah, atau serangan siber berskala besar." />
          </Section>

          <Section icon={RefreshCw} title="6. Perubahan & Penghentian">
            <Clause num="6.1" title="Perubahan Ketentuan" text="Ervo berhak memperbarui ketentuan ini kapan saja. Perubahan material akan dikomunikasikan melalui email terdaftar dan notifikasi dalam aplikasi minimal 30 hari sebelum berlaku." />
            <Clause num="6.2" title="Penghentian oleh Tenant" text="Tenant dapat menghentikan langganan kapan saja tanpa denda. Data akan tetap tersedia selama 30 hari setelah penghentian untuk keperluan ekspor, sebelum dihapus permanen." />
            <Clause num="6.3" title="Penghentian oleh Ervo" text="Ervo berhak menghentikan akun yang melanggar ketentuan ini dengan pemberitahuan tertulis. Pelanggaran berat (misal: penyalahgunaan, penipuan) dapat mengakibatkan penghentian segera tanpa pemberitahuan." />
            <Clause num="6.4" title="Hukum yang Berlaku" text="Ketentuan ini tunduk pada hukum Negara Kesatuan Republik Indonesia. Sengketa akan diselesaikan melalui musyawarah dan, jika diperlukan, melalui Pengadilan Negeri Jakarta Selatan." />
          </Section>

        </div>

        {/* Contact */}
        <div className="mt-8 bg-[#011e4b] rounded-2xl p-6 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold">Ada pertanyaan tentang ketentuan ini?</p>
            <p className="text-white/70 text-sm mt-1">Tim legal kami siap membantu menjelaskan poin-poin yang kurang jelas.</p>
          </div>
          <a href="mailto:legal@ervo.id" className="flex items-center gap-2 bg-white text-[#011e4b] font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-slate-100 transition-colors shrink-0">
            <Mail className="h-4 w-4" /> legal@ervo.id
          </a>
        </div>

        <p className="text-center text-xs text-slate-400 mt-8">Dokumen ini terakhir diperbarui {LAST_UPDATED} · Ervo ERP · Semua hak dilindungi</p>
      </main>
    </div>
  );
}
