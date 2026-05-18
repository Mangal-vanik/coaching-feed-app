import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

let socketInstance: Socket | null = null;

export const getSocket = (): Socket => {
  if (typeof window === 'undefined') {
    // Return a mock or throw if called server-side during SSR
    return {} as Socket;
  }

  if (!socketInstance) {
    console.log(`🔌 [WS] Initializing connection to Socket.IO Server at ${SOCKET_URL}...`);
    socketInstance = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity, // Keep attempting to reconnect
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      transports: ['websocket', 'polling']
    });

    socketInstance.on('connect', () => {
      console.log(`🔌 [WS] Successfully connected to Socket.IO. Client ID: ${socketInstance?.id}`);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log(`🔌 [WS] Disconnected from Socket.IO. Reason: ${reason}`);
    });

    socketInstance.on('connect_error', (error) => {
      console.warn(`🔌 [WS] Connection error:`, error.message);
    });
  }

  return socketInstance;
};
