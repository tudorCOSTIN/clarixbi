import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../admin/entities/audit-log.entity';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedSql: string;
  params?: Record<string, string>;
}

const ALLOWED_TABLES = [
  'invoices',
  'customers',
  'orders',
  'order_items',
  'products',
  'payments',
  'csv_data',
];

const CSV_TABLE_PATTERN = /^csv_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_FUNCTIONS = new Set([
  // Aggregate
  'sum',
  'count',
  'avg',
  'min',
  'max',
  'distinct',
  'coalesce',
  'case',
  'if',
  'ifnull',
  // Window
  'row_number',
  'rank',
  'dense_rank',
  'lag',
  'lead',
  'ntile',
  'percent_rank',
  // Time
  'date_trunc',
  'date_diff',
  'date_add',
  'date_sub',
  'extract',
  'now',
  'today',
  'toyyyymm',
  'todate',
  'todatetime',
  'tostartofmonth',
  'tostartofweek',
  // Statistical
  'median',
  'stddev',
  'variance',
  'quantile',
  // Text
  'lower',
  'upper',
  'trim',
  'concat',
  'like',
  'length',
  'substring',
  'replace',
  // Cast
  'cast',
  'tofloat64',
  'touint32',
  'tostring',
]);

const DENIED_OPERATIONS = new Set([
  'update',
  'delete',
  'insert',
  'drop',
  'alter',
  'create',
  'truncate',
  'grant',
  'revoke',
]);

// SQL keywords that may appear with parentheses but aren't functions
const SQL_KEYWORDS = new Set([
  'select',
  'from',
  'where',
  'and',
  'or',
  'not',
  'in',
  'between',
  'as',
  'on',
  'over',
  'partition',
  'order',
  'group',
  'having',
  'when',
  'then',
  'else',
  'end',
  'join',
  'left',
  'right',
  'inner',
  'outer',
  'cross',
  'values',
  'set',
  'exists',
]);

