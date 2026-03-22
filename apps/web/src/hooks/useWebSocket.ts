'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const WS_URL = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:4000';

interface UseWebSocketOptions {
  onSyncProgress?: (data: { dataSourceId: string; progress: number; rowsImported: number }) => void;
  onSyncComplete?: (data: { dataSourceId: string; totalRows: number }) => void;
  onSyncError?: (data: { dataSourceId: string; error: string }) => void;
}

// Singleton socket shared across all hook instances
let sharedSocket: Socket | null = null;
let refCount = 0;

function getOrCreateSocket(): Socket | null {
  if (typeof window === 'undefined') return null;

  if (sharedSocket?.connected || sharedSocket?.active) {
    return sharedSocket;
  }

  const getCookie = (name: string): string | undefined => {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match?.[1];
  };

  const token = getCookie('access_token');
  if (!token) return null;

  sharedSocket = io(`${WS_URL}/ws`, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  return sharedSocket;
}

/**
 * Original hook API — used by data-sources page and sync page.
 * Listens to sync events via callback options.
 */
export function useWebSocket(options: UseWebSocketOptions) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = getOrCreateSocket();
    if (!socket) return;

    socketRef.current = socket;
    refCount++;

    const onProgress = (data: { dataSourceId: string; progress: number; rowsImported: number }) =>
      options.onSyncProgress?.(data);
    const onComplete = (data: { dataSourceId: string; totalRows: number }) =>
      options.onSyncComplete?.(data);
    const onError = (data: { dataSourceId: string; error: string }) => options.onSyncError?.(data);

    socket.on('sync:progress', onProgress);
    socket.on('sync:complete', onComplete);
    socket.on('sync:error', onError);

    return () => {
      socket.off('sync:progress', onProgress);
      socket.off('sync:complete', onComplete);
      socket.off('sync:error', onError);
      refCount--;
      if (refCount <= 0) {
        socket.disconnect();
        sharedSocket = null;
        refCount = 0;
      }
      socketRef.current = null;
    };
  }, [options.onSyncProgress, options.onSyncComplete, options.onSyncError]);

  return socketRef;
}

/**
 * Generic event subscription hook.
 * Returns an `on` function to register listeners on arbitrary WS events.
 *
 * Usage:
 *   const { on } = useSocketEvent();
 *   useEffect(() => {
 *     const off = on('notification:new', (data) => { ... });
 *     return () => off();
 *   }, [on]);
 */
export function useSocketEvent() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = getOrCreateSocket();
    if (!socket) return;

    socketRef.current = socket;
    refCount++;

    return () => {
      refCount--;
      if (refCount <= 0) {
        socket.disconnect();
        sharedSocket = null;
        refCount = 0;
      }
      socketRef.current = null;
    };
  }, []);

  const on = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event: string, handler: (data: any) => void): (() => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      socket.on(event, handler);
      return () => {
        socket.off(event, handler);
      };
    },
    [],
  );

  return { on };
}
