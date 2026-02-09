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

// GitHub repo URL - update when repo is created
const GITHUB_REPO_URL = 'https://github.com/evanblasband/parking-garage-demo';

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
            {/* GitHub link */}
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded text-xs font-medium transition-colors bg-gray-700/50 text-gray-300 hover:bg-gray-600 hover:text-white flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              GitHub
            </a>
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
