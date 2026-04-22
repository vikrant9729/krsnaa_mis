import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useAuthStore } from '../store/auth';
import { centersApi, Center } from '../api/centers';
import toast from 'react-hot-toast';
import api from '../api';
import { 
    FiPercent, FiTag, FiUploadCloud, FiCheckCircle, FiAlertCircle, 
    FiSettings, FiGrid, FiList, FiTrendingUp, FiDatabase 
} from 'react-icons/fi';

const Layout = dynamic(() => import('../components/Layout'), { ssr: false });

export default function RateManagement() {
    const router = useRouter();
    const { isAuthenticated } = useAuthStore();
    
    // State for Single Center / Category Update
    const [centers, setCenters] = useState<Center[]>([]);
    const [selectedCenter, setSelectedCenter] = useState<string>('');
    const [categories, setCategories] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [updateType, setUpdateType] = useState<'percentage' | 'fixed'>('percentage');
    const [updateValue, setUpdateValue] = useState<number>(0);
    const [loading, setLoading] = useState(false);
    const [testsInCenter, setTestsInCenter] = useState<any[]>([]);
    const [selectedTestCode, setSelectedTestCode] = useState<string>('');

    // State for Bulk Multi-Center Update
    const [selectedCenters, setSelectedCenters] = useState<number[]>([]);
    const [specialFile, setSpecialFile] = useState<File | null>(null);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [sourceMode, setSourceMode] = useState<'upload' | 'saved'>('upload');
    const [savedLists, setSavedLists] = useState<any[]>([]);
    const [selectedListId, setSelectedListId] = useState<string>('');
    const [shouldSaveList, setShouldSaveList] = useState(false);
    const [newListName, setNewListName] = useState('');
    
    // Filters for Center List
    const [typeFilter, setTypeFilter] = useState<string>('');
    const [billTypeFilter, setBillTypeFilter] = useState<string>('');

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

    const loadCategories = async (centerId: string) => {
        if (!centerId) return;
        try {
            const response = await api.get(`/api/dos/categories/${centerId}`);
            setCategories(response.data);
        } catch (error) {
            toast.error('Failed to load categories');
        }
    };

    useEffect(() => {
        if (selectedCenter) {
            loadCategories(selectedCenter);
            loadTestsForCenter(selectedCenter);
        } else {
            setCategories([]);
            setTestsInCenter([]);
        }
        setSelectedCategory('');
        setSelectedTestCode('');
    }, [selectedCenter]);

    const loadTestsForCenter = async (centerId: string) => {
        try {
            const response = await api.get(`/api/dos/list?center_id=${centerId}&page_size=1000`);
            setTestsInCenter(response.data.items || []);
        } catch (error) {
            toast.error('Failed to load tests');
        }
    };

    const handleCategoryUpdate = async () => {
        if (!selectedCenter || !selectedCategory) {
            toast.error('Please select both center and category');
            return;
        }
        
        setLoading(true);
        try {
            await api.post(`/api/rate-management/category-update`, null, {
                params: {
                    center_id: selectedCenter,
                    category: selectedCategory,
                    test_code: selectedTestCode || undefined,
                    update_type: updateType,
                    value: updateValue
                }
            });
            toast.success('Rates updated successfully');
        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Update failed');
        } finally {
            setLoading(false);
        }
    };

    const handleBulkUpdate = async () => {
        if (selectedCenters.length === 0 || !specialFile) {
            toast.error('Please select centers and upload a file');
            return;
        }

        setBulkLoading(true);
        const formData = new FormData();
        formData.append('file', specialFile);
        formData.append('center_ids', JSON.stringify(selectedCenters));

        try {
            const response = await api.post(`/api/rate-management/bulk-center-update`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success(response.data.message);
        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Bulk update failed');
        } finally {
            setBulkLoading(false);
        }
    };

    const handleApplySavedList = async () => {
        if (selectedCenters.length === 0 || !selectedListId) {
            toast.error('Please select centers and a saved list');
            return;
        }

        setBulkLoading(true);
        try {
            const response = await api.post(`/api/rate-management/apply-saved-list`, {
                list_id: Number(selectedListId),
                center_ids: selectedCenters
            });
            toast.success(response.data.message);
        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Apply failed');
        } finally {
            setBulkLoading(false);
        }
    };

    const loadSavedLists = async () => {
        try {
            const response = await api.get('/api/rate-management/special-lists');
            setSavedLists(response.data);
        } catch (error) {
            toast.error('Failed to load saved lists');
        }
    };

    useEffect(() => {
        loadSavedLists();
    }, []);

    const toggleCenter = (id: number) => {
        setSelectedCenters(prev => 
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const filteredCenters = centers.filter(c => {
        const matchesType = !typeFilter || c.type === typeFilter;
        const matchesBillType = !billTypeFilter || c.bill_type === billTypeFilter;
        return matchesType && matchesBillType;
    });

    const selectAllFiltered = () => {
        const filteredIds = filteredCenters.map(c => c.id);
        const newSelected = Array.from(new Set([...selectedCenters, ...filteredIds]));
        setSelectedCenters(newSelected);
    };

    const deselectAllFiltered = () => {
        const filteredIds = filteredCenters.map(c => c.id);
        setSelectedCenters(prev => prev.filter(id => !filteredIds.includes(id)));
    };

    const uniqueTypes = Array.from(new Set(centers.map(c => c.type).filter(Boolean)));
    const uniqueBillTypes = Array.from(new Set(centers.map(c => c.bill_type).filter(Boolean)));

    const downloadTemplate = () => {
        const headers = "Test_Code,Test_Name,New_Rate\nKDPL3177,RENAL FUNCTION TEST (RFT),650.00\nKDPL3188,SERUM ELECTROLYTES,400.00";
        const blob = new Blob([headers], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Special_Rate_List_Template.csv';
        a.click();
    };

    return (
        <Layout>
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex justify-between items-end border-b border-slate-100 pb-6">
                    <div>
                        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Rate Strategy Engine</h1>
                        <p className="text-slate-500 font-medium text-lg mt-1">Configure hierarchical pricing and bulk rate adjustments</p>
                    </div>
                    <div className="flex gap-2">
                         <div className="px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-xs font-bold uppercase tracking-widest flex items-center">
                            <FiTrendingUp className="mr-2" /> Live Pricing
                         </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Category Based Update */}
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden flex flex-col">
                        <div className="p-8 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                                    <FiTag className="w-6 h-6 text-[#00B4C1]" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold">Category Pricing</h2>
                                    <p className="text-slate-400 text-sm font-medium">Update rates by test categorization</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 space-y-6 flex-1">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-500 ml-1">Target Center</label>
                                <select 
                                    value={selectedCenter}
                                    onChange={(e) => setSelectedCenter(e.target.value)}
                                    className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-[#00B4C1]/20 rounded-2xl outline-none font-bold text-slate-700 transition-all appearance-none"
                                >
                                    <option value="">Select a Center</option>
                                    {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-500 ml-1">Test Category</label>
                                <select 
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                    disabled={!selectedCenter}
                                    className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-[#00B4C1]/20 rounded-2xl outline-none font-bold text-slate-700 transition-all disabled:opacity-50"
                                >
                                    <option value="">Select Category</option>
                                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-500 ml-1">Specific Test (Optional)</label>
                                <select 
                                    value={selectedTestCode}
                                    onChange={(e) => setSelectedTestCode(e.target.value)}
                                    disabled={!selectedCenter}
                                    className="w-full px-5 py-4 bg-slate-50 border-2 border-transparent focus:border-[#00B4C1]/20 rounded-2xl outline-none font-bold text-slate-700 transition-all disabled:opacity-50"
                                >
                                    <option value="">All Tests in Category</option>
                                    {testsInCenter
                                        .filter(t => !selectedCategory || (t.data_json.TestCategory_Mapped || t.data_json.Category) === selectedCategory)
                                        .map(t => {
                                            const code = t.data_json.LAB_TestID || t.data_json.Test_Code;
                                            const name = t.data_json.Test_Name || t.data_json.test_name;
                                            return <option key={t.id} value={code}>{code} - {name}</option>;
                                        })
                                    }
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <button 
                                    onClick={() => setUpdateType('percentage')}
                                    className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${updateType === 'percentage' ? 'bg-[#00B4C1]/5 border-[#00B4C1] text-[#00B4C1]' : 'bg-slate-50 border-transparent text-slate-400'}`}
                                >
                                    <FiPercent className="w-6 h-6" />
                                    <span className="text-xs font-bold uppercase tracking-widest">Percentage</span>
                                </button>
                                <button 
                                    onClick={() => setUpdateType('fixed')}
                                    className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${updateType === 'fixed' ? 'bg-[#00B4C1]/5 border-[#00B4C1] text-[#00B4C1]' : 'bg-slate-50 border-transparent text-slate-400'}`}
                                >
                                    <FiGrid className="w-6 h-6" />
                                    <span className="text-xs font-bold uppercase tracking-widest">Fixed Rate</span>
                                </button>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-500 ml-1">
                                    {updateType === 'percentage' ? 'Adjustment (%)' : 'New Fixed Rate (₹)'}
                                </label>
                                <div className="relative">
                                    <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                                        {updateType === 'percentage' ? '%' : '₹'}
                                    </span>
                                    <input 
                                        type="number"
                                        value={updateValue}
                                        onChange={(e) => setUpdateValue(Number(e.target.value))}
                                        className="w-full pl-10 pr-5 py-4 bg-slate-50 border-2 border-transparent focus:border-[#00B4C1]/20 rounded-2xl outline-none font-bold text-slate-700"
                                    />
                                </div>
                                {updateType === 'percentage' && (
                                    <p className="text-[10px] text-slate-400 font-bold ml-1 italic">
                                        Tip: Use negative numbers for discounts (e.g. -10 for 10% off)
                                    </p>
                                )}
                            </div>

                            <button 
                                onClick={handleCategoryUpdate}
                                disabled={loading || !selectedCenter || !selectedCategory}
                                className="w-full py-5 bg-[#00B4C1] text-white font-black rounded-2xl hover:bg-[#009AA6] shadow-lg shadow-[#00B4C1]/20 transition-all active:scale-[0.98] disabled:opacity-50 mt-4 uppercase tracking-widest text-sm"
                            >
                                {loading ? 'Processing...' : 'Apply Rate Strategy'}
                            </button>
                        </div>
                    </div>

                    {/* Bulk Multi-Center Update */}
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden flex flex-col">
                        <div className="p-8 bg-gradient-to-br from-indigo-900 to-indigo-800 text-white">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
                                    <FiDatabase className="w-6 h-6 text-[#00B4C1]" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold">Cross-Network Update</h2>
                                    <p className="text-indigo-200 text-sm font-medium">Bulk update tests across multiple centers</p>
                                </div>
                            </div>
                            
                            {/* Source Mode Toggle */}
                            <div className="flex bg-indigo-950/30 p-1 rounded-xl mt-4">
                                <button 
                                    onClick={() => setSourceMode('upload')}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${sourceMode === 'upload' ? 'bg-[#00B4C1] text-white shadow-lg' : 'text-indigo-300 hover:text-white'}`}
                                >
                                    Upload New
                                </button>
                                <button 
                                    onClick={() => setSourceMode('saved')}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${sourceMode === 'saved' ? 'bg-[#00B4C1] text-white shadow-lg' : 'text-indigo-300 hover:text-white'}`}
                                >
                                    Saved Vault
                                </button>
                            </div>
                        </div>

                        <div className="p-8 space-y-6 flex-1 flex flex-col">
                            <div className="flex-1 space-y-4">
                                <div className="flex justify-between items-center">
                                    <label className="text-sm font-bold text-slate-500 ml-1">Select Centers</label>
                                    <span className="text-[#00B4C1] text-xs font-bold uppercase tracking-widest">{selectedCenters.length} Selected</span>
                                </div>
                                
                                {/* List Filters */}
                                <div className="grid grid-cols-2 gap-2">
                                    <select 
                                        value={typeFilter}
                                        onChange={(e) => setTypeFilter(e.target.value)}
                                        className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold text-slate-500 outline-none focus:border-indigo-300 transition-all"
                                    >
                                        <option value="">All Types</option>
                                        {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                    <select 
                                        value={billTypeFilter}
                                        onChange={(e) => setBillTypeFilter(e.target.value)}
                                        className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold text-slate-500 outline-none focus:border-indigo-300 transition-all"
                                    >
                                        <option value="">All Bill Types</option>
                                        {uniqueBillTypes.map(bt => <option key={bt} value={bt}>{bt}</option>)}
                                    </select>
                                </div>

                                <div className="flex gap-2">
                                    <button 
                                        onClick={selectAllFiltered}
                                        className="flex-1 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-100 transition-all"
                                    >
                                        Select All Filtered
                                    </button>
                                    <button 
                                        onClick={deselectAllFiltered}
                                        className="flex-1 py-2 bg-slate-50 text-slate-400 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-100 transition-all"
                                    >
                                        Deselect Filtered
                                    </button>
                                </div>

                                <div className="max-h-60 overflow-y-auto pr-2 custom-scrollbar space-y-2 border-t border-slate-50 pt-4">
                                    {filteredCenters.map(c => (
                                        <div 
                                            key={c.id} 
                                            onClick={() => toggleCenter(c.id)}
                                            className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all border-2 ${selectedCenters.includes(c.id) ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-transparent hover:bg-slate-100'}`}
                                        >
                                            <div>
                                                <p className="font-bold text-slate-700 text-sm">{c.name}</p>
                                                <div className="flex gap-2 mt-1">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase bg-slate-100 px-1.5 py-0.5 rounded">{c.type || 'N/A'}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase bg-slate-100 px-1.5 py-0.5 rounded">{c.bill_type || 'N/A'}</span>
                                                </div>
                                            </div>
                                            {selectedCenters.includes(c.id) && <FiCheckCircle className="text-indigo-600" />}
                                        </div>
                                    ))}
                                    {filteredCenters.length === 0 && (
                                        <div className="p-8 text-center text-slate-400 text-sm font-medium">
                                            No centers match these filters.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-slate-100">
                                {sourceMode === 'upload' ? (
                                    <>
                                        <div className="flex justify-between items-center">
                                            <label className="text-sm font-bold text-slate-500 ml-1">Upload Special List (Excel/CSV)</label>
                                            <button 
                                                onClick={downloadTemplate}
                                                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full transition-all"
                                            >
                                                Download Template
                                            </button>
                                        </div>
                                        <div className="relative group">
                                            <input 
                                                type="file" 
                                                onChange={(e) => setSpecialFile(e.target.files?.[0] || null)}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                accept=".xlsx,.xls,.csv"
                                            />
                                            <div className={`p-8 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center gap-3 transition-all ${specialFile ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200 group-hover:border-indigo-300 group-hover:bg-indigo-50/30'}`}>
                                                <FiUploadCloud className={`w-10 h-10 ${specialFile ? 'text-emerald-500' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                                                <div className="text-center">
                                                    <p className={`font-bold ${specialFile ? 'text-emerald-700' : 'text-slate-600'}`}>
                                                        {specialFile ? specialFile.name : 'Drop special list here'}
                                                    </p>
                                                    <p className="text-xs text-slate-400 font-medium mt-1">Requires: Test_Code, Test_Name, New_Rate</p>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {specialFile && (
                                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <input 
                                                        type="checkbox" 
                                                        id="save_list"
                                                        checked={shouldSaveList}
                                                        onChange={(e) => setShouldSaveList(e.target.checked)}
                                                        className="w-4 h-4 accent-[#00B4C1]"
                                                    />
                                                    <label htmlFor="save_list" className="text-xs font-bold text-slate-600 cursor-pointer">Save this list to Vault for future use</label>
                                                </div>
                                                {shouldSaveList && (
                                                    <input 
                                                        type="text"
                                                        placeholder="Name of this list (e.g. Summer Special 2024)"
                                                        value={newListName}
                                                        onChange={(e) => setNewListName(e.target.value)}
                                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none text-xs font-bold text-slate-600 focus:border-[#00B4C1]"
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center ml-1">
                                            <label className="text-sm font-bold text-slate-500">Select from Pricing Vault</label>
                                            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{savedLists.length} Lists Stored</span>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                            {savedLists.length === 0 && <p className="text-xs text-slate-400 font-medium text-center py-4 italic">No saved lists found.</p>}
                                            {savedLists.map(list => (
                                                <div 
                                                    key={list.id}
                                                    onClick={() => setSelectedListId(list.id.toString())}
                                                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex justify-between items-center ${selectedListId === list.id.toString() ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-transparent hover:bg-slate-100'}`}
                                                >
                                                    <div>
                                                        <span className="font-bold text-slate-700 text-sm">{list.name}</span>
                                                        <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-widest">Saved on: {new Date(list.created_at).toLocaleDateString()}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter">
                                                            {Object.keys(list.data_json).length} Tests
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={sourceMode === 'upload' ? handleBulkUpdate : handleApplySavedList}
                                disabled={bulkLoading || selectedCenters.length === 0 || (sourceMode === 'upload' ? !specialFile : !selectedListId)}
                                className="w-full py-5 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98] disabled:opacity-50 uppercase tracking-widest text-sm mt-4"
                            >
                                {bulkLoading ? 'Processing...' : sourceMode === 'upload' ? 'Upload & Apply List' : `Apply '${savedLists.find(l => l.id.toString() === selectedListId)?.name}' List`}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Information Alert */}
                <div className="bg-amber-50 border-2 border-amber-100 rounded-3xl p-6 flex gap-4 items-start shadow-sm">
                    <FiAlertCircle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-bold text-amber-800">Critical Note on Pricing</h4>
                        <p className="text-sm text-amber-700/80 font-medium leading-relaxed mt-1">
                            Adjusting rates here will update both the Center's internal DOS catalog and the Global Master Data visibility for those centers. 
                            If you've manually set a price override (MANUAL) in the Master Test Index, it will be prioritized unless you revert to benchmark.
                        </p>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
