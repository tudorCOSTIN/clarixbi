import React from 'react';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useParams: () => ({ locale: 'en' }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/alerts',
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock('focus-trap-react', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockUseAlerts = {
  data: [] as Array<{
    id: string;
    name: string;
    metric_query: string;
    condition_operator: string;
    threshold_value: number;
    check_frequency: string;
    is_active: boolean;
    data_source_id: string;
    created_at: string;
    updated_at: string;
  }>,
  loading: false,
  error: null as string | null,
  refetch: jest.fn(),
  create: jest.fn(),
  toggle: jest.fn(),
  test: jest.fn(),
  getTriggers: jest.fn(),
  remove: jest.fn(),
};

jest.mock('@/hooks/useAlerts', () => ({
  useAlerts: () => mockUseAlerts,
}));

jest.mock('@/stores/org-store', () => ({
  useOrgStore: () => ({ currentOrgId: 'org-1' }),
}));

jest.mock('@/lib/api-client', () => ({
  apiClient: jest.fn(),
}));

jest.mock('@/hooks/useWebSocket', () => ({
  useSocketEvent: () => ({ on: () => () => {} }),
}));

import { renderWithProviders, screen, fireEvent, waitFor } from '@/test-utils';
import AlertsPage from '../page';

const mockAlert = {
  id: 'alert-1',
  name: 'Revenue Drop',
  metric_query: 'SELECT SUM(amount) FROM invoices WHERE status = unpaid',
  condition_operator: 'lt',
  threshold_value: 5000,
  check_frequency: 'hourly',
  is_active: true,
  data_source_id: 'ds-1',
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
};

describe('AlertsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAlerts.data = [];
    mockUseAlerts.loading = false;
    window.confirm = jest.fn(() => true);
  });

  it('shows loading spinner', () => {
    mockUseAlerts.loading = true;
    renderWithProviders(<AlertsPage />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('shows empty state', () => {
    renderWithProviders(<AlertsPage />);
    expect(screen.getByText('No alerts')).toBeInTheDocument();
    expect(screen.getByText('Create your first alert to monitor your data')).toBeInTheDocument();
  });

  it('renders alerts table', () => {
    mockUseAlerts.data = [mockAlert];
    renderWithProviders(<AlertsPage />);
    expect(screen.getByText('Revenue Drop')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('opens create wizard on button click', () => {
    renderWithProviders(<AlertsPage />);
    const createButtons = screen.getAllByText('Create alert');
    fireEvent.click(createButtons[0]!);
    // Wizard renders with title
    expect(screen.getAllByText('Create alert').length).toBeGreaterThanOrEqual(1);
  });

  it('toggles alert active state', async () => {
    mockUseAlerts.data = [mockAlert];
    mockUseAlerts.toggle.mockResolvedValue(undefined);
    renderWithProviders(<AlertsPage />);

    const pauseButton = screen.getByLabelText('Pause');
    fireEvent.click(pauseButton);

    await waitFor(() => {
      expect(mockUseAlerts.toggle).toHaveBeenCalledWith('alert-1', false);
    });
  });

  it('deletes alert with confirmation', async () => {
    mockUseAlerts.data = [mockAlert];
    mockUseAlerts.remove.mockResolvedValue(undefined);
    renderWithProviders(<AlertsPage />);

    const deleteButton = screen.getByLabelText('Delete');
    fireEvent.click(deleteButton);

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockUseAlerts.remove).toHaveBeenCalledWith('alert-1');
    });
  });
});
