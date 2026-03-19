'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiClient } from '@/lib/api-client';
import {
  FileSpreadsheet,
  ShoppingCart,
  Upload,
  Database,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
} from 'lucide-react';

type ConnectorType = 'smartbill' | 'woocommerce' | 'csv' | 'demo';

const connectors = [
  {
    id: 'smartbill' as ConnectorType,
    icon: FileSpreadsheet,
    available: true,
  },
  {
    id: 'woocommerce' as ConnectorType,
    icon: ShoppingCart,
    available: false,
  },
  {
    id: 'csv' as ConnectorType,
    icon: Upload,
    available: false,
  },
  {
    id: 'demo' as ConnectorType,
    icon: Database,
    available: false,
  },
];

export default function ConnectPage() {
  const t = useTranslations('connect');
  const router = useRouter();
  const [selected, setSelected] = useState<ConnectorType | null>(null);
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [connecting, setConnecting] = useState(false);

  const handleTestConnection = async () => {
    if (!email || !token) return;
    setTesting(true);
    setConnectionStatus('idle');
    setErrorMessage('');

    try {
      await apiClient<{ data: { id: string } }>('/organizations/test/data-sources', {
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

  const handleConnect = async () => {
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
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50">
                  <connector.icon className="h-6 w-6 text-primary-blue" />
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
                  <span className="text-xs text-gray-400">{t('comingSoon')}</span>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      ) : (
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

            {connectionStatus === 'success' && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700">
                  {t('smartbillForm.connectionSuccess')}
                </AlertDescription>
              </Alert>
            )}

            {connectionStatus === 'error' && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  {errorMessage || t('smartbillForm.connectionError')}
                </AlertDescription>
              </Alert>
            )}

            {errorMessage && connectionStatus !== 'error' && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={!email || !token || testing}
                className="flex-1"
              >
                {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('smartbillForm.testConnection')}
              </Button>

              <Button
                onClick={handleConnect}
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

            <Button
              variant="ghost"
              className="w-full text-gray-500"
              onClick={() => {
                setSelected(null);
                setConnectionStatus('idle');
                setErrorMessage('');
              }}
            >
              {t('back')}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
