import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import {AppState, AppStateStatus} from 'react-native';
import {io, Socket} from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_BASE_URL} from '../config/api';
import UserContext from '../components/UserContext';

type SocketEventHandler = (...args: any[]) => void;

interface SocketContextType {
  isConnected: boolean;
  joinEvent: (eventId: string) => void;
  leaveEvent: (eventId: string) => void;
  subscribe: (event: string, handler: SocketEventHandler) => () => void;
}

const SocketContext = createContext<SocketContextType>({
  isConnected: false,
  joinEvent: () => {},
  leaveEvent: () => {},
  subscribe: () => () => {},
});

export const SocketProvider: React.FC<{children: ReactNode}> = ({
  children,
}) => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const joinedEventsRef = useRef<Set<string>>(new Set());
  const listenersRef = useRef<Map<string, Set<SocketEventHandler>>>(new Map());
  const userCtx = useContext(UserContext);
  const userData = userCtx?.userData ?? null;

  // Main connection effect — runs when userData changes
  useEffect(() => {
    if (!userData) {
      // User logged out — tear down socket
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    let socket: Socket | null = null;
    let cancelled = false;

    const initSocket = async () => {
      const token = await AsyncStorage.getItem('userToken');
      if (!token || cancelled) {
        return;
      }

      socket = io(API_BASE_URL, {
        auth: {token},
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        timeout: 10000,
      });

      socket.on('connect', () => {
        setIsConnected(true);
        joinedEventsRef.current.forEach(eventId => {
          socket?.emit('join:event', eventId);
        });
      });

      socket.on('disconnect', () => {
        setIsConnected(false);
      });

      socket.on('connect_error', () => {});

      // Attach any listeners that were registered before the socket was created
      listenersRef.current.forEach((handlers, event) => {
        handlers.forEach(handler => {
          socket?.on(event, handler);
        });
      });

      socketRef.current = socket;
    };

    initSocket();

    // Reconnect on app foreground
    const appStateRef = {current: AppState.currentState};
    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (
          appStateRef.current.match(/inactive|background/) &&
          nextState === 'active'
        ) {
          if (socketRef.current && !socketRef.current.connected) {
            socketRef.current.connect();
          }
        }
        appStateRef.current = nextState;
      },
    );

    return () => {
      cancelled = true;
      subscription.remove();
      if (socket) {
        socket.disconnect();
        socket = null;
      }
      socketRef.current = null;
      setIsConnected(false);
    };
    // Only re-run when user identity changes, not on every userData object reference change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData?._id]);

  const joinEvent = useCallback((eventId: string) => {
    joinedEventsRef.current.add(eventId);
    if (socketRef.current?.connected) {
      socketRef.current.emit('join:event', eventId);
    }
  }, []);

  const leaveEvent = useCallback((eventId: string) => {
    joinedEventsRef.current.delete(eventId);
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave:event', eventId);
    }
  }, []);

  const subscribe = useCallback(
    (event: string, handler: SocketEventHandler): (() => void) => {
      if (!listenersRef.current.has(event)) {
        listenersRef.current.set(event, new Set());
      }
      listenersRef.current.get(event)!.add(handler);

      // Attach to live socket if it exists
      socketRef.current?.on(event, handler);

      return () => {
        listenersRef.current.get(event)?.delete(handler);
        if (listenersRef.current.get(event)?.size === 0) {
          listenersRef.current.delete(event);
        }
        socketRef.current?.off(event, handler);
      };
    },
    [],
  );

  return (
    <SocketContext.Provider
      value={{
        isConnected,
        joinEvent,
        leaveEvent,
        subscribe,
      }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = (): SocketContextType => {
  return useContext(SocketContext);
};

export default SocketContext;
