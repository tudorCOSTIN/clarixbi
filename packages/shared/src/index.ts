// Enums shared between API and Web

export enum TeamRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  EDITOR = 'editor',
  VIEWER = 'viewer',
}

export enum InviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
}

export enum SubscriptionStatus {
  TRIALING = 'trialing',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  UNPAID = 'unpaid',
}

export enum BillingPeriod {
  MONTHLY = 'monthly',
  ANNUAL = 'annual',
}

export enum DataSourceType {
  SMARTBILL = 'smartbill',
  EFACTURA = 'efactura',
  WOOCOMMERCE = 'woocommerce',
  CSV = 'csv',
}

export enum DataSourceStatus {
  ACTIVE = 'active',
  SYNCING = 'syncing',
  ERROR = 'error',
  DISCONNECTED = 'disconnected',
}

export enum WidgetType {
  LINE = 'line',
  BAR = 'bar',
  PIE = 'pie',
  AREA = 'area',
  TABLE = 'table',
  KPI = 'kpi',
  GAUGE = 'gauge',
  HEATMAP = 'heatmap',
}

export enum DashboardSourceType {
  SMARTBILL = 'smartbill',
  WOOCOMMERCE = 'woocommerce',
  CSV = 'csv',
  EFACTURA = 'efactura',
  MIXED = 'mixed',
}

// API response types

export interface ApiResponse<T> {
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export interface PlanLimits {
  max_data_sources: number;
  max_dashboards: number;
  max_team_members: number;
  max_ai_queries_monthly: number;
  max_alerts: number;
}
