import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgMemberGuard } from '../auth/guards/org-member.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { TeamRole } from '../teams/entities/team-member.entity';
import { NotificationsService } from './notifications.service';
import { QueryNotificationsDto } from './dto/query-notifications.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('organizations/:orgId/notifications')
@UseGuards(JwtAuthGuard, OrgMemberGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Roles(TeamRole.VIEWER)
  @ApiOperation({ summary: 'List notifications' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async list(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Query() query: QueryNotificationsDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.notificationsService.findAll(user.id, orgId, query);
  }

  @Patch(':id/read')
  @Roles(TeamRole.VIEWER)
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({ status: 200, description: 'Updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markRead(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    const notification = await this.notificationsService.markRead(user.id, orgId, id);
    return { data: notification };
  }

  @Post('mark-all-read')
  @Roles(TeamRole.VIEWER)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 201, description: 'All marked as read' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markAllRead(@Param('orgId', ParseUUIDPipe) orgId: string, @CurrentUser() user: JwtUser) {
    return this.notificationsService.markAllRead(user.id, orgId);
  }

  @Delete(':id')
  @Roles(TeamRole.EDITOR)
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiResponse({ status: 200, description: 'Deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async remove(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.notificationsService.remove(user.id, orgId, id);
    return { data: { message: 'Notification deleted' } };
  }

  @Get('unread-count')
  @Roles(TeamRole.VIEWER)
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async unreadCount(@Param('orgId', ParseUUIDPipe) orgId: string, @CurrentUser() user: JwtUser) {
    return this.notificationsService.getUnreadCount(user.id, orgId);
  }
}
