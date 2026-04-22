'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuthStore } from '../store/auth';
import {
  FiHome, FiGrid, FiUpload, FiBarChart, FiSettings,
  FiMessageSquare, FiFileText, FiUsers, FiLogOut, FiMenu, FiX, FiDatabase, FiShield, FiActivity, FiChevronRight
} from 'react-icons/fi';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { user, logout, hasHydratedAuth } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (!mounted) {
    return <div className="min-h-screen bg-white flex items-center justify-center font-sans"><div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-[#00B4C1]"></div></div>;
  }

  if (!hasHydratedAuth || !user) return null;

  const menuItems = [
    {
      section: 'DASHBOARD', items: [
        { name: 'Analytics Hub', href: '/dashboard', icon: FiActivity, roles: ['ADMIN', 'MANAGER', 'EDITOR', 'VIEWER'] },
      ]
    },
    {
      section: 'MASTER DATA', items: [
        { name: 'Center Network', href: '/centers', icon: FiGrid, roles: ['ADMIN', 'MANAGER', 'EDITOR', 'VIEWER'] },
        { name: 'Global Tests', href: '/master-data', icon: FiDatabase, roles: ['ADMIN', 'MANAGER', 'EDITOR', 'VIEWER'] },
        { name: 'Local Services', href: '/tests', icon: FiBarChart, roles: ['ADMIN', 'MANAGER', 'EDITOR', 'VIEWER'] },
      ]
    },
    {
      section: 'OPERATIONS', items: [
        { name: 'Upload DOS', href: '/dos/upload', icon: FiUpload, roles: ['ADMIN', 'MANAGER'] },
        { name: 'View DOS', href: '/dos/view', icon: FiGrid, roles: ['ADMIN', 'MANAGER', 'EDITOR', 'VIEWER'] },
        { name: 'Bulk Ops', href: '/bulk', icon: FiFileText, roles: ['ADMIN', 'MANAGER'] },
        { name: 'Copy Data', href: '/copy', icon: FiGrid, roles: ['ADMIN', 'MANAGER'] },
        { name: 'Rate Strategy', href: '/rate-management', icon: FiActivity, roles: ['ADMIN', 'MANAGER'] },
      ]
    },
    {
      section: 'ADMIN & QUALITY', items: [
        { name: 'Data Health', href: '/quality', icon: FiShield, roles: ['ADMIN', 'MANAGER'] },
        { name: 'System Logs', href: '/audit', icon: FiSettings, roles: ['ADMIN', 'MANAGER', 'EDITOR'] },
        { name: 'System Config', href: '/ai/settings', icon: FiSettings, roles: ['ADMIN'] },
        { name: 'AI Chat Console', href: '/ai/chat', icon: FiMessageSquare, roles: ['ADMIN', 'MANAGER'] },
        { name: 'User Access', href: '/users', icon: FiUsers, roles: ['ADMIN'] },
      ]
    },
  ];

  return (
    <div className="min-h-screen bg-[#F4F9F8] font-sans selection:bg-[#00B4C1]/20 selection:text-[#00B4C1]">
      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[45] transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-screen transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${sidebarOpen ? 'w-72' : isMobile ? '-translate-x-full w-72' : 'w-20'
          } bg-white shadow-xl border-r border-slate-100 overflow-hidden`}
      >
        <div className="h-full flex flex-col">
          {/* Logo Section */}
          <div className="p-8 flex items-center justify-between border-b border-slate-50">
            <div className={`flex items-center space-x-3 overflow-hidden transition-all duration-500 ${(sidebarOpen || isMobile) ? 'opacity-100' : 'opacity-0 w-0'}`}>
              <img src="/krsnaa_pngLogo.png" alt="KRSNAA Logo" className="h-10 w-auto object-contain" />
              <div className="border-l border-slate-200 pl-3">
                <h1 className="text-[#00828A] font-bold text-sm tracking-tight leading-none">MIS</h1>
                <p className="text-slate-400 text-[10px] font-bold tracking-widest uppercase mt-1">Enterprise</p>
              </div>
            </div>
            {isMobile && (
              <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-[#00B4C1]">
                <FiX className="w-6 h-6" />
              </button>
            )}
            {!sidebarOpen && !isMobile && (
              <div className="mx-auto">
                <img src="/krsnaa_pngLogo.png" alt="K" className="h-8 w-auto object-contain" />
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto custom-scrollbar">
            {menuItems.map((section) => {
              const visibleItems = section.items.filter(item => user && item.roles.includes(user.role));
              if (visibleItems.length === 0) return null;

              return (
                <div key={section.section} className="space-y-2">
                  {(sidebarOpen || isMobile) && (
                    <h3 className="px-4 text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase mb-3">
                      {section.section}
                    </h3>
                  )}
                  <div className="space-y-1">
                    {visibleItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = router.pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => isMobile && setSidebarOpen(false)}
                          className={`flex items-center group relative px-4 py-3 rounded-xl transition-all duration-300 ${isActive
                              ? 'bg-[#EBF7F7] text-[#00828A] shadow-sm'
                              : 'text-slate-500 hover:bg-slate-50 hover:text-[#00828A]'
                            }`}
                        >
                          <Icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110 ${(sidebarOpen || isMobile) ? 'mr-4' : 'mx-auto'}`} />
                          <span className={`font-semibold text-sm tracking-tight transition-all duration-500 ${(sidebarOpen || isMobile) ? 'opacity-100' : 'opacity-0 w-0'}`}>
                            {item.name}
                          </span>
                          {isActive && (sidebarOpen || isMobile) && (
                            <FiChevronRight className="ml-auto w-4 h-4 opacity-50" />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          {/* System Info Block */}
          {(sidebarOpen || isMobile) && (
            <div className="px-6 py-4 mx-4 mb-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold text-slate-400 tracking-widest uppercase">System Load</span>
                <span className="text-[9px] font-bold text-[#5CB85C]">Optimal</span>
              </div>
              <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#5CB85C] w-[24%]" />
              </div>
              <div className="mt-3 flex items-center text-[9px] font-bold text-slate-400">
                <FiDatabase className="mr-2" />
                DB Sync: 100%
              </div>
            </div>
          )}

          {/* User Profile */}
          <div className="p-4 bg-slate-50 border-t border-slate-100">
            <button
              onClick={handleLogout}
              className="flex items-center group w-full px-4 py-3 rounded-xl transition-all duration-300 text-slate-500 hover:bg-red-50 hover:text-red-600"
            >
              <FiLogOut className={`w-5 h-5 transition-transform group-hover:rotate-12 ${(sidebarOpen || isMobile) ? 'mr-4' : 'mx-auto'}`} />
              <span className={`font-bold text-sm transition-all duration-500 ${(sidebarOpen || isMobile) ? 'opacity-100' : 'opacity-0 w-0'}`}>
                Sign Out
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`transition-all duration-500 ${sidebarOpen && !isMobile ? 'ml-72' : isMobile ? 'ml-0' : 'ml-20'}`}>
        {/* Navigation Bar */}
        <header className="sticky top-0 z-40 bg-white shadow-sm px-4 sm:px-8 py-4">
          <div className="flex items-center justify-between max-w-[1600px] mx-auto">
            <div className="flex items-center space-x-6">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-[#00B4C1] transition-all"
              >
                {sidebarOpen ? <FiX className="w-6 h-6" /> : <FiMenu className="w-6 h-6" />}
              </button>
              <div className="hidden sm:block">
                <h2 className="text-slate-800 font-bold text-xl tracking-tight capitalize">
                  {router.pathname.split('/').pop()?.replace(/-/g, ' ') || 'Dashboard'}
                </h2>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="hidden xs:flex flex-col items-end text-right mr-2">
                <span className="text-slate-900 font-bold text-sm">{user.full_name}</span>
                <span className="text-[#00B4C1] text-[10px] font-bold uppercase tracking-wider">
                  {user.role}
                </span>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#EBF7F7] flex items-center justify-center text-[#00B4C1] font-bold text-lg border-2 border-white shadow-sm">
                {user.full_name.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Global Action Banner */}
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 mt-6">
          <div className="bg-white border border-slate-100 rounded-2xl p-4 sm:p-6 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#E37222]" />
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-[#F4F9F8] rounded-xl flex items-center justify-center border border-[#EBF7F7]">
                <FiShield className="w-6 h-6 text-[#00B4C1]" />
              </div>
              <div>
                <h4 className="text-slate-900 font-bold text-lg leading-tight">System Status</h4>
                <p className="text-slate-500 text-sm font-medium">All nodes are operational and synchronized.</p>
              </div>
            </div>
            <div className="flex items-center px-4 py-2 bg-[#EBF7F7] text-[#00828A] rounded-full text-[10px] font-bold tracking-widest uppercase border border-[#D5EFEF]">
              <div className="w-2 h-2 bg-[#5CB85C] rounded-full mr-2 animate-pulse" />
              Secure Link Active
            </div>
          </div>
        </div>

        {/* Dynamic Page Content */}
        <main className="px-4 sm:px-8 py-6 sm:py-10 max-w-[1600px] mx-auto flex-1 min-h-[calc(100vh-200px)]">
          {children}
        </main>

        {/* Global Footer */}
        <footer className="px-4 sm:px-8 py-6 border-t border-slate-200 bg-white flex flex-col md:flex-row justify-between items-center text-slate-400 text-[10px] font-bold uppercase tracking-widest max-w-[1600px] mx-auto w-full gap-4">
          <div className="text-center md:text-left">© 2026 KRSNAA Diagnostics. All Rights Reserved.</div>
          <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-[#5CB85C] rounded-full mr-2" />
              Live Status
            </div>
            <div className="border-l border-slate-200 pl-4">v2.4.0-Enterprise</div>
          </div>
        </footer>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');
        
        body {
          font-family: 'Roboto', sans-serif !important;
          background-color: #F4F9F8;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #CBD5E1;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
