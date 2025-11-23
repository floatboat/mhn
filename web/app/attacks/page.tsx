'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Search, Filter } from 'lucide-react';

interface Attack {
  id: number;
  sourceIp: string;
  protocol: string;
  port?: number;
  timestamp: string;
  country?: string;
  sensor: { name: string };
}

export default function AttacksPage() {
  const { isAuthenticated, loading, api } = useAuth();
  const router = useRouter();
  const [attacks, setAttacks] = useState<Attack[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [protocol, setProtocol] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    const fetchAttacks = async () => {
      try {
        const params = new URLSearchParams({
          limit: '50',
          offset: String((page - 1) * 50),
          ...(search && { sourceIp: search }),
          ...(protocol && { protocol }),
        });

        const response = await api.get(`/attack?${params}`);
        setAttacks(response.data.attacks || []);
        setTotal(response.data.total || 0);
      } catch (error) {
        console.error('Failed to fetch attacks:', error);
      } finally {
        setDataLoading(false);
      }
    };

    if (isAuthenticated && !loading) {
      setDataLoading(true);
      fetchAttacks();
    }
  }, [isAuthenticated, loading, api, search, protocol, page]);

  if (loading || dataLoading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand mx-auto mb-4"></div>
            <p className="text-gray-600">Loading attacks...</p>
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
        <h1 className="text-3xl font-bold mb-2">Attack Data</h1>
        <p className="text-gray-600">Total attacks recorded: {total.toLocaleString()}</p>
      </div>

      {/* Filters */}
      <div className="card p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Search IP Address</label>
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="192.168.1.1"
                className="pl-10 w-full"
              />
              <Search className="absolute left-3 top-3 text-gray-400" size={18} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Protocol</label>
            <select
              value={protocol}
              onChange={(e) => {
                setProtocol(e.target.value);
                setPage(1);
              }}
              className="w-full"
            >
              <option value="">All Protocols</option>
              <option value="TCP">TCP</option>
              <option value="UDP">UDP</option>
              <option value="HTTP">HTTP</option>
              <option value="SSH">SSH</option>
              <option value="DNS">DNS</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="btn btn-secondary w-full flex items-center justify-center gap-2">
              <Filter size={18} /> Advanced Filters
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Source IP</th>
                <th>Protocol</th>
                <th>Port</th>
                <th>Sensor</th>
                <th>Country</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {attacks.length > 0 ? (
                attacks.map((attack) => (
                  <tr key={attack.id}>
                    <td className="font-mono text-sm">{attack.sourceIp}</td>
                    <td>
                      <span className="badge badge-info">{attack.protocol}</span>
                    </td>
                    <td>{attack.port || '-'}</td>
                    <td>{attack.sensor?.name || '-'}</td>
                    <td>{attack.country || 'Unknown'}</td>
                    <td className="text-sm text-gray-600">
                      {formatDistanceToNow(new Date(attack.timestamp), { addSuffix: true })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-600">
                    No attacks found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div className="px-6 py-4 border-t flex items-center justify-between">
            <span className="text-sm text-gray-600">
              Showing {(page - 1) * 50 + 1} to {Math.min(page * 50, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="btn btn-secondary disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page * 50 >= total}
                className="btn btn-secondary disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
