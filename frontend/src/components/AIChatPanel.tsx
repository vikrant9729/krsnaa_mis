'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import {
  FiMessageSquare, FiX, FiSend, FiChevronDown, FiZap,
  FiCheckCircle, FiAlertTriangle, FiLoader, FiMinus,
  FiDatabase, FiTrendingUp, FiSearch, FiTrash2
} from 'react-icons/fi';
import { BsRobot } from 'react-icons/bs';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  payload?: AgentResponse;
  timestamp: Date;
}

interface AgentResponse {
  type: 'answer' | 'table' | 'stats' | 'confirm_required' | 'action_done' | 'error';
  text: string;
  columns?: string[];
  data?: any[] | Record<string, any>;
  confirm_id?: string;
  action_summary?: string;
  tool?: string;
  params?: any;
}

interface AIContext {
  centers: { id: number; name: string }[];
  categories: string[];
}

// ─── Quick prompts ────────────────────────────────────────────────────────────
const QUICK_PROMPTS = [
  { icon: FiTrendingUp, label: 'Network Stats', prompt: 'Show me network-wide statistics' },
  { icon: FiDatabase, label: 'Zero Rates', prompt: 'How many tests have ₹0 rate?' },
  { icon: FiSearch, label: 'Search Centers', prompt: 'List all HR type centers' },
  { icon: FiZap, label: 'Category Rates', prompt: 'Update Routine tests by 5% at center' },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3 bg-white rounded-2xl rounded-tl-sm border border-slate-100 w-fit shadow-sm">
      <div className="w-2 h-2 bg-[#00B4C1] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <div className="w-2 h-2 bg-[#00B4C1] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <div className="w-2 h-2 bg-[#00B4C1] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
}

function TableCard({ columns, data }: { columns: string[]; data: any[] }) {
  return (
    <div className="mt-3 rounded-2xl border border-slate-100 overflow-hidden bg-white shadow-sm">
      <div className="overflow-x-auto max-h-64">
        <table className="w-full text-xs border-collapse">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              {columns.map(col => (
                <th key={col} className="px-3 py-2.5 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {data.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50/50">
                {columns.map(col => (
                  <td key={col} className="px-3 py-2 text-slate-700 font-medium whitespace-nowrap">
                    {String(row[col] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-3 py-1.5 bg-slate-50/50 border-t border-slate-100">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{data.length} records</span>
      </div>
    </div>
  );
}

function StatsCard({ data }: { data: Record<string, any> }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="bg-white rounded-2xl border border-slate-100 p-3 shadow-sm">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{k}</div>
          <div className="text-lg font-black text-[#00B4C1]">{String(v)}</div>
        </div>
      ))}
    </div>
  );
}

function ConfirmCard({ payload, onConfirm, onCancel }: {
  payload: AgentResponse;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-3 bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
      <div className="flex items-start gap-3 mb-4">
        <FiAlertTriangle className="text-amber-500 w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <div className="text-xs font-black text-amber-700 uppercase tracking-widest mb-1">Confirmation Required</div>
          <div className="text-sm text-amber-800 font-medium">{payload.action_summary}</div>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className="flex-1 py-2.5 bg-[#00B4C1] text-white text-xs font-black rounded-xl hover:bg-[#009AA6] transition-all uppercase tracking-widest"
        >
          ✓ Confirm Action
        </button>
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 bg-white text-slate-500 text-xs font-black rounded-xl hover:bg-slate-100 transition-all border border-slate-200 uppercase tracking-widest"
        >
          ✕ Cancel
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ msg, onConfirm, onCancel }: {
  msg: Message;
  onConfirm?: (id: string) => void;
  onCancel?: () => void;
}) {
  const isUser = msg.role === 'user';
  const payload = msg.payload;

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-4 py-3 bg-gradient-to-br from-[#00B4C1] to-[#009AA6] text-white rounded-2xl rounded-tr-sm text-sm font-medium shadow-sm">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <div className="w-7 h-7 bg-gradient-to-br from-[#00B4C1] to-indigo-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
        <BsRobot className="w-4 h-4 text-white" />
      </div>
      <div className="max-w-[90%] flex-1">
        {payload?.type === 'action_done' ? (
          <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-2xl rounded-tl-sm">
            <div className="flex items-center gap-2">
              <FiCheckCircle className="text-emerald-500 w-4 h-4" />
              <span className="text-sm font-bold text-emerald-700">{payload.text}</span>
            </div>
          </div>
        ) : payload?.type === 'error' ? (
          <div className="px-4 py-3 bg-rose-50 border border-rose-200 rounded-2xl rounded-tl-sm">
            <span className="text-sm font-bold text-rose-600">{payload.text}</span>
          </div>
        ) : (
          <div className="px-4 py-3 bg-white rounded-2xl rounded-tl-sm border border-slate-100 shadow-sm">
            <p className="text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
              {payload?.text || msg.content}
            </p>
            {payload?.type === 'table' && payload.columns && Array.isArray(payload.data) && (
              <TableCard columns={payload.columns} data={payload.data} />
            )}
            {payload?.type === 'stats' && payload.data && !Array.isArray(payload.data) && (
              <StatsCard data={payload.data as Record<string, any>} />
            )}
            {payload?.type === 'confirm_required' && payload.confirm_id && (
              <ConfirmCard
                payload={payload}
                onConfirm={() => onConfirm?.(payload.confirm_id!)}
                onCancel={() => onCancel?.()}
              />
            )}
          </div>
        )}
        <div className="text-[9px] text-slate-300 font-bold mt-1 ml-1">
          {msg.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Chat Panel ──────────────────────────────────────────────────────────

export default function AIChatPanel() {
  const [open, setOpen] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '',
      payload: {
        type: 'answer',
        text: 'Namaste! 🙏 Main Krsnaa MIS AI Assistant hoon.\n\nMain aapke liye data query kar sakta hoon, rates update kar sakta hoon, aur network-wide operations perform kar sakta hoon — sab kuch confirm karke!\n\nAap kya jaanna chahte hain?',
      },
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<AIContext>({ centers: [], categories: [] });
  const [selectedCenter, setSelectedCenter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      api.get('/api/ai/context').then(r => setContext(r.data)).catch(() => {});
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const addMessage = (msg: Omit<Message, 'id' | 'timestamp'>) => {
    setMessages(prev => [...prev, { ...msg, id: crypto.randomUUID(), timestamp: new Date() }]);
  };

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');

    addMessage({ role: 'user', content: msg });
    setLoading(true);

    // Build context-aware message
    let enriched = msg;
    if (selectedCenter) enriched += ` (center: ${selectedCenter})`;
    if (selectedCategory) enriched += ` (category: ${selectedCategory})`;

    const history = messages.map(m => ({
      role: m.role,
      content: m.payload?.text || m.content,
    }));
    history.push({ role: 'user', content: enriched });

    try {
      const res = await api.post('/api/ai/agent', { messages: history });
      const payload: AgentResponse = res.data;
      addMessage({ role: 'assistant', content: payload.text || '', payload });
    } catch (err: any) {
      addMessage({
        role: 'assistant',
        content: '',
        payload: { type: 'error', text: 'AI service unavailable. Please check API key in settings.' }
      });
    } finally {
      setLoading(false);
    }
  }, [input, messages, loading, selectedCenter, selectedCategory]);

  const handleConfirm = async (confirmId: string) => {
    setLoading(true);
    try {
      const res = await api.post(`/api/ai/confirm/${confirmId}`);
      const payload: AgentResponse = res.data;
      addMessage({ role: 'assistant', content: payload.text || '', payload });
      toast.success('Action completed successfully');
    } catch {
      addMessage({
        role: 'assistant',
        content: '',
        payload: { type: 'error', text: 'Action failed. Please try again.' }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    addMessage({
      role: 'assistant',
      content: '',
      payload: { type: 'answer', text: 'Action cancelled. Koi baat nahi, kuch aur poochhein?' }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-br from-[#00B4C1] to-indigo-500 rounded-2xl shadow-2xl flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all duration-200 group"
          title="Open AI Assistant"
        >
          <BsRobot className="w-7 h-7" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full animate-pulse border-2 border-white" />
        </button>
      )}

      {/* Chat Panel */}
      {open && (
        <div
          className={`fixed right-6 z-50 bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col transition-all duration-300 ${
            minimised ? 'bottom-6 w-80 h-14' : 'bottom-6 w-[420px] h-[680px]'
          }`}
          style={{ boxShadow: '0 32px 80px -12px rgba(0,0,0,0.2)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-[#00B4C1] to-indigo-500 rounded-t-3xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
                <BsRobot className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-sm font-black text-white">Krsnaa AI Assistant</div>
                <div className="text-[9px] text-white/70 font-bold uppercase tracking-widest flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block animate-pulse" />
                  Online
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMinimised(m => !m)}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all"
              >
                <FiMinus className="w-4 h-4" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!minimised && (
            <>
              {/* Context Selectors */}
              <div className="px-4 py-3 border-b border-slate-50 bg-slate-50/50 flex gap-2">
                <select
                  value={selectedCenter}
                  onChange={e => setSelectedCenter(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white border border-slate-100 rounded-xl text-xs font-bold text-slate-600 outline-none focus:border-[#00B4C1]/50 transition-all"
                >
                  <option value="">All Centers</option>
                  {context.centers.map(c => (
                    <option key={c.id} value={String(c.id)}>{c.name}</option>
                  ))}
                </select>
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white border border-slate-100 rounded-xl text-xs font-bold text-slate-600 outline-none focus:border-[#00B4C1]/50 transition-all"
                >
                  <option value="">All Categories</option>
                  {context.categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Quick Prompts */}
              {messages.length <= 1 && (
                <div className="px-4 pt-3 pb-1 flex flex-wrap gap-2">
                  {QUICK_PROMPTS.map(q => (
                    <button
                      key={q.label}
                      onClick={() => sendMessage(q.prompt)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#EBF7F7] text-[#00828A] text-[10px] font-black rounded-xl hover:bg-[#D5EFEF] transition-all border border-[#D5EFEF] uppercase tracking-widest"
                    >
                      <q.icon className="w-3 h-3" />
                      {q.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 custom-scrollbar">
                {messages.map(msg => (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    onConfirm={handleConfirm}
                    onCancel={handleCancel}
                  />
                ))}
                {loading && (
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 bg-gradient-to-br from-[#00B4C1] to-indigo-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                      <BsRobot className="w-4 h-4 text-white" />
                    </div>
                    <TypingIndicator />
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="px-4 pb-4 pt-2 border-t border-slate-50">
                <div className="flex items-center gap-2 bg-slate-50 border-2 border-transparent focus-within:border-[#00B4C1]/30 rounded-2xl px-4 py-3 transition-all">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Kuch bhi poochhein ya action batayein..."
                    className="flex-1 bg-transparent outline-none text-sm font-medium text-slate-700 placeholder-slate-400"
                    disabled={loading}
                  />
                  <button
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || loading}
                    className="w-9 h-9 bg-[#00B4C1] disabled:bg-slate-200 text-white rounded-xl flex items-center justify-center transition-all hover:bg-[#009AA6] active:scale-90 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <FiLoader className="w-4 h-4 animate-spin" />
                    ) : (
                      <FiSend className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-[9px] text-slate-300 font-bold text-center mt-2 uppercase tracking-widest">
                  AI · Confirmation required before any changes
                </p>
              </div>
            </>
          )}
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
      `}</style>
    </>
  );
}
