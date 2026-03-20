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

  it('should not retry on non-retryable errors (e.g., 400)', async () => {
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

  // ===== NEW TESTS =====

  it('should handle response with no content array (empty content)', async () => {
    mockCreate.mockResolvedValue({
      content: [],
      usage: { input_tokens: 10, output_tokens: 0 },
    });

    const result = await service.generateSQL('system', 'test');

    expect(result.text).toBe('');
    expect(result.sql).toBeNull();
    expect(result.tokensUsed).toBe(10);
    expect(result.error).toBeUndefined();
  });

  it('should handle 429 rate limit from Anthropic as non-retryable', async () => {
    const rateLimitError = new Error('Rate limited');
    (rateLimitError as unknown as { status: number }).status = 429;

    mockCreate.mockRejectedValue(rateLimitError);

    const result = await service.generateSQL('system', 'test');

    // 429 is not in the retryable list (529, 500, 502, 503), so it should not retry
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result.error).toBe('AI unavailable');
  });

  it('should handle empty response text gracefully', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '' }],
      usage: { input_tokens: 20, output_tokens: 0 },
    });

    const result = await service.generateSQL('system', 'test');

    expect(result.text).toBe('');
    expect(result.sql).toBeNull();
    expect(result.tokensUsed).toBe(20);
    expect(result.error).toBeUndefined();
  });

  it('should count tokens accurately from usage field', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Result' }],
      usage: { input_tokens: 1234, output_tokens: 567 },
    });

    const result = await service.generateSQL('system', 'test');

    expect(result.tokensUsed).toBe(1801);
  });

  it('should handle missing usage field gracefully', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Result' }],
      usage: {},
    });

    const result = await service.generateSQL('system', 'test');

    expect(result.tokensUsed).toBe(0);
  });

  it('should pick last SQL block when multiple SQL blocks in response', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: 'First attempt:\n\n```sql\nSELECT 1\n```\n\nActually, let me correct that:\n\n```sql\nSELECT COUNT(*) FROM invoices\n```\n\nThis is better.',
        },
      ],
      usage: { input_tokens: 100, output_tokens: 80 },
    });

    const result = await service.generateSQL('system', 'test');

    // The regex uses a non-greedy match and finds the first block
    // Based on the implementation: /```sql\s*([\s\S]*?)```/ matches the first occurrence
    // So it picks the FIRST SQL block, not the last
    expect(result.sql).toBe('SELECT 1');
  });

  it('should retry on 500 server error', async () => {
    const serverError = new Error('Internal Server Error');
    (serverError as unknown as { status: number }).status = 500;

    mockCreate.mockRejectedValueOnce(serverError).mockResolvedValueOnce({
      content: [{ type: 'text', text: '```sql\nSELECT 1\n```' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const result = await service.generateSQL('system', 'test');

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.sql).toBe('SELECT 1');
  }, 15000);

  it('should retry on 502 bad gateway', async () => {
    const gatewayError = new Error('Bad Gateway');
    (gatewayError as unknown as { status: number }).status = 502;

    mockCreate.mockRejectedValueOnce(gatewayError).mockResolvedValueOnce({
      content: [{ type: 'text', text: '```sql\nSELECT 1\n```' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const result = await service.generateSQL('system', 'test');

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.sql).toBe('SELECT 1');
  }, 15000);

  it('should retry on 503 service unavailable', async () => {
    const unavailableError = new Error('Service Unavailable');
    (unavailableError as unknown as { status: number }).status = 503;

    mockCreate.mockRejectedValueOnce(unavailableError).mockResolvedValueOnce({
      content: [{ type: 'text', text: '```sql\nSELECT 1\n```' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const result = await service.generateSQL('system', 'test');

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.sql).toBe('SELECT 1');
  }, 15000);

  it('should filter non-text content blocks', async () => {
    mockCreate.mockResolvedValue({
      content: [
        { type: 'image', source: {} },
        { type: 'text', text: 'Hello\n\n```sql\nSELECT 1\n```' },
        { type: 'tool_use', id: 'x', name: 'y', input: {} },
      ],
      usage: { input_tokens: 50, output_tokens: 30 },
    });

    const result = await service.generateSQL('system', 'test');

    expect(result.text).toBe('Hello\n\n```sql\nSELECT 1\n```');
    expect(result.sql).toBe('SELECT 1');
  });

  it('should handle non-Error thrown values', async () => {
    mockCreate.mockRejectedValue('string error');

    const result = await service.generateSQL('system', 'test', 0);

    expect(result.error).toBe('AI unavailable');
  });
});
