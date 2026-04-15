import { useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import Resizer from 'react-image-file-resizer';

const AddAdminForm = ({ open, onOpenChange, onUserAdded }) => {
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState(''); // NEW STATE
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [googleSheetsLink, setGoogleSheetsLink] = useState('');
  const [loading, setLoading] = useState(false);
   
  const handleLogoChange = async (event) => {
    const file = event.target.files[0];
    if (!file) {
      setLogoFile(null);
      return;
    }

    toast.loading('Mengubah ukuran logo...', { id: 'resizing-logo' });
    try { 
      const resizedImage = await new Promise((resolve) => {
        Resizer.imageFileResizer(
          file,
          400,  
          400,  
          'PNG',  
          90, 
          0,  
          (uri) => {
            resolve(uri);
          },
          'file' 
        );
      });
      setLogoFile(resizedImage); 
      toast.success('Logo siap diunggah!', { id: 'resizing-logo' });
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengubah ukuran logo.', { id: 'resizing-logo' });
      setLogoFile(null);
    }
  };

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      
      if (!accessToken) {
        throw new Error('User not authenticated');
      }

      const payload = { 
        email, 
        password, 
        role: 'admin', 
        companyName,
        companyAddress, // ADDED TO PAYLOAD
        full_name: fullName,
        phone: phoneNumber,
        googleSheetsLink,
      };

      const { data, error } = await supabase.functions.invoke('create-user', {
        body: payload
      });

      if (error) {
        throw new Error(error.message || 'Failed to create admin');
      }
      
      const { userId, companyId } = data;
      let logoUrl = null;

      if (logoFile && companyId) {
        const fileExt = logoFile.name.split('.').pop();
        const filePath = `company_logos/${companyId}-${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(filePath, logoFile, {
            cacheControl: '3600',
            upsert: false,
          });
        
        if (uploadError) {
          console.warn('Gagal mengunggah logo, melanjutkan tanpa logo:', uploadError);
          toast.error('Gagal mengunggah logo, tetapi admin berhasil ditambahkan.');
        } else {
          const { data: publicUrlData } = supabase.storage
            .from('logos')
            .getPublicUrl(filePath);
          
          logoUrl = publicUrlData.publicUrl;

          // Anda perlu memastikan Edge Function `create-user` juga mengupdate kolom 'address' di tabel 'companies'
          // saat ini, hanya 'logo_url' yang diupdate di sini.
          if (logoUrl) {
            const { error: updateError } = await supabase
                .from('companies')
                .update({ logo_url: logoUrl })
                .eq('id', companyId);
            
            if (updateError) {
                console.error('Gagal memperbarui URL logo:', updateError);
            }
          }
        }
      }

      toast.success('Admin dan perusahaan berhasil ditambahkan!');
      onUserAdded({ id: userId, email, full_name: fullName, role: 'admin' });
      resetForm();

    } catch (error) {
      console.error('Error adding admin:', error.message);
      toast.error('Gagal menambahkan admin: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const resetForm = () => {
    setCompanyName('');
    setCompanyAddress(''); // RESET NEW STATE
    setEmail('');
    setPassword('');
    setFullName('');
    setPhoneNumber('');
    setLogoFile(null);
    setGoogleSheetsLink('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        onInteractOutside={(e) => { e.preventDefault(); }} 
        onEscapeKeyDown={(e) => { e.preventDefault(); }} 
        // FIX: Tambahkan batasan tinggi dan scroll
        className="sm:max-w-lg max-h-[90vh] overflow-y-auto" 
      >
        <DialogHeader>
          <DialogTitle>Tambah Admin Baru</DialogTitle>
          <DialogDescription>
            Isi formulir untuk membuat akun admin dan perusahaan baru.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleAddAdmin} className="space-y-4">
          <div>
            <Label>Nama Perusahaan</Label>
            <Input
              type="text"
              placeholder="Nama Perusahaan"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
          </div>
          {/* START: ADDED ADDRESS INPUT */}
          <div>
            <Label>Alamat Perusahaan</Label>
            <Input
              type="text"
              placeholder="Alamat Lengkap Perusahaan"
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              required
            />
          </div>
          {/* END: ADDED ADDRESS INPUT */}
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
              placeholder="mis. 081234567890"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              required
            />
          </div>
          <div>
            <Label>Email Admin</Label>
            <Input
              type="email"
              placeholder="nama@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <Label>Kata Sandi</Label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="logo">Logo Perusahaan (Opsional)</Label>
            <Input
              id="logo"
              type="file"
              onChange={handleLogoChange} // Use the new handler
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
              required
            />
          </div>
          <div className="flex justify-end gap-2">
             <Button type="button" variant="outline" onClick={resetForm} disabled={loading}>
              Batal
            </Button>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tambah Admin'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddAdminForm;