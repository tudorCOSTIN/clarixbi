import { DataSource } from 'typeorm';
import * as path from 'path';

export const dataSourceOptions = {
  type: 'postgres' as const,
  url: process.env['DATABASE_URL']!,
  entities: [path.join(__dirname, '..', 'modules', '**', 'entities', '*.entity.{ts,js}')],
  migrations: [path.join(__dirname, '..', 'migrations', '*.{ts,js}')],
  synchronize: false,
  logging: process.env['NODE_ENV'] !== 'production',
  extra: {
    max: 30,
    min: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  },
  retryAttempts: 5,
  retryDelay: 3000,
  ssl: process.env['NODE_ENV'] === 'production' ? { rejectUnauthorized: false } : false,
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
