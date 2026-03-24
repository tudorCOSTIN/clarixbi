import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { DataSource } from '../../data-sources/entities/data-source.entity';
import { Organization } from '../../organizations/entities/organization.entity';

export enum SyncJobStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum SyncJobType {
  INITIAL = 'initial',
  INCREMENTAL = 'incremental',
  MANUAL = 'manual',
}

@Entity('sync_jobs')
export class SyncJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  data_source_id: string;

  @Index()
  @Column({ type: 'uuid' })
  org_id: string;

  @Index()
  @Column({ type: 'enum', enum: SyncJobStatus })
  status: SyncJobStatus;

  @Column({ type: 'timestamp', nullable: true })
  started_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date | null;

  @Column({ type: 'integer', default: 0 })
  rows_imported: number;

  @Column({ type: 'integer', default: 0 })
  rows_updated: number;

  @Column({ type: 'integer', default: 0 })
  rows_failed: number;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @Column({ type: 'enum', enum: SyncJobType })
  job_type: SyncJobType;

  @Index()
  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => DataSource, (ds) => ds.sync_jobs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'data_source_id' })
  data_source: DataSource;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;
}
