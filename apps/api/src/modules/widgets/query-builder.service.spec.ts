import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { QueryBuilderService } from './query-builder.service';

describe('QueryBuilderService', () => {
  let service: QueryBuilderService;

  const orgId = uuid();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [QueryBuilderService],
    }).compile();

    service = module.get<QueryBuilderService>(QueryBuilderService);
  });

  describe('buildQuery', () => {
    it('should dispatch to buildKpiQuery for kpi type', () => {
      const sql = service.buildQuery(
        'kpi',
        {
          table: 'invoices',
          metric: 'total_amount',
          aggregation: 'SUM',
        },
        orgId,
      );

      expect(sql).toContain('SUM(total_amount)');
      expect(sql).toContain('FROM invoices');
    });

    it('should dispatch to buildLineChartQuery for line type', () => {
      const sql = service.buildQuery(
        'line',
        {
          table: 'invoices',
          metric: 'total_amount',
          aggregation: 'SUM',
          dateColumn: 'issue_date',
          granularity: 'month',
        },
        orgId,
      );

      expect(sql).toContain('toStartOfMonth');
      expect(sql).toContain('GROUP BY period');
    });

    it('should dispatch to buildBarChartQuery for bar type', () => {
      const sql = service.buildQuery(
        'bar',
        {
          table: 'invoices',
          metric: 'total_amount',
          aggregation: 'SUM',
          categoryColumn: 'client_name',
        },
        orgId,
      );

      expect(sql).toContain('client_name AS category');
      expect(sql).toContain('ORDER BY value DESC');
    });

    it('should dispatch to buildPieChartQuery for pie type', () => {
      const sql = service.buildQuery(
        'pie',
        {
          table: 'invoices',
          metric: 'total_amount',
          aggregation: 'SUM',
          categoryColumn: 'status',
        },
        orgId,
      );

      expect(sql).toContain('status AS category');
    });

    it('should dispatch to buildTableQuery for table type', () => {
      const sql = service.buildQuery(
        'table',
        {
          table: 'invoices',
          columns: ['invoice_number', 'total_amount'],
        },
        orgId,
      );

      expect(sql).toContain('SELECT invoice_number, total_amount');
    });

    it('should throw BadRequestException for unsupported widget type', () => {
      expect(() => service.buildQuery('unknown_type', { table: 'invoices' }, orgId)).toThrow(
        BadRequestException,
      );
      expect(() => service.buildQuery('unknown_type', { table: 'invoices' }, orgId)).toThrow(
        'Unsupported widget type: unknown_type',
      );
    });
  });

  describe('buildKpiQuery', () => {
    it('should generate correct SQL with SUM aggregation', () => {
      const sql = service.buildKpiQuery(
        { table: 'invoices', metric: 'total_amount', aggregation: 'SUM' },
        orgId,
      );

      expect(sql).toBe(
        'SELECT SUM(total_amount) AS value FROM invoices WHERE org_id = {orgId:String} LIMIT 1',
      );
    });

    it('should generate correct SQL with COUNT aggregation', () => {
      const sql = service.buildKpiQuery(
        { table: 'orders', metric: 'id', aggregation: 'COUNT' },
        orgId,
      );

      expect(sql).toBe(
        'SELECT COUNT(id) AS value FROM orders WHERE org_id = {orgId:String} LIMIT 1',
      );
    });

    it('should generate correct SQL with AVG aggregation', () => {
      const sql = service.buildKpiQuery(
        { table: 'invoices', metric: 'total_amount', aggregation: 'AVG' },
        orgId,
      );

      expect(sql).toContain('AVG(total_amount)');
    });

    it('should default aggregation to SUM when not provided', () => {
      const sql = service.buildKpiQuery({ table: 'invoices', metric: 'total_amount' }, orgId);

      expect(sql).toContain('SUM(total_amount)');
    });

    it('should include org_id filter as parameterized value', () => {
      const sql = service.buildKpiQuery(
        { table: 'invoices', metric: 'total_amount', aggregation: 'SUM' },
        orgId,
      );

      expect(sql).toContain('{orgId:String}');
    });
  });

  describe('buildLineChartQuery', () => {
    it('should GROUP BY date column with correct granularity', () => {
      const sql = service.buildLineChartQuery(
        {
          table: 'invoices',
          metric: 'total_amount',
          aggregation: 'SUM',
          dateColumn: 'issue_date',
          granularity: 'month',
        },
        orgId,
      );

      expect(sql).toBe(
        'SELECT toStartOfMonth(issue_date) AS period, SUM(total_amount) AS value ' +
          'FROM invoices WHERE org_id = {orgId:String} ' +
          'GROUP BY period ORDER BY period ASC LIMIT 1000',
      );
    });

    it('should use Day granularity', () => {
      const sql = service.buildLineChartQuery(
        {
          table: 'invoices',
          metric: 'total_amount',
          aggregation: 'SUM',
          dateColumn: 'issue_date',
          granularity: 'day',
        },
        orgId,
      );

      expect(sql).toContain('toStartOfDay(issue_date)');
    });

    it('should use Week granularity', () => {
      const sql = service.buildLineChartQuery(
        {
          table: 'invoices',
          metric: 'total_amount',
          aggregation: 'SUM',
          dateColumn: 'issue_date',
          granularity: 'week',
        },
        orgId,
      );

      expect(sql).toContain('toStartOfWeek(issue_date)');
    });

    it('should use Quarter granularity', () => {
      const sql = service.buildLineChartQuery(
        {
          table: 'invoices',
          metric: 'total_amount',
          aggregation: 'SUM',
          dateColumn: 'issue_date',
          granularity: 'quarter',
        },
        orgId,
      );

      expect(sql).toContain('toStartOfQuarter(issue_date)');
    });

    it('should use Year granularity', () => {
      const sql = service.buildLineChartQuery(
        {
          table: 'invoices',
          metric: 'total_amount',
          aggregation: 'SUM',
          dateColumn: 'issue_date',
          granularity: 'year',
        },
        orgId,
      );

      expect(sql).toContain('toStartOfYear(issue_date)');
    });

    it('should default granularity to month when not provided', () => {
      const sql = service.buildLineChartQuery(
        {
          table: 'invoices',
          metric: 'total_amount',
          aggregation: 'SUM',
          dateColumn: 'issue_date',
        },
        orgId,
      );

      expect(sql).toContain('toStartOfMonth(issue_date)');
    });

    it('should ORDER BY period ASC', () => {
      const sql = service.buildLineChartQuery(
        {
          table: 'invoices',
          metric: 'total_amount',
          aggregation: 'SUM',
          dateColumn: 'issue_date',
          granularity: 'month',
        },
        orgId,
      );

      expect(sql).toContain('ORDER BY period ASC');
    });

    it('should throw when dateColumn is missing', () => {
      expect(() =>
        service.buildLineChartQuery(
          { table: 'invoices', metric: 'total_amount', aggregation: 'SUM' },
          orgId,
        ),
      ).toThrow(BadRequestException);
    });

    it('should throw for invalid granularity', () => {
      expect(() =>
        service.buildLineChartQuery(
          {
            table: 'invoices',
            metric: 'total_amount',
            aggregation: 'SUM',
            dateColumn: 'issue_date',
            granularity: 'century',
          },
          orgId,
        ),
      ).toThrow(BadRequestException);
    });
  });

  describe('buildBarChartQuery', () => {
    it('should GROUP BY category and ORDER BY value DESC', () => {
      const sql = service.buildBarChartQuery(
        {
          table: 'invoices',
          metric: 'total_amount',
          aggregation: 'SUM',
          categoryColumn: 'client_name',
          limit: 10,
        },
        orgId,
      );

      expect(sql).toBe(
        'SELECT client_name AS category, SUM(total_amount) AS value ' +
          'FROM invoices WHERE org_id = {orgId:String} ' +
          'GROUP BY category ORDER BY value DESC LIMIT 10',
      );
    });

    it('should default limit to 10 when not provided', () => {
      const sql = service.buildBarChartQuery(
        {
          table: 'invoices',
          metric: 'total_amount',
          aggregation: 'SUM',
          categoryColumn: 'client_name',
        },
        orgId,
      );

      expect(sql).toContain('LIMIT 10');
    });

    it('should cap limit at 1000', () => {
      const sql = service.buildBarChartQuery(
        {
          table: 'invoices',
          metric: 'total_amount',
          aggregation: 'SUM',
          categoryColumn: 'client_name',
          limit: 5000,
        },
        orgId,
      );

      expect(sql).toContain('LIMIT 1000');
    });

    it('should throw when categoryColumn is missing', () => {
      expect(() =>
        service.buildBarChartQuery(
          { table: 'invoices', metric: 'total_amount', aggregation: 'SUM' },
          orgId,
        ),
      ).toThrow(BadRequestException);
    });
  });

  describe('buildPieChartQuery', () => {
    it('should generate correct pie chart SQL', () => {
      const sql = service.buildPieChartQuery(
        {
          table: 'invoices',
          metric: 'total_amount',
          aggregation: 'SUM',
          categoryColumn: 'status',
          limit: 5,
        },
        orgId,
      );

      expect(sql).toBe(
        'SELECT status AS category, SUM(total_amount) AS value ' +
          'FROM invoices WHERE org_id = {orgId:String} ' +
          'GROUP BY category ORDER BY value DESC LIMIT 5',
      );
    });

    it('should cap limit at 20', () => {
      const sql = service.buildPieChartQuery(
        {
          table: 'invoices',
          metric: 'total_amount',
          aggregation: 'SUM',
          categoryColumn: 'status',
          limit: 50,
        },
        orgId,
      );

      expect(sql).toContain('LIMIT 20');
    });

    it('should default limit to 5 when not provided', () => {
      const sql = service.buildPieChartQuery(
        {
          table: 'invoices',
          metric: 'total_amount',
          aggregation: 'SUM',
          categoryColumn: 'status',
        },
        orgId,
      );

      expect(sql).toContain('LIMIT 5');
    });

    it('should not exceed limit of 20 even with limit = 100', () => {
      const sql = service.buildPieChartQuery(
        {
          table: 'invoices',
          metric: 'total_amount',
          aggregation: 'SUM',
          categoryColumn: 'status',
          limit: 100,
        },
        orgId,
      );

      expect(sql).toMatch(/LIMIT 20$/);
    });
  });

  describe('buildTableQuery', () => {
    it('should SELECT specified columns', () => {
      const sql = service.buildTableQuery(
        {
          table: 'invoices',
          columns: ['invoice_number', 'client_name', 'total_amount'],
          limit: 50,
        },
        orgId,
      );

      expect(sql).toContain('SELECT invoice_number, client_name, total_amount');
    });

    it('should use * when no columns are specified', () => {
      const sql = service.buildTableQuery({ table: 'invoices' }, orgId);

      expect(sql).toContain('SELECT *');
    });

    it('should cap limit at 100', () => {
      const sql = service.buildTableQuery(
        { table: 'invoices', columns: ['id'], limit: 500 },
        orgId,
      );

      expect(sql).toContain('LIMIT 100');
    });

    it('should default limit to 100 when not provided', () => {
      const sql = service.buildTableQuery({ table: 'invoices', columns: ['id'] }, orgId);

      expect(sql).toContain('LIMIT 100');
    });

    it('should include ORDER BY when orderColumn is specified', () => {
      const sql = service.buildTableQuery(
        {
          table: 'invoices',
          columns: ['invoice_number', 'total_amount'],
          orderColumn: 'issue_date',
        },
        orgId,
      );

      expect(sql).toContain('ORDER BY issue_date DESC');
    });

    it('should omit ORDER BY when orderColumn is not specified', () => {
      const sql = service.buildTableQuery({ table: 'invoices', columns: ['id'] }, orgId);

      expect(sql).not.toContain('ORDER BY');
    });

    it('should use * when columns array is empty', () => {
      const sql = service.buildTableQuery({ table: 'invoices', columns: [] }, orgId);

      expect(sql).toContain('SELECT *');
    });
  });

  describe('SQL injection prevention', () => {
    it('should reject invalid identifier with special characters', () => {
      expect(() =>
        service.buildKpiQuery(
          { table: 'invoices', metric: 'total_amount; DROP TABLE invoices', aggregation: 'SUM' },
          orgId,
        ),
      ).toThrow(BadRequestException);
    });

    it('should reject identifier with spaces', () => {
      expect(() =>
        service.buildKpiQuery(
          { table: 'invoices', metric: 'total amount', aggregation: 'SUM' },
          orgId,
        ),
      ).toThrow(BadRequestException);
    });

    it('should reject identifier with dashes', () => {
      expect(() =>
        service.buildKpiQuery(
          { table: 'invoices', metric: 'total-amount', aggregation: 'SUM' },
          orgId,
        ),
      ).toThrow(BadRequestException);
    });

    it('should reject identifier starting with a number', () => {
      expect(() =>
        service.buildKpiQuery({ table: 'invoices', metric: '1invalid', aggregation: 'SUM' }, orgId),
      ).toThrow(BadRequestException);
    });

    it('should accept valid identifiers with underscores', () => {
      const sql = service.buildKpiQuery(
        { table: 'invoices', metric: 'total_amount_usd', aggregation: 'SUM' },
        orgId,
      );

      expect(sql).toContain('SUM(total_amount_usd)');
    });

    it('should reject identifier with parentheses', () => {
      expect(() =>
        service.buildKpiQuery(
          { table: 'invoices', metric: 'SUM(total_amount)', aggregation: 'SUM' },
          orgId,
        ),
      ).toThrow(BadRequestException);
    });

    it('should reject invalid column in table query', () => {
      expect(() =>
        service.buildTableQuery(
          { table: 'invoices', columns: ['valid_col', 'invalid col!'] },
          orgId,
        ),
      ).toThrow(BadRequestException);
    });

    it('should reject invalid orderColumn', () => {
      expect(() =>
        service.buildTableQuery(
          { table: 'invoices', columns: ['id'], orderColumn: 'col; DROP TABLE x' },
          orgId,
        ),
      ).toThrow(BadRequestException);
    });
  });

  describe('invalid table name rejected', () => {
    it('should reject a table not in the allowlist', () => {
      expect(() =>
        service.buildKpiQuery({ table: 'users', metric: 'id', aggregation: 'COUNT' }, orgId),
      ).toThrow(BadRequestException);
      expect(() =>
        service.buildKpiQuery({ table: 'users', metric: 'id', aggregation: 'COUNT' }, orgId),
      ).toThrow("Table 'users' is not allowed");
    });

    it('should reject empty table name', () => {
      expect(() =>
        service.buildKpiQuery({ table: '', metric: 'id', aggregation: 'COUNT' }, orgId),
      ).toThrow(BadRequestException);
    });

    it('should reject undefined table name', () => {
      expect(() => service.buildKpiQuery({ metric: 'id', aggregation: 'COUNT' }, orgId)).toThrow(
        BadRequestException,
      );
    });

    it('should accept allowed tables', () => {
      const allowedTables = [
        'invoices',
        'customers',
        'orders',
        'order_items',
        'products',
        'payments',
        'csv_data',
      ];
      for (const table of allowedTables) {
        expect(() =>
          service.buildKpiQuery({ table, metric: 'id', aggregation: 'COUNT' }, orgId),
        ).not.toThrow();
      }
    });

    it('should accept CSV UUID table names matching the pattern', () => {
      const csvTable = 'csv_a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      expect(() =>
        service.buildKpiQuery({ table: csvTable, metric: 'id', aggregation: 'COUNT' }, orgId),
      ).not.toThrow();
    });

    it('should reject CSV table names not matching the UUID pattern', () => {
      expect(() =>
        service.buildKpiQuery(
          { table: 'csv_not-a-uuid', metric: 'id', aggregation: 'COUNT' },
          orgId,
        ),
      ).toThrow(BadRequestException);
    });
  });

  describe('parameterized org_id injection', () => {
    it('should use parameterized org_id in KPI query', () => {
      const sql = service.buildKpiQuery(
        { table: 'invoices', metric: 'total_amount', aggregation: 'SUM' },
        orgId,
      );

      expect(sql).toContain('org_id = {orgId:String}');
      // Should NOT contain the actual orgId value in the SQL string
      expect(sql).not.toContain(orgId);
    });

    it('should use parameterized org_id in line chart query', () => {
      const sql = service.buildLineChartQuery(
        {
          table: 'invoices',
          metric: 'total_amount',
          aggregation: 'SUM',
          dateColumn: 'issue_date',
          granularity: 'month',
        },
        orgId,
      );

      expect(sql).toContain('org_id = {orgId:String}');
      expect(sql).not.toContain(orgId);
    });

    it('should use parameterized org_id in bar chart query', () => {
      const sql = service.buildBarChartQuery(
        {
          table: 'invoices',
          metric: 'total_amount',
          aggregation: 'SUM',
          categoryColumn: 'client_name',
        },
        orgId,
      );

      expect(sql).toContain('org_id = {orgId:String}');
    });

    it('should use parameterized org_id in pie chart query', () => {
      const sql = service.buildPieChartQuery(
        {
          table: 'invoices',
          metric: 'total_amount',
          aggregation: 'SUM',
          categoryColumn: 'status',
        },
        orgId,
      );

      expect(sql).toContain('org_id = {orgId:String}');
    });

    it('should use parameterized org_id in table query', () => {
      const sql = service.buildTableQuery({ table: 'invoices', columns: ['id'] }, orgId);

      expect(sql).toContain('org_id = {orgId:String}');
    });
  });

  describe('aggregation validation', () => {
    it('should accept all allowed aggregations', () => {
      const aggregations = ['SUM', 'COUNT', 'AVG', 'MIN', 'MAX'];
      for (const agg of aggregations) {
        expect(() =>
          service.buildKpiQuery(
            { table: 'invoices', metric: 'total_amount', aggregation: agg },
            orgId,
          ),
        ).not.toThrow();
      }
    });

    it('should accept lowercase aggregation', () => {
      const sql = service.buildKpiQuery(
        { table: 'invoices', metric: 'total_amount', aggregation: 'sum' },
        orgId,
      );

      expect(sql).toContain('SUM(total_amount)');
    });

    it('should reject invalid aggregation', () => {
      expect(() =>
        service.buildKpiQuery(
          { table: 'invoices', metric: 'total_amount', aggregation: 'MEDIAN' },
          orgId,
        ),
      ).toThrow(BadRequestException);
    });
  });

  describe('missing required fields', () => {
    it('should throw when metric is missing for KPI', () => {
      expect(() => service.buildKpiQuery({ table: 'invoices', aggregation: 'SUM' }, orgId)).toThrow(
        BadRequestException,
      );
    });

    it('should throw when metric is missing for line chart', () => {
      expect(() =>
        service.buildLineChartQuery(
          { table: 'invoices', aggregation: 'SUM', dateColumn: 'issue_date', granularity: 'month' },
          orgId,
        ),
      ).toThrow(BadRequestException);
    });

    it('should throw when categoryColumn is missing for pie chart', () => {
      expect(() =>
        service.buildPieChartQuery(
          { table: 'invoices', metric: 'total_amount', aggregation: 'SUM' },
          orgId,
        ),
      ).toThrow(BadRequestException);
    });
  });
});
