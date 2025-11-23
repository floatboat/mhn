'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, Server, Zap } from 'lucide-react';

interface DashboardData {
  totalAttacks: number;
  activeSensors: number;
  totalSensors: number;
  criticalAlerts: number;
  attacksByProtocol: Array<{ protocol: string; count: number }>;
  topAttackers: Array<{ ip: string; count: number }>;
}

export default function DashboardPage() {
  const { isAuthenticated, loading, api } = useAuth();
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [dashboardRes, statsRes] = await Promise.all([
          api.get('/dashboard/summary'),
          api.get('/analytics/attacks/stats'),
        ]);

        setDashboardData({
          totalAttacks: statsRes.data.total || 0,
          activeSensors: dashboardRes.data.activeSensors || 0,
          totalSensors: dashboardRes.data.totalSensors || 0,
          criticalAlerts: dashboardRes.data.alerts || 0,
          attacksByProtocol: statsRes.data.byProtocol || [],
          topAttackers: statsRes.data.topAttackers || [],
        });
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setDataLoading(false);
      }
    };

    if (isAuthenticated && !loading) {
      fetchDashboardData();
    }
  }, [isAuthenticated, loading, api]);

  if (loading || dataLoading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-gray-600">Real-time overview of your honeypot infrastructure</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium mb-2">Total Attacks</p>
              <p className="text-3xl font-bold">{dashboardData?.totalAttacks.toLocaleString()}</p>
            </div>
            <Activity className="text-brand" size={32} />
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium mb-2">Active Sensors</p>
              <p className="text-3xl font-bold">
                {dashboardData?.activeSensors}/{dashboardData?.totalSensors}
              </p>
            </div>
            <Server className="text-green-600" size={32} />
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium mb-2">Critical Alerts</p>
              <p className="text-3xl font-bold">{dashboardData?.criticalAlerts}</p>
            </div>
            <AlertTriangle className="text-red-600" size={32} />
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium mb-2">System Status</p>
              <p className="text-3xl font-bold">
                <span className="badge badge-success">Active</span>
              </p>
            </div>
            <Zap className="text-yellow-600" size={32} />
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Attack Distribution */}
        <div className="lg:col-span-2 card p-6">
          <h2 className="text-xl font-semibold mb-4">Attack Distribution by Protocol</h2>
          <div className="space-y-3">
            {dashboardData?.attacksByProtocol.slice(0, 5).map((item) => (
              <div key={item.protocol} className="flex items-center justify-between">
                <span className="text-gray-700">{item.protocol}</span>
                <div className="w-48 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-brand h-full"
                    style={{
                      width: `${Math.min(
                        100,
                        (item.count / (dashboardData?.totalAttacks || 1)) * 100
                      )}%`,
                    }}
                  />
                </div>
                <span className="text-gray-600 font-medium w-20 text-right">
                  {item.count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Attackers */}
        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4">Top Attackers</h2>
          <div className="space-y-3">
            {dashboardData?.topAttackers.slice(0, 5).map((item) => (
              <div key={item.ip} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm font-mono text-gray-700">{item.ip}</span>
                <span className="badge badge-danger">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <a href="/attacks" className="card p-4 hover:shadow-md transition">
          <h3 className="font-semibold mb-2">View All Attacks</h3>
          <p className="text-sm text-gray-600">Browse and analyze attack data</p>
        </a>
        <a href="/sensors" className="card p-4 hover:shadow-md transition">
          <h3 className="font-semibold mb-2">Manage Sensors</h3>
          <p className="text-sm text-gray-600">Configure honeypot sensors</p>
        </a>
        <a href="/integrations" className="card p-4 hover:shadow-md transition">
          <h3 className="font-semibold mb-2">Integrations</h3>
          <p className="text-sm text-gray-600">Connect external systems</p>
        </a>
        <a href="/analytics" className="card p-4 hover:shadow-md transition">
          <h3 className="font-semibold mb-2">Analytics</h3>
          <p className="text-sm text-gray-600">View detailed analytics</p>
        </a>
      </div>
    </div>
  );
}
