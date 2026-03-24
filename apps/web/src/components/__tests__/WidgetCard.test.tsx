import React from 'react';

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: () => Promise<{ default: React.ComponentType }>) => {
    const DynamicComponent = (props: Record<string, unknown>) => {
      const [Comp, setComp] = React.useState<React.ComponentType | null>(null);
      React.useEffect(() => {
        loader().then((m) => setComp(() => m.default || m));
      }, []);
      return Comp ? <Comp {...props} /> : <div data-testid="loading-chart" />;
    };
    DynamicComponent.displayName = 'DynamicComponent';
    return DynamicComponent;
  },
}));

jest.mock('../dashboard/LineChart', () => ({
  __esModule: true,
  LineChartWidget: () => <div data-testid="line-chart">LineChart</div>,
  default: () => <div data-testid="line-chart">LineChart</div>,
}));

jest.mock('../dashboard/BarChart', () => ({
  __esModule: true,
  BarChartWidget: () => <div data-testid="bar-chart">BarChart</div>,
  default: () => <div data-testid="bar-chart">BarChart</div>,
}));

jest.mock('../dashboard/PieChart', () => ({
  __esModule: true,
  PieChartWidget: () => <div data-testid="pie-chart">PieChart</div>,
  default: () => <div data-testid="pie-chart">PieChart</div>,
}));

jest.mock('../dashboard/TableWidget', () => ({
  __esModule: true,
  TableWidget: () => <div data-testid="table-widget">TableWidget</div>,
  default: () => <div data-testid="table-widget">TableWidget</div>,
}));

jest.mock('../dashboard/KPICard', () => ({
  __esModule: true,
  KPICard: () => <div data-testid="kpi-card">KPICard</div>,
  default: () => <div data-testid="kpi-card">KPICard</div>,
}));

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WidgetCard } from '../dashboard/WidgetCard';

const baseWidget = {
  id: 'w-1',
  title: 'Revenue Chart',
  config: {},
  data: [
    { x: 'Jan', y: 100 },
    { x: 'Feb', y: 200 },
  ],
};

describe('WidgetCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders widget title', () => {
    render(<WidgetCard widget={{ ...baseWidget, type: 'bar' }} />);
    expect(screen.getByText('Revenue Chart')).toBeInTheDocument();
  });

  it('renders fallback title when title is empty', () => {
    render(<WidgetCard widget={{ ...baseWidget, title: '', type: 'bar' }} />);
    expect(screen.getByText('Untitled Widget')).toBeInTheDocument();
  });

  it('renders line chart for type=line', async () => {
    render(<WidgetCard widget={{ ...baseWidget, type: 'line' }} />);
    await waitFor(() => {
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });

  it('renders bar chart for type=bar', async () => {
    render(<WidgetCard widget={{ ...baseWidget, type: 'bar' }} />);
    await waitFor(() => {
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });
  });

  it('renders pie chart for type=pie', async () => {
    render(<WidgetCard widget={{ ...baseWidget, type: 'pie' }} />);
    await waitFor(() => {
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    });
  });

  it('renders table for type=table', async () => {
    render(<WidgetCard widget={{ ...baseWidget, type: 'table' }} />);
    await waitFor(() => {
      expect(screen.getByTestId('table-widget')).toBeInTheDocument();
    });
  });

  it('renders KPI card for type=kpi', async () => {
    render(<WidgetCard widget={{ ...baseWidget, type: 'kpi' }} />);
    await waitFor(() => {
      expect(screen.getByTestId('kpi-card')).toBeInTheDocument();
    });
  });

  it('renders unknown widget type fallback', () => {
    render(<WidgetCard widget={{ ...baseWidget, type: 'unknown' }} />);
    expect(screen.getByText('Unknown widget type')).toBeInTheDocument();
  });

  it('shows edit buttons when isEditing=true', () => {
    const onRemove = jest.fn();
    const onConfigure = jest.fn();
    render(
      <WidgetCard
        widget={{ ...baseWidget, type: 'bar' }}
        isEditing
        onRemove={onRemove}
        onConfigure={onConfigure}
      />,
    );

    expect(screen.getByLabelText('Configure widget')).toBeInTheDocument();
    expect(screen.getByLabelText('Remove widget')).toBeInTheDocument();
  });

  it('calls onRemove when remove button clicked', () => {
    const onRemove = jest.fn();
    render(<WidgetCard widget={{ ...baseWidget, type: 'bar' }} isEditing onRemove={onRemove} />);
    fireEvent.click(screen.getByLabelText('Remove widget'));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('calls onConfigure when configure button clicked', () => {
    const onConfigure = jest.fn();
    render(
      <WidgetCard widget={{ ...baseWidget, type: 'bar' }} isEditing onConfigure={onConfigure} />,
    );
    fireEvent.click(screen.getByLabelText('Configure widget'));
    expect(onConfigure).toHaveBeenCalledTimes(1);
  });

  it('hides edit buttons when isEditing=false', () => {
    render(<WidgetCard widget={{ ...baseWidget, type: 'bar' }} />);
    expect(screen.queryByLabelText('Configure widget')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Remove widget')).not.toBeInTheDocument();
  });
});
