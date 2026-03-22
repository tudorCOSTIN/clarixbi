import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { EmailService } from './email.service';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([User])],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
