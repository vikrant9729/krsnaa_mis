'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '../store/auth';
import dynamic from 'next/dynamic';
import { masterTestsApi, MasterTest } from '../api/masterTests';
import toast from 'react-hot-toast';
import { FiSearch, FiPlus, FiTrash2, FiRefreshCw, FiDatabase, FiCheckCircle, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const Layout = dynamic(() => import('../components/Layout'), { ssr: false });

export default function MasterData() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [data, setData] = useState<MasterTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    loadData();
  }, [isAuthenticated, router, page, search]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await masterTestsApi.getAll(page, 10, search);
      setData(response.items);
      setTotalPages(response.pages);
    } catch (error) {
      toast.error('Failed to load master tests');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncFromDos = async () => {
    try {
      setLoading(true);
      await masterTestsApi.syncFromDos();
      toast.success('Sync complete');
      loadData();
    } catch (error) {
      toast.error('Sync failed');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} records?`)) return;
    try {
      await masterTestsApi.bulkDelete(selectedIds);
      toast.success('Deleted successfully');
      setSelectedIds([]);
      loadData();
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('CRITICAL: This will delete ALL master test data. Continue?')) return;
    try {
      await masterTestsApi.deleteAll();
      toast.success('All records deleted');
      loadData();
    } catch (error) {
      toast.error('Delete all failed');
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  if (!isAuthenticated) return null;

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Master Test Index</h1>
            <p className="text-slate-500 font-medium">Standardized catalog of all diagnostic services</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
             <button
                onClick={handleSyncFromDos}
                className="flex-1 md:flex-none flex items-center justify-center px-6 py-3 bg-[#EBF7F7] text-[#00828A] font-bold rounded-xl hover:bg-[#D5EFEF] transition-all border border-[#D5EFEF]"
            >
                <FiRefreshCw className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                Sync from DOS
            </button>
            <button
                onClick={() => router.push('/master-data/add')}
                className="flex-1 md:flex-none flex items-center justify-center px-6 py-3 bg-[#00B4C1] text-white font-bold rounded-xl hover:bg-[#009AA6] shadow-sm transition-all"
            >
                <FiPlus className="mr-2" />
                Add Test
            </button>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex-1 w-full relative">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ID, Name or Category..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-transparent focus:border-[#00B4C1]/30 rounded-xl outline-none font-medium text-slate-700 transition-all"
            />
          </div>
          <div className="flex items-center space-x-3 w-full md:w-auto">
            {selectedIds.length > 0 && (
                <button
                    onClick={handleBulkDelete}
                    className="flex-1 md:flex-none flex items-center justify-center px-6 py-3 bg-rose-50 text-rose-600 font-bold rounded-xl hover:bg-rose-100 transition-all border border-rose-100"
                >
                    <FiTrash2 className="mr-2" />
                    Delete ({selectedIds.length})
                </button>
            )}
            <button
                onClick={handleDeleteAll}
                className="flex-1 md:flex-none flex items-center justify-center px-6 py-3 bg-slate-50 text-slate-400 font-bold rounded-xl hover:bg-slate-100 transition-all border border-slate-200"
            >
                <FiTrash2 className="mr-2" />
                Clear All
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden relative">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-6 py-4 text-left border-b border-slate-100 w-10">
                    <input 
                      type="checkbox" 
                      onChange={(e) => setSelectedIds(e.target.checked ? data.map(d => d.id) : [])}
                      checked={selectedIds.length === data.length && data.length > 0}
                      className="w-5 h-5 rounded border-slate-300 text-[#00B4C1] focus:ring-[#00B4C1]"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">LAB Test ID</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Test Name</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Category Mapped</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Status</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F4F9F8]/50 transition-colors group">
                    <td className="px-6 py-4 border-b border-slate-50">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="w-5 h-5 rounded border-slate-300 text-[#00B4C1] focus:ring-[#00B4C1]"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <span className="text-sm font-bold text-slate-700">{item.LAB_TestID}</span>
                    </td>
                    <td className="px-6 py-4">
                       <span className="text-sm font-bold text-slate-800">{item.test_name}</span>
                    </td>
                    <td className="px-6 py-4">
                       <span className="px-3 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full uppercase tracking-wider">
                         {item.TestCategory_Mapped}
                       </span>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center text-xs font-bold text-[#5CB85C]">
                          <FiCheckCircle className="mr-1" /> Verified
                       </div>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => router.push(`/master-data/edit/${item.id}`)}
                        className="p-2 text-[#00B4C1] hover:bg-[#EBF7F7] rounded-lg transition-all"
                      >
                        <FiDatabase className="w-4 h-4" />
                      </button>
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
