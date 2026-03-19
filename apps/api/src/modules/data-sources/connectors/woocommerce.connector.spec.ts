/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';
import { WooCommerceConnector, WooCommerceCredentials } from './woocommerce.connector';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WooCommerceConnector', () => {
  let connector: WooCommerceConnector;
  const credentials: WooCommerceCredentials = {
    storeUrl: 'https://test-store.ro',
    consumerKey: 'ck_test123',
    consumerSecret: 'cs_test456',
  };

  const mockAxiosInstance = {
    request: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
    connector = new WooCommerceConnector(credentials);
  });

  describe('constructor', () => {
    it('should create axios client with correct base URL and auth', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://test-store.ro/wp-json/wc/v3',
          auth: {
            username: 'ck_test123',
            password: 'cs_test456',
          },
        }),
      );
    });

    it('should strip trailing slashes from store URL', () => {
      new WooCommerceConnector({
        storeUrl: 'https://test-store.ro/',
        consumerKey: 'ck_test',
        consumerSecret: 'cs_test',
      });

      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://test-store.ro/wp-json/wc/v3',
        }),
      );
    });
  });

  describe('testConnection', () => {
    it('should return true when API responds successfully', async () => {
      mockAxiosInstance.request.mockResolvedValueOnce({
        status: 200,
        data: [{ id: 1 }],
        headers: { 'x-wp-totalpages': '1' },
      });

      const result = await connector.testConnection();
      expect(result).toBe(true);
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: '/orders',
          params: { per_page: 1 },
        }),
      );
    });

    it('should return false when API returns error', async () => {
      mockAxiosInstance.request.mockRejectedValueOnce(new Error('Unauthorized'));

      const result = await connector.testConnection();
      expect(result).toBe(false);
    });
  });

  describe('fetchOrders', () => {
    it('should fetch paginated orders', async () => {
      const mockOrders = [
        {
          id: 1,
          number: '1001',
          status: 'completed',
          date_created: '2024-06-15T10:00:00',
          total: '299.99',
          currency: 'RON',
          line_items: [],
        },
      ];

      mockAxiosInstance.request.mockResolvedValueOnce({
        status: 200,
        data: mockOrders,
        headers: { 'x-wp-totalpages': '3' },
      });

      const result = await connector.fetchOrders({ page: 1, perPage: 100 });

      expect(result.data).toEqual(mockOrders);
      expect(result.totalPages).toBe(3);
    });

    it('should pass after parameter for incremental sync', async () => {
      mockAxiosInstance.request.mockResolvedValueOnce({
        status: 200,
        data: [],
        headers: { 'x-wp-totalpages': '1' },
      });

      await connector.fetchOrders({
        page: 1,
        perPage: 100,
        after: '2024-06-01T00:00:00',
      });

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            after: '2024-06-01T00:00:00',
          }),
        }),
      );
    });
  });

  describe('fetchAllOrders', () => {
    it('should fetch all pages of orders', async () => {
      const page1Orders = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        number: String(1000 + i),
        status: 'completed',
        total: '100',
        line_items: [],
      }));

      const page2Orders = [
        { id: 101, number: '1100', status: 'processing', total: '50', line_items: [] },
      ];

      mockAxiosInstance.request
        .mockResolvedValueOnce({
          status: 200,
          data: page1Orders,
          headers: { 'x-wp-totalpages': '2' },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: page2Orders,
          headers: { 'x-wp-totalpages': '2' },
        });

      const result = await connector.fetchAllOrders();
      expect(result).toHaveLength(101);
    });
  });

  describe('fetchProducts', () => {
    it('should fetch paginated products', async () => {
      const mockProducts = [
        {
          id: 1,
          name: 'Test Product',
          sku: 'TECH-001',
          price: '149.99',
          status: 'publish',
          categories: [{ id: 1, name: 'Periferice' }],
        },
      ];

      mockAxiosInstance.request.mockResolvedValueOnce({
        status: 200,
        data: mockProducts,
        headers: { 'x-wp-totalpages': '1' },
      });

      const result = await connector.fetchProducts({ page: 1, perPage: 100 });
      expect(result.data).toEqual(mockProducts);
    });
  });

  describe('fetchCustomers', () => {
    it('should fetch paginated customers', async () => {
      const mockCustomers = [
        {
          id: 1,
          email: 'test@example.com',
          first_name: 'Ion',
          last_name: 'Popescu',
          orders_count: 5,
          total_spent: '1500.00',
        },
      ];

      mockAxiosInstance.request.mockResolvedValueOnce({
        status: 200,
        data: mockCustomers,
        headers: { 'x-wp-totalpages': '1' },
      });

      const result = await connector.fetchCustomers({ page: 1, perPage: 100 });
      expect(result.data).toEqual(mockCustomers);
    });
  });

  describe('rate limiting', () => {
    it('should enforce rate limiting between requests', async () => {
      mockAxiosInstance.request
        .mockResolvedValueOnce({ status: 200, data: [], headers: {} })
        .mockResolvedValueOnce({ status: 200, data: [], headers: {} });

      const start = Date.now();
      await connector.testConnection();
      await connector.testConnection();
      const elapsed = Date.now() - start;

      // Should have at least some delay (rate limit is ~2400ms)
      expect(elapsed).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('retry on errors', () => {
    it('should retry on 429 status', async () => {
      const error429 = new Error('Too Many Requests');
      (error429 as any).response = { status: 429 };

      mockAxiosInstance.request
        .mockRejectedValueOnce(error429)
        .mockResolvedValueOnce({ status: 200, data: [{ id: 1 }], headers: {} });

      const result = await connector.testConnection();
      expect(result).toBe(true);
      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(2);
    });

    it('should retry on 5xx status', async () => {
      const error500 = new Error('Server Error');
      (error500 as any).response = { status: 500 };

      mockAxiosInstance.request
        .mockRejectedValueOnce(error500)
        .mockResolvedValueOnce({ status: 200, data: [], headers: {} });

      const result = await connector.testConnection();
      expect(result).toBe(true);
    });

    it('should not retry on 4xx (non-429) status', async () => {
      const error401 = new Error('Unauthorized');
      (error401 as any).response = { status: 401 };

      mockAxiosInstance.request.mockRejectedValueOnce(error401);

      const result = await connector.testConnection();
      expect(result).toBe(false);
      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(1);
    });
  });
});
