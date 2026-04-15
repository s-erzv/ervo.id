import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';
import CryptoJS from 'crypto-js';
import { 
  Users, 
  CreditCard, 
  Package, 
  User, 
  Wallet, 
  BarChart3, 
  ShieldCheck,
  Pencil,
  Save,
  X,
  Loader2,
  MessageSquare,
  ExternalLink,
  Smartphone,
  Info,
  Lock,
  Settings2,
  Percent, 
} from 'lucide-react';

import ProductSettings from '@/components/ProductSettings';
import CustomerStatusSettings from '@/components/CustomerStatusSettings';
import UserManagement from '@/components/UserManagement';
import SubscriptionExtensionForm from '@/components/SubscriptionExtensionForm';
import SubscriptionPaymentForm from '@/components/SubscriptionPaymentForm';
import FinancialCategorySettings from '@/components/FinancialCategorySettings';
import PaymentMethodsPage from './PaymentMethodsPage'; 
import DropshipperManagement from '@/components/DropshipperManagement';

const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'fallback-key-proyek-rahasia';

const SettingsPage = () => {
  const { userRole, userProfile, companyId } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const isSuperAdmin = userRole === 'super_admin';
  const isAdmin = userRole === 'admin';

  const canManageDropshipper = isSuperAdmin || isAdmin;

  // --- STATE UNTUK EDIT PROFIL ---
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    address: ''
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // --- STATE UNTUK FONNTE (WA) ---
  const [fonnteTokenInput, setFonnteTokenInput] = useState(''); 
  const [isIntegrated, setIsIntegrated] = useState(false); 
  const [isSavingFonnte, setIsSavingFonnte] = useState(false);

  const canManageUsers = isSuperAdmin || isAdmin;
  const canEditCompany = isSuperAdmin || isAdmin;
  const canManageWA = isSuperAdmin || isAdmin;

  useEffect(() => {
    if (userProfile?.companies) {
      setProfileForm({
        name: userProfile.companies.name || '',
        address: userProfile.companies.address || ''
      });

      const rawToken = userProfile.companies.fonnte_token;
      if (rawToken && rawToken.trim() !== "") {
          setIsIntegrated(true);
          setFonnteTokenInput('****************************'); 
      } else {
          setIsIntegrated(false);
          setFonnteTokenInput('');
      }
    }
  }, [userProfile]);

  const handleUpdateProfile = async () => {
    if (!profileForm.name) return toast.error("Nama perusahaan tidak boleh kosong");
    
    setIsSavingProfile(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({
          name: profileForm.name,
          address: profileForm.address
        })
        .eq('id', companyId);

      if (error) throw error;

      toast.success("Profil perusahaan berhasil diperbarui!");
      setIsEditingProfile(false);
    } catch (error) {
      console.error(error);
      toast.error("Gagal memperbarui profil: " + error.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveFonnteToken = async () => {
    if (!fonnteTokenInput || fonnteTokenInput.includes('***')) return toast.error("Masukkan Token yang valid");
    
    setIsSavingFonnte(true);
    try {
      const encryptedToken = CryptoJS.AES.encrypt(fonnteTokenInput, ENCRYPTION_KEY).toString();

      const { error } = await supabase
        .from('companies')
        .update({ fonnte_token: encryptedToken })
        .eq('id', companyId);

      if (error) throw error;
      
      setIsIntegrated(true);
      toast.success("Integrasi WhatsApp Berhasil & Terenkripsi!");
      setFonnteTokenInput('****************************');
    } catch (error) {
      toast.error("Gagal menyimpan token.");
      console.error(error);
    } finally {
      setIsSavingFonnte(false);
    }
  };

  const handleDisconnectFonnte = async () => {
    if (!window.confirm("Apakah Anda yakin ingin memutuskan integrasi WhatsApp? Token akan dihapus.")) return;
    
    setIsSavingFonnte(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({ fonnte_token: null }) 
        .eq('id', companyId);

      if (error) throw error;
      
      setIsIntegrated(false);
      setFonnteTokenInput('');
      toast.success("Integrasi WhatsApp berhasil diputuskan.");
    } catch (error) {
      toast.error("Gagal memutuskan integrasi: " + error.message);
      console.error(error);
    } finally {
      setIsSavingFonnte(false);
    }
  };

  const handleCancelEdit = () => {
    if (userProfile?.companies) {
        setProfileForm({
          name: userProfile.companies.name || '',
          address: userProfile.companies.address || ''
        });
    }
    setIsEditingProfile(false);
  };

  return (
    <div className="container p-6 md:p-10 space-y-8 pb-20 max-w-7xl animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center gap-4 mb-2">
        <Settings2 className="h-8 w-8 text-[#015a97]" />
        <div>
          <h1 className="text-3xl font-semibold text-[#011e4b]">Pengaturan</h1>
          <p className="text-slate-500 font-medium mt-1">Kelola konfigurasi sistem dan integrasi perusahaan.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
        <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
          <TabsList className="flex h-auto w-full md:w-max justify-start bg-slate-100 p-1.5 border border-slate-200 rounded-xl flex-nowrap md:flex-wrap gap-1">
            <TabsTrigger 
                value="profile" 
                className="flex-shrink-0 md:flex-none px-5 py-2.5 rounded-lg transition-all text-sm font-medium text-slate-500 hover:text-slate-900 data-[state=active]:bg-[#011e4b] data-[state=active]:text-white"
            >
              <User className="h-4 w-4 mr-2" /> Profil
            </TabsTrigger>
            <TabsTrigger 
                value="products" 
                className="flex-shrink-0 md:flex-none px-5 py-2.5 rounded-lg transition-all text-sm font-medium text-slate-500 hover:text-slate-900 data-[state=active]:bg-[#011e4b] data-[state=active]:text-white"
            >
              <Package className="h-4 w-4 mr-2" /> Produk
            </TabsTrigger>
            <TabsTrigger 
                value="customers" 
                className="flex-shrink-0 md:flex-none px-5 py-2.5 rounded-lg transition-all text-sm font-medium text-slate-500 hover:text-slate-900 data-[state=active]:bg-[#011e4b] data-[state=active]:text-white"
            >
              <Users className="h-4 w-4 mr-2" /> Status
            </TabsTrigger>
            <TabsTrigger 
                value="finance" 
                className="flex-shrink-0 md:flex-none px-5 py-2.5 rounded-lg transition-all text-sm font-medium text-slate-500 hover:text-slate-900 data-[state=active]:bg-[#011e4b] data-[state=active]:text-white"
            >
              <BarChart3 className="h-4 w-4 mr-2" /> Keuangan
            </TabsTrigger>
            <TabsTrigger 
                value="payments" 
                className="flex-shrink-0 md:flex-none px-5 py-2.5 rounded-lg transition-all text-sm font-medium text-slate-500 hover:text-slate-900 data-[state=active]:bg-[#011e4b] data-[state=active]:text-white"
            >
              <Wallet className="h-4 w-4 mr-2" /> Pembayaran
            </TabsTrigger>
            {canManageWA && (
               <TabsTrigger 
                  value="whatsapp" 
                  className="flex-shrink-0 md:flex-none px-5 py-2.5 rounded-lg transition-all text-sm font-medium text-slate-500 hover:text-slate-900 data-[state=active]:bg-[#011e4b] data-[state=active]:text-white"
                >
                 <MessageSquare className="h-4 w-4 mr-2" /> Integrasi WA
               </TabsTrigger>
            )}
            {canManageUsers && (
                <TabsTrigger 
                  value="users" 
                  className="flex-shrink-0 md:flex-none px-5 py-2.5 rounded-lg transition-all text-sm font-medium text-slate-500 hover:text-slate-900 data-[state=active]:bg-[#011e4b] data-[state=active]:text-white"
                >
                  <ShieldCheck className="h-4 w-4 mr-2" /> User
                </TabsTrigger>
            )}
            {(isAdmin || isSuperAdmin) && (
                <TabsTrigger 
                  value="subscription" 
                  className="flex-shrink-0 md:flex-none px-5 py-2.5 rounded-lg transition-all text-sm font-medium text-slate-500 hover:text-slate-900 data-[state=active]:bg-[#011e4b] data-[state=active]:text-white"
                >
                  <CreditCard className="h-4 w-4 mr-2" /> Langganan
                </TabsTrigger>
            )}
            {canManageDropshipper && (
              <TabsTrigger 
                  value="dropshipper" 
                  className="flex-shrink-0 md:flex-none px-5 py-2.5 rounded-lg transition-all text-sm font-medium text-slate-500 hover:text-slate-900 data-[state=active]:bg-[#011e4b] data-[state=active]:text-white"
                >
                <Percent className="h-4 w-4 mr-2" /> Dropshipper
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <div className="w-full">
          {/* TAB CONTENT: PROFILE */}
          <TabsContent value="profile" className="mt-0 space-y-4 outline-none">
            <Card className="border border-slate-200/60 shadow-sm rounded-2xl overflow-hidden bg-white">
              <CardHeader className="flex flex-row items-center justify-between p-6 bg-slate-50/50 border-b border-slate-100">
                <div>
                    <CardTitle className="text-lg font-medium text-[#011e4b]">Profil Perusahaan</CardTitle>
                    <CardDescription className="font-medium text-slate-500 mt-1">Informasi dasar mengenai perusahaan Anda.</CardDescription>
                </div>
                {canEditCompany && !isEditingProfile && (
                    <Button variant="outline" size="sm" onClick={() => setIsEditingProfile(true)} className="border-slate-200 font-medium text-slate-600 hover:bg-slate-50">
                        <Pencil className="h-4 w-4 mr-2" /> Edit Profil
                    </Button>
                )}
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-600">Nama Perusahaan</label>
                    {isEditingProfile ? (
                        <Input 
                            value={profileForm.name} 
                            onChange={(e) => setProfileForm({...profileForm, name: e.target.value})}
                            placeholder="Nama Usaha Anda"
                            className="h-11 border-slate-200 focus-visible:ring-[#015a97]"
                        />
                    ) : (
                        <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-800 font-medium">
                          {profileForm.name || '-'}
                        </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-600">Status Langganan</label>
                    <div className="p-3.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg font-medium flex items-center">
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      {userProfile?.companies?.subscription_end_date 
                        ? `Aktif sampai ${new Date(userProfile.companies.subscription_end_date).toLocaleDateString('id-ID')}` 
                        : 'Tidak Aktif'}
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-slate-600">Alamat Lengkap</label>
                    {isEditingProfile ? (
                        <Textarea 
                            rows={3}
                            value={profileForm.address} 
                            onChange={(e) => setProfileForm({...profileForm, address: e.target.value})}
                            placeholder="Alamat operasional perusahaan..."
                            className="border-slate-200 focus-visible:ring-[#015a97]"
                        />
                    ) : (
                        <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-slate-800 min-h-[80px] font-medium">
                          {profileForm.address || '-'}
                        </div>
                    )}
                  </div>
                </div>
              </CardContent>
              {isEditingProfile && (
                  <CardFooter className="bg-slate-50 border-t border-slate-100 p-6 flex justify-end gap-3">
                      <Button variant="outline" onClick={handleCancelEdit} disabled={isSavingProfile} className="font-medium text-slate-600 border-slate-200">
                          <X className="h-4 w-4 mr-2" /> Batal
                      </Button>
                      <Button onClick={handleUpdateProfile} disabled={isSavingProfile} className="bg-[#011e4b] hover:bg-[#00376a] text-white font-medium">
                          {isSavingProfile ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <Save className="h-4 w-4 mr-2" />}
                          Simpan Perubahan
                      </Button>
                  </CardFooter>
              )}
            </Card>
          </TabsContent>

          {/* TAB CONTENT: INTEGRASI WA (FONNTE) */}
          <TabsContent value="whatsapp" className="mt-0 outline-none">
            <Card className="border border-slate-200/60 shadow-sm rounded-2xl overflow-hidden bg-white">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-100 rounded-xl">
                        <MessageSquare className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                        <CardTitle className="text-lg font-medium text-[#011e4b]">Integrasi WhatsApp (Fonnte)</CardTitle>
                        <CardDescription className="font-medium text-slate-500 mt-1">Hubungkan sistem dengan WhatsApp Gateway untuk pengiriman invoice otomatis.</CardDescription>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {isIntegrated ? (
                  <div className="bg-emerald-50/50 border border-emerald-200 p-6 rounded-xl flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <ShieldCheck className="h-6 w-6 text-emerald-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-emerald-900">WhatsApp Terhubung</h4>
                        <p className="text-sm font-medium text-emerald-700 mt-1">Sistem Anda siap mengirimkan notifikasi otomatis via Fonnte.</p>
                      </div>
                    </div>
                    <Button 
                      variant="destructive" 
                      onClick={handleDisconnectFonnte}
                      disabled={isSavingFonnte}
                      className="w-full md:w-auto font-medium"
                    >
                      {isSavingFonnte ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <X className="h-4 w-4 mr-2" />}
                      Putuskan Integrasi
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="bg-blue-50/50 border border-blue-200 p-5 rounded-xl space-y-3">
                        <h4 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                            <Info className="h-4 w-4" /> Cara Integrasi:
                        </h4>
                        <ol className="text-sm font-medium text-blue-700 space-y-2 list-decimal list-inside ml-1">
                            <li>Daftar akun di <a href="https://fonnte.com" target="_blank" className="underline font-semibold hover:text-blue-900">Fonnte.com</a>.</li>
                            <li>Masuk ke Dashboard Fonnte dan pilih menu <b>Devices</b>.</li>
                            <li>Scan QR Code menggunakan WhatsApp HP Anda.</li>
                            <li>Salin <b>API Token</b> perangkat tersebut dan tempel di bawah ini.</li>
                        </ol>
                    </div>

                    <div className="space-y-3 max-w-2xl">
                        <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                            <Lock className="h-4 w-4 text-amber-500" /> Fonnte API Token
                        </label>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Input 
                                type="password"
                                placeholder="Masukkan API Token dari Fonnte"
                                value={fonnteTokenInput}
                                onChange={(e) => setFonnteTokenInput(e.target.value)}
                                className="flex-1 h-11 border-slate-200 focus-visible:ring-emerald-500"
                            />
                            <Button 
                              onClick={handleSaveFonnteToken} 
                              disabled={isSavingFonnte || !fonnteTokenInput} 
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium h-11 sm:w-auto w-full"
                            >
                                {isSavingFonnte ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4 mr-2" />}
                                Simpan Token
                            </Button>
                        </div>
                        <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                            <ShieldCheck className="h-3 w-3" /> Token Anda dienkripsi secara end-to-end sebelum disimpan.
                        </p>
                    </div>
                  </>
                )}
              </CardContent>
              <CardFooter className="bg-slate-50 border-t border-slate-100 p-6">
                  <a href="https://fonnte.com" target="_blank" className="text-sm font-medium text-[#015a97] flex items-center hover:underline transition-colors">
                      Buka Dashboard Fonnte <ExternalLink className="h-4 w-4 ml-1.5" />
                  </a>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* TAB CONTENT: OTHERS */}
          <TabsContent value="products" className="mt-0 outline-none">
            <ProductSettings />
          </TabsContent>
          <TabsContent value="customers" className="mt-0 outline-none">
            <CustomerStatusSettings />
          </TabsContent>
          <TabsContent value="finance" className="mt-0 outline-none">
            <FinancialCategorySettings />
          </TabsContent>
          <TabsContent value="payments" className="mt-0 outline-none">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
               <PaymentMethodsPage isEmbedded={true} />
            </div>
          </TabsContent>
          {canManageUsers && (
            <TabsContent value="users" className="mt-0 outline-none">
              <UserManagement />
            </TabsContent>
          )}
          {canManageDropshipper && (
            <TabsContent value="dropshipper" className="mt-0 outline-none">
              <DropshipperManagement companyId={companyId} />
            </TabsContent>
          )}
          {(isAdmin || isSuperAdmin) && (
            <TabsContent value="subscription" className="mt-0 outline-none">
              <Card className="border border-slate-200/60 shadow-sm rounded-2xl bg-white overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
                  <CardTitle className="text-lg font-medium text-[#011e4b]">
                    {isSuperAdmin ? 'Manajemen Langganan' : 'Perpanjang Langganan'}
                  </CardTitle>
                  <CardDescription className="font-medium text-slate-500 mt-1">
                    {isSuperAdmin 
                      ? 'Kelola masa aktif layanan untuk akun ini secara manual.' 
                      : 'Pilih paket dan bayar untuk memperpanjang masa aktif layanan Anda.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  {isSuperAdmin ? (
                    <SubscriptionExtensionForm user={userProfile} />
                  ) : (
                    <SubscriptionPaymentForm />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  );
};

export default SettingsPage;