import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity';
import { Plan } from './plan.entity';

import { SubscriptionStatus, BillingPeriod } from '@clarixbi/shared';
export { SubscriptionStatus, BillingPeriod };

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', unique: true })
  org_id: string;

  @Index()
  @Column({ type: 'uuid' })
  plan_id: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  stripe_subscription_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  stripe_customer_id: string | null;

  @Index()
  @Column({ type: 'enum', enum: SubscriptionStatus })
  status: SubscriptionStatus;

  @Column({ type: 'enum', enum: BillingPeriod })
  billing_period: BillingPeriod;

  @Column({ type: 'timestamp', nullable: true })
  trial_ends_at: Date | null;

  @Column({ type: 'timestamp' })
  current_period_start: Date;

  @Column({ type: 'timestamp' })
  current_period_end: Date;

  @Column({ type: 'timestamp', nullable: true })
  canceled_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date | null;

  @OneToOne(() => Organization, (o) => o.subscription, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => Plan, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'plan_id' })
  plan: Plan;
}
