import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { TeamMember } from '../../teams/entities/team-member.entity';

export enum PreferredLanguage {
  RO = 'ro',
  EN = 'en',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  auth0_id: string;

  @Index()
  @Column({ unique: true })
  email: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  avatar_url: string | null;

  @Column({ type: 'enum', enum: PreferredLanguage, default: PreferredLanguage.RO })
  preferred_language: PreferredLanguage;

  @Column({ default: 'Europe/Bucharest' })
  preferred_timezone: string;

  @Column({ default: true })
  is_active: boolean;

  @Column({ default: true })
  notifications_enabled: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @DeleteDateColumn()
  deleted_at: Date | null;

  @OneToMany(() => TeamMember, (tm) => tm.user)
  team_memberships: TeamMember[];
}
