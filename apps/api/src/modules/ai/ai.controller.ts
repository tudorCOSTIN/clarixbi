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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('AI')
@ApiBearerAuth()
@Controller('organizations/:orgId/ai')
@UseGuards(JwtAuthGuard, OrgMemberGuard, RolesGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('conversations')
  @Roles(TeamRole.VIEWER)
  @ApiOperation({ summary: 'Create a new AI conversation' })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createConversation(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const conversation = await this.aiService.createConversation(orgId, user.id);
    return { data: conversation };
  }

  @Get('conversations')
  @Roles(TeamRole.VIEWER)
  @ApiOperation({ summary: 'List AI conversations' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiOperation({ summary: 'Get AI conversation by ID' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getConversation(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const conversation = await this.aiService.getConversation(orgId, id);
    return { data: conversation };
  }

  @Delete('conversations/:id')
  @Roles(TeamRole.EDITOR)
  @ApiOperation({ summary: 'Delete an AI conversation' })
  @ApiResponse({ status: 200, description: 'Deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiOperation({ summary: 'Send a message to AI conversation' })
  @ApiResponse({ status: 201, description: 'Message sent' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async sendMessage(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: JwtUser,
  ) {
    const result = await this.aiService.sendMessage(orgId, user.id, id, dto.content);
    return { data: result };
  }

  @Get('usage')
  @Roles(TeamRole.VIEWER)
  @ApiOperation({ summary: 'Get AI usage stats' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUsage(@Param('orgId', ParseUUIDPipe) orgId: string) {
    const usage = await this.aiService.getUsage(orgId);
    return { data: usage };
  }
}
