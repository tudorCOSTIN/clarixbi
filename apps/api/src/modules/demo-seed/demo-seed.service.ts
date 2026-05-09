import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { Dashboard, DashboardSourceType } from '../dashboards/entities/dashboard.entity';
import { Widget } from '../widgets/entities/widget.entity';
import {
  DataSourceEntity,
  DataSourceType,
  DataSourceStatus,
} from '../data-sources/entities/data-source.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { ClickHouseService } from '../clickhouse/clickhouse.service';
import { WidgetType } from '@clarixbi/shared';

/* ──────────────────────────── constants ──────────────────────────── */

const MONTHS_OF_DATA = 12;
const ORDERS_PER_MONTH_MIN = 30;
const ORDERS_PER_MONTH_MAX = 60;
const BATCH_SIZE = 1000;

const FIRST_NAMES = [
  'Ion',
  'Maria',
  'Andrei',
  'Elena',
  'Alexandru',
  'Ana',
  'Mihai',
  'Ioana',
  'George',
  'Cristina',
  'Adrian',
  'Gabriela',
  'Florin',
  'Raluca',
  'Vlad',
  'Diana',
  'Bogdan',
  'Alina',
  'Ciprian',
  'Simona',
  'Dan',
  'Laura',
  'Marius',
  'Oana',
  'Radu',
  'Camelia',
  'Sorin',
  'Bianca',
  'Cosmin',
  'Roxana',
];

const LAST_NAMES = [
  'Popescu',
  'Ionescu',
  'Popa',
  'Stan',
  'Dumitrescu',
  'Barbu',
  'Stoica',
  'Constantinescu',
  'Radu',
  'Gheorghe',
  'Moldovan',
  'Marin',
  'Tudor',
  'Nistor',
  'Lungu',
  'Preda',
  'Dinu',
  'Iordache',
  'Neagu',
  'Mazilu',
  'Rusu',
  'Ene',
  'Oprea',
  'Sandu',
  'Voicu',
  'Matei',
  'Manea',
  'Cojocaru',
];

const COMPANIES = [
  'TechStar SRL',
  'Digital Pro SRL',
  'InfoSoft SA',
  'NetLogic SRL',
  'DataWare SRL',
  'CloudTech SA',
  'ByteForce SRL',
  'WebMaster SRL',
  'SoftLine SRL',
  'MegaSoft SA',
  'ProIT SRL',
  'CyberSec SRL',
  'SmartCode SRL',
  'AppDev SRL',
  'RoTech SRL',
  'SilverBit SRL',
  'GoldNet SRL',
  'EasyIT SRL',
  'TopSoft SRL',
  'InnoTech SA',
];

const PAYMENT_METHODS = ['card', 'transfer_bancar', 'numerar', 'paypal'];

const ORDER_STATUSES = ['completed', 'processing', 'shipped', 'cancelled'];

const INVOICE_STATUSES = ['paid', 'pending', 'overdue', 'cancelled'];

