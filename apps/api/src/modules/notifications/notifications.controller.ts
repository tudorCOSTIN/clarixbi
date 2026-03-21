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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgMemberGuard } from '../auth/guards/org-member.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { TeamRole } from '../teams/entities/team-member.entity';
import { NotificationsService } from './notifications.service';
import { QueryNotificationsDto } from './dto/query-notifications.dto';

@Controller('organizations/:orgId/notifications')
@UseGuards(JwtAuthGuard, OrgMemberGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Roles(TeamRole.VIEWER)
  async list(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Query() query: QueryNotificationsDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.notificationsService.findAll(user.id, orgId, query);
  }

  @Patch(':id/read')
  @Roles(TeamRole.VIEWER)
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
  async markAllRead(@Param('orgId', ParseUUIDPipe) orgId: string, @CurrentUser() user: JwtUser) {
    return this.notificationsService.markAllRead(user.id, orgId);
  }

  @Delete(':id')
  @Roles(TeamRole.EDITOR)
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
  async unreadCount(@Param('orgId', ParseUUIDPipe) orgId: string, @CurrentUser() user: JwtUser) {
    return this.notificationsService.getUnreadCount(user.id, orgId);
  }
}
