import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  Req,
} from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';

@Controller('organizations/:orgId/alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post()
  async create(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Body() dto: CreateAlertDto,
    @Req() req: { user?: { id: string } },
  ) {
    const userId = req.user?.id || orgId;
    const alert = await this.alertsService.create(orgId, userId, dto);
    return { data: alert };
  }

  @Get()
  async list(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.alertsService.list(
      orgId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
    return { data: result.data, total: result.total };
  }

  @Get(':id')
  async findOne(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const alert = await this.alertsService.findOne(orgId, id);
    return { data: alert };
  }

  @Patch(':id')
  async update(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAlertDto,
  ) {
    const alert = await this.alertsService.update(orgId, id, dto);
    return { data: alert };
  }

  @Delete(':id')
  async remove(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.alertsService.remove(orgId, id);
    return { data: { message: 'Alert deleted' } };
  }

  @Patch(':id/toggle')
  async toggle(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { isActive: boolean },
  ) {
    const alert = await this.alertsService.toggle(orgId, id, body.isActive);
    return { data: alert };
  }

  @Post(':id/test')
  async test(@Param('orgId', ParseUUIDPipe) orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    const result = await this.alertsService.test(orgId, id);
    return { data: result };
  }

  @Get(':id/triggers')
  async triggers(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.alertsService.getTriggerHistory(
      orgId,
      id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
    return { data: result.data, total: result.total };
  }
}
