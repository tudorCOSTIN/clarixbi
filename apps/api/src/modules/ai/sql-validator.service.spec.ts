import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SqlValidatorService } from './sql-validator.service';
import { AuditLog } from '../admin/entities/audit-log.entity';

describe('SqlValidatorService', () => {
  let service: SqlValidatorService;
  const mockAuditLogRepo = {
    save: jest.fn().mockResolvedValue({}),
  };
  const orgId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SqlValidatorService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockAuditLogRepo,
        },
      ],
    }).compile();

    service = module.get<SqlValidatorService>(SqlValidatorService);
    mockAuditLogRepo.save.mockClear();
  });

  // ===== ALLOW TESTS =====

  it('should allow simple SELECT with WHERE org_id', async () => {
    const result = await service.validate(
      `SELECT * FROM invoices WHERE org_id = '${orgId}'`,
      orgId,
    );
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should allow SELECT with SUM aggregate', async () => {
    const result = await service.validate(
      `SELECT SUM(total_amount) FROM invoices WHERE org_id = '${orgId}'`,
      orgId,
    );
    expect(result.isValid).toBe(true);
  });

  it('should allow SELECT with COUNT aggregate', async () => {
    const result = await service.validate(
      `SELECT COUNT(*) FROM invoices WHERE org_id = '${orgId}'`,
      orgId,
    );
    expect(result.isValid).toBe(true);
  });

  it('should allow SELECT with AVG aggregate', async () => {
    const result = await service.validate(
      `SELECT AVG(total_amount) FROM invoices WHERE org_id = '${orgId}'`,
      orgId,
    );
    expect(result.isValid).toBe(true);
  });

  it('should allow SELECT with GROUP BY, ORDER BY, LIMIT', async () => {
    const result = await service.validate(
      `SELECT customer_name, SUM(total_amount) as total FROM invoices WHERE org_id = '${orgId}' GROUP BY customer_name ORDER BY total DESC LIMIT 10`,
      orgId,
    );
    expect(result.isValid).toBe(true);
  });

  it('should allow SELECT with CASE WHEN', async () => {
    const result = await service.validate(
      `SELECT CASE WHEN total_amount > 1000 THEN 'high' ELSE 'low' END as tier, COUNT(*) FROM invoices WHERE org_id = '${orgId}' GROUP BY tier`,
      orgId,
    );
    expect(result.isValid).toBe(true);
  });

  it('should allow SELECT with JOIN between permitted tables', async () => {
    const result = await service.validate(
      `SELECT i.invoice_number, c.name FROM invoices i JOIN customers c ON i.customer_id = c.id WHERE i.org_id = '${orgId}'`,
      orgId,
    );
    expect(result.isValid).toBe(true);
  });

  it('should auto-add org_id when missing and mark as valid', async () => {
    const result = await service.validate('SELECT * FROM invoices', orgId);
    expect(result.isValid).toBe(true);
    expect(result.sanitizedSql).toContain(`org_id = '${orgId}'`);
  });

  it('should allow SELECT with LIMIT 500 as-is', async () => {
    const result = await service.validate(
      `SELECT * FROM invoices WHERE org_id = '${orgId}' LIMIT 500`,
      orgId,
    );
    expect(result.isValid).toBe(true);
    expect(result.sanitizedSql).toContain('LIMIT 500');
  });

  it('should allow SELECT from orders table', async () => {
    const result = await service.validate(`SELECT * FROM orders WHERE org_id = '${orgId}'`, orgId);
    expect(result.isValid).toBe(true);
  });

  it('should allow SELECT from products table', async () => {
    const result = await service.validate(
      `SELECT * FROM products WHERE org_id = '${orgId}'`,
      orgId,
    );
    expect(result.isValid).toBe(true);
  });

  it('should allow SELECT from payments table', async () => {
    const result = await service.validate(
      `SELECT * FROM payments WHERE org_id = '${orgId}'`,
      orgId,
    );
    expect(result.isValid).toBe(true);
  });

  it('should allow SELECT from csv_data table', async () => {
    const result = await service.validate(
      `SELECT * FROM csv_data WHERE org_id = '${orgId}'`,
      orgId,
    );
    expect(result.isValid).toBe(true);
  });

  it('should allow SELECT from order_items table', async () => {
    const result = await service.validate(
      `SELECT * FROM order_items WHERE org_id = '${orgId}'`,
      orgId,
    );
    expect(result.isValid).toBe(true);
  });

  it('should allow SELECT with MIN and MAX', async () => {
    const result = await service.validate(
      `SELECT MIN(total_amount), MAX(total_amount) FROM invoices WHERE org_id = '${orgId}'`,
      orgId,
    );
    expect(result.isValid).toBe(true);
  });

  it('should allow SELECT with COALESCE', async () => {
    const result = await service.validate(
      `SELECT COALESCE(customer_name, 'Unknown') FROM invoices WHERE org_id = '${orgId}'`,
      orgId,
    );
    expect(result.isValid).toBe(true);
  });

  it('should allow SELECT with LOWER and UPPER text functions', async () => {
    const result = await service.validate(
      `SELECT LOWER(customer_name) FROM invoices WHERE org_id = '${orgId}'`,
      orgId,
    );
    expect(result.isValid).toBe(true);
  });

  it('should allow SELECT with HAVING clause', async () => {
    const result = await service.validate(
      `SELECT customer_name, COUNT(*) as cnt FROM invoices WHERE org_id = '${orgId}' GROUP BY customer_name HAVING cnt > 5`,
      orgId,
    );
    expect(result.isValid).toBe(true);
  });

  // ===== DENY TESTS =====

  it('should deny UPDATE statement', async () => {
    const result = await service.validate(
      `UPDATE invoices SET total_amount = 0 WHERE org_id = '${orgId}'`,
      orgId,
    );
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('UPDATE');
  });

  it('should deny DELETE statement', async () => {
    const result = await service.validate(`DELETE FROM invoices WHERE org_id = '${orgId}'`, orgId);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('DELETE');
  });

  it('should deny DROP TABLE statement', async () => {
    const result = await service.validate('DROP TABLE invoices', orgId);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('DROP');
  });

  it('should deny SELECT from system tables', async () => {
    const result = await service.validate('SELECT * FROM system.tables', orgId);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('system.tables'))).toBe(true);
  });

  it('should deny SELECT from information_schema', async () => {
    const result = await service.validate('SELECT * FROM information_schema.columns', orgId);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('information_schema'))).toBe(true);
  });

  it('should deny INSERT INTO statement', async () => {
    const result = await service.validate(
      `INSERT INTO invoices (org_id, total_amount) VALUES ('${orgId}', 100)`,
      orgId,
    );
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('INSERT');
  });

  it('should deny SELECT with UNION', async () => {
    const result = await service.validate(
      `SELECT * FROM invoices WHERE org_id = '${orgId}' UNION SELECT * FROM customers WHERE org_id = '${orgId}'`,
      orgId,
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('UNION'))).toBe(true);
  });

  it('should replace LIMIT > 1000 with 1000', async () => {
    const result = await service.validate(
      `SELECT * FROM invoices WHERE org_id = '${orgId}' LIMIT 5000`,
      orgId,
    );
    expect(result.isValid).toBe(true);
    expect(result.sanitizedSql).toContain('LIMIT 1000');
    expect(result.sanitizedSql).not.toContain('LIMIT 5000');
  });

  it('should deny disallowed functions', async () => {
    const result = await service.validate(
      `SELECT exec('command') FROM invoices WHERE org_id = '${orgId}'`,
      orgId,
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes('exec'))).toBe(true);
  });

  it('should deny TRUNCATE TABLE', async () => {
    const result = await service.validate('TRUNCATE TABLE invoices', orgId);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('TRUNCATE');
  });

  it('should deny ALTER TABLE', async () => {
    const result = await service.validate('ALTER TABLE invoices ADD COLUMN new_col String', orgId);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('ALTER');
  });

  it('should deny CREATE TABLE', async () => {
    const result = await service.validate(
      'CREATE TABLE evil (id Int32) ENGINE = MergeTree()',
      orgId,
    );
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('CREATE');
  });

  it('should deny GRANT statement', async () => {
    const result = await service.validate('GRANT ALL ON invoices TO default', orgId);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('GRANT');
  });

  it('should deny REVOKE statement', async () => {
    const result = await service.validate('REVOKE ALL ON invoices FROM default', orgId);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('REVOKE');
  });

  it('should deny SELECT from unlisted table', async () => {
    const result = await service.validate(
      `SELECT * FROM secret_table WHERE org_id = '${orgId}'`,
      orgId,
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('secret_table'))).toBe(true);
  });

  // ===== EDGE CASES =====

  it('should handle trailing semicolons', async () => {
    const result = await service.validate(
      `SELECT * FROM invoices WHERE org_id = '${orgId}';`,
      orgId,
    );
    expect(result.isValid).toBe(true);
  });

  it('should add LIMIT 1000 when no LIMIT specified', async () => {
    const result = await service.validate(
      `SELECT * FROM invoices WHERE org_id = '${orgId}'`,
      orgId,
    );
    expect(result.isValid).toBe(true);
    expect(result.sanitizedSql).toContain('LIMIT 1000');
  });

  it('should log each validation to audit log', async () => {
    await service.validate(`SELECT * FROM invoices WHERE org_id = '${orgId}'`, orgId);
    expect(mockAuditLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ai_sql_validation',
        entity_type: 'ai_query',
      }),
    );
  });

  it('should deny SELECT with INTERSECT', async () => {
    const result = await service.validate(
      `SELECT * FROM invoices WHERE org_id = '${orgId}' INTERSECT SELECT * FROM customers WHERE org_id = '${orgId}'`,
      orgId,
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('INTERSECT'))).toBe(true);
  });

  it('should deny SELECT with EXCEPT', async () => {
    const result = await service.validate(
      `SELECT * FROM invoices WHERE org_id = '${orgId}' EXCEPT SELECT * FROM customers WHERE org_id = '${orgId}'`,
      orgId,
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('EXCEPT'))).toBe(true);
  });
});
