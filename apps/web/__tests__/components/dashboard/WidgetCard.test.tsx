/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock next/dynamic to return simple stubs for each chart component
jest.mock('next/dynamic', () => {
  return jest.fn().mockImplementation((_factory: () => Promise<any>) => {
    // Extract component name from the factory by calling it
    const component = function MockDynamic(props: any) {
      return (
        <div data-testid="dynamic-chart" data-props={JSON.stringify(props)}>
          Chart
        </div>
      );
    };
    component.displayName = 'MockDynamic';
    return component;
  });
});

jest.mock('lucide-react', () => ({
  X: () => <span data-testid="icon-x">X</span>,
  Settings: () => <span data-testid="icon-settings">S</span>,
}));

// Import after mocks
import { WidgetCard } from '@/components/dashboard/WidgetCard';

describe('WidgetCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders widget title', () => {
    render(
      <WidgetCard
        widget={{
          id: 'w-1',
          type: 'line',
          title: 'Revenue Over Time',
          config: {},
          data: [],
        }}
      />,
    );
    expect(screen.getByText('Revenue Over Time')).toBeTruthy();
  });

  it('renders fallback title when title is empty', () => {
    render(
      <WidgetCard
        widget={{
          id: 'w-1',
          type: 'line',
          title: '',
          config: {},
          data: [],
        }}
      />,
    );
    expect(screen.getByText('Untitled Widget')).toBeTruthy();
  });

  it('renders chart for line type', () => {
    render(
      <WidgetCard
        widget={{
          id: 'w-1',
          type: 'line',
          title: 'Line Widget',
          config: { metric: 'revenue', groupBy: 'month' },
          data: [{ month: 'Jan', revenue: 100 }],
        }}
      />,
    );
    expect(screen.getByTestId('dynamic-chart')).toBeTruthy();
  });

  it('renders chart for bar type', () => {
    render(
      <WidgetCard
        widget={{
          id: 'w-1',
          type: 'bar',
          title: 'Bar Widget',
          config: { metric: 'sales', horizontal: true },
          data: [{ x: 'A', sales: 50 }],
        }}
      />,
    );
    expect(screen.getByTestId('dynamic-chart')).toBeTruthy();
  });

  it('renders chart for pie type', () => {
    render(
      <WidgetCard
        widget={{
          id: 'w-1',
          type: 'pie',
          title: 'Pie Widget',
          config: { metric: 'share', groupBy: 'category', donut: true },
          data: [{ category: 'A', share: 60 }],
        }}
      />,
    );
    expect(screen.getByTestId('dynamic-chart')).toBeTruthy();
  });

  it('renders chart for table type', () => {
    render(
      <WidgetCard
        widget={{
          id: 'w-1',
          type: 'table',
          title: 'Table Widget',
          config: { pageSize: 5, searchable: true },
          data: [{ name: 'Alice', value: 42 }],
        }}
      />,
    );
    expect(screen.getByTestId('dynamic-chart')).toBeTruthy();
  });

  it('renders KPI type', () => {
    render(
      <WidgetCard
        widget={{
          id: 'w-1',
          type: 'kpi',
          title: 'Total Revenue',
          config: { metric: 'total' },
          data: [{ total: 50000 }, { total: 45000 }],
        }}
      />,
    );
    expect(screen.getByTestId('dynamic-chart')).toBeTruthy();
  });

  it('renders unknown type fallback', () => {
    render(
      <WidgetCard
        widget={{
          id: 'w-1',
          type: 'unknown-type',
          title: 'Unknown Widget',
          config: {},
          data: [],
        }}
      />,
    );
    expect(screen.getByText('Unknown widget type')).toBeTruthy();
  });

  it('does not show edit buttons when not editing', () => {
    render(
      <WidgetCard
        widget={{
          id: 'w-1',
          type: 'line',
          title: 'Widget',
          config: {},
          data: [],
        }}
        isEditing={false}
      />,
    );
    expect(screen.queryByLabelText('Remove widget')).toBeNull();
    expect(screen.queryByLabelText('Configure widget')).toBeNull();
  });

  it('shows edit buttons when editing', () => {
    const onRemove = jest.fn();
    const onConfigure = jest.fn();
    render(
      <WidgetCard
        widget={{
          id: 'w-1',
          type: 'line',
          title: 'Widget',
          config: {},
          data: [],
        }}
        isEditing={true}
        onRemove={onRemove}
        onConfigure={onConfigure}
      />,
    );
    expect(screen.getByLabelText('Remove widget')).toBeTruthy();
    expect(screen.getByLabelText('Configure widget')).toBeTruthy();
  });

  it('calls onRemove when remove button is clicked', () => {
    const onRemove = jest.fn();
    render(
      <WidgetCard
        widget={{
          id: 'w-1',
          type: 'line',
          title: 'Widget',
          config: {},
          data: [],
        }}
        isEditing={true}
        onRemove={onRemove}
        onConfigure={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Remove widget'));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('calls onConfigure when configure button is clicked', () => {
    const onConfigure = jest.fn();
    render(
      <WidgetCard
        widget={{
          id: 'w-1',
          type: 'line',
          title: 'Widget',
          config: {},
          data: [],
        }}
        isEditing={true}
        onRemove={jest.fn()}
        onConfigure={onConfigure}
      />,
    );
    fireEvent.click(screen.getByLabelText('Configure widget'));
    expect(onConfigure).toHaveBeenCalledTimes(1);
  });

  it('uses default height of 250', () => {
    render(
      <WidgetCard
        widget={{
          id: 'w-1',
          type: 'line',
          title: 'Widget',
          config: {},
          data: [{ x: 1, y: 2 }],
        }}
      />,
    );
    // Chart renders with height prop = 250 - 60 = 190
    const chart = screen.getByTestId('dynamic-chart');
    const props = JSON.parse(chart.getAttribute('data-props') || '{}');
    expect(props.height).toBe(190);
  });

  it('respects custom height prop', () => {
    render(
      <WidgetCard
        widget={{
          id: 'w-1',
          type: 'line',
          title: 'Widget',
          config: {},
          data: [{ x: 1, y: 2 }],
        }}
        height={400}
      />,
    );
    const chart = screen.getByTestId('dynamic-chart');
    const props = JSON.parse(chart.getAttribute('data-props') || '{}');
    expect(props.height).toBe(340);
  });

  it('handles empty data gracefully for line type', () => {
    render(
      <WidgetCard
        widget={{
          id: 'w-1',
          type: 'line',
          title: 'Empty Line',
          config: {},
        }}
      />,
    );
    expect(screen.getByTestId('dynamic-chart')).toBeTruthy();
  });

  it('uses colorScheme from config', () => {
    render(
      <WidgetCard
        widget={{
          id: 'w-1',
          type: 'bar',
          title: 'Colored Bar',
          config: { colorScheme: 'warm' },
          data: [{ x: 'A', y: 10 }],
        }}
      />,
    );
    const chart = screen.getByTestId('dynamic-chart');
    const props = JSON.parse(chart.getAttribute('data-props') || '{}');
    expect(props.colorScheme).toBe('warm');
  });
});
