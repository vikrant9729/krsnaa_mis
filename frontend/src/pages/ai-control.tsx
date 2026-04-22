'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useAuthStore } from '../store/auth';
import { useRouter } from 'next/router';
import api from '../api';
import toast from 'react-hot-toast';
import { FiSave, FiZap, FiEye, FiEyeOff, FiCheckCircle, FiRefreshCw } from 'react-icons/fi';
import { BsRobot } from 'react-icons/bs';

const Layout = dynamic(() => import('../components/Layout'), { ssr: false });

const PROVIDERS = [
  { value: 'openrouter', label: 'OpenRouter (GPT-4o, Mistral, etc.)', badge: 'Recommended' },
  { value: 'claude', label: 'Anthropic Claude', badge: 'Premium' },
  { value: 'ollama', label: 'Ollama (Local)', badge: 'Offline' },
];

const OPENROUTER_MODELS = [
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'anthropic/claude-3.5-sonnet',
  'meta-llama/llama-3.3-70b-instruct',
  'mistralai/mistral-7b-instruct',
  'google/gemini-flash-1.5',
];

export default function AIControl() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const [form, setForm] = useState({
    default_provider: 'openrouter',
    api_key: '',
    model: 'openai/gpt-4o',
    temperature: 0.7,
    max_tokens: 2000,
  });

  useEffect(() => {
    if (!isAuthenticated) { router.push('/login'); return; }
    api.get('/api/ai/config').then(r => setForm(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [isAuthenticated]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/api/ai/config', form);
      toast.success('AI configuration saved');
    } catch {
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post('/api/ai/agent', {
        messages: [{ role: 'user', content: 'Say "AI connected successfully" in one line.' }]
      });
      setTestResult(res.data?.text || 'Connected!');
      toast.success('AI connection successful');
    } catch (e: any) {
      setTestResult('Connection failed: ' + (e.response?.data?.detail || e.message));
      toast.error('AI test failed');
    } finally {
      setTesting(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <Layout>
      <div className="space-y-8 animate-in fade-in duration-700 max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-[#00B4C1] to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
            <BsRobot className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">AI Command Center</h1>
            <p className="text-slate-500 font-medium mt-1">Configure the AI assistant for your Krsnaa network</p>
          </div>
        </div>

        {/* Provider Card */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 space-y-6">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FiZap className="text-[#00B4C1]" /> AI Provider
          </h2>

          <div className="grid grid-cols-1 gap-3">
            {PROVIDERS.map(p => (
              <label
                key={p.value}
                className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  form.default_provider === p.value
                    ? 'border-[#00B4C1] bg-[#EBF7F7]'
                    : 'border-slate-100 hover:border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="provider"
                    value={p.value}
                    checked={form.default_provider === p.value}
                    onChange={e => setForm(f => ({ ...f, default_provider: e.target.value }))}
                    className="w-4 h-4 text-[#00B4C1]"
                  />
                  <span className="font-bold text-slate-700 text-sm">{p.label}</span>
                </div>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
                  p.badge === 'Recommended' ? 'bg-[#00B4C1]/10 text-[#00B4C1]'
                    : p.badge === 'Premium' ? 'bg-indigo-50 text-indigo-600'
                    : 'bg-slate-100 text-slate-500'
                }`}>{p.badge}</span>
              </label>
            ))}
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">API Key</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={form.api_key}
                onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
                placeholder="sk-or-v1-..."
                className="w-full px-4 py-3.5 pr-12 bg-slate-50 border border-transparent focus:border-[#00B4C1]/30 rounded-2xl outline-none font-mono text-sm text-slate-700 transition-all"
              />
              <button
                onClick={() => setShowKey(s => !s)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#00B4C1] transition-all"
              >
                {showKey ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>

          {/* Model */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Model</label>
            {form.default_provider === 'openrouter' ? (
              <select
                value={form.model}
                onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                className="w-full px-4 py-3.5 bg-slate-50 border border-transparent focus:border-[#00B4C1]/30 rounded-2xl outline-none font-bold text-slate-700 appearance-none cursor-pointer transition-all"
              >
                {OPENROUTER_MODELS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={form.model}
                onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                placeholder="model-name"
                className="w-full px-4 py-3.5 bg-slate-50 border border-transparent focus:border-[#00B4C1]/30 rounded-2xl outline-none font-mono text-sm text-slate-700 transition-all"
              />
            )}
          </div>

          {/* Sliders */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Temperature: <span className="text-slate-700">{form.temperature}</span>
              </label>
              <input
                type="range" min="0" max="1" step="0.1"
                value={form.temperature}
                onChange={e => setForm(f => ({ ...f, temperature: parseFloat(e.target.value) }))}
                className="w-full accent-[#00B4C1]"
              />
              <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                <span>Precise</span><span>Creative</span>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Max Tokens: <span className="text-slate-700">{form.max_tokens}</span>
              </label>
              <input
                type="range" min="500" max="8000" step="500"
                value={form.max_tokens}
                onChange={e => setForm(f => ({ ...f, max_tokens: parseInt(e.target.value) }))}
                className="w-full accent-[#00B4C1]"
              />
              <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                <span>500</span><span>8000</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleTest}
              disabled={testing || !form.api_key}
              className="flex items-center gap-2 px-6 py-3 bg-slate-50 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-all border border-slate-200 disabled:opacity-50 text-sm"
            >
              <FiRefreshCw className={testing ? 'animate-spin' : ''} />
              Test Connection
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[#00B4C1] text-white font-bold rounded-xl hover:bg-[#009AA6] transition-all shadow-sm text-sm"
            >
              <FiSave />
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>

          {/* Test result */}
          {testResult && (
            <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium ${
              testResult.includes('failed') ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
            }`}>
              <FiCheckCircle className="w-4 h-4 flex-shrink-0" />
              {testResult}
            </div>
          )}
        </div>

        {/* Capabilities card */}
        <div className="bg-gradient-to-br from-[#00B4C1]/5 to-indigo-500/5 rounded-3xl border border-[#00B4C1]/10 p-8">
          <h2 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-4">AI Capabilities</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              'Search centers & tests',
              'Query rates & DOS data',
              'Network-wide statistics',
              'Update single test rate ⚠️',
              'Bulk rate updates by % ⚠️',
              'Fix duplicate entries ⚠️',
            ].map(c => (
              <div key={c} className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <FiCheckCircle className="text-[#00B4C1] w-4 h-4 flex-shrink-0" />
                {c}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 font-bold mt-4 uppercase tracking-widest">
            ⚠️ = Requires confirmation before execution
          </p>
        </div>
      </div>
    </Layout>
  );
}
