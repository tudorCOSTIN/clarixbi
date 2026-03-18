-- ClarixBI ClickHouse Analytics Schema
-- Creates database and all analytics tables

CREATE DATABASE IF NOT EXISTS clarixbi_analytics;

-- Invoices (SmartBill)
CREATE TABLE IF NOT EXISTS clarixbi_analytics.invoices (
  id String,
  org_id String,
  data_source_id String,
  invoice_number String,
  customer_id String,
  customer_name String,
  issue_date Date,
  due_date Date,
  total_amount Decimal(18, 2),
  currency String DEFAULT 'RON',
  status String,
  tax_amount Decimal(18, 2) DEFAULT 0,
  tax_type String DEFAULT '',
  payment_date Nullable(Date),
  imported_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(imported_at)
PARTITION BY toYYYYMM(issue_date)
ORDER BY (org_id, issue_date, id);

-- Customers (SmartBill)
CREATE TABLE IF NOT EXISTS clarixbi_analytics.customers (
  id String,
  org_id String,
  data_source_id String,
  name String,
  email String DEFAULT '',
  phone String DEFAULT '',
  company String DEFAULT '',
  tax_code String DEFAULT '',
  total_revenue Decimal(18, 2) DEFAULT 0,
  invoice_count UInt32 DEFAULT 0,
  first_invoice_date Nullable(Date),
  last_invoice_date Nullable(Date),
  imported_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(imported_at)
ORDER BY (org_id, id);

-- Orders (WooCommerce)
CREATE TABLE IF NOT EXISTS clarixbi_analytics.orders (
  id String,
  org_id String,
  data_source_id String,
  order_number String,
  customer_id String,
  customer_email String DEFAULT '',
  order_date DateTime,
  status String,
  total_amount Decimal(18, 2),
  currency String DEFAULT 'RON',
  discount_amount Decimal(18, 2) DEFAULT 0,
  shipping_amount Decimal(18, 2) DEFAULT 0,
  tax_amount Decimal(18, 2) DEFAULT 0,
  payment_method String DEFAULT '',
  items_count UInt32 DEFAULT 0,
  imported_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(imported_at)
PARTITION BY toYYYYMM(order_date)
ORDER BY (org_id, order_date, id);

-- Order Items (WooCommerce)
CREATE TABLE IF NOT EXISTS clarixbi_analytics.order_items (
  id String,
  org_id String,
  order_id String,
  product_id String,
  product_name String,
  quantity UInt32,
  unit_price Decimal(18, 2),
  total_price Decimal(18, 2),
  sku String DEFAULT '',
  imported_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(imported_at)
ORDER BY (org_id, order_id, id);

-- Products (WooCommerce)
CREATE TABLE IF NOT EXISTS clarixbi_analytics.products (
  id String,
  org_id String,
  data_source_id String,
  name String,
  sku String DEFAULT '',
  price Decimal(18, 2),
  category String DEFAULT '',
  stock_quantity Int32 DEFAULT 0,
  status String DEFAULT 'publish',
  total_sold UInt32 DEFAULT 0,
  total_revenue Decimal(18, 2) DEFAULT 0,
  imported_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(imported_at)
ORDER BY (org_id, id);

-- CSV Data (generic)
CREATE TABLE IF NOT EXISTS clarixbi_analytics.csv_data (
  id String,
  org_id String,
  data_source_id String,
  row_data String,
  row_number UInt32,
  imported_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(imported_at)
ORDER BY (org_id, data_source_id, row_number);

-- Payments (SmartBill)
CREATE TABLE IF NOT EXISTS clarixbi_analytics.payments (
  id String,
  org_id String,
  data_source_id String,
  invoice_id String,
  amount Decimal(18, 2),
  currency String DEFAULT 'RON',
  payment_date Date,
  payment_method String DEFAULT '',
  imported_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(imported_at)
ORDER BY (org_id, payment_date, id);
