/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

const mockToggle = jest.fn();
const mockTestAlert = jest.fn();
const mockRemove = jest.fn();
const mockRefetch = jest.fn();
const mockCreate = jest.fn();
const mockGetTriggers = jest.fn();
const mockUseAlerts = jest.fn();
const mockOn = jest.fn().mockReturnValue(jest.fn());

jest.mock('@/hooks/useAlerts', () => ({
  useAlerts: () => mockUseAlerts(),
}));

jest.mock('@/stores/org-store', () => ({
  useOrgStore: jest.fn(() => ({ currentOrgId: 'org-1' })),
}));

jest.mock('@/hooks/useWebSocket', () => ({
  useSocketEvent: jest.fn(() => ({ on: mockOn })),
}));

jest.mock('focus-trap-react', () => {
  return ({ children }: { children: React.ReactNode }) => <>{children}</>;
});

jest.mock('@/lib/api-client', () => ({
  apiClient: jest.fn().mockResolvedValue({ data: [] }),
}));

jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

jest.mock('lucide-react', () => ({
  Bell: () => <span data-testid="icon-bell">B</span>,
  Plus: () => <span data-testid="icon-plus">+</span>,
  Play: () => <span data-testid="icon-play">P</span>,
  Pause: () => <span data-testid="icon-pause">Pa</span>,
  TestTube: () => <span data-testid="icon-test">T</span>,
  History: () => <span data-testid="icon-history">H</span>,
  Trash2: () => <span data-testid="icon-trash">X</span>,
  Loader2: ({ className }: any) => <div data-testid="loader" className={className} role="status" />,
  X: () => <span data-testid="icon-x">X</span>,
  AlertTriangle: () => <span data-testid="icon-alert">!</span>,
  CheckCircle2: () => <span data-testid="icon-check">V</span>,
  ArrowUpRight: () => <span data-testid="icon-arrow">A</span>,
}));

const messages = {
  alerts: {
    title: 'Alerts',
    subtitle: 'Monitor your metrics and get notified when thresholds are crossed.',
    create: 'Create Alert',
    empty: 'No alerts yet',
    emptySubtitle: 'Create your first alert to start monitoring.',
    deleteConfirm: 'Are you sure?',
    active: 'Active',
    paused: 'Paused',
    pause: 'Pause',
    activate: 'Activate',
    testDryRun: 'Test (dry run)',
    triggerHistory: 'Trigger History',
    delete: 'Delete',
    limitReached: 'Alert limit reached. Upgrade your plan.',
    activeCount: '{count} / {limit} active',
    upgrade: 'Upgrade',
    dismiss: 'Dismiss',
    table: {
      name: 'Name',
      condition: 'Condition',
      frequency: 'Frequency',
      status: 'Status',
      actions: 'Actions',
    },
    frequencies: {
      hourly: 'Hourly',
      daily: 'Daily',
      realtime: 'Real-time',
    },
    testResult: {
      wouldTrigger: 'Alert would trigger!',
      wouldNotTrigger: 'Alert would not trigger.',
      currentValue: 'Current',
      threshold: 'Threshold',
    },
    wizard: {
      title: 'Create Alert',
      dataSource: 'Data Source',
      selectSource: 'Select a data source',
      metricQuery: 'Metric Query',
      operator: 'Operator',
      thresholdValue: 'Threshold Value',
      checkFrequency: 'Check Frequency',
      alertName: 'Alert Name',
      alertNamePlaceholder: 'My alert',
      back: 'Back',
      cancel: 'Cancel',
      next: 'Next',
      save: 'Save',
      saveError: 'Save failed',
      operators: {
        gt: 'Greater than',
        lt: 'Less than',
        eq: 'Equal to',
        gte: 'Greater or equal',
        lte: 'Less or equal',
        change_pct: 'Percent change',
      },
      frequencyOptions: {
        realtime: 'Real-time',
        hourly: 'Hourly',
        daily: 'Daily',
      },
    },
    history: {
      title: 'Trigger History',
      empty: 'No triggers yet',
      value: 'Value',
      threshold: 'Threshold',
    },
  },
};

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

