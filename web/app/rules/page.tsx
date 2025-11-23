'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface Rule {
  id: number;
  message: string;
  classtype: string;
  sid: number;
  rev: number;
  isActive: boolean;
}

export default function RulesPage() {
  const { isAuthenticated, loading, api } = useAuth();
  const router = useRouter();
  const [rules, setRules] = useState<Rule[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    const fetchRules = async () => {
      try {
        const response = await api.get('/rule');
        setRules(response.data.rules || []);
      } catch (error) {
        console.error('Failed to fetch rules:', error);
      } finally {
        setDataLoading(false);
      }
    };

    if (isAuthenticated && !loading) {
      fetchRules();
    }
  }, [isAuthenticated, loading, api]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Rules</h1>
          <p className="text-gray-600">Manage Snort/Suricata IDS rules ({rules.length} total)</p>
        </div>
        <button className="btn btn-primary flex items-center gap-2">
          <Plus size={20} /> Import Rules
        </button>
      </div>

      {dataLoading ? (
        <div className="card p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand mx-auto mb-4"></div>
          <p className="text-gray-600">Loading rules...</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Message</th>
                  <th>SID</th>
                  <th>Rev</th>
                  <th>Class Type</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.length > 0 ? (
                  rules.map((rule) => (
                    <tr key={rule.id}>
                      <td>{rule.message}</td>
                      <td className="font-mono text-sm">{rule.sid}</td>
                      <td>{rule.rev}</td>
                      <td>{rule.classtype}</td>
                      <td>
                        <span className={`badge ${rule.isActive ? 'badge-success' : 'badge-warning'}`}>
                          {rule.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button className="p-2 hover:bg-red-50 rounded text-red-600">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-600">
                      No rules found. Import rules to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
