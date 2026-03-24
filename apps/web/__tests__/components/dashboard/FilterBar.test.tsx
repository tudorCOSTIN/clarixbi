/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

const mockSetDateRange = jest.fn();
const mockSetSource = jest.fn();

jest.mock('nuqs', () => ({
  useQueryState: jest.fn((key: string) => {
    if (key === 'dateRange') return ['30d', mockSetDateRange];
    if (key === 'source') return ['all', mockSetSource];
    return ['', jest.fn()];
  }),
}));

jest.mock('lucide-react', () => ({
  Calendar: () => <span data-testid="icon-calendar">C</span>,
  Database: () => <span data-testid="icon-database">D</span>,
  Link2: () => <span data-testid="icon-link">L</span>,
}));

import { FilterBar } from '@/components/dashboard/FilterBar';

describe('FilterBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders date range preset buttons', () => {
    render(<FilterBar />);
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Last 7d')).toBeTruthy();
    expect(screen.getByText('Last 30d')).toBeTruthy();
    expect(screen.getByText('Last 90d')).toBeTruthy();
    expect(screen.getByText('Last 1y')).toBeTruthy();
  });

  it('renders source select with default All Sources', () => {
    render(<FilterBar />);
    const select = screen.getByLabelText('Filter by data source');
    expect(select).toBeTruthy();
    expect((select as HTMLSelectElement).value).toBe('all');
  });

  it('renders data source options when provided', () => {
    render(
      <FilterBar
        dataSources={[
          { id: 'ds-1', name: 'PostgreSQL' },
          { id: 'ds-2', name: 'MySQL' },
        ]}
      />,
    );
    expect(screen.getByText('PostgreSQL')).toBeTruthy();
    expect(screen.getByText('MySQL')).toBeTruthy();
  });

  it('calls setDateRange when date preset is clicked', () => {
    const onFiltersChange = jest.fn();
    render(<FilterBar onFiltersChange={onFiltersChange} />);

    fireEvent.click(screen.getByText('Last 7d'));
    expect(mockSetDateRange).toHaveBeenCalledWith('7d');
    expect(onFiltersChange).toHaveBeenCalledWith({ dateRange: '7d', source: 'all' });
  });

  it('calls setSource when source select is changed', () => {
    const onFiltersChange = jest.fn();
    render(
      <FilterBar
        dataSources={[{ id: 'ds-1', name: 'PostgreSQL' }]}
        onFiltersChange={onFiltersChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Filter by data source'), {
      target: { value: 'ds-1' },
    });
    expect(mockSetSource).toHaveBeenCalledWith('ds-1');
    expect(onFiltersChange).toHaveBeenCalledWith({ dateRange: '30d', source: 'ds-1' });
  });

  it('renders Copy Link button', () => {
    render(<FilterBar />);
    expect(screen.getByText('Copy Link')).toBeTruthy();
  });

  it('copies URL to clipboard when Copy Link is clicked', () => {
    render(<FilterBar />);
    fireEvent.click(screen.getByText('Copy Link'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(window.location.href);
  });

  it('renders period and source labels', () => {
    render(<FilterBar />);
    expect(screen.getByText('Period:')).toBeTruthy();
    expect(screen.getByText('Source:')).toBeTruthy();
  });

  it('highlights active date preset', () => {
    render(<FilterBar />);
    const activeButton = screen.getByText('Last 30d');
    // The active one should have the primary bg class
    expect(activeButton.className).toContain('bg-primary-blue');
    const inactiveButton = screen.getByText('Last 7d');
    expect(inactiveButton.className).not.toContain('bg-primary-blue');
  });

  it('works without onFiltersChange callback', () => {
    render(<FilterBar />);
    // Should not throw
    fireEvent.click(screen.getByText('Today'));
    expect(mockSetDateRange).toHaveBeenCalledWith('today');
  });
});
