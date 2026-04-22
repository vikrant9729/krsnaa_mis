'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useAuthStore } from '../store/auth';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import api from '../api';
import { 
    FiUploadCloud, FiCheckCircle, FiAlertTriangle, FiTrash2, 
    FiCpu, FiActivity, FiLayers, FiDatabase, FiZap, FiFileText, FiRefreshCw
} from 'react-icons/fi';

const Layout = dynamic(() => import('../components/Layout'), { ssr: false });

export default function BulkOperations() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [stats, setStats] = useState({ total: 0, processed: 0, errors: 0 });
  const [activeTab, setActiveTab] = useState<'upload' | 'sync' | 'clean'>('upload');
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (!isAuthenticated) router.push('/login');
  }, [isAuthenticated, router]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setLogs([]);
    addLog('Initializing secure upload pipeline...');
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', 'replace');

    try {
      addLog(`Streaming data packet: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
      const response = await api.post('/api/bulk/upload', formData);
      const newJobId = response.data.job_id;
      setJobId(newJobId);
      addLog(`Handshake successful. Task ID: ${newJobId}`);
      addLog(`Total rows identified: ${response.data.total_rows.toLocaleString()}`);

      // Start Polling
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await api.get(`/api/bulk/progress/${newJobId}`);
          const { status, progress: currentProgress, processed_groups, error } = statusRes.data;
          
          setProgress(currentProgress);
          
          if (status === 'processing') {
            addLog(`Processing: ${currentProgress}% complete... (${processed_groups || 0} batches)`);
          } else if (status === 'completed') {
            clearInterval(pollInterval);
            setUploading(false);
            setProgress(100);
            addLog('🎉 Operation Complete: All records ingested successfully.');
            toast.success('Bulk Upload Complete');
          } else if (status === 'failed') {
            clearInterval(pollInterval);
            setUploading(false);
            addLog(`❌ CRITICAL ERROR: ${error}`);
            toast.error('Upload failed on server');
          }
        } catch (pollErr) {
          console.error('Polling error:', pollErr);
        }
      }, 2000);

    } catch (error: any) {
      addLog('CRITICAL ERROR: Transmission interrupted.');
      toast.error('Upload failed');
      setUploading(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Operations Console</h1>
            <p className="text-slate-500 font-medium">Mass data ingestion, synchronization, and index maintenance</p>
          </div>
          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-100">
            {(['upload', 'sync', 'clean'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                  activeTab === tab 
                  ? 'bg-[#00B4C1] text-white shadow-sm' 
                  : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Main Action Area */}
          <div className="space-y-8">
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#F4F9F8] rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700" />
              <h3 className="text-xl font-bold text-slate-800 mb-8 flex items-center">
                <FiUploadCloud className="mr-3 text-[#00B4C1]" />
                Master Data Ingestion
              </h3>
              
              <div className="border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center hover:border-[#00B4C1] transition-all bg-slate-50/50">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  accept=".xlsx,.xls,.csv"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <div className="w-20 h-20 bg-white rounded-full shadow-md flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform border border-slate-100">
                    <FiDatabase className="w-10 h-10 text-[#00B4C1]" />
                  </div>
                  <p className="text-slate-900 font-bold text-lg mb-1">{file ? file.name : 'Select Data Source'}</p>
                  <p className="text-slate-400 text-sm font-medium">Supports Excel (XLSX, XLS) or CSV payloads</p>
                </label>
              </div>

              {uploading && (
                <div className="mt-8 space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
                    <span>Processing Pipeline</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#00B4C1] transition-all duration-500 ease-out shadow-[0_0_10px_rgba(0,180,193,0.5)]" 
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className={`w-full mt-8 py-5 rounded-2xl font-bold tracking-widest uppercase text-sm transition-all shadow-sm ${
                  !file || uploading 
                  ? 'bg-slate-100 text-slate-400' 
                  : 'bg-[#5CB85C] text-white hover:bg-[#4CAE4C] active:scale-[0.98]'
                }`}
              >
                {uploading ? (
                    <div className="flex items-center justify-center">
                        <FiRefreshCw className="mr-2 animate-spin" />
                        Executing Pipeline...
                    </div>
                ) : 'Execute Upload'}
              </button>
            </div>

            {/* Performance Stats */}
            <div className="grid grid-cols-3 gap-6">
              {[
                { label: 'Total Scanned', value: stats.total, color: 'text-slate-600', bg: 'bg-slate-50' },
                { label: 'Processed', value: stats.processed, color: 'text-[#5CB85C]', bg: 'bg-[#F0F9F0]' },
                { label: 'Collisions', value: stats.errors, color: 'text-rose-500', bg: 'bg-rose-50' },
              ].map((s, i) => (
                <div key={i} className={`p-6 rounded-3xl border border-slate-100 ${s.bg} text-center shadow-sm`}>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Console Output */}
          <div className="bg-slate-900 rounded-[2rem] shadow-2xl p-8 flex flex-col h-[600px] border border-slate-800">
             <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-rose-500 rounded-full" />
                    <div className="w-3 h-3 bg-amber-500 rounded-full" />
                    <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                </div>
                <div className="flex items-center space-x-2">
                    <FiCpu className="text-[#00B4C1]" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Operation Log Stream</span>
                </div>
             </div>
             
             <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                {logs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-700">
                        <FiLayers className="w-12 h-12 mb-4 opacity-20" />
                        <p className="text-xs font-bold uppercase tracking-widest opacity-30">Waiting for transmission...</p>
                    </div>
                ) : (
                    logs.map((log, i) => (
                        <div key={i} className="text-xs font-medium tracking-tight border-l-2 border-slate-800 pl-4 py-1">
                            <span className="text-slate-500 mr-2 opacity-50">{log.split(']')[0]}]</span>
                            <span className={log.includes('ERROR') ? 'text-rose-400' : log.includes('Complete') ? 'text-[#5CB85C]' : 'text-slate-300'}>
                                {log.split(']')[1]}
                            </span>
                        </div>
                    ))
                )}
             </div>

             <div className="mt-6 pt-6 border-t border-slate-800 flex justify-between items-center">
                 <div className="flex items-center text-[10px] font-bold text-slate-500 tracking-widest uppercase">
                    <FiActivity className="mr-2 text-[#5CB85C] animate-pulse" />
                    Kernel: Online
                 </div>
                 <button onClick={() => setLogs([])} className="text-[10px] font-bold text-slate-500 hover:text-white uppercase tracking-widest">
                    Clear Logs
                 </button>
             </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 10px;
        }
      `}</style>
    </Layout>
  );
}
