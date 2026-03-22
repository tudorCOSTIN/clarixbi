import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import { Dashboard } from '../../dashboards/entities/dashboard.entity';
import { User } from '../../users/entities/user.entity';
import { ReportSchedule } from './report-schedule.entity';

export enum ReportFormat {
  PDF = 'pdf',
  XLSX = 'xlsx',
}

@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  org_id: string;

  @Index()
  @Column({ type: 'uuid' })
  dashboard_id: string;

  @Index()
  @Column({ type: 'uuid' })
  created_by: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'enum', enum: ReportFormat })
  format: ReportFormat;

  @Column({ type: 'jsonb', default: {} })
  config: Record<string, unknown>;

  @Index()
  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => Dashboard, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dashboard_id' })
  dashboard: Dashboard;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @OneToMany(() => ReportSchedule, (rs) => rs.report)
  schedules: ReportSchedule[];
}
