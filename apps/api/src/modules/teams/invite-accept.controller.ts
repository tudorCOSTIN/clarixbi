import { Controller, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { TeamsService } from './teams.service';

@ApiTags('Invites')
@ApiBearerAuth()
@Controller('invites')
@UseGuards(JwtAuthGuard)
export class InviteAcceptController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post(':token/accept')
  @ApiOperation({ summary: 'Accept an invite by token' })
  @ApiResponse({ status: 201, description: 'Invite accepted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async acceptInvite(@Param('token') token: string, @CurrentUser() user: JwtUser) {
    const member = await this.teamsService.acceptInviteByToken(token, user.id);
    return { data: member };
  }
}
