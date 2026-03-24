import React from 'react';

const mockRouter = { push: jest.fn() };

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useParams: () => ({ locale: 'en' }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en/settings',
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

jest.mock('focus-trap-react', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockApiClient = jest.fn();
jest.mock('@/lib/api-client', () => ({
  apiClient: (...args: unknown[]) => mockApiClient(...args),
}));

import { renderWithProviders, screen, fireEvent, waitFor } from '@/test-utils';
import SettingsPage from '../page';

const mockUser = {
  id: 'user-1',
  name: 'John Doe',
  email: 'john@example.com',
  avatar_url: null,
  preferred_language: 'en',
  preferred_timezone: 'Europe/Bucharest',
};

describe('SettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiClient.mockResolvedValueOnce({ data: mockUser });
  });

  it('shows loading spinner then renders settings', async () => {
    renderWithProviders(<SettingsPage />);
    // Initially loading
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('john@example.com')).toBeInTheDocument();
  });

  it('saves profile changes', async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
    });

    const nameInput = screen.getByDisplayValue('John Doe');
    fireEvent.change(nameInput, { target: { value: 'Jane Doe' } });

    mockApiClient.mockResolvedValueOnce({
      data: { ...mockUser, name: 'Jane Doe' },
    });

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockApiClient).toHaveBeenCalledWith(
        '/users/me',
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  it('exports data', async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Export all my data')).toBeInTheDocument();
    });

    mockApiClient.mockResolvedValueOnce({});

    fireEvent.click(screen.getByText('Export all my data'));

    await waitFor(() => {
      expect(mockApiClient).toHaveBeenCalledWith('/users/me/gdpr/export', { method: 'POST' });
    });
  });

  it('opens delete dialog and requires DELETE confirmation', async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Delete account')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Delete account'));

    await waitFor(() => {
      expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    });

    // Confirm button should be disabled until DELETE is typed
    const confirmButton = screen.getByText('Permanently delete account');
    expect(confirmButton).toBeDisabled();

    const input = screen.getByPlaceholderText('DELETE');
    fireEvent.change(input, { target: { value: 'DELETE' } });

    expect(confirmButton).not.toBeDisabled();
  });

  it('cancels delete dialog', async () => {
    renderWithProviders(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Delete account')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Delete account'));

    await waitFor(() => {
      expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByText('Are you sure?')).not.toBeInTheDocument();
    });
  });
});
