import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
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

  // ===== createConversation =====

  describe('createConversation', () => {
    it('should create a new conversation', async () => {
      const result = await service.createConversation(orgId, userId);
      expect(mockConvRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ org_id: orgId, user_id: userId, title: null, message_count: 0 }),
      );
      expect(mockConvRepo.save).toHaveBeenCalled();
      expect(result.id).toBe(convId);
    });
  });

  // ===== listConversations =====

  describe('listConversations', () => {
    it('should return paginated conversations', async () => {
      const conversations = [
        { id: 'conv-1', org_id: orgId, title: 'Test 1' },
        { id: 'conv-2', org_id: orgId, title: 'Test 2' },
      ];
      mockConvRepo.findAndCount.mockResolvedValue([conversations, 2]);

      const result = await service.listConversations(orgId, 1, 20);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockConvRepo.findAndCount).toHaveBeenCalledWith({
        where: { org_id: orgId },
        order: { updated_at: 'DESC' },
        skip: 0,
        take: 20,
      });
    });

    it('should handle page 2 with custom limit', async () => {
      mockConvRepo.findAndCount.mockResolvedValue([[], 15]);

      const result = await service.listConversations(orgId, 2, 10);

      expect(result.total).toBe(15);
      expect(mockConvRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('should use default pagination when not specified', async () => {
      mockConvRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.listConversations(orgId);

      expect(mockConvRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });
  });

  // ===== getConversation =====

  describe('getConversation', () => {
    it('should return conversation with messages', async () => {
      const conv = {
        id: convId,
        org_id: orgId,
        messages: [
          { id: 'msg-1', role: 'user', content: 'Hello' },
          { id: 'msg-2', role: 'assistant', content: 'Hi' },
        ],
      };
      mockConvRepo.findOne.mockResolvedValue(conv);

      const result = await service.getConversation(orgId, convId);

      expect(result.messages).toHaveLength(2);
      expect(mockConvRepo.findOne).toHaveBeenCalledWith({
        where: { id: convId, org_id: orgId },
        relations: ['messages'],
        order: { messages: { created_at: 'ASC' } },
      });
    });

    it('should throw NotFoundException when conversation not found', async () => {
      mockConvRepo.findOne.mockResolvedValue(null);

      await expect(service.getConversation(orgId, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ===== deleteConversation =====

  describe('deleteConversation', () => {
    it('should delete existing conversation', async () => {
      const conv = { id: convId, org_id: orgId };
      mockConvRepo.findOne.mockResolvedValue(conv);

      await service.deleteConversation(orgId, convId);

      expect(mockConvRepo.remove).toHaveBeenCalledWith(conv);
    });

    it('should throw NotFoundException when conversation not found', async () => {
      mockConvRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteConversation(orgId, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ===== sendMessage =====

  describe('sendMessage', () => {
    beforeEach(() => {
      mockConvRepo.findOne.mockResolvedValue({
        id: convId,
        org_id: orgId,
        message_count: 0,
        title: null,
      });
      mockClickhouse.query.mockResolvedValue([]);
    });

    it('should handle full flow: message -> SQL -> validate -> execute -> bar chart', async () => {
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
      expect(result.chartConfig).toEqual(
        expect.objectContaining({ xKey: 'customer_name', yKeys: ['revenue'] }),
      );
      expect(mockRateLimitService.checkAndIncrement).toHaveBeenCalledWith(orgId, userId);
    });

    it('should return KPI chart for single row with single numeric column', async () => {
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
      expect(result.chartConfig).toEqual(expect.objectContaining({ valueKey: 'total', value: 42 }));
    });

    it('should detect line chart for time-series data with date columns', async () => {
      mockClaudeClient.generateSQL.mockResolvedValue({
        text: 'Monthly:\n\n```sql\nSELECT month, SUM(amount) as total FROM invoices GROUP BY month\n```',
        sql: 'SELECT month, SUM(amount) as total FROM invoices GROUP BY month',
        tokensUsed: 100,
      });

      mockSqlValidator.validate.mockResolvedValue({
        isValid: true,
        errors: [],
        sanitizedSql: 'SELECT month, SUM(amount) as total FROM invoices GROUP BY month',
      });

      mockClickhouse.query.mockResolvedValue([
        { month: '2025-01', total: 10000 },
        { month: '2025-02', total: 12000 },
        { month: '2025-03', total: 15000 },
      ]);

      const result = await service.sendMessage(orgId, userId, convId, 'Monthly revenue trend');

      expect(result.chartType).toBe('line');
    });

    it('should detect pie chart for small categorical data (< 5 rows)', async () => {
      mockClaudeClient.generateSQL.mockResolvedValue({
        text: 'Status breakdown:\n\n```sql\nSELECT status, COUNT(*) as cnt FROM invoices GROUP BY status\n```',
        sql: 'SELECT status, COUNT(*) as cnt FROM invoices GROUP BY status',
        tokensUsed: 100,
      });

      mockSqlValidator.validate.mockResolvedValue({
        isValid: true,
        errors: [],
        sanitizedSql: 'SELECT status, COUNT(*) as cnt FROM invoices GROUP BY status',
      });

      mockClickhouse.query.mockResolvedValue([
        { status: 'paid', cnt: 100 },
        { status: 'pending', cnt: 30 },
        { status: 'overdue', cnt: 10 },
      ]);

      const result = await service.sendMessage(orgId, userId, convId, 'Invoice status breakdown');

      expect(result.chartType).toBe('pie');
      expect(result.chartConfig).toEqual(
        expect.objectContaining({ nameKey: 'status', valueKey: 'cnt' }),
      );
    });

    it('should fallback to table chart for multi-column non-numeric data', async () => {
      mockClaudeClient.generateSQL.mockResolvedValue({
        text: 'Details:\n\n```sql\nSELECT * FROM invoices LIMIT 10\n```',
        sql: 'SELECT * FROM invoices LIMIT 10',
        tokensUsed: 100,
      });

      mockSqlValidator.validate.mockResolvedValue({
        isValid: true,
        errors: [],
        sanitizedSql: 'SELECT * FROM invoices LIMIT 10',
      });

      mockClickhouse.query.mockResolvedValue([
        { id: 'inv-1', customer: 'Alice', note: 'First' },
        { id: 'inv-2', customer: 'Bob', note: 'Second' },
      ]);

      const result = await service.sendMessage(orgId, userId, convId, 'Show invoice details');

      expect(result.chartType).toBe('table');
    });

    it('should return table chart when data is empty', async () => {
      mockClaudeClient.generateSQL.mockResolvedValue({
        text: 'Result:\n\n```sql\nSELECT 1\n```',
        sql: 'SELECT 1',
        tokensUsed: 50,
      });

      mockSqlValidator.validate.mockResolvedValue({
        isValid: true,
        errors: [],
        sanitizedSql: 'SELECT 1',
      });

      mockClickhouse.query.mockResolvedValue([]);

      const result = await service.sendMessage(orgId, userId, convId, 'test');

      expect(result.chartType).toBe('table');
    });

    it('should handle invalid SQL with error message (English)', async () => {
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
      expect(result.response).toContain('failed security validation');
      expect(result.response).toContain('DELETE is not allowed');
    });

    it('should handle invalid SQL with error message (Romanian)', async () => {
      mockClaudeClient.generateSQL.mockResolvedValue({
        text: 'Rezultat:\n\n```sql\nDELETE FROM invoices\n```',
        sql: 'DELETE FROM invoices',
        tokensUsed: 50,
      });

      mockSqlValidator.validate.mockResolvedValue({
        isValid: false,
        errors: ['DELETE is not allowed'],
        sanitizedSql: '',
      });

      const result = await service.sendMessage(
        orgId,
        userId,
        convId,
        'Sterge toate facturile din baza',
      );

      expect(result.data).toBeNull();
      expect(result.response).toContain('validarea de securitate');
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
      expect(result.sql).toBeNull();
      expect(result.chartType).toBe('table');
      expect(result.chartConfig).toEqual({});
    });

    it('should return Romanian error message when Claude API fails on Romanian query', async () => {
      mockClaudeClient.generateSQL.mockResolvedValue({
        text: '',
        sql: null,
        tokensUsed: 0,
        error: 'AI unavailable',
      });

      const result = await service.sendMessage(orgId, userId, convId, 'Arata-mi toate facturile');

      expect(result.response).toContain('nu este disponibil momentan');
    });

    it('should detect Romanian language from diacritics', async () => {
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

      const callArgs = mockClaudeClient.generateSQL.mock.calls[0];
      expect(callArgs[0]).toContain('Esti un analist de date expert');
    });

    it('should use English system prompt by default', async () => {
      mockClaudeClient.generateSQL.mockResolvedValue({
        text: 'Result:\n\n```sql\nSELECT 1\n```',
        sql: 'SELECT 1',
        tokensUsed: 50,
      });

      mockSqlValidator.validate.mockResolvedValue({
        isValid: true,
        errors: [],
        sanitizedSql: 'SELECT 1',
      });

      mockClickhouse.query.mockResolvedValue([{ '1': 1 }]);

      await service.sendMessage(orgId, userId, convId, 'How many invoices do I have?');

      const callArgs = mockClaudeClient.generateSQL.mock.calls[0];
      expect(callArgs[0]).toContain('You are an expert data analyst');
      expect(callArgs[0]).not.toContain('Esti un analist');
    });

    it('should throw 429 when rate limited', async () => {
      mockRateLimitService.checkAndIncrement.mockResolvedValue({
        allowed: false,
        usage: {
          used: 100,
          limit: 100,
          percentage: 100,
          resetsAt: '2026-04-01',
          tier: 'starter',
        },
      });

      try {
        await service.sendMessage(orgId, userId, convId, 'test query');
        fail('Expected HttpException');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        const response = (error as HttpException).getResponse() as Record<string, unknown>;
        expect(response.error).toBe('AI_RATE_LIMIT');
        expect(response.used).toBe(100);
        expect(response.limit).toBe(100);
      }
    });

    it('should set conversation title from first message (short)', async () => {
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

    it('should truncate title to 100 chars for long messages', async () => {
      mockClaudeClient.generateSQL.mockResolvedValue({
        text: 'Result',
        sql: null,
        tokensUsed: 50,
      });

      const longMessage = 'A'.repeat(150);
      await service.sendMessage(orgId, userId, convId, longMessage);

      expect(mockConvRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'A'.repeat(100) + '...',
        }),
      );
    });

    it('should not overwrite existing conversation title', async () => {
      mockConvRepo.findOne.mockResolvedValue({
        id: convId,
        org_id: orgId,
        message_count: 2,
        title: 'Existing Title',
      });

      mockClaudeClient.generateSQL.mockResolvedValue({
        text: 'Result',
        sql: null,
        tokensUsed: 50,
      });

      await service.sendMessage(orgId, userId, convId, 'Another question');

      expect(mockConvRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Existing Title',
        }),
      );
    });

    it('should handle ClickHouse query failure gracefully', async () => {
      mockClaudeClient.generateSQL.mockResolvedValue({
        text: 'Query:\n\n```sql\nSELECT * FROM invoices\n```',
        sql: 'SELECT * FROM invoices',
        tokensUsed: 100,
      });

      mockSqlValidator.validate.mockResolvedValue({
        isValid: true,
        errors: [],
        sanitizedSql: `SELECT * FROM invoices WHERE org_id = '${orgId}'`,
      });

      mockClickhouse.query.mockRejectedValue(new Error('Connection timeout'));

      const result = await service.sendMessage(orgId, userId, convId, 'Show all invoices');

      expect(result.data).toBeNull();
      expect(result.response).toContain('error occurred during execution');
      expect(result.response).toContain('Connection timeout');
    });

    it('should handle ClickHouse query failure with Romanian message', async () => {
      mockClaudeClient.generateSQL.mockResolvedValue({
        text: 'Interogare:\n\n```sql\nSELECT * FROM invoices\n```',
        sql: 'SELECT * FROM invoices',
        tokensUsed: 100,
      });

      mockSqlValidator.validate.mockResolvedValue({
        isValid: true,
        errors: [],
        sanitizedSql: `SELECT * FROM invoices WHERE org_id = '${orgId}'`,
      });

      mockClickhouse.query.mockRejectedValue(new Error('DB error'));

      const result = await service.sendMessage(
        orgId,
        userId,
        convId,
        'Arata toate facturile din luna aceasta',
      );

      expect(result.data).toBeNull();
      expect(result.response).toContain('eroare la executie');
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

      expect(mockClaudeClient.generateSQL).toHaveBeenCalledWith(expect.any(String), 'test', 5);
    });

    it('should increment message_count by 2 (user + assistant)', async () => {
      mockClaudeClient.generateSQL.mockResolvedValue({
        text: 'Result',
        sql: null,
        tokensUsed: 50,
      });

      await service.sendMessage(orgId, userId, convId, 'test');

      expect(mockConvRepo.save).toHaveBeenCalledWith(expect.objectContaining({ message_count: 2 }));
    });

    it('should throw NotFoundException when conversation not found', async () => {
      mockConvRepo.findOne.mockResolvedValue(null);

      await expect(service.sendMessage(orgId, userId, convId, 'test')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should strip SQL code blocks from display text', async () => {
      mockClaudeClient.generateSQL.mockResolvedValue({
        text: 'Here is the result:\n\n```sql\nSELECT 1\n```\n\nThis shows the count.',
        sql: 'SELECT 1',
        tokensUsed: 100,
      });

      mockSqlValidator.validate.mockResolvedValue({
        isValid: true,
        errors: [],
        sanitizedSql: 'SELECT 1',
      });

      mockClickhouse.query.mockResolvedValue([{ '1': 1 }]);

      const result = await service.sendMessage(orgId, userId, convId, 'test');

      expect(result.response).not.toContain('```sql');
      expect(result.response).toContain('Here is the result');
      expect(result.response).toContain('This shows the count.');
    });

    it('should handle response with no SQL block', async () => {
      mockClaudeClient.generateSQL.mockResolvedValue({
        text: 'I cannot generate SQL for that request. Please be more specific.',
        sql: null,
        tokensUsed: 50,
      });

      const result = await service.sendMessage(orgId, userId, convId, 'hello');

      expect(result.sql).toBeNull();
      expect(result.data).toBeNull();
      expect(result.response).toContain('cannot generate SQL');
    });

    it('should save assistant message with query_result when data exists', async () => {
      mockClaudeClient.generateSQL.mockResolvedValue({
        text: 'Count:\n\n```sql\nSELECT COUNT(*) as total FROM invoices\n```',
        sql: 'SELECT COUNT(*) as total FROM invoices',
        tokensUsed: 100,
      });

      mockSqlValidator.validate.mockResolvedValue({
        isValid: true,
        errors: [],
        sanitizedSql: 'SELECT COUNT(*) as total FROM invoices',
      });

      mockClickhouse.query.mockResolvedValue([{ total: 42 }]);

      await service.sendMessage(orgId, userId, convId, 'Count invoices');

      // Second save call is the assistant message
      const assistantSave = mockMsgRepo.save.mock.calls[1]![0];
      expect(assistantSave.role).toBe('assistant');
      expect(assistantSave.generated_sql).toBe('SELECT COUNT(*) as total FROM invoices');
      expect(assistantSave.query_result).toEqual(
        expect.objectContaining({
          rows: [{ total: 42 }],
          chartType: 'kpi',
        }),
      );
      expect(assistantSave.tokens_used).toBe(100);
    });
  });

  // ===== getUsage =====

  describe('getUsage', () => {
    it('should delegate to rate limit service and return usage info', async () => {
      const usage = await service.getUsage(orgId);

      expect(mockRateLimitService.getUsage).toHaveBeenCalledWith(orgId);
      expect(usage.used).toBe(42);
      expect(usage.limit).toBe(500);
      expect(usage.percentage).toBe(8.4);
      expect(usage.tier).toBe('pro');
      expect(usage.resetsAt).toBe('2026-04-01');
    });
  });
});
