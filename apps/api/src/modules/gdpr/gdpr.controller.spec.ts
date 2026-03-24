jest.mock('../sync/queues.config', () => ({
  gdprHardDeleteQueue: { add: jest.fn() },
  gdprExportQueue: { add: jest.fn() },
}));

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    existsSync: jest.fn().mockReturnValue(true),
    createReadStream: jest.fn().mockReturnValue({ pipe: jest.fn() }),
  };
});

import { Test, TestingModule } from '@nestjs/testing';
import { StreamableFile } from '@nestjs/common';
import { GdprController } from './gdpr.controller';
import { GdprService } from './gdpr.service';
import { GdprRequestStatus } from './entities/gdpr-request.entity';
import { JwtUser } from '../auth/interfaces/jwt-user.interface';

describe('GdprController', () => {
  let controller: GdprController;

  const mockGdprService = {
    requestDeletion: jest.fn(),
    requestExport: jest.fn(),
    getExportStatus: jest.fn(),
    getExportDownload: jest.fn(),
    getDeletionStatus: jest.fn(),
  };

  const mockUser: JwtUser = {
    id: 'user-123',
    email: 'test@example.com',
    auth0_id: 'auth0|123',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GdprController],
      providers: [{ provide: GdprService, useValue: mockGdprService }],
    }).compile();

    controller = module.get<GdprController>(GdprController);
    jest.clearAllMocks();
  });

  describe('POST /gdpr/delete', () => {
    it('should call requestDeletion and return scheduled response', async () => {
      const scheduledAt = new Date();
      mockGdprService.requestDeletion.mockResolvedValue({
        id: 'req-1',
        status: GdprRequestStatus.PENDING,
        scheduled_at: scheduledAt,
      });

      const result = await controller.requestDeletion(mockUser);

      expect(result.id).toBe('req-1');
      expect(result.status).toBe(GdprRequestStatus.PENDING);
      expect(result.scheduled_at).toBe(scheduledAt);
      expect(result.message).toContain('30 days');
      expect(mockGdprService.requestDeletion).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('POST /gdpr/export', () => {
    it('should call requestExport and return processing response', async () => {
      mockGdprService.requestExport.mockResolvedValue({
        id: 'exp-1',
        status: GdprRequestStatus.PROCESSING,
      });

      const result = await controller.requestExport(mockUser);

      expect(result.id).toBe('exp-1');
      expect(result.status).toBe(GdprRequestStatus.PROCESSING);
      expect(result.message).toContain('export');
      expect(mockGdprService.requestExport).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('GET /gdpr/export/:requestId/status', () => {
    it('should return export status', async () => {
      const completedAt = new Date();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      mockGdprService.getExportStatus.mockResolvedValue({
        id: 'exp-1',
        status: GdprRequestStatus.COMPLETED,
        completed_at: completedAt,
        download_expires_at: expiresAt,
      });

      const result = await controller.getExportStatus(mockUser, 'exp-1');

      expect(result.id).toBe('exp-1');
      expect(result.status).toBe(GdprRequestStatus.COMPLETED);
      expect(result.completed_at).toBe(completedAt);
      expect(result.download_expires_at).toBe(expiresAt);
      expect(mockGdprService.getExportStatus).toHaveBeenCalledWith(mockUser.id, 'exp-1');
    });
  });

  describe('GET /gdpr/export/:requestId/download', () => {
    it('should return StreamableFile when file exists', async () => {
      mockGdprService.getExportDownload.mockResolvedValue('/path/to/export.zip');

      const result = await controller.downloadExport(mockUser, 'exp-1');

      expect(result).toBeInstanceOf(StreamableFile);
      expect(mockGdprService.getExportDownload).toHaveBeenCalledWith(mockUser.id, 'exp-1');
    });

    it('should throw NotFoundException when file does not exist', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { existsSync } = require('fs');
      existsSync.mockReturnValue(false);
      mockGdprService.getExportDownload.mockResolvedValue('/path/to/missing.zip');

      await expect(controller.downloadExport(mockUser, 'exp-1')).rejects.toThrow('no longer');
    });
  });

  describe('GET /gdpr/delete/status', () => {
    it('should return deletion status when request exists', async () => {
      const scheduledAt = new Date();
      mockGdprService.getDeletionStatus.mockResolvedValue({
        id: 'del-1',
        status: GdprRequestStatus.PENDING,
        scheduled_at: scheduledAt,
        completed_at: null,
      });

      const result = await controller.getDeletionStatus(mockUser);

      expect(result.id).toBe('del-1');
      expect(result.status).toBe(GdprRequestStatus.PENDING);
      expect(result.scheduled_at).toBe(scheduledAt);
      expect(mockGdprService.getDeletionStatus).toHaveBeenCalledWith(mockUser.id);
    });

    it('should return status none when no deletion request found', async () => {
      mockGdprService.getDeletionStatus.mockResolvedValue(null);

      const result = await controller.getDeletionStatus(mockUser);

      expect(result.status).toBe('none');
      expect(result.message).toContain('No deletion');
    });
  });
});
