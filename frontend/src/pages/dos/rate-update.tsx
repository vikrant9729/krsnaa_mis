'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '../../store/auth';
import dynamic from 'next/dynamic';
import { centersApi, Center } from '../../api/centers';
import toast from 'react-hot-toast';
import api from '../../api';
import { formatApiError } from '../../utils/apiError';
import { FiCheck, FiX, FiPlus, FiTrash2, FiActivity, FiZap, FiDatabase, FiShield, FiRefreshCw } from 'react-icons/fi';

const Layout = dynamic(() => import('../../components/Layout'), { ssr: false });

interface PreviewItem {
  row_id: number;
  LAB_TestID: string;
  test_name: string;
  category?: string;
  current_value: number;
  new_value: number;
  difference: number;
}

interface RateRule {
  column_name: string;
  category: string;
  percentage: number;
}

export default function RateUpdate() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [centers, setCenters] = useState<Center[]>([]);
  const [selectedCenter, setSelectedCenter] = useState<number | null>(null);
  const [datasetId, setDatasetId] = useState<number | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [updates, setUpdates] = useState<RateRule[]>([
    { column_name: 'Bill_Rate', category: '', percentage: 0 },
  ]);
  const [preview, setPreview] = useState<PreviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showingPreview, setShowingPreview] = useState(false);

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
    } catch {
      toast.error('Failed to load centers');
    }
  };

  const loadCategories = async (centerId: number) => {
    try {
      const response = await api.get(`/api/dos/categories/${centerId}`);
      setCategories(Array.isArray(response.data) ? response.data : []);
    } catch {
      setCategories([]);
    }
  };

  const loadActiveDataset = async (centerId: number) => {
    try {
      const response = await api.get(`/api/dos/datasets/${centerId}`);
      const active = response.data.find((dataset: any) => dataset.is_active);

      if (!active) {
        setDatasetId(null);
        setCategories([]);
        toast.error('No active dataset for this center');
        return;
      }

      setDatasetId(active.id);
      await loadCategories(centerId);
    } catch {
      setDatasetId(null);
      setCategories([]);
      toast.error('Failed to load dataset');
    }
  };

  const handleCenterChange = (centerId: number) => {
    setSelectedCenter(centerId);
    setPreview([]);
    setShowingPreview(false);
    loadActiveDataset(centerId);
  };

  const addUpdate = () => {
    setUpdates((current) => [
      ...current,
      { column_name: 'Bill_Rate', category: '', percentage: 0 },
    ]);
  };

  const removeUpdate = (index: number) => {
    setUpdates((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const updateField = (index: number, field: keyof RateRule, value: string | number) => {
    setUpdates((current) =>
      current.map((update, currentIndex) =>
        currentIndex === index ? { ...update, [field]: value } : update
      )
    );
  };

  const previewRates = async () => {
    if (!datasetId) {
      toast.error('No active dataset selected');
      return;
    }

    if (updates.some((update) => !update.column_name.trim())) {
      toast.error('Column name is required for every rule');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post(`/api/dos/rate-preview/${datasetId}`, { updates });
      // Map legacy test_code to LAB_TestID if necessary
      const data = (Array.isArray(response.data) ? response.data : []).map((item: any) => ({
        ...item,
        LAB_TestID: item.LAB_TestID || item.test_code
      }));
      setPreview(data);
      setShowingPreview(true);
      toast.success(`Preview ready: ${data.length} rows detected`);
    } catch (error: any) {
      toast.error(formatApiError(error.response?.data?.detail, 'Preview failed'));
    } finally {
      setLoading(false);
    }
  };

  const applyRates = async () => {
    if (!datasetId) {
      return;
    }

    setLoading(true);
    try {
      const response = await api.post(`/api/dos/rate-update/${datasetId}`, { updates });
      toast.success(`Rates updated! ${response.data.total_updated} rows modified.`);
      setPreview([]);
      setShowingPreview(false);
      setUpdates([{ column_name: 'Bill_Rate', category: '', percentage: 0 }]);
    } catch (error: any) {
      toast.error(formatApiError(error.response?.data?.detail, 'Update failed'));
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <Layout>
      <div className="max-w-[1200px] mx-auto space-y-8 animate-in fade-in duration-700">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Mass Rate Optimization</h1>
          <p className="text-slate-500 font-medium">Dynamically adjust Bill Rates across center catalogs with AI-driven preview</p>
        </div>

        {/* Center Selector */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#F4F9F8] rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700" />
          <div className="relative z-10">
            <label className="block text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-2 ml-1">Target Infrastructure Node</label>
            <div className="relative max-w-md">
                <FiDatabase className="absolute left-4 top-1/2 -translate-y-1/2 text-[#00B4C1]" />
                <select
                    value={selectedCenter || ''}
                    onChange={(e) => handleCenterChange(Number(e.target.value))}
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-transparent focus:border-[#00B4C1]/30 rounded-2xl outline-none transition-all font-bold text-slate-800 cursor-pointer appearance-none"
                >
                    <option value="">Choose a center node...</option>
                    {centers.map((center) => (
                    <option key={center.id} value={center.id}>
                        {center.name} ({center.center_type})
                    </option>
                    ))}
                </select>
            </div>
            {datasetId && (
                <div className="mt-4 flex items-center text-xs font-bold text-[#5CB85C] uppercase tracking-widest bg-[#F0F9F0] w-fit px-4 py-1.5 rounded-full border border-[#5CB85C]/10">
                    <div className="w-1.5 h-1.5 bg-[#5CB85C] rounded-full mr-2 animate-pulse" />
                    Active Repository Linked
                </div>
            )}
          </div>
        </div>

        {datasetId && (
          <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
            {/* Rule Definition Area */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-10">
              <div className="flex justify-between items-center mb-10">
                <h2 className="text-xl font-bold text-slate-800 flex items-center">
                    <FiZap className="mr-3 text-[#E37222]" />
                    Optimization Matrix
                </h2>
                <button
                  onClick={addUpdate}
                  className="flex items-center px-6 py-2.5 bg-[#00B4C1] text-white font-bold rounded-xl hover:bg-[#009AA6] transition-all text-xs tracking-widest uppercase shadow-sm active:scale-95"
                >
                  <FiPlus className="mr-2" />
                  Add New Rule
                </button>
              </div>

              <div className="space-y-6">
                {updates.map((update, index) => (
                  <div key={index} className="flex flex-col md:flex-row items-center gap-6 p-6 bg-slate-50 rounded-3xl border border-slate-100 animate-in slide-in-from-right-4 duration-300" style={{ animationDelay: `${index * 50}ms` }}>
                    <div className="flex-1 w-full">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">Column Identifier</label>
                      <select
                        value={update.column_name}
                        onChange={(e) => updateField(index, 'column_name', e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none font-bold text-slate-700 focus:border-[#00B4C1]"
                      >
                        <option value="Bill_Rate">Bill_Rate</option>
                      </select>
                    </div>

                    <div className="flex-1 w-full">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">Test Category</label>
                      <select
                        value={update.category}
                        onChange={(e) => updateField(index, 'category', e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none font-bold text-slate-700 focus:border-[#00B4C1]"
                      >
                        <option value="">Global (All Categories)</option>
                        {categories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex-1 w-full">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">Delta Percentage (%)</label>
                      <input
                        type="number"
                        value={update.percentage}
                        onChange={(e) => updateField(index, 'percentage', Number(e.target.value))}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none font-bold text-[#00B4C1] focus:border-[#00B4C1]"
                        placeholder="e.g. 10"
                        step="0.01"
                      />
                    </div>

                    {updates.length > 1 && (
                      <button
                        onClick={() => removeUpdate(index)}
                        className="p-3 text-rose-500 hover:bg-rose-50 rounded-xl transition-all self-end mb-1"
                      >
                        <FiTrash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={previewRates}
                disabled={loading}
                className="w-full mt-10 py-5 bg-[#EBF7F7] text-[#00828A] font-bold rounded-2xl hover:bg-[#D5EFEF] transition-all uppercase tracking-[0.2em] text-xs border border-[#D5EFEF] active:scale-[0.99] flex items-center justify-center"
              >
                {loading ? <FiRefreshCw className="mr-2 animate-spin" /> : <FiActivity className="mr-2" />}
                Generate Intelligence Preview
              </button>
            </div>

            {/* Preview Simulation */}
            {showingPreview && preview.length > 0 && (
              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden animate-in slide-in-from-bottom-8 duration-700">
                <div className="p-10 bg-[#F4F9F8] border-b border-[#EBF7F7] flex items-center space-x-6">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-[#5CB85C] shadow-sm border border-[#EBF7F7]">
                    <FiShield className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Rate Modification Preview</h3>
                    <p className="text-slate-500 font-medium">A total of {preview.length} nodes will be affected by this operation.</p>
                  </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="px-8 py-5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID</th>
                        <th className="px-8 py-5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">LAB Test ID</th>
                        <th className="px-8 py-5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Category</th>
                        <th className="px-8 py-5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Current</th>
                        <th className="px-8 py-5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Optimized</th>
                        <th className="px-8 py-5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Variance</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-50">
                      {preview.slice(0, 50).map((item) => (
                        <tr key={item.row_id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-8 py-4 text-xs font-bold text-slate-400">{item.row_id}</td>
                          <td className="px-8 py-4 text-xs font-bold text-slate-700 uppercase tracking-tight">{item.LAB_TestID}</td>
                          <td className="px-8 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{item.category || '-'}</td>
                          <td className="px-8 py-4 text-xs font-bold text-slate-600">₹{item.current_value.toFixed(2)}</td>
                          <td className="px-8 py-4 text-xs font-bold text-[#5CB85C]">
                            ₹{item.new_value.toFixed(2)}
                          </td>
                          <td className="px-8 py-4 text-xs font-bold text-[#00B4C1]">
                            {item.difference > 0 ? '+' : ''}₹{item.difference.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-10 bg-slate-50 flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-6">
                  <button
                    onClick={applyRates}
                    disabled={loading}
                    className="flex-1 flex items-center justify-center px-10 py-5 bg-[#5CB85C] text-white font-bold rounded-2xl hover:bg-[#4CAE4C] transition-all uppercase tracking-widest text-xs shadow-md active:scale-[0.98]"
                  >
                    <FiCheck className="mr-2 text-lg" />
                    Commit Optimization Changes
                  </button>
                  <button
                    onClick={() => setShowingPreview(false)}
                    className="flex-1 flex items-center justify-center px-10 py-5 bg-white border border-slate-200 text-slate-500 font-bold rounded-2xl hover:bg-slate-50 transition-all uppercase tracking-widest text-xs"
                  >
                    <FiX className="mr-2 text-lg" />
                    Discard Simulation
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
