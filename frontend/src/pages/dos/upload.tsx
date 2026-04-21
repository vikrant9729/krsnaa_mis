'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '../../store/auth';
import dynamic from 'next/dynamic';
import { centersApi, Center } from '../../api/centers';
import toast from 'react-hot-toast';
import { FiUpload, FiDownload, FiFile } from 'react-icons/fi';
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
    const formData = new FormData();
    formData.append('center_id', selectedCenter.toString());
    formData.append('mode', uploadMode);
    formData.append('file', file);

    try {
      const response = await api.post('/api/dos/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      toast.success(`DOS uploaded successfully! ${response.data.rows} rows processed.`);
      setFile(null);
      setSelectedCenter(null);
    } catch (error: any) {
      toast.error(formatApiError(error.response?.data?.detail, 'Upload failed'));
    } finally {
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

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Layout>
      <div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Upload DOS</h1>
          <p className="text-gray-600 mt-1">Upload Excel or CSV file for a center</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upload Form */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Upload File</h2>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Center *
                </label>
                <select
                  value={selectedCenter || ''}
                  onChange={(e) => setSelectedCenter(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Choose a center...</option>
                  {centers.map(center => (
                    <option key={center.id} value={center.id}>
                      {center.name} ({center.center_type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Upload Mode
                </label>
                <select
                  value={uploadMode}
                  onChange={(e) => setUploadMode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="replace">Replace (New Version)</option>
                  <option value="merge">Merge (Append Data)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  File *
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                    required
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <FiFile className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">
                      {file ? file.name : 'Click to select file'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Excel (.xlsx, .xls) or CSV
                    </p>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={uploading || !selectedCenter || !file}
                className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiUpload className="mr-2" />
                {uploading ? 'Uploading...' : 'Upload DOS'}
              </button>
            </form>
          </div>

          {/* Help Section */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Download Template</h2>
              <p className="text-sm text-gray-600 mb-4">
                Use our template to ensure your data is in the correct format.
              </p>
              <button
                onClick={downloadTemplate}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <FiDownload className="mr-2" />
                Download Template
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 mb-2">Required Columns</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• OwnerID, LAB_Name, CC_Code, CC_Name</li>
                <li>• Partner_Status, type, bill type</li>
                <li>• Test_Code, test_name, Specimen_Type</li>
                <li>• Bill_Rate, TestCategory_Mapped</li>
                <li>• LAB_TestId_MIS, LAB_TestID, center type</li>
              </ul>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="font-semibold text-yellow-900 mb-2">Upload Modes</h3>
              <div className="text-sm text-yellow-800 space-y-2">
                <p><strong>Replace:</strong> Creates new version, deactivates old data</p>
                <p><strong>Merge:</strong> Appends data to existing dataset</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
