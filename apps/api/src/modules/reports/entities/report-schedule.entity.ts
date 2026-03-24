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
} from 'typeorm';
import { Report } from './report.entity';

@Entity('report_schedules')
export class ReportSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  report_id: string;

  @Column()
  cron_expression: string;

  @Column({ default: 'Europe/Bucharest' })
  timezone: string;

  @Column({ type: 'jsonb', default: [] })
  recipients: string[];

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'timestamp', nullable: true })
  last_sent_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  next_run_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date | null;

  @ManyToOne(() => Report, (r) => r.schedules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'report_id' })
  report: Report;
}
