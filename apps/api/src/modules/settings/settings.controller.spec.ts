import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

describe('SettingsController', () => {
  let controller: SettingsController;
  const mockService = {
    getUserPreferences: jest.fn(),
    updateUserPreferences: jest.fn(),
    getOrganizationSettings: jest.fn(),
    updateOrganizationSettings: jest.fn(),
  };

  const mockUser = { id: 'user-1', email: 'test@test.com', auth0_id: 'auth0|123' };

  beforeEach(() => {
    controller = new SettingsController(mockService as unknown as SettingsService);
    jest.clearAllMocks();
  });

  describe('getUserPreferences', () => {
    it('should return user preferences', async () => {
      const prefs = { language: 'ro', timezone: 'Europe/Bucharest', notifications_enabled: true };
      mockService.getUserPreferences.mockResolvedValue(prefs);

      const result = await controller.getUserPreferences(mockUser);

      expect(result).toEqual({ data: prefs });
      expect(mockService.getUserPreferences).toHaveBeenCalledWith('user-1');
    });
  });

  describe('updateUserPreferences', () => {
    it('should update user preferences', async () => {
      const updated = { language: 'en', timezone: 'UTC', notifications_enabled: true };
      mockService.updateUserPreferences.mockResolvedValue(updated);

      const result = await controller.updateUserPreferences(mockUser, {
        language: 'en' as never,
        timezone: 'UTC',
      });

      expect(result).toEqual({ data: updated });
    });
  });

  describe('getOrganizationSettings', () => {
    it('should return organization settings', async () => {
      const settings = {
        name: 'Test Org',
        slug: 'test-org',
        logo_url: null,
        default_timezone: 'Europe/Bucharest',
        default_language: 'ro',
      };
      mockService.getOrganizationSettings.mockResolvedValue(settings);

      const result = await controller.getOrganizationSettings('org-1');

      expect(result).toEqual({ data: settings });
    });
  });

  describe('updateOrganizationSettings', () => {
    it('should update organization settings', async () => {
      const updated = {
        name: 'Updated Org',
        slug: 'test-org',
        logo_url: null,
        default_timezone: 'Europe/Bucharest',
        default_language: 'ro',
      };
      mockService.updateOrganizationSettings.mockResolvedValue(updated);

      const result = await controller.updateOrganizationSettings('org-1', {
        name: 'Updated Org',
      });

      expect(result).toEqual({ data: updated });
    });
  });
});