const PRODUCT_TEMPLATES: Array<{
  name: string;
  category: string;
  price: number;
  sku: string;
}> = [
  { name: 'Laptop ASUS VivoBook 15', category: 'Laptopuri', price: 2899, sku: 'LAP-001' },
  { name: 'Laptop Lenovo IdeaPad 3', category: 'Laptopuri', price: 2199, sku: 'LAP-002' },
  { name: 'Laptop HP Pavilion 14', category: 'Laptopuri', price: 3499, sku: 'LAP-003' },
  { name: 'Laptop Dell Inspiron 16', category: 'Laptopuri', price: 4199, sku: 'LAP-004' },
  { name: 'MacBook Air M2', category: 'Laptopuri', price: 5999, sku: 'LAP-005' },
  { name: 'Samsung Galaxy S24', category: 'Telefoane', price: 4299, sku: 'TEL-001' },
  { name: 'iPhone 15', category: 'Telefoane', price: 4999, sku: 'TEL-002' },
  { name: 'Xiaomi 14', category: 'Telefoane', price: 2999, sku: 'TEL-003' },
  { name: 'Google Pixel 8', category: 'Telefoane', price: 3499, sku: 'TEL-004' },
  { name: 'OnePlus 12', category: 'Telefoane', price: 3899, sku: 'TEL-005' },
  { name: 'iPad Air', category: 'Tablete', price: 3199, sku: 'TAB-001' },
  { name: 'Samsung Galaxy Tab S9', category: 'Tablete', price: 2799, sku: 'TAB-002' },
  { name: 'Lenovo Tab P12', category: 'Tablete', price: 1999, sku: 'TAB-003' },
  { name: 'Husa Laptop 15"', category: 'Accesorii', price: 89, sku: 'ACC-001' },
  { name: 'Mouse Logitech MX Master', category: 'Accesorii', price: 399, sku: 'ACC-002' },
  { name: 'Tastatura Mecanica RGB', category: 'Accesorii', price: 349, sku: 'ACC-003' },
  { name: 'Casti Sony WH-1000XM5', category: 'Accesorii', price: 1499, sku: 'ACC-004' },
  { name: 'Incarcator USB-C 65W', category: 'Accesorii', price: 149, sku: 'ACC-005' },
  { name: 'Microsoft 365 Business', category: 'Software', price: 599, sku: 'SOF-001' },
  { name: 'Adobe Creative Cloud', category: 'Software', price: 299, sku: 'SOF-002' },
];

/* ──────────────────────── dashboard templates ──────────────────────── */

interface DashboardTemplate {
  name: string;
  description: string;
  sourceType: DashboardSourceType;
  widgets: Array<{
    title: string;
    type: WidgetType;
    querySql: string;
    position: Record<string, unknown>;
    config: Record<string, unknown>;
  }>;
}

