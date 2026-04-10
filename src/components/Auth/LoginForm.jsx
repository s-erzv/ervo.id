import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';  
import { Loader2 } from 'lucide-react';
// 🚨 PERBAIKAN KRITIS: Mengganti import fungsi yang diekspor
import { setupOneSignal } from '../../lib/onesignal-setup.jsx'; 

const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();  

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }
      
      // Jika login berhasil, panggil setupOneSignal
      if (data.session && data.user) {
        console.log("✅ LOGIN SUCCESS: Memanggil setupOneSignal secara paksa."); 
        
        setupOneSignal(data.user.id); 

        navigate('/dashboard');
      }

    } catch (error) {
      console.error('Login Error:', error.message);
      setMessage(`Login Gagal: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-3 pb-2 px-6"> {/* PERUBAHAN DI SINI: space-y-3, pb-2, px-6 */}
      <div>
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
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-muted-foreground">
          Kata Sandi
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
      <Button type="submit" className="w-full bg-[#10182b] text-white hover:bg-[#20283b]" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Login'}
      </Button>
      {message && (
        <p className={`text-sm text-center ${message.startsWith('Login Gagal') ? 'text-red-500' : 'text-green-500'}`}>
          {message}
        </p>
      )}
    </form>
  );
};

export default LoginForm;