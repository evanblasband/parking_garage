/**
 * Main Application Component
 *
 * Assembles all components into the parking garage demo layout:
 * - Header with title and help button
 * - Main area with time controls and garage grid
 * - Right sidebar with operator metrics
 * - Slide-out booking panel
 * - Modals and overlays
 */

import { useGarage } from './context/GarageContext';
import { GarageGrid } from './components/GarageGrid/GarageGrid';
import { BookingPanel } from './components/BookingPanel/BookingPanel';
import { TimeControls } from './components/TimeControls/TimeControls';
import { OperatorPanel } from './components/OperatorPanel/OperatorPanel';
import { IntroModal } from './components/IntroModal/IntroModal';
import { MobileWarning } from './components/MobileWarning/MobileWarning';

function AppContent() {
  const { state, dispatch } = useGarage();
  const { isReconnecting, error } = state;

  const handleToggleIntro = () => {
    dispatch({ type: 'TOGGLE_INTRO_MODAL' });
  };

  return (
    <div className="min-h-screen bg-wc-blue flex flex-col">
      {/* Mobile Warning */}
      <MobileWarning />

      {/* Intro Modal */}
      <IntroModal />

      {/* Header */}
      <header className="h-16 bg-wc-dark border-b border-gray-800 flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-wc-white">
            MetLife Stadium Parking
          </h1>
          <span className="px-2 py-1 bg-wc-red/20 text-wc-red text-xs font-medium rounded">
            FIFA World Cup 2026
          </span>
        </div>
        <div className="flex items-center gap-4">
          {/* Connection status */}
          {state.isConnected ? (
            <span className="flex items-center gap-1.5 text-xs text-green-400">
              <span className="w-2 h-2 bg-green-400 rounded-full" />
              Connected
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-red-400">
              <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
              Disconnected
            </span>
          )}

          {/* Help button */}
          <button
            onClick={handleToggleIntro}
            className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
            title="Show help"
          >
            ?
          </button>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <main className="flex-1 p-6 overflow-auto">
          <TimeControls />
          <GarageGrid />
        </main>

        {/* Right sidebar - Operator Panel */}
        <aside className="w-80 bg-wc-dark/50 border-l border-gray-800 p-4 overflow-auto flex-shrink-0">
          <OperatorPanel />
        </aside>
      </div>

      {/* Booking Panel (slide-out) */}
      <BookingPanel />

      {/* Error toast */}
      {error && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-red-900/90 border border-red-700 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50">
          <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Reconnecting banner */}
      {isReconnecting && (
        <div className="fixed bottom-0 left-0 right-0 bg-yellow-500 text-gray-900 text-center py-2 font-medium z-50">
          <span className="animate-pulse">Reconnecting to server...</span>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return <AppContent />;
}
