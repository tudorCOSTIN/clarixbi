import React from 'react';

const mockRouter = { push: jest.fn() };

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => mockRouter,
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useParams: () => ({ locale: 'en' }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/data-sources',
}));

jest.mock('focus-trap-react', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockUseDataSources = {
  data: [] as Array<{
    id: string;
    type: string;
    name: string;
    status: 'active' | 'syncing' | 'error' | 'disconnected';
    last_sync_at: string | null;
    total_rows: number;
    created_at: string;
  }>,
  loading: false,
  error: null as string | null,
  refetch: jest.fn(),
  triggerSync: jest.fn(),
  remove: jest.fn(),
};

jest.mock('@/hooks/useDataSources', () => ({
  useDataSources: () => mockUseDataSources,
}));

jest.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: () => {},
}));

import { renderWithProviders, screen, fireEvent, waitFor } from '@/test-utils';
import DataSourcesPage from '../page';

const mockSource = {
  id: 'ds-1',
  type: 'smartbill',
  name: 'SmartBill Production',
  status: 'active' as const,
  last_sync_at: '2026-03-20T12:00:00Z',
  total_rows: 1500,
  created_at: '2026-03-01T00:00:00Z',
};

describe('DataSourcesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDataSources.data = [];
    mockUseDataSources.loading = false;
    window.confirm = jest.fn(() => true);
  });

  it('shows loading skeletons', () => {
    mockUseDataSources.loading = true;
    renderWithProviders(<DataSourcesPage />);
    const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state', () => {
    renderWithProviders(<DataSourcesPage />);
    expect(screen.getByText('No data sources connected')).toBeInTheDocument();
    expect(screen.getByText('Add your first data source')).toBeInTheDocument();
  });

  it('renders data source cards', () => {
    mockUseDataSources.data = [mockSource];
    renderWithProviders(<DataSourcesPage />);
    expect(screen.getByText('SmartBill Production')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('1,500')).toBeInTheDocument();
  });

  it('navigates to connect page', () => {
    mockUseDataSources.data = [];
    renderWithProviders(<DataSourcesPage />);
    fireEvent.click(screen.getByText('Add your first data source'));
    expect(mockRouter.push).toHaveBeenCalledWith('/connect');
  });

  it('triggers sync', async () => {
    mockUseDataSources.data = [mockSource];
    mockUseDataSources.triggerSync.mockResolvedValue(undefined);
    renderWithProviders(<DataSourcesPage />);

    fireEvent.click(screen.getByText('Sync now'));

    await waitFor(() => {
      expect(mockUseDataSources.triggerSync).toHaveBeenCalledWith('ds-1');
    });
  });

  it('deletes a data source with confirmation', async () => {
    mockUseDataSources.data = [mockSource];
    mockUseDataSources.remove.mockResolvedValue(undefined);
    renderWithProviders(<DataSourcesPage />);

    fireEvent.click(screen.getByText('Delete'));

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockUseDataSources.remove).toHaveBeenCalledWith('ds-1');
    });
  });
});
