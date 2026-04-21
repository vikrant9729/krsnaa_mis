'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '../../store/auth';
import dynamic from 'next/dynamic';
import { centersApi, Center } from '../../api/centers';
import toast from 'react-hot-toast';
import api from '../../api';
import { formatDisplayValue } from '../../utils/apiError';
import { 
    FiDownload, FiRefreshCw, FiChevronLeft, FiChevronRight, 
    FiEdit2, FiTrash2, FiPlus, FiSearch, FiGrid, FiLayers, FiDatabase, FiSettings
} from 'react-icons/fi';

const Layout = dynamic(() => import('../../components/Layout'), { ssr: false });

interface DOSRow {
  id: number;
  data_json: Record<string, any>;
  center_id: number;
  month: string;
  year: number;
  created_at: string;
  center_name?: string;
}

export default function ViewDOS() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [data, setData] = useState<DOSRow[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedCenter, setSelectedCenter] = useState<string>('');

  const loadCenters = async () => {
    try {
      const centersData = await centersApi.getAll();
      setCenters(centersData);
    } catch (error) {
      toast.error('Failed to load centers');
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('page_size', '10');
      if (search) params.append('search', search);
      if (selectedCenter && selectedCenter !== '') params.append('center_id', selectedCenter);
      
      const response = await api.get(`/api/dos/list?${params}`);
      setData(response.data.items || []);
      setTotalPages(response.data.pages || 1);
    } catch (error) {
      toast.error('Failed to load DOS data');
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedCenter]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    loadCenters();
  }, [isAuthenticated, router]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 300);
    return () => clearTimeout(timer);
  }, [loadData]);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    try {
      await api.delete(`/api/dos/rows/${id}`);
      toast.success('Record deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete record');
    }
  };

  const exportExcel = async () => {
    try {
      toast.loading('Preparing export...', { id: 'export' });
      const params = new URLSearchParams({
        center_id: selectedCenter,
        search: search
      });
      const response = await api.get(`/api/dos/export?${params}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `DOS_Data_${new Date().toISOString()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      toast.success('Export complete', { id: 'export' });
    } catch (error) {
      toast.error('Export failed', { id: 'export' });
    }
  };

  if (!isAuthenticated) return null;

  // Get all unique keys from data_json for table headers
  const allKeys = data.length > 0 ? Object.keys(data[0].data_json) : [];

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">DOS Master Repository</h1>
            <p className="text-slate-500 font-medium">Operational data observability and granular management</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
                onClick={exportExcel}
                className="flex-1 md:flex-none flex items-center justify-center px-6 py-3 bg-[#5CB85C] text-white font-bold rounded-xl hover:bg-[#4CAE4C] shadow-sm transition-all active:scale-95"
            >
                <FiDownload className="mr-2" />
                Export Excel
            </button>
            <button
                onClick={() => router.push('/dos/upload')}
                className="flex-1 md:flex-none flex items-center justify-center px-6 py-3 bg-[#00B4C1] text-white font-bold rounded-xl hover:bg-[#009AA6] shadow-sm transition-all active:scale-95"
            >
                <FiPlus className="mr-2" />
                Add Entry
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by test name, code, or category..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-transparent focus:border-[#00B4C1]/30 rounded-xl outline-none font-medium text-slate-700 transition-all"
            />
          </div>
          <div className="md:w-64 relative">
             <FiGrid className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
             <select
                value={selectedCenter}
                onChange={(e) => { setSelectedCenter(e.target.value); setPage(1); }}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-transparent focus:border-[#00B4C1]/30 rounded-xl outline-none font-medium text-slate-700 appearance-none cursor-pointer"
             >
                <option value="">All Centers</option>
                {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
             </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden relative">
          {loading && (
             <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
                <FiRefreshCw className="w-8 h-8 text-[#00B4C1] animate-spin" />
             </div>
          )}
          
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 sticky left-0 bg-slate-50 z-20">Actions</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Center</th>
                  {allKeys.map(key => (
                    <th key={key} className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 whitespace-nowrap">
                      {key.replace(/_/g, ' ')}
                    </th>
                  ))}
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Upload Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.map((row) => (
                  <tr key={row.id} className="hover:bg-[#F4F9F8]/50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap sticky left-0 bg-white group-hover:bg-[#F4F9F8] z-20 border-b border-slate-50 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)]">
                      <div className="flex items-center space-x-2">
                        <button 
                            onClick={() => router.push(`/dos/edit/${row.id}`)}
                            className="p-2 text-[#00B4C1] hover:bg-[#EBF7F7] rounded-lg transition-all"
                            title="Edit"
                        >
                          <FiEdit2 className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => handleDelete(row.id)}
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                            title="Delete"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <span className="text-sm font-bold text-slate-700">{row.center_name || 'N/A'}</span>
                    </td>
                    {allKeys.map(key => (
                      <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                        {formatDisplayValue(row.data_json[key])}
                      </td>
                    ))}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400 font-bold">
                       {new Date(row.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-8 py-4 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Showing Page {page} of {totalPages}
             </p>
             <div className="flex items-center space-x-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition-all"
                >
                  <FiChevronLeft className="w-5 h-5" />
                </button>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition-all"
                >
                  <FiChevronRight className="w-5 h-5" />
                </button>
             </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
