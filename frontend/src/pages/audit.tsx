'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '../store/auth';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import api from '../api';
import { FiDownload, FiSearch, FiCalendar, FiClock, FiUser, FiActivity, FiDatabase, FiRefreshCw, FiChevronRight } from 'react-icons/fi';

const Layout = dynamic(() => import('../components/Layout'), { ssr: false });

interface AuditLog {
  id: number;
  created_at: string;
  actor_id: number;
  actor_type: string;
  action: string;
  entity_type: string;
  entity_id: string;
  change_summary: string;
  old_value: any;
  new_value: any;
}

export default function AuditLogs() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    date_from: '',
    date_to: '',
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    loadAuditLogs();
  }, [isAuthenticated, router]);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);

      const response = await api.get(`/api/audit/logs?${params}`);
      setLogs(response.data);
    } catch (error) {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = async () => {
    try {
      toast.loading('Preparing secure audit export...', { id: 'audit-export' });
      const params = new URLSearchParams();
      if (filters.date_from) params.append('date_from', filters.date_from);
      if (filters.date_to) params.append('date_to', filters.date_to);

      const response = await api.get(`/api/audit/export?${params}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Audit_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Audit Trail Exported', { id: 'audit-export' });
    } catch (error) {
      toast.error('Export Failed', { id: 'audit-export' });
    }
  };

  const getActionTheme = (action: string) => {
    if (action.includes('CREATE')) return 'bg-[#F0F9F0] text-[#5CB85C] border-[#5CB85C]/10';
    if (action.includes('UPDATE')) return 'bg-[#EBF7F7] text-[#00828A] border-[#00B4C1]/10';
    if (action.includes('DELETE')) return 'bg-rose-50 text-rose-600 border-rose-100';
    if (action.includes('UPLOAD')) return 'bg-indigo-50 text-indigo-600 border-indigo-100';
    return 'bg-slate-50 text-slate-600 border-slate-100';
  };

  if (!isAuthenticated) return null;

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">System Audit Trail</h1>
            <p className="text-slate-500 font-medium">Immutable event logging for enterprise governance and compliance</p>
          </div>
          <button
            onClick={downloadExcel}
            className="flex items-center px-8 py-3 bg-[#5CB85C] text-white font-bold tracking-widest uppercase text-xs rounded-xl hover:bg-[#4CAE4C] shadow-sm transition-all active:scale-95"
          >
            <FiDownload className="mr-2" />
            Generate Report
          </button>
        </div>

        {/* Global Filter Matrix */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-end gap-6">
            <div className="flex-1 w-full space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 tracking-widest uppercase ml-1">Date From</label>
              <div className="relative">
                <FiCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-[#00B4C1]" />
                <input
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-transparent focus:border-[#00B4C1]/30 rounded-2xl outline-none font-bold text-slate-700"
                />
              </div>
            </div>
            <div className="flex-1 w-full space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 tracking-widest uppercase ml-1">Date To</label>
              <div className="relative">
                <FiCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-[#00B4C1]" />
                <input
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-transparent focus:border-[#00B4C1]/30 rounded-2xl outline-none font-bold text-slate-700"
                />
              </div>
            </div>
            <button
              onClick={loadAuditLogs}
              className="w-full md:w-auto px-8 py-3 bg-white border border-slate-200 text-slate-600 font-bold uppercase tracking-widest text-xs rounded-2xl hover:bg-slate-50 transition-all flex items-center justify-center"
            >
              <FiRefreshCw className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh Logs
            </button>
          </div>
        </div>

        {/* Audit Log Infrastructure */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="min-w-full divide-y divide-slate-50">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Timestamp</th>
                  <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Origin Actor</th>
                  <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Operation</th>
                  <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Target</th>
                  <th className="px-8 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Delta Summary</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-50">
                {loading ? (
                   <tr><td colSpan={5} className="px-8 py-20 text-center">
                        <FiRefreshCw className="w-10 h-10 text-[#00B4C1] animate-spin mx-auto mb-4" />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Accessing Repository...</p>
                  </td></tr>
                ) : logs.length === 0 ? (
                   <tr><td colSpan={5} className="px-8 py-20 text-center">
                        <FiClock className="w-16 h-16 mx-auto mb-4 text-slate-200" />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No audit records found</p>
                  </td></tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#F4F9F8]/50 transition-all group">
                      <td className="px-8 py-5 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                            <FiClock className="text-slate-300" />
                            <span className="text-sm font-bold text-slate-700 tracking-tight">
                                {new Date(log.created_at).toLocaleDateString()} 
                                <span className="text-slate-400 ml-2 font-medium">{new Date(log.created_at).toLocaleTimeString()}</span>
                            </span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                                <FiUser className="w-4 h-4" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-800 uppercase tracking-tight">{log.actor_type}</p>
                                <p className="text-[10px] font-bold text-slate-400">ID: {log.actor_id}</p>
                            </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className={`px-3 py-1 text-[9px] font-bold rounded-lg border uppercase tracking-widest ${getActionTheme(log.action)}`}>
                          {log.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center space-x-3">
                            <FiDatabase className="text-slate-300" />
                            <div>
                                <p className="text-xs font-bold text-slate-700 uppercase tracking-tight">{log.entity_type}</p>
                                <p className="text-[10px] font-bold text-slate-400 truncate max-w-[100px]">REF_{log.entity_id}</p>
                            </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <p className="text-xs text-slate-500 font-medium italic">
                          {log.change_summary || 'System level state transition executed.'}
                        </p>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-10 py-4 bg-slate-50/50 border-t border-slate-50 flex justify-between items-center">
            <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-[#5CB85C] rounded-full animate-pulse" />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Integrity Monitoring Active</span>
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{logs.length} Transactions Found</span>
          </div>
        </div>
      </div>
    </Layout>
  );
}
