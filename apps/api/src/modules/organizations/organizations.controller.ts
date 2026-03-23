import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
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
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@CurrentUser() user: JwtUser, @Body() dto: CreateOrganizationDto) {
    const org = await this.orgsService.create(dto, user.id);
    return { data: org };
  }

  @Get(':orgId')
  @UseGuards(OrgMemberGuard)
  @ApiOperation({ summary: 'Get organization details (members only)' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findOne(@Param('orgId', ParseUUIDPipe) orgId: string) {
    const org = await this.orgsService.findById(orgId);
    return { data: org };
  }

  @Patch(':orgId')
  @UseGuards(OrgMemberGuard, RolesGuard)
  @Roles(TeamRole.ADMIN)
  @ApiOperation({ summary: 'Update organization (admin+ only)' })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async update(@Param('orgId', ParseUUIDPipe) orgId: string, @Body() dto: UpdateOrganizationDto) {
    const org = await this.orgsService.update(orgId, dto);
    return { data: org };
  }

  @Delete(':orgId')
  @UseGuards(OrgMemberGuard, RolesGuard)
  @Roles(TeamRole.OWNER)
  @ApiOperation({ summary: 'Soft delete organization (owner only)' })
  @ApiResponse({ status: 200, description: 'Deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async remove(@Param('orgId', ParseUUIDPipe) orgId: string) {
    await this.orgsService.softDelete(orgId);
    return { data: { message: 'Organization deleted successfully' } };
  }
}
