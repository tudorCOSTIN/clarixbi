import { Injectable, Logger, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClaudeClientService } from './claude-client.service';
import { SqlValidatorService } from './sql-validator.service';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import { AiRateLimitService, AiUsageInfo } from './ai-rate-limit.service';
import { AIConversation } from './entities/ai-conversation.entity';
import { AIMessage, AIMessageRole } from './entities/ai-message.entity';

type ChartType = 'kpi' | 'line' | 'bar' | 'pie' | 'table';

interface SendMessageResult {
  response: string;
  sql: string | null;
  data: Record<string, unknown>[] | null;
  chartType: ChartType;
  chartConfig: Record<string, unknown>;
}

const AVAILABLE_TABLES = [
  'invoices',
  'customers',
  'orders',
  'order_items',
  'products',
  'payments',
  'csv_data',
];

const RO_INDICATORS = [
  'ă',
  'â',
  'î',
  'ș',
  'ț',
  'Ă',
  'Â',
  'Î',
  'Ș',
  'Ț',
  'sunt',
  'este',
  'care',
  'pentru',
  'arata',
  'vreau',
  'cate',
  'cati',
  'cele',
  'mai',
  'din',
  'facturi',
  'clienti',
  'vanzari',
  'luna',
  'ultimele',
];

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @InjectRepository(AIConversation)
    private conversationRepo: Repository<AIConversation>,
    @InjectRepository(AIMessage)
    private messageRepo: Repository<AIMessage>,
    private claudeClient: ClaudeClientService,
    private sqlValidator: SqlValidatorService,
    private clickhouse: ClickHouseService,
    private rateLimitService: AiRateLimitService,
  ) {}

  async createConversation(orgId: string, userId: string): Promise<AIConversation> {
    const conversation = this.conversationRepo.create({
      org_id: orgId,
      user_id: userId,
      title: null,
      message_count: 0,
    });
    return this.conversationRepo.save(conversation);
  }

  async listConversations(
    orgId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: AIConversation[]; total: number }> {
    const [data, total] = await this.conversationRepo.findAndCount({
      where: { org_id: orgId },
      order: { updated_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async getConversation(orgId: string, conversationId: string): Promise<AIConversation> {
    const conv = await this.conversationRepo.findOne({
      where: { id: conversationId, org_id: orgId },
      relations: ['messages'],
      order: { messages: { created_at: 'ASC' } },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    return conv;
  }

  async deleteConversation(orgId: string, conversationId: string): Promise<void> {
    const conv = await this.conversationRepo.findOne({
      where: { id: conversationId, org_id: orgId },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    await this.conversationRepo.remove(conv);
  }

  async sendMessage(
    orgId: string,
    userId: string,
    conversationId: string,
    userMessage: string,
  ): Promise<SendMessageResult> {
    const startTime = Date.now();

    // Check rate limit before Claude API call
    const { allowed, usage } = await this.rateLimitService.checkAndIncrement(orgId, userId);
    if (!allowed) {
      throw new HttpException(
        {
          error: 'AI_RATE_LIMIT',
          message: 'Ai atins limita de interogari AI. Upgradeaza planul.',
          used: usage.used,
          limit: usage.limit,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Get or verify conversation
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId, org_id: orgId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    // Save user message
    await this.messageRepo.save({
      conversation_id: conversationId,
      role: AIMessageRole.USER,
      content: userMessage,
      tokens_used: 0,
    });

    // Detect language
    const lang = this.detectLanguage(userMessage);

    // Fetch schema metadata
    const schema = await this.getSchemaMetadata(orgId);

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(schema, orgId, lang);

    // Get retry config based on plan
    const retryConfig = await this.rateLimitService.getRetryConfig(orgId);

    // Call Claude API with plan-based retry
    const claudeResponse = await this.claudeClient.generateSQL(
      systemPrompt,
      userMessage,
      retryConfig.maxRetries,
    );

    if (claudeResponse.error) {
      const errorMsg =
        lang === 'ro'
          ? 'Serviciul AI nu este disponibil momentan. Te rugam sa incerci din nou.'
          : 'AI service is currently unavailable. Please try again.';

      await this.messageRepo.save({
        conversation_id: conversationId,
        role: AIMessageRole.ASSISTANT,
        content: errorMsg,
        tokens_used: 0,
        latency_ms: Date.now() - startTime,
      });

      conversation.message_count += 2;
      await this.conversationRepo.save(conversation);

      return {
        response: errorMsg,
        sql: null,
        data: null,
        chartType: 'table',
        chartConfig: {},
      };
    }

    let data: Record<string, unknown>[] | null = null;
    let chartType: ChartType = 'table';
    let chartConfig: Record<string, unknown> = {};
    // Remove SQL code block from display text
    const cleanText = claudeResponse.text.replace(/```sql[\s\S]*?```/g, '').trim();
    let displayText = cleanText;

    if (claudeResponse.sql) {
      // Validate SQL
      const validation = await this.sqlValidator.validate(claudeResponse.sql, orgId);

      if (validation.isValid) {
        try {
          data = await this.clickhouse.query(validation.sanitizedSql);
          chartType = this.determineChartType(data);
          chartConfig = this.buildChartConfig(data, chartType);
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : 'Query execution failed';
          this.logger.error(`ClickHouse query failed: ${errMsg}`);
          displayText =
            lang === 'ro'
              ? `Am generat o interogare, dar a aparut o eroare la executie: ${errMsg}`
              : `I generated a query, but an error occurred during execution: ${errMsg}`;
          data = null;
        }
      } else {
        displayText =
          lang === 'ro'
            ? `Interogarea generata nu a trecut validarea de securitate: ${validation.errors.join('; ')}`
            : `The generated query failed security validation: ${validation.errors.join('; ')}`;
      }
    }

    // Save assistant message
    await this.messageRepo.save({
      conversation_id: conversationId,
      role: AIMessageRole.ASSISTANT,
      content: displayText,
      generated_sql: claudeResponse.sql,
      query_result: data ? { rows: data, chartType, chartConfig } : null,
      tokens_used: claudeResponse.tokensUsed,
      latency_ms: Date.now() - startTime,
    });

    // Update conversation
    conversation.message_count += 2;
    if (!conversation.title && userMessage.length > 0) {
      conversation.title =
        userMessage.length > 100 ? userMessage.substring(0, 100) + '...' : userMessage;
    }
    await this.conversationRepo.save(conversation);

    return {
      response: displayText,
      sql: claudeResponse.sql,
      data,
      chartType,
      chartConfig,
    };
  }

  async getUsage(orgId: string): Promise<AiUsageInfo> {
    return this.rateLimitService.getUsage(orgId);
  }

  private detectLanguage(text: string): 'ro' | 'en' {
    const lower = text.toLowerCase();
    for (const indicator of RO_INDICATORS) {
      if (lower.includes(indicator.toLowerCase())) return 'ro';
    }
    return 'en';
  }

  private async getSchemaMetadata(orgId: string): Promise<string> {
    const schemaLines: string[] = [];

    for (const table of AVAILABLE_TABLES) {
      try {
        const columns = await this.clickhouse.query<{ name: string; type: string }>(
          `SELECT name, type FROM system.columns WHERE database = currentDatabase() AND table = '${table}' ORDER BY position`,
        );

        if (columns.length === 0) continue;

        let samples: Record<string, unknown>[] = [];
        try {
          samples = await this.clickhouse.query(
            `SELECT * FROM ${table} WHERE org_id = '${orgId}' LIMIT 3`,
          );
        } catch {
          // Table might be empty for this org
        }

        schemaLines.push(`\nTable: ${table}`);
        schemaLines.push('Columns:');
        for (const col of columns) {
          const sampleVals = samples
            .map((row) => row[col.name])
            .filter((v) => v !== null && v !== undefined)
            .slice(0, 3);
          const sampleStr = sampleVals.length > 0 ? ` (examples: ${sampleVals.join(', ')})` : '';
          schemaLines.push(`  - ${col.name}: ${col.type}${sampleStr}`);
        }
      } catch (error) {
        this.logger.debug(`Could not get schema for table ${table}: ${error}`);
      }
    }

    return schemaLines.join('\n');
  }

  private buildSystemPrompt(schema: string, orgId: string, lang: 'ro' | 'en'): string {
    if (lang === 'ro') {
      return `Esti un analist de date expert. Genereaza SQL ClickHouse valid.

REGULI STRICTE:
- Genereaza DOAR SELECT queries
- Foloseste DOAR tabelele si coloanele din schema de mai jos
- Include INTOTDEAUNA: WHERE org_id = '${orgId}'
- LIMIT maxim 1000 rows
- Raspunde in romana (aceeasi limba ca intrebarea)
- Explica rezultatul in 2-3 propozitii
- Pune SQL-ul intre \`\`\`sql ... \`\`\` code blocks

SCHEMA DISPONIBILA:
${schema}

FUNCTII PERMISE:
Aggregate: SUM, COUNT, AVG, MIN, MAX, DISTINCT, COALESCE, CASE, IF
Window: ROW_NUMBER, RANK, DENSE_RANK, LAG, LEAD, NTILE
Time: DATE_TRUNC, DATE_DIFF, EXTRACT, NOW, TODAY, toYYYYMM, toDate
Statistical: MEDIAN, STDDEV, VARIANCE
Text: LOWER, UPPER, TRIM, CONCAT, LIKE
Grouping: GROUP BY, ORDER BY, HAVING, LIMIT`;
    }

    return `You are an expert data analyst. Generate valid ClickHouse SQL.

STRICT RULES:
- Generate ONLY SELECT queries
- Use ONLY tables and columns from the schema below
- ALWAYS include: WHERE org_id = '${orgId}'
- Maximum LIMIT 1000 rows
- Answer in English (same language as the question)
- Explain the result in 2-3 sentences
- Put SQL inside \`\`\`sql ... \`\`\` code blocks

AVAILABLE SCHEMA:
${schema}

ALLOWED FUNCTIONS:
Aggregate: SUM, COUNT, AVG, MIN, MAX, DISTINCT, COALESCE, CASE, IF
Window: ROW_NUMBER, RANK, DENSE_RANK, LAG, LEAD, NTILE
Time: DATE_TRUNC, DATE_DIFF, EXTRACT, NOW, TODAY, toYYYYMM, toDate
Statistical: MEDIAN, STDDEV, VARIANCE
Text: LOWER, UPPER, TRIM, CONCAT, LIKE
Grouping: GROUP BY, ORDER BY, HAVING, LIMIT`;
  }

  private determineChartType(data: Record<string, unknown>[]): ChartType {
    if (!data || data.length === 0) return 'table';

    const firstRow = data[0]!;
    const columns = Object.keys(firstRow);

    if (data.length === 1) {
      const numericCols = columns.filter(
        (c) => typeof firstRow[c] === 'number' || !isNaN(Number(firstRow[c])),
      );
      if (numericCols.length === 1 && columns.length <= 2) return 'kpi';
    }

    const stringCols = columns.filter(
      (c) => typeof firstRow[c] === 'string' && isNaN(Number(firstRow[c])),
    );
    const numericCols = columns.filter(
      (c) =>
        typeof firstRow[c] === 'number' ||
        (!isNaN(Number(firstRow[c])) && firstRow[c] !== null && firstRow[c] !== ''),
    );
    const dateCols = columns.filter((c) => {
      const val = String(firstRow[c] || '');
      return /^\d{4}-\d{2}/.test(val) || /^\d{4}\d{2}$/.test(val);
    });

    if (data.length > 1 && dateCols.length > 0) return 'line';
    if (data.length > 1 && stringCols.length >= 1 && numericCols.length >= 1) {
      if (data.length < 5) return 'pie';
      return 'bar';
    }

    return 'table';
  }

  private buildChartConfig(
    data: Record<string, unknown>[],
    chartType: ChartType,
  ): Record<string, unknown> {
    if (!data || data.length === 0) return {};

    const firstRow = data[0]!;
    const columns = Object.keys(firstRow);

    const stringCols = columns.filter(
      (c) => typeof firstRow[c] === 'string' && isNaN(Number(firstRow[c])),
    );
    const numericCols = columns.filter(
      (c) =>
        typeof firstRow[c] === 'number' ||
        (!isNaN(Number(firstRow[c])) && firstRow[c] !== null && firstRow[c] !== ''),
    );

    switch (chartType) {
      case 'kpi': {
        const valueCol = numericCols[0] || columns[0]!;
        const labelCol = stringCols[0];
        return {
          valueKey: valueCol,
          labelKey: labelCol,
          value: Number(firstRow[valueCol]),
          label: labelCol ? String(firstRow[labelCol]) : valueCol,
        };
      }
      case 'line':
      case 'bar': {
        const xKey = stringCols[0] || columns[0];
        const yKeys = numericCols.length > 0 ? numericCols : [columns[1] || columns[0]];
        return { xKey, yKeys };
      }
      case 'pie': {
        const nameKey = stringCols[0] || columns[0];
        const valueKey = numericCols[0] || columns[1] || columns[0];
        return { nameKey, valueKey };
      }
      default:
        return {};
    }
  }
}
