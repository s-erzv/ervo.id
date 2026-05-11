// src/components/AddUserForm.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
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
import { Loader2, AlertTriangle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const AddUserForm = ({ open, onOpenChange, onUserAdded }) => {
  const { companyId } = useAuth();
  const { getLimit, loading: subLoading } = useSubscription();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rekening, setRekening] = useState(''); 
  const [baseSalary, setBaseSalary] = useState(''); // STATE BARU UNTUK GAJI POKOK
  const [loading, setLoading] = useState(false);
  const [currentUserCount, setCurrentUserCount] = useState(0);

  useEffect(() => {
    if (open && companyId) {
      fetchUserCount();
    }
  }, [open, companyId]);

  const fetchUserCount = async () => {
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId);
    
    if (!error) {
      setCurrentUserCount(count || 0);
    }
  };

  const maxUsers = getLimit('max_users');
  const isLimitReached = maxUsers > 0 && currentUserCount >= maxUsers;

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (isLimitReached) {
      toast.error(`Limit pengguna tercapai (${maxUsers}). Silakan upgrade plan Anda.`);
      return;
    }
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      
      if (!accessToken) {
        throw new Error('User not authenticated');
      }

      // Format gaji pokok sebagai angka
      const salaryValue = baseSalary ? parseFloat(baseSalary) : null;
      
      const { data, error: invokeError } = await supabase.functions.invoke('create-user', {
        body: { 
          email, 
          password, 
          role: 'user', 
          companyId,
          full_name: fullName,
          rekening: rekening,
          base_salary: salaryValue, // KIRIM GAJI POKOK KE EDGE FUNCTION
        },
      });

      if (invokeError) {
        throw new Error(invokeError.message || 'Failed to create user');
      }

      toast.success('Pengguna berhasil ditambahkan!');
      onUserAdded({ id: data.userId, email, full_name: fullName, rekening: rekening, role: 'user', base_salary: salaryValue });
      
      // Reset State
      setEmail('');
      setPassword('');
      setFullName('');
      setRekening(''); 
      setBaseSalary(''); // RESET GAJI POKOK
      onOpenChange(false);

    } catch (error) {
      console.error('Error adding user:', error.message);
      toast.error('Gagal menambahkan pengguna: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Pengguna Baru</DialogTitle>
          <DialogDescription>
            Isi formulir untuk membuat akun pengguna baru.
          </DialogDescription>
        </DialogHeader>

        {isLimitReached && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Limit Tercapai</AlertTitle>
            <AlertDescription>
              Anda telah mencapai batas maksimal pengguna ({maxUsers}) untuk plan saat ini.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleAddUser} className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Nama Lengkap</Label>
            <Input
              type="text"
              placeholder="Nama Lengkap"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={isLimitReached}
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Email</Label>
            <Input
              type="email"
              placeholder="nama@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLimitReached}
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Kata Sandi</Label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLimitReached}
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Nomor Rekening</Label>
            <Input
              type="text"
              placeholder="Nomor Rekening"
              value={rekening}
              onChange={(e) => setRekening(e.target.value)}
              disabled={isLimitReached}
            />
          </div>
          {/* FIELD BARU: GAJI POKOK */}
          <div>
            <Label className="text-sm font-medium">Gaji Pokok</Label>
            <Input
              type="number"
              placeholder="Contoh: 4000000"
              value={baseSalary}
              onChange={(e) => setBaseSalary(e.target.value)}
              disabled={isLimitReached}
            />
          </div>
          <Button type="submit" disabled={loading || isLimitReached || subLoading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isLimitReached ? 'Limit Tercapai' : 'Tambah Pengguna'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddUserForm;