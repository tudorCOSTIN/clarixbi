import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AIConversation } from './ai-conversation.entity';

export enum AIMessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

@Entity('ai_messages')
export class AIMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  conversation_id: string;

  @Column({ type: 'enum', enum: AIMessageRole })
  role: AIMessageRole;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text', nullable: true })
  generated_sql: string | null;

  @Column({ type: 'jsonb', nullable: true })
  query_result: Record<string, unknown> | null;

  @Column({ type: 'integer', default: 0 })
  tokens_used: number;

  @Column({ type: 'integer', nullable: true })
  latency_ms: number | null;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => AIConversation, (c) => c.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: AIConversation;
}
