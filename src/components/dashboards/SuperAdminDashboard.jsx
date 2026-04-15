import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RocketIcon, Package, ShoppingCart, CheckCircle2, Clock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const SuperAdminDashboard = ({ profile, data }) => {
  const [selectedProductId, setSelectedProductId] = useState(data.products[0]?.id);
  const selectedProduct = data.products.find(p => p.id === selectedProductId);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <div className="space-y-1 mb-6">
        <h2 className="text-3xl font-semibold text-[#011e4b]">Dashboard Super Admin</h2>
        <p className="text-slate-500 font-medium">Selamat datang, <span className="text-slate-700">{profile.full_name}</span>! Berikut ringkasan sistem secara keseluruhan.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Total Order */}
        <Card className="border border-slate-200/60 shadow-sm bg-white rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wide">Total Order Hari Ini</CardTitle>
            <div className="p-2 bg-blue-50 rounded-lg">
                <ShoppingCart className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <p className="text-3xl font-semibold text-slate-800">{data.totalOrdersToday}</p>
          </CardContent>
        </Card>

        {/* Card 2: Stok Produk (Interactive) */}
        <Card className="border border-slate-200/60 shadow-sm bg-white rounded-2xl">
          <CardHeader className="p-6 pb-2 space-y-3">
            <div className="flex justify-between items-center w-full">
                <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wide">Cek Stok Produk</CardTitle>
                <div className="p-2 bg-amber-50 rounded-lg">
                    <Package className="h-4 w-4 text-amber-600" />
                </div>
            </div>
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger className="w-full h-9 border-slate-200 bg-slate-50 text-sm font-medium focus:ring-[#015a97]">
                <SelectValue placeholder="Pilih Produk" />
              </SelectTrigger>
              <SelectContent>
                {data.products.map(product => (
                  <SelectItem key={product.id} value={product.id} className="font-medium text-slate-700">
                      {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="p-6 pt-2">
            <div className="flex items-baseline gap-2">
                <p className="text-3xl font-semibold text-slate-800">{selectedProduct?.stock ?? 0}</p>
                <span className="text-sm font-medium text-slate-500">Unit</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Order Lunas */}
        <Card className="border border-slate-200/60 shadow-sm bg-white rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wide">Order Lunas</CardTitle>
            <div className="p-2 bg-emerald-50 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <p className="text-3xl font-semibold text-slate-800">{data.paidOrders}</p>
          </CardContent>
        </Card>

        {/* Card 4: Order Pending */}
        <Card className="border border-slate-200/60 shadow-sm bg-white rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wide">Order Pending</CardTitle>
            <div className="p-2 bg-rose-50 rounded-lg">
                <Clock className="h-4 w-4 text-rose-600" />
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <p className="text-3xl font-semibold text-slate-800">{data.unpaidOrders}</p>
          </CardContent>
        </Card>
      </div>

      <Alert className="bg-[#015a97]/5 border-[#015a97]/20 rounded-xl mt-6">
        <RocketIcon className="h-4 w-4 text-[#015a97]" />
        <AlertTitle className="text-[#011e4b] font-semibold">Akses Penuh Super Admin</AlertTitle>
        <AlertDescription className="text-slate-600 font-medium">
          Anda memiliki otoritas penuh untuk mengelola master data, langganan tenant, dan integrasi sistem. Pastikan untuk selalu berhati-hati saat mengubah konfigurasi global.
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default SuperAdminDashboard;