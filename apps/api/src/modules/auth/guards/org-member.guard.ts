import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeamMember } from '../../teams/entities/team-member.entity';

@Injectable()
export class OrgMemberGuard implements CanActivate {
  constructor(
    @InjectRepository(TeamMember)
    private teamMemberRepo: Repository<TeamMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const orgId = request.orgId || request.params?.orgId;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if (!orgId) {
      throw new ForbiddenException('Organization context required');
    }

    const membership = await this.teamMemberRepo.findOne({
      where: { user_id: user.id, org_id: orgId },
    });

    if (!membership) {
      throw new ForbiddenException('Not a member of this organization');
    }

    // Attach membership to request for downstream use
    request.membership = membership;

    return true;
  }
}
