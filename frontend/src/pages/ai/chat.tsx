'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '../../store/auth';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import api from '../../api';
import { formatApiError } from '../../utils/apiError';
import { FiSend, FiSettings } from 'react-icons/fi';

const Layout = dynamic(() => import('../../components/Layout'), { ssr: false });

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export default function AIChat() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [centerFilter, setCenterFilter] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
  }, [isAuthenticated, router]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await api.post('/api/ai/chat', {
        message: input,
        center_id: centerFilter,
      });

      const aiMessage: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error: any) {
      toast.error(formatApiError(error.response?.data?.detail, 'AI request failed'));
      
      const errorMessage: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Layout>
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">AI Assistant</h1>
            <p className="text-gray-600 mt-1">Ask questions about your DOS data</p>
          </div>
          <button
            onClick={() => router.push('/ai/settings')}
            className="flex items-center px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
          >
            <FiSettings className="mr-2" />
            AI Settings
          </button>
        </div>

        {/* Chat Container */}
        <div className="flex-1 bg-white rounded-lg shadow overflow-hidden flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🤖</div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">AI Assistant Ready</h2>
                <p className="text-gray-600 mb-4">Ask me anything about your DOS data!</p>
                <div className="text-sm text-gray-500 space-y-2">
                  <p>💡 Try asking:</p>
                  <p>"Show me all tests with rate above 500"</p>
                  <p>"Find duplicate test codes"</p>
                  <p>"What's the average rate for Routine category?"</p>
                  <p>"Analyze data quality"</p>
                </div>
              </div>
            ) : (
              messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-2xl px-4 py-3 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-500'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 px-4 py-3 rounded-lg">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex space-x-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your question..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiSend />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