const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  {
    name: 'Overview Vânzări',
    description: 'Metrici principale: revenue, comenzi, clienți',
    sourceType: DashboardSourceType.CSV,
    widgets: [
      {
        title: 'Revenue Total',
        type: WidgetType.KPI,
        querySql:
          "SELECT sum(total_amount) AS value FROM clarixbi_analytics.orders WHERE org_id = '{org_id}'",
        position: { h: 2, w: 3, x: 0, y: 0 },
        config: { color: '#2563eb', format: 'currency', currency: 'RON' },
      },
      {
        title: 'Număr Comenzi',
        type: WidgetType.KPI,
        querySql:
          "SELECT count() AS value FROM clarixbi_analytics.orders WHERE org_id = '{org_id}'",
        position: { h: 2, w: 3, x: 3, y: 0 },
        config: { color: '#16a34a', format: 'number' },
      },
      {
        title: 'Valoare Medie Comandă',
        type: WidgetType.KPI,
        querySql:
          "SELECT avg(total_amount) AS value FROM clarixbi_analytics.orders WHERE org_id = '{org_id}'",
        position: { h: 2, w: 3, x: 6, y: 0 },
        config: { color: '#9333ea', format: 'currency', currency: 'RON' },
      },
      {
        title: 'Clienți Activi',
        type: WidgetType.KPI,
        querySql:
          "SELECT count() AS value FROM clarixbi_analytics.customers WHERE org_id = '{org_id}'",
        position: { h: 2, w: 3, x: 9, y: 0 },
        config: { color: '#ea580c', format: 'number' },
      },
      {
        title: 'Evoluție Vânzări Lunare',
        type: WidgetType.LINE,
        querySql:
          "SELECT toStartOfMonth(order_date) AS month, sum(total_amount) AS total FROM clarixbi_analytics.orders WHERE org_id = '{org_id}' GROUP BY month ORDER BY month",
        position: { h: 4, w: 8, x: 0, y: 2 },
        config: { color: '#2563eb', xAxis: 'month', yAxis: 'total' },
      },
      {
        title: 'Revenue per Metodă de Plată',
        type: WidgetType.BAR,
        querySql:
          "SELECT payment_method, sum(total_amount) AS total FROM clarixbi_analytics.orders WHERE org_id = '{org_id}' GROUP BY payment_method ORDER BY total DESC",
        position: { h: 4, w: 4, x: 8, y: 2 },
        config: { color: '#16a34a', xAxis: 'payment_method', yAxis: 'total' },
      },
      {
        title: 'Ultimele Comenzi',
        type: WidgetType.TABLE,
        querySql:
          "SELECT order_number, customer_email, total_amount, status, order_date FROM clarixbi_analytics.orders WHERE org_id = '{org_id}' ORDER BY order_date DESC LIMIT 20",
        position: { h: 4, w: 12, x: 0, y: 6 },
        config: {
          columns: ['order_number', 'customer_email', 'total_amount', 'status', 'order_date'],
        },
      },
    ],
  },
  {
    name: 'Performanță Produse',
    description: 'Top produse, categorii, stocuri',
    sourceType: DashboardSourceType.CSV,
    widgets: [
      {
        title: 'Total Produse',
        type: WidgetType.KPI,
        querySql:
          "SELECT count() AS value FROM clarixbi_analytics.products WHERE org_id = '{org_id}'",
        position: { h: 2, w: 4, x: 0, y: 0 },
        config: { color: '#2563eb', format: 'number' },
      },
      {
        title: 'Produse Vândute',
        type: WidgetType.KPI,
        querySql:
          "SELECT sum(total_sold) AS value FROM clarixbi_analytics.products WHERE org_id = '{org_id}'",
        position: { h: 2, w: 4, x: 4, y: 0 },
        config: { color: '#16a34a', format: 'number' },
      },
      {
        title: 'Revenue Produse',
        type: WidgetType.KPI,
        querySql:
          "SELECT sum(total_revenue) AS value FROM clarixbi_analytics.products WHERE org_id = '{org_id}'",
        position: { h: 2, w: 4, x: 8, y: 0 },
        config: { color: '#9333ea', format: 'currency', currency: 'RON' },
      },
      {
        title: 'Top 10 Produse după Revenue',
        type: WidgetType.BAR,
        querySql:
          "SELECT name, total_revenue FROM clarixbi_analytics.products WHERE org_id = '{org_id}' ORDER BY total_revenue DESC LIMIT 10",
        position: { h: 4, w: 6, x: 0, y: 2 },
        config: { color: '#2563eb', xAxis: 'name', yAxis: 'total_revenue' },
      },
      {
        title: 'Distribuție Vânzări pe Categorii',
        type: WidgetType.PIE,
        querySql:
          "SELECT category, sum(total_revenue) AS total FROM clarixbi_analytics.products WHERE org_id = '{org_id}' GROUP BY category ORDER BY total DESC",
        position: { h: 4, w: 6, x: 6, y: 2 },
        config: { labelField: 'category', valueField: 'total' },
      },
      {
        title: 'Catalog Produse',
        type: WidgetType.TABLE,
        querySql:
          "SELECT name, category, price, stock_quantity, total_sold, total_revenue FROM clarixbi_analytics.products WHERE org_id = '{org_id}' ORDER BY total_revenue DESC LIMIT 50",
        position: { h: 4, w: 12, x: 0, y: 6 },
        config: {
          columns: ['name', 'category', 'price', 'stock_quantity', 'total_sold', 'total_revenue'],
        },
      },
    ],
  },
  {
    name: 'Analiză Clienți',
    description: 'Segmentare, retenție, LTV',
    sourceType: DashboardSourceType.CSV,
    widgets: [
      {
        title: 'Total Clienți',
        type: WidgetType.KPI,
        querySql:
          "SELECT count() AS value FROM clarixbi_analytics.customers WHERE org_id = '{org_id}'",
        position: { h: 2, w: 4, x: 0, y: 0 },
        config: { color: '#2563eb', format: 'number' },
      },
      {
        title: 'Revenue Mediu / Client',
        type: WidgetType.KPI,
        querySql:
          "SELECT avg(total_revenue) AS value FROM clarixbi_analytics.customers WHERE org_id = '{org_id}' AND total_revenue > 0",
        position: { h: 2, w: 4, x: 4, y: 0 },
        config: { color: '#16a34a', format: 'currency', currency: 'RON' },
      },
      {
        title: 'Total Plăți Primite',
        type: WidgetType.KPI,
        querySql:
          "SELECT count() AS value FROM clarixbi_analytics.payments WHERE org_id = '{org_id}'",
        position: { h: 2, w: 4, x: 8, y: 0 },
        config: { color: '#9333ea', format: 'number' },
      },
      {
        title: 'Top 10 Clienți după Revenue',
        type: WidgetType.BAR,
        querySql:
          "SELECT name, total_revenue FROM clarixbi_analytics.customers WHERE org_id = '{org_id}' ORDER BY total_revenue DESC LIMIT 10",
        position: { h: 4, w: 6, x: 0, y: 2 },
        config: { color: '#ea580c', xAxis: 'name', yAxis: 'total_revenue' },
      },
      {
        title: 'Trend Plăți Lunare',
        type: WidgetType.LINE,
        querySql:
          "SELECT toStartOfMonth(payment_date) AS month, sum(amount) AS total FROM clarixbi_analytics.payments WHERE org_id = '{org_id}' GROUP BY month ORDER BY month",
        position: { h: 4, w: 6, x: 6, y: 2 },
        config: { color: '#16a34a', xAxis: 'month', yAxis: 'total' },
      },
      {
        title: 'Lista Clienți',
        type: WidgetType.TABLE,
        querySql:
          "SELECT name, company, email, total_revenue, invoice_count FROM clarixbi_analytics.customers WHERE org_id = '{org_id}' ORDER BY total_revenue DESC LIMIT 50",
        position: { h: 4, w: 12, x: 0, y: 6 },
        config: { columns: ['name', 'company', 'email', 'total_revenue', 'invoice_count'] },
      },
    ],
  },
];

