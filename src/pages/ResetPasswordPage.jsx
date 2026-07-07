import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const ResetPasswordPage = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Memastikan bahwa pengguna sedang dalam sesi pemulihan sandi
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        toast.error("Sesi tidak valid atau telah kedaluwarsa. Silakan minta tautan baru.");
        navigate('/auth');
      }
    });
  }, [navigate]);

  const handleResetPassword = async (event) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Kata sandi tidak cocok.');
      return;
    }

    if (password.length < 6) {
      toast.error('Kata sandi minimal 6 karakter.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        throw error;
      }

      toast.success("Kata sandi berhasil diubah! Anda bisa login sekarang.");
      
      // Logout explicitly after resetting so they can login properly if needed
      await supabase.auth.signOut();
      
      navigate('/auth');
    } catch (error) {
      console.error('Reset Password Error:', error.message);
      toast.error(`Gagal mengubah kata sandi: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex h-screen p-0 md:p-2 bg-[#011e4b] overflow-hidden justify-center items-center">
      <Card className="w-full max-w-sm sm:max-w-md border-0 shadow-lg rounded-3xl p-4">
        <CardHeader className="text-center">
          <img
            src="/header.svg"
            alt="Logo"
            width={200}
            className="mx-auto mb-4"
          />
          <CardTitle className="text-2xl font-bold text-[#011e4b]">
            Buat Kata Sandi Baru
          </CardTitle>
          <CardDescription className="text-sm text-gray-500 mt-2">
            Silakan masukkan kata sandi baru untuk akun Anda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-muted-foreground">
                Kata Sandi Baru
              </label>
              <Input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-muted-foreground">
                Konfirmasi Kata Sandi Baru
              </label>
              <Input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <Button type="submit" className="w-full bg-[#011e4b] text-white hover:bg-[#00376a] font-bold h-11" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan Kata Sandi'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPasswordPage;
