'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AnalyticsPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Analytics</h1>
        <p className="text-gray-600">Detailed attack analysis and reports</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4">Attack Timeline</h2>
          <div className="h-64 bg-gray-100 rounded flex items-center justify-center text-gray-600">
            Time-series chart coming soon
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4">Protocol Distribution</h2>
          <div className="h-64 bg-gray-100 rounded flex items-center justify-center text-gray-600">
            Pie chart coming soon
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4">Geographic Distribution</h2>
          <div className="h-64 bg-gray-100 rounded flex items-center justify-center text-gray-600">
            Heatmap coming soon
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4">Top Countries</h2>
          <div className="h-64 bg-gray-100 rounded flex items-center justify-center text-gray-600">
            Bar chart coming soon
          </div>
        </div>
      </div>
    </div>
  );
}
