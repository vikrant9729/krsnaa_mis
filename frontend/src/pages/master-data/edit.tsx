'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { useAuthStore } from '../../store/auth';
import { masterTestsApi, MasterTest } from '../../api/masterTests';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiSave, FiHash, FiTag, FiLayers, FiRefreshCw, FiDollarSign, FiActivity } from 'react-icons/fi';

const Layout = dynamic(() => import('../../components/Layout'), { ssr: false });

export default function EditMasterTest() {
  const router = useRouter();
  const { id } = router.query;
  const { isAuthenticated } = useAuthStore();
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [test, setTest] = useState<Partial<MasterTest>>({});

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (id) {
        fetchTest(Number(id));
    }
  }, [isAuthenticated, id]);

  const fetchTest = async (testId: number) => {
    setFetching(true);
    try {
        const data = await masterTestsApi.getById(testId);
        setTest(data);
    } catch (error) {
        console.error('Fetch error:', error);
        toast.error('Test not found or failed to load');
        router.push('/master-data');
    } finally {
        setFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!test.LAB_TestID || !test.test_name) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      // Logic for mrp_source update is handled on the backend
      // But we can ensure it's correct here if we want to be explicit
      const payload = { ...test };
      if (payload.custom_mrp !== undefined && payload.custom_mrp !== null && payload.custom_mrp !== 0) {
          payload.mrp_source = "MANUAL";
      } else if (payload.custom_mrp === null || payload.custom_mrp === 0) {
          payload.mrp_source = null;
          payload.custom_mrp = null;
      }

      await masterTestsApi.update(Number(id), payload);
      toast.success('Master test updated successfully!');
      router.push('/master-data');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update test');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated || fetching) {
    return (
        <Layout>
            <div className="flex flex-col items-center justify-center h-[60vh]">
                <FiLayers className="w-12 h-12 text-[#00B4C1] animate-pulse mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Accessing Repository...</p>
            </div>
        </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex items-center space-x-4 mb-8">
          <button 
            onClick={() => router.push('/master-data')}
            className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-500 hover:text-[#00B4C1] hover:border-[#00B4C1]/30 transition-all shadow-sm"
          >
            <FiArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Edit Master Record</h1>
            <p className="text-slate-500 font-medium mt-1">Refine global service definitions and metadata</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden p-10">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center">
                                    <FiHash className="mr-2" /> LAB Test ID <span className="text-rose-500 ml-1">*</span>
                                </label>
                                <input 
                                    type="text"
                                    value={test.LAB_TestID || ''}
                                    onChange={(e) => setTest({...test, LAB_TestID: e.target.value})}
                                    className="w-full px-4 py-3 bg-slate-50 border border-transparent focus:border-[#00B4C1]/30 rounded-2xl outline-none font-bold text-slate-700 transition-all text-sm"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center">
                                    <FiTag className="mr-2" /> Category Mapped
                                </label>
                                <input 
                                    type="text"
                                    value={test.TestCategory_Mapped || ''}
                                    onChange={(e) => setTest({...test, TestCategory_Mapped: e.target.value})}
                                    className="w-full px-4 py-3 bg-slate-50 border border-transparent focus:border-[#00B4C1]/30 rounded-2xl outline-none font-bold text-slate-700 transition-all text-sm"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center">
                                Test Name <span className="text-rose-500 ml-1">*</span>
                            </label>
                            <input 
                                type="text"
                                value={test.test_name || ''}
                                onChange={(e) => setTest({...test, test_name: e.target.value})}
                                className="w-full px-4 py-3 bg-slate-50 border border-transparent focus:border-[#00B4C1]/30 rounded-2xl outline-none font-bold text-slate-700 transition-all text-sm"
                                required
                            />
                        </div>

                        <div className="space-y-2 pt-4">
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center">
                                    <FiDollarSign className="mr-2 text-[#00B4C1]" /> Manual MRP Override
                                </label>
                                {(test.custom_mrp !== null && test.custom_mrp !== undefined) && (
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            setTest({...test, custom_mrp: null, mrp_source: null});
                                            toast.success('Price reset to system benchmark');
                                        }}
                                        className="text-[10px] font-bold text-[#00B4C1] hover:text-[#009AA6] uppercase tracking-wider flex items-center"
                                    >
                                        <FiRefreshCw className="mr-1 w-3 h-3" /> Reset to Benchmark
                                    </button>
                                )}
                            </div>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                                <input 
                                    type="number"
                                    value={test.custom_mrp || ''}
                                    onChange={(e) => setTest({...test, custom_mrp: e.target.value ? Number(e.target.value) : undefined})}
                                    placeholder="Enter manual rate to override benchmarks (e.g. 500)"
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-transparent focus:border-[#00B4C1]/30 rounded-2xl outline-none font-bold text-slate-700 transition-all text-sm"
                                />
                            </div>
                            <p className="text-[10px] text-slate-400 font-medium">Clear this field or click Reset to revert to automatic benchmark calculation (HR HISAR / Global Max).</p>
                        </div>

                        <div className="pt-6 mt-6 border-t border-slate-50 flex justify-end">
                            <button 
                            type="submit"
                            disabled={loading}
                            className="flex items-center px-10 py-4 bg-[#00B4C1] text-white font-bold rounded-2xl hover:bg-[#009AA6] shadow-lg shadow-[#00B4C1]/20 transition-all disabled:opacity-70 active:scale-95"
                            >
                            {loading ? (
                                <FiRefreshCw className="animate-spin mr-2" />
                            ) : (
                                <FiSave className="mr-2" />
                            )}
                            {loading ? 'Persisting Changes...' : 'Save Record Updates'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="space-y-6">
                <div className="bg-[#F4F9F8] rounded-3xl border border-[#EBF7F7] p-8">
                    <div className="flex items-center space-x-3 mb-6 text-[#00828A]">
                        <FiDollarSign className="w-5 h-5" />
                        <h4 className="font-bold text-sm uppercase tracking-widest">Rate Intelligence</h4>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Current MRP</p>
                            <p className="text-3xl font-bold text-slate-800 tracking-tight">₹{test.mrp?.toLocaleString() || '0.00'}</p>
                        </div>
                        <div className="pt-4 border-t border-[#D5EFEF]">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Source Benchmark</p>
                            <p className={`text-sm font-bold ${test.mrp_source_center === 'MANUAL' ? 'text-rose-500' : 'text-[#00828A]'}`}>
                                {test.mrp_source_center}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
                    <div className="flex items-center space-x-3 mb-6 text-slate-400">
                        <FiActivity className="w-5 h-5" />
                        <h4 className="font-bold text-sm uppercase tracking-widest">System Metadata</h4>
                    </div>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-400 uppercase tracking-widest">Global ID</span>
                            <span className="font-mono text-slate-800 font-bold">#{test.id}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-400 uppercase tracking-widest">Registry Date</span>
                            <span className="text-slate-800 font-bold">{test.created_at ? new Date(test.created_at).toLocaleDateString() : 'N/A'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </Layout>
  );
}
