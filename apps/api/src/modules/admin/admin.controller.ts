import { Controller, Get, Param, Query, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgMemberGuard } from '../auth/guards/org-member.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TeamRole } from '../teams/entities/team-member.entity';
import { AdminService } from './admin.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

@Controller('organizations/:orgId/admin')
@UseGuards(JwtAuthGuard, OrgMemberGuard, RolesGuard)
@Roles(TeamRole.OWNER)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('audit-logs')
  async listAuditLogs(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Query() query: QueryAuditLogsDto,
  ) {
    return this.adminService.findAllAuditLogs(orgId, query);
  }

  @Get('audit-logs/:id')
  async getAuditLog(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const log = await this.adminService.findOneAuditLog(orgId, id);
    return { data: log };
  }

  @Get('stats')
  async getOrgStats(@Param('orgId', ParseUUIDPipe) orgId: string) {
    const stats = await this.adminService.getOrgStats(orgId);
    return { data: stats };
  }
}
