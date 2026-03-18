import { DataSource } from 'typeorm';
import * as path from 'path';

export const dataSourceOptions = {
  type: 'postgres' as const,
  url:
    process.env['DATABASE_URL'] || 'postgresql://clarixbi:clarixbi_dev@localhost:5432/clarixbi_dev',
  entities: [path.join(__dirname, '..', 'modules', '**', 'entities', '*.entity.{ts,js}')],
  migrations: [path.join(__dirname, '..', 'migrations', '*.{ts,js}')],
  synchronize: false,
  logging: process.env['NODE_ENV'] !== 'production',
};

const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
