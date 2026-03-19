/* eslint-disable no-console */
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, LayoutDashboard, Pencil, Trash2, Calendar, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';

interface Dashboard {
  id: string;
  name: string;
  description: string | null;
  is_auto_generated: boolean;
  created_at: string;
  widgets: { id: string }[];
}

export default function DashboardsPage() {
  const router = useRouter();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient<{ data: Dashboard[] }>('/organizations/current/dashboards')
      .then((res) => setDashboards(res.data))
      .catch(() => setDashboards([]))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Sterge dashboard-ul?')) return;
    try {
      await apiClient(`/organizations/current/dashboards/${id}`, { method: 'DELETE' });
      setDashboards((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary-blue" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboards</h1>
          <p className="text-sm text-gray-500 mt-1">{dashboards.length} dashboard(s)</p>
        </div>
        <Button onClick={() => router.push('/dashboards/new')}>
          <Plus className="h-4 w-4 mr-2" /> Create Dashboard
        </Button>
      </div>

      {dashboards.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <LayoutDashboard className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">No dashboards yet</h3>
            <p className="text-sm text-gray-500 mb-4">
              Create your first dashboard to start visualizing data
            </p>
            <Button onClick={() => router.push('/dashboards/new')}>
              <Plus className="h-4 w-4 mr-2" /> Create Dashboard
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboards.map((d) => (
            <Card key={d.id} className="hover:shadow-md transition-shadow cursor-pointer group">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <Link href={`/dashboards/${d.id}/edit`} className="flex-1">
                    <CardTitle className="text-base group-hover:text-primary-blue transition-colors">
                      {d.name}
                    </CardTitle>
                  </Link>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => router.push(`/dashboards/${d.id}/edit`)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500"
                      onClick={() => handleDelete(d.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                  {d.description || 'No description'}
                </p>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <LayoutDashboard className="h-3 w-3" />
                    {d.widgets?.length || 0} widgets
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(d.created_at).toLocaleDateString()}
                  </span>
                </div>
                {d.is_auto_generated && (
                  <span className="inline-block mt-2 text-xs bg-blue-50 text-primary-blue px-2 py-0.5 rounded">
                    Auto-generated
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