/* ──────────────────────── helper functions ──────────────────────── */

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function randomInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

function formatDateTime(d: Date): string {
  return d.toISOString().replace('T', ' ').split('.')[0]!;
}

/* ──────────────────────── service ──────────────────────── */

@Injectable()
export class DemoSeedService {
  private readonly logger = new Logger(DemoSeedService.name);

  constructor(
    @InjectRepository(Dashboard)
    private readonly dashboardRepo: Repository<Dashboard>,
    @InjectRepository(Widget)
    private readonly widgetRepo: Repository<Widget>,
    @InjectRepository(DataSourceEntity)
    private readonly dataSourceRepo: Repository<DataSourceEntity>,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    private readonly clickhouse: ClickHouseService,
  ) {}

  /**
   * Seeds a new organization with demo data:
   * 1. Creates a demo data source
   * 2. Generates ClickHouse analytics data (orders, products, customers, invoices, payments)
   * 3. Creates 3 dashboards with 19 widgets
   */
  async seedOrganization(orgId: string, userId: string): Promise<void> {
    this.logger.log(`Starting demo seed for org ${orgId}`);

    // Step 1: Create demo data source
    const dataSource = await this.createDemoDataSource(orgId);

    // Step 2: Seed ClickHouse data
    const totalRows = await this.seedClickHouseData(orgId, dataSource.id);

    // Step 3: Update data source with row count
    await this.dataSourceRepo.update(dataSource.id, {
      status: DataSourceStatus.ACTIVE,
      last_sync_at: new Date(),
      total_rows: totalRows,
    });

    // Step 4: Create dashboards + widgets
    const firstDashboardId = await this.createDashboardsAndWidgets(orgId, userId, dataSource.id);

    // Step 5: Set first dashboard as home dashboard
    if (firstDashboardId) {
      await this.orgRepo.update(orgId, { home_dashboard_id: firstDashboardId });
    }

    this.logger.log(
      `Demo seed complete for org ${orgId}: ${totalRows} ClickHouse rows, 3 dashboards, 19 widgets`,
    );
  }

