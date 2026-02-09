/**
 * React Context for garage state management.
 *
 * Provides centralized state for:
 * - Server state (garage, prices, metrics)
 * - Local UI state (selected spot, hold info, errors)
 * - Connection state (connected, reconnecting)
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import type {
  GarageState,
  PriceResult,
  Metrics,
  Reservation,
  SimulationStats,
  StateSnapshot,
  SpotHeld,
  SpotReleased,
  BookingConfirmed,
  BookingFailed,
  DayComplete,
  ClientMessage,
} from '../types';

// ── State Shape ─────────────────────────────────────────────────────

interface AppState {
  // Server state
  garageState: GarageState | null;
  prices: Record<string, PriceResult>;
  metrics: Metrics | null;

  // Local UI state
  selectedSpaceId: string | null;
  holdInfo: { priceResult: PriceResult; expiresAt: number } | null;
  lastBooking: Reservation | null;
  error: string | null;

  // Connection state
  isConnected: boolean;
  isReconnecting: boolean;

  // UI state
  showIntroModal: boolean;
  dayCompleteStats: SimulationStats | null;
}

const initialState: AppState = {
  garageState: null,
  prices: {},
  metrics: null,
  selectedSpaceId: null,
  holdInfo: null,
  lastBooking: null,
  error: null,
  isConnected: false,
  isReconnecting: false,
  showIntroModal: !localStorage.getItem('introSeen'),
  dayCompleteStats: null,
};

// ── Actions ─────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_STATE_SNAPSHOT'; payload: StateSnapshot }
  | { type: 'SET_SPOT_HELD'; payload: SpotHeld }
  | { type: 'SET_SPOT_RELEASED'; payload: SpotReleased }
  | { type: 'SET_BOOKING_CONFIRMED'; payload: BookingConfirmed }
  | { type: 'SET_BOOKING_FAILED'; payload: BookingFailed }
  | { type: 'SET_DAY_COMPLETE'; payload: DayComplete }
  | { type: 'DISMISS_DAY_COMPLETE' }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_SELECTED_SPACE'; payload: string | null }
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'SET_RECONNECTING'; payload: boolean }
  | { type: 'TOGGLE_INTRO_MODAL' }
  | { type: 'DISMISS_INTRO_MODAL' }
  | { type: 'CLEAR_LAST_BOOKING' }
  | { type: 'CLEAR_HOLD' };

// ── Reducer ─────────────────────────────────────────────────────────

function garageReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_STATE_SNAPSHOT': {
      const { state: garageState, prices, metrics } = action.payload;

      // If we have a hold, check if it's still valid
      let holdInfo = state.holdInfo;
      if (state.selectedSpaceId && holdInfo) {
        const stillHeld = garageState.held_space_ids[state.selectedSpaceId];
        if (!stillHeld) {
          // Hold was released (maybe by server or another client)
          holdInfo = null;
        }
      }

      return {
        ...state,
        garageState,
        prices,
        metrics,
        holdInfo,
      };
    }

    case 'SET_SPOT_HELD': {
      const { space_id, price_result, hold_expires_at } = action.payload;
      return {
        ...state,
        selectedSpaceId: space_id,
        holdInfo: {
          priceResult: price_result,
          expiresAt: hold_expires_at,
        },
        error: null,
      };
    }

    case 'SET_SPOT_RELEASED':
      return {
        ...state,
        selectedSpaceId: null,
        holdInfo: null,
      };

    case 'SET_BOOKING_CONFIRMED':
      return {
        ...state,
        lastBooking: action.payload.reservation,
        selectedSpaceId: null,
        holdInfo: null,
        error: null,
      };

    case 'SET_BOOKING_FAILED':
      return {
        ...state,
        error: action.payload.reason,
        // Clear hold if booking failed due to expiration
        holdInfo: action.payload.reason.toLowerCase().includes('expired')
          ? null
          : state.holdInfo,
      };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    case 'SET_SELECTED_SPACE':
      return {
        ...state,
        selectedSpaceId: action.payload,
        // Clear hold if deselecting
        holdInfo: action.payload === null ? null : state.holdInfo,
      };

    case 'SET_CONNECTED':
      return { ...state, isConnected: action.payload };

    case 'SET_RECONNECTING':
      return { ...state, isReconnecting: action.payload };

    case 'TOGGLE_INTRO_MODAL':
      return { ...state, showIntroModal: !state.showIntroModal };

    case 'DISMISS_INTRO_MODAL':
      localStorage.setItem('introSeen', 'true');
      return { ...state, showIntroModal: false };

    case 'CLEAR_LAST_BOOKING':
      return { ...state, lastBooking: null };

    case 'CLEAR_HOLD':
      return { ...state, holdInfo: null, selectedSpaceId: null };

    case 'SET_DAY_COMPLETE':
      return { ...state, dayCompleteStats: action.payload.stats };

    case 'DISMISS_DAY_COMPLETE':
      return { ...state, dayCompleteStats: null };

    default:
      return state;
  }
}

// ── Context ─────────────────────────────────────────────────────────

interface GarageContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  send: (msg: ClientMessage) => void;
}

const GarageContext = createContext<GarageContextType | null>(null);

// ── Provider ────────────────────────────────────────────────────────

interface GarageProviderProps {
  children: React.ReactNode;
}

export function GarageProvider({ children }: GarageProviderProps) {
  const [state, dispatch] = useReducer(garageReducer, initialState);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);

  // WebSocket connection logic
  const connect = useCallback(() => {
    // Determine WebSocket URL based on environment
    const wsUrl = import.meta.env.PROD
      ? `wss://${window.location.host}/ws`
      : 'ws://localhost:8000/ws';

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      dispatch({ type: 'SET_CONNECTED', payload: true });
      dispatch({ type: 'SET_RECONNECTING', payload: false });
      reconnectAttemptsRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case 'state_snapshot':
            dispatch({ type: 'SET_STATE_SNAPSHOT', payload: msg });
            break;
          case 'spot_held':
            dispatch({ type: 'SET_SPOT_HELD', payload: msg });
            break;
          case 'spot_released':
            dispatch({ type: 'SET_SPOT_RELEASED', payload: msg });
            break;
          case 'booking_confirmed':
            dispatch({ type: 'SET_BOOKING_CONFIRMED', payload: msg });
            break;
          case 'booking_failed':
            dispatch({ type: 'SET_BOOKING_FAILED', payload: msg });
            break;
          case 'error':
            dispatch({ type: 'SET_ERROR', payload: msg.message });
            break;
          case 'day_complete':
            dispatch({ type: 'SET_DAY_COMPLETE', payload: msg });
            break;
          default:
            console.warn('Unknown message type:', msg.type);
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      dispatch({ type: 'SET_CONNECTED', payload: false });
      wsRef.current = null;

      // Schedule reconnect with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
      reconnectAttemptsRef.current += 1;
      dispatch({ type: 'SET_RECONNECTING', payload: true });

      console.log(`Reconnecting in ${delay}ms...`);
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, delay);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    wsRef.current = ws;
  }, []);

  // Connect on mount
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Send message helper
  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    } else {
      console.warn('WebSocket not connected, cannot send:', msg);
    }
  }, []);

  // Auto-dismiss errors after 5 seconds
  useEffect(() => {
    if (state.error) {
      const timeout = setTimeout(() => {
        dispatch({ type: 'CLEAR_ERROR' });
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [state.error]);

  const contextValue: GarageContextType = {
    state,
    dispatch,
    send,
  };

  return (
    <GarageContext.Provider value={contextValue}>
      {children}
    </GarageContext.Provider>
  );
}

// ── Hook ────────────────────────────────────────────────────────────

export function useGarage() {
  const context = useContext(GarageContext);
  if (!context) {
    throw new Error('useGarage must be used within a GarageProvider');
  }
  return context;
}
