'use client';

import { useState, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { apiClient, API_URL } from '@/lib/api-client';
import {
  FileSpreadsheet,
  ShoppingCart,
  Upload,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  FileUp,
} from 'lucide-react';

type ConnectorType = 'smartbill' | 'woocommerce' | 'csv' | 'demo';

const connectors = [
  {
    id: 'smartbill' as ConnectorType,
    icon: FileSpreadsheet,
    color: 'bg-blue-50 text-blue-600',
    available: true,
  },
  {
    id: 'woocommerce' as ConnectorType,
    icon: ShoppingCart,
    color: 'bg-purple-50 text-purple-600',
    available: true,
  },
  {
    id: 'csv' as ConnectorType,
    icon: Upload,
    color: 'bg-gray-50 text-gray-600',
    available: true,
  },
  {
    id: 'demo' as ConnectorType,
    icon: Play,
    color: 'bg-green-50 text-green-600',
    available: true,
  },
];

export default function ConnectPage() {
  const t = useTranslations('connect');
  const router = useRouter();
  const [selected, setSelected] = useState<ConnectorType | null>(null);

  // SmartBill state
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');

  // WooCommerce state
  const [storeUrl, setStoreUrl] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');

  // CSV state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [csvPreview, setCsvPreview] = useState<{
    rows: Record<string, string>[];
    schema: { name: string; type: string; sampleValues: string[] }[];
  } | null>(null);
  const [csvDataSourceId, setCsvDataSourceId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Shared state
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleTestSmartBill = async () => {
    if (!email || !token) return;
    setTesting(true);
    setConnectionStatus('idle');
    setErrorMessage('');

    try {
      await apiClient('/organizations/test/data-sources', {
        method: 'POST',
        body: JSON.stringify({
          type: 'smartbill',
          name: 'SmartBill',
          credentials: { email, token },
        }),
      });
      setConnectionStatus('success');
    } catch (err) {
      setConnectionStatus('error');
      setErrorMessage(err instanceof Error ? err.message : t('connectionFailed'));
    } finally {
      setTesting(false);
    }
  };

  const handleConnectSmartBill = async () => {
    if (!email || !token) return;
    setConnecting(true);
    setErrorMessage('');

    try {
      await apiClient('/organizations/current/data-sources', {
        method: 'POST',
        body: JSON.stringify({
          type: 'smartbill',
          name: 'SmartBill',
          credentials: { email, token },
        }),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push('/sync' as any);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('connectionFailed'));
      setConnecting(false);
    }
  };

  const handleTestWooCommerce = async () => {
    if (!storeUrl || !consumerKey || !consumerSecret) return;
    setTesting(true);
    setConnectionStatus('idle');
    setErrorMessage('');

    try {
      await apiClient('/organizations/test/data-sources', {
        method: 'POST',
        body: JSON.stringify({
          type: 'woocommerce',
          name: 'WooCommerce',
          credentials: { storeUrl, consumerKey, consumerSecret },
        }),
      });
      setConnectionStatus('success');
    } catch (err) {
      setConnectionStatus('error');
      setErrorMessage(err instanceof Error ? err.message : t('connectionFailed'));
    } finally {
      setTesting(false);
    }
  };

  const handleConnectWooCommerce = async () => {
    if (!storeUrl || !consumerKey || !consumerSecret) return;
    setConnecting(true);
    setErrorMessage('');

    try {
      await apiClient('/organizations/current/data-sources', {
        method: 'POST',
        body: JSON.stringify({
          type: 'woocommerce',
          name: 'WooCommerce',
          credentials: { storeUrl, consumerKey, consumerSecret },
        }),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push('/sync' as any);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('connectionFailed'));
      setConnecting(false);
    }
  };

  const handleFileSelect = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
      setErrorMessage(t('csvForm.invalidFormat'));
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setErrorMessage(t('csvForm.fileTooLarge'));
      return;
    }
    setCsvFile(file);
    setErrorMessage('');
    setCsvPreview(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, []);

  const handleUploadCsv = async () => {
    if (!csvFile) return;
    setUploading(true);
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('file', csvFile);
      formData.append('name', csvFile.name);

      const res = await fetch(`${API_URL}/organizations/current/data-sources/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: {
          'X-Org-Id':
            JSON.parse(localStorage.getItem('clarixbi-org-store') || '{}')?.state?.currentOrgId ||
            '',
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(err.message);
      }

      const data = await res.json();
      const dsId = data.data?.id;
      setCsvDataSourceId(dsId);

      // Fetch preview
      if (dsId) {
        try {
          const preview = await apiClient<{
            data: {
              rows: Record<string, string>[];
              schema: { name: string; type: string; sampleValues: string[] }[];
            };
          }>(`/organizations/current/data-sources/${dsId}/preview`);
          setCsvPreview(preview.data);
        } catch {
          // Preview might not be ready yet, redirect to sync
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          router.push('/sync' as any);
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmCsvSchema = async () => {
    if (!csvDataSourceId || !csvPreview) return;
    setConnecting(true);
    setErrorMessage('');

    try {
      await apiClient(`/organizations/current/data-sources/${csvDataSourceId}/schema`, {
        method: 'PATCH',
        body: JSON.stringify({ schema: csvPreview.schema }),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push('/sync' as any);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Schema update failed');
      setConnecting(false);
    }
  };

  const handleUpdateColumnType = (colIndex: number, newType: string) => {
    if (!csvPreview) return;
    const updatedSchema = [...csvPreview.schema];
    updatedSchema[colIndex] = { ...updatedSchema[colIndex]!, type: newType };
    setCsvPreview({ ...csvPreview, schema: updatedSchema });
  };

  const handleLoadDemoData = async () => {
    setConnecting(true);
    setErrorMessage('');

    try {
      const orgId =
        JSON.parse(localStorage.getItem('clarixbi-org-store') || '{}')?.state?.currentOrgId || '';

      await apiClient(`/organizations/${orgId}/onboarding/demo-data`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push('/sync' as any);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Demo data loading failed');
      setConnecting(false);
    }
  };

  const resetForm = () => {
    setSelected(null);
    setConnectionStatus('idle');
    setErrorMessage('');
    setCsvFile(null);
    setCsvPreview(null);
    setCsvDataSourceId(null);
  };

  const renderConnectionStatus = () => (
    <>
      {connectionStatus === 'success' && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">{t('connectionSuccess')}</AlertDescription>
        </Alert>
      )}
      {connectionStatus === 'error' && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage || t('connectionError')}</AlertDescription>
        </Alert>
      )}
      {errorMessage && connectionStatus !== 'error' && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
    </>
  );

  const renderSmartBillForm = () => (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle className="text-lg">{t('smartbillForm.title')}</CardTitle>
        <CardDescription>{t('smartbillForm.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">{t('smartbillForm.email')}</Label>
          <Input
            id="email"
            type="email"
            placeholder={t('smartbillForm.emailPlaceholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="token">{t('smartbillForm.token')}</Label>
          <Input
            id="token"
            type="password"
            placeholder={t('smartbillForm.tokenPlaceholder')}
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </div>
        {renderConnectionStatus()}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleTestSmartBill}
            disabled={!email || !token || testing}
            className="flex-1"
          >
            {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('smartbillForm.testConnection')}
          </Button>
          <Button
            onClick={handleConnectSmartBill}
            disabled={!email || !token || connecting}
            className="flex-1"
          >
            {connecting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 h-4 w-4" />
            )}
            {t('smartbillForm.connectAndSync')}
          </Button>
        </div>
        <Button variant="ghost" className="w-full text-gray-500" onClick={resetForm}>
          {t('back')}
        </Button>
      </CardContent>
    </Card>
  );

  const renderWooCommerceForm = () => (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle className="text-lg">{t('woocommerceForm.title')}</CardTitle>
        <CardDescription>{t('woocommerceForm.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="storeUrl">{t('woocommerceForm.storeUrl')}</Label>
          <Input
            id="storeUrl"
            type="url"
            placeholder="https://magazinul-meu.ro"
            value={storeUrl}
            onChange={(e) => setStoreUrl(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="consumerKey">{t('woocommerceForm.consumerKey')}</Label>
          <Input
            id="consumerKey"
            type="text"
            placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            value={consumerKey}
            onChange={(e) => setConsumerKey(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="consumerSecret">{t('woocommerceForm.consumerSecret')}</Label>
          <Input
            id="consumerSecret"
            type="password"
            placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            value={consumerSecret}
            onChange={(e) => setConsumerSecret(e.target.value)}
          />
        </div>
        {renderConnectionStatus()}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleTestWooCommerce}
            disabled={!storeUrl || !consumerKey || !consumerSecret || testing}
            className="flex-1"
          >
            {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('woocommerceForm.testConnection')}
          </Button>
          <Button
            onClick={handleConnectWooCommerce}
            disabled={!storeUrl || !consumerKey || !consumerSecret || connecting}
            className="flex-1"
          >
            {connecting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 h-4 w-4" />
            )}
            {t('woocommerceForm.connectAndSync')}
          </Button>
        </div>
        <Button variant="ghost" className="w-full text-gray-500" onClick={resetForm}>
          {t('back')}
        </Button>
      </CardContent>
    </Card>
  );

  const renderCsvUpload = () => (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle className="text-lg">{t('csvForm.title')}</CardTitle>
        <CardDescription>{t('csvForm.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!csvPreview ? (
          <>
            <div
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
                dragOver
                  ? 'border-primary-blue bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="mb-3 h-10 w-10 text-gray-500" />
              <p className="text-sm text-gray-600">{t('csvForm.dropzone')}</p>
              <p className="mt-1 text-xs text-gray-500">{t('csvForm.formats')}</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
              />
            </div>

            {csvFile && (
              <div className="flex items-center justify-between rounded-lg border bg-gray-50 p-3">
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium">{csvFile.name}</span>
                  <span className="text-xs text-gray-500">
                    ({(csvFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <Button onClick={handleUploadCsv} disabled={uploading} size="sm">
                  {uploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="mr-2 h-4 w-4" />
                  )}
                  {t('csvForm.upload')}
                </Button>
              </div>
            )}

            {renderConnectionStatus()}
          </>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {csvPreview.schema.map((col, i) => (
                      <th key={i} className="px-3 py-2 text-left font-medium text-gray-700">
                        <div>{col.name}</div>
                        <select
                          value={col.type}
                          onChange={(e) => handleUpdateColumnType(i, e.target.value)}
                          className="mt-1 rounded border border-gray-200 px-1 py-0.5 text-xs font-normal"
                        >
                          <option value="string">String</option>
                          <option value="number">Number</option>
                          <option value="date">Date</option>
                          <option value="boolean">Boolean</option>
                        </select>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvPreview.rows.slice(0, 20).map((row, rowIdx) => (
                    <tr key={rowIdx} className="border-t">
                      {csvPreview.schema.map((col, colIdx) => (
                        <td key={colIdx} className="px-3 py-1.5 text-gray-600">
                          {row[col.name] || ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500">{t('csvForm.previewNote')}</p>
            {renderConnectionStatus()}
            <Button onClick={handleConfirmCsvSchema} disabled={connecting} className="w-full">
              {connecting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4" />
              )}
              {t('csvForm.confirmAndImport')}
            </Button>
          </>
        )}
        <Button variant="ghost" className="w-full text-gray-500" onClick={resetForm}>
          {t('back')}
        </Button>
      </CardContent>
    </Card>
  );

  const renderDemoCard = () => (
    <Card className="mx-auto max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
          <Play className="h-8 w-8 text-green-600" />
        </div>
        <CardTitle className="text-lg">{t('demoForm.title')}</CardTitle>
        <CardDescription>{t('demoForm.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
          <p>{t('demoForm.includes')}</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>{t('demoForm.dataset1')}</li>
            <li>{t('demoForm.dataset2')}</li>
            <li>{t('demoForm.dataset3')}</li>
          </ul>
        </div>
        {renderConnectionStatus()}
        <Button onClick={handleLoadDemoData} disabled={connecting} className="w-full">
          {connecting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
          )}
          {t('demoForm.loadButton')}
        </Button>
        <Button variant="ghost" className="w-full text-gray-500" onClick={resetForm}>
          {t('back')}
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div>
      <div className="mb-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900">{t('title')}</h2>
        <p className="mt-2 text-sm text-gray-500">{t('subtitle')}</p>
      </div>

      {!selected ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {connectors.map((connector) => (
            <Card
              key={connector.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                !connector.available ? 'opacity-50' : 'hover:border-primary-blue'
              }`}
              onClick={() => connector.available && setSelected(connector.id)}
            >
              <CardHeader className="flex flex-row items-center gap-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-lg ${connector.color}`}
                >
                  <connector.icon className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-base">
                    {t(`connectors.${connector.id}.name`)}
                  </CardTitle>
                  <CardDescription>{t(`connectors.${connector.id}.description`)}</CardDescription>
                </div>
              </CardHeader>
              {!connector.available && (
                <CardContent>
                  <Badge variant="secondary" className="text-xs">
                    {t('comingSoon')}
                  </Badge>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <>
          {selected === 'smartbill' && renderSmartBillForm()}
          {selected === 'woocommerce' && renderWooCommerceForm()}
          {selected === 'csv' && renderCsvUpload()}
          {selected === 'demo' && renderDemoCard()}
        </>
      )}
    </div>
  );
}
