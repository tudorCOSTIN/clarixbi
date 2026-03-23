'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { WidgetCard } from '@/components/dashboard/WidgetCard';
import { API_URL } from '@/lib/api-client';

interface SharedWidget {
  title: string;
  type: string;
  data: Record<string, unknown>[];
}

interface SharedDashboard {
  dashboard: {
    id: string;
    name: string;
    description: string | null;
    widgets: {
      id: string;
      type: string;
      title: string;
      config: Record<string, unknown>;
      position: Record<string, unknown>;
    }[];
  };
  widgets: SharedWidget[];
}

export default function SharedDashboardPage() {
  const params = useParams();
  const shareToken = params.shareToken as string;
  const [data, setData] = useState<SharedDashboard | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/shared/dashboards/${shareToken}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then((res) => setData(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [shareToken]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <AlertCircle className="h-12 w-12 text-gray-500 mb-4" />
        <h1 className="text-xl font-semibold text-gray-700 mb-2">
          This dashboard is no longer available
        </h1>
        <p className="text-sm text-gray-500">The link may have expired or been revoked.</p>
      </div>
    );
  }

  const { dashboard, widgets: widgetData } = data;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{dashboard.name}</h1>
          {dashboard.description && (
            <p className="text-sm text-gray-500 mt-1">{dashboard.description}</p>
          )}
        </div>

        {dashboard.widgets.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>This dashboard has no widgets.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dashboard.widgets.map((widget, index) => {
              const matchingData = widgetData[index];
              return (
                <div key={widget.id} className="min-h-[250px]">
                  <WidgetCard
                    widget={{
                      ...widget,
                      data: matchingData?.data || [],
                    }}
                    isEditing={false}
                    height={250}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <footer className="mt-12 py-6 border-t bg-white text-center">
        <p className="text-sm text-gray-500">
          Powered by <span className="font-semibold text-gray-600">ClarixBI</span> &mdash;
          clarixbi.com
        </p>
      </footer>
    </div>
  );
}
