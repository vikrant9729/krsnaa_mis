'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '../../store/auth';
import dynamic from 'next/dynamic';
import api from '../../api';
import toast from 'react-hot-toast';
import { FiRefreshCw, FiCheckCircle, FiAlertCircle, FiActivity, FiZap } from 'react-icons/fi';

const Layout = dynamic(() => import('../../components/Layout'), { ssr: false });

export default function Health() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [repairLog, setRepairLog] = useState<string[]>([]);
  const [repairStatus, setRepairStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [healthStatus, setHealthStatus] = useState<any>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    checkHealth();
  }, [isAuthenticated, router]);

  const checkHealth = async () => {
    try {
      const response = await api.get('/api/health');
      setHealthStatus(response.data);
    } catch (error) {
      toast.error('Failed to check backend health');
    }
  };

  const handleRepairAll = async () => {
    if (!confirm('This will repair all system issues and clean up corrupted records. Continue?')) return;
    
    setLoading(true);
    setRepairStatus('running');
    setRepairLog([]);

    try {
      const response = await api.post('/api/health/repair-all');
      setRepairLog(response.data.repairs || []);
      setRepairStatus('success');
      toast.success('All repairs completed successfully!');
    } catch (error: any) {
      setRepairStatus('error');
      const errorMsg = error.response?.data?.detail || error.message || 'Repair failed';
      setRepairLog([`❌ ERROR: ${errorMsg}`]);
      toast.error('Repair failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in duration-700">
        {/* Header */}
        <div className="flex justify-between items-end border-b border-slate-100 pb-6">
          <div>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">System Health & Repair</h1>
            <p className="text-slate-500 font-medium text-lg mt-1">Diagnose and fix all system issues automatically</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest">System Online</span>
          </div>
        </div>

        {/* Health Status Card */}
        {healthStatus && (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center">
                <FiActivity className="text-emerald-600 w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Backend Status</h2>
                <p className="text-sm text-slate-500 font-medium">{healthStatus.message || 'System operational'}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100">
              <div className="text-center">
                <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mb-2">Status</p>
                <p className="text-2xl font-black text-emerald-600">{healthStatus.status?.toUpperCase()}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mb-2">Version</p>
                <p className="text-2xl font-black text-[#00B4C1]">2.0.0</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mb-2">Last Check</p>
                <p className="text-sm font-bold text-slate-600">{new Date().toLocaleTimeString()}</p>
              </div>
            </div>
          </div>
        )}

        {/* Repair Engine Card */}
        <div className="bg-gradient-to-br from-indigo-900 to-indigo-800 text-white rounded-3xl p-8 shadow-2xl overflow-hidden relative">
          <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-700/30 rounded-full -mr-20 -mt-20" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                <FiZap className="text-[#00B4C1] w-7 h-7" />
              </div>
              <div>
                <h2 className="text-3xl font-bold">Automated Repair Engine</h2>
                <p className="text-indigo-200 text-sm font-medium">One-click fix for all system issues</p>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-3">
                <FiCheckCircle className="text-emerald-400 w-5 h-5 mt-0.5 shrink-0" />
                <p className="text-sm font-medium text-indigo-100">Cleans orphaned database records and broken foreign key relationships</p>
              </div>
              <div className="flex items-start gap-3">
                <FiCheckCircle className="text-emerald-400 w-5 h-5 mt-0.5 shrink-0" />
                <p className="text-sm font-medium text-indigo-100">Fixes invalid center self-references and DOS dataset links</p>
              </div>
              <div className="flex items-start gap-3">
                <FiCheckCircle className="text-emerald-400 w-5 h-5 mt-0.5 shrink-0" />
                <p className="text-sm font-medium text-indigo-100">Repairs all center test rate assignments and validates table structure</p>
              </div>
            </div>

            <button
              onClick={handleRepairAll}
              disabled={loading}
              className="w-full py-6 bg-[#00B4C1] text-white font-black rounded-2xl hover:bg-[#009AA6] shadow-lg shadow-[#00B4C1]/30 transition-all active:scale-[0.98] disabled:opacity-60 uppercase tracking-widest text-lg flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <FiRefreshCw className="animate-spin w-6 h-6" />
                  Repairing...
                </>
              ) : (
                <>
                  <FiZap className="w-6 h-6" />
                  Repair All System Issues
                </>
              )}
            </button>
          </div>
        </div>

        {/* Repair Log */}
        {repairLog.length > 0 && (
          <div className={`rounded-3xl border-2 overflow-hidden shadow-sm ${
            repairStatus === 'success' ? 'bg-emerald-50 border-emerald-200' :
            repairStatus === 'error' ? 'bg-rose-50 border-rose-200' :
            'bg-slate-50 border-slate-200'
          }`}>
            <div className={`px-8 py-6 border-b-2 flex items-center gap-3 ${
              repairStatus === 'success' ? 'bg-emerald-100 border-emerald-300' :
              repairStatus === 'error' ? 'bg-rose-100 border-rose-300' :
              'bg-slate-100 border-slate-300'
            }`}>
              {repairStatus === 'success' ? (
                <FiCheckCircle className="text-emerald-600 w-6 h-6" />
              ) : repairStatus === 'error' ? (
                <FiAlertCircle className="text-rose-600 w-6 h-6" />
              ) : (
                <FiRefreshCw className="text-slate-600 w-6 h-6 animate-spin" />
              )}
              <span className={`text-lg font-bold uppercase tracking-widest ${
                repairStatus === 'success' ? 'text-emerald-700' :
                repairStatus === 'error' ? 'text-rose-700' :
                'text-slate-700'
              }`}>
                {repairStatus === 'success' ? 'Repair Successful' :
                 repairStatus === 'error' ? 'Repair Failed' :
                 'Repair In Progress'}
              </span>
            </div>

            <div className="p-8 font-mono text-sm space-y-2 max-h-96 overflow-y-auto bg-white">
              {repairLog.map((line, idx) => (
                <div
                  key={idx}
                  className={`py-1 ${
                    line.includes('✓') ? 'text-emerald-600 font-bold' :
                    line.includes('❌') ? 'text-rose-600 font-bold' :
                    line.includes('⚠') ? 'text-amber-600 font-bold' :
                    line.includes('=') ? 'text-slate-400' :
                    'text-slate-600'
                  }`}
                >
                  {line}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Alert */}
        <div className="bg-amber-50 border-2 border-amber-100 rounded-3xl p-6 flex gap-4 items-start shadow-sm">
          <FiAlertCircle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-amber-800 mb-2">What Does This Do?</h4>
            <p className="text-sm text-amber-700 font-medium leading-relaxed">
              The repair engine automatically fixes database integrity issues, removes orphaned records, and validates all relationships. 
              It's safe to run multiple times and designed for zero data loss. Use this if you experience errors in Global Tests, 
              Center Network, or Rate Management sections.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
