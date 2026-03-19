import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('organizations/:orgId/ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('conversations')
  async createConversation(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Req() req: { user?: { id: string } },
  ) {
    const userId = req.user?.id || orgId;
    const conversation = await this.aiService.createConversation(orgId, userId);
    return { data: conversation };
  }

  @Get('conversations')
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
  async getConversation(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const conversation = await this.aiService.getConversation(orgId, id);
    return { data: conversation };
  }

  @Delete('conversations/:id')
  async deleteConversation(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.aiService.deleteConversation(orgId, id);
    return { data: { message: 'Conversation deleted' } };
  }

  @Post('conversations/:id/messages')
  async sendMessage(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { content: string },
    @Req() req: { user?: { id: string } },
  ) {
    const userId = req.user?.id || orgId;
    const result = await this.aiService.sendMessage(orgId, userId, id, body.content);
    return { data: result };
  }

  @Get('usage')
  async getUsage(@Param('orgId', ParseUUIDPipe) orgId: string) {
    const usage = await this.aiService.getUsage(orgId);
    return { data: usage };
  }
}
