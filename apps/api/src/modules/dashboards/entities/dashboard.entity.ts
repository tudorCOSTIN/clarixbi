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
import { User } from '../../users/entities/user.entity';
import { Widget } from '../../widgets/entities/widget.entity';
import { DashboardShare } from './dashboard-share.entity';

export enum DashboardSourceType {
  SMARTBILL = 'smartbill',
  WOOCOMMERCE = 'woocommerce',
  CSV = 'csv',
  EFACTURA = 'efactura',
  MIXED = 'mixed',
}

@Entity('dashboards')
export class Dashboard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  org_id: string;

  @Index()
  @Column({ type: 'uuid' })
  created_by: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', default: [] })
  layout: Record<string, unknown>[];

  @Column({ default: false })
  is_auto_generated: boolean;

  @Column({ type: 'enum', enum: DashboardSourceType, nullable: true })
  source_type: DashboardSourceType | null;

  @Index()
  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date | null;

  @ManyToOne(() => Organization, (o) => o.dashboards, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @OneToMany(() => Widget, (w) => w.dashboard)
  widgets: Widget[];

  @OneToMany(() => DashboardShare, (ds) => ds.dashboard)
  shares: DashboardShare[];
}
