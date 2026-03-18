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
import { User } from '../../users/entities/user.entity';
import { DataSourceEntity } from '../../data-sources/entities/data-source.entity';
import { AlertTrigger } from './alert-trigger.entity';

export enum ConditionOperator {
  GT = 'gt',
  LT = 'lt',
  EQ = 'eq',
  GTE = 'gte',
  LTE = 'lte',
  CHANGE_PCT = 'change_pct',
}

export enum CheckFrequency {
  REALTIME = 'realtime',
  HOURLY = 'hourly',
  DAILY = 'daily',
}

@Entity('alerts')
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  org_id: string;

  @Column({ type: 'uuid' })
  created_by: string;

  @Column({ type: 'uuid' })
  data_source_id: string;

  @Column()
  name: string;

  @Column({ type: 'text' })
  metric_query: string;

  @Column({ type: 'enum', enum: ConditionOperator })
  condition_operator: ConditionOperator;

  @Column({ type: 'decimal' })
  threshold_value: number;

  @Column({ type: 'enum', enum: CheckFrequency })
  check_frequency: CheckFrequency;

  @Column({ default: true })
  is_active: boolean;

  @Index()
  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @ManyToOne(() => DataSourceEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'data_source_id' })
  data_source: DataSourceEntity;

  @OneToMany(() => AlertTrigger, (at) => at.alert)
  triggers: AlertTrigger[];
}
