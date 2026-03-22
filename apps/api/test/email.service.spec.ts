import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmailService } from '../src/modules/email/email.service';
import { User } from '../src/modules/users/entities/user.entity';

// ---------------------------------------------------------------------------
// Mock Resend SDK
// ---------------------------------------------------------------------------

const mockSend = jest.fn().mockResolvedValue({ id: 'email_123' });

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_ID = '00000000-0000-4000-a000-000000000001';

function makeUser(overrides: Partial<User> = {}): Partial<User> {
  return {
    id: USER_ID,
    email: 'user@clarixbi.com',
    name: 'Test User',
    notifications_enabled: true,
    is_active: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('EmailService', () => {
  let service: EmailService;
  let userRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    mockSend.mockClear();
    userRepo = { findOne: jest.fn().mockResolvedValue(makeUser()) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const map: Record<string, string> = {
                RESEND_API_KEY: 'test_api_key',
                NEXT_PUBLIC_APP_URL: 'https://app.clarixbi.com',
              };
              return map[key] ?? '';
            }),
          },
        },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  // -----------------------------------------------------------------------
  // sendTeamInvite
  // -----------------------------------------------------------------------

  test('sendTeamInvite → calls resend.emails.send cu parametri corecti', async () => {
    await service.sendTeamInvite(
      'invitee@company.com',
      'Acme Corp',
      'John Doe',
      'https://app.clarixbi.com/invites/abc123',
    );

    expect(mockSend).toHaveBeenCalledTimes(1);

    const call = mockSend.mock.calls[0][0];
    expect(call.to).toBe('invitee@company.com');
    expect(call.from).toContain('ClarixBI');
    expect(call.subject).toContain('Acme Corp');
    expect(call.html).toContain('https://app.clarixbi.com/invites/abc123');
    expect(call.html).toContain('Gestioneaza preferintele de notificare');
  });

  // -----------------------------------------------------------------------
  // sendTrialReminder
  // -----------------------------------------------------------------------

  test('sendTrialReminder → HTML contine numarul corect de zile ramase', async () => {
    await service.sendTrialReminder('user@clarixbi.com', 3);

    expect(mockSend).toHaveBeenCalledTimes(1);

    const call = mockSend.mock.calls[0][0];
    expect(call.subject).toContain('3 zile');
    expect(call.html).toContain('3 zile');
  });

  // -----------------------------------------------------------------------
  // sendAlertTriggered
  // -----------------------------------------------------------------------

  test('sendAlertTriggered → HTML contine alert name si value', async () => {
    await service.sendAlertTriggered('user@clarixbi.com', 'Revenue Drop', -15, 1000);

    expect(mockSend).toHaveBeenCalledTimes(1);

    const call = mockSend.mock.calls[0][0];
    expect(call.subject).toContain('Revenue Drop');
    expect(call.html).toContain('Revenue Drop');
    expect(call.html).toContain('-15');
    expect(call.html).toContain('1000');
  });

  // -----------------------------------------------------------------------
  // RESEND_API_KEY missing
  // -----------------------------------------------------------------------

  test('RESEND_API_KEY missing → skip send, log warning, nu crash', async () => {
    // Create a service instance without API key
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'NEXT_PUBLIC_APP_URL') return 'https://app.clarixbi.com';
              return undefined; // No RESEND_API_KEY
            }),
          },
        },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    const serviceNoKey = module.get<EmailService>(EmailService);
    const loggerSpy = jest.spyOn((serviceNoKey as never)['logger'], 'warn');

    await serviceNoKey.sendTeamInvite('test@test.com', 'Org', 'Admin', 'http://link');

    expect(mockSend).not.toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('RESEND_API_KEY not set'));
  });

  // -----------------------------------------------------------------------
  // Notification preferences
  // -----------------------------------------------------------------------

  test('notifications disabled → skip send pentru non-critical', async () => {
    userRepo.findOne.mockResolvedValue(makeUser({ notifications_enabled: false }));
    const loggerSpy = jest.spyOn((service as never)['logger'], 'warn');

    await service.sendTeamInvite(
      'invitee@company.com',
      'Acme Corp',
      'John Doe',
      'http://link',
      USER_ID,
    );

    expect(mockSend).not.toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining('Email skipped: notifications disabled'),
    );
  });

  test('trial expiry → sent EVEN IF notifications disabled', async () => {
    userRepo.findOne.mockResolvedValue(makeUser({ notifications_enabled: false }));

    // sendTrialExpired is critical — no userId check, always sends
    await service.sendTrialExpired('user@clarixbi.com');

    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // GDPR footer
  // -----------------------------------------------------------------------

  test('all emails contain GDPR footer', async () => {
    await service.sendTrialExpired('user@clarixbi.com');

    const call = mockSend.mock.calls[0][0];
    expect(call.html).toContain('Gestioneaza preferintele de notificare');
    expect(call.html).toContain('https://app.clarixbi.com/settings');
    expect(call.html).toContain('Primesti acest email pentru ca ai un cont ClarixBI');
  });
});
