import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { TeamMember } from '../teams/entities/team-member.entity';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(TeamMember) private teamMemberRepo: Repository<TeamMember>,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  async findByAuth0Id(auth0Id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { auth0_id: auth0Id } });
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    Object.assign(user, dto);
    return this.userRepo.save(user);
  }

  async softDelete(id: string): Promise<void> {
    const user = await this.findById(id);
    user.is_active = false;
    await this.userRepo.save(user);
    await this.userRepo.softDelete(id);
  }

  async getUserOrganizations(userId: string) {
    const memberships = await this.teamMemberRepo.find({
      where: { user_id: userId },
      relations: ['organization'],
    });

    return memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      logo_url: m.organization.logo_url,
      role: m.role,
    }));
  }
}
