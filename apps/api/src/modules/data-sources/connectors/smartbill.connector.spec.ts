import axios from 'axios';
import { SmartBillConnector } from './smartbill.connector';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('SmartBillConnector', () => {
  let connector: SmartBillConnector;
  let mockRequest: jest.Mock;

  beforeEach(() => {
    mockRequest = jest.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockedAxios.create.mockReturnValue({ request: mockRequest } as any);
    connector = new SmartBillConnector({ email: 'test@example.com', token: 'test-token' });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create axios instance with correct auth header', () => {
      const expectedAuth = Buffer.from('test@example.com:test-token').toString('base64');
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Basic ${expectedAuth}`,
          }),
          timeout: 30000,
        }),
      );
    });
  });

  describe('testConnection', () => {
    it('should return true on successful API call', async () => {
      mockRequest.mockResolvedValueOnce({
        status: 200,
        data: { invoices: [] },
      });

      const result = await connector.testConnection();
      expect(result).toBe(true);
    });

    it('should return false on API error', async () => {
      mockRequest.mockRejectedValueOnce(new Error('Unauthorized'));

      const result = await connector.testConnection();
      expect(result).toBe(false);
    });
  });

  describe('fetchInvoices', () => {
    it('should fetch all invoices with pagination', async () => {
      const invoicesPage1 = Array(100).fill({
        seriesName: 'FCT',
        number: '001',
        date: '2024-01-15',
        clientName: 'Test Client',
        totalValue: 1000,
      });
      const invoicesPage2 = [
        {
          seriesName: 'FCT',
          number: '101',
          date: '2024-01-16',
          clientName: 'Test Client 2',
          totalValue: 500,
        },
      ];

      mockRequest
        .mockResolvedValueOnce({ status: 200, data: { invoices: invoicesPage1 } })
        .mockResolvedValueOnce({ status: 200, data: { invoices: invoicesPage2 } });

      const result = await connector.fetchInvoices({
        cif: 'RO12345',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      expect(result).toHaveLength(101);
      expect(mockRequest).toHaveBeenCalledTimes(2);
    });

    it('should handle empty response', async () => {
      mockRequest.mockResolvedValueOnce({
        status: 200,
        data: { invoices: [] },
      });

      const result = await connector.fetchInvoices({
        cif: 'RO12345',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      expect(result).toHaveLength(0);
    });
  });

  describe('fetchClients', () => {
    it('should fetch all clients', async () => {
      mockRequest.mockResolvedValueOnce({
        status: 200,
        data: { clients: [{ name: 'Client A', cif: 'RO111' }] },
      });

      const result = await connector.fetchClients({ cif: 'RO12345' });
      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('Client A');
    });
  });

  describe('fetchPayments', () => {
    it('should fetch all payments', async () => {
      mockRequest.mockResolvedValueOnce({
        status: 200,
        data: {
          payments: [{ seriesName: 'CH', number: '001', date: '2024-02-01', value: 500 }],
        },
      });

      const result = await connector.fetchPayments({
        cif: 'RO12345',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
      });

      expect(result).toHaveLength(1);
      expect(result[0]!.value).toBe(500);
    });
  });

  describe('retry on errors', () => {
    it('should retry on 429 status', async () => {
      const error429 = { response: { status: 429 }, isAxiosError: true };
      mockRequest
        .mockRejectedValueOnce(error429)
        .mockResolvedValueOnce({ status: 200, data: { invoices: [] } });

      const result = await connector.fetchInvoices({
        cif: 'RO12345',
        startDate: '2024-01-01',
        endDate: '2024-01-02',
      });

      expect(result).toHaveLength(0);
      expect(mockRequest).toHaveBeenCalledTimes(2);
    }, 15000);

    it('should retry on 5xx status', async () => {
      const error500 = { response: { status: 500 }, isAxiosError: true };
      mockRequest
        .mockRejectedValueOnce(error500)
        .mockResolvedValueOnce({ status: 200, data: { invoices: [] } });

      const result = await connector.fetchInvoices({
        cif: 'RO12345',
        startDate: '2024-01-01',
        endDate: '2024-01-02',
      });

      expect(result).toHaveLength(0);
    }, 15000);

    it('should not retry on 4xx (non-429) status', async () => {
      const error401 = { response: { status: 401 }, isAxiosError: true };
      mockRequest.mockRejectedValueOnce(error401);

      await expect(
        connector.fetchInvoices({
          cif: 'RO12345',
          startDate: '2024-01-01',
          endDate: '2024-01-02',
        }),
      ).rejects.toBeDefined();

      expect(mockRequest).toHaveBeenCalledTimes(1);
    });
  });
});
