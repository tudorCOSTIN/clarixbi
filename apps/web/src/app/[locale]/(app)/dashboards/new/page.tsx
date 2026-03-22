'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';

export default function CreateDashboardPage() {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('nameRequired'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await apiClient<{ data: { id: string } }>('/organizations/current/dashboards', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
      });
      router.push(`/dashboards/${res.data.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('createFailed'));
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <Button variant="ghost" size="sm" onClick={() => router.push('/dashboards')} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" /> {t('backToDashboards')}
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{t('createNew')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">{t('name')}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('namePlaceholder')}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desc">{t('description')}</Label>
              <textarea
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('descriptionPlaceholder')}
                className="flex w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-blue focus-visible:ring-offset-2 min-h-[80px]"
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => router.push('/dashboards')}>
                {tc('cancel')}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {tc('create')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
