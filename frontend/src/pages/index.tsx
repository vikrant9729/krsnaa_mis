import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '../store/auth';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, hasHydratedAuth } = useAuthStore();

  useEffect(() => {
    if (!hasHydratedAuth) {
      return;
    }

    if (isAuthenticated) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }, [hasHydratedAuth, isAuthenticated, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-600">Loading...</p>
    </div>
  );
}
