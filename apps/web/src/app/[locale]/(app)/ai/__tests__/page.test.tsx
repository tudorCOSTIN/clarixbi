import React from 'react';

const mockRouter = { push: jest.fn() };

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useParams: () => ({ locale: 'en' }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/ai',
}));

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => {
    const DynamicComponent = (props: { conversationId: string }) => (
      <div data-testid="ai-chat">Chat for {props.conversationId}</div>
    );
    DynamicComponent.displayName = 'DynamicComponent';
    return DynamicComponent;
  },
}));

jest.mock('@/stores/org-store', () => ({
  useOrgStore: () => ({ currentOrgId: 'org-1' }),
}));

const mockApiClient = jest.fn();
jest.mock('@/lib/api-client', () => ({
  apiClient: (...args: unknown[]) => mockApiClient(...args),
}));

import { renderWithProviders, screen, fireEvent, waitFor } from '@/test-utils';
import AiPage from '../page';

const mockConversation = {
  id: 'conv-1',
  title: 'Revenue Analysis',
  message_count: 5,
  updated_at: '2026-03-20T10:00:00Z',
};

describe('AiPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading state then empty conversations', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [] });

    renderWithProviders(<AiPage />);

    await waitFor(() => {
      expect(screen.getByText('No conversations yet')).toBeInTheDocument();
    });
  });

  it('renders conversations list', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockConversation] });

    renderWithProviders(<AiPage />);

    await waitFor(() => {
      expect(screen.getByText('Revenue Analysis')).toBeInTheDocument();
    });
  });

  it('creates new conversation', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [] });

    renderWithProviders(<AiPage />);

    await waitFor(() => {
      expect(screen.getByText('No conversations yet')).toBeInTheDocument();
    });

    const newConv = {
      id: 'conv-new',
      title: null,
      message_count: 0,
      updated_at: '2026-03-24T10:00:00Z',
    };
    mockApiClient.mockResolvedValueOnce({ data: newConv });

    const newButtons = screen.getAllByText('New conversation');
    fireEvent.click(newButtons[0]!);

    await waitFor(() => {
      expect(mockApiClient).toHaveBeenCalledWith('/organizations/org-1/ai/conversations', {
        method: 'POST',
      });
    });
  });

  it('shows welcome state when no conversation selected', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockConversation] });

    renderWithProviders(<AiPage />);

    await waitFor(() => {
      expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    });
    expect(
      screen.getByText(
        "Ask anything about your data. I'll generate SQL queries, execute them, and visualize the results for you.",
      ),
    ).toBeInTheDocument();
  });

  it('selects a conversation', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [mockConversation] });

    renderWithProviders(<AiPage />);

    await waitFor(() => {
      expect(screen.getByText('Revenue Analysis')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Revenue Analysis'));

    await waitFor(() => {
      expect(screen.getByTestId('ai-chat')).toBeInTheDocument();
    });
  });
});
