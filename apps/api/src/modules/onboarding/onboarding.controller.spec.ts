process.env['REDIS_URL'] = 'redis://localhost:6379';

import { Test, TestingModule } from '@nestjs/testing';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgMemberGuard } from '../auth/guards/org-member.guard';

describe('OnboardingController', () => {
  let controller: OnboardingController;
  let mockOnboardingService: {
    getStatus: jest.Mock;
    selectSource: jest.Mock;
    testAndConnect: jest.Mock;
    getSyncStatus: jest.Mock;
    completeOnboarding: jest.Mock;
    loadDemoData: jest.Mock;
  };

  const orgId = '33333333-3333-3333-3333-333333333333';

  beforeEach(async () => {
    mockOnboardingService = {
      getStatus: jest.fn(),
      selectSource: jest.fn(),
      testAndConnect: jest.fn(),
      getSyncStatus: jest.fn(),
      completeOnboarding: jest.fn(),
      loadDemoData: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OnboardingController],
      providers: [{ provide: OnboardingService, useValue: mockOnboardingService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OrgMemberGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<OnboardingController>(OnboardingController);

    jest.clearAllMocks();
  });

  describe('getStatus', () => {
    it('should return onboarding status wrapped in { data }', async () => {
      const status = { step: 'select-source', hasDataSource: false, hasSyncedData: false };
      mockOnboardingService.getStatus.mockResolvedValue(status);

      const result = await controller.getStatus(orgId);

      expect(mockOnboardingService.getStatus).toHaveBeenCalledWith(orgId);
      expect(result).toEqual({ data: status });
    });
  });

  describe('selectSource', () => {
    it('should call selectSource and return success message', async () => {
      mockOnboardingService.selectSource.mockResolvedValue(undefined);

      const result = await controller.selectSource(orgId, { sourceType: 'smartbill' });

      expect(mockOnboardingService.selectSource).toHaveBeenCalledWith(orgId, 'smartbill');
      expect(result).toEqual({ data: { message: 'Source type selected' } });
    });
  });

  describe('connect', () => {
    it('should call testAndConnect and return { data }', async () => {
      const connectResult = { dataSourceId: 'ds-123' };
      mockOnboardingService.testAndConnect.mockResolvedValue(connectResult);

      const dto = { sourceType: 'smartbill', credentials: { apiKey: 'key123' } };
      const result = await controller.connect(orgId, dto);

      expect(mockOnboardingService.testAndConnect).toHaveBeenCalledWith(orgId, 'smartbill', {
        apiKey: 'key123',
      });
      expect(result).toEqual({ data: connectResult });
    });
  });

  describe('getSyncStatus', () => {
    it('should return sync status wrapped in { data }', async () => {
      const syncStatus = { syncing: true, progress: 50, totalRows: 200 };
      mockOnboardingService.getSyncStatus.mockResolvedValue(syncStatus);

      const result = await controller.getSyncStatus(orgId);

      expect(mockOnboardingService.getSyncStatus).toHaveBeenCalledWith(orgId);
      expect(result).toEqual({ data: syncStatus });
    });
  });

  describe('complete', () => {
    it('should call completeOnboarding and return success message', async () => {
      mockOnboardingService.completeOnboarding.mockResolvedValue(undefined);

      const result = await controller.complete(orgId);

      expect(mockOnboardingService.completeOnboarding).toHaveBeenCalledWith(orgId);
      expect(result).toEqual({ data: { message: 'Onboarding completed' } });
    });
  });

  describe('loadDemoData', () => {
    it('should call loadDemoData and return { data }', async () => {
      const demoResult = { totalRows: 100, datasets: ['smartbill', 'woocommerce', 'csv'] };
      mockOnboardingService.loadDemoData.mockResolvedValue(demoResult);

      const result = await controller.loadDemoData(orgId, { dataset: 'all' });

      expect(mockOnboardingService.loadDemoData).toHaveBeenCalledWith(orgId, 'all');
      expect(result).toEqual({ data: demoResult });
    });
  });
});
