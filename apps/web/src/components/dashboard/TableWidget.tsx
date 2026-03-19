'use client';

import { useState, useMemo } from 'react';
import { ArrowUpDown, Download, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface TableWidgetProps {
  data: Record<string, unknown>[];
  columns?: string[];
  pageSize?: number;
  searchable?: boolean;
  height?: number;
}

export function TableWidget({
  data,
  columns: columnsProp,
  pageSize = 10,
  searchable = true,
  height = 300,
}: TableWidgetProps) {
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');
  const [colWidths, setColWidths] = useState<Record<string, number>>({});

  const columns = useMemo(() => {
    if (columnsProp && columnsProp.length > 0) return columnsProp;
    if (data.length > 0 && data[0]) return Object.keys(data[0]);
    return [];
  }, [columnsProp, data]);

  const filtered = useMemo(() => {
    if (!search) return data;
    const lower = search.toLowerCase();
    return data.filter((row) =>
      columns.some((col) =>
        String(row[col] ?? '')
          .toLowerCase()
          .includes(lower),
      ),
    );
  }, [data, search, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const pageData = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  const exportCsv = () => {
    const header = columns.join(',');
    const rows = sorted.map((row) =>
      columns.map((c) => `"${String(row[c] ?? '').replace(/"/g, '""')}"`).join(','),
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleColResize = (col: string, delta: number) => {
    setColWidths((prev) => ({
      ...prev,
      [col]: Math.max(60, (prev[col] || 120) + delta),
    }));
  };

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-400" style={{ height }}>
        No data available
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height }}>
      <div className="flex items-center gap-2 mb-2 px-1">
        {searchable && (
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              className="pl-9 h-9"
            />
          </div>
        )}
        <Button variant="outline" size="sm" onClick={exportCsv} className="ml-auto">
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
      </div>
      <div className="flex-1 overflow-auto border rounded-md">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 text-left font-medium text-gray-600 cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
                  style={{ width: colWidths[col] || 'auto', minWidth: 60 }}
                  onClick={() => handleSort(col)}
                >
                  <span className="flex items-center gap-1">
                    {col}
                    <ArrowUpDown className="h-3 w-3 text-gray-400" />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row, i) => (
              <tr key={i} className="border-t hover:bg-gray-50">
                {columns.map((col) => (
                  <td key={col} className="px-3 py-2 whitespace-nowrap truncate max-w-[200px]">
                    {String(row[col] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-1 pt-2 text-xs text-gray-500">
        <span>{sorted.length} rows</span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Prev
          </Button>
          <span>
            {page + 1} / {totalPages || 1}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
