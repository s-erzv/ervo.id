import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RocketIcon, Building2, BarChart, ArrowRight, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format } from 'date-fns';

const SuperAdminDashboard = ({ profile, companies = [], salesData = [], setActiveCompany }) => {
  
  const totalCompanies = companies.length;
  
  const formatRupiah = (tick) => {
    if (tick >= 1000000) return `${(tick / 1000000).toFixed(1)} JT`;
    if (tick >= 1000) return `${(tick / 1000).toFixed(0)} K`;
    return `Rp ${tick}`;
  };

  // Generate random colors for the chart lines
  const COLORS = [
    '#015a97', '#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#F43F5E', '#64748B'
  ];

  return (
    <div className="space-y-6 container mx-auto md:p-8 max-w-7xl animate-in fade-in slide-in-from-bottom-2">
      <div className="space-y-1 mb-6">
        <h2 className="text-3xl font-semibold text-[#011e4b]">Dashboard Super Admin</h2>
        <p className="text-slate-500 font-medium">Selamat datang, <span className="text-slate-700">{profile.full_name}</span>! Berikut ringkasan sistem secara keseluruhan.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Tenants Card */}
        <Card className="border border-slate-200/60 shadow-sm bg-white rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wide">Total Tenant</CardTitle>
            <div className="p-2 bg-blue-50 rounded-lg">
                <Building2 className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <p className="text-3xl font-semibold text-slate-800">{totalCompanies}</p>
            <p className="text-xs text-slate-500 mt-1 font-medium">Perusahaan terdaftar di sistem</p>
          </CardContent>
        </Card>

        {/* Placeholder for other global stats if needed */}
        <Card className="border border-slate-200/60 shadow-sm bg-white rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-6 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wide">Status Sistem</CardTitle>
            <div className="p-2 bg-emerald-50 rounded-lg">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <p className="text-3xl font-semibold text-emerald-600">Online</p>
            <p className="text-xs text-slate-500 mt-1 font-medium">Semua layanan berjalan normal</p>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Revenue Chart */}
      <Card className="border border-slate-200/60 shadow-sm bg-white rounded-2xl overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
            <CardTitle className="text-lg font-medium text-[#011e4b] flex items-center gap-2">
                <BarChart className="h-5 w-5 text-[#015a97]" /> Pendapatan Langganan (30 Hari Terakhir)
            </CardTitle>
            <CardDescription className="font-medium text-slate-500">
                Akumulasi biaya langganan dari semua tenant
            </CardDescription>
        </CardHeader>
        <CardContent className="h-[400px] p-6">
            {salesData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={salesData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis 
                            dataKey="date" 
                            tickFormatter={(dateStr) => format(new Date(dateStr), 'd MMM')}
                            tick={{ fill: '#64748B', fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis 
                            tickFormatter={formatRupiah}
                            tick={{ fill: '#64748B', fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend />
                        {companies.map((company, index) => (
                            <Line 
                                key={company.id}
                                type="monotone" 
                                dataKey={company.name} 
                                stroke={COLORS[index % COLORS.length]} 
                                strokeWidth={2}
                                dot={{ r: 4 }}
                                activeDot={{ r: 6 }}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <BarChart className="h-12 w-12 mb-3 text-slate-300" />
                    <p className="font-medium">Belum ada data pendapatan langganan.</p>
                </div>
            )}
        </CardContent>
      </Card>

    </div>
  );
};

export default SuperAdminDashboard;