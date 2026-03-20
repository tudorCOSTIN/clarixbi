import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { AiRateLimitService } from './ai-rate-limit.service';
import { ClaudeClientService } from './claude-client.service';
import { SqlValidatorService } from './sql-validator.service';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import { AIConversation } from './entities/ai-conversation.entity';
import { AIMessage } from './entities/ai-message.entity';

describe('AiService', () => {
  let service: AiService;
  const orgId = '550e8400-e29b-41d4-a716-446655440000';
  const userId = '660e8400-e29b-41d4-a716-446655440000';
  const convId = '770e8400-e29b-41d4-a716-446655440000';

  const mockConvRepo = {
    create: jest.fn((data) => ({ id: convId, ...data })),
    save: jest.fn((data) => Promise.resolve({ id: convId, ...data })),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    remove: jest.fn(),
  };

  const mockMsgRepo = {
    save: jest.fn((data) => Promise.resolve({ id: 'msg-1', ...data })),
    count: jest.fn().mockResolvedValue(42),
  };

  const mockClaudeClient = {
    generateSQL: jest.fn(),
  };

  const mockSqlValidator = {
    validate: jest.fn(),
  };

  const mockClickhouse = {
    query: jest.fn(),
  };

  const mockRateLimitService = {
    checkAndIncrement: jest.fn().mockResolvedValue({
      allowed: true,
      usage: { used: 1, limit: 500, percentage: 0.2, resetsAt: '2026-04-01', tier: 'pro' },
    }),
    getRetryConfig: jest.fn().mockResolvedValue({ maxRetries: 3, notifyOnFinalFailure: false }),
    getUsage: jest.fn().mockResolvedValue({
      used: 42,
      limit: 500,
      percentage: 8.4,
      resetsAt: '2026-04-01',
      tier: 'pro',
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: getRepositoryToken(AIConversation), useValue: mockConvRepo },
        { provide: getRepositoryToken(AIMessage), useValue: mockMsgRepo },
        { provide: ClaudeClientService, useValue: mockClaudeClient },
        { provide: SqlValidatorService, useValue: mockSqlValidator },
        { provide: ClickHouseService, useValue: mockClickhouse },
        { provide: AiRateLimitService, useValue: mockRateLimitService },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    jest.clearAllMocks();
    // Reset rate limit mock default
    mockRateLimitService.checkAndIncrement.mockResolvedValue({
      allowed: true,
      usage: { used: 1, limit: 500, percentage: 0.2, resetsAt: '2026-04-01', tier: 'pro' },
    });
    mockRateLimitService.getRetryConfig.mockResolvedValue({
      maxRetries: 3,
      notifyOnFinalFailure: false,
    });
  });

  describe('createConversation', () => {
    it('should create a new conversation', async () => {
      const result = await service.createConversation(orgId, userId);
      expect(mockConvRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ org_id: orgId, user_id: userId }),
      );
      expect(mockConvRepo.save).toHaveBeenCalled();
      expect(result.id).toBe(convId);
    });
  });

  describe('sendMessage', () => {
    beforeEach(() => {
      mockConvRepo.findOne.mockResolvedValue({
        id: convId,
        org_id: orgId,
        message_count: 0,
        title: null,
      });
    });

    it('should handle full flow: message → SQL → validate → execute → chart', async () => {
      mockClaudeClient.generateSQL.mockResolvedValue({
        text: 'Top 5 clients by revenue:\n\n```sql\nSELECT customer_name, SUM(total_amount) as revenue FROM invoices GROUP BY customer_name ORDER BY revenue DESC LIMIT 5\n```\n\nThis shows your best clients.',
        sql: 'SELECT customer_name, SUM(total_amount) as revenue FROM invoices GROUP BY customer_name ORDER BY revenue DESC LIMIT 5',
        tokensUsed: 200,
      });

      mockSqlValidator.validate.mockResolvedValue({
        isValid: true,
        errors: [],
        sanitizedSql: `SELECT customer_name, SUM(total_amount) as revenue FROM invoices WHERE org_id = '${orgId}' GROUP BY customer_name ORDER BY revenue DESC LIMIT 5`,
      });

      mockClickhouse.query.mockResolvedValue([
        { customer_name: 'Client A', revenue: 50000 },
        { customer_name: 'Client B', revenue: 40000 },
        { customer_name: 'Client C', revenue: 30000 },
        { customer_name: 'Client D', revenue: 20000 },
        { customer_name: 'Client E', revenue: 10000 },
      ]);

      const result = await service.sendMessage(
        orgId,
        userId,
        convId,
        'Care sunt top 5 clienti dupa revenue?',
      );

      expect(result.sql).toBeDefined();
      expect(result.data).toHaveLength(5);
      expect(result.chartType).toBe('bar');
      expect(result.chartConfig).toBeDefined();
      expect(mockRateLimitService.checkAndIncrement).toHaveBeenCalledWith(orgId, userId);
    });

    it('should return KPI chart for single row single numeric', async () => {
      mockClaudeClient.generateSQL.mockResolvedValue({
        text: 'Count:\n\n```sql\nSELECT COUNT(*) as total FROM invoices\n```',
        sql: 'SELECT COUNT(*) as total FROM invoices',
        tokensUsed: 100,
      });

      mockSqlValidator.validate.mockResolvedValue({
        isValid: true,
        errors: [],
        sanitizedSql: `SELECT COUNT(*) as total FROM invoices WHERE org_id = '${orgId}'`,
      });

      mockClickhouse.query.mockResolvedValue([{ total: 42 }]);

      const result = await service.sendMessage(orgId, userId, convId, 'Cate facturi am?');

      expect(result.chartType).toBe('kpi');
      expect(result.data).toHaveLength(1);
    });

    it('should handle invalid SQL with error message', async () => {
      mockClaudeClient.generateSQL.mockResolvedValue({
        text: 'Here:\n\n```sql\nDELETE FROM invoices\n```',
        sql: 'DELETE FROM invoices',
        tokensUsed: 50,
      });

      mockSqlValidator.validate.mockResolvedValue({
        isValid: false,
        errors: ['DELETE is not allowed'],
        sanitizedSql: '',
      });

      const result = await service.sendMessage(orgId, userId, convId, 'Delete all invoices');

      expect(result.data).toBeNull();
      expect(result.response).toContain('security validation');
    });

    it('should handle Claude API error gracefully', async () => {
      mockClaudeClient.generateSQL.mockResolvedValue({
        text: '',
        sql: null,
        tokensUsed: 0,
        error: 'AI unavailable',
      });

      const result = await service.sendMessage(orgId, userId, convId, 'test');

      expect(result.response).toContain('unavailable');
      expect(result.data).toBeNull();
    });

    it('should detect Romanian language', async () => {
      mockClaudeClient.generateSQL.mockResolvedValue({
        text: 'Rezultat:\n\n```sql\nSELECT 1\n```',
        sql: 'SELECT 1',
        tokensUsed: 50,
      });

      mockSqlValidator.validate.mockResolvedValue({
        isValid: true,
        errors: [],
        sanitizedSql: 'SELECT 1',
      });

      mockClickhouse.query.mockResolvedValue([{ '1': 1 }]);

      await service.sendMessage(orgId, userId, convId, 'Cate facturi am emis luna asta?');

      // System prompt should be in Romanian - check it was called with RO system prompt
      const callArgs = mockClaudeClient.generateSQL.mock.calls[0];
      expect(callArgs[0]).toContain('Esti un analist de date expert');
    });

    it('should set conversation title from first message', async () => {
      mockClaudeClient.generateSQL.mockResolvedValue({
        text: 'Result',
        sql: null,
        tokensUsed: 50,
      });

      await service.sendMessage(orgId, userId, convId, 'What are my top clients?');

      expect(mockConvRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'What are my top clients?',
        }),
      );
    });

    it('should block with 429 when rate limited', async () => {
      mockRateLimitService.checkAndIncrement.mockResolvedValue({
        allowed: false,
        usage: { used: 100, limit: 100, percentage: 100, resetsAt: '2026-04-01', tier: 'starter' },
      });

      await expect(service.sendMessage(orgId, userId, convId, 'test query')).rejects.toThrow(
        'Ai atins limita de interogari AI',
      );
    });

    it('should pass plan-based retry config to Claude client', async () => {
      mockRateLimitService.getRetryConfig.mockResolvedValue({
        maxRetries: 5,
        notifyOnFinalFailure: true,
      });

      mockClaudeClient.generateSQL.mockResolvedValue({
        text: 'Result',
        sql: null,
        tokensUsed: 50,
      });

      await service.sendMessage(orgId, userId, convId, 'test');

      expect(mockClaudeClient.generateSQL).toHaveBeenCalledWith(
        expect.any(String),
        'test',
        5, // Enterprise maxRetries
      );
    });
  });

  describe('getUsage', () => {
    it('should delegate to rate limit service', async () => {
      const usage = await service.getUsage(orgId);

      expect(mockRateLimitService.getUsage).toHaveBeenCalledWith(orgId);
      expect(usage.used).toBe(42);
      expect(usage.limit).toBe(500);
      expect(usage.percentage).toBe(8.4);
      expect(usage.tier).toBe('pro');
    });
  });
});
