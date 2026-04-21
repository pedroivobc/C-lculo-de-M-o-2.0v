import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { TrendingUp, Users, DollarSign, Calculator, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';

export function Analytics() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCalculations: 0,
    totalUsers: 0,
    totalRevenue: 0,
    activeUsers: 0
  });
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch total calculations
      const { count: calcCount } = await supabase
        .from('calculations')
        .select('*', { count: 'exact', head: true });

      // Fetch total users (from profiles)
      const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Fetch total revenue
      const { data: orders } = await supabase
        .from('orders')
        .select('amount');
      
      const totalRev = orders?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0;

      setStats({
        totalCalculations: calcCount || 0,
        totalUsers: userCount || 0,
        totalRevenue: totalRev,
        activeUsers: Math.floor((userCount || 0) * 0.4) // Mock active users for demo
      });

      // Mock chart data for demo
      setChartData([
        { name: 'Seg', value: 400, rev: 2400 },
        { name: 'Ter', value: 300, rev: 1398 },
        { name: 'Qua', value: 200, rev: 9800 },
        { name: 'Qui', value: 278, rev: 3908 },
        { name: 'Sex', value: 189, rev: 4800 },
        { name: 'Sáb', value: 239, rev: 3800 },
        { name: 'Dom', value: 349, rev: 4300 },
      ]);

      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col gap-2">
        <h2 className="text-3xl font-serif text-white">Analytics</h2>
        <p className="text-white/60">Visão geral do desempenho do sistema.</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Cálculos Realizados', value: stats.totalCalculations, icon: Calculator, color: 'text-blue-400' },
          { label: 'Usuários Totais', value: stats.totalUsers, icon: Users, color: 'text-purple-400' },
          { label: 'Receita Total', value: `R$ ${stats.totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-green-400' },
          { label: 'Usuários Ativos', value: stats.activeUsers, icon: TrendingUp, color: 'text-[#D4AF37]' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white/[0.03] border border-white/10 p-6 rounded-3xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className={`p-3 rounded-2xl bg-white/5 ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
            </div>
            <div>
              <p className="text-white/40 text-xs uppercase tracking-widest">{stat.label}</p>
              <p className="text-2xl font-serif text-white font-bold">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white/[0.03] border border-white/10 p-8 rounded-3xl space-y-6">
          <h3 className="text-xl font-serif text-white">Volume de Cálculos</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="name" stroke="#ffffff40" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#ffffff40" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #ffffff10', borderRadius: '12px' }}
                  itemStyle={{ color: '#D4AF37' }}
                />
                <Area type="monotone" dataKey="value" stroke="#D4AF37" fillOpacity={1} fill="url(#colorValue)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white/[0.03] border border-white/10 p-8 rounded-3xl space-y-6">
          <h3 className="text-xl font-serif text-white">Receita por Período</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="name" stroke="#ffffff40" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#ffffff40" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #ffffff10', borderRadius: '12px' }}
                  itemStyle={{ color: '#D4AF37' }}
                />
                <Bar dataKey="rev" fill="#D4AF37" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
