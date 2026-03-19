import axios, { AxiosInstance, AxiosError } from 'axios';
import { Logger } from '@nestjs/common';

const SMARTBILL_BASE_URL = process.env['SMARTBILL_BASE_URL'] || 'https://ws.smartbill.ro/SBORO/api';
const MAX_REQUESTS_PER_MINUTE = 80;
const REQUEST_INTERVAL_MS = Math.ceil(60_000 / MAX_REQUESTS_PER_MINUTE); // ~750ms
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export interface SmartBillCredentials {
  email: string;
  token: string;
}

export interface SmartBillInvoice {
  seriesName: string;
  number: string;
  date: string;
  dueDate: string;
  clientName: string;
  clientCif: string;
  currency: string;
  totalValue: number;
  totalVatValue: number;
  status: string;
  products?: SmartBillProduct[];
}

export interface SmartBillProduct {
  name: string;
  code: string;
  quantity: number;
  price: number;
  currency: string;
  vatPercentage: number;
}

export interface SmartBillClient {
  name: string;
  cif: string;
  regCom: string;
  address: string;
  city: string;
  county: string;
  country: string;
  email: string;
  phone: string;
}

export interface SmartBillPayment {
  seriesName: string;
  number: string;
  date: string;
  value: number;
  currency: string;
  clientName: string;
  clientCif: string;
  type: string;
}

export class SmartBillConnector {
  private readonly logger = new Logger(SmartBillConnector.name);
  private readonly client: AxiosInstance;
  private lastRequestTime = 0;

  constructor(private readonly credentials: SmartBillCredentials) {
    const authToken = Buffer.from(`${credentials.email}:${credentials.token}`).toString('base64');

    this.client = axios.create({
      baseURL: SMARTBILL_BASE_URL,
      timeout: 30_000,
      headers: {
        Authorization: `Basic ${authToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const cif = this.credentials.email;
      await this.makeRequest('GET', '/invoice/list', {
        params: {
          cif,
          filters: JSON.stringify({ startDate: '2024-01-01', endDate: '2024-01-02' }),
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  async fetchInvoices(params: {
    cif: string;
    startDate: string;
    endDate: string;
  }): Promise<SmartBillInvoice[]> {
    const allInvoices: SmartBillInvoice[] = [];
    let page = 1;
    const pageSize = 100;
    let hasMore = true;

    while (hasMore) {
      const response = await this.makeRequest<{ invoices: SmartBillInvoice[] }>(
        'GET',
        '/invoice/list',
        {
          params: {
            cif: params.cif,
            filters: JSON.stringify({
              startDate: params.startDate,
              endDate: params.endDate,
            }),
            page,
            pageSize,
          },
        },
      );

      const invoices = response.invoices || [];
      allInvoices.push(...invoices);
      hasMore = invoices.length === pageSize;
      page++;
    }

    return allInvoices;
  }

  async fetchClients(params: { cif: string }): Promise<SmartBillClient[]> {
    const allClients: SmartBillClient[] = [];
    let page = 1;
    const pageSize = 100;
    let hasMore = true;

    while (hasMore) {
      const response = await this.makeRequest<{ clients: SmartBillClient[] }>(
        'GET',
        '/client/list',
        { params: { cif: params.cif, page, pageSize } },
      );

      const clients = response.clients || [];
      allClients.push(...clients);
      hasMore = clients.length === pageSize;
      page++;
    }

    return allClients;
  }

  async fetchPayments(params: {
    cif: string;
    startDate: string;
    endDate: string;
  }): Promise<SmartBillPayment[]> {
    const allPayments: SmartBillPayment[] = [];
    let page = 1;
    const pageSize = 100;
    let hasMore = true;

    while (hasMore) {
      const response = await this.makeRequest<{ payments: SmartBillPayment[] }>(
        'GET',
        '/payment/list',
        {
          params: {
            cif: params.cif,
            filters: JSON.stringify({
              startDate: params.startDate,
              endDate: params.endDate,
            }),
            page,
            pageSize,
          },
        },
      );

      const payments = response.payments || [];
      allPayments.push(...payments);
      hasMore = payments.length === pageSize;
      page++;
    }

    return allPayments;
  }

  private async makeRequest<T>(
    method: string,
    url: string,
    config: Record<string, unknown> = {},
    retryCount = 0,
  ): Promise<T> {
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

      return response.data;
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
        return this.makeRequest<T>(method, url, config, retryCount + 1);
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
