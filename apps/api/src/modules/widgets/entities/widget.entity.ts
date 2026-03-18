import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Dashboard } from '../../dashboards/entities/dashboard.entity';
import { Organization } from '../../organizations/entities/organization.entity';
import { DataSourceEntity } from '../../data-sources/entities/data-source.entity';

export enum WidgetType {
  LINE = 'line',
  BAR = 'bar',
  PIE = 'pie',
  AREA = 'area',
  TABLE = 'table',
  KPI = 'kpi',
  GAUGE = 'gauge',
  HEATMAP = 'heatmap',
}

@Entity('widgets')
export class Widget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  dashboard_id: string;

  @Index()
  @Column({ type: 'uuid' })
  org_id: string;

  @Column({ type: 'enum', enum: WidgetType })
  type: WidgetType;

  @Column()
  title: string;

  @Column({ type: 'jsonb', default: {} })
  config: Record<string, unknown>;

  @Column({ type: 'text' })
  query_sql: string;

  @Column({ type: 'jsonb', default: {} })
  position: Record<string, unknown>;

  @Column({ type: 'uuid', nullable: true })
  data_source_id: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Dashboard, (d) => d.widgets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dashboard_id' })
  dashboard: Dashboard;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => DataSourceEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'data_source_id' })
  data_source: DataSourceEntity | null;
}
