'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '../store/auth';
import dynamic from 'next/dynamic';
import { centersApi, Center } from '../api/centers';
import toast from 'react-hot-toast';
import { FiSearch, FiPlus, FiTrash2, FiMapPin, FiGrid, FiActivity, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const Layout = dynamic(() => import('../components/Layout'), { ssr: false });

export default function Centers() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    loadCenters();
  }, [isAuthenticated, router]);

  const loadCenters = async () => {
    setLoading(true);
    try {
      const data = await centersApi.getAll();
      setCenters(data);
    } catch (error) {
      toast.error('Failed to load centers');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Delete ${selectedIds.length} centers? This cannot be undone.`)) return;
    try {
      await centersApi.bulkDelete(selectedIds);
      toast.success('Deleted successfully');
      setSelectedIds([]);
      loadCenters();
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('CRITICAL: Delete ALL center data?')) return;
    try {
      await centersApi.deleteAll();
      toast.success('All centers cleared');
      loadCenters();
    } catch (error) {
      toast.error('Clear all failed');
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const filteredCenters = centers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.center_code.toLowerCase().includes(search.toLowerCase())
  );

  if (!isAuthenticated) return null;

  return (
    <Layout>
      <div className="space-y-6 animate-in fade-in duration-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Center Network</h1>
            <div className="flex items-center gap-3 mt-1">
                <p className="text-slate-500 font-medium">Manage and monitor all diagnostic nodes</p>
                <span className="text-[10px] font-black bg-[#EBF7F7] text-[#00828A] px-2 py-0.5 rounded-full uppercase tracking-widest border border-[#D5EFEF]">
                    {filteredCenters.length} Nodes Online
                </span>
            </div>
          </div>
          <button
            onClick={() => router.push('/centers/add')}
            className="w-full md:w-auto flex items-center justify-center px-8 py-3 bg-[#00B4C1] text-white font-bold rounded-xl hover:bg-[#009AA6] shadow-sm transition-all"
          >
            <FiPlus className="mr-2" />
            Register Center
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex-1 w-full relative">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by center name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-transparent focus:border-[#00B4C1]/30 rounded-xl outline-none font-medium text-slate-700 transition-all"
            />
          </div>
          <div className="flex items-center space-x-3 w-full md:w-auto">
            {selectedIds.length > 0 && (
                <button
                    onClick={handleBulkDelete}
                    className="flex-1 md:flex-none flex items-center justify-center px-6 py-3 bg-rose-50 text-rose-600 font-bold rounded-xl hover:bg-rose-100 border border-rose-100"
                >
                    <FiTrash2 className="mr-2" />
                    Delete ({selectedIds.length})
                </button>
            )}
            <button
                onClick={handleDeleteAll}
                className="flex-1 md:flex-none flex items-center justify-center px-6 py-3 bg-slate-50 text-slate-400 font-bold rounded-xl hover:bg-slate-100 border border-slate-200"
            >
                <FiTrash2 className="mr-2" />
                Clear All
            </button>
          </div>
        </div>

        {/* Centers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCenters.map((center) => (
            <div key={center.id} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 hover:shadow-md transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4">
                 <input 
                    type="checkbox" 
                    checked={selectedIds.includes(center.id)}
                    onChange={() => toggleSelect(center.id)}
                    className="w-6 h-6 rounded-lg border-slate-200 text-[#00B4C1] focus:ring-[#00B4C1]"
                 />
              </div>
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-14 h-14 bg-[#F4F9F8] rounded-2xl flex items-center justify-center text-[#00B4C1] border border-[#EBF7F7]">
                  <FiMapPin className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 leading-tight">{center.name}</h3>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">{center.center_code}</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400 font-medium uppercase text-[10px] tracking-wider">Type</span>
                  <span className="text-slate-700 font-bold">{center.center_type}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400 font-medium uppercase text-[10px] tracking-wider">Node Status</span>
                  <span className="text-[#5CB85C] font-bold flex items-center">
                    <div className="w-1.5 h-1.5 bg-[#5CB85C] rounded-full mr-1.5 animate-pulse" />
                    Active
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/centers/edit/${center.id}`)}
                  className="flex-1 py-3 bg-[#EBF7F7] text-[#00828A] text-xs font-bold rounded-xl hover:bg-[#D5EFEF] transition-all uppercase tracking-widest"
                >
                  Configure
                </button>
                <button
                  onClick={() => router.push(`/dos/view?center_id=${center.id}`)}
                  className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-[#00B4C1] hover:text-white transition-all shadow-sm"
                >
                  <FiGrid className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}

          {filteredCenters.length === 0 && !loading && (
             <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                <FiMapPin className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest">No Centers found</p>
             </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
