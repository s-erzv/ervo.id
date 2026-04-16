import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import LoginForm from '@/components/Auth/LoginForm';
import SignUpForm from '@/components/Auth/SignUpForm'; 
import { Button } from '@/components/ui/button';
import { Phone, FileText, MessageSquare, Megaphone } from 'lucide-react'; 
import HighlightSlider from '@/components/HighlightSlider';


const AuthPage = () => {
  const [isLoginForm, setIsLoginForm] = useState(true);

  const handleSignUpSuccess = () => {
    setIsLoginForm(true);
  };
  
  return (
    // CONTAINER UTAMA: Menggunakan layout dua kolom penuh (h-screen)
    <div className="w-full flex h-screen p-0 md:p-2 bg-[#011e4b] overflow-hidden gap-2">

        {/* KOLOM KIRI (SLIDER) - Tersembunyi di mobile, muncul 5/12 di md+ */}
        <div className='w-0 md:w-5/12 hidden md:block h-full'>
            <HighlightSlider />
        </div>

        {/* KOLOM KANAN (FORMULIR) - Mengisi sisa ruang, latar putih */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 bg-white rounded-none md:rounded-3xl shadow-lg h-full md:h-full overflow-y-auto">
            
            <Card className="w-full max-w-sm sm:max-w-md border-0 shadow-none">
              <CardHeader className="text-center"> 
                <img
                  src="/header.svg"
                  alt="Logo"
                  width={200}
                  className="mx-auto mb-4"
                />
                <CardTitle className="text-2xl font-bold text-[#011e4b]">
                  {isLoginForm ? 'Selamat Datang Kembali' : 'Mulai Sekarang'}
                </CardTitle>
                <CardDescription className="text-sm text-gray-500 mt-2">
                  {isLoginForm 
                    ? 'Silakan masuk untuk mengelola operasional distribusi Anda.' 
                    : 'Daftarkan perusahaan Anda dan optimalkan manajemen distribusi dalam satu platform.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoginForm ? (
                  <LoginForm />
                ) : (
                  <SignUpForm onSignUpSuccess={handleSignUpSuccess} />
                )}
                
                {/* Toggle Button */}
                <div className="mt-1 text-center">
                  <Button
                    variant="link"
                    className="text-[#011e4b]"
                    onClick={() => setIsLoginForm(!isLoginForm)}
                  >
                    {isLoginForm 
                      ? 'Belum punya akun? Daftar Perusahaan Baru' 
                      : 'Sudah punya akun? Masuk di sini'}
                  </Button>
                </div>

              </CardContent>
            </Card>
            
            <div className="mt-8 text-center text-sm text-muted-foreground">
              <p>Butuh bantuan?</p>
              <a
                href="https://api.whatsapp.com/send?phone=6285117677245"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 font-medium text-[#011e4b] hover:underline"
              >
                <Phone className="h-4 w-4" />
                Hubungi Kami
              </a>
            </div>
        </div>
    </div>
  );
};

export default AuthPage;