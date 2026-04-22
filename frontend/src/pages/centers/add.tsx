import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { useAuthStore } from '../../store/auth';
import { centersApi } from '../../api/centers';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiSave, FiMapPin, FiHash, FiUser, FiLayers } from 'react-icons/fi';

const Layout = dynamic(() => import('../../components/Layout'), { ssr: false });

export default function AddCenter() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    center_code: '',
    center_type: 'HLM',
    owner_id: '',
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.center_code) {
      toast.error('Name and Center Code are required');
      return;
    }

    setLoading(true);
    try {
      await centersApi.create({
        name: formData.name,
        center_code: formData.center_code,
        center_type: formData.center_type as 'HLM' | 'CC' | 'PROJECT',
        owner_id: formData.owner_id || undefined,
      });
      toast.success('Center registered successfully!');
      router.push('/centers');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to register center');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (!isAuthenticated) return null;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Header */}
        <div className="flex items-center space-x-4 mb-8">
          <button 
            onClick={() => router.push('/centers')}
            className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-500 hover:text-[#00B4C1] hover:border-[#00B4C1]/30 transition-all shadow-sm"
          >
            <FiArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Register New Center</h1>
            <p className="text-slate-500 font-medium mt-1">Add a new diagnostic node to the network</p>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Center Name */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 tracking-tight">Center Name <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <FiMapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="e.g. HR HISAR"
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-[#00B4C1] focus:ring-1 focus:ring-[#00B4C1] rounded-xl outline-none font-medium text-slate-700 transition-all"
                      required
                    />
                  </div>
                </div>

                {/* Center Code */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 tracking-tight">Center Code (CC_Code) <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <FiHash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text"
                      name="center_code"
                      value={formData.center_code}
                      onChange={handleChange}
                      placeholder="e.g. 100302"
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-[#00B4C1] focus:ring-1 focus:ring-[#00B4C1] rounded-xl outline-none font-medium text-slate-700 transition-all"
                      required
                    />
                  </div>
                </div>

                {/* Center Type */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 tracking-tight">Center Type</label>
                  <div className="relative">
                    <FiLayers className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select 
                      name="center_type"
                      value={formData.center_type}
                      onChange={handleChange}
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-[#00B4C1] focus:ring-1 focus:ring-[#00B4C1] rounded-xl outline-none font-bold text-slate-700 transition-all appearance-none cursor-pointer"
                    >
                      <option value="HLM">HLM (Hospital Lab Management)</option>
                      <option value="CC">CC (Collection Center)</option>
                      <option value="PROJECT">PROJECT (Special Project)</option>
                    </select>
                  </div>
                </div>

                {/* Owner ID */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 tracking-tight">Owner ID (Optional)</label>
                  <div className="relative">
                    <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text"
                      name="owner_id"
                      value={formData.owner_id}
                      onChange={handleChange}
                      placeholder="e.g. 100302"
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-[#00B4C1] focus:ring-1 focus:ring-[#00B4C1] rounded-xl outline-none font-medium text-slate-700 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-end space-x-4">
                <button 
                  type="button"
                  onClick={() => router.push('/centers')}
                  className="px-6 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex items-center px-8 py-3 bg-[#00B4C1] text-white font-bold rounded-xl hover:bg-[#009AA6] shadow-sm transition-all disabled:opacity-70"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  ) : (
                    <FiSave className="mr-2" />
                  )}
                  {loading ? 'Registering...' : 'Register Center'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
}
