import { Test, TestingModule } from '@nestjs/testing';
import { ClaudeClientService } from './claude-client.service';

// Mock the Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn(),
    },
  }));
});

describe('ClaudeClientService', () => {
  let service: ClaudeClientService;
  let mockCreate: jest.Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ClaudeClientService],
    }).compile();

    service = module.get<ClaudeClientService>(ClaudeClientService);
    // Access the mocked create method
    mockCreate = (service as unknown as { client: { messages: { create: jest.Mock } } }).client
      .messages.create;
    mockCreate.mockClear();
  });

  it('should parse SQL from response and track tokens', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: 'Here is the query:\n\n```sql\nSELECT COUNT(*) FROM invoices\n```\n\nThis counts all invoices.',
        },
      ],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const result = await service.generateSQL('system prompt', 'count invoices');

    expect(result.sql).toBe('SELECT COUNT(*) FROM invoices');
    expect(result.tokensUsed).toBe(150);
    expect(result.error).toBeUndefined();
    expect(result.text).toContain('Here is the query');
  });

  it('should return null sql when no SQL block in response', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'I cannot generate SQL for that request.' }],
      usage: { input_tokens: 50, output_tokens: 30 },
    });

    const result = await service.generateSQL('system prompt', 'hello');

    expect(result.sql).toBeNull();
    expect(result.tokensUsed).toBe(80);
  });

  it('should retry on 529 (overloaded) with exponential backoff', async () => {
    const overloadedError = new Error('Overloaded');
    (overloadedError as unknown as { status: number }).status = 529;

    mockCreate
      .mockRejectedValueOnce(overloadedError)
      .mockRejectedValueOnce(overloadedError)
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: '```sql\nSELECT 1\n```' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });

    const result = await service.generateSQL('system', 'test');

    expect(mockCreate).toHaveBeenCalledTimes(3);
    expect(result.sql).toBe('SELECT 1');
  }, 30000);

  it('should return error after all retries fail on 529', async () => {
    const overloadedError = new Error('Overloaded');
    (overloadedError as unknown as { status: number }).status = 529;

    mockCreate
      .mockRejectedValueOnce(overloadedError)
      .mockRejectedValueOnce(overloadedError)
      .mockRejectedValueOnce(overloadedError)
      .mockRejectedValueOnce(overloadedError);

    const result = await service.generateSQL('system', 'test');

    expect(mockCreate).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    expect(result.error).toBe('AI unavailable');
    expect(result.tokensUsed).toBe(0);
  }, 60000);

  it('should not retry on non-529 errors', async () => {
    const otherError = new Error('Bad request');
    (otherError as unknown as { status: number }).status = 400;

    mockCreate.mockRejectedValueOnce(otherError);

    const result = await service.generateSQL('system', 'test');

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result.error).toBe('AI unavailable');
  });

  it('should handle timeout', async () => {
    // Mock a very slow response — use 0 retries for faster test
    mockCreate.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 60000)));

    const result = await service.generateSQL('system', 'test', 0);

    expect(result.error).toBe('AI unavailable');
  }, 35000);

  it('should respect maxRetries parameter (0 = no retry)', async () => {
    const overloadedError = new Error('Overloaded');
    (overloadedError as unknown as { status: number }).status = 529;

    mockCreate.mockRejectedValue(overloadedError);

    const result = await service.generateSQL('system', 'test', 0);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result.error).toBe('AI unavailable');
  });

  it('should support custom maxRetries (5 for Enterprise)', async () => {
    const overloadedError = new Error('Overloaded');
    (overloadedError as unknown as { status: number }).status = 529;

    mockCreate
      .mockRejectedValueOnce(overloadedError)
      .mockRejectedValueOnce(overloadedError)
      .mockRejectedValueOnce(overloadedError)
      .mockRejectedValueOnce(overloadedError)
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: '```sql\nSELECT 1\n```' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });

    const result = await service.generateSQL('system', 'test', 5);

    expect(mockCreate).toHaveBeenCalledTimes(5);
    expect(result.sql).toBe('SELECT 1');
  }, 60000);
});
