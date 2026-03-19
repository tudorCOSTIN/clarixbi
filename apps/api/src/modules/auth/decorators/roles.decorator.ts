import { SetMetadata } from '@nestjs/common';
import { TeamRole } from '../../teams/entities/team-member.entity';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: TeamRole[]) => SetMetadata(ROLES_KEY, roles);
