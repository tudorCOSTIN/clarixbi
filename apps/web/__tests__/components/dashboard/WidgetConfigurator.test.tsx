import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { WidgetConfigurator, WidgetConfig } from '@/components/dashboard/WidgetConfigurator';

// Mock apiClient
jest.mock('@/lib/api-client', () => ({
  apiClient: jest.fn().mockResolvedValue({ data: [] }),
}));

// Mock nuqs
jest.mock('nuqs', () => ({
  useQueryState: jest.fn(() => ['30d', jest.fn()]),
}));

describe('WidgetConfigurator', () => {
  const defaultConfig: WidgetConfig = {
    title: 'Test Widget',
    type: 'line',
    dataSourceId: null,
    metric: '',
    aggregation: 'SUM',
    groupBy: '',
    sort: 'DESC',
    limit: 10,
    dateRange: '30d',
    colorScheme: 'primary',
  };

  it('should not render when closed', () => {
    const { container } = render(
      <WidgetConfigurator
        open={false}
        initialConfig={defaultConfig}
        onApply={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('should render when open', () => {
    const { getByText } = render(
      <WidgetConfigurator
        open={true}
        initialConfig={defaultConfig}
        onApply={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(getByText('Configure Widget')).toBeTruthy();
    expect(getByText('Aplica')).toBeTruthy();
    expect(getByText('Anuleaza')).toBeTruthy();
  });

  it('should show chart type options', () => {
    const { getByText } = render(
      <WidgetConfigurator
        open={true}
        initialConfig={defaultConfig}
        onApply={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(getByText('Line')).toBeTruthy();
    expect(getByText('Bar')).toBeTruthy();
    expect(getByText('Pie')).toBeTruthy();
    expect(getByText('Table')).toBeTruthy();
    expect(getByText('KPI')).toBeTruthy();
  });

  it('should call onCancel when cancel clicked', () => {
    const onCancel = jest.fn();
    const { getByText } = render(
      <WidgetConfigurator
        open={true}
        initialConfig={defaultConfig}
        onApply={jest.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(getByText('Anuleaza'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('should call onApply when apply clicked', () => {
    const onApply = jest.fn();
    const { getByText } = render(
      <WidgetConfigurator
        open={true}
        initialConfig={defaultConfig}
        onApply={onApply}
        onCancel={jest.fn()}
      />,
    );
    fireEvent.click(getByText('Aplica'));
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Test Widget',
        type: 'line',
      }),
    );
  });
});
