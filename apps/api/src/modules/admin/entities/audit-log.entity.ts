import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Organization } from '../../organizations/entities/organization.entity';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  org_id: string | null;

  @Column()
  action: string;

  @Column({ type: 'varchar', nullable: true })
  entity_type: string | null;

  @Column({ type: 'varchar', nullable: true })
  entity_id: string | null;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, unknown> | null;

  @Column({ type: 'varchar', nullable: true })
  ip_address: string | null;

  @Column({ type: 'varchar', nullable: true })
  user_agent: string | null;

  @Index()
  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'org_id' })
  organization: Organization | null;
}
