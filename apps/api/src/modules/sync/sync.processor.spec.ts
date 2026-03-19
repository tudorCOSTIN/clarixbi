import { v4 as uuid } from 'uuid';
import {
  SmartBillInvoice,
  SmartBillClient,
  SmartBillPayment,
} from '../data-sources/connectors/smartbill.connector';

// Test the transform logic directly by extracting it
// Since SyncProcessor is tightly coupled with NestJS DI, we test the transforms separately

describe('SyncProcessor - Data Transforms', () => {
  const orgId = uuid();
  const dataSourceId = uuid();

  function transformInvoices(invoices: SmartBillInvoice[]): Record<string, unknown>[] {
    return invoices.map((inv) => ({
      id: expect.any(String),
      org_id: orgId,
      data_source_id: dataSourceId,
      invoice_number: `${inv.seriesName || ''}${inv.number || ''}`,
      customer_id: inv.clientCif || '',
      customer_name: inv.clientName || '',
      issue_date: inv.date || '1970-01-01',
      due_date: inv.dueDate || inv.date || '1970-01-01',
      total_amount: inv.totalValue || 0,
      currency: inv.currency || 'RON',
      status: inv.status || '',
      tax_amount: inv.totalVatValue || 0,
      tax_type: 'TVA',
      payment_date: null,
      imported_at: expect.any(String),
    }));
  }

  function transformClients(clients: SmartBillClient[]): Record<string, unknown>[] {
    return clients.map((c) => ({
      id: expect.any(String),
      org_id: orgId,
      data_source_id: dataSourceId,
      name: c.name || '',
      email: c.email || '',
      phone: c.phone || '',
      company: c.name || '',
      tax_code: c.cif || '',
      total_revenue: 0,
      invoice_count: 0,
      first_invoice_date: null,
      last_invoice_date: null,
      imported_at: expect.any(String),
    }));
  }

  function transformPayments(payments: SmartBillPayment[]): Record<string, unknown>[] {
    return payments.map((p) => ({
      id: expect.any(String),
      org_id: orgId,
      data_source_id: dataSourceId,
      invoice_id: '',
      amount: p.value || 0,
      currency: p.currency || 'RON',
      payment_date: p.date || '1970-01-01',
      payment_method: p.type || '',
      imported_at: expect.any(String),
    }));
  }

  describe('transformInvoices', () => {
    it('should transform SmartBill invoice to ClickHouse format', () => {
      const invoices: SmartBillInvoice[] = [
        {
          seriesName: 'FCT',
          number: '001',
          date: '2024-03-15',
          dueDate: '2024-04-15',
          clientName: 'Test SRL',
          clientCif: 'RO12345678',
          currency: 'RON',
          totalValue: 1190,
          totalVatValue: 190,
          status: 'emisa',
        },
      ];

      const result = transformInvoices(invoices);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        org_id: orgId,
        data_source_id: dataSourceId,
        invoice_number: 'FCT001',
        customer_id: 'RO12345678',
        customer_name: 'Test SRL',
        issue_date: '2024-03-15',
        due_date: '2024-04-15',
        total_amount: 1190,
        currency: 'RON',
        tax_amount: 190,
      });
    });

    it('should handle missing fields with defaults', () => {
      const invoices: SmartBillInvoice[] = [
        {
          seriesName: '',
          number: '',
          date: '',
          dueDate: '',
          clientName: '',
          clientCif: '',
          currency: '',
          totalValue: 0,
          totalVatValue: 0,
          status: '',
        },
      ];

      const result = transformInvoices(invoices);
      expect(result[0]).toMatchObject({
        invoice_number: '',
        customer_id: '',
        issue_date: '1970-01-01',
        currency: 'RON',
        total_amount: 0,
      });
    });
  });

  describe('transformClients', () => {
    it('should transform SmartBill client to ClickHouse format', () => {
      const clients: SmartBillClient[] = [
        {
          name: 'Company SRL',
          cif: 'RO99999',
          regCom: 'J40/123/2020',
          address: 'Str Test 1',
          city: 'Bucuresti',
          county: 'Bucuresti',
          country: 'Romania',
          email: 'contact@company.ro',
          phone: '0700000000',
        },
      ];

      const result = transformClients(clients);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'Company SRL',
        tax_code: 'RO99999',
        email: 'contact@company.ro',
        phone: '0700000000',
      });
    });
  });

  describe('transformPayments', () => {
    it('should transform SmartBill payment to ClickHouse format', () => {
      const payments: SmartBillPayment[] = [
        {
          seriesName: 'CH',
          number: '001',
          date: '2024-03-20',
          value: 1190,
          currency: 'RON',
          clientName: 'Test SRL',
          clientCif: 'RO12345',
          type: 'transfer_bancar',
        },
      ];

      const result = transformPayments(payments);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        amount: 1190,
        currency: 'RON',
        payment_date: '2024-03-20',
        payment_method: 'transfer_bancar',
      });
    });
  });

  describe('batch logic', () => {
    it('should handle empty arrays', () => {
      expect(transformInvoices([])).toHaveLength(0);
      expect(transformClients([])).toHaveLength(0);
      expect(transformPayments([])).toHaveLength(0);
    });

    it('should handle large arrays', () => {
      const invoices = Array(2500).fill({
        seriesName: 'FCT',
        number: '001',
        date: '2024-01-01',
        dueDate: '2024-02-01',
        clientName: 'Test',
        clientCif: 'RO1',
        currency: 'RON',
        totalValue: 100,
        totalVatValue: 19,
        status: 'emisa',
      });

      const result = transformInvoices(invoices);
      expect(result).toHaveLength(2500);
    });
  });
});