  private async createDemoDataSource(orgId: string): Promise<DataSourceEntity> {
    const ds = this.dataSourceRepo.create({
      org_id: orgId,
      type: DataSourceType.CSV,
      name: 'Date Demo',
      credentials_encrypted: null,
      config: { isDemo: true, dataset: 'all' },
      status: DataSourceStatus.SYNCING,
    });
    return this.dataSourceRepo.save(ds);
  }

  private async createDashboardsAndWidgets(
    orgId: string,
    userId: string,
    dataSourceId: string,
  ): Promise<string | null> {
    let firstDashboardId: string | null = null;

    for (const tpl of DASHBOARD_TEMPLATES) {
      const dashboard = this.dashboardRepo.create({
        org_id: orgId,
        created_by: userId,
        name: tpl.name,
        description: tpl.description,
        layout: [],
        is_auto_generated: true,
        source_type: tpl.sourceType,
      });
      const saved = await this.dashboardRepo.save(dashboard);

      if (!firstDashboardId) {
        firstDashboardId = saved.id;
      }

      const widgets = tpl.widgets.map((w) =>
        this.widgetRepo.create({
          dashboard_id: saved.id,
          org_id: orgId,
          type: w.type,
          title: w.title,
          query_sql: w.querySql,
          position: w.position,
          config: w.config,
          data_source_id: dataSourceId,
        }),
      );
      await this.widgetRepo.save(widgets);
    }

    return firstDashboardId;
  }

  /* ─────────────── ClickHouse data generation ─────────────── */

  private async seedClickHouseData(orgId: string, dataSourceId: string): Promise<number> {
    // Use org_id as seed for deterministic but unique data per org
    const seedNum = orgId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const rng = seededRandom(seedNum);
    const now = new Date();
    let totalRows = 0;

    // Generate products (20 fixed products)
    const products = this.generateProducts(orgId, dataSourceId, rng);
    await this.batchInsert('clarixbi_analytics.products', products);
    totalRows += products.length;

    // Generate customers (~250)
    const customers = this.generateCustomers(orgId, dataSourceId, rng);
    await this.batchInsert('clarixbi_analytics.customers', customers);
    totalRows += customers.length;

    // Generate orders (~500)
    const orders = this.generateOrders(orgId, dataSourceId, rng, now, customers, products);
    await this.batchInsert('clarixbi_analytics.orders', orders);
    totalRows += orders.length;

    // Generate invoices (~500)
    const invoices = this.generateInvoices(orgId, dataSourceId, rng, now, customers);
    await this.batchInsert('clarixbi_analytics.invoices', invoices);
    totalRows += invoices.length;

    // Generate payments (~300)
    const payments = this.generatePayments(orgId, dataSourceId, rng, invoices);
    await this.batchInsert('clarixbi_analytics.payments', payments);
    totalRows += payments.length;

    // Update product totals based on orders
    await this.updateProductTotals(orgId, dataSourceId, products, orders);

    // Update customer totals based on invoices
    await this.updateCustomerTotals(orgId, dataSourceId, customers, invoices);

    return totalRows;
  }

  private generateProducts(
    orgId: string,
    dataSourceId: string,
    rng: () => number,
  ): Record<string, unknown>[] {
    return PRODUCT_TEMPLATES.map((p) => ({
      id: uuid(),
      org_id: orgId,
      data_source_id: dataSourceId,
      name: p.name,
      sku: p.sku,
      price: p.price,
      category: p.category,
      stock_quantity: randomInt(rng, 10, 500),
      status: 'publish',
      total_sold: 0,
      total_revenue: 0,
      imported_at: formatDateTime(new Date()),
    }));
  }

