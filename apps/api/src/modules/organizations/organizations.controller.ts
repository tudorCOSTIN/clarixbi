import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgMemberGuard } from '../auth/guards/org-member.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { Roles } from '../auth/decorators/roles.decorator';
import { TeamRole } from '../teams/entities/team-member.entity';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private orgsService: OrganizationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new organization (user becomes owner)' })
  async create(@CurrentUser() user: JwtUser, @Body() dto: CreateOrganizationDto) {
    const org = await this.orgsService.create(dto, user.id);
    return { data: org };
  }

  @Get(':orgId')
  @UseGuards(OrgMemberGuard)
  @ApiOperation({ summary: 'Get organization details (members only)' })
  async findOne(@Param('orgId') orgId: string) {
    const org = await this.orgsService.findById(orgId);
    return { data: org };
  }

  @Patch(':orgId')
  @UseGuards(OrgMemberGuard, RolesGuard)
  @Roles(TeamRole.ADMIN)
  @ApiOperation({ summary: 'Update organization (admin+ only)' })
  async update(@Param('orgId') orgId: string, @Body() dto: UpdateOrganizationDto) {
    const org = await this.orgsService.update(orgId, dto);
    return { data: org };
  }

  @Delete(':orgId')
  @UseGuards(OrgMemberGuard, RolesGuard)
  @Roles(TeamRole.OWNER)
  @ApiOperation({ summary: 'Soft delete organization (owner only)' })
  async remove(@Param('orgId') orgId: string) {
    await this.orgsService.softDelete(orgId);
    return { data: { message: 'Organization deleted successfully' } };
  }
}
