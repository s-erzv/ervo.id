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
  const [fonnteTokenInput, setFonnteTokenInput] = useState(''); // Untuk menampung apa yang diketik
  const [isIntegrated, setIsIntegrated] = useState(false); // Penanda apakah di DB sudah ada token
  const [isSavingFonnte, setIsSavingFonnte] = useState(false);

  const canManageUsers = isSuperAdmin || isAdmin;
  const canEditCompany = isSuperAdmin || isAdmin;
  const canManageWA = isSuperAdmin || isAdmin;

  // Sinkronisasi data saat data userProfile dimuat
  useEffect(() => {
    if (userProfile?.companies) {
      setProfileForm({
        name: userProfile.companies.name || '',
        address: userProfile.companies.address || ''
      });

      // --- LOGIKA CEK STATUS INTEGRASI DARI DB ---
      const rawToken = userProfile.companies.fonnte_token;
      if (rawToken && rawToken.trim() !== "") {
          setIsIntegrated(true);
          // Kita tidak perlu menampilkan token asli di input jika sudah terhubung demi keamanan
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
      // --- PROSES ENKRIPSI SEBELUM SIMPAN ---
      const encryptedToken = CryptoJS.AES.encrypt(fonnteTokenInput, ENCRYPTION_KEY).toString();

      const { error } = await supabase
        .from('companies')
        .update({ fonnte_token: encryptedToken })
        .eq('id', companyId);

      if (error) throw error;
      
      setIsIntegrated(true);
      toast.success("Integrasi WhatsApp Berhasil & Terenkripsi!");
      // Jangan lupa update input menjadi bintang-bintang lagi
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
    <div className="container p-4 md:p-8 space-y-6 pb-20">
      <div className="flex items-center gap-3 mb-2">
        <Settings2 className="h-8 w-8 text-[#10182b]" />
        <div>
          <h1 className="text-2xl font-bold text-[#10182b]">Pengaturan</h1>
          <p className="text-sm text-muted-foreground">Kelola konfigurasi sistem dan integrasi perusahaan.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
        <div className="w-full overflow-x-auto pb-2">
          <TabsList className="flex h-auto w-full md:w-max justify-start bg-slate-100/50 p-1 border rounded-xl flex-wrap">
            <TabsTrigger value="profile" className="flex-1 md:flex-none px-4 py-2.5 rounded-lg transition-all text-xs md:text-sm">
              <User className="h-4 w-4 mr-2" /> Profil
            </TabsTrigger>
            <TabsTrigger value="products" className="flex-1 md:flex-none px-4 py-2.5 rounded-lg transition-all text-xs md:text-sm">
              <Package className="h-4 w-4 mr-2" /> Produk
            </TabsTrigger>
            <TabsTrigger value="customers" className="flex-1 md:flex-none px-4 py-2.5 rounded-lg transition-all text-xs md:text-sm">
              <Users className="h-4 w-4 mr-2" /> Status
            </TabsTrigger>
            <TabsTrigger value="finance" className="flex-1 md:flex-none px-4 py-2.5 rounded-lg transition-all text-xs md:text-sm">
              <BarChart3 className="h-4 w-4 mr-2" /> Keuangan
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex-1 md:flex-none px-4 py-2.5 rounded-lg transition-all text-xs md:text-sm">
              <Wallet className="h-4 w-4 mr-2" /> Pembayaran
            </TabsTrigger>
            {canManageWA && (
               <TabsTrigger value="whatsapp" className="flex-1 md:flex-none px-4 py-2.5 rounded-lg transition-all text-xs md:text-sm">
                 <MessageSquare className="h-4 w-4 mr-2" /> Integrasi WA
               </TabsTrigger>
            )}
            {canManageUsers && (
                <TabsTrigger value="users" className="flex-1 md:flex-none px-4 py-2.5 rounded-lg transition-all text-xs md:text-sm">
                  <ShieldCheck className="h-4 w-4 mr-2" /> User
                </TabsTrigger>
            )}
            {isSuperAdmin && (
                <TabsTrigger value="subscription" className="flex-1 md:flex-none px-4 py-2.5 rounded-lg transition-all text-xs md:text-sm">
                  <CreditCard className="h-4 w-4 mr-2" /> Langganan
                </TabsTrigger>
            )}
            {canManageDropshipper && (
              <TabsTrigger value="dropshipper" className="flex-1 md:flex-none px-4 py-2.5 rounded-lg transition-all text-xs md:text-sm">
                <Percent className="h-4 w-4 mr-2" /> Dropshipper
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <div className="w-full">
          {/* TAB CONTENT: PROFILE */}
          <TabsContent value="profile" className="mt-0 space-y-4 outline-none">
            <Card className="border-0 shadow-sm relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Profil Perusahaan</CardTitle>
                    <CardDescription>Informasi dasar mengenai perusahaan Anda.</CardDescription>
                </div>
                {canEditCompany && !isEditingProfile && (
                    <Button variant="outline" size="sm" onClick={() => setIsEditingProfile(true)}>
                        <Pencil className="h-4 w-4 mr-2" /> Edit Profil
                    </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-600">Nama Perusahaan</label>
                    {isEditingProfile ? (
                        <Input 
                            value={profileForm.name} 
                            onChange={(e) => setProfileForm({...profileForm, name: e.target.value})}
                            placeholder="Nama Usaha Anda"
                        />
                    ) : (
                        <div className="p-3 bg-slate-50 rounded-md border text-slate-900 font-medium">
                          {profileForm.name || '-'}
                        </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-600">Status Langganan</label>
                    <div className="p-3 bg-green-50 text-green-700 border border-green-200 rounded-md font-medium flex items-center">
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
                            placeholder="Jalan..."
                        />
                    ) : (
                        <div className="p-3 bg-slate-50 rounded-md border text-slate-900 min-h-[80px]">
                          {profileForm.address || '-'}
                        </div>
                    )}
                  </div>
                </div>
              </CardContent>
              {isEditingProfile && (
                  <CardFooter className="bg-slate-50 border-t p-4 flex justify-end gap-2">
                      <Button variant="outline" onClick={handleCancelEdit} disabled={isSavingProfile}>
                          <X className="h-4 w-4 mr-2" /> Batal
                      </Button>
                      <Button onClick={handleUpdateProfile} disabled={isSavingProfile} className="bg-[#10182b] text-white">
                          {isSavingProfile ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <Save className="h-4 w-4 mr-2" />}
                          Simpan Perubahan
                      </Button>
                  </CardFooter>
              )}
            </Card>
          </TabsContent>

          {/* TAB CONTENT: INTEGRASI WA (FONNTE) */}
          <TabsContent value="whatsapp" className="mt-0 outline-none">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                        <MessageSquare className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                        <CardTitle>Integrasi WhatsApp (Fonnte)</CardTitle>
                        <CardDescription>Hubungkan sistem dengan WhatsApp Gateway untuk pengiriman invoice otomatis.</CardDescription>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* STATUS TERHUBUNG (Hanya muncul jika isIntegrated benar-benar true dari DB) */}
                {isIntegrated ? (
                  <div className="bg-green-50 border border-green-200 p-6 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                        <ShieldCheck className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-green-900">WhatsApp Terhubung</h4>
                        <p className="text-sm text-green-700">Sistem Anda siap mengirimkan notifikasi otomatis via Fonnte.</p>
                      </div>
                    </div>
                    <Button 
                      variant="destructive" 
                      onClick={handleDisconnectFonnte}
                      disabled={isSavingFonnte}
                      className="w-full md:w-auto"
                    >
                      {isSavingFonnte ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <X className="h-4 w-4 mr-2" />}
                      Putuskan Integrasi
                    </Button>
                  </div>
                ) : (
                  /* FORM SETUP (Muncul jika DB kosong) */
                  <>
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg space-y-2">
                        <h4 className="text-sm font-bold text-blue-800 flex items-center gap-2">
                            <Info className="h-4 w-4" /> Cara Integrasi:
                        </h4>
                        <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
                            <li>Daftar akun di <a href="https://fonnte.com" target="_blank" className="underline font-bold">Fonnte.com</a>.</li>
                            <li>Masuk ke Dashboard Fonnte dan pilih menu <b>Devices</b>.</li>
                            <li>Scan QR Code menggunakan WhatsApp HP Anda.</li>
                            <li>Salin <b>API Token</b> perangkat tersebut dan tempel di bawah ini.</li>
                        </ol>
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <Lock className="h-4 w-4 text-orange-500" /> Fonnte API Token
                        </label>
                        <div className="flex gap-2">
                            <Input 
                                type="password"
                                placeholder="Masukkan API Token dari Fonnte"
                                value={fonnteTokenInput}
                                onChange={(e) => setFonnteTokenInput(e.target.value)}
                                className="flex-1"
                            />
                            <Button 
                              onClick={handleSaveFonnteToken} 
                              disabled={isSavingFonnte || !fonnteTokenInput} 
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                                {isSavingFonnte ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4 mr-2" />}
                                Simpan Token
                            </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground italic">
                            * Token Anda akan dienkripsi secara otomatis sebelum disimpan ke database kami demi keamanan.
                        </p>
                    </div>
                  </>
                )}
              </CardContent>
              <CardFooter className="bg-slate-50 border-t p-4">
                  <a href="https://fonnte.com" target="_blank" className="text-xs text-blue-600 flex items-center hover:underline">
                      Buka Dashboard Fonnte <ExternalLink className="h-3 w-3 ml-1" />
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
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
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
          {isSuperAdmin && (
            <TabsContent value="subscription" className="mt-0 outline-none">
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle>Perpanjang Langganan</CardTitle>
                  <CardDescription>Kelola masa aktif layanan aplikasi.</CardDescription>
                </CardHeader>
                <CardContent>
                  <SubscriptionExtensionForm />
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