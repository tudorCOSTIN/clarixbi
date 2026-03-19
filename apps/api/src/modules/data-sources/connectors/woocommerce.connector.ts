import axios, { AxiosInstance, AxiosError } from 'axios';
import { Logger } from '@nestjs/common';

const MAX_REQUESTS_PER_MINUTE = 25;
const REQUEST_INTERVAL_MS = Math.ceil(60_000 / MAX_REQUESTS_PER_MINUTE); // ~2400ms
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export interface WooCommerceCredentials {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
}

export interface WooCommerceOrder {
  id: number;
  number: string;
  status: string;
  date_created: string;
  date_modified: string;
  total: string;
  discount_total: string;
  shipping_total: string;
  total_tax: string;
  currency: string;
  payment_method: string;
  payment_method_title: string;
  customer_id: number;
  billing: {
    email: string;
    first_name: string;
    last_name: string;
  };
  line_items: WooCommerceLineItem[];
}

export interface WooCommerceLineItem {
  id: number;
  name: string;
  product_id: number;
  quantity: number;
  price: number;
  total: string;
  sku: string;
}

export interface WooCommerceProduct {
  id: number;
  name: string;
  sku: string;
  price: string;
  regular_price: string;
  status: string;
  stock_quantity: number | null;
  categories: { id: number; name: string }[];
  total_sales: number;
  date_created: string;
}

export interface WooCommerceCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  date_created: string;
  orders_count: number;
  total_spent: string;
  billing: {
    company: string;
    phone: string;
  };
}

export class WooCommerceConnector {
  private readonly logger = new Logger(WooCommerceConnector.name);
  private readonly client: AxiosInstance;
  private lastRequestTime = 0;

  constructor(private readonly credentials: WooCommerceCredentials) {
    const baseURL = credentials.storeUrl.replace(/\/+$/, '') + '/wp-json/wc/v3';

    this.client = axios.create({
      baseURL,
      timeout: 30_000,
      auth: {
        username: credentials.consumerKey,
        password: credentials.consumerSecret,
      },
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest<WooCommerceOrder[]>('GET', '/orders', {
        params: { per_page: 1 },
      });
      return true;
    } catch {
      return false;
    }
  }

  async fetchOrders(params: {
    page?: number;
    perPage?: number;
    after?: string;
  }): Promise<{ data: WooCommerceOrder[]; totalPages: number }> {
    const response = await this.makeRequestWithHeaders<WooCommerceOrder[]>('GET', '/orders', {
      params: {
        page: params.page || 1,
        per_page: params.perPage || 100,
        ...(params.after ? { after: params.after } : {}),
        orderby: 'date',
        order: 'asc',
      },
    });

    return {
      data: response.data,
      totalPages: parseInt(response.headers['x-wp-totalpages'] || '1', 10),
    };
  }

  async fetchAllOrders(after?: string): Promise<WooCommerceOrder[]> {
    const allOrders: WooCommerceOrder[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const result = await this.fetchOrders({ page, perPage: 100, after });
      allOrders.push(...result.data);
      totalPages = result.totalPages;
      page++;
    } while (page <= totalPages);

    return allOrders;
  }

  async fetchProducts(params: {
    page?: number;
    perPage?: number;
  }): Promise<{ data: WooCommerceProduct[]; totalPages: number }> {
    const response = await this.makeRequestWithHeaders<WooCommerceProduct[]>('GET', '/products', {
      params: {
        page: params.page || 1,
        per_page: params.perPage || 100,
      },
    });

    return {
      data: response.data,
      totalPages: parseInt(response.headers['x-wp-totalpages'] || '1', 10),
    };
  }

  async fetchAllProducts(): Promise<WooCommerceProduct[]> {
    const allProducts: WooCommerceProduct[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const result = await this.fetchProducts({ page, perPage: 100 });
      allProducts.push(...result.data);
      totalPages = result.totalPages;
      page++;
    } while (page <= totalPages);

    return allProducts;
  }

  async fetchCustomers(params: {
    page?: number;
    perPage?: number;
  }): Promise<{ data: WooCommerceCustomer[]; totalPages: number }> {
    const response = await this.makeRequestWithHeaders<WooCommerceCustomer[]>('GET', '/customers', {
      params: {
        page: params.page || 1,
        per_page: params.perPage || 100,
      },
    });

    return {
      data: response.data,
      totalPages: parseInt(response.headers['x-wp-totalpages'] || '1', 10),
    };
  }

  async fetchAllCustomers(): Promise<WooCommerceCustomer[]> {
    const allCustomers: WooCommerceCustomer[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const result = await this.fetchCustomers({ page, perPage: 100 });
      allCustomers.push(...result.data);
      totalPages = result.totalPages;
      page++;
    } while (page <= totalPages);

    return allCustomers;
  }

  private async makeRequest<T>(
    method: string,
    url: string,
    config: Record<string, unknown> = {},
    retryCount = 0,
  ): Promise<T> {
    const result = await this.makeRequestWithHeaders<T>(method, url, config, retryCount);
    return result.data;
  }

  private async makeRequestWithHeaders<T>(
    method: string,
    url: string,
    config: Record<string, unknown> = {},
    retryCount = 0,
  ): Promise<{ data: T; headers: Record<string, string> }> {
    await this.rateLimit();

    const startTime = Date.now();
    try {
      const response = await this.client.request<T>({
        method,
        url,
        ...config,
      });

      const duration = Date.now() - startTime;
      this.logger.log(`${method} ${url} → ${response.status} (${duration}ms)`);

      return {
        data: response.data,
        headers: response.headers as Record<string, string>,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;

      this.logger.warn(
        `${method} ${url} → ${status || 'NETWORK_ERROR'} (${duration}ms) attempt=${retryCount + 1}`,
      );

      if (retryCount < MAX_RETRIES && (status === 429 || (status && status >= 500))) {
        const delay = BASE_DELAY_MS * Math.pow(2, retryCount);
        this.logger.log(`Retrying in ${delay}ms...`);
        await this.sleep(delay);
        return this.makeRequestWithHeaders<T>(method, url, config, retryCount + 1);
      }

      throw error;
    }
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < REQUEST_INTERVAL_MS) {
      await this.sleep(REQUEST_INTERVAL_MS - elapsed);
    }
    this.lastRequestTime = Date.now();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
