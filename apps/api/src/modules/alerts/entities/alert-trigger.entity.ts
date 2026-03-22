import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Alert } from './alert.entity';
import { User } from '../../users/entities/user.entity';

@Entity('alert_triggers')
export class AlertTrigger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  alert_id: string;

  @Column({ type: 'timestamp' })
  triggered_at: Date;

  @Column({ type: 'decimal' })
  metric_value: number;

  @Column({ type: 'decimal' })
  threshold_value: number;

  @Column({ type: 'jsonb', default: [] })
  notified_via: string[];

  @Column({ type: 'timestamp', nullable: true })
  acknowledged_at: Date | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  acknowledged_by: string | null;

  @ManyToOne(() => Alert, (a) => a.triggers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'alert_id' })
  alert: Alert;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'acknowledged_by' })
  acknowledger: User | null;
}
