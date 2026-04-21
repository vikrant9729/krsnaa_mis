'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '../store/auth';
import dynamic from 'next/dynamic';
import { centersApi, Center } from '../api/centers';
import toast from 'react-hot-toast';
import api from '../api';
import { formatApiError } from '../utils/apiError';
import { FiSearch, FiAlertTriangle, FiCheckCircle, FiSettings, FiActivity, FiZap, FiShield, FiCpu, FiRefreshCw, FiDatabase } from 'react-icons/fi';

const Layout = dynamic(() => import('../components/Layout'), { ssr: false });

interface QualityReport {
  center_id: number;
  center_code: string;
  center_name: string;
  total_rows: number;
  duplicate_tests: number;
  missing_fields: number;
  invalid_rates: number;
  anomaly_count: number;
  health_score: number;
}

export default function DataQuality() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [centers, setCenters] = useState<Center[]>([]);
  const [selectedCenter, setSelectedCenter] = useState<number | null>(null);
  const [report, setReport] = useState<QualityReport | null>(null);
  const [scanning, setScanning] = useState(false);

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

  const scanData = async () => {
    if (!selectedCenter) {
      toast.error('Please select a center');
      return;
    }

    setScanning(true);
    setReport(null);
    try {
      const response = await api.post(`/api/ai/scan/${selectedCenter}`);
      setReport(response.data);
      toast.success('System Scan Complete');
    } catch (error: any) {
      toast.error(formatApiError(error.response?.data?.detail, 'Scan failed'));
    } finally {
      setScanning(false);
    }
  };

  const fixDuplicates = async () => {
    if (!selectedCenter || !report) return;
    try {
      toast.loading('Deduplicating entries...', { id: 'fix' });
      await api.post(`/api/ai/fix-duplicates/${selectedCenter}`);
      toast.success(`Purged ${report.duplicate_tests} duplicates`, { id: 'fix' });
      scanData();
    } catch (error) {
      toast.error('Failed to fix duplicates', { id: 'fix' });
    }
  };

  const fixMissingFields = async () => {
    if (!selectedCenter || !report) return;
    try {
      toast.loading('Reconstructing missing data...', { id: 'fix' });
      await api.post(`/api/ai/fill-missing/${selectedCenter}`);
      toast.success(`Populated ${report.missing_fields} fields`, { id: 'fix' });
      scanData();
    } catch (error) {
      toast.error('Failed to fix missing fields', { id: 'fix' });
    }
  };

  const fixInvalidRates = async () => {
    if (!selectedCenter || !report) return;
    try {
      toast.loading('Recalibrating rate structures...', { id: 'fix' });
      await api.post(`/api/ai/fix-rates/${selectedCenter}`);
      toast.success(`Corrected ${report.invalid_rates} rates`, { id: 'fix' });
      scanData();
    } catch (error) {
      toast.error('Failed to fix invalid rates', { id: 'fix' });
    }
  };

  const getHealthTheme = (score: number) => {
    if (score >= 90) return { text: 'text-[#5CB85C]', bg: 'bg-[#F0F9F0]', border: 'border-[#5CB85C]/20' };
    if (score >= 70) return { text: 'text-[#E37222]', bg: 'bg-[#FFF3EB]', border: 'border-[#E37222]/20' };
    return { text: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-100' };
  };

  if (!isAuthenticated) return null;

  return (
    <Layout>
      <div className="max-w-[1200px] mx-auto animate-in fade-in slide-in-from-bottom-6 duration-1000">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
          <div>
            <h1 className="text-4xl font-bold text-slate-800 tracking-tight leading-tight">Data Health Sentinel</h1>
            <p className="text-slate-500 mt-1 font-bold tracking-tight">AI-driven diagnostic dataset analysis and automated repair pipeline</p>
          </div>
          <div className="flex items-center px-4 py-2 bg-[#EBF7F7] text-[#00828A] rounded-full text-xs font-bold tracking-widest uppercase border border-[#D5EFEF]">
            <FiShield className="mr-2" />
            Active Protection
          </div>
        </div>

        {/* Center Selector Console */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 mb-10 flex flex-col md:flex-row gap-6 items-center group overflow-hidden relative">
          <div className="flex-1 w-full relative z-10">
            <label className="block text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase mb-2 ml-1">Target Infrastructure Node</label>
            <div className="relative">
                <FiActivity className="absolute left-4 top-1/2 -translate-y-1/2 text-[#00B4C1]" />
                <select
                value={selectedCenter || ''}
                onChange={(e) => setSelectedCenter(Number(e.target.value))}
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-transparent focus:border-[#00B4C1]/30 rounded-2xl outline-none transition-all font-bold text-slate-800 cursor-pointer appearance-none"
                >
                <option value="">Select a center node...</option>
                {centers.map(center => (
                    <option key={center.id} value={center.id}>
                    {center.name} ({center.center_type})
                    </option>
                ))}
                </select>
            </div>
          </div>
          <button
            onClick={scanData}
            disabled={scanning || !selectedCenter}
            className={`md:self-end px-10 py-4 font-bold tracking-widest uppercase text-sm rounded-2xl transition-all duration-500 relative z-10 ${
                scanning || !selectedCenter 
                ? 'bg-slate-100 text-slate-400' 
                : 'bg-[#00B4C1] text-white hover:bg-[#009AA6] shadow-sm shadow-[#00B4C1]/30 active:scale-95'
            }`}
          >
            {scanning ? (
              <div className="flex items-center">
                <FiRefreshCw className="mr-2 animate-spin" />
                Scanning...
              </div>
            ) : (
              <div className="flex items-center">
                <FiZap className="mr-2" />
                Initiate Scan
              </div>
            )}
          </button>
        </div>

        {/* Scan Results Visualization */}
        {report && (
          <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
            {/* Global Health Indicator */}
            <div className={`rounded-3xl p-10 border transition-all duration-700 ${getHealthTheme(report.health_score).bg} ${getHealthTheme(report.health_score).border}`}>
              <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                <div>
                  <h2 className="text-3xl font-bold text-slate-800 tracking-tight mb-2">Network Health Integrity</h2>
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Node Identifier: {report.center_code} // {report.center_name}</p>
                </div>
                <div className="relative w-40 h-40 flex items-center justify-center">
                   <div className="absolute inset-0 border-[10px] border-white rounded-full opacity-50" />
                   <div className={`text-6xl font-bold tracking-tighter ${getHealthTheme(report.health_score).text}`}>
                     {report.health_score}<span className="text-2xl font-bold opacity-40">%</span>
                   </div>
                </div>
              </div>
            </div>

            {/* Metrics Cluster */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                  { label: 'Total Capacity', value: report.total_rows, icon: FiActivity, color: '#00B4C1', bg: 'bg-[#EBF7F7]' },
                  { label: 'Redundant Records', value: report.duplicate_tests, icon: FiAlertTriangle, color: '#E37222', bg: 'bg-[#FFF3EB]' },
                  { label: 'Null Data Fields', value: report.missing_fields, icon: FiShield, color: '#00828A', bg: 'bg-[#F4F9F8]' },
                  { label: 'Anomaly Detected', value: report.invalid_rates, icon: FiZap, color: '#ef4444', bg: 'bg-rose-50' },
              ].map((stat, i) => (
                  <div key={i} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm group hover:border-[#00B4C1]/20 transition-all duration-500">
                    <div className={`w-12 h-12 ${stat.bg} rounded-2xl flex items-center justify-center mb-6 border border-slate-50 transition-transform group-hover:rotate-12`}>
                        <stat.icon className="w-6 h-6" style={{ color: stat.color }} />
                    </div>
                    <h3 className="text-slate-400 text-[10px] font-bold tracking-[0.2em] uppercase mb-1">{stat.label}</h3>
                    <p className="text-3xl font-bold tracking-tighter text-slate-900">
                        {stat.value.toLocaleString()}
                    </p>
                  </div>
              ))}
            </div>

            {/* Action Neural Center */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Intelligent Insights */}
              <div className="bg-slate-900 rounded-3xl p-10 shadow-xl border border-slate-800 relative overflow-hidden group">
                 <h3 className="text-2xl font-bold text-white tracking-tight mb-8 flex items-center">
                    <FiCpu className="mr-3 text-[#00B4C1]" />
                    AI Insights & Recommendations
                 </h3>
                 <div className="space-y-4">
                    {[
                        { cond: report.duplicate_tests > 0, text: `Purge ${report.duplicate_tests} redundant entries to optimize index integrity`, theme: 'amber' },
                        { cond: report.missing_fields > 0, text: `Reconstruct ${report.missing_fields} missing parameters to ensure data completeness`, theme: 'orange' },
                        { cond: report.invalid_rates > 0, text: `Recalibrate ${report.invalid_rates} rate values to prevent financial leakage`, theme: 'rose' },
                        { cond: report.health_score >= 90, text: `System parameters within optimal range. Integrity verified.`, theme: 'emerald' },
                    ].map((rec, i) => rec.cond && (
                        <div key={i} className={`p-5 rounded-2xl bg-${rec.theme}-600/10 border border-${rec.theme}-500/20 flex items-start space-x-4 animate-in slide-in-from-left-4 duration-500`} style={{ animationDelay: `${i * 100}ms` }}>
                            <div className={`w-2 h-2 rounded-full bg-${rec.theme}-500 mt-2 flex-shrink-0 animate-pulse`} />
                            <span className="text-white font-medium text-sm tracking-tight">{rec.text}</span>
                        </div>
                    ))}
                 </div>
              </div>

              {/* Automated Repair Panel */}
              <div className="bg-white rounded-3xl p-10 border border-slate-100 shadow-sm">
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight mb-8">Automated Repair Matrix</h3>
                <div className="space-y-4">
                  {[
                      { cond: report.duplicate_tests > 0, label: `Deduplicate (${report.duplicate_tests})`, icon: FiShield, color: 'text-[#E37222]', bg: 'bg-[#FFF3EB]', action: fixDuplicates },
                      { cond: report.missing_fields > 0, label: `Reconstruct Data (${report.missing_fields})`, icon: FiDatabase, color: 'text-[#00B4C1]', bg: 'bg-[#EBF7F7]', action: fixMissingFields },
                      { cond: report.invalid_rates > 0, label: `Recalibrate Rates (${report.invalid_rates})`, icon: FiActivity, color: 'text-rose-500', bg: 'bg-rose-50', action: fixInvalidRates },
                  ].map((fix, i) => fix.cond && (
                    <button
                      key={i}
                      onClick={fix.action}
                      className={`w-full flex items-center justify-between p-6 ${fix.bg} hover:opacity-80 rounded-2xl transition-all group`}
                    >
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-50 group-hover:scale-110 transition-transform">
                            <fix.icon className={`w-5 h-5 ${fix.color}`} />
                        </div>
                        <span className="ml-4 text-slate-800 font-bold text-sm">{fix.label}</span>
                      </div>
                      <FiZap className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </button>
                  ))}
                  {!report.duplicate_tests && !report.missing_fields && !report.invalid_rates && (
                      <div className="h-full flex flex-col items-center justify-center py-10 text-center">
                          <div className="w-20 h-20 bg-[#F0F9F0] rounded-full flex items-center justify-center text-[#5CB85C] mb-4 border border-[#5CB85C]/10">
                             <FiCheckCircle className="w-10 h-10" />
                          </div>
                          <p className="text-[#5CB85C] font-bold tracking-tight">Optimal Health Verified</p>
                          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">No repair actions required</p>
                      </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Neural Idle State */}
        {!report && !scanning && (
          <div className="bg-white rounded-3xl border border-dashed border-slate-200 py-32 text-center shadow-sm">
            <div className="w-20 h-20 bg-slate-50 rounded-full shadow-sm mx-auto flex items-center justify-center mb-8 border border-slate-100">
                <FiCpu className="w-10 h-10 text-slate-300 animate-pulse" />
            </div>
            <h3 className="text-2xl font-bold text-slate-400 tracking-tight">Sentinel Idle</h3>
            <p className="text-slate-400 font-medium tracking-tight mt-2 max-w-sm mx-auto">Select a network node to initiate AI quality analysis and integrity verification.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
