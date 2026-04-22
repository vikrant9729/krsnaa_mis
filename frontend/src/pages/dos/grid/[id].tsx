import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useAuthStore } from '../../../store/auth';
import { centersApi, Center } from '../../../api/centers';
import toast from 'react-hot-toast';
import api from '../../../api';
import { 
    FiSave, FiArrowLeft, FiRefreshCw, FiSearch, FiCheck, FiX, FiAlertCircle 
} from 'react-icons/fi';

const Layout = dynamic(() => import('../../../components/Layout'), { ssr: false });

export default function DOSGrid() {
    const router = useRouter();
    const { id } = router.query;
    const { isAuthenticated } = useAuthStore();
    
    const [center, setCenter] = useState<Center | null>(null);
    const [rows, setRows] = useState<any[]>([]);
    const [originalRows, setOriginalRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [hasChanges, setHasChanges] = useState(false);

    const [changedCells, setChangedCells] = useState<Record<string, boolean>>({});
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 50;

    const loadData = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            const centerData = await centersApi.getById(Number(id));
            setCenter(centerData);
            
            const response = await api.get(`/api/dos/list?center_id=${id}&page_size=1000`);
            const items = response.data.items || [];
            setRows(items);
            setOriginalRows(JSON.parse(JSON.stringify(items)));
            setChangedCells({});
        } catch (error) {
            toast.error('Failed to load center data');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }
        loadData();
    }, [isAuthenticated, id, loadData, router]);

    const handleCellChange = (rowIndex: number, key: string, value: any) => {
        const newRows = [...rows];
        
        // Basic Numeric Validation for Rate columns
        if (key.toLowerCase().includes('rate') || key.toLowerCase().includes('mrp')) {
            if (value !== '' && isNaN(Number(value))) {
                return; // Ignore invalid numeric input
            }
        }

        newRows[rowIndex].data_json[key] = value;
        setRows(newRows);
        setHasChanges(true);
        
        // Track specifically which cell changed
        setChangedCells(prev => ({
            ...prev,
            [`${rowIndex}-${key}`]: JSON.stringify(value) !== JSON.stringify(originalRows[rowIndex].data_json[key])
        }));
    };

    const saveChanges = async () => {
        setSaving(true);
        try {
            // Find changed rows
            const changedRows = rows.filter((row, idx) => {
                return JSON.stringify(row.data_json) !== JSON.stringify(originalRows[idx].data_json);
            });

            if (changedRows.length === 0) {
                toast.success('No changes to save');
                setHasChanges(false);
                return;
            }

            // Save each changed row
            // In a real app, we'd have a bulk update endpoint, but let's use the individual one for now
            // or create a bulk one. Let's use individual for simplicity of logic.
            const promises = changedRows.map(row => 
                api.patch(`/api/dos/rows/${row.id}`, row.data_json)
            );
            
            await Promise.all(promises);
            toast.success(`Successfully saved ${changedRows.length} changes`);
            setOriginalRows(JSON.parse(JSON.stringify(rows)));
            setHasChanges(false);
            setChangedCells({});
        } catch (error) {
            toast.error('Failed to save some changes');
        } finally {
            setSaving(false);
        }
    };

    if (!isAuthenticated) return null;

    const allKeys = rows.length > 0 ? Object.keys(rows[0].data_json) : [];
    const filteredRows = rows.filter(row => 
        JSON.stringify(row.data_json).toLowerCase().includes(search.toLowerCase())
    );

    const totalPages = Math.ceil(filteredRows.length / pageSize);
    const paginatedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    return (
        <Layout>
            <div className="h-[calc(100vh-120px)] flex flex-col space-y-4 animate-in fade-in duration-500">
                {/* Header */}
                <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => router.back()}
                            className="p-3 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-2xl transition-all"
                        >
                            <FiArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">{center?.name}</h1>
                            <p className="text-sm font-bold text-[#00B4C1] uppercase tracking-widest flex items-center">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2 animate-pulse" />
                                Interactive Grid Mode
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative w-64">
                            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text"
                                placeholder="Quick search..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-transparent focus:border-[#00B4C1]/20 rounded-2xl outline-none text-sm font-bold text-slate-600 transition-all"
                            />
                        </div>
                        <button 
                            onClick={saveChanges}
                            disabled={saving || !hasChanges}
                            className={`flex items-center px-8 py-3 rounded-2xl font-bold transition-all shadow-lg active:scale-95 ${hasChanges ? 'bg-[#00B4C1] text-white shadow-[#00B4C1]/20 hover:bg-[#009AA6]' : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'}`}
                        >
                            {saving ? <FiRefreshCw className="mr-2 animate-spin" /> : <FiSave className="mr-2" />}
                            {saving ? 'Saving...' : 'Commit Changes'}
                        </button>
                    </div>
                </div>

                {/* Grid */}
                <div className="flex-1 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col relative">
                    {loading && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] z-30 flex flex-col items-center justify-center gap-4">
                            <div className="w-12 h-12 border-4 border-[#00B4C1] border-t-transparent rounded-full animate-spin" />
                            <span className="font-bold text-slate-400 uppercase tracking-widest text-xs">Loading Large Dataset...</span>
                        </div>
                    )}

                    <div className="flex-1 overflow-auto custom-scrollbar">
                        <table className="w-full border-collapse">
                            <thead className="sticky top-0 z-20 bg-white shadow-sm">
                                <tr>
                                    <th className="px-4 py-5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-white w-12 text-center">#</th>
                                    {allKeys.map(key => (
                                        <th key={key} className="px-6 py-5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-white whitespace-nowrap min-w-[150px]">
                                            {key.replace(/_/g, ' ')}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {paginatedRows.map((row, idx) => {
                                    const rowIndex = rows.findIndex(r => r.id === row.id);
                                    return (
                                        <tr key={row.id} className="hover:bg-slate-50/50 group transition-colors">
                                            <td className="px-4 py-3 text-[10px] font-black text-slate-300 border-r border-slate-50 text-center">
                                                {rowIndex + 1}
                                            </td>
                                            {allKeys.map(key => (
                                                <td 
                                                    key={key} 
                                                    className={`px-4 py-2 border-r border-slate-50 transition-all ${changedCells[`${rowIndex}-${key}`] ? 'bg-amber-50/50' : 'focus-within:bg-white'}`}
                                                >
                                                    <input 
                                                        type="text"
                                                        value={row.data_json[key] || ''}
                                                        onChange={(e) => handleCellChange(rowIndex, key, e.target.value)}
                                                        className={`w-full bg-transparent border-none outline-none text-sm font-medium transition-colors ${changedCells[`${rowIndex}-${key}`] ? 'text-amber-600 font-bold' : 'text-slate-600 focus:text-[#00B4C1]'}`}
                                                    />
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer Info */}
                <div className="flex justify-between items-center px-6 py-4 bg-slate-900 rounded-3xl text-white">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-2">Total Records:</span>
                            <span className="text-sm font-bold text-[#00B4C1]">{filteredRows.length}</span>
                        </div>
                        <div className="flex items-center border-l border-slate-700 pl-6 gap-4">
                            <button 
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="p-1.5 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-30"
                            >
                                <FiArrowLeft className="w-4 h-4" />
                            </button>
                            <span className="text-xs font-bold text-slate-300">Page {currentPage} of {totalPages || 1}</span>
                            <button 
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages || totalPages === 0}
                                className="p-1.5 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-30"
                            >
                                <FiX className="w-4 h-4 rotate-180" /> {/* Using FiX as a placeholder or arrow if available */}
                            </button>
                        </div>
                        <div className="flex items-center border-l border-slate-700 pl-6">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-2">Pending Sync:</span>
                            <span className={`text-sm font-bold ${hasChanges ? 'text-amber-400' : 'text-slate-500'}`}>{hasChanges ? 'Unsaved Changes' : 'All Synced'}</span>
                        </div>
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center">
                        <FiAlertCircle className="mr-2 text-amber-500" /> Changes here will immediately reflect in center reports.
                    </div>
                </div>
            </div>
        </Layout>
    );
}
