import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { WidgetConfigurator, WidgetConfig } from '@/components/dashboard/WidgetConfigurator';

// Mock focus-trap-react to avoid jsdom tabbable node issues
jest.mock('focus-trap-react', () => {
  return ({ children }: { children: React.ReactNode }) => <>{children}</>;
});

// Mock apiClient
jest.mock('@/lib/api-client', () => ({
  apiClient: jest.fn().mockResolvedValue({ data: [] }),
}));

// Mock nuqs
jest.mock('nuqs', () => ({
  useQueryState: jest.fn(() => ['30d', jest.fn()]),
}));

const messages = {
  widget: {
    configure: 'Configure Widget',
    widgetTitle: 'Widget Title',
    chartType: 'Chart Type',
    dataSource: 'Data Source',
    selectSource: 'Select source...',
    metric: 'Metric / Column',
    loadingColumns: 'Loading...',
    selectColumn: 'Select column...',
    aggregation: 'Aggregation',
    groupBy: 'Group By',
    groupByNone: 'None',
    sort: 'Sort',
    limit: 'Limit',
    dateRange: 'Date Range',
    colorScheme: 'Color Scheme',
    cancel: 'Cancel',
    apply: 'Apply',
  },
  a11y: {
    close: 'Close',
    copyLink: 'Copy link',
    deleteItem: 'Delete',
    editItem: 'Edit',
    cloneItem: 'Clone',
    dismissNotification: 'Dismiss',
  },
};

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

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
      { wrapper: Wrapper },
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
      { wrapper: Wrapper },
    );
    expect(getByText('Configure Widget')).toBeTruthy();
    expect(getByText('Apply')).toBeTruthy();
    expect(getByText('Cancel')).toBeTruthy();
  });

  it('should show chart type options', () => {
    const { getByText } = render(
      <WidgetConfigurator
        open={true}
        initialConfig={defaultConfig}
        onApply={jest.fn()}
        onCancel={jest.fn()}
      />,
      { wrapper: Wrapper },
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
      { wrapper: Wrapper },
    );
    fireEvent.click(getByText('Cancel'));
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
      { wrapper: Wrapper },
    );
    fireEvent.click(getByText('Apply'));
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Test Widget',
        type: 'line',
      }),
    );
  });
});
