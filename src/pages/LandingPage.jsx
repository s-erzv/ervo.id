import React, { useState, useEffect, useRef } from 'react';

// ─── ICONS ───────────────────────────────────────────────────────────────────
const Ico = ({ d, size = 16, sw = 1.75 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const IC = {
  truck:   "M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM18.5 21a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
  box:     "M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z",
  chart:   "M18 20V10M12 20V4M6 20v-6",
  users:   "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
  cpu:     "M9 2H7a2 2 0 00-2 2v2M9 2h6M15 2h2a2 2 0 012 2v2M22 9V7M22 15v2a2 2 0 01-2 2h-2M15 22H9M9 22H7a2 2 0 01-2-2v-2M2 15v-6M2 9V7a2 2 0 012-2h2M9 9h6v6H9z",
  trend:   "M23 6l-9.5 9.5-5-5L1 18M17 6h6v6",
  zap:     "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  shield:  "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  life:    "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M14.83 9.17l4.24-4.24M4.93 19.07l4.24-4.24",
  check:   "M20 6L9 17l-5-5",
  arrow:   "M5 12h14M12 5l7 7-7 7",
  msg:     "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  menu:    "M3 12h18M3 6h18M3 18h18",
  x:       "M18 6L6 18M6 6l12 12",
};

// ─── DATA ────────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon:'truck', tag:'Operasional', title:'Manajemen Pengiriman Presisi', desc:'Pantau status pengiriman dari persiapan hingga diterima pelanggan secara real-time. Hilangkan risiko pesanan terselip.' },
  { icon:'box',   tag:'Logistik',    title:'Inventaris & Stok Akurat',     desc:'Pantau mutasi stok di berbagai lokasi secara otomatis. Notifikasi instan saat stok menipis.' },
  { icon:'chart', tag:'Akuntansi',   title:'Laporan Keuangan Otomatis',    desc:'Generate laporan laba rugi, neraca, dan arus kas dalam hitungan detik. Semua transaksi tersinkronisasi.' },
  { icon:'users', tag:'CRM',         title:'Database Pelanggan Terpadu',   desc:'Kelola riwayat pesanan dan limit piutang pelanggan dengan mudah. Bangun loyalitas berbasis data akurat.' },
  { icon:'cpu',   tag:'Efisien',     title:'Otomasi Alur Kerja',           desc:'Kurangi beban admin dengan sistem serba otomatis. Dari penagihan hingga perhitungan komisi driver.' },
  { icon:'trend', tag:'Strategi',    title:'Analisis Bisnis Mendalam',     desc:'Pahami produk terlaris dan tren penjualan melalui dashboard intuitif. Keputusan berbasis data nyata.' },
];

const WHY = [
  { icon:'zap',    title:'Performa Cepat & Ringan',   desc:'Berjalan lancar dengan koneksi internet terbatas di lapangan. Admin dan driver tetap produktif.' },
  { icon:'life',   title:'Bantuan Teknis Langsung',   desc:'Tidak ada tiket yang lama. Tim support tersedia langsung via WhatsApp secara real-time.' },
  { icon:'shield', title:'Keamanan Data Korporasi',   desc:'Data dienkripsi dengan standar industri dan di-backup otomatis. Aset paling berharga Anda terlindungi.' },
  { icon:'chart',  title:'Audit Trail Terperinci',    desc:'Setiap perubahan data tercatat rapi. Mudah menelusuri selisih atau kesalahan input oleh staff.' },
];

const PLANS = [
  {
    name:'Starter', price:'1.500', period:'/bulan',
    desc:'Esensial untuk depot tunggal atau bisnis rintisan.',
    features:['Hingga 2 pengguna','Laporan dasar otomatis','Dashboard ringkasan harian','Support via WhatsApp'],
    cta:'Coba Gratis Sekarang', popular:false,
  },
  {
    name:'Growth', price:'3.000', period:'/bulan',
    desc:'Pilihan tepat untuk distributor skala menengah.',
    features:['Hingga 10 pengguna','Laporan lengkap & ekspor Excel/PDF','Multi-gudang & stok barang','Pelacakan konsumen (Maps)','Audit trail lengkap','Support prioritas'],
    cta:'Mulai Gratis 14 Hari', popular:true,
  },
  {
    name:'Enterprise', price:'Custom', period:'',
    desc:'Solusi kustom untuk korporasi volume tinggi.',
    features:['Pengguna tak terbatas','Kustomisasi alur kerja','Account manager khusus','SLA uptime 99.9%','Integrasi API eksternal'],
    cta:'Hubungi Sales', popular:false,
  },
];

const TESTIMONIALS = [
  { name:'Budi Santoso',    role:'Owner, CV Maju Jaya Distribusi',         avatar:'BS', content:'Dulu laporan keuangan butuh waktu seharian, sekarang cukup satu klik. Akurasinya luar biasa, sangat membantu audit internal.' },
  { name:'Siti Rahmawati',  role:'Manager Operasional, PT Sinar Mas Grosir', avatar:'SR', content:'Tim lapangan jadi lebih disiplin karena semua terpantau di sistem. Koordinasi pengiriman jauh lebih lancar dibanding manual.' },
  { name:'Andi Wijaya',     role:'Pemilik, Grosir Wijaya',                 avatar:'AW', content:'Aplikasi yang sangat mudah dipahami. Staff yang tidak terbiasa teknologi pun langsung bisa pakai tanpa pelatihan.' },
];

const STATS = [
  { val:'500+', label:'Bisnis Aktif' },
  { val:'1Jt+', label:'Transaksi Aman' },
  { val:'98%',  label:'Peningkatan Efisiensi' },
  { val:'24/7', label:'Bantuan Teknis' },
];

const FOOTER_LINKS = [
  { title:'Produk',     links:['Fitur Utama','Harga Paket','Cara Kerja','FAQ'] },
  { title:'Perusahaan', links:['Tentang Kami','Blog Bisnis','Kebijakan Privasi','Kontak'] },
  { title:'Support',    links:['Pusat Bantuan','WhatsApp Teknis','Status Sistem'] },
];

const BAR_HEIGHTS = [55, 72, 60, 85, 68, 96, 78];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const WA_URL = 'https://api.whatsapp.com/send?phone=6285117677245';

const CSS_RULES = `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { -webkit-font-smoothing: antialiased; }

  .desktop-only { display: flex !important; }
  .mobile-only  { display: none !important; }

  @media (max-width: 768px) {
    .desktop-only { display: none !important; }
    .mobile-only  { display: flex !important; }
    .dash-sidebar { display: none !important; }
  }

  .nav-link:hover { color: #0f172a !important; }
  .btn-primary-hover:hover { opacity: 0.85; transform: translateY(-1px); }
  .btn-hero-primary-hover:hover { transform: translateY(-2px); box-shadow: 0 22px 35px -5px rgba(15,23,42,0.35) !important; }
  .btn-hero-secondary-hover:hover { background: #f8fafc !important; }
  .feat-card:hover { background: #fafafa !important; }
  .why-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.07); }
  .plan-btn:hover { opacity: 0.85; }
  .btn-cta-white-hover:hover { opacity: 0.9; }
  .btn-cta-ghost-hover:hover { background: rgba(255,255,255,0.18) !important; }
  .footer-link:hover { color: #0f172a !important; }
  .wa-fab-hover:hover { transform: scale(1.1) translateY(-4px); background: #1fba59 !important; }
  .icon-btn:hover { opacity: 0.7; }
`;

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function LandingPage() {
  const [scrolled,    setScrolled]    = useState(false);
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [visible,     setVisible]     = useState({});

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Intersection Observer for fade-in animations
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) setVisible(v => ({ ...v, [e.target.dataset.id]: true }));
      }),
      { threshold: 0.12 }
    );
    document.querySelectorAll('[data-id]').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };

  const goLogin   = () => (window.location.href = '/login');
  const openWA    = () => window.open(WA_URL, '_blank');

  const fadeIn = (id, delay = 0) => ({
    'data-id': id,
    style: {
      opacity:    visible[id] ? 1 : 0,
      transform:  visible[id] ? 'translateY(0)' : 'translateY(24px)',
      transition: `opacity 0.55s ease ${delay}s, transform 0.55s ease ${delay}s`,
    },
  });

  return (
    <div style={S.root}>
      <style>{CSS_RULES}</style>

      {/* ── NAVBAR ── */}
      <header style={{ ...S.nav, ...(scrolled ? S.navScrolled : {}) }}>
        <div style={S.navInner}>
          <div onClick={() => scrollTo('hero')} style={S.logo}>
            <div style={S.logoMark}>e</div>
            <span style={S.logoText}>ervo.id</span>
          </div>

          <nav style={S.navLinks} className="desktop-only">
            {[['fitur','Fitur'],['keunggulan','Keunggulan'],['harga','Harga'],['testimoni','Testimoni']].map(([id, label]) => (
              <button key={id} onClick={() => scrollTo(id)} style={S.navLink} className="nav-link">{label}</button>
            ))}
          </nav>

          <div style={S.navActions} className="desktop-only">
            <button onClick={goLogin} style={S.btnGhost}>Masuk</button>
            <button onClick={goLogin} style={S.btnPrimary} className="btn-primary-hover">Daftar Gratis</button>
          </div>

          <button className="mobile-only icon-btn" onClick={() => setMenuOpen(!menuOpen)} style={S.iconBtn}>
            <Ico d={menuOpen ? IC.x : IC.menu} size={24} />
          </button>
        </div>

        {menuOpen && (
          <div style={S.mobileMenu}>
            {[['fitur','Fitur'],['keunggulan','Keunggulan'],['harga','Harga'],['testimoni','Testimoni']].map(([id, label]) => (
              <button key={id} onClick={() => scrollTo(id)} style={S.mobileLink}>{label}</button>
            ))}
            <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginTop:'16px' }}>
              <button onClick={goLogin} style={{ ...S.btnGhost, width:'100%', padding:'12px' }}>Masuk</button>
              <button onClick={goLogin} style={{ ...S.btnPrimary, width:'100%', padding:'12px' }}>Daftar Gratis</button>
            </div>
          </div>
        )}
      </header>

      {/* ── HERO ── */}
      <section id="hero" style={S.heroSection}>
        <div {...fadeIn('hero-badge')} style={S.heroBadge}>
          <span style={S.greenDot} />
          Software Manajemen Distribusi & Akuntansi All-in-One
        </div>

        <h1 {...fadeIn('hero-h1', 0.1)} style={S.heroH1}>
          Distribusi, Stok & Keuangan<br />
          <span style={S.heroMuted}>dalam Satu Sistem</span>
        </h1>

        <p {...fadeIn('hero-p', 0.2)} style={S.heroP}>
          Hentikan pencatatan manual yang memakan waktu. ervo.id menyinkronkan
          operasional lapangan dengan akuntansi kantor secara otomatis dan presisi.
        </p>

        <div {...fadeIn('hero-cta', 0.3)} style={S.heroActions}>
          <button onClick={goLogin} style={S.btnHeroPrimary} className="btn-hero-primary-hover">
            Mulai Konsultasi Gratis
            <Ico d={IC.arrow} size={16} sw={2.5} />
          </button>
          <button onClick={openWA} style={S.btnHeroSecondary} className="btn-hero-secondary-hover">
            <Ico d={IC.msg} size={16} />
            Hubungi Kami
          </button>
        </div>

        {/* Dashboard mockup */}
        <div {...fadeIn('hero-dash', 0.4)} style={S.dashWrapper}>
          <div style={S.dashFrame}>
            {/* Browser chrome */}
            <div style={S.dashChrome}>
              <div style={{ display:'flex', gap:'6px' }}>
                <span style={{ ...S.chromeDot, background:'#ff5f57' }} />
                <span style={{ ...S.chromeDot, background:'#febc2e' }} />
                <span style={{ ...S.chromeDot, background:'#28c840' }} />
              </div>
              <div style={S.chromeUrl}>app.ervo.id/dashboard</div>
              <div style={{ width:'60px' }} />
            </div>

            {/* Dashboard body */}
            <div style={S.dashBody}>
              {/* Sidebar */}
              <div style={S.dashSidebar} className="dash-sidebar">
                <div style={S.sidebarLogo}>
                  <div style={{ ...S.logoMark, width:'24px', height:'24px', fontSize:'12px' }}>e</div>
                  <span style={{ fontSize:'13px', fontWeight:600 }}>ervo.id</span>
                </div>
                {[
                  { label:'Dashboard', active:true },
                  { label:'Pengiriman' },
                  { label:'Stok & Gudang' },
                  { label:'Keuangan' },
                  { label:'Pelanggan' },
                  { label:'Laporan' },
                ].map(({ label, active }) => (
                  <div key={label} style={{ ...S.sideItem, ...(active ? S.sideItemActive : {}) }}>{label}</div>
                ))}
              </div>

              {/* Content */}
              <div style={S.dashContent}>
                <div style={S.dashTopRow}>
                  <span style={S.dashTitle}>Dashboard</span>
                  <span style={S.dashDate}>Kamis, 10 Apr 2026</span>
                </div>

                <div style={S.statsGrid}>
                  {[
                    { label:'Pengiriman hari ini', val:'148', delta:'↑ 12%', good:true },
                    { label:'Pendapatan bulan ini', val:'Rp 248jt', delta:'↑ 8.4%', good:true },
                    { label:'Pesanan aktif', val:'37', delta:'3 perlu perhatian', good:false },
                    { label:'Stok hampir habis', val:'5', delta:'Perlu restock', warn:true },
                  ].map(({ label, val, delta, good, warn }) => (
                    <div key={label} style={S.statCard}>
                      <div style={S.statLabel}>{label}</div>
                      <div style={S.statVal}>{val}</div>
                      <div style={{ ...S.statDelta, color: good ? '#22c55e' : warn ? '#f59e0b' : '#94a3b8' }}>{delta}</div>
                    </div>
                  ))}
                </div>

                <div style={S.chartCard}>
                  <div style={S.chartTitle}>Tren penjualan — 7 hari terakhir</div>
                  <div style={S.chartBars}>
                    {BAR_HEIGHTS.map((h, i) => (
                      <div key={i} style={{
                        ...S.bar,
                        height: `${h}%`,
                        background: i === 5 ? '#0f172a' : i === 6 ? '#94a3b8' : '#e2e8f0',
                      }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS STRIP ── */}
      <section style={S.statsStrip}>
        {STATS.map(({ val, label }, i) => (
          <div key={i} {...fadeIn(`stat-${i}`, i * 0.1)} style={S.statItem}>
            <div style={S.statBigNum}>{val}</div>
            <div style={S.statBigLabel}>{label}</div>
          </div>
        ))}
      </section>

      {/* ── FEATURES ── */}
      <section id="fitur" style={S.section}>
        <div style={S.sectionHead} {...fadeIn('feat-head')}>
          <SectionTag>Fitur Utama</SectionTag>
          <h2 style={S.sectionH2}>Satu Platform, Segala Kebutuhan</h2>
          <p style={S.sectionSub}>
            Operasional lapangan dan akuntansi kantor berjalan selaras dalam satu ekosistem digital.
          </p>
        </div>

        <div style={S.featGrid}>
          {FEATURES.map((f, i) => (
            <FeatCard key={i} f={f} visible={visible} fadeId={`feat-${i}`} delay={i * 0.07} />
          ))}
        </div>
      </section>

      {/* ── WHY US ── */}
      <section id="keunggulan" style={S.whySection}>
        <div style={S.sectionInner}>
          <div style={S.sectionHead} {...fadeIn('why-head')}>
            <SectionTag light>Keunggulan</SectionTag>
            <h2 style={S.sectionH2}>Kenapa Berpindah ke ervo.id?</h2>
            <p style={S.sectionSub}>
              Dirancang khusus untuk ekosistem distribusi di Indonesia dengan fokus pada kemudahan dan akurasi data.
            </p>
          </div>
          <div style={S.whyGrid}>
            {WHY.map((w, i) => (
              <div key={i} {...fadeIn(`why-${i}`, i * 0.1)} style={S.whyCard} className="why-card">
                <div style={S.whyIcon}><Ico d={IC[w.icon]} size={20} /></div>
                <h3 style={S.whyTitle}>{w.title}</h3>
                <p style={S.whyDesc}>{w.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="harga" style={S.section}>
        <div style={S.sectionHead} {...fadeIn('price-head')}>
          <SectionTag>Harga Transparan</SectionTag>
          <h2 style={S.sectionH2}>Investasi Cerdas untuk Bisnis Anda</h2>
          <p style={S.sectionSub}>Pilih paket yang sesuai skala bisnis. Tanpa biaya tersembunyi.</p>
        </div>
        <div style={S.pricingGrid}>
          {PLANS.map((plan, i) => (
            <PlanCard key={i} plan={plan} delay={i * 0.1} visible={visible} fadeId={`plan-${i}`}
              onCta={plan.name === 'Enterprise' ? openWA : goLogin} />
          ))}
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section id="testimoni" style={{ ...S.section, background:'#f8fafc' }}>
        <div style={S.sectionInner}>
          <div style={S.sectionHead} {...fadeIn('testi-head')}>
            <SectionTag>Testimoni</SectionTag>
            <h2 style={S.sectionH2}>Dipercaya Pemimpin Bisnis</h2>
          </div>
          <div style={S.testiGrid}>
            {TESTIMONIALS.map((t, i) => (
              <div key={i} {...fadeIn(`testi-${i}`, i * 0.1)} style={S.testiCard}>
                <Stars />
                <p style={S.testiQuote}>"{t.content}"</p>
                <div style={S.testiAuthor}>
                  <div style={S.avatar}>{t.avatar}</div>
                  <div>
                    <div style={S.testiName}>{t.name}</div>
                    <div style={S.testiRole}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section style={S.ctaWrapper}>
        <div {...fadeIn('cta-block')} style={S.ctaBlock}>
          <div style={S.ctaDots} />
          <div style={{ position:'relative', zIndex:1 }}>
            <h2 style={S.ctaH2}>Modernisasi Distribusi Anda Sekarang Juga</h2>
            <p style={S.ctaP}>
              Konsultasikan kebutuhan operasional Anda secara gratis. Mulai langkah pertama menuju bisnis yang lebih efisien.
            </p>
            <div style={S.ctaActions}>
              <button onClick={goLogin} style={S.btnCtaWhite} className="btn-cta-white-hover">Mulai Gratis 14 Hari</button>
              <button onClick={openWA}  style={S.btnCtaGhost} className="btn-cta-ghost-hover">Hubungi via WhatsApp</button>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={S.footer}>
        <div style={S.footerInner}>
          <div style={S.footerTop}>
            <div style={S.footerBrand}>
              <div style={S.logo}>
                <div style={S.logoMark}>e</div>
                <span style={S.logoText}>ervo.id</span>
              </div>
              <p style={S.footerTagline}>
                Solusi Mini ERP & Sistem Informasi Akuntansi untuk bisnis distribusi modern di Indonesia.
              </p>
            </div>
            {FOOTER_LINKS.map((col, i) => (
              <div key={i} style={S.footerCol}>
                <h4 style={S.footerColTitle}>{col.title}</h4>
                {col.links.map(link => (
                  <a key={link} href="#" style={S.footerLink} className="footer-link">{link}</a>
                ))}
              </div>
            ))}
          </div>
          <div style={S.footerBottom}>
            <span>© {new Date().getFullYear()} ervo.id. Dikelola secara profesional untuk kemajuan bisnis Anda.</span>
            <div style={{ display:'flex', gap:'20px' }}>
              <a href="#" style={S.footerBottomLink}>Indonesia</a>
              <a href="#" style={S.footerBottomLink}>Privacy Policy</a>
            </div>
          </div>
        </div>
      </footer>

      {/* ── WA FLOAT ── */}
      <button onClick={openWA} style={S.waFab} className="wa-fab-hover" aria-label="Konsultasi via WhatsApp">
        <Ico d={IC.msg} size={26} sw={2} />
      </button>
    </div>
  );
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────
function SectionTag({ children, light }) {
  return (
    <span style={{
      display: 'inline-block',
      fontSize: '12px', fontWeight: 700,
      letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '5px 14px', borderRadius: '100px',
      background: light ? 'white' : '#f1f5f9',
      color: '#475569',
      border: '1px solid #e2e8f0',
      marginBottom: '16px',
    }}>{children}</span>
  );
}

function Stars() {
  return (
    <div style={{ display:'flex', gap:'3px', marginBottom:'14px' }}>
      {[...Array(5)].map((_, i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

function FeatCard({ f, visible, fadeId, delay }) {
  return (
    <div data-id={fadeId} style={{
      background: '#ffffff',
      padding: '28px',
      borderRight: '0.5px solid #f1f5f9',
      borderBottom: '0.5px solid #f1f5f9',
      transition: `opacity 0.55s ease ${delay}s, transform 0.55s ease ${delay}s, background 0.2s`,
      opacity: visible[fadeId] ? 1 : 0,
      transform: visible[fadeId] ? 'translateY(0)' : 'translateY(20px)',
      cursor: 'default',
    }}
      className="feat-card"
    >
      <span style={{
        fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em',
        background: '#f1f5f9', color: '#64748b',
        padding: '3px 10px', borderRadius: '100px', display: 'inline-block', marginBottom: '14px',
      }}>{f.tag}</span>
      <div style={{
        width: '40px', height: '40px', borderRadius: '10px',
        border: '1px solid #e2e8f0', background: '#f8fafc',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#334155', marginBottom: '16px',
      }}>
        <Ico d={IC[f.icon]} size={18} />
      </div>
      <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>{f.title}</h3>
      <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.6' }}>{f.desc}</p>
    </div>
  );
}

function PlanCard({ plan, delay, visible, fadeId, onCta }) {
  return (
    <div data-id={fadeId} style={{
      borderRadius: '20px',
      padding: '32px 28px',
      display: 'flex', flexDirection: 'column', gap: '20px',
      background: plan.popular ? '#0f172a' : 'white',
      border: plan.popular ? 'none' : '1px solid #e2e8f0',
      boxShadow: plan.popular ? '0 25px 50px -12px rgba(15,23,42,0.35)' : '0 1px 3px rgba(0,0,0,0.04)',
      color: plan.popular ? 'white' : '#1e293b',
      position: 'relative',
      opacity: visible[fadeId] ? 1 : 0,
      transform: visible[fadeId] ? 'translateY(0)' : 'translateY(24px)',
      transition: `opacity 0.55s ease ${delay}s, transform 0.55s ease ${delay}s`,
    }}>
      {plan.popular && (
        <span style={{
          position: 'absolute', top: '24px', right: '24px',
          background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)',
          fontSize: '11px', fontWeight: 700, padding: '4px 12px', borderRadius: '100px',
        }}>TERPOPULER</span>
      )}
      <div>
        <div style={{ fontSize: '16px', fontWeight: 700 }}>{plan.name}</div>
        <div style={{ fontSize: '13px', marginTop: '6px', color: plan.popular ? 'rgba(255,255,255,0.55)' : '#64748b', lineHeight: '1.5' }}>{plan.desc}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
        {plan.price !== 'Custom' && <span style={{ fontSize: '14px', color: plan.popular ? 'rgba(255,255,255,0.5)' : '#94a3b8' }}>Rp</span>}
        <span style={{ fontSize: '38px', fontWeight: 700, letterSpacing: '-0.04em' }}>{plan.price}</span>
        <span style={{ fontSize: '14px', color: plan.popular ? 'rgba(255,255,255,0.5)' : '#94a3b8' }}>{plan.period}</span>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
        {plan.features.map((feat, j) => (
          <li key={j} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: plan.popular ? 'rgba(255,255,255,0.75)' : '#475569' }}>
            <span style={{
              width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
              background: plan.popular ? 'rgba(255,255,255,0.15)' : '#f1f5f9',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: plan.popular ? 'rgba(255,255,255,0.9)' : '#0f172a',
            }}>
              <Ico d={IC.check} size={10} sw={3} />
            </span>
            {feat}
          </li>
        ))}
      </ul>
      <button onClick={onCta} style={{
        padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: 700,
        cursor: 'pointer', border: plan.popular ? 'none' : '1px solid #e2e8f0',
        background: plan.popular ? 'white' : '#f8fafc',
        color: plan.popular ? '#0f172a' : '#0f172a',
        transition: 'opacity 0.2s',
      }}
        className="plan-btn"
      >{plan.cta}</button>
    </div>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const S = {
  root: {
    minHeight: '100vh',
    background: '#f8fafc',
    color: '#1e293b',
    fontFamily: "'Poppins', sans-serif",
    overflowX: 'hidden',
  },

  // NAV
  nav: {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
    transition: 'all 0.3s ease',
    background: 'transparent',
  },
  navScrolled: {
    background: 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(226,232,240,0.8)',
  },
  navInner: {
    maxWidth: '1280px', margin: '0 auto',
    padding: '0 2rem',
    height: '64px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  logo: { display:'flex', alignItems:'center', gap:'10px', cursor:'pointer', userSelect:'none' },
  logoMark: {
    width:'34px', height:'34px', borderRadius:'9px',
    background:'#0f172a',
    display:'flex', alignItems:'center', justifyContent:'center',
    fontWeight:'800', fontSize:'17px', color:'white',
  },
  logoText: { fontSize:'1.35rem', fontWeight:'800', color:'#0f172a', letterSpacing:'-0.02em' },
  navLinks: { display:'flex', alignItems:'center', gap:'2rem' },
  navLink: {
    background:'none', border:'none',
    color:'#475569', fontSize:'0.9rem', fontWeight:'600',
    cursor:'pointer', transition:'color 0.2s', padding:'4px 0',
  },
  navActions: { display:'flex', alignItems:'center', gap:'12px' },
  btnGhost: {
    background:'none', border:'none', color:'#475569',
    fontSize:'0.9rem', fontWeight:'700', cursor:'pointer',
    padding:'8px 14px', borderRadius:'8px', transition:'all 0.2s',
  },
  btnPrimary: {
    background:'#0f172a', border:'none', color:'white',
    padding:'9px 20px', borderRadius:'9px',
    fontSize:'0.9rem', fontWeight:'700', cursor:'pointer',
    transition:'all 0.2s',
  },
  iconBtn: { background:'none', border:'none', color:'#0f172a', cursor:'pointer', padding:'4px' },
  mobileMenu: {
    background:'white',
    borderTop:'1px solid #f1f5f9',
    padding:'1.5rem 2rem',
    boxShadow:'0 20px 40px rgba(0,0,0,0.1)',
  },
  mobileLink: {
    display:'block', width:'100%', textAlign:'left',
    background:'none', border:'none', color:'#1e293b',
    padding:'14px 0', fontSize:'1.05rem', fontWeight:'600',
    cursor:'pointer', borderBottom:'1px solid #f8fafc',
  },

  // HERO
  heroSection: {
    position:'relative', zIndex:1,
    minHeight:'100vh',
    display:'flex', flexDirection:'column', alignItems:'center',
    textAlign:'center',
    padding:'9rem 1.5rem 0',
    background:'#f8fafc',
  },
  heroBadge: {
    display:'inline-flex', alignItems:'center', gap:'8px',
    padding:'7px 18px', borderRadius:'100px',
    background:'white', border:'1px solid #e2e8f0',
    fontSize:'0.82rem', fontWeight:'700', color:'#334155',
    boxShadow:'0 2px 8px rgba(0,0,0,0.06)',
    marginBottom:'2.5rem',
  },
  greenDot: {
    width:'8px', height:'8px', borderRadius:'50%', background:'#22c55e', display:'inline-block',
  },
  heroH1: {
    fontSize:'clamp(2.4rem, 6.5vw, 4.2rem)',
    fontWeight:'900', lineHeight:'1.08',
    letterSpacing:'-0.04em',
    color:'#0f172a',
    marginBottom:'1.5rem',
    maxWidth:'960px',
  },
  heroMuted: { color:'#64748b' },
  heroP: {
    fontSize:'clamp(1.05rem, 2.2vw, 1.25rem)',
    color:'#475569', maxWidth:'680px',
    lineHeight:'1.65', marginBottom:'3rem', fontWeight:'500',
  },
  heroActions: {
    display:'flex', flexWrap:'wrap', gap:'1rem',
    justifyContent:'center', marginBottom:'5rem',
  },
  btnHeroPrimary: {
    background:'#0f172a', border:'none', color:'white',
    padding:'1rem 2.2rem', borderRadius:'13px',
    fontSize:'1.05rem', fontWeight:'700',
    cursor:'pointer', transition:'all 0.2s',
    display:'flex', alignItems:'center', gap:'10px',
    boxShadow:'0 16px 30px -5px rgba(15,23,42,0.25)',
  },
  btnHeroSecondary: {
    background:'white', border:'1px solid #e2e8f0', color:'#334155',
    padding:'1rem 2.2rem', borderRadius:'13px',
    fontSize:'1.05rem', fontWeight:'700',
    cursor:'pointer', transition:'all 0.2s',
    display:'flex', alignItems:'center', gap:'10px',
    boxShadow:'0 4px 6px rgba(0,0,0,0.04)',
  },

  // DASHBOARD MOCKUP
  dashWrapper: {
    width:'100%', maxWidth:'1100px',
    position:'relative',
  },
  dashFrame: {
    background:'white',
    borderRadius:'20px 20px 0 0',
    border:'1px solid #e2e8f0',
    borderBottom:'none',
    overflow:'hidden',
    boxShadow:'0 40px 80px -20px rgba(0,0,0,0.12), 0 20px 40px -10px rgba(0,0,0,0.08)',
  },
  dashChrome: {
    background:'white',
    borderBottom:'1px solid #f1f5f9',
    padding:'12px 20px',
    display:'flex', alignItems:'center', gap:'8px',
  },
  chromeDot: {
    width:'11px', height:'11px', borderRadius:'50%', display:'inline-block',
  },
  chromeUrl: {
    flex:1, background:'#f8fafc',
    borderRadius:'6px', padding:'5px 12px',
    fontSize:'12px', color:'#94a3b8',
    textAlign:'center',
  },
  dashBody: {
    display:'flex', height:'360px',
  },
  dashSidebar: {
    width:'185px', flexShrink:0,
    background:'white',
    borderRight:'1px solid #f1f5f9',
    padding:'16px 12px',
    display:'flex', flexDirection:'column', gap:'4px',
  },
  sidebarLogo: {
    display:'flex', alignItems:'center', gap:'8px',
    padding:'8px 10px 16px', color:'#0f172a', fontWeight:'700',
  },
  sideItem: {
    padding:'8px 12px', borderRadius:'7px',
    fontSize:'13px', color:'#64748b',
    cursor:'pointer', fontWeight:'500',
  },
  sideItemActive: {
    background:'#f1f5f9', color:'#0f172a', fontWeight:'700',
  },
  dashContent: {
    flex:1, padding:'20px', overflow:'hidden', background:'#f8fafc',
  },
  dashTopRow: {
    display:'flex', justifyContent:'space-between', alignItems:'center',
    marginBottom:'16px',
  },
  dashTitle: { fontSize:'16px', fontWeight:'800', color:'#0f172a' },
  dashDate:  { fontSize:'12px', color:'#94a3b8' },
  statsGrid: {
    display:'grid', gridTemplateColumns:'repeat(4,1fr)',
    gap:'10px', marginBottom:'14px',
  },
  statCard: {
    background:'white', borderRadius:'10px',
    border:'1px solid #f1f5f9',
    padding:'12px 14px',
  },
  statLabel: { fontSize:'11px', color:'#94a3b8', marginBottom:'5px', fontWeight:'500' },
  statVal:   { fontSize:'18px', fontWeight:'800', color:'#0f172a', letterSpacing:'-0.02em' },
  statDelta: { fontSize:'11px', marginTop:'3px', fontWeight:'600' },
  chartCard: {
    background:'white', borderRadius:'10px',
    border:'1px solid #f1f5f9', padding:'14px',
    height:'165px',
  },
  chartTitle: { fontSize:'12px', fontWeight:'700', color:'#94a3b8', marginBottom:'12px' },
  chartBars: {
    display:'flex', alignItems:'flex-end', gap:'6px',
    height:'110px',
  },
  bar: { flex:1, borderRadius:'3px 3px 0 0', minWidth:0, transition:'height 0.3s' },

  // STATS STRIP
  statsStrip: {
    display:'flex', flexWrap:'wrap', justifyContent:'center', gap:'3rem',
    padding:'4rem 2rem',
    background:'white',
    borderTop:'1px solid #f1f5f9',
    borderBottom:'1px solid #f1f5f9',
  },
  statItem:     { textAlign:'center', minWidth:'160px' },
  statBigNum:   { fontSize:'2.4rem', fontWeight:'900', color:'#0f172a', letterSpacing:'-0.04em' },
  statBigLabel: { fontSize:'0.9rem', color:'#64748b', marginTop:'4px', fontWeight:'600' },

  // SECTIONS
  section: {
    padding:'7rem 1.5rem',
    maxWidth:'1280px', margin:'0 auto',
  },
  sectionInner: {
    maxWidth:'1280px', margin:'0 auto',
    padding:'7rem 1.5rem',
  },
  sectionHead:  { marginBottom:'3.5rem' },
  sectionH2: {
    fontSize:'clamp(1.9rem, 4.5vw, 3rem)',
    fontWeight:'900', color:'#0f172a',
    letterSpacing:'-0.04em', lineHeight:'1.15',
    marginBottom:'1rem',
  },
  sectionSub: {
    fontSize:'1.1rem', color:'#475569',
    maxWidth:'580px', lineHeight:'1.65', fontWeight:'500',
  },

  // FEATURES GRID
  featGrid: {
    display:'grid',
    gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))',
    border:'1px solid #f1f5f9', borderRadius:'20px', overflow:'hidden',
  },

  // WHY
  whySection: {
    background:'#f1f5f9',
    padding:'0',
  },
  whyGrid: {
    display:'grid',
    gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))',
    gap:'1.5rem',
    marginTop:'1rem',
  },
  whyCard: {
    background:'white', borderRadius:'18px',
    padding:'2rem', display:'flex', flexDirection:'column', gap:'1rem',
    border:'1px solid rgba(226,232,240,0.5)',
    transition:'transform 0.25s, box-shadow 0.25s',
  },
  whyIcon: {
    width:'44px', height:'44px', borderRadius:'11px',
    background:'#f8fafc', border:'1px solid #e2e8f0',
    display:'flex', alignItems:'center', justifyContent:'center', color:'#334155',
  },
  whyTitle: { fontSize:'1.1rem', fontWeight:'800', color:'#0f172a', letterSpacing:'-0.01em' },
  whyDesc:  { fontSize:'0.9rem', color:'#64748b', lineHeight:'1.65', fontWeight:'500' },

  // PRICING
  pricingGrid: {
    display:'grid',
    gridTemplateColumns:'repeat(auto-fit, minmax(290px, 1fr))',
    gap:'1.5rem', alignItems:'stretch',
  },

  // TESTIMONIALS
  testiGrid: {
    display:'grid',
    gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))',
    gap:'1.5rem',
  },
  testiCard: {
    background:'white', borderRadius:'18px',
    padding:'2rem', border:'1px solid #e2e8f0',
    display:'flex', flexDirection:'column', gap:'1rem',
  },
  testiQuote:  { fontSize:'1rem', color:'#334155', lineHeight:'1.7', fontStyle:'italic', flex:1, fontWeight:'500' },
  testiAuthor: { display:'flex', alignItems:'center', gap:'12px' },
  avatar: {
    width:'42px', height:'42px', borderRadius:'50%',
    background:'#0f172a', color:'white',
    display:'flex', alignItems:'center', justifyContent:'center',
    fontSize:'13px', fontWeight:'800', flexShrink:0,
  },
  testiName: { fontSize:'0.95rem', fontWeight:'800', color:'#0f172a' },
  testiRole: { fontSize:'0.82rem', color:'#64748b', fontWeight:'600', marginTop:'2px' },

  // CTA
  ctaWrapper: { padding:'4rem 1.5rem 7rem' },
  ctaBlock: {
    maxWidth:'1000px', margin:'0 auto',
    borderRadius:'28px', padding:'5rem 2rem',
    textAlign:'center',
    background:'#0f172a', color:'white',
    position:'relative', overflow:'hidden',
  },
  ctaDots: {
    position:'absolute', inset:0,
    backgroundImage:'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
    backgroundSize:'40px 40px',
  },
  ctaH2: {
    fontSize:'clamp(2rem, 5.5vw, 3.2rem)',
    fontWeight:'900', letterSpacing:'-0.04em',
    lineHeight:'1.1', marginBottom:'1rem',
  },
  ctaP: {
    color:'rgba(255,255,255,0.6)', fontSize:'1.15rem',
    maxWidth:'600px', margin:'0 auto 3rem',
    lineHeight:'1.65', fontWeight:'500',
  },
  ctaActions: { display:'flex', flexWrap:'wrap', gap:'1rem', justifyContent:'center' },
  btnCtaWhite: {
    background:'white', border:'none', color:'#0f172a',
    padding:'1.1rem 2.5rem', borderRadius:'13px',
    fontSize:'1.05rem', fontWeight:'800', cursor:'pointer',
    transition:'opacity 0.2s',
  },
  btnCtaGhost: {
    background:'rgba(255,255,255,0.1)',
    border:'1px solid rgba(255,255,255,0.2)', color:'white',
    padding:'1.1rem 2.5rem', borderRadius:'13px',
    fontSize:'1.05rem', fontWeight:'800', cursor:'pointer',
    transition:'background 0.2s',
  },

  // FOOTER
  footer: { background:'white', borderTop:'1px solid #f1f5f9' },
  footerInner: { maxWidth:'1280px', margin:'0 auto', padding:'5rem 2rem 2.5rem' },
  footerTop: {
    display:'grid',
    gridTemplateColumns:'2fr 1fr 1fr 1fr',
    gap:'3rem', marginBottom:'4rem',
  },
  footerBrand: {},
  footerTagline: {
    fontSize:'0.95rem', color:'#64748b',
    lineHeight:'1.65', marginTop:'1rem',
    maxWidth:'260px', fontWeight:'500',
  },
  footerCol: {},
  footerColTitle: {
    fontSize:'0.8rem', fontWeight:'800', color:'#0f172a',
    textTransform:'uppercase', letterSpacing:'0.07em',
    marginBottom:'1.25rem',
  },
  footerLink: {
    display:'block', fontSize:'0.92rem',
    color:'#64748b', textDecoration:'none',
    fontWeight:'500', marginBottom:'10px',
    transition:'color 0.2s',
  },
  footerBottom: {
    borderTop:'1px solid #f1f5f9', paddingTop:'2rem',
    display:'flex', flexWrap:'wrap', justifyContent:'space-between',
    alignItems:'center', gap:'1rem',
    fontSize:'0.88rem', color:'#94a3b8', fontWeight:'500',
  },
  footerBottomLink: { color:'#94a3b8', textDecoration:'none' },

  // WA FAB
  waFab: {
    position:'fixed', bottom:'2rem', right:'2rem', zIndex:200,
    width:'58px', height:'58px', borderRadius:'50%',
    background:'#25d366', border:'none', color:'white',
    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
    boxShadow:'0 8px 24px rgba(37,211,102,0.35)',
    transition:'all 0.3s',
  },
};
