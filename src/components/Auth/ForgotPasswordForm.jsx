import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

const ForgotPasswordForm = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleReset = async (event) => {
    event.preventDefault();
    setLoading(true);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw error;
      }
      
      setIsSuccess(true);
      toast.success("Tautan atur ulang kata sandi telah dikirim ke email Anda.");
    } catch (error) {
      console.error('Reset Password Error:', error.message);
      toast.error(`Gagal mengirim tautan: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="space-y-4 pb-4 px-6 text-center">
        <div className="bg-green-50 p-4 rounded-xl border border-green-100">
          <p className="text-green-800 font-medium text-sm">
            Tautan atur ulang kata sandi berhasil dikirim!
          </p>
          <p className="text-green-600 text-xs mt-2">
            Silakan periksa kotak masuk (atau folder spam) email Anda dan ikuti instruksi yang diberikan.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleReset} className="space-y-4 pb-2 px-6">
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-muted-foreground">
          Email
        </label>
        <Input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nama@email.com"
          required
        />
      </div>
      <Button type="submit" className="w-full bg-[#011e4b] text-white hover:bg-[#00376a] font-bold h-11" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Kirim Tautan Atur Ulang'}
      </Button>
    </form>
  );
};

export default ForgotPasswordForm;
