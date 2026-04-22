import '../styles/globals.css';
import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { AppProps } from 'next/app';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/auth';

// Dynamically import Toaster to avoid hydration issues
const Toaster = dynamic(() => import('react-hot-toast').then((mod) => mod.Toaster), {
  ssr: false,
});

const AIChatPanel = dynamic(() => import('../components/AIChatPanel'), { ssr: false });

function AuthBootstrap() {
  const { token, user, isAuthenticated, setUser, logout, setAuthHydrated } = useAuthStore();

  useEffect(() => {
    let active = true;

    const hydrateAuth = async () => {
      if (!token || !isAuthenticated) {
        if (active) {
          setAuthHydrated(true);
        }
        return;
      }

      if (user) {
        if (active) {
          setAuthHydrated(true);
        }
        return;
      }

      try {
        const currentUser = await authApi.getCurrentUser();
        if (active) {
          setUser(currentUser);
          setAuthHydrated(true);
        }
      } catch {
        if (active) {
          logout();
        }
      }
    };

    hydrateAuth();

    return () => {
      active = false;
    };
  }, [token, user, isAuthenticated, setUser, logout, setAuthHydrated]);

  return null;
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <AuthBootstrap />
      <Component {...pageProps} />
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <AIChatPanel />
    </>
  );
}
