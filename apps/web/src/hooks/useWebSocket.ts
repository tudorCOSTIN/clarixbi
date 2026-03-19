'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const WS_URL = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:4000';

interface UseWebSocketOptions {
  onSyncProgress?: (data: { dataSourceId: string; progress: number; rowsImported: number }) => void;
  onSyncComplete?: (data: { dataSourceId: string; totalRows: number }) => void;
  onSyncError?: (data: { dataSourceId: string; error: string }) => void;
}

export function useWebSocket(options: UseWebSocketOptions) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const getCookie = (name: string): string | undefined => {
      const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
      return match?.[1];
    };

    const token = getCookie('access_token');
    if (!token) return;

    const socket = io(`${WS_URL}/ws`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('sync:progress', (data) => {
      options.onSyncProgress?.(data);
    });

    socket.on('sync:complete', (data) => {
      options.onSyncComplete?.(data);
    });

    socket.on('sync:error', (data) => {
      options.onSyncError?.(data);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [options.onSyncProgress, options.onSyncComplete, options.onSyncError]);

  return socketRef;
}
