import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgMemberGuard } from '../auth/guards/org-member.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TeamRole } from '../teams/entities/team-member.entity';
import { OverviewService } from './overview.service';

@ApiTags('Overview')
@ApiBearerAuth()
@Controller('organizations/:orgId')
@UseGuards(JwtAuthGuard, OrgMemberGuard, RolesGuard)
export class OverviewController {
  constructor(private readonly overviewService: OverviewService) {}

  @Get('overview')
  @Roles(TeamRole.VIEWER)
  @ApiOperation({ summary: 'Get organization overview with KPIs and recent activity' })
  async getOverview(@Param('orgId', ParseUUIDPipe) orgId: string) {
    const data = await this.overviewService.getOverview(orgId);
    return { data };
  }
}
