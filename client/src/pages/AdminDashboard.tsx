import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { motion } from "framer-motion";
import { Users, DollarSign, Clock, CalendarCheck } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: [api.dashboard.stats.path],
    queryFn: async () => {
      const res = await fetch(api.dashboard.stats.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return await res.json();
    }
  });

  // Mock data for chart
  const chartData = [
    { name: 'Mon', revenue: 4000 },
    { name: 'Tue', revenue: 3000 },
    { name: 'Wed', revenue: 2000 },
    { name: 'Thu', revenue: 2780 },
    { name: 'Fri', revenue: 1890 },
    { name: 'Sat', revenue: 2390 },
    { name: 'Sun', revenue: 3490 },
  ];

  return (
    <div className="pl-0 md:pl-64 p-6 pt-20 md:pt-6 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Overview of your fitness empire.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          icon={<Users size={24} className="text-blue-500" />} 
          label="Active Clients" 
          value={stats?.activeClients || 0} 
        />
        <StatCard 
          icon={<DollarSign size={24} className="text-green-500" />} 
          label="Total Revenue" 
          value={`${stats?.totalRevenue || 0} AED`} 
        />
        <StatCard 
          icon={<Clock size={24} className="text-amber-500" />} 
          label="Pending Payments" 
          value={stats?.pendingPayments || 0} 
        />
        <StatCard 
          icon={<CalendarCheck size={24} className="text-purple-500" />} 
          label="Upcoming Sessions" 
          value={stats?.upcomingSessions || 0} 
        />
      </div>

      {/* Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-white/5 p-6 rounded-3xl shadow-sm">
          <h3 className="text-lg font-bold mb-6">Weekly Revenue</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#666" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `AED ${value}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '12px' }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-white/5 p-6 rounded-3xl shadow-sm">
          <h3 className="text-lg font-bold mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl transition-colors">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                  <Users size={18} />
                </div>
                <div>
                  <p className="font-medium text-sm">New client registration</p>
                  <p className="text-xs text-muted-foreground">2 hours ago</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-white/5 p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-4 mb-2">
        <div className="p-3 bg-white/5 rounded-2xl">
          {icon}
        </div>
        <span className="text-sm text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="text-3xl font-display font-bold ml-1">{value}</p>
    </motion.div>
  );
}
