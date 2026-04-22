'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '../../store/auth';
import dynamic from 'next/dynamic';
import { centersApi, Center } from '../../api/centers';
import toast from 'react-hot-toast';
import { 
    FiUpload, FiDownload, FiFile, FiRefreshCw, FiCheckCircle, 
    FiActivity, FiLayers, FiDatabase, FiCpu, FiAlertTriangle 
} from 'react-icons/fi';
import api from '../../api';
import { formatApiError } from '../../utils/apiError';

const Layout = dynamic(() => import('../../components/Layout'), { ssr: false });

export default function DOSUpload() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [centers, setCenters] = useState<Center[]>([]);
  const [selectedCenter, setSelectedCenter] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState('replace');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

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

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCenter || !file) {
      toast.error('Please select center and file');
      return;
    }

    setUploading(true);
    setProgress(0);
    setLogs([]);
    addLog('Initializing high-speed ingestion pipeline...');

    const formData = new FormData();
    formData.append('center_id', selectedCenter.toString());
    formData.append('mode', uploadMode);
    formData.append('file', file);

    try {
      addLog(`Streaming data packet: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
      const response = await api.post('/api/dos/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      const newJobId = response.data.job_id;
      setJobId(newJobId);
      addLog(`Handshake successful. Task ID: ${newJobId}`);
      addLog(`Total rows identified: ${response.data.total_rows.toLocaleString()}`);

      // Start Polling
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await api.get(`/api/jobs/progress/${newJobId}`);
          const { status, progress: currentProgress, processed, error, dataset_id } = statusRes.data;
          
          setProgress(currentProgress);
          
          if (status === 'processing') {
            addLog(`Ingestion progress: ${currentProgress}% complete... (${processed || 0} rows)`);
          } else if (status === 'completed') {
            clearInterval(pollInterval);
            setUploading(false);
            setProgress(100);
            addLog('🎉 Operation Complete: Dataset persisted successfully.');
            toast.success('DOS Upload Complete');
            // Optional: redirect to view the dataset
            if (dataset_id) {
                setTimeout(() => router.push(`/dos/view`), 2000);
            }
          } else if (status === 'failed') {
            clearInterval(pollInterval);
            setUploading(false);
            addLog(`❌ CRITICAL FAILURE: ${error}`);
            toast.error('Upload failed on server');
          }
        } catch (pollErr) {
          console.error('Polling error:', pollErr);
        }
      }, 2000);

    } catch (error: any) {
      addLog('CRITICAL FAILURE: Transmission interrupted.');
      toast.error(formatApiError(error.response?.data?.detail, 'Upload failed'));
      setUploading(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await api.get('/api/dos/template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'DOS_Template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Template downloaded!');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  if (!isAuthenticated) return null;

  return (
    <Layout>
      <div className="max-w-[1400px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">DOS Data Ingestion</h1>
            <p className="text-slate-500 font-medium">Standardize and localize center catalogs via batch upload</p>
          </div>
          <button
            onClick={downloadTemplate}
            className="flex items-center px-6 py-3 bg-[#EBF7F7] text-[#00B4C1] font-bold rounded-xl hover:bg-[#DFF1F1] transition-all border border-[#00B4C1]/20"
          >
            <FiDownload className="mr-2" />
            Download Master Template
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Main Action Area */}
          <div className="space-y-8">
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#F4F9F8] rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700" />
              <h3 className="text-xl font-bold text-slate-800 mb-8 flex items-center">
                <FiUpload className="mr-3 text-[#00B4C1]" />
                Ingestion Configuration
              </h3>
              
              <form onSubmit={handleUpload} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                        Target Center Node
                        </label>
                        <select
                        value={selectedCenter || ''}
                        onChange={(e) => setSelectedCenter(Number(e.target.value))}
                        className="w-full px-4 py-3 bg-slate-50 border border-transparent focus:border-[#00B4C1]/30 rounded-2xl outline-none font-bold text-slate-700 transition-all text-sm appearance-none cursor-pointer"
                        required
                        >
                        <option value="">Select Target...</option>
                        {centers.map(center => (
                            <option key={center.id} value={center.id}>
                            {center.name} ({center.center_type})
                            </option>
                        ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                        Upload Mode
                        </label>
                        <select
                        value={uploadMode}
                        onChange={(e) => setUploadMode(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-transparent focus:border-[#00B4C1]/30 rounded-2xl outline-none font-bold text-slate-700 transition-all text-sm appearance-none cursor-pointer"
                        >
                        <option value="replace">Full Replacement</option>
                        <option value="append">Incremental Merge</option>
                        </select>
                    </div>
                </div>

                <div className="border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center hover:border-[#00B4C1] transition-all bg-slate-50/50 relative group/file">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload-dos"
                    required
                  />
                  <label htmlFor="file-upload-dos" className="cursor-pointer">
                    <div className="w-20 h-20 bg-white rounded-full shadow-md flex items-center justify-center mx-auto mb-6 group-hover/file:scale-110 transition-transform border border-slate-100">
                      <FiFile className="w-10 h-10 text-[#00B4C1]" />
                    </div>
                    <p className="text-slate-900 font-bold text-lg mb-1">{file ? file.name : 'Drop Payload Here'}</p>
                    <p className="text-slate-400 text-xs font-medium">XLSX, XLS or CSV payloads up to 50MB</p>
                  </label>
                </div>

                {uploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      <span>Pipeline Flow</span>
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
                  type="submit"
                  disabled={uploading || !selectedCenter || !file}
                  className={`w-full py-5 rounded-2xl font-bold tracking-widest uppercase text-xs transition-all shadow-sm ${
                    !file || uploading 
                    ? 'bg-slate-100 text-slate-400' 
                    : 'bg-[#00B4C1] text-white hover:bg-[#009AA6] active:scale-[0.98]'
                  }`}
                >
                  {uploading ? (
                      <div className="flex items-center justify-center">
                          <FiRefreshCw className="mr-2 animate-spin" />
                          Processing...
                      </div>
                  ) : 'Initialize Ingestion'}
                </button>
              </form>
            </div>

            {/* Mode Guide */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-start space-x-4">
                    <div className="p-3 bg-amber-50 rounded-xl text-amber-500"><FiRefreshCw /></div>
                    <div>
                        <h4 className="text-sm font-bold text-slate-800">Replacement Mode</h4>
                        <p className="text-xs text-slate-400 mt-1">Creates a clean versioned snapshot. All existing data for the center will be archived.</p>
                    </div>
                </div>
                <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm flex items-start space-x-4">
                    <div className="p-3 bg-emerald-50 rounded-xl text-emerald-500"><FiLayers /></div>
                    <div>
                        <h4 className="text-sm font-bold text-slate-800">Merge Mode</h4>
                        <p className="text-xs text-slate-400 mt-1">Intelligent merge that only adds missing tests while preserving current configurations.</p>
                    </div>
                </div>
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
                        <FiActivity className="w-12 h-12 mb-4 opacity-20" />
                        <p className="text-xs font-bold uppercase tracking-widest opacity-30">Pipeline Standby...</p>
                    </div>
                ) : (
                    logs.map((log, i) => (
                        <div key={i} className="text-xs font-medium tracking-tight border-l-2 border-slate-800 pl-4 py-1">
                            <span className="text-slate-500 mr-2 opacity-50">{log.split(']')[0]}]</span>
                            <span className={log.includes('FAILURE') || log.includes('ERROR') ? 'text-rose-400' : log.includes('Complete') ? 'text-[#5CB85C]' : 'text-slate-300'}>
                                {log.split(']')[1]}
                            </span>
                        </div>
                    ))
                )}
             </div>

             <div className="mt-6 pt-6 border-t border-slate-800 flex justify-between items-center">
                 <div className="flex items-center text-[10px] font-bold text-slate-500 tracking-widest uppercase">
                    <FiCheckCircle className={`mr-2 ${uploading ? 'text-amber-400 animate-pulse' : 'text-[#5CB85C]'}`} />
                    Engine Status: {uploading ? 'Busy' : 'Available'}
                 </div>
                 <button onClick={() => setLogs([])} className="text-[10px] font-bold text-slate-500 hover:text-white uppercase tracking-widest">
                    Flush Buffer
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
