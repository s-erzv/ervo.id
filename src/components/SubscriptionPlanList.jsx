import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Plus, Edit2, MapPin, Truck, ReceiptText, DollarSign,
  PiggyBank, Wallet, BarChart, Database, Calendar, Info, Package, Check, X
} from 'lucide-react';

// All toggleable features matching Navbar feature keys
const AVAILABLE_FEATURES = [
  { key: 'financials', label: 'Keuangan', desc: 'Manajemen Keuangan & Laporan Keuangan', icon: Wallet },
  { key: 'procurement', label: 'Procurement', desc: 'Pemesanan ke supplier / pusat', icon: Truck },
  { key: 'reimbursement', label: 'Reimbursement', desc: 'Pengajuan & persetujuan reimburse', icon: ReceiptText },
  { key: 'salaries', label: 'Gaji & Bonus', desc: 'Manajemen gaji karyawan', icon: DollarSign },
  { key: 'reports', label: 'Analisis & Laporan', desc: 'Analisis penjualan & laporan final', icon: BarChart },
  { key: 'data_export', label: 'Data Center', desc: 'Ekspor data ke spreadsheet', icon: Database },
  { key: 'calendar', label: 'Kalender Pesanan', desc: 'Tampilan kalender jadwal pesanan', icon: Calendar },
  { key: 'maps', label: 'Peta Pelanggan', desc: 'Peta lokasi customer', icon: MapPin },
];

const AVAILABLE_LIMITS = [
  { key: 'max_products', label: 'Maks Produk', desc: 'Batas jumlah produk. Kosong = unlimited.' },
  { key: 'max_users', label: 'Maks Pengguna', desc: 'Batas jumlah user. Kosong = unlimited.' },
];

