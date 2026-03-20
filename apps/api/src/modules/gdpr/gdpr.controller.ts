import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  StreamableFile,
  NotFoundException,
} from '@nestjs/common';
import { createReadStream, existsSync } from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtUser } from '../auth/interfaces/jwt-user.interface';
import { GdprService } from './gdpr.service';

@Controller('users/me/gdpr')
@UseGuards(JwtAuthGuard)
export class GdprController {
  constructor(private readonly gdprService: GdprService) {}

  @Post('delete')
  async requestDeletion(@CurrentUser() user: JwtUser) {
    const request = await this.gdprService.requestDeletion(user.id);
    return {
      id: request.id,
      status: request.status,
      scheduled_at: request.scheduled_at,
      message: 'Your account deletion has been scheduled. You have 30 days to cancel.',
    };
  }

  @Post('export')
  async requestExport(@CurrentUser() user: JwtUser) {
    const request = await this.gdprService.requestExport(user.id);
    return {
      id: request.id,
      status: request.status,
      message: 'Your data export is being prepared. You will be notified when it is ready.',
    };
  }

  @Get('export/:requestId/status')
  async getExportStatus(@CurrentUser() user: JwtUser, @Param('requestId') requestId: string) {
    const request = await this.gdprService.getExportStatus(user.id, requestId);
    return {
      id: request.id,
      status: request.status,
      completed_at: request.completed_at,
      download_expires_at: request.download_expires_at,
    };
  }

  @Get('export/:requestId/download')
  async downloadExport(
    @CurrentUser() user: JwtUser,
    @Param('requestId') requestId: string,
  ): Promise<StreamableFile> {
    const filePath = await this.gdprService.getExportDownload(user.id, requestId);

    if (!existsSync(filePath)) {
      throw new NotFoundException('Export file no longer exists');
    }

    const stream = createReadStream(filePath);
    return new StreamableFile(stream, {
      type: 'application/zip',
      disposition: `attachment; filename="gdpr-export.zip"`,
    });
  }

  @Get('delete/status')
  async getDeletionStatus(@CurrentUser() user: JwtUser) {
    const request = await this.gdprService.getDeletionStatus(user.id);
    if (!request) {
      return { status: 'none', message: 'No deletion request found' };
    }
    return {
      id: request.id,
      status: request.status,
      scheduled_at: request.scheduled_at,
      completed_at: request.completed_at,
    };
  }
}
