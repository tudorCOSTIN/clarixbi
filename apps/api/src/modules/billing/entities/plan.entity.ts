import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  display_name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price_monthly_eur: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price_annual_eur: number;

  @Column({ type: 'varchar', nullable: true })
  stripe_price_monthly_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  stripe_price_annual_id: string | null;

  @Column({ type: 'jsonb' })
  limits: {
    max_data_sources: number;
    max_dashboards: number;
    max_team_members: number;
    max_ai_queries_monthly: number;
    max_alerts: number;
  };

  @Column({ type: 'jsonb', default: [] })
  features: string[];

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
