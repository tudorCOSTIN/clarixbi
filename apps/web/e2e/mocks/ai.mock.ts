export const mockConversations = [
  {
    id: 'conv-1',
    title: 'Revenue Analysis',
    message_count: 3,
    updated_at: '2026-03-24T10:00:00Z',
  },
  {
    id: 'conv-2',
    title: null,
    message_count: 1,
    updated_at: '2026-03-23T15:00:00Z',
  },
];

export const mockAiResponse = {
  id: 'msg-1',
  role: 'assistant' as const,
  content:
    'Total revenue for the last 30 days is **47,850 RON**, up 13.7% from the previous period.',
  sql: 'SELECT SUM(amount) FROM invoices WHERE date >= NOW() - INTERVAL 30 DAY',
  chart: {
    type: 'bar',
    data: [
      { label: 'January', value: 42100 },
      { label: 'February', value: 47850 },
    ],
  },
};

export const mockAiResponseNoChart = {
  id: 'msg-2',
  role: 'assistant' as const,
  content: 'There are currently 42 active customers in the system.',
  sql: "SELECT COUNT(*) FROM customers WHERE status = 'active'",
  chart: null as null | { type: string; data: { label: string; value: number }[] },
};