  private generateCustomers(
    orgId: string,
    dataSourceId: string,
    rng: () => number,
  ): Record<string, unknown>[] {
    const count = randomInt(rng, 230, 270);
    const customers: Record<string, unknown>[] = [];
    for (let i = 0; i < count; i++) {
      const firstName = pick(rng, FIRST_NAMES);
      const lastName = pick(rng, LAST_NAMES);
      customers.push({
        id: uuid(),
        org_id: orgId,
        data_source_id: dataSourceId,
        name: `${firstName} ${lastName}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`,
        phone: `07${randomInt(rng, 10, 99)}${randomInt(rng, 100000, 999999)}`,
        company: rng() > 0.4 ? pick(rng, COMPANIES) : '',
        tax_code: rng() > 0.5 ? `RO${randomInt(rng, 10000000, 99999999)}` : '',
        total_revenue: 0,
        invoice_count: 0,
        first_invoice_date: null,
        last_invoice_date: null,
        imported_at: formatDateTime(new Date()),
      });
    }
    return customers;
  }

  private generateOrders(
    orgId: string,
    dataSourceId: string,
    rng: () => number,
    now: Date,
    customers: Record<string, unknown>[],
    products: Record<string, unknown>[],
  ): Record<string, unknown>[] {
    const orders: Record<string, unknown>[] = [];
    let orderNum = 1000;

    for (let m = MONTHS_OF_DATA - 1; m >= 0; m--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
      // Slight upward trend
      const growthFactor = 1 + (MONTHS_OF_DATA - m) * 0.03;
      const count = Math.round(
        randomInt(rng, ORDERS_PER_MONTH_MIN, ORDERS_PER_MONTH_MAX) * growthFactor,
      );

      for (let i = 0; i < count; i++) {
        const day = randomInt(rng, 1, 28);
        const hour = randomInt(rng, 8, 22);
        const orderDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), day, hour);
        const customer = pick(rng, customers);
        const product = pick(rng, products);
        const qty = randomInt(rng, 1, 5);
        const productPrice = product['price'] as number;
        const totalAmount = +(productPrice * qty * (0.9 + rng() * 0.2)).toFixed(2);

        orderNum++;
        orders.push({
          id: uuid(),
          org_id: orgId,
          data_source_id: dataSourceId,
          order_number: `ORD-${orderNum}`,
          customer_id: customer['id'] as string,
          customer_email: customer['email'] as string,
          order_date: formatDateTime(orderDate),
          status: pick(rng, ORDER_STATUSES),
          total_amount: totalAmount,
          currency: 'RON',
          discount_amount: rng() > 0.7 ? +(totalAmount * rng() * 0.15).toFixed(2) : 0,
          shipping_amount: rng() > 0.5 ? randomInt(rng, 15, 50) : 0,
          tax_amount: +(totalAmount * 0.19).toFixed(2),
          payment_method: pick(rng, PAYMENT_METHODS),
          items_count: qty,
          imported_at: formatDateTime(new Date()),
        });
      }
    }
    return orders;
  }

  private generateInvoices(
    orgId: string,
    dataSourceId: string,
    rng: () => number,
    now: Date,
    customers: Record<string, unknown>[],
  ): Record<string, unknown>[] {
    const invoices: Record<string, unknown>[] = [];
    let invNum = 2000;

    for (let m = MONTHS_OF_DATA - 1; m >= 0; m--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const count = randomInt(rng, 30, 55);

      for (let i = 0; i < count; i++) {
        const day = randomInt(rng, 1, 28);
        const issueDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
        const dueDate = new Date(issueDate);
        dueDate.setDate(dueDate.getDate() + 30);
        const customer = pick(rng, customers);
        const totalAmount = +(randomInt(rng, 100, 8000) + rng() * 100).toFixed(2);
        const status = pick(rng, INVOICE_STATUSES);
        const isPaid = status === 'paid';
        const paymentDate = isPaid
          ? new Date(issueDate.getTime() + randomInt(rng, 1, 25) * 86400000)
          : null;

        invNum++;
        invoices.push({
          id: uuid(),
          org_id: orgId,
          data_source_id: dataSourceId,
          invoice_number: `INV-${invNum}`,
          customer_id: customer['id'] as string,
          customer_name: customer['name'] as string,
          issue_date: formatDate(issueDate),
          due_date: formatDate(dueDate),
          total_amount: totalAmount,
          currency: 'RON',
          status,
          tax_amount: +(totalAmount * 0.19).toFixed(2),
          tax_type: 'TVA 19%',
          payment_date: paymentDate ? formatDate(paymentDate) : null,
          imported_at: formatDateTime(new Date()),
        });
      }
    }
    return invoices;
  }

  private generatePayments(
    orgId: string,
    dataSourceId: string,
    rng: () => number,
    invoices: Record<string, unknown>[],
  ): Record<string, unknown>[] {
    const paidInvoices = invoices.filter((inv) => inv['status'] === 'paid');
    // Take ~300 payments from paid invoices
    const subset = paidInvoices.slice(0, Math.min(300, paidInvoices.length));

    return subset.map((inv) => ({
      id: uuid(),
      org_id: orgId,
      data_source_id: dataSourceId,
      invoice_id: inv['id'] as string,
      amount: inv['total_amount'],
      currency: 'RON',
      payment_date: inv['payment_date'] as string,
      payment_method: pick(rng, PAYMENT_METHODS),
      imported_at: formatDateTime(new Date()),
    }));
  }

  private async updateProductTotals(
    orgId: string,
    dataSourceId: string,
    products: Record<string, unknown>[],
    orders: Record<string, unknown>[],
  ): Promise<void> {
    // Aggregate sales per product (approximate by distributing orders)
    const productSales = new Map<string, { sold: number; revenue: number }>();
    for (const p of products) {
      productSales.set(p['id'] as string, { sold: 0, revenue: 0 });
    }

    // Distribute orders across products based on existing data
    for (const order of orders) {
      if (order['status'] === 'cancelled') continue;
      // Pick a random product from our list for this order
      const productIdx = Math.floor(
        ((order['total_amount'] as number) * 7 + orders.indexOf(order)) % products.length,
      );
      const product = products[productIdx];
      if (!product) continue;
      const productId = product['id'] as string;
      const entry = productSales.get(productId);
      if (entry) {
        entry.sold += (order['items_count'] as number) || 1;
        entry.revenue += order['total_amount'] as number;
      }
    }

    // Re-insert products with updated totals
    const updatedProducts = products.map((p) => {
      const sales = productSales.get(p['id'] as string);
      return {
        ...p,
        total_sold: sales?.sold ?? 0,
        total_revenue: +(sales?.revenue ?? 0).toFixed(2),
        imported_at: formatDateTime(new Date()),
      };
    });

    await this.batchInsert('clarixbi_analytics.products', updatedProducts);
  }

  private async updateCustomerTotals(
    orgId: string,
    dataSourceId: string,
    customers: Record<string, unknown>[],
    invoices: Record<string, unknown>[],
  ): Promise<void> {
    const customerStats = new Map<
      string,
      { revenue: number; count: number; firstDate: string | null; lastDate: string | null }
    >();
    for (const c of customers) {
      customerStats.set(c['id'] as string, {
        revenue: 0,
        count: 0,
        firstDate: null,
        lastDate: null,
      });
    }

    for (const inv of invoices) {
      const cid = inv['customer_id'] as string;
      const stats = customerStats.get(cid);
      if (stats) {
        stats.revenue += inv['total_amount'] as number;
        stats.count++;
        const issueDate = inv['issue_date'] as string;
        if (!stats.firstDate || issueDate < stats.firstDate) stats.firstDate = issueDate;
        if (!stats.lastDate || issueDate > stats.lastDate) stats.lastDate = issueDate;
      }
    }

    const updatedCustomers = customers.map((c) => {
      const stats = customerStats.get(c['id'] as string);
      return {
        ...c,
        total_revenue: +(stats?.revenue ?? 0).toFixed(2),
        invoice_count: stats?.count ?? 0,
        first_invoice_date: stats?.firstDate ?? null,
        last_invoice_date: stats?.lastDate ?? null,
        imported_at: formatDateTime(new Date()),
      };
    });

    await this.batchInsert('clarixbi_analytics.customers', updatedCustomers);
  }

  private async batchInsert(table: string, rows: Record<string, unknown>[]): Promise<void> {
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      await this.clickhouse.insert(table, batch);
    }
  }
}