const SubscriptionPlanList = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');

  const [formData, setFormData] = useState({
    code: '', name: '', description: '', price: 0,
    billing_cycle_days: 30, max_users: '', is_active: true,
  });
  const [featureToggles, setFeatureToggles] = useState({});
  const [limits, setLimits] = useState({});

  useEffect(() => { fetchPlans(); }, []);

  const fetchPlans = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('subscription_plans').select('*').order('price', { ascending: true });
    if (error) toast.error('Gagal memuat paket langganan.');
    else setPlans(data || []);
    setLoading(false);
  };

  const parseFeaturesFromPlan = (plan) => {
    const features = plan?.features;
    let toggles = {};
    let parsedLimits = {};
    if (Array.isArray(features)) {
      features.forEach(f => { toggles[f] = true; });
    } else if (features && typeof features === 'object') {
      toggles = features.toggles || {};
      parsedLimits = features.limits || {};
    }
    return { toggles, limits: parsedLimits };
  };

  const handleOpenDialog = (plan = null) => {
    setActiveTab('basic');
    if (plan) {
      setEditingPlan(plan);
      const { toggles, limits: parsedLimits } = parseFeaturesFromPlan(plan);
      setFormData({
        code: plan.code, name: plan.name, description: plan.description || '',
        price: plan.price, billing_cycle_days: plan.billing_cycle_days || 0,
        max_users: plan.max_users ?? '', is_active: plan.is_active,
      });
      setFeatureToggles(toggles);
      setLimits(parsedLimits);
    } else {
      setEditingPlan(null);
      setFormData({
        code: '', name: '', description: '', price: 0,
        billing_cycle_days: 30, max_users: '', is_active: true,
      });
      const defaultToggles = {};
      AVAILABLE_FEATURES.forEach(f => { defaultToggles[f.key] = true; });
      setFeatureToggles(defaultToggles);
      setLimits({});
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const featuresJson = {
      toggles: { ...featureToggles },
      limits: {},
    };
    AVAILABLE_LIMITS.forEach(l => {
      const val = limits[l.key];
      if (val !== undefined && val !== '' && val !== null) {
        featuresJson.limits[l.key] = Number(val);
      }
    });

    const payload = {
      code: formData.code, name: formData.name, description: formData.description,
      price: Number(formData.price),
      billing_cycle_days: Number(formData.billing_cycle_days) || null,
      max_users: formData.max_users !== '' ? Number(formData.max_users) : null,
      is_active: formData.is_active,
      features: featuresJson,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (editingPlan) {
      ({ error } = await supabase.from('subscription_plans').update(payload).eq('id', editingPlan.id));
    } else {
      ({ error } = await supabase.from('subscription_plans').insert([payload]));
    }

    if (error) toast.error(`Gagal menyimpan: ${error.message}`);
    else {
      toast.success(editingPlan ? 'Paket berhasil diupdate.' : 'Paket berhasil ditambahkan.');
      setIsDialogOpen(false);
      fetchPlans();
    }
    setSaving(false);
  };

  const countActiveFeatures = (plan) => {
    const { toggles } = parseFeaturesFromPlan(plan);
    return Object.values(toggles).filter(Boolean).length;
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;

  const tabs = [
    { id: 'basic', label: 'Info Dasar' },
    { id: 'features', label: 'Akses Menu' },
    { id: 'limits', label: 'Batasan' },
  ];

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <p className="text-slate-500">Kelola daftar paket langganan beserta fitur yang tersedia.</p>
        <Button onClick={() => handleOpenDialog()} className="bg-[#011e4b] hover:bg-[#00376a] shrink-0">
          <Plus className="h-4 w-4 mr-2" /> Tambah Paket
        </Button>
      </div>

      {/* Plan Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="font-medium text-slate-700">Kode</TableHead>
              <TableHead className="font-medium text-slate-700">Nama Paket</TableHead>
              <TableHead className="font-medium text-slate-700">Harga</TableHead>
              <TableHead className="font-medium text-slate-700">Siklus</TableHead>
              <TableHead className="font-medium text-slate-700">Fitur</TableHead>
              <TableHead className="font-medium text-slate-700">Status</TableHead>
              <TableHead className="font-medium text-slate-700 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((plan) => (
              <TableRow key={plan.id} className="hover:bg-slate-50/50">
                <TableCell className="font-mono text-sm text-slate-600">{plan.code}</TableCell>
                <TableCell>
                  <span className="font-medium text-slate-800">{plan.name}</span>
                  {plan.description && <p className="text-xs text-slate-400 mt-0.5 max-w-[200px] truncate">{plan.description}</p>}
                </TableCell>
                <TableCell className="font-medium text-slate-700">Rp {plan.price?.toLocaleString('id-ID')}</TableCell>
                <TableCell className="text-slate-600">{plan.billing_cycle_days ? `${plan.billing_cycle_days} Hari` : '∞'}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs border-blue-200 text-blue-700 bg-blue-50">
                    {countActiveFeatures(plan)} / {AVAILABLE_FEATURES.length}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${plan.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {plan.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(plan)} className="text-[#015a97] hover:text-[#011e4b] hover:bg-blue-50">
                    <Edit2 className="h-4 w-4 mr-1" /> Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {plans.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500">Belum ada paket langganan.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[580px] max-h-[85vh] overflow-y-auto p-0">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 pt-6 pb-4">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-slate-900">
                {editingPlan ? `Edit: ${editingPlan.name}` : 'Tambah Paket Baru'}
              </DialogTitle>
            </DialogHeader>

            {/* Custom Tab Bar — no shadcn Tabs to avoid CSS variable issues */}
            <div className="flex gap-1 mt-4 p-1 bg-slate-100 rounded-lg">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all
                    ${activeTab === tab.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="px-6 pb-6 pt-4">

            {/* Tab: Info Dasar */}
            {activeTab === 'basic' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">Kode Paket</Label>
                    <Input
                      value={formData.code}
                      onChange={e => setFormData({ ...formData, code: e.target.value })}
                      placeholder="PRO_MONTHLY"
                      className="border-slate-300 text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">Nama Paket</Label>
                    <Input
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Paket Profesional"
                      className="border-slate-300 text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">Deskripsi</Label>
                  <Input
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Penjelasan singkat paket..."
                    className="border-slate-300 text-slate-900 placeholder:text-slate-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">Harga (Rp)</Label>
                    <Input
                      type="number" min="0"
                      value={formData.price}
                      onChange={e => setFormData({ ...formData, price: e.target.value })}
                      className="border-slate-300 text-slate-900"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-slate-700">Siklus (Hari)</Label>
                    <Input
                      type="number" min="0"
                      value={formData.billing_cycle_days}
                      onChange={e => setFormData({ ...formData, billing_cycle_days: e.target.value })}
                      placeholder="0 = selamanya"
                      className="border-slate-300 text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between p-3.5 border border-slate-200 rounded-xl bg-slate-50">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Status Aktif</p>
                    <p className="text-xs text-slate-500 mt-0.5">Paket yang nonaktif tidak bisa dipilih tenant</p>
                  </div>
                  <Switch checked={formData.is_active} onCheckedChange={checked => setFormData({ ...formData, is_active: checked })} />
                </div>
              </div>
            )}

            {/* Tab: Akses Menu */}
            {activeTab === 'features' && (
              <div className="space-y-3">
                <div className="flex items-start gap-2.5 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <Info className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
                  <p className="text-sm text-blue-800">
                    Menu dasar (Dashboard, Pesanan, Stok, Customer, Pengaturan) <strong>selalu tersedia</strong>. Toggle di bawah mengatur fitur tambahan.
                  </p>
                </div>

                <div className="space-y-2">
                  {AVAILABLE_FEATURES.map(f => {
                    const Icon = f.icon;
                    const isOn = !!featureToggles[f.key];
                    return (
                      <div
                        key={f.key}
                        className={`flex items-center justify-between p-3 border rounded-xl transition-all cursor-pointer
                          ${isOn
                            ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100/70'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                          }`}
                        onClick={() => setFeatureToggles(prev => ({ ...prev, [f.key]: !prev[f.key] }))}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${isOn ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className={`text-sm font-medium ${isOn ? 'text-emerald-900' : 'text-slate-700'}`}>{f.label}</p>
                            <p className={`text-xs ${isOn ? 'text-emerald-700' : 'text-slate-400'}`}>{f.desc}</p>
                          </div>
                        </div>
                        <div className={`flex items-center justify-center w-6 h-6 rounded-full ${isOn ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                          {isOn ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                    onClick={() => { const all = {}; AVAILABLE_FEATURES.forEach(f => { all[f.key] = true; }); setFeatureToggles(all); }}
                  >
                    Aktifkan Semua
                  </button>
                  <button
                    type="button"
                    className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                    onClick={() => setFeatureToggles({})}
                  >
                    Nonaktifkan Semua
                  </button>
                </div>
              </div>
            )}

            {/* Tab: Batasan */}
            {activeTab === 'limits' && (
              <div className="space-y-4">
                <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <Info className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
                  <p className="text-sm text-amber-800">
                    Atur batasan kuota untuk paket ini. <strong>Kosongkan</strong> jika tidak ada batasan (unlimited).
                  </p>
                </div>

                {AVAILABLE_LIMITS.map(l => (
                  <div key={l.key} className="p-4 border border-slate-200 rounded-xl bg-white">
                    <Label className="text-sm font-medium text-slate-700">{l.label}</Label>
                    <p className="text-xs text-slate-500 mt-0.5 mb-2.5">{l.desc}</p>
                    <Input
                      type="number" min="0" placeholder="Unlimited"
                      value={l.key === 'max_users' ? formData.max_users : (limits[l.key] ?? '')}
                      onChange={e => {
                        const val = e.target.value;
                        if (l.key === 'max_users') setFormData(prev => ({ ...prev, max_users: val }));
                        else setLimits(prev => ({ ...prev, [l.key]: val }));
                      }}
                      className="border-slate-300 text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Save Button */}
            <Button
              onClick={handleSave}
              className="w-full mt-6 h-11 bg-[#011e4b] hover:bg-[#00376a] text-white font-semibold"
              disabled={saving || !formData.code || !formData.name}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingPlan ? 'Simpan Perubahan' : 'Tambah Paket'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SubscriptionPlanList;
