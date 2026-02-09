/**
 * Main Application Component
 *
 * Assembles all components into the parking garage demo layout:
 * - Header with title, navigation tabs, and help button
 * - Main area with time controls and garage grid (Demo tab)
 * - Documentation pages (README, PRD, Pricing tabs)
 * - Right sidebar with operator metrics (visible on all tabs)
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
import { DaySummaryModal } from './components/DaySummaryModal/DaySummaryModal';
import { DocumentPage } from './components/DocumentationModal/DocumentationModal';

type TabType = 'demo' | 'readme' | 'prd' | 'pricing';

const TABS: { id: TabType; label: string }[] = [
  { id: 'demo', label: 'Demo' },
  { id: 'readme', label: 'README' },
  { id: 'prd', label: 'PRD' },
  { id: 'pricing', label: 'Pricing Logic' },
];

function AppContent() {
  const { state, dispatch } = useGarage();
  const { isReconnecting, error, activeTab } = state;

  const handleToggleIntro = () => {
    dispatch({ type: 'TOGGLE_INTRO_MODAL' });
  };

  const handleTabChange = (tab: TabType) => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: tab });
  };

  return (
    <div className="min-h-screen bg-wc-blue flex flex-col">
      {/* Mobile Warning */}
      <MobileWarning />

      {/* Intro Modal */}
      <IntroModal />

      {/* Day Complete Summary Modal */}
      <DaySummaryModal />

      {/* Header - Compact with Navigation Tabs */}
      <header className="h-12 bg-wc-dark border-b border-gray-800 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-wc-white">
              MetLife Stadium Parking
            </h1>
            <span className="px-1.5 py-0.5 bg-wc-red/20 text-wc-red text-[10px] font-medium rounded">
              FIFA World Cup 2026
            </span>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 ml-4">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-wc-red text-white'
                    : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {/* Connection status */}
          {state.isConnected ? (
            <span className="flex items-center gap-1 text-[10px] text-green-400">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
              Connected
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-red-400">
              <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
              Disconnected
            </span>
          )}

          {/* Help button */}
          <button
            onClick={handleToggleIntro}
            className="w-6 h-6 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-gray-300 hover:text-white transition-colors text-xs"
            title="Show help"
          >
            ?
          </button>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main content - conditionally render based on active tab */}
        <main className="flex-1 overflow-auto">
          {activeTab === 'demo' ? (
            <div className="p-4">
              <TimeControls />
              <GarageGrid />
            </div>
          ) : (
            <DocumentPage docType={activeTab} />
          )}
        </main>

        {/* Right sidebar - Operator Panel (visible on all tabs to show live metrics) */}
        <aside className="w-56 bg-wc-dark/50 border-l border-gray-800 p-3 overflow-auto flex-shrink-0">
          <OperatorPanel />
        </aside>
      </div>

      {/* Booking Panel (slide-out) - only relevant on demo tab */}
      {activeTab === 'demo' && <BookingPanel />}

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
