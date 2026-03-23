/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// Mock react-grid-layout
jest.mock('react-grid-layout', () => {
  const MockResponsive = ({ children, ...props }: any) => (
    <div data-testid="grid" data-cols={JSON.stringify(props.cols)}>
      {children}
    </div>
  );
  return {
    Responsive: MockResponsive,
    WidthProvider: (Component: any) => Component,
  };
});

jest.mock('react-grid-layout/css/styles.css', () => ({}));
jest.mock('react-resizable/css/styles.css', () => ({}));

// Mock apiClient
const mockApiClient = jest.fn();
jest.mock('@/lib/api-client', () => ({
  apiClient: (...args: any[]) => mockApiClient(...args),
}));

// Mock nuqs
jest.mock('nuqs', () => ({
  useQueryState: jest.fn(() => ['30d', jest.fn()]),
}));

// Mock recharts to avoid canvas issues in tests
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  PieChart: ({ children }: any) => <div>{children}</div>,
  AreaChart: ({ children }: any) => <div>{children}</div>,
  Line: () => null,
  Bar: () => null,
  Pie: () => null,
  Area: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  Brush: () => null,
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useParams: () => ({ id: '00000000-0000-0000-0000-000000000001' }),
  useRouter: () => ({ push: jest.fn() }),
}));

// Mock react-countup
jest.mock('react-countup', () => ({
  __esModule: true,
  default: ({ end }: any) => <span>{end}</span>,
}));

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const mockDashboard = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Test Dashboard',
  description: null,
  layout: [],
  widgets: [
    {
      id: 'w1',
      type: 'line',
      title: 'Revenue',
      config: { colorScheme: 'primary' },
      position: { x: 0, y: 0, w: 6, h: 3 },
      data_source_id: null,
      query_sql: '',
    },
    {
      id: 'w2',
      type: 'kpi',
      title: 'Orders',
      config: { colorScheme: 'warm' },
      position: { x: 6, y: 0, w: 3, h: 2 },
      data_source_id: null,
      query_sql: '',
    },
  ],
};

describe('DashboardGrid (via Edit Page)', () => {
  beforeEach(() => {
    mockApiClient.mockResolvedValue({ data: mockDashboard });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render the grid with widgets after loading', async () => {
    const DashboardEditPage = (await import('@/app/[locale]/(app)/dashboards/[id]/edit/page'))
      .default;
    render(React.createElement(DashboardEditPage));

    await waitFor(() => {
      expect(screen.getByTestId('grid')).toBeTruthy();
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Dashboard')).toBeTruthy();
    });
  });

  it('should render the grid with correct column config', async () => {
    const DashboardEditPage = (await import('@/app/[locale]/(app)/dashboards/[id]/edit/page'))
      .default;
    render(React.createElement(DashboardEditPage));

    await waitFor(() => {
      const grid = screen.getByTestId('grid');
      const cols = JSON.parse(grid.getAttribute('data-cols') || '{}');
      expect(cols.lg).toBe(12);
    });
  });
});
