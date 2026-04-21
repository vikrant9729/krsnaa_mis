'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '../../store/auth';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import api from '../../api';
import { formatApiError } from '../../utils/apiError';
import { FiSave } from 'react-icons/fi';

const Layout = dynamic(() => import('../../components/Layout'), { ssr: false });

export default function AISettings() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({
    default_provider: 'openrouter',
    api_key: '',
    model: 'openai/gpt-4o',
    temperature: 0.7,
    max_tokens: 2000,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    loadConfig();
  }, [isAuthenticated, router]);

  const loadConfig = async () => {
    try {
      const response = await api.get('/api/ai/config');
      setConfig(response.data);
    } catch (error) {
      // Config might not exist yet, use defaults
    }
  };

  const saveConfig = async () => {
    setLoading(true);
    try {
      await api.post('/api/ai/config', config);
      toast.success('AI configuration saved!');
    } catch (error: any) {
      toast.error(formatApiError(error.response?.data?.detail, 'Failed to save config'));
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Layout>
      <div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">AI Settings</h1>
          <p className="text-gray-600 mt-1">Configure AI providers and models</p>
        </div>

        <div className="max-w-2xl bg-white rounded-lg shadow p-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Provider
              </label>
              <select
                value={config.default_provider}
                onChange={(e) => setConfig({ ...config, default_provider: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="openrouter">OpenRouter (Recommended)</option>
                <option value="claude">Anthropic Claude</option>
                <option value="ollama">Ollama (Local)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key
              </label>
              <input
                type="password"
                value={config.api_key}
                onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="sk-..."
              />
              <p className="text-xs text-gray-500 mt-1">
                {config.default_provider === 'ollama' 
                  ? 'Not required for Ollama' 
                  : 'Required for cloud providers'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model
              </label>
              <input
                type="text"
                value={config.model}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., openai/gpt-4o"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Temperature: {config.temperature}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={config.temperature}
                onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">
                Lower = more focused, Higher = more creative
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Tokens
              </label>
              <input
                type="number"
                value={config.max_tokens}
                onChange={(e) => setConfig({ ...config, max_tokens: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="100"
                max="8000"
              />
            </div>

            <button
              onClick={saveConfig}
              disabled={loading}
              className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <FiSave className="mr-2" />
              {loading ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>

        {/* Provider Info */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">OpenRouter</h3>
            <p className="text-sm text-blue-800">Multi-model gateway with access to GPT-4, Claude, and more</p>
            <p className="text-xs text-blue-700 mt-2">✅ Best for most use cases</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h3 className="font-semibold text-purple-900 mb-2">Claude (Anthropic)</h3>
            <p className="text-sm text-purple-800">Advanced reasoning and analysis capabilities</p>
            <p className="text-xs text-purple-700 mt-2">✅ Excellent for complex queries</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-2">Ollama (Local)</h3>
            <p className="text-sm text-green-800">Run AI locally with complete privacy</p>
            <p className="text-xs text-green-700 mt-2">✅ No API costs, fully private</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
