'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '../store/auth';
import dynamic from 'next/dynamic';
import { centersApi, Center } from '../api/centers';
import api from '../api';
import toast from 'react-hot-toast';
import { FiSearch, FiMapPin, FiEdit2, FiActivity, FiLayers, FiDatabase, FiPlus, FiTrash2, FiArrowLeft } from 'react-icons/fi';

const Layout = dynamic(() => import('../components/Layout'), { ssr: false });

export default function Tests() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [centers, setCenters] = useState<Center[]>([]);
  const [selectedCenter, setSelectedCenter] = useState<Center | null>(null);
  const [centerTests, setCenterTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [testSearch, setTestSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    loadCenters();
  }, [isAuthenticated, router]);

  const loadCenters = async () => {
    try {
      const data = await centersApi.getAll();
      setCenters(data);
    } catch (error) {
      toast.error('Failed to load centers');
    }
  };

  const handleCenterSelect = async (center: Center) => {
    setSelectedCenter(center);
    setLoading(true);
    setTestSearch('');
    setCurrentPage(1);
    try {
      const response = await api.get(`/api/tests/centers/${center.id}`);
      setCenterTests(response.data);
    } catch (error) {
      toast.error('Failed to load center tests');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTest = async (ctId: number) => {
    if (!confirm('Remove this test from the center catalog?')) return;
    try {
      await api.delete(`/api/tests/centers/${ctId}`);
      setCenterTests(prev => prev.filter(ct => ct.id !== ctId));
      toast.success('Test removed from catalog');
    } catch (error) {
      toast.error('Failed to remove test');
    }
  };

  const handleEditRate = async (ct: any) => {
    const currentRate = ct.custom_rate ?? ct.test?.rate ?? '';
    const newRate = prompt(`New rate for ${ct.test?.test_name}:`, String(currentRate));
    if (newRate === null) return;
    const rate = parseFloat(newRate);
    if (isNaN(rate) || rate < 0) { toast.error('Invalid rate entered'); return; }
    try {
      await api.put(`/api/tests/centers/${ct.id}/rate?custom_rate=${rate}`);
      setCenterTests(prev => prev.map(t => t.id === ct.id ? { ...t, custom_rate: rate } : t));
      toast.success(`Rate updated to ₹${rate}`);
    } catch (error) {
      toast.error('Failed to update rate');
    }
  };

  const filteredCenters = centers.filter(c =>
    (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.center_code || '').toLowerCase().includes(search.toLowerCase())
  );

  const filteredTests = centerTests.filter(ct =>
    (ct.test?.test_name || '').toLowerCase().includes(testSearch.toLowerCase()) ||
    (ct.test?.LAB_TestID || '').toLowerCase().includes(testSearch.toLowerCase())
  );

  const totalPages = Math.ceil(filteredTests.length / pageSize);
  const paginatedTests = filteredTests.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (!isAuthenticated) return null;

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in duration-700">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Local Service Management</h1>
          <p className="text-slate-500 font-medium mt-1">Configure center-specific test catalogs and rate structures</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Center Selector List */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 overflow-hidden flex flex-col h-[700px]">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
              <FiMapPin className="mr-2 text-[#00B4C1]" />
              Select Center Node
            </h3>
            <div className="relative mb-6">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search nodes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-transparent focus:border-[#00B4C1]/30 rounded-2xl outline-none font-bold text-slate-700 transition-all text-sm"
              />
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-2">
              {filteredCenters.map((center) => (
                <button
                  key={center.id}
                  onClick={() => handleCenterSelect(center)}
                  className={`w-full text-left p-4 rounded-2xl transition-all border ${
                    selectedCenter?.id === center.id
                      ? 'bg-[#EBF7F7] border-[#00B4C1] text-[#00828A] shadow-sm'
                      : 'bg-white border-slate-50 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <div className="font-bold text-sm">{center.name}</div>
                  <div className="text-[10px] font-bold uppercase tracking-widest mt-1 opacity-60">
                    {center.center_code} &bull; {center.center_type}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Center Tests Catalog */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm p-8 h-[700px] flex flex-col relative overflow-hidden">
            {selectedCenter ? (
              <>
                <div className="flex justify-between items-start mb-6">
                  <div className="flex-1 mr-4">
                    <h3 className="text-xl font-bold text-slate-800">{selectedCenter.name}</h3>
                    <div className="relative mt-4">
                      <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Filter localized catalog..."
                        value={testSearch}
                        onChange={(e) => { setTestSearch(e.target.value); setCurrentPage(1); }}
                        className="w-full max-w-sm pl-12 pr-4 py-3 bg-slate-50 border border-transparent focus:border-[#00B4C1]/30 rounded-2xl outline-none font-bold text-slate-700 transition-all text-sm"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(`/tests/add?center_id=${selectedCenter.id}`)}
                    className="flex items-center px-6 py-3 bg-[#00B4C1] text-white font-bold rounded-xl hover:bg-[#009AA6] shadow-sm transition-all text-sm self-start"
                  >
                    <FiPlus className="mr-2" />
                    Assign New Test
                  </button>
                </div>

                {loading ? (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <FiLayers className="w-12 h-12 text-[#00B4C1] animate-pulse mb-4" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Accessing Repository...</p>
                  </div>
                ) : filteredTests.length > 0 ? (
                  <>
                    {/* Pagination header */}
                    <div className="flex justify-between items-center mb-4 px-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Showing {paginatedTests.length} of {filteredTests.length} Tests
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className="p-1.5 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-30 transition-all"
                        >
                          <FiArrowLeft className="w-4 h-4 text-[#00B4C1]" />
                        </button>
                        <span className="text-xs font-bold text-slate-500">
                          Page {currentPage} of {totalPages || 1} 
                          <span className="mx-2 text-slate-300">|</span> 
                          Showing {centerTests.length} Records
                        </span>
                        <button
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage >= totalPages}
                          className="p-1.5 bg-slate-100 rounded-lg hover:bg-slate-200 disabled:opacity-30 transition-all"
                        >
                          <FiArrowLeft className="w-4 h-4 text-[#00B4C1] rotate-180" />
                        </button>
                      </div>
                    </div>

                    {/* Test grid */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {paginatedTests.map((ct) => (
                          <div key={ct.id} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-[#00B4C1]/30 transition-all group">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h4 className="text-sm font-bold text-slate-800">{ct.test?.test_name}</h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{ct.test?.LAB_TestID}</p>
                              </div>
                              <div className="px-3 py-1 bg-white rounded-lg border border-slate-200 shadow-sm">
                                <span className="text-xs font-bold text-[#00B4C1]">
                                  {(ct.custom_rate != null || ct.test?.rate != null)
                                    ? `₹${ct.custom_rate ?? ct.test?.rate}`
                                    : <span className="text-slate-300">No Rate</span>
                                  }
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200/50">
                              <div className="flex items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                <FiActivity className="mr-2 text-[#5CB85C]" />
                                Operational
                              </div>
                              <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleEditRate(ct)}
                                  title="Edit Rate"
                                  className="p-2 text-slate-400 hover:text-[#00B4C1] hover:bg-[#EBF7F7] rounded-lg transition-all"
                                >
                                  <FiEdit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteTest(ct.id)}
                                  title="Remove from catalog"
                                  className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                >
                                  <FiTrash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                    <FiDatabase className="w-16 h-16 text-slate-200 mb-6" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest">
                      {testSearch ? 'No tests matching your filter' : 'No tests assigned to this node'}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                <div className="w-24 h-24 bg-[#F4F9F8] rounded-full flex items-center justify-center text-[#00B4C1] mb-8 border border-[#EBF7F7]">
                  <FiMapPin className="w-10 h-10 animate-bounce" />
                </div>
                <h3 className="text-2xl font-bold text-slate-400 tracking-tight">Node Access Pending</h3>
                <p className="text-slate-400 font-medium mt-2 max-w-xs mx-auto">Select a diagnostic center from the registry to manage its localized test matrix and configurations.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
      `}</style>
    </Layout>
  );
}