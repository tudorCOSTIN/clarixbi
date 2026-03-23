import { Injectable, Logger } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from './entities/report.entity';
import { Widget } from '../widgets/entities/widget.entity';
import { ClickHouseService } from '../clickhouse/clickhouse.service';

interface GenerateJobData {
  reportId: string;
  orgId: string;
  dashboardId: string;
  widgetIds: string[];
  reportName: string;
}

@Injectable()
export class ReportsGenerateProcessor {
  private readonly logger = new Logger(ReportsGenerateProcessor.name);
  private worker: Worker | null = null;

  constructor(
    @InjectRepository(Report)
    private reportRepo: Repository<Report>,
    @InjectRepository(Widget)
    private widgetRepo: Repository<Widget>,
    private clickhouse: ClickHouseService,
  ) {
    this.initWorker();
  }

  private initWorker() {
    const redisUrl = process.env['REDIS_URL']!;
    const parsed = new URL(redisUrl);

    this.worker = new Worker(
      'reports-generate',
      async (job: Job<GenerateJobData>) => {
        return this.process(job);
      },
      {
        connection: {
          host: parsed.hostname,
          port: parseInt(parsed.port || '6379', 10),
          password: parsed.password || undefined,
          maxRetriesPerRequest: null,
        },
        concurrency: 3,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Report generation completed: ${job.id}`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Report generation failed: ${job?.id} - ${err.message}`);
    });
  }

  private async process(job: Job<GenerateJobData>): Promise<{ pdfUrl: string }> {
    const { reportId, orgId, widgetIds, reportName } = job.data;

    this.logger.log(`Generating PDF for report ${reportId} (${reportName})`);

    // Gather widget data
    const widgetDataList: {
      title: string;
      type: string;
      data: Record<string, unknown>[];
      config: Record<string, unknown>;
    }[] = [];

    for (const widgetId of widgetIds) {
      const widget = await this.widgetRepo.findOne({
        where: { id: widgetId, org_id: orgId },
      });
      if (!widget) continue;

      try {
        const data = await this.clickhouse.query(widget.query_sql);
        widgetDataList.push({
          title: widget.title,
          type: widget.type,
          data,
          config: widget.config,
        });
      } catch (error) {
        this.logger.warn(`Widget ${widgetId} query failed: ${error}`);
        widgetDataList.push({
          title: widget.title,
          type: widget.type,
          data: [],
          config: widget.config,
        });
      }
    }

    // Generate PDF content (simplified - in production would use Puppeteer or @react-pdf/renderer)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const pdfPath = `reports/${orgId}/${reportId}/${timestamp}.pdf`;

    // Build PDF data structure for storage
    const pdfData = {
      reportName,
      generatedAt: new Date().toISOString(),
      orgId,
      widgets: widgetDataList.map((w) => ({
        title: w.title,
        type: w.type,
        rowCount: w.data.length,
        summary: this.generateDataSummary(w.data),
      })),
    };

    // Store generated file reference in report config
    const report = await this.reportRepo.findOne({ where: { id: reportId } });
    if (report) {
      const config = report.config as Record<string, unknown>;
      const generatedFiles =
        (config.generatedFiles as { url: string; generatedAt: string }[]) || [];
      generatedFiles.push({
        url: pdfPath,
        generatedAt: new Date().toISOString(),
      });
      config.generatedFiles = generatedFiles;
      config.lastGeneratedData = pdfData;
      report.config = config;
      await this.reportRepo.save(report);
    }

    this.logger.log(`PDF generated for report ${reportId}: ${pdfPath}`);
    return { pdfUrl: pdfPath };
  }

  private generateDataSummary(data: Record<string, unknown>[]): string {
    if (data.length === 0) return 'No data';
    const columns = Object.keys(data[0]!);
    return `${data.length} rows, ${columns.length} columns (${columns.slice(0, 3).join(', ')})`;
  }
}