const mockAlerts = [
  {
    id: 'alert-1',
    name: 'Revenue Alert',
    metric_query: 'SELECT SUM(amount) FROM invoices WHERE status = paid',
    condition_operator: 'gt',
    threshold_value: 10000,
    check_frequency: 'hourly',
    is_active: true,
    data_source_id: 'ds-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'alert-2',
    name: 'Error Rate',
    metric_query: 'SELECT COUNT(*) FROM errors WHERE timestamp > now() - interval 1 hour',
    condition_operator: 'gte',
    threshold_value: 100,
    check_frequency: 'daily',
    is_active: false,
    data_source_id: 'ds-2',
    created_at: '2026-01-02T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  },
];

let AlertsPage: React.ComponentType;

beforeAll(async () => {
  const mod = await import('@/app/[locale]/(app)/alerts/page');
  AlertsPage = mod.default;
});

describe('AlertsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset confirm mock
    window.confirm = jest.fn(() => true);
    window.alert = jest.fn();
  });

  it('renders loading state', () => {
    mockUseAlerts.mockReturnValue({
      data: [],
      loading: true,
      refetch: mockRefetch,
      toggle: mockToggle,
      test: mockTestAlert,
      remove: mockRemove,
      create: mockCreate,
      getTriggers: mockGetTriggers,
    });

    render(<AlertsPage />, { wrapper: Wrapper });
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('renders empty state when no alerts', () => {
    mockUseAlerts.mockReturnValue({
      data: [],
      loading: false,
      refetch: mockRefetch,
      toggle: mockToggle,
      test: mockTestAlert,
      remove: mockRemove,
      create: mockCreate,
      getTriggers: mockGetTriggers,
    });

    render(<AlertsPage />, { wrapper: Wrapper });
    expect(screen.getByText('No alerts yet')).toBeTruthy();
    expect(screen.getByText('Create your first alert to start monitoring.')).toBeTruthy();
  });

  it('renders page title and subtitle', () => {
    mockUseAlerts.mockReturnValue({
      data: [],
      loading: false,
      refetch: mockRefetch,
      toggle: mockToggle,
      test: mockTestAlert,
      remove: mockRemove,
      create: mockCreate,
      getTriggers: mockGetTriggers,
    });

    render(<AlertsPage />, { wrapper: Wrapper });
    expect(screen.getByText('Alerts')).toBeTruthy();
    expect(
      screen.getByText('Monitor your metrics and get notified when thresholds are crossed.'),
    ).toBeTruthy();
  });

  it('renders create button', () => {
    mockUseAlerts.mockReturnValue({
      data: [],
      loading: false,
      refetch: mockRefetch,
      toggle: mockToggle,
      test: mockTestAlert,
      remove: mockRemove,
      create: mockCreate,
      getTriggers: mockGetTriggers,
    });

    render(<AlertsPage />, { wrapper: Wrapper });
    const createButtons = screen.getAllByText('Create Alert');
    expect(createButtons.length).toBeGreaterThan(0);
  });

  it('renders alert list with table', () => {
    mockUseAlerts.mockReturnValue({
      data: mockAlerts,
      loading: false,
      refetch: mockRefetch,
      toggle: mockToggle,
      test: mockTestAlert,
      remove: mockRemove,
      create: mockCreate,
      getTriggers: mockGetTriggers,
    });

    render(<AlertsPage />, { wrapper: Wrapper });
    expect(screen.getByText('Revenue Alert')).toBeTruthy();
    expect(screen.getByText('Error Rate')).toBeTruthy();
    // Table headers
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Condition')).toBeTruthy();
    expect(screen.getByText('Frequency')).toBeTruthy();
    expect(screen.getByText('Status')).toBeTruthy();
    expect(screen.getByText('Actions')).toBeTruthy();
  });

  it('displays active and paused badges', () => {
    mockUseAlerts.mockReturnValue({
      data: mockAlerts,
      loading: false,
      refetch: mockRefetch,
      toggle: mockToggle,
      test: mockTestAlert,
      remove: mockRemove,
      create: mockCreate,
      getTriggers: mockGetTriggers,
    });

    render(<AlertsPage />, { wrapper: Wrapper });
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('Paused')).toBeTruthy();
  });

  it('displays condition operators', () => {
    mockUseAlerts.mockReturnValue({
      data: mockAlerts,
      loading: false,
      refetch: mockRefetch,
      toggle: mockToggle,
      test: mockTestAlert,
      remove: mockRemove,
      create: mockCreate,
      getTriggers: mockGetTriggers,
    });

    render(<AlertsPage />, { wrapper: Wrapper });
    // > 10000 and >= 100
    expect(screen.getByText(/> 10000/)).toBeTruthy();
    expect(screen.getByText(/>= 100/)).toBeTruthy();
  });

  it('calls toggle when pause/play button clicked', async () => {
    mockToggle.mockResolvedValue(undefined);
    mockUseAlerts.mockReturnValue({
      data: mockAlerts,
      loading: false,
      refetch: mockRefetch,
      toggle: mockToggle,
      test: mockTestAlert,
      remove: mockRemove,
      create: mockCreate,
      getTriggers: mockGetTriggers,
    });

    render(<AlertsPage />, { wrapper: Wrapper });

    // Click pause on the active alert
    const pauseButton = screen.getByLabelText('Pause');
    await act(async () => {
      fireEvent.click(pauseButton);
    });
    expect(mockToggle).toHaveBeenCalledWith('alert-1', false);
  });

  it('handles toggle limit reached error', async () => {
    mockToggle.mockRejectedValueOnce(new Error('ALERT_LIMIT_REACHED'));
    mockUseAlerts.mockReturnValue({
      data: mockAlerts,
      loading: false,
      refetch: mockRefetch,
      toggle: mockToggle,
      test: mockTestAlert,
      remove: mockRemove,
      create: mockCreate,
      getTriggers: mockGetTriggers,
    });

    render(<AlertsPage />, { wrapper: Wrapper });

    const activateButton = screen.getByLabelText('Activate');
    await act(async () => {
      fireEvent.click(activateButton);
    });
    expect(window.alert).toHaveBeenCalledWith('Alert limit reached. Upgrade your plan.');
  });

  it('calls test when test button clicked', async () => {
    mockTestAlert.mockResolvedValue({
      wouldTrigger: true,
      currentValue: 15000,
      threshold: 10000,
    });
    mockUseAlerts.mockReturnValue({
      data: mockAlerts,
      loading: false,
      refetch: mockRefetch,
      toggle: mockToggle,
      test: mockTestAlert,
      remove: mockRemove,
      create: mockCreate,
      getTriggers: mockGetTriggers,
    });

    render(<AlertsPage />, { wrapper: Wrapper });

    const testButtons = screen.getAllByLabelText('Test (dry run)');
    await act(async () => {
      fireEvent.click(testButtons[0]!);
    });

    expect(mockTestAlert).toHaveBeenCalledWith('alert-1');
    // Test result toast should appear
    await waitFor(() => {
      expect(screen.getByText('Alert would trigger!')).toBeTruthy();
    });
  });

  it('shows test result that would not trigger', async () => {
    mockTestAlert.mockResolvedValue({
      wouldTrigger: false,
      currentValue: 5000,
      threshold: 10000,
    });
    mockUseAlerts.mockReturnValue({
      data: mockAlerts,
      loading: false,
      refetch: mockRefetch,
      toggle: mockToggle,
      test: mockTestAlert,
      remove: mockRemove,
      create: mockCreate,
      getTriggers: mockGetTriggers,
    });

    render(<AlertsPage />, { wrapper: Wrapper });

    const testButtons = screen.getAllByLabelText('Test (dry run)');
    await act(async () => {
      fireEvent.click(testButtons[0]!);
    });

    await waitFor(() => {
      expect(screen.getByText('Alert would not trigger.')).toBeTruthy();
    });
  });

  it('dismisses test result toast', async () => {
    mockTestAlert.mockResolvedValue({
      wouldTrigger: true,
      currentValue: 15000,
      threshold: 10000,
    });
    mockUseAlerts.mockReturnValue({
      data: mockAlerts,
      loading: false,
      refetch: mockRefetch,
      toggle: mockToggle,
      test: mockTestAlert,
      remove: mockRemove,
      create: mockCreate,
      getTriggers: mockGetTriggers,
    });

    render(<AlertsPage />, { wrapper: Wrapper });

    const testButtons = screen.getAllByLabelText('Test (dry run)');
    await act(async () => {
      fireEvent.click(testButtons[0]!);
    });

    await waitFor(() => {
      expect(screen.getByText('Alert would trigger!')).toBeTruthy();
    });

    // Dismiss the toast
    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(screen.queryByText('Alert would trigger!')).toBeNull();
  });

  it('calls remove when delete button clicked and confirmed', async () => {
    mockRemove.mockResolvedValue(undefined);
    mockUseAlerts.mockReturnValue({
      data: mockAlerts,
      loading: false,
      refetch: mockRefetch,
      toggle: mockToggle,
      test: mockTestAlert,
      remove: mockRemove,
      create: mockCreate,
      getTriggers: mockGetTriggers,
    });

    render(<AlertsPage />, { wrapper: Wrapper });

    const deleteButtons = screen.getAllByLabelText('Delete');
    await act(async () => {
      fireEvent.click(deleteButtons[0]!);
    });

    expect(window.confirm).toHaveBeenCalledWith('Are you sure?');
    expect(mockRemove).toHaveBeenCalledWith('alert-1');
  });

  it('does not call remove when delete is cancelled', async () => {
    (window.confirm as jest.Mock).mockReturnValue(false);
    mockUseAlerts.mockReturnValue({
      data: mockAlerts,
      loading: false,
      refetch: mockRefetch,
      toggle: mockToggle,
      test: mockTestAlert,
      remove: mockRemove,
      create: mockCreate,
      getTriggers: mockGetTriggers,
    });

    render(<AlertsPage />, { wrapper: Wrapper });

    const deleteButtons = screen.getAllByLabelText('Delete');
    await act(async () => {
      fireEvent.click(deleteButtons[0]!);
    });

    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('opens create wizard when create button is clicked', () => {
    mockUseAlerts.mockReturnValue({
      data: [],
      loading: false,
      refetch: mockRefetch,
      toggle: mockToggle,
      test: mockTestAlert,
      remove: mockRemove,
      create: mockCreate,
      getTriggers: mockGetTriggers,
    });

    render(<AlertsPage />, { wrapper: Wrapper });

    const createButtons = screen.getAllByText('Create Alert');
    fireEvent.click(createButtons[0]!);

    // Wizard should be open
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('opens history modal when history button is clicked', () => {
    mockGetTriggers.mockResolvedValue([]);
    mockUseAlerts.mockReturnValue({
      data: mockAlerts,
      loading: false,
      refetch: mockRefetch,
      toggle: mockToggle,
      test: mockTestAlert,
      remove: mockRemove,
      create: mockCreate,
      getTriggers: mockGetTriggers,
    });

    render(<AlertsPage />, { wrapper: Wrapper });

    const historyButtons = screen.getAllByLabelText('Trigger History');
    fireEvent.click(historyButtons[0]!);

    expect(screen.getByText('Trigger History')).toBeTruthy();
  });

  it('displays alert limit count', () => {
    mockUseAlerts.mockReturnValue({
      data: mockAlerts,
      loading: false,
      refetch: mockRefetch,
      toggle: mockToggle,
      test: mockTestAlert,
      remove: mockRemove,
      create: mockCreate,
      getTriggers: mockGetTriggers,
    });

    render(<AlertsPage />, { wrapper: Wrapper });
    // activeCount: '{count} / {limit} active' with count=1 (only alert-1 is active), limit=3
    expect(screen.getByText(/1 \/ 3 active/)).toBeTruthy();
    expect(screen.getByText('Upgrade')).toBeTruthy();
  });

  it('displays frequency in table', () => {
    mockUseAlerts.mockReturnValue({
      data: mockAlerts,
      loading: false,
      refetch: mockRefetch,
      toggle: mockToggle,
      test: mockTestAlert,
      remove: mockRemove,
      create: mockCreate,
      getTriggers: mockGetTriggers,
    });

    render(<AlertsPage />, { wrapper: Wrapper });
    expect(screen.getByText('Hourly')).toBeTruthy();
    expect(screen.getByText('Daily')).toBeTruthy();
  });
});
