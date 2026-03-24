import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import { SyncJob } from '../../sync/entities/sync-job.entity';

import { DataSourceType, DataSourceStatus } from '@clarixbi/shared';
export { DataSourceType, DataSourceStatus };

@Entity('data_sources')
@Index(['org_id', 'type'])
export class DataSourceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  org_id: string;

  @Column({ type: 'enum', enum: DataSourceType })
  type: DataSourceType;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  credentials_encrypted: string | null;

  @Column({ type: 'jsonb', default: {} })
  config: Record<string, unknown>;

  @Index()
  @Column({ type: 'enum', enum: DataSourceStatus, default: DataSourceStatus.ACTIVE })
  status: DataSourceStatus;

  @Column({ type: 'timestamp', nullable: true })
  last_sync_at: Date | null;

  @Column({ type: 'integer', default: 0 })
  total_rows: number;

  @Column({ type: 'integer', default: 15 })
  sync_interval_minutes: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date | null;

  @ManyToOne(() => Organization, (o) => o.data_sources, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @OneToMany(() => SyncJob, (sj) => sj.data_source)
  sync_jobs: SyncJob[];
}
