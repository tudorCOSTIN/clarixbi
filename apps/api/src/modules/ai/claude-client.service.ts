import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

interface ClaudeResponse {
  text: string;
  sql: string | null;
  tokensUsed: number;
  error?: string;
}

@Injectable()
export class ClaudeClientService {
  private readonly logger = new Logger(ClaudeClientService.name);
  private client: Anthropic;
  private readonly model = 'claude-sonnet-4-5-20250514';
  private readonly timeout = 30000;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env['CLAUDE_API_KEY'] || '',
    });
  }

  async generateSQL(
    systemPrompt: string,
    userMessage: string,
    maxRetries = 3,
  ): Promise<ClaudeResponse> {
    let lastError: Error | null = null;
    const attempts = maxRetries + 1; // maxRetries=0 means 1 attempt

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const response = await Promise.race([
          this.client.messages.create({
            model: this.model,
            max_tokens: 2048,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }],
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), this.timeout),
          ),
        ]);

        const textContent = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map((block) => block.text)
          .join('\n');

        const sqlMatch = textContent.match(/```sql\s*([\s\S]*?)```/);
        const sql = sqlMatch?.[1] ? sqlMatch[1].trim() : null;

        const tokensUsed =
          (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

        this.logger.log(
          `Claude API: ${response.usage?.input_tokens} input + ${response.usage?.output_tokens} output tokens`,
        );

        return { text: textContent, sql, tokensUsed };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const statusCode = (error as { status?: number })?.status;
        const isRetryable =
          statusCode === 529 ||
          statusCode === 500 ||
          statusCode === 502 ||
          statusCode === 503 ||
          lastError.message === 'Request timeout';

        if (isRetryable && attempt < attempts) {
          const delay = Math.pow(2, attempt) * 1000;
          this.logger.warn(
            `Claude API failed (${statusCode || 'timeout'}), retry ${attempt}/${attempts - 1} in ${delay}ms`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        // Non-retryable error or out of retries — break immediately
        break;
      }
    }

    this.logger.error(`Claude API failed after retries: ${lastError?.message}`);
    return {
      text: '',
      sql: null,
      tokensUsed: 0,
      error: 'AI unavailable',
    };
  }
}
