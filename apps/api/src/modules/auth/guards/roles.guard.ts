import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { TeamMember, TeamRole } from '../../teams/entities/team-member.entity';

const ROLE_HIERARCHY: Record<TeamRole, number> = {
  [TeamRole.VIEWER]: 0,
  [TeamRole.EDITOR]: 1,
  [TeamRole.ADMIN]: 2,
  [TeamRole.OWNER]: 3,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(TeamMember)
    private teamMemberRepo: Repository<TeamMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<TeamRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const orgId = request.orgId || request.params?.orgId;

    if (!user || !orgId) {
      throw new ForbiddenException('Missing user or organization context');
    }

    const membership = await this.teamMemberRepo.findOne({
      where: { user_id: user.id, org_id: orgId },
    });

    if (!membership) {
      throw new ForbiddenException('Not a member of this organization');
    }

    const userRoleLevel = ROLE_HIERARCHY[membership.role];
    const minRequiredLevel = Math.min(...requiredRoles.map((r) => ROLE_HIERARCHY[r]));

    if (userRoleLevel < minRequiredLevel) {
      throw new ForbiddenException('Insufficient role permissions');
    }

    return true;
  }
}
