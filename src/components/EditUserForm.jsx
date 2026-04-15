import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

// PERBAIKAN: Pastikan nama prop yang diterima adalah 'user' (sesuai pengirimnya)
const EditUserForm = ({ open, onOpenChange, user, onUserUpdated }) => {
  const { userRole } = useAuth();
  const [fullName, setFullName] = useState('');
  const [rekening, setRekening] = useState('');
  const [baseSalary, setBaseSalary] = useState('');
  const [phone, setPhone] = useState(''); // Tambahan field telepon
  const [logoFile, setLogoFile] = useState(null);
  const [loading, setLoading] = useState(false);

  // SINKRONISASI DATA: Akan berjalan setiap kali modal dibuka atau user dipilih
  useEffect(() => {
    if (user && open) {
      setFullName(user.full_name || '');
      setRekening(user.rekening || '');
      setBaseSalary(user.base_salary || '');
      setPhone(user.phone || '');
    }
  }, [user, open]);

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!user?.id) throw new Error('User ID tidak ditemukan');

      const salaryValue = baseSalary ? parseFloat(baseSalary) : null;

      // 1. Update Tabel Profiles
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          rekening: rekening,
          base_salary: salaryValue,
          phone: phone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;
      
      // 2. Update Logo (Khusus Super Admin mengedit Admin)
      if (userRole === 'super_admin' && user.role === 'admin' && logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const filePath = `company_logos/${crypto.randomUUID()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(filePath, logoFile);
          
        if (uploadError) throw new Error('Gagal upload logo: ' + uploadError.message);
        
        const { data: publicUrlData } = supabase.storage.from('logos').getPublicUrl(filePath);
          
        await supabase
          .from('companies')
          .update({ logo_url: publicUrlData.publicUrl })
          .eq('id', user.company_id);
      }

      toast.success('Data pengguna berhasil diperbarui!');
      onUserUpdated(); // Refresh list di parent
      onOpenChange(false);
    } catch (error) {
      console.error('Error:', error.message);
      toast.error('Gagal memperbarui: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Profil Pengguna</DialogTitle>
          <DialogDescription>
            ID: {user?.id?.substring(0, 8)}... | Role: {user?.role}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleUpdateUser} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Nama Lengkap</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Masukkan nama lengkap"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label>Nomor Telepon</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0812..."
            />
          </div>

          <div className="space-y-2">
            <Label>Nomor Rekening</Label>
            <Input
              value={rekening}
              onChange={(e) => setRekening(e.target.value)}
              placeholder="Contoh: BCA - 12345678"
            />
          </div>

          <div className="space-y-2">
            <Label>Gaji Pokok</Label>
            <Input
              type="number"
              value={baseSalary}
              onChange={(e) => setBaseSalary(e.target.value)}
              placeholder="4000000"
            />
          </div>

          {userRole === 'super_admin' && user?.role === 'admin' && (
            <div className="space-y-2 border-t pt-2">
              <Label className="text-blue-600">Logo Perusahaan (Admin Only)</Label>
              <Input
                type="file"
                onChange={(e) => setLogoFile(e.target.files[0])}
                accept="image/*"
                className="cursor-pointer"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={loading} className="bg-[#011e4b] text-white">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Simpan Perubahan
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditUserForm;