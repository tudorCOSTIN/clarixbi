import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Dashboard } from './dashboard.entity';
import { User } from '../../users/entities/user.entity';

@Entity('dashboard_shares')
export class DashboardShare {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  dashboard_id: string;

  @Column({ unique: true })
  share_token: string;

  @Column({ type: 'uuid' })
  created_by: string;

  @Column({ type: 'integer', default: 0 })
  view_count: number;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Dashboard, (d) => d.shares, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'dashboard_id' })
  dashboard: Dashboard;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User;
}
