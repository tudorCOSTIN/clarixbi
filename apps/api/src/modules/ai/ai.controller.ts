import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
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
import { PlanLimitGuard } from '../billing/guards/plan-limit.guard';
import { CheckPlanLimit } from '../billing/decorators/requires-plan.decorator';
import { AiService } from './ai.service';

@Controller('organizations/:orgId/ai')
@UseGuards(JwtAuthGuard, OrgMemberGuard, RolesGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('conversations')
  @Roles(TeamRole.VIEWER)
  async createConversation(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const conversation = await this.aiService.createConversation(orgId, user.id);
    return { data: conversation };
  }

  @Get('conversations')
  @Roles(TeamRole.VIEWER)
  async listConversations(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.aiService.listConversations(
      orgId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
    return { data: result.data, total: result.total };
  }

  @Get('conversations/:id')
  @Roles(TeamRole.VIEWER)
  async getConversation(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const conversation = await this.aiService.getConversation(orgId, id);
    return { data: conversation };
  }

  @Delete('conversations/:id')
  @Roles(TeamRole.EDITOR)
  async deleteConversation(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.aiService.deleteConversation(orgId, id);
    return { data: { message: 'Conversation deleted' } };
  }

  @Post('conversations/:id/messages')
  @Roles(TeamRole.VIEWER)
  @UseGuards(PlanLimitGuard)
  @CheckPlanLimit('ai_queries')
  async sendMessage(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { content: string },
    @CurrentUser() user: JwtUser,
  ) {
    const result = await this.aiService.sendMessage(orgId, user.id, id, body.content);
    return { data: result };
  }

  @Get('usage')
  @Roles(TeamRole.VIEWER)
  async getUsage(@Param('orgId', ParseUUIDPipe) orgId: string) {
    const usage = await this.aiService.getUsage(orgId);
    return { data: usage };
  }
}
