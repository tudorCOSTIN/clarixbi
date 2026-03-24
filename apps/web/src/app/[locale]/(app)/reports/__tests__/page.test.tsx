import React from 'react';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useParams: () => ({ locale: 'en' }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/reports',
}));

jest.mock('focus-trap-react', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockUseReports = {
  data: [] as Array<{
    id: string;
    name: string;
    description: string | null;
    dashboard_id: string;
    dashboard?: { name: string };
    config: { widgetIds?: string[]; generatedFiles?: { url: string; generatedAt: string }[] };
    schedules?: Array<{
      id: string;
      cron_expression: string;
      recipients: string[];
      is_active: boolean;
      next_run_at: string;
    }>;
    created_at: string;
    updated_at: string;
  }>,
  loading: false,
  error: null as string | null,
  refetch: jest.fn(),
  create: jest.fn(),
  generate: jest.fn(),
  download: jest.fn(),
  schedule: jest.fn(),
  remove: jest.fn(),
};

jest.mock('@/hooks/useReports', () => ({
  useReports: () => mockUseReports,
}));

jest.mock('@/stores/org-store', () => ({
  useOrgStore: () => ({ currentOrgId: 'org-1' }),
}));

jest.mock('@/lib/api-client', () => ({
  apiClient: jest.fn(),
}));

import { renderWithProviders, screen, fireEvent, waitFor } from '@/test-utils';
import ReportsPage from '../page';

const mockReport = {
  id: 'report-1',
  name: 'Monthly Sales',
  description: 'Sales overview',
  dashboard_id: 'dash-1',
  dashboard: { name: 'Sales Dashboard' },
  config: {
    widgetIds: ['w-1'],
    generatedFiles: [{ url: 'https://example.com/file.pdf', generatedAt: '2026-03-20T10:00:00Z' }],
  },
  schedules: [
    {
      id: 'sched-1',
      cron_expression: '0 8 * * 1',
      recipients: ['john@example.com'],
      is_active: true,
      next_run_at: '2026-03-25T08:00:00Z',
    },
  ],
  created_at: '2026-03-01T00:00:00Z',
  updated_at: '2026-03-20T10:00:00Z',
};

describe('ReportsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseReports.data = [];
    mockUseReports.loading = false;
    window.confirm = jest.fn(() => true);
  });

  it('shows loading spinner', () => {
    mockUseReports.loading = true;
    renderWithProviders(<ReportsPage />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('shows empty state', () => {
    renderWithProviders(<ReportsPage />);
    expect(screen.getByText('No reports')).toBeInTheDocument();
    expect(screen.getByText('Create your first report from a dashboard')).toBeInTheDocument();
  });

  it('renders report cards', () => {
    mockUseReports.data = [mockReport];
    renderWithProviders(<ReportsPage />);
    expect(screen.getByText('Monthly Sales')).toBeInTheDocument();
    expect(screen.getByText('Sales Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Weekly')).toBeInTheDocument();
  });

  it('opens create modal on button click', () => {
    renderWithProviders(<ReportsPage />);
    const createButtons = screen.getAllByText('Create report');
    fireEvent.click(createButtons[0]!);
    // Modal renders
    expect(screen.getByText('Report name')).toBeInTheDocument();
  });

  it('calls generate for a report', async () => {
    mockUseReports.data = [mockReport];
    mockUseReports.generate.mockResolvedValue(undefined);
    renderWithProviders(<ReportsPage />);

    const generateButton = screen.getByText('Generate now');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(mockUseReports.generate).toHaveBeenCalledWith('report-1');
    });
  });

  it('deletes a report with confirmation', async () => {
    mockUseReports.data = [mockReport];
    mockUseReports.remove.mockResolvedValue(undefined);
    renderWithProviders(<ReportsPage />);

    const deleteButton = screen.getByLabelText('Delete this report?');
    fireEvent.click(deleteButton);

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockUseReports.remove).toHaveBeenCalledWith('report-1');
    });
  });
});
