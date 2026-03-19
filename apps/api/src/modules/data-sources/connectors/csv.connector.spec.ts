/* eslint-disable @typescript-eslint/no-var-requires */
import { CsvConnector } from './csv.connector';

describe('CsvConnector', () => {
  let connector: CsvConnector;

  beforeEach(() => {
    connector = new CsvConnector();
  });

  describe('parseCsv', () => {
    it('should parse valid CSV with headers', () => {
      const csv = `name,age,city
Ion Popescu,35,Bucuresti
Maria Ionescu,28,Cluj
Andrei Vasile,42,Timisoara`;

      const result = connector.parseCsv(csv);

      expect(result.headers).toEqual(['name', 'age', 'city']);
      expect(result.totalRows).toBe(3);
      expect(result.rows[0]).toEqual({
        name: 'Ion Popescu',
        age: '35',
        city: 'Bucuresti',
      });
    });

    it('should skip empty lines', () => {
      const csv = `name,value
A,1

B,2

`;

      const result = connector.parseCsv(csv);
      expect(result.totalRows).toBe(2);
    });

    it('should handle quoted values with commas', () => {
      const csv = `name,description,price
"Widget, Pro","A great, useful widget",29.99
Simple,Basic item,9.99`;

      const result = connector.parseCsv(csv);
      expect(result.rows[0]!['name']).toBe('Widget, Pro');
      expect(result.rows[0]!['description']).toBe('A great, useful widget');
    });

    it('should trim header names', () => {
      const csv = ` name , age , city
Ion,35,Bucuresti`;

      const result = connector.parseCsv(csv);
      expect(result.headers).toEqual(['name', 'age', 'city']);
    });

    it('should handle malformed CSV gracefully', () => {
      const csv = `name,age
Ion,35,extra
Maria`;

      const result = connector.parseCsv(csv);
      // papaparse handles this gracefully
      expect(result.totalRows).toBeGreaterThanOrEqual(1);
    });
  });

  describe('parseExcel', () => {
    it('should return empty data for buffer with no data rows', () => {
      const XLSX = require('xlsx');
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([['name', 'value']]);
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const result = connector.parseExcel(buffer);
      // Headers only with no data rows returns empty
      expect(result.totalRows).toBe(0);
    });

    it('should parse Excel with data correctly', () => {
      const XLSX = require('xlsx');
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
        ['name', 'amount', 'date'],
        ['Product A', 100, '2024-01-15'],
        ['Product B', 250, '2024-02-20'],
      ]);
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      const result = connector.parseExcel(buffer);
      expect(result.headers).toEqual(['name', 'amount', 'date']);
      expect(result.totalRows).toBe(2);
      expect(result.rows[0]!['name']).toBe('Product A');
      expect(result.rows[0]!['amount']).toBe('100');
    });
  });

  describe('detectSchema', () => {
    it('should detect number columns', () => {
      const headers = ['amount'];
      const rows = [
        { amount: '100.50' },
        { amount: '200' },
        { amount: '3500.75' },
        { amount: '42' },
        { amount: '0.99' },
      ];

      const schema = connector.detectSchema(headers, rows);
      expect(schema[0]!.type).toBe('number');
    });

    it('should detect date columns (ISO format)', () => {
      const headers = ['date'];
      const rows = [
        { date: '2024-01-15' },
        { date: '2024-02-20' },
        { date: '2024-03-10' },
        { date: '2024-04-05' },
        { date: '2024-05-22' },
      ];

      const schema = connector.detectSchema(headers, rows);
      expect(schema[0]!.type).toBe('date');
    });

    it('should detect date columns (DD.MM.YYYY format)', () => {
      const headers = ['date'];
      const rows = [
        { date: '15.01.2024' },
        { date: '20.02.2024' },
        { date: '10.03.2024' },
        { date: '05.04.2024' },
        { date: '22.05.2024' },
      ];

      const schema = connector.detectSchema(headers, rows);
      expect(schema[0]!.type).toBe('date');
    });

    it('should detect date columns (MM/DD/YYYY format)', () => {
      const headers = ['date'];
      const rows = [
        { date: '01/15/2024' },
        { date: '02/20/2024' },
        { date: '03/10/2024' },
        { date: '04/05/2024' },
        { date: '05/22/2024' },
      ];

      const schema = connector.detectSchema(headers, rows);
      expect(schema[0]!.type).toBe('date');
    });

    it('should detect boolean columns', () => {
      const headers = ['active'];
      const rows = [
        { active: 'true' },
        { active: 'false' },
        { active: 'true' },
        { active: 'false' },
        { active: 'true' },
      ];

      const schema = connector.detectSchema(headers, rows);
      expect(schema[0]!.type).toBe('boolean');
    });

    it('should detect boolean columns with 0/1', () => {
      const headers = ['flag'];
      const rows = [{ flag: '1' }, { flag: '0' }, { flag: '1' }, { flag: '1' }, { flag: '0' }];

      const schema = connector.detectSchema(headers, rows);
      expect(schema[0]!.type).toBe('boolean');
    });

    it('should default to string for mixed content', () => {
      const headers = ['data'];
      const rows = [
        { data: 'hello' },
        { data: '123' },
        { data: '2024-01-01' },
        { data: 'world' },
        { data: 'test' },
      ];

      const schema = connector.detectSchema(headers, rows);
      expect(schema[0]!.type).toBe('string');
    });

    it('should detect multiple column types correctly', () => {
      const headers = ['name', 'amount', 'date', 'active'];
      const rows = Array.from({ length: 10 }, (_, i) => ({
        name: `Product ${i}`,
        amount: String(100 + i * 50),
        date: `2024-0${(i % 9) + 1}-15`,
        active: i % 2 === 0 ? 'true' : 'false',
      }));

      const schema = connector.detectSchema(headers, rows);
      expect(schema[0]!.type).toBe('string');
      expect(schema[1]!.type).toBe('number');
      expect(schema[2]!.type).toBe('date');
      expect(schema[3]!.type).toBe('boolean');
    });

    it('should handle empty values gracefully', () => {
      const headers = ['name'];
      const rows = [{ name: '' }, { name: '' }, { name: '' }];

      const schema = connector.detectSchema(headers, rows);
      expect(schema[0]!.type).toBe('string');
    });

    it('should include sample values', () => {
      const headers = ['city'];
      const rows = [
        { city: 'Bucuresti' },
        { city: 'Cluj' },
        { city: 'Timisoara' },
        { city: 'Iasi' },
        { city: 'Constanta' },
        { city: 'Brasov' },
      ];

      const schema = connector.detectSchema(headers, rows);
      expect(schema[0]!.sampleValues).toHaveLength(5);
      expect(schema[0]!.sampleValues).toContain('Bucuresti');
    });

    it('should use threshold of 80% for type detection', () => {
      const headers = ['amount'];
      // 8 numbers + 2 strings = 80% numbers → should detect as number
      const rows = [
        { amount: '100' },
        { amount: '200' },
        { amount: '300' },
        { amount: '400' },
        { amount: '500' },
        { amount: '600' },
        { amount: '700' },
        { amount: '800' },
        { amount: 'N/A' },
        { amount: 'unknown' },
      ];

      const schema = connector.detectSchema(headers, rows);
      expect(schema[0]!.type).toBe('number');
    });

    it('should detect numbers with commas as thousands separators', () => {
      const headers = ['revenue'];
      const rows = [
        { revenue: '1,500' },
        { revenue: '2,300' },
        { revenue: '10,000' },
        { revenue: '500' },
        { revenue: '3,750' },
      ];

      const schema = connector.detectSchema(headers, rows);
      expect(schema[0]!.type).toBe('number');
    });
  });
});
