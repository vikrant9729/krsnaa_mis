'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { useAuthStore } from '../../store/auth';
import { masterTestsApi, MasterTest } from '../../api/masterTests';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiSave, FiHash, FiTag, FiRefreshCw, FiInfo, FiActivity, FiDollarSign } from 'react-icons/fi';

const Layout = dynamic(() => import('../../components/Layout'), { ssr: false });

export default function AddMasterTest() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  
  const [loading, setLoading] = useState(false);
  const [test, setTest] = useState<Partial<MasterTest>>({
      LAB_TestID: '',
      test_name: '',
      TestCategory_Mapped: '',
      custom_mrp: undefined
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
  }, [isAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!test.LAB_TestID || !test.test_name) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      // Ensure mrp_source is set if custom_mrp is provided
      const payload = { ...test };
      if (payload.custom_mrp !== undefined && payload.custom_mrp !== null) {
          payload.mrp_source = "MANUAL";
      }

      await masterTestsApi.create(payload);
      toast.success('Master test created successfully!');
      router.push('/master-data');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to create test');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) return null;

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
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Add Master Record</h1>
            <p className="text-slate-500 font-medium mt-1">Initialize a new standardized diagnostic service</p>
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
                                    placeholder="e.g. LAB001"
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
                                    placeholder="e.g. Hematology"
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
                                placeholder="e.g. Complete Blood Count"
                                className="w-full px-4 py-3 bg-slate-50 border border-transparent focus:border-[#00B4C1]/30 rounded-2xl outline-none font-bold text-slate-700 transition-all text-sm"
                                required
                            />
                        </div>

                        <div className="space-y-2 pt-4">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center">
                                <FiDollarSign className="mr-2 text-[#00B4C1]" /> Manual MRP Override (Optional)
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                                <input 
                                    type="number"
                                    value={test.custom_mrp === undefined ? '' : test.custom_mrp}
                                    onChange={(e) => setTest({...test, custom_mrp: e.target.value ? Number(e.target.value) : undefined})}
                                    placeholder="Enter manual rate to override system calculation"
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-transparent focus:border-[#00B4C1]/30 rounded-2xl outline-none font-bold text-slate-700 transition-all text-sm"
                                />
                            </div>
                            <p className="text-[10px] text-slate-400 font-medium">If set, this rate will be labeled as <span className="text-[#00B4C1] font-bold">MANUAL</span> across the platform.</p>
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
                            {loading ? 'Registering...' : 'Register Master Test'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="space-y-6">
                <div className="bg-[#F4F9F8] rounded-3xl border border-[#EBF7F7] p-8">
                    <div className="flex items-center space-x-3 mb-4 text-[#00828A]">
                        <FiInfo className="w-5 h-5" />
                        <h4 className="font-bold text-sm uppercase tracking-widest">Pricing Policy</h4>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                        Standard MRP for new master tests is automatically calculated based on the <strong>HR HISAR</strong> benchmark or the <strong>Global Network Maximum</strong> once assigned to centers.
                    </p>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium mt-3 border-t border-[#D5EFEF] pt-3">
                        Use the <strong>Manual MRP Override</strong> field if you wish to set a fixed corporate rate that bypasses automatic benchmark calculation.
                    </p>
                </div>

                <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
                    <div className="flex items-center space-x-3 mb-6 text-slate-400">
                        <FiActivity className="w-5 h-5" />
                        <h4 className="font-bold text-sm uppercase tracking-widest">Status</h4>
                    </div>
                    <div className="flex items-center text-xs font-bold text-[#00B4C1]">
                        <div className="w-2 h-2 bg-[#00B4C1] rounded-full mr-3 animate-ping" />
                        Ready for Registry
                    </div>
                </div>
            </div>
        </div>
      </div>
    </Layout>
  );
}
