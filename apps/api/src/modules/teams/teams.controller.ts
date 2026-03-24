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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TeamRole } from './entities/team-member.entity';
import { TeamsService } from './teams.service';
import { CheckPlanLimit } from '../billing/decorators/requires-plan.decorator';
import { PlanLimitGuard } from '../billing/guards/plan-limit.guard';
import { InviteDto } from './dto/invite.dto';
import { ChangeRoleDto } from './dto/change-role.dto';

@ApiTags('Teams')
@ApiBearerAuth()
@Controller('organizations/:orgId/team')
@UseGuards(JwtAuthGuard, OrgMemberGuard, RolesGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  @Roles(TeamRole.VIEWER)
  @ApiOperation({ summary: 'List team members and pending invites' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiOperation({ summary: 'Invite a new team member' })
  @ApiResponse({ status: 201, description: 'Invite sent' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiOperation({ summary: 'Change team member role' })
  @ApiResponse({ status: 200, description: 'Role updated' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiOperation({ summary: 'Remove a team member' })
  @ApiResponse({ status: 200, description: 'Member removed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async removeMember(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    await this.teamsService.removeMember(orgId, memberId);
    return { data: { message: 'Member removed' } };
  }

  @Post(':inviteId/resend')
  @Roles(TeamRole.ADMIN)
  @ApiOperation({ summary: 'Resend an invite' })
  @ApiResponse({ status: 201, description: 'Invite resent' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async resendInvite(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('inviteId', ParseUUIDPipe) inviteId: string,
  ) {
    const invite = await this.teamsService.resendInvite(orgId, inviteId);
    return { data: invite };
  }

  @Delete(':inviteId/revoke')
  @Roles(TeamRole.ADMIN)
  @ApiOperation({ summary: 'Revoke a pending invite' })
  @ApiResponse({ status: 200, description: 'Invite revoked' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async revokeInvite(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('inviteId', ParseUUIDPipe) inviteId: string,
  ) {
    await this.teamsService.revokeInvite(orgId, inviteId);
    return { data: { message: 'Invite revoked' } };
  }
}
