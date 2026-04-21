'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '../store/auth';
import toast from 'react-hot-toast';
import { FiEye, FiEyeOff } from 'react-icons/fi';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated, hasHydratedAuth } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (hasHydratedAuth && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [hasHydratedAuth, isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { authApi } = await import('../api/auth');
      const { access_token } = await authApi.login({ username, password });
      localStorage.setItem('token', access_token);
      const userData = await authApi.getCurrentUser();
      login(userData, access_token);
      toast.success('Access Granted');
      router.push('/dashboard');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Authentication Failed');
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  if (hasHydratedAuth && isAuthenticated) return null;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row font-sans bg-white overflow-x-hidden">
      {/* Left Side - Promo */}
      <div className="w-full lg:w-1/2 bg-white flex flex-col items-center justify-center p-8 lg:p-20 order-2 lg:order-1">
        <div className="max-w-md text-center">
          <img
            src="/Mobile App poster 1.png"
            alt="Mobile App"
            className="w-48 lg:w-64 h-auto mx-auto mb-8 object-contain"
          />
          <h2 className="text-2xl lg:text-3xl font-bold text-[#00828A] tracking-tight mb-1 relative inline-block">
            Download KRPL App Now
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-[#E37222]" />
          </h2>
          <p className="text-slate-500 text-sm lg:text-base leading-relaxed mt-6 max-w-sm mx-auto">
            Tracking health status made easy with the app. Now available on both Google Play Store and App Store. Book health tests and access your smart reports and health trackers anytime anywhere.
          </p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 lg:p-20 order-1 lg:order-2 bg-white">
        <div className="max-w-md w-full">
          {/* Logo Section */}
          <div className="flex flex-col items-center mb-8">
            <img 
              src="/krsnaa_pngLogo.png" 
              alt="Krsnaa Diagnostics" 
              className="w-32 lg:w-40 h-auto object-contain mb-4" 
            />
            <h3 className="text-xl lg:text-2xl font-medium text-slate-600">Login to your Account</h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-500 ml-1">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-[#EBF2FF] border border-transparent focus:border-blue-300 rounded-lg outline-none font-medium text-slate-700"
                placeholder="Enter username"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-500 ml-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-[#EBF2FF] border border-transparent focus:border-blue-300 rounded-lg outline-none font-medium text-slate-700"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            <div className="text-right">
              <a href="#" className="text-xs font-semibold text-[#00B4C1] hover:underline">Forgot Password</a>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-8 py-3 bg-[#5CB85C] text-white font-bold rounded-lg hover:bg-[#4CAE4C] transition-all uppercase tracking-wider text-sm shadow-sm"
              >
                {loading ? 'Logging in...' : 'LOGIN'}
              </button>
              
              <button
                type="button"
                className="flex-1 px-8 py-3 bg-[#00B4C1] text-white font-bold rounded-lg hover:bg-[#009AA6] transition-all uppercase tracking-wider text-sm shadow-sm"
              >
                INDIVIDUAL LOGIN
              </button>
            </div>
          </form>
        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');
        
        body {
          font-family: 'Roboto', sans-serif !important;
          margin: 0;
          padding: 0;
        }
      `}</style>
    </div>
  );
}
