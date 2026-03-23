import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { verify, JwtPayload } from 'jsonwebtoken';

export interface SyncProgressEvent {
  dataSourceId: string;
  progress: number; // 0-100
  rowsImported: number;
}

export interface SyncCompleteEvent {
  dataSourceId: string;
  totalRows: number;
}

export interface SyncErrorEvent {
  dataSourceId: string;
  error: string;
}

export interface NotificationNewEvent {
  id: string;
  type: string;
  title: string;
  message: string;
}

export interface AiStreamEvent {
  conversationId: string;
  chunk: string;
  done: boolean;
}

export interface AlertTriggeredEvent {
  alertId: string;
  value: number;
  threshold: number;
}

@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin:
      process.env['CORS_ORIGIN']?.split(',') ||
      (process.env['NODE_ENV'] !== 'production' ? 'http://localhost:3000' : []),
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.['token'] as string) ||
        (client.handshake.headers?.['authorization']?.replace('Bearer ', '') as string);

      if (!token) {
        this.logger.warn(`Client ${client.id} disconnected: no token`);
        client.disconnect();
        return;
      }

      const jwtSecret = process.env['JWT_SECRET'];
      if (!jwtSecret) {
        this.logger.error('JWT_SECRET environment variable is not configured');
        client.disconnect();
        return;
      }
      const payload = verify(token, jwtSecret) as JwtPayload & {
        sub: string;
        org_id?: string;
      };

      const userId = payload.sub;
      const orgId = payload.org_id || (client.handshake.query?.['orgId'] as string);

      // Join user-specific room
      await client.join(`user_${userId}`);
      this.logger.log(`Client ${client.id} joined room user_${userId}`);

      // Join org room if org context available
      if (orgId) {
        await client.join(`org_${orgId}`);
        this.logger.log(`Client ${client.id} joined room org_${orgId}`);
      }

      // Store user info on socket for later use
      client.data['userId'] = userId;
      client.data['orgId'] = orgId;
    } catch (error) {
      this.logger.warn(`Client ${client.id} disconnected: invalid token - ${error}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // --- Emit helpers (to be used by services in Sprint 3) ---

  emitSyncProgress(orgId: string, event: SyncProgressEvent) {
    this.server.to(`org_${orgId}`).emit('sync:progress', event);
  }

  emitSyncComplete(orgId: string, event: SyncCompleteEvent) {
    this.server.to(`org_${orgId}`).emit('sync:complete', event);
  }

  emitSyncError(orgId: string, event: SyncErrorEvent) {
    this.server.to(`org_${orgId}`).emit('sync:error', event);
  }

  emitNotification(userId: string, event: NotificationNewEvent) {
    this.server.to(`user_${userId}`).emit('notification:new', event);
  }

  emitAiStream(userId: string, event: AiStreamEvent) {
    this.server.to(`user_${userId}`).emit('ai:stream', event);
  }

  emitAlertTriggered(orgId: string, event: AlertTriggeredEvent) {
    this.server.to(`org_${orgId}`).emit('alert:triggered', event);
  }
}
