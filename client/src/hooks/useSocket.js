// client/src/hooks/useSocket.js
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || '';

let sharedSocket = null;

/**
 * Returns a singleton socket.io-client instance and connection status.
 * The socket is created once and reused across all hook calls.
 */
export function useSocket() {
  const [connected, setConnected] = useState(false);

  if (!sharedSocket) {
    sharedSocket = io(SERVER_URL, {
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }

  useEffect(() => {
    const socket = sharedSocket;

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    if (socket.connected) setConnected(true);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  return { socket: sharedSocket, connected };
}