@Injectable()
export class SqlValidatorService {
  private readonly logger = new Logger(SqlValidatorService.name);

  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>,
  ) {}

  async validate(sql: string, orgId: string): Promise<ValidationResult> {
    const errors: string[] = [];
    let sanitizedSql = sql.trim();

    // Remove trailing semicolons
    sanitizedSql = sanitizedSql.replace(/;\s*$/, '');

    // Check for denied operations
    const firstWord = sanitizedSql.split(/\s+/)[0]?.toLowerCase();
    if (!firstWord || DENIED_OPERATIONS.has(firstWord)) {
      const result: ValidationResult = {
        isValid: false,
        errors: [
          `Operation '${firstWord?.toUpperCase() || 'EMPTY'}' is not allowed. Only SELECT queries are permitted.`,
        ],
        sanitizedSql: '',
      };
      await this.logValidation(sql, result);
      return result;
    }

    if (firstWord !== 'select') {
      const result: ValidationResult = {
        isValid: false,
        errors: [
          `Operation '${firstWord.toUpperCase()}' is not allowed. Only SELECT queries are permitted.`,
        ],
        sanitizedSql: '',
      };
      await this.logValidation(sql, result);
      return result;
    }

    // Check for UNION, INTERSECT, EXCEPT (outside of string literals)
    const sqlNoStrings = sanitizedSql.replace(/'[^']*'/g, '');
    if (/\bUNION\b/i.test(sqlNoStrings)) {
      errors.push('UNION operations are not allowed.');
    }
    if (/\bINTERSECT\b/i.test(sqlNoStrings)) {
      errors.push('INTERSECT operations are not allowed.');
    }
    if (/\bEXCEPT\b/i.test(sqlNoStrings)) {
      errors.push('EXCEPT operations are not allowed.');
    }

    // Check for INTO / OUTFILE
    if (/\b(INTO\s+OUTFILE|INTO\s+DUMPFILE)\b/i.test(sqlNoStrings)) {
      errors.push('INTO/OUTFILE operations are not allowed.');
    }

    if (errors.length > 0) {
      const result: ValidationResult = { isValid: false, errors, sanitizedSql: '' };
      await this.logValidation(sql, result);
      return result;
    }

    // Validate tables
    const tables = this.extractTablesRegex(sqlNoStrings);
    for (const table of tables) {
      if (!this.isAllowedTable(table)) {
        errors.push(
          `Table '${table}' is not allowed. Allowed tables: ${ALLOWED_TABLES.join(', ')}`,
        );
      }
    }

    // Validate functions
    const functions = this.extractFunctionsRegex(sqlNoStrings);
    for (const fn of functions) {
      if (!ALLOWED_FUNCTIONS.has(fn.toLowerCase())) {
        errors.push(`Function '${fn}' is not allowed.`);
      }
    }

    // Check subquery nesting depth
    const maxDepth = this.getSubqueryDepth(sqlNoStrings);
    if (maxDepth > 2) {
      errors.push('Subqueries nested more than 2 levels are not allowed.');
    }

    if (errors.length > 0) {
      const result: ValidationResult = { isValid: false, errors, sanitizedSql: '' };
      await this.logValidation(sql, result);
      return result;
    }

    // Fix LIMIT if > 1000
    sanitizedSql = this.enforceLimitCap(sanitizedSql);

    // Ensure org_id filter (parameterized)
    const orgIdAlreadyPresent = /\borg_id\s*=/i.test(sanitizedSql);
    sanitizedSql = this.ensureOrgIdFilter(sanitizedSql);

    const params: Record<string, string> = {};
    if (!orgIdAlreadyPresent) {
      params['org_id_param'] = orgId;
    }

    const result: ValidationResult = {
      isValid: true,
      errors: [],
      sanitizedSql,
      ...(Object.keys(params).length > 0 ? { params } : {}),
    };
    await this.logValidation(sql, result);
    return result;
  }

  private isAllowedTable(tableName: string): boolean {
    const lower = tableName.toLowerCase();
    if (ALLOWED_TABLES.includes(lower)) return true;
    if (CSV_TABLE_PATTERN.test(lower)) return true;
    // Explicitly deny system/info_schema
    if (lower.startsWith('system.') || lower.startsWith('information_schema.')) return false;
    return false;
  }

  private extractTablesRegex(sql: string): string[] {
    const tables: string[] = [];

    // Match FROM <table>, JOIN <table> (including dotted names like system.tables)
    const fromPattern = /\bFROM\s+([\w.]+)/gi;
    const joinPattern = /\bJOIN\s+([\w.]+)/gi;

    let match: RegExpExecArray | null;
    while ((match = fromPattern.exec(sql)) !== null) {
      if (match[1]) tables.push(match[1]);
    }
    while ((match = joinPattern.exec(sql)) !== null) {
      if (match[1]) tables.push(match[1]);
    }

    // Remove aliases - common pattern: table AS alias or table alias
    return [...new Set(tables)].filter((t) => t && !SQL_KEYWORDS.has(t.toLowerCase()));
  }

  private extractFunctionsRegex(sql: string): string[] {
    const functions: string[] = [];
    const pattern = /\b([a-zA-Z_]\w*)\s*\(/g;

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(sql)) !== null) {
      const funcName = match[1];
      if (funcName && !SQL_KEYWORDS.has(funcName.toLowerCase())) {
        functions.push(funcName);
      }
    }

    return [...new Set(functions)];
  }

  private getSubqueryDepth(sql: string): number {
    // Count nesting of SELECT within parentheses
    let maxDepth = 0;
    let currentDepth = 0;

    // Simple approach: count depth of nested SELECTs
    const tokens = sql.split(/\b/);
    let parenDepth = 0;

    for (const token of tokens) {
      if (token === '(') parenDepth++;
      if (token === ')') parenDepth--;
      if (token.toUpperCase() === 'SELECT' && parenDepth > 0) {
        currentDepth = parenDepth;
        maxDepth = Math.max(maxDepth, currentDepth);
      }
    }

    return maxDepth;
  }

  private enforceLimitCap(sql: string): string {
    const limitMatch = sql.match(/\bLIMIT\s+(\d+)/i);
    if (limitMatch) {
      const limitVal = parseInt(limitMatch[1]!, 10);
      if (limitVal > 1000) {
        sql = sql.replace(/\bLIMIT\s+\d+/i, 'LIMIT 1000');
      }
    } else {
      sql = sql + ' LIMIT 1000';
    }
    return sql;
  }

  private ensureOrgIdFilter(sql: string): string {
    if (/\borg_id\s*=/i.test(sql)) {
      return sql;
    }

    const orgIdPlaceholder = `org_id = {org_id_param:String}`;

    const whereMatch = /\bWHERE\b/i.exec(sql);
    if (whereMatch) {
      const afterWhere = whereMatch.index + whereMatch[0].length;
      sql = sql.substring(0, afterWhere) + ` ${orgIdPlaceholder} AND` + sql.substring(afterWhere);
    } else {
      const insertBefore = sql.search(/\b(GROUP\s+BY|ORDER\s+BY|LIMIT|HAVING)\b/i);
      if (insertBefore > -1) {
        sql =
          sql.substring(0, insertBefore) +
          `WHERE ${orgIdPlaceholder} ` +
          sql.substring(insertBefore);
      } else {
        sql = sql + ` WHERE ${orgIdPlaceholder}`;
      }
    }
    return sql;
  }

  private async logValidation(sql: string, result: ValidationResult): Promise<void> {
    try {
      await this.auditLogRepo.save({
        action: 'ai_sql_validation',
        entity_type: 'ai_query',
        details: {
          sql,
          isValid: result.isValid,
          errors: result.errors,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to log SQL validation: ${error}`);
    }
  }
}
