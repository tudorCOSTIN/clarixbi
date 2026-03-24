import React from 'react';

// Mock nuqs useQueryState
const mockSetDateRange = jest.fn();
const mockSetSource = jest.fn();
let currentDateRange = '30d';
let currentSource = 'all';

jest.mock('nuqs', () => ({
  useQueryState: (key: string) => {
    if (key === 'dateRange') return [currentDateRange, mockSetDateRange];
    if (key === 'source') return [currentSource, mockSetSource];
    return ['', jest.fn()];
  },
}));

import { render, screen, fireEvent } from '@testing-library/react';
import { FilterBar } from '../dashboard/FilterBar';

describe('FilterBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentDateRange = '30d';
    currentSource = 'all';
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders date range buttons', () => {
    render(<FilterBar />);
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Last 7d')).toBeInTheDocument();
    expect(screen.getByText('Last 30d')).toBeInTheDocument();
    expect(screen.getByText('Last 90d')).toBeInTheDocument();
    expect(screen.getByText('Last 1y')).toBeInTheDocument();
  });

  it('calls onFiltersChange when date preset clicked', () => {
    const onFiltersChange = jest.fn();
    render(<FilterBar onFiltersChange={onFiltersChange} />);

    fireEvent.click(screen.getByText('Last 7d'));

    expect(mockSetDateRange).toHaveBeenCalledWith('7d');
    expect(onFiltersChange).toHaveBeenCalledWith({ dateRange: '7d', source: 'all' });
  });

  it('renders data source select with options', () => {
    const dataSources = [
      { id: 'ds-1', name: 'SmartBill' },
      { id: 'ds-2', name: 'WooCommerce' },
    ];
    render(<FilterBar dataSources={dataSources} />);

    expect(screen.getByText('All Sources')).toBeInTheDocument();
    expect(screen.getByText('SmartBill')).toBeInTheDocument();
    expect(screen.getByText('WooCommerce')).toBeInTheDocument();
  });

  it('calls onFiltersChange when source changed', () => {
    const onFiltersChange = jest.fn();
    const dataSources = [{ id: 'ds-1', name: 'SmartBill' }];
    render(<FilterBar dataSources={dataSources} onFiltersChange={onFiltersChange} />);

    fireEvent.change(screen.getByLabelText('Filter by data source'), {
      target: { value: 'ds-1' },
    });

    expect(mockSetSource).toHaveBeenCalledWith('ds-1');
    expect(onFiltersChange).toHaveBeenCalledWith({ dateRange: '30d', source: 'ds-1' });
  });

  it('copies URL to clipboard on Copy Link click', () => {
    render(<FilterBar />);
    fireEvent.click(screen.getByText('Copy Link'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(window.location.href);
  });
});
