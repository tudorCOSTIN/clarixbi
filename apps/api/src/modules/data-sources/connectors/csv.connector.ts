import { Logger } from '@nestjs/common';
import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface DetectedColumn {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  sampleValues: string[];
}

export interface ParsedData {
  headers: string[];
  rows: Record<string, string>[];
  detectedSchema: DetectedColumn[];
  totalRows: number;
}

const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/, // ISO: 2024-01-15 or 2024-01-15T10:30:00
  /^\d{2}\.\d{2}\.\d{4}$/, // DD.MM.YYYY
  /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY or DD/MM/YYYY
  /^\d{2}-\d{2}-\d{4}$/, // DD-MM-YYYY
];

export class CsvConnector {
  private readonly logger = new Logger(CsvConnector.name);

  parseCsv(content: string): ParsedData {
    const result = Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim(),
    });

    if (result.errors.length > 0) {
      this.logger.warn(`CSV parse warnings: ${result.errors.length} issues`);
    }

    const rows = result.data as Record<string, string>[];
    const headers = result.meta.fields || [];

    const detectedSchema = this.detectSchema(headers, rows);

    return {
      headers,
      rows,
      detectedSchema,
      totalRows: rows.length,
    };
  }

  parseExcel(buffer: Buffer): ParsedData {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) {
      throw new Error('Excel file has no sheets');
    }

    const sheet = workbook.Sheets[firstSheet]!;
    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

    if (jsonData.length === 0) {
      return { headers: [], rows: [], detectedSchema: [], totalRows: 0 };
    }

    const headers = Object.keys(jsonData[0]!);
    const rows = jsonData.map((row) => {
      const stringRow: Record<string, string> = {};
      for (const key of headers) {
        stringRow[key] = String(row[key] ?? '');
      }
      return stringRow;
    });

    const detectedSchema = this.detectSchema(headers, rows);

    return {
      headers,
      rows,
      detectedSchema,
      totalRows: rows.length,
    };
  }

  detectSchema(headers: string[], rows: Record<string, string>[]): DetectedColumn[] {
    const sampleSize = Math.min(rows.length, 100);
    const sampleRows = rows.slice(0, sampleSize);

    return headers.map((header) => {
      const values = sampleRows.map((r) => r[header]?.trim() ?? '').filter((v) => v !== '');

      const sampleValues = values.slice(0, 5);
      const type = this.detectColumnType(values);

      return { name: header, type, sampleValues };
    });
  }

  private detectColumnType(values: string[]): 'string' | 'number' | 'date' | 'boolean' {
    if (values.length === 0) return 'string';

    const threshold = 0.8;

    // Check boolean
    const boolCount = values.filter((v) => {
      const lower = v.toLowerCase();
      return ['true', 'false', '0', '1', 'da', 'nu', 'yes', 'no'].includes(lower);
    }).length;
    if (boolCount / values.length >= threshold) return 'boolean';

    // Check number
    const numberCount = values.filter((v) => {
      const cleaned = v.replace(/[,\s]/g, '').replace(/\./g, '.');
      return !isNaN(Number(cleaned)) && cleaned !== '';
    }).length;
    if (numberCount / values.length >= threshold) return 'number';

    // Check date
    const dateCount = values.filter((v) => {
      return DATE_PATTERNS.some((p) => p.test(v.trim()));
    }).length;
    if (dateCount / values.length >= threshold) return 'date';

    return 'string';
  }
}
