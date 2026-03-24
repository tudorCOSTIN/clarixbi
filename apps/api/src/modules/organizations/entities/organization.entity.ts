import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { TeamMember } from '../../teams/entities/team-member.entity';
import { DataSource } from '../../data-sources/entities/data-source.entity';
import { Dashboard } from '../../dashboards/entities/dashboard.entity';
import { Subscription } from '../../billing/entities/subscription.entity';

export enum DefaultLanguage {
  RO = 'ro',
  EN = 'en',
}

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'varchar', nullable: true })
  logo_url: string | null;

  @Column({ default: 'Europe/Bucharest' })
  default_timezone: string;

  @Column({ type: 'enum', enum: DefaultLanguage, default: DefaultLanguage.RO })
  default_language: DefaultLanguage;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date | null;

  @OneToMany(() => TeamMember, (tm) => tm.organization)
  team_members: TeamMember[];

  @OneToMany(() => DataSource, (ds) => ds.organization)
  data_sources: DataSource[];

  @OneToMany(() => Dashboard, (d) => d.organization)
  dashboards: Dashboard[];

  @OneToOne(() => Subscription, (s) => s.organization)
  subscription: Subscription;
}
