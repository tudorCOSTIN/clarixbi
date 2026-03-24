/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockApiClient = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ push: mockPush, back: mockBack })),
  useParams: jest.fn(() => ({ id: 'dash-1', locale: 'en' })),
}));

jest.mock('@/lib/api-client', () => ({
  apiClient: (...args: any[]) => mockApiClient(...args),
}));

jest.mock('@/i18n/navigation', () => ({
  useRouter: jest.fn(() => ({ push: mockPush, back: mockBack })),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock('next/dynamic', () => {
  return jest.fn().mockImplementation(() => {
    return function MockDynamic(props: any) {
      return <div data-testid="mock-grid">{props.children}</div>;
    };
  });
});

jest.mock('focus-trap-react', () => {
  return ({ children }: { children: React.ReactNode }) => <>{children}</>;
});

jest.mock('@/components/dashboard/WidgetLibrary', () => ({
  WidgetLibrary: ({ onAddWidget }: any) => (
    <div data-testid="widget-library">
      <button data-testid="add-line" onClick={() => onAddWidget('line', { w: 6, h: 4 })}>
        Add Line
      </button>
    </div>
  ),
}));

jest.mock('@/components/dashboard/WidgetConfigurator', () => ({
  WidgetConfigurator: ({ open, onApply, onCancel }: any) =>
    open ? (
      <div data-testid="widget-configurator">
        <button
          data-testid="apply-config"
          onClick={() =>
            onApply({
              title: 'Configured',
              type: 'line',
              dataSourceId: null,
              metric: 'revenue',
              aggregation: 'SUM',
              groupBy: '',
              sort: 'DESC',
              limit: 10,
              dateRange: '30d',
              colorScheme: 'primary',
            })
          }
        >
          Apply
        </button>
        <button data-testid="cancel-config" onClick={onCancel}>
          Cancel
        </button>
      </div>
    ) : null,
}));

jest.mock('@/components/dashboard/WidgetCard', () => ({
  WidgetCard: ({ widget, isEditing, onRemove, onConfigure }: any) => (
    <div data-testid={`widget-${widget.id}`}>
      <span>{widget.title}</span>
      {isEditing && (
        <>
          <button data-testid={`remove-${widget.id}`} onClick={onRemove}>
            Remove
          </button>
          <button data-testid={`configure-${widget.id}`} onClick={onConfigure}>
            Configure
          </button>
        </>
      )}
    </div>
  ),
}));

jest.mock('@/components/dashboard/FilterBar', () => ({
  FilterBar: () => <div data-testid="filter-bar">FilterBar</div>,
}));

jest.mock('nuqs', () => ({
  useQueryState: jest.fn(() => ['30d', jest.fn()]),
}));

jest.mock('lucide-react', () => ({
  ArrowLeft: () => <span data-testid="icon-arrow-left" />,
  Eye: () => <span data-testid="icon-eye" />,
  EyeOff: () => <span data-testid="icon-eye-off" />,
  Check: () => <span data-testid="icon-check" />,
  Loader2: ({ className }: any) => <div data-testid="loader" className={className} role="status" />,
}));

const messages = {
  dashboardEdit: {
    back: 'Back',
    saving: 'Saving...',
    saved: 'Saved',
    edit: 'Edit',
    preview: 'Preview',
    noWidgets: 'No widgets yet',
    noWidgetsHint: 'Click or drag a widget from the library to get started',
    dismiss: 'Dismiss',
    autoSaveFailed: 'Auto-save failed',
    addWidgetFailed: 'Failed to add widget',
    removeWidgetFailed: 'Failed to remove widget',
    updateWidgetFailed: 'Failed to update widget',
    saveNameFailed: 'Failed to save name',
  },
};

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

const mockDashboard = {
  id: 'dash-1',
  name: 'Test Dashboard',
  description: 'A test dashboard',
  layout: [],
  widgets: [
    {
      id: 'w-1',
      type: 'line',
      title: 'Revenue Chart',
      config: { metric: 'revenue', aggregation: 'SUM' },
      position: { x: 0, y: 0, w: 6, h: 4 },
      data_source_id: 'ds-1',
      query_sql: 'SELECT * FROM revenue',
    },
  ],
};

let DashboardEditPage: React.ComponentType;

beforeAll(async () => {
  const mod = await import('@/app/[locale]/(app)/dashboards/[id]/edit/page');
  DashboardEditPage = mod.default;
});

describe('DashboardEditPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders loading state initially', () => {
    mockApiClient.mockReturnValue(new Promise(() => {})); // never resolves
    render(<DashboardEditPage />, { wrapper: Wrapper });
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('renders dashboard name after load', async () => {
    mockApiClient.mockResolvedValueOnce({ data: mockDashboard });
    await act(async () => {
      render(<DashboardEditPage />, { wrapper: Wrapper });
    });
    const input = screen.getByDisplayValue('Test Dashboard');
    expect(input).toBeTruthy();
  });

  it('renders widgets after load', async () => {
    mockApiClient.mockResolvedValueOnce({ data: mockDashboard });
    await act(async () => {
      render(<DashboardEditPage />, { wrapper: Wrapper });
    });
    expect(screen.getByText('Revenue Chart')).toBeTruthy();
  });

  it('renders empty state when no widgets', async () => {
    mockApiClient.mockResolvedValueOnce({
      data: { ...mockDashboard, widgets: [] },
    });
    await act(async () => {
      render(<DashboardEditPage />, { wrapper: Wrapper });
    });
    expect(screen.getByText('No widgets yet')).toBeTruthy();
    expect(screen.getByText('Click or drag a widget from the library to get started')).toBeTruthy();
  });

  it('navigates to dashboards on fetch failure', async () => {
    mockApiClient.mockRejectedValueOnce(new Error('Not found'));
    await act(async () => {
      render(<DashboardEditPage />, { wrapper: Wrapper });
    });
    expect(mockPush).toHaveBeenCalledWith('/dashboards');
  });

  it('toggles preview mode', async () => {
    mockApiClient.mockResolvedValueOnce({ data: mockDashboard });
    await act(async () => {
      render(<DashboardEditPage />, { wrapper: Wrapper });
    });

    // Initially shows WidgetLibrary and edit buttons
    expect(screen.getByTestId('widget-library')).toBeTruthy();
    expect(screen.getByText('Preview')).toBeTruthy();

    // Click preview
    fireEvent.click(screen.getByText('Preview'));
    expect(screen.queryByTestId('widget-library')).toBeNull();
    expect(screen.getByText('Edit')).toBeTruthy();

    // Click edit to go back
    fireEvent.click(screen.getByText('Edit'));
    expect(screen.getByTestId('widget-library')).toBeTruthy();
  });

  it('handles add widget', async () => {
    mockApiClient.mockResolvedValueOnce({
      data: { ...mockDashboard, widgets: [] },
    });
    await act(async () => {
      render(<DashboardEditPage />, { wrapper: Wrapper });
    });

    const newWidget = {
      id: 'w-new',
      type: 'line',
      title: 'New Line Widget',
      config: {},
      position: { x: 0, y: 0, w: 6, h: 4 },
      data_source_id: null,
      query_sql: '',
    };
    mockApiClient.mockResolvedValueOnce({ data: newWidget });

    await act(async () => {
      fireEvent.click(screen.getByTestId('add-line'));
    });

    expect(mockApiClient).toHaveBeenCalledWith(
      '/organizations/current/dashboards/dash-1/widgets',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(screen.getByText('New Line Widget')).toBeTruthy();
    // Configurator should open for the new widget
    expect(screen.getByTestId('widget-configurator')).toBeTruthy();
  });

  it('handles add widget error', async () => {
    mockApiClient.mockResolvedValueOnce({
      data: { ...mockDashboard, widgets: [] },
    });
    await act(async () => {
      render(<DashboardEditPage />, { wrapper: Wrapper });
    });

    mockApiClient.mockRejectedValueOnce(new Error('Server error'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('add-line'));
    });

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Server error')).toBeTruthy();
  });

  it('handles remove widget', async () => {
    mockApiClient.mockResolvedValueOnce({ data: mockDashboard });
    await act(async () => {
      render(<DashboardEditPage />, { wrapper: Wrapper });
    });

    mockApiClient.mockResolvedValueOnce({});

    await act(async () => {
      fireEvent.click(screen.getByTestId('remove-w-1'));
    });

    expect(mockApiClient).toHaveBeenCalledWith(
      '/organizations/current/dashboards/dash-1/widgets/w-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(screen.queryByTestId('widget-w-1')).toBeNull();
  });

  it('handles remove widget error', async () => {
    mockApiClient.mockResolvedValueOnce({ data: mockDashboard });
    await act(async () => {
      render(<DashboardEditPage />, { wrapper: Wrapper });
    });

    mockApiClient.mockRejectedValueOnce(new Error('Delete failed'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('remove-w-1'));
    });

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Delete failed')).toBeTruthy();
  });

  it('handles configure widget', async () => {
    mockApiClient.mockResolvedValueOnce({ data: mockDashboard });
    await act(async () => {
      render(<DashboardEditPage />, { wrapper: Wrapper });
    });

    // Open configurator
    fireEvent.click(screen.getByTestId('configure-w-1'));
    expect(screen.getByTestId('widget-configurator')).toBeTruthy();

    // Apply config
    const updatedWidget = {
      ...mockDashboard.widgets[0],
      title: 'Configured',
      config: { metric: 'revenue', aggregation: 'SUM' },
    };
    mockApiClient.mockResolvedValueOnce({ data: updatedWidget });

    await act(async () => {
      fireEvent.click(screen.getByTestId('apply-config'));
    });

    expect(mockApiClient).toHaveBeenCalledWith(
      '/organizations/current/dashboards/dash-1/widgets/w-1',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('handles cancel configurator', async () => {
    mockApiClient.mockResolvedValueOnce({ data: mockDashboard });
    await act(async () => {
      render(<DashboardEditPage />, { wrapper: Wrapper });
    });

    fireEvent.click(screen.getByTestId('configure-w-1'));
    expect(screen.getByTestId('widget-configurator')).toBeTruthy();

    fireEvent.click(screen.getByTestId('cancel-config'));
    expect(screen.queryByTestId('widget-configurator')).toBeNull();
  });

  it('handles dashboard name change and blur save', async () => {
    mockApiClient.mockResolvedValueOnce({ data: mockDashboard });
    await act(async () => {
      render(<DashboardEditPage />, { wrapper: Wrapper });
    });

    const input = screen.getByDisplayValue('Test Dashboard');
    fireEvent.change(input, { target: { value: 'Renamed Dashboard' } });
    expect(screen.getByDisplayValue('Renamed Dashboard')).toBeTruthy();

    mockApiClient.mockResolvedValueOnce({});
    fireEvent.blur(input);

    await waitFor(() => {
      expect(mockApiClient).toHaveBeenCalledWith(
        '/organizations/current/dashboards/dash-1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'Renamed Dashboard' }),
        }),
      );
    });
  });

  it('handles name save error', async () => {
    mockApiClient.mockResolvedValueOnce({ data: mockDashboard });
    await act(async () => {
      render(<DashboardEditPage />, { wrapper: Wrapper });
    });

    const input = screen.getByDisplayValue('Test Dashboard');
    fireEvent.change(input, { target: { value: 'New Name' } });

    mockApiClient.mockRejectedValueOnce(new Error('Save failed'));

    await act(async () => {
      fireEvent.blur(input);
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
  });

  it('dismisses error banner', async () => {
    mockApiClient.mockResolvedValueOnce({
      data: { ...mockDashboard, widgets: [] },
    });
    await act(async () => {
      render(<DashboardEditPage />, { wrapper: Wrapper });
    });

    mockApiClient.mockRejectedValueOnce(new Error('Some error'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('add-line'));
    });

    expect(screen.getByRole('alert')).toBeTruthy();

    fireEvent.click(screen.getByText('Dismiss'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('renders back button that navigates', async () => {
    mockApiClient.mockResolvedValueOnce({ data: mockDashboard });
    await act(async () => {
      render(<DashboardEditPage />, { wrapper: Wrapper });
    });

    fireEvent.click(screen.getByText('Back'));
    expect(mockPush).toHaveBeenCalledWith('/dashboards');
  });

  it('shows filter bar', async () => {
    mockApiClient.mockResolvedValueOnce({ data: mockDashboard });
    await act(async () => {
      render(<DashboardEditPage />, { wrapper: Wrapper });
    });
    expect(screen.getByTestId('filter-bar')).toBeTruthy();
  });

  it('handles apply config error', async () => {
    mockApiClient.mockResolvedValueOnce({ data: mockDashboard });
    await act(async () => {
      render(<DashboardEditPage />, { wrapper: Wrapper });
    });

    fireEvent.click(screen.getByTestId('configure-w-1'));
    mockApiClient.mockRejectedValueOnce(new Error('Update failed'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('apply-config'));
    });

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Update failed')).toBeTruthy();
  });
});
