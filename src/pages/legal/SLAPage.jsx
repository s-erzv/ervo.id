import { Link } from 'react-router-dom';
import { ArrowLeft, Activity, Clock, AlertCircle, CheckCircle2, Zap, RefreshCw, Mail } from 'lucide-react';

const LAST_UPDATED = 'Juni 2025';

const MetricCard = ({ value, label, sub, color = 'text-[#011e4b]' }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm text-center">
    <p className={`text-4xl font-bold ${color}`}>{value}</p>
    <p className="text-slate-800 font-semibold mt-2 text-sm">{label}</p>
    {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
  </div>
);

const TierRow = ({ priority, response, resolution, example }) => (
  <tr className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
    <td className="py-3.5 px-5 font-semibold text-slate-800 text-sm">{priority}</td>
    <td className="py-3.5 px-4 text-slate-600 text-sm">{response}</td>
    <td className="py-3.5 px-4 text-slate-600 text-sm">{resolution}</td>
    <td className="py-3.5 px-4 text-slate-500 text-sm">{example}</td>
  </tr>
);

export default function SLAPage() {
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
            <Link to="/security" className="hover:text-[#011e4b]">Keamanan</Link>
            <Link to="/cookies" className="hover:text-[#011e4b]">Cookie</Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-10">
        {/* Hero */}
        <div>
          <div className="inline-flex items-center gap-2 bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full mb-4">
            <Activity className="h-3.5 w-3.5" /> Service Level Agreement
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-3">SLA & Uptime</h1>
          <p className="text-slate-500 text-lg">Komitmen tertulis kami terhadap ketersediaan, kinerja, dan dukungan platform Ervo ERP.</p>
          <p className="text-sm text-slate-400 mt-3">Berlaku sejak: {LAST_UPDATED} · Versi 1.2</p>
        </div>

        {/* Uptime commitment */}
        <div className="bg-gradient-to-br from-[#011e4b] to-[#0336a0] rounded-2xl p-8 text-white">
          <p className="text-white/70 text-sm font-semibold uppercase tracking-wider mb-2">Komitmen Utama</p>
          <h2 className="text-3xl font-bold mb-1">Uptime 99.5% per Bulan</h2>
          <p className="text-white/70 leading-relaxed max-w-2xl">
            Ervo berkomitmen menjaga ketersediaan platform minimal 99.5% dalam setiap bulan kalender. Ini setara dengan maksimum downtime ~3.6 jam per bulan. Jika komitmen tidak terpenuhi, tenant berhak mendapat kompensasi.
          </p>
        </div>

        {/* Key metrics */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-5">Metrik Kinerja</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard value="99.5%" label="Uptime SLA" sub="Per bulan kalender" color="text-emerald-600" />
            <MetricCard value="< 4 jam" label="RTO" sub="Recovery Time Objective" color="text-blue-600" />
            <MetricCard value="< 24 jam" label="RPO" sub="Recovery Point Objective" color="text-purple-600" />
            <MetricCard value="< 2 jam" label="Respons Insiden P1" sub="Prioritas kritis" color="text-amber-600" />
          </div>
        </div>

        {/* Definisi downtime */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Clock className="h-5 w-5 text-slate-500" /> Definisi Downtime
          </h2>
          <div className="space-y-4">
            {[
              { title: 'Downtime Terhitung', desc: 'Kondisi di mana platform tidak dapat diakses sama sekali oleh seluruh tenant selama lebih dari 5 menit berturut-turut, dikonfirmasi melalui sistem monitoring Ervo.', type: 'counted' },
              { title: 'Tidak Terhitung sebagai Downtime', desc: 'Pemeliharaan terjadwal (dengan pemberitahuan ≥ 24 jam sebelumnya), gangguan yang disebabkan oleh faktor di luar kendali Ervo (force majeure), gangguan jaringan internet milik tenant, atau gangguan pada layanan pihak ketiga (DNS, CDN).', type: 'not-counted' },
            ].map(item => (
              <div key={item.title} className={`flex gap-3 p-4 rounded-xl ${item.type === 'counted' ? 'bg-red-50 border border-red-100' : 'bg-emerald-50 border border-emerald-100'}`}>
                {item.type === 'counted'
                  ? <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  : <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />}
                <div>
                  <p className={`font-semibold text-sm ${item.type === 'counted' ? 'text-red-800' : 'text-emerald-800'}`}>{item.title}</p>
                  <p className={`text-sm mt-1 leading-relaxed ${item.type === 'counted' ? 'text-red-700' : 'text-emerald-700'}`}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Response time tiers */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" /> Waktu Respons Dukungan
            </h2>
            <p className="text-slate-500 text-sm mt-1">Waktu respons dihitung sejak laporan masuk melalui kanal resmi (WhatsApp atau email).</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  {['Prioritas', 'Target Respons', 'Target Resolusi', 'Contoh Insiden'].map(h => (
                    <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider first:pl-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <TierRow priority="P1 — Kritis" response="< 2 jam" resolution="< 8 jam" example="Platform tidak bisa diakses, data loss" />
                <TierRow priority="P2 — Tinggi" response="< 8 jam" resolution="< 24 jam" example="Fitur utama error, tidak bisa submit order" />
                <TierRow priority="P3 — Sedang" response="< 1 hari kerja" resolution="< 3 hari kerja" example="Bug minor, tampilan tidak sesuai" />
                <TierRow priority="P4 — Rendah" response="< 3 hari kerja" resolution="Jadwal sprint" example="Permintaan fitur baru, optimisasi" />
              </tbody>
            </table>
          </div>
          <div className="bg-slate-50 px-5 py-3 text-xs text-slate-400 border-t border-slate-100">
            Jam operasional dukungan: Senin–Jumat 08.00–17.00 WIB. Insiden P1 ditangani 24/7.
          </div>
        </div>

        {/* Maintenance */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-5">
            <RefreshCw className="h-5 w-5 text-blue-500" /> Pemeliharaan Terjadwal
          </h2>
          <div className="grid sm:grid-cols-2 gap-5">
            {[
              { title: 'Pemeliharaan Rutin', desc: 'Dilakukan setiap Minggu pukul 02.00–04.00 WIB (opsional, tidak selalu dilakukan). Pemberitahuan dikirimkan minimal 24 jam sebelumnya melalui notifikasi dalam aplikasi.' },
              { title: 'Pemeliharaan Darurat', desc: 'Dilakukan jika ditemukan celah keamanan atau bug kritis. Kami berupaya meminimalkan durasi dan memberitahu tenant secepat mungkin.' },
              { title: 'Update Fitur', desc: 'Deployment fitur baru dilakukan pada jam rendah-aktivitas (malam/dini hari) untuk meminimalkan dampak ke operasional tenant.' },
              { title: 'Migrasi Database', desc: 'Migrasi besar dijadwalkan jauh hari dengan pemberitahuan minimal 7 hari kerja dan periode rollback tersedia selama 48 jam.' },
            ].map(item => (
              <div key={item.title} className="flex gap-3">
                <div className="w-1.5 bg-[#011e4b]/20 rounded-full shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-sm text-slate-800">{item.title}</p>
                  <p className="text-sm text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Kompensasi */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <div className="flex gap-3">
            <AlertCircle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-amber-900 mb-2">Skema Kompensasi Downtime</h3>
              <div className="space-y-2 text-sm text-amber-800">
                <p>Jika uptime bulanan aktual di bawah 99.5%, Ervo memberikan kompensasi dalam bentuk perpanjangan masa langganan:</p>
                <ul className="mt-3 space-y-1 ml-4">
                  {[
                    ['99.0% – 99.4%', '+3 hari perpanjangan'],
                    ['98.0% – 98.9%', '+7 hari perpanjangan'],
                    ['95.0% – 97.9%', '+15 hari perpanjangan'],
                    ['< 95.0%', '+30 hari perpanjangan'],
                  ].map(([range, comp]) => (
                    <li key={range} className="flex gap-3">
                      <span className="font-semibold min-w-[150px]">{range}</span>
                      <span>{comp}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3">Klaim kompensasi diajukan melalui <a href="mailto:support@ervo.id" className="font-semibold underline">support@ervo.id</a> dalam 14 hari setelah insiden terdokumentasi.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#011e4b] rounded-2xl p-6 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold">Laporkan gangguan layanan</p>
            <p className="text-white/70 text-sm mt-1">Untuk insiden P1/P2, hubungi kami segera melalui WhatsApp.</p>
          </div>
          <a href="mailto:support@ervo.id" className="flex items-center gap-2 bg-white text-[#011e4b] font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-slate-100 transition-colors shrink-0">
            <Mail className="h-4 w-4" /> support@ervo.id
          </a>
        </div>

        <p className="text-center text-xs text-slate-400">SLA ini terakhir diperbarui {LAST_UPDATED} · Ervo ERP</p>
      </main>
    </div>
  );
}
