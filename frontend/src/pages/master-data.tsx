'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '../store/auth';
import dynamic from 'next/dynamic';
import { masterTestsApi, MasterTest, MasterTestFilters } from '../api/masterTests';
import toast from 'react-hot-toast';
import { FiSearch, FiPlus, FiTrash2, FiRefreshCw, FiDatabase, FiCheckCircle, FiChevronLeft, FiChevronRight, FiFilter, FiTag, FiMapPin } from 'react-icons/fi';

const Layout = dynamic(() => import('../components/Layout'), { ssr: false });

export default function MasterData() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [data, setData] = useState<MasterTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Filters
  const [filters, setFilters] = useState<MasterTestFilters>({ categories: [], sources: [] });
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSource, setSelectedSource] = useState('All');

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    loadFilters();
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
        loadData();
    }
  }, [isAuthenticated, page, search, selectedCategory, selectedSource]);

  const loadFilters = async () => {
      try {
          const f = await masterTestsApi.getFilters();
          setFilters(f);
      } catch (error) {
          console.error('Failed to load filters', error);
      }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const skip = (page - 1) * 10;
      const response = await masterTestsApi.getAll(skip, 10, search, selectedCategory, selectedSource);
      setData(response.items);
      setTotalPages(response.pages);
      setTotalRecords(response.total);
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
      loadFilters();
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

        {/* Action & Filter Toolbar */}
        <div className="space-y-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col lg:flex-row gap-6">
                <div className="flex-1 relative">
                    <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                    type="text"
                    placeholder="Search by ID, Name or Category..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-transparent focus:border-[#00B4C1]/30 rounded-2xl outline-none font-bold text-slate-700 transition-all text-sm"
                    />
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative min-w-[200px]">
                        <FiTag className="absolute left-4 top-1/2 -translate-y-1/2 text-[#00B4C1]" />
                        <select
                            value={selectedCategory}
                            onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
                            className="w-full pl-11 pr-10 py-3.5 bg-slate-50 border border-transparent focus:border-[#00B4C1]/30 rounded-2xl outline-none font-bold text-slate-700 appearance-none cursor-pointer text-sm transition-all"
                        >
                            <option disabled value="">Category Filter</option>
                            {filters.categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="relative min-w-[220px]">
                        <FiMapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-[#00B4C1]" />
                        <select
                            value={selectedSource}
                            onChange={(e) => { setSelectedSource(e.target.value); setPage(1); }}
                            className="w-full pl-11 pr-10 py-3.5 bg-slate-50 border border-transparent focus:border-[#00B4C1]/30 rounded-2xl outline-none font-bold text-slate-700 appearance-none cursor-pointer text-sm transition-all"
                        >
                            <option disabled value="">Source Filter</option>
                            {filters.sources.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    {selectedIds.length > 0 && (
                        <button
                            onClick={handleBulkDelete}
                            className="flex-1 md:flex-none flex items-center justify-center px-6 py-3 bg-rose-50 text-rose-600 font-bold rounded-xl hover:bg-rose-100 transition-all border border-rose-100 whitespace-nowrap text-xs"
                        >
                            <FiTrash2 className="mr-2" />
                            Delete ({selectedIds.length})
                        </button>
                    )}
                    <button
                        onClick={handleDeleteAll}
                        className="flex-1 md:flex-none flex items-center justify-center px-6 py-3 bg-slate-50 text-slate-400 font-bold rounded-xl hover:bg-slate-100 transition-all border border-slate-200 whitespace-nowrap text-xs"
                    >
                        <FiTrash2 className="mr-2" />
                        Clear Registry
                    </button>
                </div>
            </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden relative">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-8 py-6 text-left border-b border-slate-100 w-10">
                    <input 
                      type="checkbox" 
                      onChange={(e) => setSelectedIds(e.target.checked ? data.map(d => d.id) : [])}
                      checked={selectedIds.length === data.length && data.length > 0}
                      className="w-5 h-5 rounded-lg border-slate-300 text-[#00B4C1] focus:ring-[#00B4C1] transition-all cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">LAB Test ID</th>
                  <th className="px-6 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Diagnostic Service Name</th>
                  <th className="px-6 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Category Node</th>
                  <th className="px-6 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">MRP Benchmark</th>
                  <th className="px-6 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Status</th>
                  <th className="px-6 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pr-10">Intelligence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                    <tr>
                        <td colSpan={7} className="py-20 text-center">
                            <FiRefreshCw className="w-10 h-10 text-[#00B4C1] animate-spin mx-auto mb-4 opacity-20" />
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Accessing Repository...</p>
                        </td>
                    </tr>
                ) : data.length === 0 ? (
                    <tr>
                        <td colSpan={7} className="py-20 text-center">
                            <FiFilter className="w-10 h-10 text-slate-200 mx-auto mb-4" />
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No records found matching criteria</p>
                        </td>
                    </tr>
                ) : data.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F4F9F8]/50 transition-all group">
                    <td className="px-8 py-5 border-b border-slate-50/50">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="w-5 h-5 rounded-lg border-slate-300 text-[#00B4C1] focus:ring-[#00B4C1] transition-all cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                       <span className="text-sm font-black text-slate-500 font-mono tracking-tighter">#{item.LAB_TestID}</span>
                    </td>
                    <td className="px-6 py-5">
                       <span className="text-sm font-bold text-slate-800 tracking-tight">{item.test_name}</span>
                    </td>
                    <td className="px-6 py-5">
                       <span className="px-3 py-1.5 bg-slate-100 text-slate-500 text-[9px] font-black rounded-xl uppercase tracking-widest border border-slate-200/50">
                         {item.TestCategory_Mapped}
                       </span>
                    </td>
                    <td className="px-6 py-5">
                       <div className="flex flex-col">
                          <span className="text-lg font-black text-[#00B4C1] tracking-tighter">₹{item.mrp?.toLocaleString() || '0.00'}</span>
                          <span className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${item.mrp_source_center === 'MANUAL' ? 'text-rose-500' : 'text-slate-400 opacity-60'}`}>
                            {item.mrp_source_center}
                          </span>
                       </div>
                    </td>
                    <td className="px-6 py-5">
                       <div className="flex items-center text-[10px] font-black uppercase tracking-widest text-[#5CB85C]">
                          <FiCheckCircle className="mr-1.5 w-4 h-4" /> 
                          <span className="opacity-80">Verified</span>
                       </div>
                    </td>
                    <td className="px-6 py-5 text-right pr-10">
                      <button 
                        onClick={() => router.push(`/master-data/edit?id=${item.id}`)}
                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-[#00B4C1] hover:bg-[#EBF7F7] rounded-xl transition-all border border-transparent hover:border-[#00B4C1]/20 ml-auto"
                      >
                        <FiDatabase className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Enhanced Pagination */}
          <div className="px-10 py-6 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-6 border-t border-slate-100">
             <div className="flex items-center space-x-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    Vault Page <span className="text-slate-900">{page}</span> of <span className="text-slate-900">{totalPages}</span>
                    <span className="mx-4 text-slate-300">|</span>
                    Total Records: <span className="text-[#00B4C1]">{totalRecords}</span>
                </p>
                <div className="h-1 w-20 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-[#00B4C1] transition-all duration-500" 
                        style={{ width: `${(page/totalPages) * 100}%` }}
                    />
                </div>
             </div>
             <div className="flex items-center space-x-3">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-500 hover:text-[#00B4C1] hover:border-[#00B4C1]/30 disabled:opacity-50 transition-all shadow-sm active:scale-90"
                >
                  <FiChevronLeft className="w-6 h-6" />
                </button>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-500 hover:text-[#00B4C1] hover:border-[#00B4C1]/30 disabled:opacity-50 transition-all shadow-sm active:scale-90"
                >
                  <FiChevronRight className="w-6 h-6" />
                </button>
             </div>
          </div>
        </div>
      </div>
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #F8FAFC;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E2E8F0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #CBD5E1;
        }
      `}</style>
    </Layout>
  );
}
