import { createClient } from '@clickhouse/client';
import { readFileSync } from 'fs';
import { resolve } from 'path';

async function main() {
  const client = createClient({
    url: process.env['CLICKHOUSE_URL'] || 'http://localhost:8123',
    username: process.env['CLICKHOUSE_USER'] || 'default',
    password: process.env['CLICKHOUSE_PASSWORD'] || '',
  });

  const sqlPath = resolve(__dirname, 'clickhouse-init.sql');
  const sql = readFileSync(sqlPath, 'utf-8');

  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));

  console.log(`Executing ${statements.length} statements...`);

  for (const statement of statements) {
    const preview = statement.substring(0, 80).replace(/\n/g, ' ');
    console.log(`> ${preview}...`);
    await client.command({ query: statement });
  }

  console.log('ClickHouse schema initialized successfully.');
  await client.close();
}

main().catch((err) => {
  console.error('Failed to initialize ClickHouse:', err);
  process.exit(1);
});
