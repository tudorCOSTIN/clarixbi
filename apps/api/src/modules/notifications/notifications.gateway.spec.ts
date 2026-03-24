jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

process.env['JWT_SECRET'] = 'test-secret';

import { verify } from 'jsonwebtoken';
import { NotificationsGateway } from './notifications.gateway';
import type { Socket } from 'socket.io';

const mockVerify = verify as jest.Mock;

const createMockSocket = (overrides = {}): Partial<Socket> => ({
  id: 'socket-1',
  handshake: {
    auth: { token: 'valid-token' },
    headers: {},
    query: {},
    url: '',
    secure: false,
    issued: Date.now(),
    time: new Date().toString(),
    address: '127.0.0.1',
    xdomain: false,
  } as Socket['handshake'],
  join: jest.fn(),
  disconnect: jest.fn(),
  data: {},
  ...overrides,
});

describe('NotificationsGateway', () => {
  let gateway: NotificationsGateway;
  const mockEmit = jest.fn();
  const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new NotificationsGateway();
    gateway.server = { to: mockTo } as any;
  });

  describe('handleConnection', () => {
    it('should join user and org rooms with valid token', async () => {
      mockVerify.mockReturnValue({
        sub: 'user-123',
        org_id: 'org-456',
      });

      const client = createMockSocket();
      await gateway.handleConnection(client as Socket);

      expect(mockVerify).toHaveBeenCalledWith('valid-token', 'test-secret');
      expect(client.join).toHaveBeenCalledWith('user_user-123');
      expect(client.join).toHaveBeenCalledWith('org_org-456');
      expect(client.data!['userId']).toBe('user-123');
      expect(client.data!['orgId']).toBe('org-456');
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('should disconnect client when no token provided', async () => {
      const client = createMockSocket({
        handshake: {
          auth: {},
          headers: {},
          query: {},
        },
      });

      await gateway.handleConnection(client as Socket);

      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });

    it('should disconnect client when JWT_SECRET is not configured', async () => {
      const originalSecret = process.env['JWT_SECRET'];
      delete process.env['JWT_SECRET'];

      const client = createMockSocket();
      await gateway.handleConnection(client as Socket);

      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();

      process.env['JWT_SECRET'] = originalSecret;
    });

    it('should disconnect client when token is invalid', async () => {
      mockVerify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      const client = createMockSocket();
      await gateway.handleConnection(client as Socket);

      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('should log disconnect without errors', () => {
      const client = createMockSocket();

      expect(() => {
        gateway.handleDisconnect(client as Socket);
      }).not.toThrow();
    });
  });

  describe('emitSyncProgress', () => {
    it('should emit sync:progress to org room', () => {
      const event = {
        dataSourceId: 'ds-1',
        progress: 50,
        rowsImported: 1000,
      };

      gateway.emitSyncProgress('org-123', event);

      expect(mockTo).toHaveBeenCalledWith('org_org-123');
      expect(mockEmit).toHaveBeenCalledWith('sync:progress', event);
    });
  });

  describe('emitSyncComplete', () => {
    it('should emit sync:complete to org room', () => {
      const event = { dataSourceId: 'ds-1', totalRows: 5000 };

      gateway.emitSyncComplete('org-123', event);

      expect(mockTo).toHaveBeenCalledWith('org_org-123');
      expect(mockEmit).toHaveBeenCalledWith('sync:complete', event);
    });
  });

  describe('emitNotification', () => {
    it('should emit notification:new to user room', () => {
      const event = {
        id: 'notif-1',
        type: 'info',
        title: 'Test',
        message: 'Hello',
      };

      gateway.emitNotification('user-123', event);

      expect(mockTo).toHaveBeenCalledWith('user_user-123');
      expect(mockEmit).toHaveBeenCalledWith('notification:new', event);
    });
  });

  describe('emitAiStream', () => {
    it('should emit ai:stream to user room', () => {
      const event = {
        conversationId: 'conv-1',
        chunk: 'Hello world',
        done: false,
      };

      gateway.emitAiStream('user-123', event);

      expect(mockTo).toHaveBeenCalledWith('user_user-123');
      expect(mockEmit).toHaveBeenCalledWith('ai:stream', event);
    });
  });

  describe('emitAlertTriggered', () => {
    it('should emit alert:triggered to org room', () => {
      const event = {
        alertId: 'alert-1',
        value: 95,
        threshold: 90,
      };

      gateway.emitAlertTriggered('org-123', event);

      expect(mockTo).toHaveBeenCalledWith('org_org-123');
      expect(mockEmit).toHaveBeenCalledWith('alert:triggered', event);
    });
  });
});
