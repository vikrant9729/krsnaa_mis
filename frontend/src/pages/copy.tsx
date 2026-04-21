'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '../store/auth';
import dynamic from 'next/dynamic';
import { centersApi, Center } from '../api/centers';
import toast from 'react-hot-toast';
import api from '../api';
import { formatApiError } from '../utils/apiError';
import { FiCopy, FiCheck } from 'react-icons/fi';

const Layout = dynamic(() => import('../components/Layout'), { ssr: false });

export default function CenterCopy() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [centers, setCenters] = useState<Center[]>([]);
  const [sourceCenter, setSourceCenter] = useState<number | null>(null);
  const [targetCenter, setTargetCenter] = useState<number | null>(null);
  const [copying, setCopying] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

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

  const loadCategories = async (centerId: number) => {
    try {
      const response = await api.get(`/api/dos/categories/${centerId}`);
      setCategories(response.data);
      setSelectedCategories([]);
    } catch (error) {
      // No categories available
    }
  };

  const handleSourceChange = (centerId: number) => {
    setSourceCenter(centerId);
    loadCategories(centerId);
  };

  const toggleCategory = (category: string) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories(selectedCategories.filter(c => c !== category));
    } else {
      setSelectedCategories([...selectedCategories, category]);
    }
  };

  const handleCopy = async () => {
    if (!sourceCenter || !targetCenter) {
      toast.error('Please select source and target centers');
      return;
    }

    setCopying(true);
    try {
      await api.post('/api/dos/copy', {
        source_center_id: sourceCenter,
        target_center_id: targetCenter,
        categories: selectedCategories.length > 0 ? selectedCategories : null,
      });
      
      toast.success('DOS copied successfully!');
      setSourceCenter(null);
      setTargetCenter(null);
      setSelectedCategories([]);
    } catch (error: any) {
      toast.error(formatApiError(error.response?.data?.detail, 'Copy failed'));
    } finally {
      setCopying(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Layout>
      <div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Copy DOS from Base Center</h1>
          <p className="text-gray-600 mt-1">Copy DOS data while maintaining base MRP rates</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Source Center */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source Center (Base) *
              </label>
              <select
                value={sourceCenter || ''}
                onChange={(e) => handleSourceChange(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select source center...</option>
                {centers.filter(c => c.is_base_center || c.center_type === 'HLM').map(center => (
                  <option key={center.id} value={center.id}>
                    {center.name} ({center.center_type})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Center with DOS data to copy from
              </p>
            </div>

            {/* Target Center */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Center (New) *
              </label>
              <select
                value={targetCenter || ''}
                onChange={(e) => setTargetCenter(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select target center...</option>
                {centers.filter(c => c.id !== sourceCenter).map(center => (
                  <option key={center.id} value={center.id}>
                    {center.name} ({center.center_type})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Center to copy DOS data to
              </p>
            </div>
          </div>

          {/* Category Selection */}
          {categories.length > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Categories to Copy (Optional - leave empty to copy all)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {categories.map(category => (
                  <button
                    key={category}
                    onClick={() => toggleCategory(category)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedCategories.includes(category)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {selectedCategories.includes(category) && <FiCheck className="inline mr-1" />}
                    {category}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">What will be copied?</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>✅ All test codes and names</li>
              <li>✅ Bill rates (maintained as-is - base MRP)</li>
              <li>✅ Test categories and mappings</li>
              <li>✅ Specimen types</li>
              <li>✅ All DOS metadata</li>
              <li>❌ Center-specific identifiers (will be updated)</li>
            </ul>
          </div>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            disabled={copying || !sourceCenter || !targetCenter}
            className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiCopy className="mr-2" />
            {copying ? 'Copying...' : 'Copy DOS to Target Center'}
          </button>
        </div>
      </div>
    </Layout>
  );
}
