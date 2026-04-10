import React, { useState, useEffect } from 'react';
import { Truck, Box, Clock } from 'lucide-react'; 

const slides = [
  {
    icon: Truck, 
    title: 'Manajemen Distribusi & Pengiriman',
    description: 'Catat pesanan pelanggan, alokasikan Petugas, dan perbarui status pengiriman produk hanya dalam beberapa klik sederhana.',
  },
  {
    icon: Box, 
    title: 'Kontrol Stok & Aset Akurat',
    description: 'Pantau sisa stok produk dan status aset bergerak/aset inventaris lain di gudang atau Petugas secara terperinci.',
  },
  {
    icon: Clock, 
    title: 'Pencatatan Keuangan Terintegrasi',
    description: 'Rekam setiap transaksi penjualan, pengeluaran operasional, dan pembayaran dengan cepat untuk rekapitulasi laporan keuangan harian.',
  },
];

const HighlightSlider = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    }, 5000); 

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative overflow-hidden h-full rounded-3xl hidden md:block"
         style={{ 
           backgroundImage: 'url(/bg-login.svg)',
           backgroundSize: 'cover',
           backgroundPosition: 'center',
         }}
    >
        <div 
          className="absolute inset-0 flex transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {slides.map((slide, index) => {
            const IconComponent = slide.icon;
            return (
              <div key={index} className="w-full flex-shrink-0 h-full relative flex flex-col justify-end p-12">
                <div className="text-white space-y-4">
                    <IconComponent size={48} className="text-white mb-4" />
                    
                    <h3 className="text-3xl font-bold">{slide.title}</h3>
                    <p className="text-sm font-light text-gray-200">{slide.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-10">
            {slides.map((_, index) => (
                <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                        currentSlide === index ? 'bg-white' : 'bg-gray-500 hover:bg-white'
                    }`}
                ></button>
            ))}
        </div>
    </div>
  );
};

export default HighlightSlider;