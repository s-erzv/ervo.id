import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ChevronDown } from 'lucide-react'; 
import { toast } from 'react-hot-toast'; 

// Komponen Pembungkus untuk Accordion Item
const AccordionItem = ({ title, children, isOpen, onToggle }) => {
    return (
        <div className="border border-gray-200 rounded-lg overflow-hidden transition-all duration-300">
            {/* Header Accordion */}
            <button 
                type="button" 
                onClick={onToggle} 
                className="flex justify-between items-center w-full p-4 text-sm font-semibold text-[#011e4b] bg-gray-50 hover:bg-gray-100 transition-colors"
            >
                {title}
                <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : 'rotate-0'}`} />
            </button>
            {/* Konten (Collapsible) */}
            <div 
                // Menggunakan CSS Grid untuk transisi ketinggian yang halus
                className={`grid transition-all duration-300 ease-in-out ${
                    isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                }`}
            >
                {/* Wrapper untuk konten yang tidak berubah tingginya */}
                <div className="overflow-hidden">
                    <div className="p-4 space-y-3"> 
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
};


const SignUpForm = ({ onSignUpSuccess }) => {
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(''); 
  const [logoFile, setLogoFile] = useState(null); 
  const [googleSheetsLink, setGoogleSheetsLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(''); 

  // State untuk mengontrol Accordion. Default buka di Informasi Perusahaan.
  const [openSection, setOpenSection] = useState(' '); 

   const handleLogoChange = (event) => {
    const file = event.target.files[0];
    setLogoFile(file); 
  };

  const resetForm = () => {
    setCompanyName('');
    setCompanyAddress('');
    setEmail('');
    setPassword('');
    setFullName('');
    setPhoneNumber('');
    setLogoFile(null);
    setGoogleSheetsLink('');
    setLoading(false);
    setMessage('');
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // Form validation checks before proceeding
    if (!companyName || !companyAddress) {
        toast.error('Harap lengkapi Informasi Perusahaan.');
        setOpenSection('company');
        setLoading(false);
        return;
    }
    if (!fullName || !phoneNumber || !email || !password) {
        toast.error('Harap lengkapi Data Admin & Login.');
        setOpenSection('admin');
        setLoading(false);
        return;
    }

    let finalLogoUrl = null;

    try {
      // 1. **UPLOAD LOGO** (Jika ada)
      if (logoFile) {
        const tempCompanyId = crypto.randomUUID(); 
        const fileExt = logoFile.name.split('.').pop(); 
        const filePath = `company_logos/${tempCompanyId}-${crypto.randomUUID()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('logos')
          .upload(filePath, logoFile, {
            cacheControl: '3600',
            upsert: false, 
          });
        
        if (uploadError) {
          console.warn('Gagal mengunggah logo, melanjutkan tanpa logo:', uploadError);
          toast.error('Gagal mengunggah logo, tetapi data admin akan dibuat.');
        } else {
          const { data: publicUrlData } = supabase.storage
            .from('logos')
            .getPublicUrl(uploadData.path);
          
          finalLogoUrl = publicUrlData.publicUrl;
        }
      }

      // 2. **PANGGIL EDGE FUNCTION**
      const payload = { 
        email, password, role: 'admin', companyName, companyAddress,
        full_name: fullName, phone: phoneNumber, googleSheetsLink, logoUrl: finalLogoUrl, 
      };
 
      const anonKey = supabase.supabaseKey; 
 
      const response = await fetch('https://eyfjudhnkxvsdqusqnoy.supabase.co/functions/v1/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey, 
          'Authorization': `Bearer ${anonKey}`, 
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create admin');
      }
      
      toast.success('Registrasi Admin dan perusahaan berhasil! Silakan login.');
      setMessage('Registrasi Admin dan perusahaan berhasil! Silakan login.');
       
      if (onSignUpSuccess) {
          onSignUpSuccess();
      } else {
          resetForm();
      }

    } catch (error) {
      console.error('Sign Up Error:', error.message);
      setMessage(`Registrasi Gagal: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };


  return (
    <form onSubmit={handleSignUp} className="space-y-4 pb-2 px-6"> 
      <p className="text-center text-sm font-medium text-gray-700">
        Registrasi Akun Admin dan Perusahaan Baru
      </p>
       
      {/* 1. Accordion: Informasi Perusahaan */}
      <AccordionItem
        title="1. Informasi Perusahaan (Wajib)"
        isOpen={openSection === 'company'}
        onToggle={() => setOpenSection(openSection === 'company' ? null : 'company')}
      >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
              <div className="md:col-span-2"> 
                  <Label>Nama Perusahaan</Label>
                  <Input
                    type="text"
                    placeholder="Nama Perusahaan"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                  />
              </div>
              <div className="md:col-span-2">
                  <Label>Alamat Perusahaan</Label>
                  <Input
                    type="text"
                    placeholder="Alamat Lengkap Perusahaan"
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    required
                  />
              </div>
          </div>
      </AccordionItem>

      {/* 2. Accordion: Data Admin & Login */}
      <AccordionItem
        title="2. Data Admin & Login (Wajib)"
        isOpen={openSection === 'admin'}
        onToggle={() => setOpenSection(openSection === 'admin' ? null : 'admin')}
      >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3"> 
              <div>
                  <Label>Nama Lengkap Admin</Label>
                  <Input
                    type="text"
                    placeholder="Nama Lengkap"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
              </div>
              <div>
                  <Label>Nomor Telepon Admin</Label>
                  <Input
                    type="tel"
                    placeholder="mis. 0812..."
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    required
                  />
              </div>
              <div className="md:col-span-2"> 
                  <Label>Email Admin</Label>
                  <Input
                    type="email"
                    placeholder="nama@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
              </div>
              <div className="md:col-span-2">
                  <Label>Kata Sandi</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
              </div>
          </div>
      </AccordionItem>
      
      {/* 3. Accordion: Integrasi (Opsional) */}
      <AccordionItem
        title="3. Integrasi (Opsional)"
        isOpen={openSection === 'optional'}
        onToggle={() => setOpenSection(openSection === 'optional' ? null : 'optional')}
      >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
              <div>
                  <Label htmlFor="logo">Logo Perusahaan</Label>
                  <Input
                    id="logo"
                    type="file"
                    onChange={handleLogoChange}
                    accept="image/*"
                  />
              </div>
              <div>
                  <Label htmlFor="google-sheets-link">Link Google Sheets</Label>
                  <Input
                    id="google-sheets-link"
                    type="url"
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    value={googleSheetsLink}
                    onChange={(e) => setGoogleSheetsLink(e.target.value)} 
                  />
              </div>
          </div>
      </AccordionItem>

      <Button type="submit" className="w-full bg-[#011e4b] text-white hover:bg-[#00376a]" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Daftar Admin & Perusahaan'}
      </Button>
      {message && (
        <p className={`text-sm text-center ${message.startsWith('Registrasi Gagal') ? 'text-red-500' : 'text-green-500'}`}>
          {message}
        </p>
      )}
    </form>
  );
};

export default SignUpForm;