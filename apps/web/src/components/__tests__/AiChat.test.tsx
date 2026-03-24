import React from 'react';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useParams: () => ({ locale: 'en' }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockApiClient = jest.fn();
jest.mock('@/lib/api-client', () => ({
  apiClient: (...args: unknown[]) => mockApiClient(...args),
}));

// Mock AiMessage sub-component
jest.mock('../ai/AiMessage', () => ({
  __esModule: true,
  AiMessage: ({ message }: { message: { id: string; content: string; role: string } }) => (
    <div data-testid={`message-${message.id}`} data-role={message.role}>
      {message.content}
    </div>
  ),
}));

import { renderWithProviders, screen, fireEvent, waitFor } from '@/test-utils';
import { AiChat } from '../ai/AiChat';

describe('AiChat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock localStorage for getOrgId
    Storage.prototype.getItem = jest.fn(() => JSON.stringify({ state: { currentOrgId: 'org-1' } }));
  });

  it('shows loading then empty chat message', async () => {
    mockApiClient.mockResolvedValueOnce({ data: { messages: [] } });

    renderWithProviders(<AiChat conversationId="conv-1" />);

    await waitFor(() => {
      expect(screen.getByText('Send a message to start the conversation')).toBeInTheDocument();
    });
  });

  it('renders existing messages', async () => {
    const messages = [
      { id: 'msg-1', role: 'user', content: 'Show revenue', created_at: '2026-03-20T10:00:00Z' },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Here is your revenue data',
        created_at: '2026-03-20T10:01:00Z',
      },
    ];
    mockApiClient.mockResolvedValueOnce({ data: { messages } });

    renderWithProviders(<AiChat conversationId="conv-1" />);

    await waitFor(() => {
      expect(screen.getByText('Show revenue')).toBeInTheDocument();
      expect(screen.getByText('Here is your revenue data')).toBeInTheDocument();
    });
  });

  it('sends a message and shows response', async () => {
    mockApiClient.mockResolvedValueOnce({ data: { messages: [] } });

    renderWithProviders(<AiChat conversationId="conv-1" onConversationUpdate={jest.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Send a message to start the conversation')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText('Ask anything about your data...');
    fireEvent.change(textarea, { target: { value: 'What is total revenue?' } });

    mockApiClient.mockResolvedValueOnce({
      data: {
        response: 'Total revenue is 50000 RON',
        sql: 'SELECT SUM(amount) FROM invoices',
        data: null,
        chartType: 'text',
        chartConfig: {},
      },
    });

    const sendButton = screen.getByRole('button', { name: '' });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('What is total revenue?')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Total revenue is 50000 RON')).toBeInTheDocument();
    });
  });

  it('shows rate limit overlay on 429 error', async () => {
    mockApiClient.mockResolvedValueOnce({ data: { messages: [] } });

    renderWithProviders(<AiChat conversationId="conv-1" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ask anything about your data...')).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText('Ask anything about your data...');
    fireEvent.change(textarea, { target: { value: 'test query' } });

    mockApiClient.mockRejectedValueOnce(new Error('AI_RATE_LIMIT: Too many requests'));

    const sendButton = screen.getByRole('button', { name: '' });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('Limita atinsa')).toBeInTheDocument();
    });
  });

  it('disables send button when input is empty', async () => {
    mockApiClient.mockResolvedValueOnce({ data: { messages: [] } });

    renderWithProviders(<AiChat conversationId="conv-1" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ask anything about your data...')).toBeInTheDocument();
    });

    const buttons = screen.getAllByRole('button');
    const sendButton = buttons[buttons.length - 1];
    expect(sendButton).toBeDisabled();
  });
});
