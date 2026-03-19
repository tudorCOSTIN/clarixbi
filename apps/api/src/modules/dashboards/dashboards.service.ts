import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dashboard } from './entities/dashboard.entity';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';

@Injectable()
export class DashboardsService {
  constructor(
    @InjectRepository(Dashboard)
    private readonly dashboardRepo: Repository<Dashboard>,
  ) {}

  async create(orgId: string, userId: string, dto: CreateDashboardDto): Promise<Dashboard> {
    const dashboard = this.dashboardRepo.create({
      org_id: orgId,
      created_by: userId,
      name: dto.name,
      description: dto.description || null,
      layout: [],
      is_auto_generated: false,
    });
    return this.dashboardRepo.save(dashboard);
  }

  async findAll(orgId: string): Promise<Dashboard[]> {
    return this.dashboardRepo.find({
      where: { org_id: orgId },
      order: { created_at: 'DESC' },
      relations: ['widgets'],
    });
  }

  async findOne(orgId: string, id: string): Promise<Dashboard> {
    const dashboard = await this.dashboardRepo.findOne({
      where: { id, org_id: orgId },
      relations: ['widgets', 'widgets.data_source'],
    });
    if (!dashboard) {
      throw new NotFoundException('Dashboard not found');
    }
    return dashboard;
  }

  async update(orgId: string, id: string, dto: UpdateDashboardDto): Promise<Dashboard> {
    const dashboard = await this.findOne(orgId, id);
    if (dto.name !== undefined) dashboard.name = dto.name;
    if (dto.description !== undefined) dashboard.description = dto.description;
    if (dto.layout !== undefined) dashboard.layout = dto.layout;
    return this.dashboardRepo.save(dashboard);
  }

  async remove(orgId: string, id: string): Promise<void> {
    const dashboard = await this.findOne(orgId, id);
    await this.dashboardRepo.softRemove(dashboard);
  }
}
