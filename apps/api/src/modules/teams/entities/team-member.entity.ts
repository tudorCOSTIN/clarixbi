import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Organization } from '../../organizations/entities/organization.entity';

export enum TeamRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer',
}

export enum InviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
}

@Entity('team_members')
@Unique(['user_id', 'org_id'])
export class TeamMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id: string;

  @Index()
  @Column({ type: 'uuid' })
  org_id: string;

  @Column({ type: 'enum', enum: TeamRole })
  role: TeamRole;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  invited_by: string | null;

  @Column({ type: 'varchar', nullable: true })
  invite_email: string | null;

  @Column({ type: 'varchar', unique: true, nullable: true })
  invite_token: string | null;

  @Column({ type: 'enum', enum: InviteStatus, nullable: true })
  invite_status: InviteStatus | null;

  @Column({ type: 'timestamp', nullable: true })
  invite_expires_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  joined_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => User, (u) => u.team_memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Organization, (o) => o.team_members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'invited_by' })
  inviter: User | null;
}
