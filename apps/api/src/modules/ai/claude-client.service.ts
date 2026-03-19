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
  private readonly maxRetries = 3;
  private readonly timeout = 30000;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env['CLAUDE_API_KEY'] || '',
    });
  }

  async generateSQL(systemPrompt: string, userMessage: string): Promise<ClaudeResponse> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
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

        if (statusCode === 529 && attempt < this.maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          this.logger.warn(
            `Claude API overloaded (529), retry ${attempt}/${this.maxRetries} in ${delay}ms`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        if (statusCode !== 529) {
          break;
        }
      }
    }

    this.logger.error(`Claude API failed after ${this.maxRetries} retries: ${lastError?.message}`);
    return {
      text: '',
      sql: null,
      tokensUsed: 0,
      error: 'AI unavailable',
    };
  }
}
