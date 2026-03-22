import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GdprController } from '../src/modules/gdpr/gdpr.controller';
import { GdprService } from '../src/modules/gdpr/gdpr.service';
import { JwtUser } from '../src/modules/auth/interfaces/jwt-user.interface';

describe('GdprController', () => {
  let controller: GdprController;
  let gdprService: Record<string, jest.Mock>;

  const mockUser: JwtUser = {
    id: 'user-id',
    email: 'test@test.com',
    auth0_id: 'auth0|user-id',
  };

  beforeEach(async () => {
    gdprService = {
      requestDeletion: jest.fn(),
      requestExport: jest.fn(),
      getExportStatus: jest.fn(),
      getExportDownload: jest.fn(),
      getDeletionStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GdprController],
      providers: [
        {
          provide: GdprService,
          useValue: gdprService,
        },
      ],
    }).compile();

    controller = module.get<GdprController>(GdprController);
  });

  describe('requestDeletion', () => {
    it('should return a deletion request on success', async () => {
      const scheduledAt = new Date('2026-04-21T00:00:00.000Z');
      gdprService.requestDeletion.mockResolvedValue({
        id: 'req-1',
        status: 'pending',
        scheduled_at: scheduledAt,
      });

      const result = await controller.requestDeletion(mockUser);

      expect(gdprService.requestDeletion).toHaveBeenCalledWith('user-id');
      expect(result).toEqual({
        id: 'req-1',
        status: 'pending',
        scheduled_at: scheduledAt,
        message: 'Your account deletion has been scheduled. You have 30 days to cancel.',
      });
    });

    it('should propagate error when a deletion request is already pending', async () => {
      gdprService.requestDeletion.mockRejectedValue(
        new Error('A deletion request is already pending'),
      );

      await expect(controller.requestDeletion(mockUser)).rejects.toThrow(
        'A deletion request is already pending',
      );
      expect(gdprService.requestDeletion).toHaveBeenCalledWith('user-id');
    });
  });

  describe('requestExport', () => {
    it('should return an export request on success', async () => {
      gdprService.requestExport.mockResolvedValue({
        id: 'export-1',
        status: 'processing',
      });

      const result = await controller.requestExport(mockUser);

      expect(gdprService.requestExport).toHaveBeenCalledWith('user-id');
      expect(result).toEqual({
        id: 'export-1',
        status: 'processing',
        message: 'Your data export is being prepared. You will be notified when it is ready.',
      });
    });
  });

  describe('getExportStatus', () => {
    it('should return status for a valid export request', async () => {
      const completedAt = new Date('2026-03-22T12:00:00.000Z');
      const expiresAt = new Date('2026-03-29T12:00:00.000Z');
      gdprService.getExportStatus.mockResolvedValue({
        id: 'export-1',
        status: 'completed',
        completed_at: completedAt,
        download_expires_at: expiresAt,
      });

      const result = await controller.getExportStatus(mockUser, 'export-1');

      expect(gdprService.getExportStatus).toHaveBeenCalledWith('user-id', 'export-1');
      expect(result).toEqual({
        id: 'export-1',
        status: 'completed',
        completed_at: completedAt,
        download_expires_at: expiresAt,
      });
    });

    it('should throw NotFoundException when the export request does not exist', async () => {
      gdprService.getExportStatus.mockRejectedValue(
        new NotFoundException('Export request not found'),
      );

      await expect(controller.getExportStatus(mockUser, 'invalid-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(gdprService.getExportStatus).toHaveBeenCalledWith('user-id', 'invalid-id');
    });
  });

  describe('downloadExport', () => {
    it('should return a StreamableFile for a valid export download', async () => {
      const filePath = __filename; // use this spec file as a readable file
      gdprService.getExportDownload.mockResolvedValue(filePath);

      const result = await controller.downloadExport(mockUser, 'export-1');

      expect(gdprService.getExportDownload).toHaveBeenCalledWith('user-id', 'export-1');
      expect(result).toBeDefined();
      expect(result.getHeaders().type).toBe('application/zip');
      expect(result.getHeaders().disposition).toBe('attachment; filename="gdpr-export.zip"');
    });

    it('should throw NotFoundException when the export file does not exist on disk', async () => {
      gdprService.getExportDownload.mockResolvedValue('/non/existent/path.zip');

      await expect(controller.downloadExport(mockUser, 'export-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(gdprService.getExportDownload).toHaveBeenCalledWith('user-id', 'export-1');
    });
  });

  describe('getDeletionStatus', () => {
    it('should return the current deletion status when a request exists', async () => {
      const scheduledAt = new Date('2026-04-21T00:00:00.000Z');
      const completedAt = null;
      gdprService.getDeletionStatus.mockResolvedValue({
        id: 'req-1',
        status: 'pending',
        scheduled_at: scheduledAt,
        completed_at: completedAt,
      });

      const result = await controller.getDeletionStatus(mockUser);

      expect(gdprService.getDeletionStatus).toHaveBeenCalledWith('user-id');
      expect(result).toEqual({
        id: 'req-1',
        status: 'pending',
        scheduled_at: scheduledAt,
        completed_at: completedAt,
      });
    });
  });
});
