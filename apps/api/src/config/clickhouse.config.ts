import { createClient } from '@clickhouse/client';

export const clickhouseConfig = {
  url: process.env['CLICKHOUSE_URL']!,
  username: process.env['CLICKHOUSE_USER'] || 'default',
  password: process.env['CLICKHOUSE_PASSWORD'] || '',
  database: process.env['CLICKHOUSE_DATABASE'] || 'clarixbi_analytics',
};

export function createClickHouseClient() {
  return createClient({
    url: clickhouseConfig.url,
    username: clickhouseConfig.username,
    password: clickhouseConfig.password,
    database: clickhouseConfig.database,
  });
}
