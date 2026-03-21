import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgMemberGuard } from '../auth/guards/org-member.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { TeamRole } from './entities/team-member.entity';
import { TeamsService } from './teams.service';
import { CheckPlanLimit } from '../billing/decorators/requires-plan.decorator';
import { PlanLimitGuard } from '../billing/guards/plan-limit.guard';
import { IsEmail, IsEnum } from 'class-validator';

class InviteDto {
  @IsEmail()
  email: string;

  @IsEnum(TeamRole)
  role: TeamRole;
}

class ChangeRoleDto {
  @IsEnum(TeamRole)
  role: TeamRole;
}

@Controller('organizations/:orgId/team')
@UseGuards(JwtAuthGuard, OrgMemberGuard, RolesGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  @Roles(TeamRole.VIEWER)
  async listMembers(@Param('orgId', ParseUUIDPipe) orgId: string) {
    const [members, pendingInvites] = await Promise.all([
      this.teamsService.listMembers(orgId),
      this.teamsService.getPendingInvites(orgId),
    ]);
    return { data: { members, pendingInvites } };
  }

  @Post('invite')
  @Roles(TeamRole.ADMIN)
  @UseGuards(PlanLimitGuard)
  @CheckPlanLimit('team_members')
  async invite(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: InviteDto,
  ) {
    const member = await this.teamsService.invite(orgId, user.id, dto.email, dto.role);
    return { data: member };
  }

  @Patch(':memberId')
  @Roles(TeamRole.ADMIN)
  async changeRole(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: ChangeRoleDto,
  ) {
    const member = await this.teamsService.changeRole(orgId, memberId, dto.role);
    return { data: member };
  }

  @Delete(':memberId')
  @Roles(TeamRole.ADMIN)
  async removeMember(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    await this.teamsService.removeMember(orgId, memberId);
    return { data: { message: 'Member removed' } };
  }

  @Post(':inviteId/resend')
  @Roles(TeamRole.ADMIN)
  async resendInvite(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('inviteId', ParseUUIDPipe) inviteId: string,
  ) {
    const invite = await this.teamsService.resendInvite(orgId, inviteId);
    return { data: invite };
  }

  @Delete(':inviteId/revoke')
  @Roles(TeamRole.ADMIN)
  async revokeInvite(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('inviteId', ParseUUIDPipe) inviteId: string,
  ) {
    await this.teamsService.revokeInvite(orgId, inviteId);
    return { data: { message: 'Invite revoked' } };
  }
}

/**
 * Separate controller for public invite acceptance (requires auth but not org membership).
 */
@Controller('invites')
@UseGuards(JwtAuthGuard)
export class InviteAcceptController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post(':token/accept')
  async acceptInvite(@Param('token') token: string, @CurrentUser() user: JwtUser) {
    const member = await this.teamsService.acceptInviteByToken(token, user.id);
    return { data: member };
  }
}
