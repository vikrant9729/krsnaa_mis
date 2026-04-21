'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '../store/auth';
import dynamic from 'next/dynamic';
import api from '../api';
import { FiGrid, FiActivity, FiDatabase, FiUpload, FiCpu, FiPlus, FiBarChart2, FiUsers, FiShield } from 'react-icons/fi';

const Layout = dynamic(() => import('../components/Layout'), { ssr: false });

export default function Dashboard() {
  const router = useRouter();
  const { isAuthenticated, user, hasHydratedAuth } = useAuthStore();
  const [stats, setStats] = useState({
    centers: 0,
    tests: 0,
    dos_entries: 0,
    users: 0
  });

  useEffect(() => {
    if (hasHydratedAuth && !isAuthenticated) {
      router.push('/login');
    }
    if (isAuthenticated) {
      loadStats();
    }
  }, [isAuthenticated, hasHydratedAuth, router]);

  const loadStats = async () => {
    try {
      const response = await api.get('/api/stats/dashboard');
      const d = response.data;
      setStats({
        centers: d.total_centers || 0,
        tests: d.total_master_tests || 0,
        dos_entries: d.total_dos_rows || 0,
        users: 0 
      });
    } catch (error) {
      console.error('Failed to load stats');
    }
  };

  if (!hasHydratedAuth || !isAuthenticated) return null;

  const quickActions = [
    { name: 'Register Center', icon: FiPlus, href: '/centers', color: 'bg-[#5CB85C]', text: 'text-white' },
    { name: 'Upload DOS', icon: FiUpload, href: '/dos/upload', color: 'bg-[#00B4C1]', text: 'text-white' },
    { name: 'Quality Scan', icon: FiShield, href: '/quality', color: 'bg-[#E37222]', text: 'text-white' },
    { name: 'Audit Logs', icon: FiActivity, href: '/audit', color: 'bg-slate-700', text: 'text-white' },
  ];

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Intelligence Dashboard</h1>
            <p className="text-slate-500 font-medium mt-1">Welcome back, {user?.full_name}. Here's what's happening today.</p>
          </div>
          <div className="px-4 py-2 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center space-x-3">
              <div className="w-2 h-2 bg-[#5CB85C] rounded-full animate-pulse" />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Live Monitoring Active</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Active Centers', value: stats.centers, icon: FiGrid, color: 'text-[#00B4C1]', bg: 'bg-[#EBF7F7]' },
            { label: 'Total Test Masters', value: stats.tests, icon: FiDatabase, color: 'text-[#5CB85C]', bg: 'bg-[#F0F9F0]' },
            { label: 'DOS Data Points', value: stats.dos_entries, icon: FiActivity, color: 'text-[#E37222]', bg: 'bg-[#FFF3EB]' },
            { label: 'System Users', value: stats.users, icon: FiUsers, color: 'text-slate-600', bg: 'bg-slate-50' },
          ].map((stat, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all group">
              <div className={`w-12 h-12 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{stat.label}</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{stat.value.toLocaleString()}</h3>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Quick Actions */}
            <div className="lg:col-span-1 bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
                    <FiCpu className="mr-2 text-[#00B4C1]" />
                    Quick Operations
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    {quickActions.map((action, i) => (
                        <button
                            key={i}
                            onClick={() => router.push(action.href)}
                            className={`${action.color} ${action.text} p-4 rounded-2xl flex flex-col items-center justify-center space-y-2 hover:opacity-90 transition-all shadow-sm active:scale-95`}
                        >
                            <action.icon className="w-6 h-6" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-center">{action.name}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* System Intelligence Feed */}
            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#F4F9F8] rounded-full -mr-16 -mt-16 opacity-50" />
                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
                    <FiBarChart2 className="mr-2 text-[#5CB85C]" />
                    Network Activity Hub
                </h3>
                <div className="space-y-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-[#00B4C1] shadow-sm">
                                <FiUpload />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-800">New DOS Dataset Uploaded</p>
                                <p className="text-xs text-slate-400">Center: Pune Municipal Corp</p>
                            </div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">2 MIN AGO</span>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-[#5CB85C] shadow-sm">
                                <FiGrid />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-800">Master Test Updated</p>
                                <p className="text-xs text-slate-400">CBC - 5 Part Differential</p>
                            </div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">1 HOUR AGO</span>
                    </div>
                </div>
                <button className="w-full mt-6 py-3 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs font-bold uppercase tracking-widest hover:border-[#00B4C1] hover:text-[#00B4C1] transition-all">
                    View Full System Activity
                </button>
            </div>
        </div>
      </div>
    </Layout>
  );
}
