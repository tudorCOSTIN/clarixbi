import { Injectable, BadRequestException } from '@nestjs/common';

interface WidgetQueryConfig {
  table?: string;
  metric?: string;
  aggregation?: string;
  dateColumn?: string;
  granularity?: string;
  categoryColumn?: string;
  columns?: string[];
  orderColumn?: string;
  limit?: number;
}

const ALLOWED_TABLES = new Set([
  'invoices',
  'customers',
  'orders',
  'order_items',
  'products',
  'payments',
  'csv_data',
]);

const CSV_TABLE_PATTERN = /^csv_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_AGGREGATIONS = new Set(['SUM', 'COUNT', 'AVG', 'MIN', 'MAX']);

const IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const MAX_LIMIT_KPI = 1;
const MAX_LIMIT_CHART = 1000;
const MAX_LIMIT_TABLE = 100;
const MAX_LIMIT_PIE = 20;

@Injectable()
export class QueryBuilderService {
  buildQuery(widgetType: string, config: WidgetQueryConfig, orgId: string): string {
    switch (widgetType) {
      case 'kpi':
        return this.buildKpiQuery(config, orgId);
      case 'line':
        return this.buildLineChartQuery(config, orgId);
      case 'bar':
        return this.buildBarChartQuery(config, orgId);
      case 'pie':
        return this.buildPieChartQuery(config, orgId);
      case 'table':
        return this.buildTableQuery(config, orgId);
      default:
        throw new BadRequestException(`Unsupported widget type: ${widgetType}`);
    }
  }

  buildKpiQuery(config: WidgetQueryConfig, _orgId: string): string {
    const table = this.validateTable(config.table);
    const metric = this.validateIdentifier(config.metric, 'metric');
    const aggregation = this.validateAggregation(config.aggregation);

    return (
      `SELECT ${aggregation}(${metric}) AS value ` +
      `FROM ${table} ` +
      `WHERE org_id = {orgId:String}` +
      ` LIMIT ${MAX_LIMIT_KPI}`
    );
  }

  buildLineChartQuery(config: WidgetQueryConfig, _orgId: string): string {
    const table = this.validateTable(config.table);
    const metric = this.validateIdentifier(config.metric, 'metric');
    const aggregation = this.validateAggregation(config.aggregation);
    const dateColumn = this.validateIdentifier(config.dateColumn, 'dateColumn');
    const granularity = this.validateGranularity(config.granularity);

    const dateTrunc = `toStartOf${granularity}(${dateColumn})`;

    return (
      `SELECT ${dateTrunc} AS period, ${aggregation}(${metric}) AS value ` +
      `FROM ${table} ` +
      `WHERE org_id = {orgId:String} ` +
      `GROUP BY period ` +
      `ORDER BY period ASC` +
      ` LIMIT ${MAX_LIMIT_CHART}`
    );
  }

  buildBarChartQuery(config: WidgetQueryConfig, _orgId: string): string {
    const table = this.validateTable(config.table);
    const metric = this.validateIdentifier(config.metric, 'metric');
    const aggregation = this.validateAggregation(config.aggregation);
    const categoryColumn = this.validateIdentifier(config.categoryColumn, 'categoryColumn');
    const limit = Math.min(config.limit || 10, MAX_LIMIT_CHART);

    return (
      `SELECT ${categoryColumn} AS category, ${aggregation}(${metric}) AS value ` +
      `FROM ${table} ` +
      `WHERE org_id = {orgId:String} ` +
      `GROUP BY category ` +
      `ORDER BY value DESC` +
      ` LIMIT ${limit}`
    );
  }

  buildPieChartQuery(config: WidgetQueryConfig, _orgId: string): string {
    const table = this.validateTable(config.table);
    const metric = this.validateIdentifier(config.metric, 'metric');
    const aggregation = this.validateAggregation(config.aggregation);
    const categoryColumn = this.validateIdentifier(config.categoryColumn, 'categoryColumn');
    const limit = Math.min(config.limit || 5, MAX_LIMIT_PIE);

    return (
      `SELECT ${categoryColumn} AS category, ${aggregation}(${metric}) AS value ` +
      `FROM ${table} ` +
      `WHERE org_id = {orgId:String} ` +
      `GROUP BY category ` +
      `ORDER BY value DESC` +
      ` LIMIT ${limit}`
    );
  }

  buildTableQuery(config: WidgetQueryConfig, _orgId: string): string {
    const table = this.validateTable(config.table);
    const limit = Math.min(config.limit || 100, MAX_LIMIT_TABLE);

    let columnList: string;
    if (config.columns && config.columns.length > 0) {
      const validated = config.columns.map((col) => this.validateIdentifier(col, 'column'));
      columnList = validated.join(', ');
    } else {
      columnList = '*';
    }

    let orderClause = '';
    if (config.orderColumn) {
      const orderCol = this.validateIdentifier(config.orderColumn, 'orderColumn');
      orderClause = ` ORDER BY ${orderCol} DESC`;
    }

    return (
      `SELECT ${columnList} ` +
      `FROM ${table} ` +
      `WHERE org_id = {orgId:String}` +
      orderClause +
      ` LIMIT ${limit}`
    );
  }

  private validateTable(table: string | undefined): string {
    if (!table) {
      throw new BadRequestException('Table is required in widget config');
    }
    const lower = table.toLowerCase();
    if (!ALLOWED_TABLES.has(lower) && !CSV_TABLE_PATTERN.test(lower)) {
      throw new BadRequestException(
        `Table '${table}' is not allowed. Allowed: ${[...ALLOWED_TABLES].join(', ')}`,
      );
    }
    return table;
  }

  private validateIdentifier(value: string | undefined, fieldName: string): string {
    if (!value) {
      throw new BadRequestException(`${fieldName} is required in widget config`);
    }
    if (!IDENTIFIER_PATTERN.test(value)) {
      throw new BadRequestException(
        `Invalid ${fieldName}: '${value}'. Only alphanumeric characters and underscores are allowed.`,
      );
    }
    return value;
  }

  private validateAggregation(aggregation: string | undefined): string {
    const agg = (aggregation || 'SUM').toUpperCase();
    if (!ALLOWED_AGGREGATIONS.has(agg)) {
      throw new BadRequestException(
        `Aggregation '${agg}' is not allowed. Allowed: ${[...ALLOWED_AGGREGATIONS].join(', ')}`,
      );
    }
    return agg;
  }

  private validateGranularity(granularity: string | undefined): string {
    const allowed: Record<string, string> = {
      day: 'Day',
      week: 'Week',
      month: 'Month',
      quarter: 'Quarter',
      year: 'Year',
    };
    const key = (granularity || 'month').toLowerCase();
    const mapped = allowed[key];
    if (!mapped) {
      throw new BadRequestException(
        `Granularity '${granularity}' is not allowed. Allowed: ${Object.keys(allowed).join(', ')}`,
      );
    }
    return mapped;
  }
}
