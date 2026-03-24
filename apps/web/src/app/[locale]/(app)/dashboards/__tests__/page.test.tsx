import React from 'react';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useParams: () => ({ locale: 'en' }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/dashboards',
}));

jest.mock('focus-trap-react', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockUseDashboards = {
  data: [] as Array<{
    id: string;
    name: string;
    description: string | null;
    is_auto_generated: boolean;
    created_at: string;
    widgets: { id: string }[];
  }>,
  loading: false,
  error: null as string | null,
  refetch: jest.fn(),
  create: jest.fn(),
  clone: jest.fn(),
  remove: jest.fn(),
};

jest.mock('@/hooks/useDashboards', () => ({
  useDashboards: () => mockUseDashboards,
}));

import { renderWithProviders, screen, fireEvent, waitFor } from '@/test-utils';
import DashboardsPage from '../page';

const mockDashboard = {
  id: 'dash-1',
  name: 'Sales Dashboard',
  description: 'Revenue overview',
  is_auto_generated: false,
  created_at: '2026-03-01T00:00:00Z',
  widgets: [{ id: 'w-1' }, { id: 'w-2' }],
};

const mockDashboard2 = {
  id: 'dash-2',
  name: 'Marketing Dashboard',
  description: null,
  is_auto_generated: true,
  created_at: '2026-03-02T00:00:00Z',
  widgets: [],
};

describe('DashboardsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDashboards.data = [];
    mockUseDashboards.loading = false;
    mockUseDashboards.error = null;
    window.confirm = jest.fn(() => true);
  });

  it('shows loading spinner', () => {
    mockUseDashboards.loading = true;
    renderWithProviders(<DashboardsPage />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('shows empty state when no dashboards', () => {
    mockUseDashboards.data = [];
    renderWithProviders(<DashboardsPage />);
    expect(screen.getByText('No dashboards yet')).toBeInTheDocument();
    expect(
      screen.getByText('Create your first dashboard to start visualizing data'),
    ).toBeInTheDocument();
  });

  it('renders dashboard cards', () => {
    mockUseDashboards.data = [mockDashboard, mockDashboard2];
    renderWithProviders(<DashboardsPage />);
    expect(screen.getByText('Sales Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Marketing Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Revenue overview')).toBeInTheDocument();
    expect(screen.getByText('Auto-generated')).toBeInTheDocument();
  });

  it('navigates to create new dashboard', () => {
    mockUseDashboards.data = [];
    renderWithProviders(<DashboardsPage />);
    const createButtons = screen.getAllByText('Create Dashboard');
    fireEvent.click(createButtons[0]!);
    expect(mockRouter.push).toHaveBeenCalledWith('/dashboards/new');
  });

  it('handles clone action', async () => {
    mockUseDashboards.data = [mockDashboard];
    mockUseDashboards.clone.mockResolvedValue(mockDashboard2);
    renderWithProviders(<DashboardsPage />);

    const cloneButton = screen.getByLabelText('Clone');
    fireEvent.click(cloneButton);

    await waitFor(() => {
      expect(mockUseDashboards.clone).toHaveBeenCalledWith('dash-1');
    });
  });

  it('handles delete action with confirmation', async () => {
    mockUseDashboards.data = [mockDashboard];
    mockUseDashboards.remove.mockResolvedValue(undefined);
    renderWithProviders(<DashboardsPage />);

    const deleteButton = screen.getByLabelText('Delete');
    fireEvent.click(deleteButton);

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockUseDashboards.remove).toHaveBeenCalledWith('dash-1');
    });
  });

  it('shows action error and dismisses it', async () => {
    mockUseDashboards.data = [mockDashboard];
    mockUseDashboards.clone.mockRejectedValue(new Error('Clone failed'));
    renderWithProviders(<DashboardsPage />);

    const cloneButton = screen.getByLabelText('Clone');
    fireEvent.click(cloneButton);

    await waitFor(() => {
      expect(screen.getByText('Clone failed')).toBeInTheDocument();
    });

    const dismissButton = screen.getByText('Dismiss');
    fireEvent.click(dismissButton);

    expect(screen.queryByText('Clone failed')).not.toBeInTheDocument();
  });
});
