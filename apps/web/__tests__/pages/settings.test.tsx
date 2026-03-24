/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

const mockApiClient = jest.fn();
const mockPush = jest.fn();

jest.mock('@/lib/api-client', () => ({
  apiClient: (...args: unknown[]) => mockApiClient(...args),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    return <img {...props} alt={props.alt} />; // eslint-disable-line
  },
}));

jest.mock('focus-trap-react', () => {
  return ({ children }: { children: React.ReactNode }) => <>{children}</>;
});

const messages = {
  settings: {
    title: 'Settings',
    profile: 'Profile',
    name: 'Name',
    emailLabel: 'Email',
    preferences: 'Preferences',
    language: 'Language',
    timezone: 'Timezone',
    save: 'Save Changes',
    savedSuccess: 'Changes saved!',
    yourData: 'Your Data',
    dataDescription: 'Download or delete your data.',
    exportData: 'Export Data',
    exportRequested: 'Export requested.',
    exportError: 'Export failed.',
    dangerZone: 'Danger Zone',
    deleteAccount: 'Delete Account',
    deleteConfirmTitle: 'Delete Account',
    deleteConfirmMessage: 'This action cannot be undone.',
    deleteConfirmLabel: 'Type DELETE to confirm',
    deleteConfirmButton: 'Permanently Delete',
    deleteError: 'Delete failed.',
    cancel: 'Cancel',
  },
};

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

let SettingsPage: React.ComponentType;

beforeAll(async () => {
  const mod = await import('@/app/[locale]/(app)/settings/page');
  SettingsPage = mod.default;
});

describe('SettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state', () => {
    // apiClient never resolves, so loading stays true
    mockApiClient.mockReturnValue(new Promise(() => {}));

    render(<SettingsPage />, { wrapper: Wrapper });

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeTruthy();
  });

  it('renders profile section after loading', async () => {
    mockApiClient.mockResolvedValueOnce({
      data: {
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com',
        avatar_url: null,
        preferred_language: 'en',
        preferred_timezone: 'Europe/Bucharest',
      },
    });

    render(<SettingsPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('Profile')).toBeTruthy();
    });

    expect(screen.getByDisplayValue('John Doe')).toBeTruthy();
    expect(screen.getByDisplayValue('john@example.com')).toBeTruthy();
  });

  it('renders preferences section after loading', async () => {
    mockApiClient.mockResolvedValueOnce({
      data: {
        id: 'user-1',
        name: 'Jane Doe',
        email: 'jane@example.com',
        avatar_url: null,
        preferred_language: 'ro',
        preferred_timezone: 'Europe/Bucharest',
      },
    });

    render(<SettingsPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('Preferences')).toBeTruthy();
    });

    expect(screen.getByText('Language')).toBeTruthy();
    expect(screen.getByText('Timezone')).toBeTruthy();
    expect(screen.getByText('Save Changes')).toBeTruthy();
  });

  it('renders danger zone section', async () => {
    mockApiClient.mockResolvedValueOnce({
      data: {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        avatar_url: null,
        preferred_language: 'en',
        preferred_timezone: 'UTC',
      },
    });

    render(<SettingsPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('Danger Zone')).toBeTruthy();
    });

    expect(screen.getByText('Delete Account')).toBeTruthy();
  });
});
