import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { useAuthStore } from '../../store/auth';
import { centersApi, Center } from '../../api/centers';
import { masterTestsApi, MasterTest } from '../../api/masterTests';
import api from '../../api';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiSave, FiMapPin, FiSearch, FiCheckCircle, FiInfo, FiRefreshCw } from 'react-icons/fi';

const Layout = dynamic(() => import('../../components/Layout'), { ssr: false });

export default function AssignTest() {
  const router = useRouter();
  const { center_id } = router.query;
  const { isAuthenticated } = useAuthStore();
  
  const [loading, setLoading] = useState(false);
  const [center, setCenter] = useState<Center | null>(null);
  
  // Test search & selection
  const [search, setSearch] = useState('');
  const [tests, setTests] = useState<MasterTest[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<number | null>(null);
  const [customRate, setCustomRate] = useState<string>('');

  useEffect(() => {
    if (!isAuthenticated) router.push('/login');
    if (center_id) loadCenter(Number(center_id));
  }, [isAuthenticated, router, center_id]);

  // Load tests when searching
  useEffect(() => {
    const fetchTests = async () => {
      if (!search) {
          setTests([]);
          return;
      }
      try {
        const response = await masterTestsApi.getAll(0, 20, search);
        setTests(response.items);
      } catch (error) {
        // Silent catch for search
      }
    };
    
    const timer = setTimeout(() => {
      fetchTests();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadCenter = async (id: number) => {
    try {
      const data = await centersApi.getById(id);
      setCenter(data);
    } catch (error) {
      toast.error('Failed to load center details');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!center_id || !selectedTestId) {
      toast.error('Please select a center and a test');
      return;
    }
    if (!customRate || isNaN(Number(customRate))) {
      toast.error('Please enter a valid rate');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/tests/centers', {
        center_id: Number(center_id),
        test_id: selectedTestId,
        custom_rate: Number(customRate),
      });
      toast.success('Test assigned successfully!');
      router.push('/tests');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to assign test');
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
            onClick={() => router.push('/tests')}
            className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-500 hover:text-[#00B4C1] hover:border-[#00B4C1]/30 transition-all shadow-sm"
          >
            <FiArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Assign Local Test</h1>
            <p className="text-slate-500 font-medium mt-1">
              Add a master test to {center ? <span className="font-bold text-[#00B4C1]">{center.name}</span> : 'the selected center'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden p-10">
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Test Selection */}
            <div className="space-y-4">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Search & Select Master Test <span className="text-rose-500">*</span></label>
              <div className="relative">
                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search test by name or code..."
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-transparent focus:border-[#00B4C1]/30 rounded-2xl outline-none font-bold text-slate-700 transition-all text-sm"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto custom-scrollbar p-2">
                {tests.map((test) => (
                  <button
                    key={test.id}
                    type="button"
                    onClick={() => setSelectedTestId(test.id)}
                    className={`flex flex-col items-start p-5 rounded-[1.5rem] border transition-all text-left relative overflow-hidden group ${
                      selectedTestId === test.id 
                        ? 'border-[#00B4C1] bg-[#EBF7F7] shadow-md shadow-[#00B4C1]/10' 
                        : 'border-slate-50 hover:border-[#00B4C1]/30 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex justify-between w-full items-start mb-2">
                        <div className="flex-1 pr-2">
                            <h4 className="font-bold text-slate-800 text-sm leading-tight">{test.test_name}</h4>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 block">{test.LAB_TestID}</span>
                        </div>
                        <div className="text-right">
                             <div className="text-sm font-bold text-[#00B4C1]">₹{test.mrp?.toLocaleString()}</div>
                             {test.mrp_source_center && test.mrp_source_center !== 'HR HISAR' && (
                                <div className="text-[8px] font-bold text-slate-400 italic">({test.mrp_source_center})</div>
                             )}
                        </div>
                    </div>
                    
                    {selectedTestId === test.id && (
                        <div className="absolute top-0 right-0 p-2">
                            <FiCheckCircle className="text-[#00B4C1] w-4 h-4" />
                        </div>
                    )}
                  </button>
                ))}
                {tests.length === 0 && search && (
                  <div className="col-span-2 py-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                    <FiSearch className="w-10 h-10 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No records found matching your query</p>
                  </div>
                )}
                {!search && (
                    <div className="col-span-2 py-12 text-center">
                        <p className="text-slate-400 font-medium text-sm">Type to begin searching the global catalog...</p>
                    </div>
                )}
              </div>
            </div>

            {/* Custom Rate */}
            <div className="bg-[#F4F9F8] p-8 rounded-3xl border border-[#EBF7F7]">
                <div className="flex items-center space-x-3 mb-4 text-[#00828A]">
                    <FiInfo />
                    <span className="text-xs font-bold uppercase tracking-widest">Rate Assignment</span>
                </div>
                <div className="max-w-xs">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Center Specific Rate (₹) <span className="text-rose-500">*</span></label>
                    <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                    <input 
                        type="number"
                        value={customRate}
                        onChange={(e) => setCustomRate(e.target.value)}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        className="w-full pl-8 pr-4 py-3 bg-white border border-transparent focus:border-[#00B4C1]/30 rounded-xl outline-none font-bold text-slate-700 transition-all shadow-sm"
                        required
                    />
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="pt-6 flex items-center justify-end space-x-4">
              <button 
                type="button"
                onClick={() => router.push('/tests')}
                className="px-8 py-4 text-slate-400 font-bold rounded-2xl hover:bg-slate-50 transition-all uppercase tracking-widest text-[10px]"
              >
                Abondon
              </button>
              <button 
                type="submit"
                disabled={loading || !selectedTestId}
                className="flex items-center px-10 py-4 bg-[#00B4C1] text-white font-bold rounded-2xl hover:bg-[#009AA6] shadow-lg shadow-[#00B4C1]/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed active:scale-95"
              >
                {loading ? (
                  <FiRefreshCw className="animate-spin mr-2" />
                ) : (
                  <FiSave className="mr-2" />
                )}
                {loading ? 'Assigning...' : 'Assign to Center Catalog'}
              </button>
            </div>
          </form>
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
          background: #E2E8F0;
          border-radius: 10px;
        }
      `}</style>
    </Layout>
  );
}
