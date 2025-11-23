'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface Sensor {
  id: number;
  uuid: string;
  name: string;
  hostname: string;
  ip: string;
  honeypot: string;
  createdAt: string;
}

export default function SensorsPage() {
  const { isAuthenticated, loading, api } = useAuth();
  const router = useRouter();
  const [sensors, setSensors] = useState<Sensor[]>([]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    const fetchSensors = async () => {
      try {
        const response = await api.get('/sensor');
        setSensors(response.data.sensors || []);
      } catch (error) {
        console.error('Failed to fetch sensors:', error);
      }
    };

    if (isAuthenticated && !loading) {
      fetchSensors();
    }
  }, [isAuthenticated, loading, api]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Sensors</h1>
          <p className="text-gray-600">Manage honeypot sensors ({sensors.length} total)</p>
        </div>
        <button className="btn btn-primary flex items-center gap-2">
          <Plus size={20} /> Add Sensor
        </button>
      </div>

      <div className="grid gap-4">
          {sensors.map((sensor) => (
            <div key={sensor.id} className="card p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{sensor.name}</h3>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <p>Hostname: {sensor.hostname}</p>
                    <p>IP: {sensor.ip}</p>
                    <p>Type: <span className="badge badge-info">{sensor.honeypot}</span></p>
                    <p>UUID: <span className="font-mono text-xs">{sensor.uuid}</span></p>
                  </div>
                </div>
                <button className="p-2 hover:bg-red-50 rounded text-red-600">
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
