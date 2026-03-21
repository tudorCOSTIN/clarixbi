import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../config/database.config';
import { Plan } from '../modules/billing/entities/plan.entity';

async function seed() {
  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();

  const planRepo = dataSource.getRepository(Plan);

  const plans = [
    {
      name: 'starter',
      display_name: 'Starter',
      price_monthly_eur: 49,
      price_annual_eur: 470.4,
      stripe_price_monthly_id: process.env['STRIPE_PRICE_STARTER_MONTHLY'] || null,
      stripe_price_annual_id: process.env['STRIPE_PRICE_STARTER_ANNUAL'] || null,
      limits: {
        max_data_sources: 1,
        max_dashboards: 3,
        max_team_members: 1,
        max_ai_queries_monthly: 100,
        max_alerts: 3,
      },
      features: ['single_data_source', 'basic_dashboards', 'email_support', 'csv_export'],
      is_active: true,
    },
    {
      name: 'pro',
      display_name: 'Pro',
      price_monthly_eur: 149,
      price_annual_eur: 1430.4,
      stripe_price_monthly_id: process.env['STRIPE_PRICE_PRO_MONTHLY'] || null,
      stripe_price_annual_id: process.env['STRIPE_PRICE_PRO_ANNUAL'] || null,
      limits: {
        max_data_sources: 5,
        max_dashboards: 20,
        max_team_members: 5,
        max_ai_queries_monthly: 500,
        max_alerts: 20,
      },
      features: [
        'multiple_data_sources',
        'advanced_dashboards',
        'ai_assistant',
        'scheduled_reports',
        'priority_support',
        'csv_export',
        'pdf_export',
      ],
      is_active: true,
    },
    {
      name: 'enterprise',
      display_name: 'Enterprise',
      price_monthly_eur: 299,
      price_annual_eur: 2870.4,
      stripe_price_monthly_id: process.env['STRIPE_PRICE_ENTERPRISE_MONTHLY'] || null,
      stripe_price_annual_id: process.env['STRIPE_PRICE_ENTERPRISE_ANNUAL'] || null,
      limits: {
        max_data_sources: 20,
        max_dashboards: -1,
        max_team_members: 20,
        max_ai_queries_monthly: 2000,
        max_alerts: -1,
      },
      features: [
        'unlimited_dashboards',
        'unlimited_alerts',
        'multiple_data_sources',
        'advanced_dashboards',
        'ai_assistant',
        'scheduled_reports',
        'dedicated_support',
        'csv_export',
        'pdf_export',
        'white_label',
        'sso',
        'audit_logs',
        'api_access',
      ],
      is_active: true,
    },
  ];

  for (const planData of plans) {
    const existing = await planRepo.findOne({ where: { name: planData.name } });
    if (existing) {
      await planRepo.update(existing.id, planData);
      console.log(`Updated plan: ${planData.name}`);
    } else {
      await planRepo.save(planRepo.create(planData));
      console.log(`Created plan: ${planData.name}`);
    }
  }

  console.log('Seed completed successfully.');
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
