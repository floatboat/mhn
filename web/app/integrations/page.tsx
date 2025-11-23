'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Settings } from 'lucide-react';

export default function IntegrationsPage() {
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
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Integrations</h1>
          <p className="text-gray-600">Connect external systems and services</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Splunk */}
          <div className="card p-6">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold">Splunk</h3>
              <button className="p-2 hover:bg-gray-100 rounded">
                <Settings size={20} />
              </button>
            </div>
            <p className="text-gray-600 text-sm mb-4">Forward events to Splunk HEC</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Status</span>
                <span className="badge badge-warning">Not Configured</span>
              </div>
            </div>
          </div>

          {/* Elasticsearch */}
          <div className="card p-6">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold">Elasticsearch</h3>
              <button className="p-2 hover:bg-gray-100 rounded">
                <Settings size={20} />
              </button>
            </div>
            <p className="text-gray-600 text-sm mb-4">Export events to ELK Stack</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Status</span>
                <span className="badge badge-warning">Not Configured</span>
              </div>
            </div>
          </div>

          {/* ArcSight */}
          <div className="card p-6">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold">ArcSight</h3>
              <button className="p-2 hover:bg-gray-100 rounded">
                <Settings size={20} />
              </button>
            </div>
            <p className="text-gray-600 text-sm mb-4">Forward events in CEF format</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Status</span>
                <span className="badge badge-warning">Not Configured</span>
              </div>
            </div>
          </div>

          {/* Email Alerts */}
          <div className="card p-6">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold">Email Alerts</h3>
              <button className="p-2 hover:bg-gray-100 rounded">
                <Settings size={20} />
              </button>
            </div>
            <p className="text-gray-600 text-sm mb-4">Send security alerts via email</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Status</span>
                <span className="badge badge-warning">Not Configured</span>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}
